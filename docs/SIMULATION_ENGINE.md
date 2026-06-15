# Snatched XI — Simulation Engine Reference

> Current state of the match simulation engine and all available data points.  
> Updated: 2026-06-15 — v3 (defensive pressure, out-of-position penalties, widened xG delta)

---

## 1. Team Strength Calculation

Each player has 6 attributes (Pace, Shooting, Passing, Dribbling, Defending, Physicality) plus Overall. These are weighted by their **position** in the formation — a CB's Defending matters more than their Shooting, a ST's Shooting matters more than their Defending.

### New in v3: Out-of-Position Penalty

If a player is placed in a slot that doesn't appear in their natural `positions` list, all contributing attributes are multiplied by **0.85** (15% penalty). This punishes panicked draft picks — e.g., a pure CAM forced into CM or CDM.

```
positionFitPenalty(player) → 1.0 if slot in positions, else 0.85
weightedTeamStrength() → single number (~45-85 range)
```

### Position Weights

| Slot | Pace | Shooting | Passing | Dribbling | Defending | Physicality |
|---|---|---|---|---|---|---|
| GK | 0.2 | — | 0.3 | — | 1.0 | 0.5 |
| CB | 0.5 | — | 0.4 | — | 1.0 | 0.9 |
| LB/RB | 0.9 | — | 0.6 | 0.4 | 0.8 | 0.5 |
| LWB/RWB | 0.9 | — | 0.7 | 0.7 | 0.6 | 0.5 |
| CDM | — | — | 0.8 | 0.4 | 0.9 | 0.7 |
| CM | — | 0.5 | 1.0 | 0.7 | 0.4 | 0.5 |
| CAM | 0.5 | 0.7 | 0.9 | 0.9 | — | — |
| LM/RM | 0.8 | 0.5 | 0.8 | 0.8 | — | — |
| LW/RW | 0.9 | 0.7 | 0.5 | 0.9 | — | — |
| ST | 0.7 | 1.0 | — | 0.6 | — | 0.6 |
| CF | 0.5 | 0.8 | 0.7 | 0.8 | — | — |

---

## 2. Possession

Based on both teams' aggregate **Passing** (70% weight) and **Dribbling** (30% weight), then modified by the **formation matchup**. Clamped to 25-75%.

```
homePossession = clamp(basePossession + matchupBonus * 100, 25, 75)
```

---

## 3. Formation Matchups

A 7×7 rock-paper-scissors matrix. Each formation pair has:
- **possessionBonus** (±2-8%) — shifts who has the ball
- **attackBonus** (±2-8%) — boosts or reduces xG

### Examples

| Home | Away | Possession | Attack | Why |
|---|---|---|---|---|
| 4-3-3 | 5-3-2 | +8% | -5% | Extra midfielder dominates possession but struggles against 5 at back |
| 5-3-2 | 4-3-3 | -8% | +5% | Defensive shape, lethal on the counter |
| 3-5-2 | 4-4-2 | +5% | +2% | Wing-backs overload wide areas |
| 4-5-1 | 4-4-2 | +4% | -3% | Packs midfield, starves 4-4-2 of possession |

Full 7×7 matrix defined in `simulation.ts`.

---

## 4. Expected Goals (xG) — v3

### Key Changes from v2
- **Divisor tightened:** `/200` → `/60` — a 30-point OVR gap now produces xG of 1.80 vs 0.60 (was 1.38 vs 1.02)
- **Randomness reduced:** ±30% → ±12% — the players' stats, not RNG, decide the game
- **No home advantage** (unchanged)

```
homeXg = 1.2 * (1 + strengthDiff/60) * (1 + attackBonus) * random(0.88, 1.12)
awayXg = 1.2 * (1 - strengthDiff/60) * (1 - attackBonus) * random(0.88, 1.12)
```

### Trace: 85 OVR vs 55 OVR (diff=30)
- Home xG range: [1.58 – 2.02]
- Away xG range: [0.53 – 0.67]
- **No overlap.** Quality wins decisively.

### Trace: 75 OVR vs 70 OVR (diff=5)
- Home xG range: [1.14 – 1.46]
- Away xG range: [0.97 – 1.23]
- **Some overlap.** Close matchups stay close and competitive.

---

## 5. Shot Resolution — v3

### Key Changes from v2
- **Defensive pressure** introduced: the defending team's back line (CBs, full-backs, wing-backs, CDMs) now actively reduces goal probability
- **GK weight boosted:** 0.30 → 0.35
- **Flat success bonus reduced:** 0.20 → 0.15

```
defensivePressure = avgDefending(back line) / 100 * 0.35

goal if: Math.random() < shooting/100 * 0.7
                     - GK_overall/100 * 0.35
                     - defensivePressure
                     + 0.15
```

### Trace Examples

| Shooter | GK | Back Line DEF | Goal % |
|---|---|---|---|
| Haaland (85 SHO) | Alisson (88) | Elite (85) | 13.9% |
| Haaland (85 SHO) | Average (70) | Weak (60) | 29.0% |
| Average ST (70) | Alisson (88) | Elite (85) | 3.4% |
| Average ST (70) | Weak (70) | Weak (60) | 18.5% |

A well-drafted defense now cuts goal probability by ~15 percentage points vs a weak one.

---

## 6. Shooter Position Weights

| Position | Weight | Notes |
|---|---|---|
| ST | 5.0 | Primary goal threat |
| CF | 4.5 | Second striker |
| LW, RW | 4.0 | Wide forwards |
| CAM | 3.0 | Attacking midfielder |
| CM | 2.0 | Box-to-box |
| LM, RM | 1.5 | Wide midfielders |
| CDM | 1.0 | Rare long-range efforts |
| LWB, RWB, LB, RB, CB | 0.5 | Set pieces only |
| GK | 0.1 | Almost never |

---

## 7. Assists

After each goal, an assister is picked from the scoring team (excluding the scorer and GK), weighted by their **Passing** attribute. Higher passing = more likely to be credited.

---

## 8. Player Ratings (Dynamic)

Every player starts at `6.0 + (Overall - 70) / 20 + random(-0.75, +0.75)`. Then position-specific modifiers are applied:

### Position-Specific Modifiers

| Position Group | Clean Sheet | Goals Conceded | Possession | Ghost Game (0 G+A) | Multi-Goal |
|---|---|---|---|---|---|
| GK | +1.5 | -0.4/goal | — | — | — |
| DEF (CB/LB/RB/LWB/RWB) | +0.8 | -0.35/goal | ±0.2 | — | — |
| CDM | +0.5 | -0.2/goal | ±0.3 | — | — |
| CM/LM/RM | — | — | ±0.2-0.3 | — | — |
| CAM | — | — | +0.3 | -0.3 | — |
| ST/CF/LW/RW | — | — | — | -0.4 | +0.5 brace, +0.5 hat-trick |

### Universal Bonuses
- +1.0 per goal scored
- +0.5 per assist
- Final rating clamped to 3.0-10.0
- Top 6 shown on results page

---

## 9. Available Stats

### 9.1 Per Player (from FIFA 23 dataset — 8,134 players, 9 seasons)

| Category | Fields | Notes |
|---|---|---|
| **Identity** | `name`, `club`, `season`, `positions` (e.g. "CM, CDM") | Full names, comma-separated position list |
| **Game attributes** | `pace`, `shooting`, `passing`, `dribbling`, `defending`, `physicality` | Pre-computed 0-99, already grouped |
| **Raw FIFA attrs** | 33 individual attributes | Available in source CSV, not in current D1 seed |
| **Meta** | `overall` (0-99), `preferred_foot` | Also: `attacking_work_rate`, `defensive_work_rate` in source |

#### Raw FIFA Attributes (available in source CSV, not extracted to D1)

| Category | Attributes |
|---|---|
| **Pace** | acceleration, sprint_speed |
| **Shooting** | finishing, shot_power, long_shots, volleys, penalties |
| **Passing** | short_passing, long_passing, crossing, curve, free_kick_accuracy |
| **Dribbling** | dribbling, ball_control, agility, balance |
| **Defending** | marking, standing_tackle, sliding_tackle, interceptions |
| **Physical** | strength, stamina, jumping, aggression, heading_accuracy |
| **Mental** | vision, positioning, reactions, composure |
| **GK** | gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes |

### 9.2 Per Match (generated during simulation)

| What | Detail |
|---|---|
| `score` | Home goals, away goals |
| `possession` | Home %, away % |
| `shotsOnTarget` | Home count, away count |
| `totalShots` | Home count, away count |
| `topPerformers` | All 22 players with ratings, goals, assists |
| `events` | Goal events with minute, scorer, assister |
| `winner` | "p1", "p2", or "draw" |
| `homeOvr` / `awayOvr` | Average squad OVR for each team |

---

## 10. Stats We DON'T Currently Use

| What | Why it matters | Where it lives |
|---|---|---|
| Individual raw FIFA attributes (acceleration, vision, reactions, composure, etc.) | More granular simulation — e.g., `vision` for through-ball quality, `reactions` for GK save probability | In the FIFA 23 source CSV |
| Preferred foot | Could affect shooting angles, cross accuracy | Extracted as `preferred_foot` field |
| Work rates (attacking/defensive) | Could affect positioning, pressing intensity | In source CSV |
| Player age / experience | Older players could tire faster | In source CSV |
| GK-specific attributes | Currently GKs use `overall` as proxy; would improve saveQuality calculation | In source CSV — gk_reflexes, gk_positioning, etc. |
| Team chemistry / formation fit | A CM forced into CDM should be less effective | Now partially handled by out-of-position penalty |
| Match events beyond goals | Tackles, saves, fouls — currently only goals generated | Could add for richer narrative |
| Fatigue / stamina drain | Players could degrade over 90 minutes | Stamina attribute exists, not used dynamically |

---

## 11. Version History

| Version | Changes |
|---|---|
| v1 | Basic attribute-weighted team strength, xG with /200 divisor, random shooter, simple goal check |
| v2 | Formation matchups (7×7 matrix), position-weighted shooting, assists, dynamic player ratings, no home advantage |
| v3 | **Divisor /60** (punishing quality gaps), **±12% randomness** (stats over RNG), **defensive pressure** (back line defending blocks shots), **out-of-position penalty** (15% if slot not in natural positions), **GK weight 0.30→0.35**, **flat bonus 0.20→0.15** |
