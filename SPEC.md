# Snatched XI — SPEC.md

> **Title:** Snatched XI  
> **Concept:** Real-time 1v1 competitive football draft & simulation game  
> **Inspiration:** 38-0 (viral solo football draft game)  
> **Stack:** Cloudflare Workers + Durable Objects + D1 + WebSockets  

---

## 1. Data Layer

### 1.1 Strategy
**FIFA 23 Complete Player Dataset (stefanoleone992 on Kaggle).** Single source — positions AND attributes in one CC0-licensed package.

| Component | Source | Coverage |
|---|---|---|
| Squad lists + player positions | `stefanoleone992/fifa-23-complete-player-dataset` | 2014-15 through 2022-23 (9 seasons, 180 club-seasons) |
| Player attributes (Pace, Shooting, Passing, Dribbling, Defending, Physicality) | Same dataset | Pre-computed 0-99 ratings for all outfield players |
| Player positions (detailed) | Same dataset | CM, CB, ST, CDM, CAM, LM, RM, LB, RB, LW, RW, LWB, RWB, CF, GK |

**Note:** Goalkeepers have `None` for outfield attributes (pace/shooting/etc.). The simulation engine uses `overall` rating as a proxy for GKs.

### 1.2 Data Shape (D1 Table)

```
players
  id            TEXT PRIMARY KEY  — "aaron-james-ramsey-2014-15"
  name          TEXT              — "Aaron James Ramsey"
  club          TEXT              — "Arsenal"
  season        TEXT              — "2014-15"
  positions     TEXT              — "CM, CDM" (comma-separated, from FIFA)
  overall       INTEGER           — 0-99
  pace          INTEGER           — 0-99 (NULL for GKs)
  shooting      INTEGER           — 0-99 (NULL for GKs)
  passing       INTEGER           — 0-99 (NULL for GKs)
  dribbling     INTEGER           — 0-99 (NULL for GKs)
  defending     INTEGER           — 0-99 (NULL for GKs)
  physicality   INTEGER           — 0-99 (NULL for GKs)
  preferred_foot TEXT             — "Left" / "Right"
```

```
club_seasons
  id            TEXT PRIMARY KEY  — "arsenal-2014-15"
  club          TEXT
  season        TEXT
  league        TEXT              — always "Premier League"
```

**Dataset size:** 8,134 players, 180 club-seasons. ~2 MB JSON, ~3 MB SQL. Fits easily in D1.

### 1.3 Data Pipeline (Complete)
1. Download `stefanoleone992/fifa-23-complete-player-dataset` from Kaggle
2. Filter `male_players.csv` to `league_id=13` (Premier League)
3. Deduplicate: one row per player per club per FIFA version (latest update)
4. Map FIFA version to season (FIFA 15=2014-15, FIFA 23=2022-23)
5. Output as D1-compatible SQL + JSON
6. Seed D1 via `wrangler d1 execute --file seed_fifa23.sql`

**Pipeline scripts:** `data/pipeline/extract_fifa_v2.py`, `data/pipeline/process_fifa23.py`
**Seed files:** `data/output/seed_fifa23.json`, `data/output/seed_fifa23.sql`

---

## 2. Game Loop (State Machine)

The game runs entirely inside a single `LobbyDO` (Durable Object). All state transitions are server-side. Clients communicate via WebSocket messages.

### 2.1 State Machine

```
                  ┌──────────┐
                  │  LOBBY   │  Waiting for Player 2
                  └────┬─────┘
                       │ player_2_joined
                  ┌────▼─────┐
                  │ BLUEPRINT│  Both players submit formation + tactics
                  └────┬─────┘
                       │ both_submitted
                  ┌────▼─────┐
          ┌───────│  DRAFT   │◄──── 11 rounds ────┐
          │       └────┬─────┘                     │
          │            │ wheel_spin + pick          │
          │       ┌────▼──────┐                     │
          │       │ DRAFT_TICK│ 10s timer per pick  │
          │       └────┬──────┘                     │
          │            │ pick_made / timer_expired   │
          │            └────────────────────────────┘
          │       (after round 11)
          │       ┌────▼──────┐
          │       │  SIMULATE │  Best-of-3 matches
          │       └────┬──────┘
          │            │
          │       ┌────▼──────┐
          │       │ INTERLUDE │  Timed window for tactical adjustments
          │       └────┬──────┘  (between match 1→2 and 2→3)
          │            │
          │            └──► back to SIMULATE (×2 more)
          │
          ▼
      ┌──────┐
      │ OVER │  Final results, stats, series winner
      └──────┘
```

### 2.2 Phases in Detail

#### Phase 1: Matchmaking (MVP: Lobby Link)
- **MVP:** No matchmaking queue. Player 1 creates a lobby → gets a shareable link/ID. Player 2 joins via link. Both connect via WebSocket.
- **Post-MVP:** Matchmaking queue with ELO or casual pairing.

#### Phase 2: The Blueprint
- Both players see a simultaneous, hidden-choice screen:
  - **Formation** (choose 1): 4-4-2, 4-3-3, 3-5-2, 4-2-3-1, 3-4-3, 5-3-2, 4-5-1
  - **Tactical Identity** (choose 1): High Press, Tiki-Taka, Counter-Attack, Park the Bus, Wing Play, Route One
- Choices are encrypted/hidden until BOTH players submit.
- Once both submitted → broadcast choices to both clients → advance to Draft.

**MVP note:** Tactical Identity can be simplified or removed for MVP. Formations alone are enough for an initial simulation model.

#### Phase 3: The Draft (11 Rounds)
Each round:
1. **Wheel Spin Animation:** DO broadcasts `wheel_spin_start` — client animates a fruit-machine style spinner with club names flashing by. After 2 seconds, the spinner lands and `wheel_spin_result` reveals the chosen club + season.
2. **Think Window:** 5-second pause before the squad is shown. Players recall the team's stars, plan their pick.
3. **Shared Board:** DO queries the full squad for that club-season from D1 → sends `squad_board` to both clients.
4. **30-Second Timer:** DO sets a DO Alarm for 30 seconds. Players must pick ONE player from the squad.
5. **Resolution:**
   - First player to submit their pick claims that player. The claimed player is immediately removed from the pool.
   - The opponent sees the claim in real-time and must pick from the remaining players.
   - No coin-flips — speed wins. First-to-claim, not random.
6. **Positional Locking:** Drafted players can only fill slots matching their real-world position. A ST goes to striker slot, a CB to center-back slot. The client enforces this; the server validates it.
7. After 11 rounds, both players have a full XI in their chosen formation.

**Timer Expiry:** If a player fails to pick within 30 seconds → auto-assigned a random player from the squad (preferring unfilled positions).

**DO Alarm Usage:** Three-phase alarm per draft round: spin reveal (2s) → squad reveal (5s) → draft timer (30s).

#### Phase 4: Super Sunday (Simulation)
- Single match (MVP) between the two drafted squads.
- **Simulation Engine v2:**
  - **No home advantage** — both teams on equal footing.
  - **Position-weighted team strength:** each player's attributes weighted by their slot (GK defending ×1.0, ST shooting ×1.0, CM passing ×1.0, etc.).
  - **Formation matchup modifiers:** 7×7 matrix. Each formation pair has possession and attack bonuses (±2–8%). e.g., 4-3-3 vs 5-3-2 gets +8% possession but -5% attack.
  - **Position-weighted shooting:** `pickShooter()` distributes chances by position weight (ST=5.0, CB=0.5). Your striker takes most shots, not your centre-back.
  - **Assist system:** after each goal, `pickAssister()` selects an assister weighted by Passing attribute from remaining outfield players.
  - **Dynamic match ratings:** ratings based on actual performance — defenders lose points for goals conceded, attackers gain for goals/assists, clean sheet bonuses, ghost game penalties. Position-specific modifiers.
  - **Possession:** based on aggregate Passing + Dribbling, modified by formation matchup, clamped 25–75%.
  - **Expected goals (xG):** based on team strength difference + formation attack modifier, with ±30% randomness.
- **Post-MVP:** best-of-3 series, intervention windows, tactical identities.

**Output (results page):**
- Scoreline + win/loss/draw banner
- **Your Team** section: Possession, Shots on Target, Total Shots → top 5 rated players with positions, ratings, goals, assists
- **Opponent** section: same stats + top 5
- Both players see the same data, just flipped perspective

**MVP Simplification:** Start with 1 match instead of best-of-3. Add the series format post-MVP.

---

## 3. WebSocket Protocol

All client↔server communication is over a single WebSocket connection per player.

### 3.1 Client → Server Messages

| Message Type | Phase | Payload | Description |
|---|---|---|---|
| `join_lobby` | LOBBY | `{ playerName: string }` | Player joins the lobby |
| `submit_blueprint` | BLUEPRINT | `{ formation: string, tactic: string }` | Player locks in formation + tactic |
| `draft_pick` | DRAFT_TICK | `{ playerId: string }` | Player picks a player from the current squad |
| `adjust_tactic` | INTERLUDE | `{ tactic: string }` | Player changes tactical identity between matches |

### 3.2 Server → Client Messages

| Message Type | Phase | Payload | Description |
|---|---|---|---|
| `lobby_state` | ALL | `{ phase, players, ... }` | Full state sync (on connect/reconnect) |
| `blueprint_reveal` | BLUEPRINT | `{ player1: {...}, player2: {...} }` | Both formations/tactics revealed |
| `wheel_spin` | DRAFT | `{ club: string, season: string }` | The selected club-season |
| `squad_board` | DRAFT | `{ players: Player[] }` | Full squad to draft from |
| `timer_tick` | DRAFT_TICK | `{ secondsRemaining: int }` | Countdown (optional for tension) |
| `pick_result` | DRAFT | `{ player1Pick, player2Pick, conflict?, coinFlip? }` | Round resolution |
| `draft_complete` | DRAFT | `{ team1: Player[], team2: Player[] }` | Both final XIs |
| `match_result` | SIMULATE | `{ score, stats, playerRatings }` | Match outcome |
| `interlude_start` | INTERLUDE | `{ timeRemaining: int }` | Tactical adjustment window open |
| `series_result` | OVER | `{ winner, seriesScore, mvp }` | Final result |

---

## 4. Technical Architecture

### 4.1 Cloudflare Resources

| Resource | Purpose |
|---|---|
| **Worker** | HTTP endpoints (create lobby, join lobby). Static asset serving for client UI. |
| **Durable Object (LobbyDO)** | Per-match state: game phase, draft state, timers (via DO Alarms), WebSocket connections, simulation logic. |
| **D1** | Read-only queries: club-seasons, squads, player attributes. Seeded once from build pipeline. |
| **DO Alarms** | 10-second draft timers. 30-second interlude timers. |

### 4.2 LobbyDO Lifecycle

```
Created → LOBBY phase
  ↓ (2 players connected)
BLUEPRINT phase
  ↓ (both submitted)
DRAFT phase (11 x DRAFT_TICK)
  ↓
SIMULATE + INTERLUDE phases (2-3 cycles)
  ↓
OVER phase → DO destroyed after 5-minute cleanup window
```

- DO memory stores all state. No external writes during gameplay (D1 is read-only at runtime).
- If a player disconnects: DO keeps state alive. Player reconnects → gets `lobby_state` sync.
- If BOTH players disconnect: DO waits 2 minutes, then destroys. Lobby is lost.

### 4.3 Client
- Single-page web app served from the same Worker.
- UI: HTML/CSS/JS (or a lightweight framework like Preact/htm — no SSR needed).
- Connects to DO via WebSocket at `wss://<worker>/lobby/<lobbyId>/ws`.
- All game logic is server-side. Client is a "dumb" renderer + input collector.

### 4.4 Repository Structure

```
snatched-xi/
├── SPEC.md                    # This file
├── data/
│   ├── seed.sql               # D1 seed file (generated from pipeline)
│   ├── pipeline/
│   │   ├── scrape_wikipedia.ts # Wikipedia squad scraper
│   │   ├── merge_fifa.ts      # Cross-reference FIFA datasets
│   │   └── generate_seed.ts   # Output D1-compatible SQL/JSON
│   └── sources/               # Downloaded FIFA CSVs (git-ignored if large)
├── worker/
│   ├── src/
│   │   ├── index.ts           # Worker entry: HTTP routes + WS upgrade
│   │   ├── LobbyDO.ts         # Durable Object: state machine + simulation
│   │   ├── simulation.ts      # Match simulation engine
│   │   ├── database.ts        # D1 query helpers
│   │   └── protocol.ts        # WebSocket message types
│   ├── wrangler.toml
│   └── package.json
├── client/
│   ├── index.html
│   ├── app.ts                 # Main app: WS connection, state management
│   ├── screens/               # Lobby, Blueprint, Draft, Match, Over
│   └── styles.css
└── README.md
```

---

## 5. MVP Scope

### 5.1 In Scope (v0.1)

- [x] Wikipedia + FIFA data pipeline (2008-09 through 2015-16, 8 seasons)
- [x] Single D1 table with ~2,000 players
- [x] Lobby creation via shareable link (no matchmaking)
- [x] WebSocket connection to LobbyDO
- [x] Formation selection (4-4-2, 4-3-3, 3-5-2, 4-2-3-1, 3-4-3, 5-3-2, 4-5-1)
- [x] 11-round draft with wheel spin animation + 5s think window + 30s timer
- [x] First-to-claim draft resolution (no coin-flips, speed wins)
- [x] Positional locking (player position → formation slot)
- [x] Single match simulation (attribute-based, no tactics)
- [x] Match result display (score, basic stats, player ratings)
- [x] DO state persistence across reconnects

### 5.2 Out of Scope (v0.1)

- Tactical identities (High Press, Counter-Attack, etc.)
- Best-of-3 series (single match only)
- Intervention windows (no mid-match tactical adjustments)
- Matchmaking queue / ELO system
- Player accounts / authentication
- Spectator mode / shareable replays
- Mobile-responsive design (desktop-first MVP)
- Animations / sound effects
- AI opponent (human vs human only)

### 5.3 v0.2 Candidates

- Tactical identities + simulation modifiers
- Best-of-3 series with interlude adjustments
- AI opponent for solo play
- More seasons (expand to 2016-2023 with `stefanoleone992` data)
- Basic matchmaking queue

---

## 6. Milestones

| Milestone | Deliverable | Estimated Effort |
|---|---|---|
| **M1: Data Pipeline** | Scraped + merged dataset. Seed SQL file. Verified player counts per season. | 1-2 days |
| **M2: DO State Machine** | LobbyDO with full state transitions (no simulation yet). Draft loop works. WebSocket protocol implemented. | 2-3 days |
| **M3: Simulation Engine** | Attribute-based match simulation. Produces scores + stats. | 1-2 days |
| **M4: Client UI** | Playable web UI: lobby → blueprint → draft → match → result. | 2-3 days |
| **M5: Polish & Deploy** | Reconnect handling, error states, timer tension. Deploy to Cloudflare. | 1-2 days |

**Total MVP estimate: 7-12 days of engineering.**

---

## 7. Decisions Log

| Decision | Outcome | Rationale |
|---|---|---|
| Project name | **Snatched XI** | Evocative — the draft format means players get "snatched" from squads |
| Data start year | **2014-15** | FIFA 23 dataset coverage (FIFA 15 through FIFA 23). Real positions + attributes, no guessing. |
| Formations | **7 formations** (4-4-2, 4-3-3, 3-5-2, 4-2-3-1, 3-4-3, 5-3-2, 4-5-1) | Covers most real-world shapes without overcomplicating slot logic |
| Draft timer | **30 seconds** | Comfortable time to scan a squad, with 5s spin + 5s think window beforehand |
| Disconnect grace | **2 minutes** | If both players drop, lobby holds 2 min then destroys |
| Conflict resolution | **First-to-claim** | No coin-flips. Speed wins. Claimed players instantly removed from pool. |
| Tactical Identity | **Deferred to v0.2** | Adds strategic depth but not needed for core draft loop validation |
| Simulation format | **Single match** for MVP, best-of-3 for v0.2 | Validates the engine before building series logic |
| Matchmaking | **Shareable link** for MVP, queue for v0.2 | Simplest path to two players in a lobby |
| Simulation engine | **v2 dynamic** | No home advantage, position-weighted shooting, formation matchups, assists, dynamic ratings |
