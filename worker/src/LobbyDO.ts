// Snatched XI — LobbyDO: Tournament Edition (4-player round-robin)
// All game state lives here, server-side, inside a Durable Object.

import { DurableObject } from 'cloudflare:workers';

import {
  ClientMessage, ServerMessage,
  DraftablePlayer, PlayerSummary, PlayerRating, TournamentRow,
  FORMATION_SLOTS, canPlayInSlot,
} from './protocol';
import { simulateMatch, SimulationResult } from './simulation';

// ── Constants ──

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;  // can start early with bots if >= 2 humans
const DRAFT_ROUNDS = 11;
const DRAFT_TIMER_SECONDS = 30;
const DISCONNECT_GRACE_SECONDS = 120;
const VALID_FORMATIONS = Object.keys(FORMATION_SLOTS);

// Round-robin schedule for 4 players: all 6 pairings
const TOURNAMENT_PAIRINGS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
];

// ── State Types ──

interface PlayerState {
  id: string;          // "p1", "p2", "p3", "p4"
  name: string;
  teamName?: string;
  formation?: string;
  draftPicks: DraftPick[];
  team: PlayerSlot[];
  connected: boolean;
  isBot: boolean;
  wsTag?: string;
}

interface DraftPick {
  round: number;
  clubSeasonId: string;
  player: PlayerSummary;
  slot: string;
}

interface PlayerSlot {
  slot: string;
  player: PlayerSummary | null;
}

interface TournamentMatchResult {
  homeId: string;
  awayId: string;
  score: { home: number; away: number };
  possession: number;
  shotsOnTarget: { home: number; away: number };
  totalShots: { home: number; away: number };
  topPerformers: PlayerRating[];
  events: any[];
  matchScript: any[];
}

interface LobbyState {
  phase: 'LOBBY' | 'BLUEPRINT' | 'DRAFT' | 'TOURNAMENT' | 'OVER';
  lobbyId: string;
  players: Map<string, PlayerState>;
  
  // Draft state
  currentRound: number;
  currentClubSeasonId: string | null;
  currentClubName: string | null;
  currentSeason: string | null;
  currentSquad: DraftablePlayer[];
  claimedPlayers: Map<string, string>;
  roundComplete: Set<string>;
  
  // Tournament state
  tournamentMatches: TournamentMatchResult[];
  tournamentCurrentMatch: number;
  playerTeams: Map<string, any[]>;  // playerId → FullPlayer[]
}

// ── Durable Object ──

export class LobbyDO extends DurableObject {
  private state: LobbyState;
  
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    this.state = {
      phase: 'LOBBY',
      lobbyId: ctx.id.toString(),
      players: new Map(),
      currentRound: 0,
      currentClubSeasonId: null,
      currentClubName: null,
      currentSeason: null,
      currentSquad: [],
      claimedPlayers: new Map(),
      roundComplete: new Set(),
      tournamentMatches: [],
      tournamentCurrentMatch: 0,
      playerTeams: new Map(),
    };
    
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<LobbyState>('gameState');
      if (stored) {
        this.state.phase = stored.phase;
        this.state.currentRound = stored.currentRound;
        this.state.currentClubSeasonId = stored.currentClubSeasonId;
        this.state.currentClubName = stored.currentClubName;
        this.state.currentSeason = stored.currentSeason;
        this.state.currentSquad = stored.currentSquad || [];
        this.state.players = new Map(stored.players as any);
        this.state.claimedPlayers = new Map(stored.claimedPlayers as any);
        this.state.roundComplete = new Set(stored.roundComplete as any);
        this.state.tournamentMatches = stored.tournamentMatches || [];
        this.state.tournamentCurrentMatch = stored.tournamentCurrentMatch || 0;
      }
    });
  }
  
  private async saveState(): Promise<void> {
    await this.ctx.storage.put('gameState', {
      phase: this.state.phase,
      lobbyId: this.state.lobbyId,
      players: Array.from(this.state.players.entries()),
      currentRound: this.state.currentRound,
      currentClubSeasonId: this.state.currentClubSeasonId,
      currentClubName: this.state.currentClubName,
      currentSeason: this.state.currentSeason,
      currentSquad: this.state.currentSquad,
      claimedPlayers: Array.from(this.state.claimedPlayers.entries()),
      roundComplete: Array.from(this.state.roundComplete),
      tournamentMatches: this.state.tournamentMatches,
      tournamentCurrentMatch: this.state.tournamentCurrentMatch,
    });
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path.endsWith('/ws')) {
      const playerId = url.searchParams.get('player') || 'p1';
      const isBot = url.searchParams.get('bot') === '1';
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, [playerId, isBot ? '1' : '0']);
      return new Response(null, { status: 101, webSocket: client });
    }
    
    if (path.endsWith('/status')) {
      return new Response(JSON.stringify({
        phase: this.state.phase,
        playerCount: this.state.players.size,
        round: this.state.currentRound,
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    return new Response('Snatched XI Lobby', { status: 200 });
  }
  
  async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
    const tags = this.ctx.getTags(ws);
    const playerId = tags[0] as string;
    
    let msg: ClientMessage;
    try { msg = JSON.parse(message); } catch {
      this.sendError(ws, 'Invalid JSON', 'PARSE_ERROR');
      return;
    }
    
    switch (msg.type) {
      case 'join_lobby':
        await this.handleJoin(ws, playerId, msg.playerName, tags[1] === '1', (msg as any).teamName);
        break;
      case 'submit_blueprint':
        await this.handleSubmitBlueprint(ws, playerId, msg.formation, msg.teamName);
        break;
      case 'start_early':
        await this.handleStartEarly(ws, playerId);
        break;
      case 'draft_pick':
        await this.handleDraftPick(ws, playerId, msg.playerId, (msg as any).slot, (msg as any).slotIndex);
        break;
      default:
        this.sendError(ws, `Unknown message type: ${(msg as any).type}`, 'UNKNOWN_TYPE');
    }
  }
  
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const tags = this.ctx.getTags(ws);
    const playerId = tags[0] as string;
    const player = this.state.players.get(playerId);
    if (player) { player.connected = false; }
    const allDisconnected = Array.from(this.state.players.values()).every(p => !p.connected);
    if (allDisconnected) {
      await this.ctx.storage.setAlarm(Date.now() + DISCONNECT_GRACE_SECONDS * 1000);
    }
  }
  
  async webSocketError(ws: WebSocket, error: Error): Promise<void> {
    console.error(`WebSocket error: ${error.message}`);
  }
  
  async alarm(): Promise<void> {
    const allDisconnected = Array.from(this.state.players.values()).every(p => !p.connected);
    if (allDisconnected) { await this.cleanup(); return; }
    
    if (this.state.phase === 'DRAFT' && this.state.currentClubName) {
      if (this.alarmPhase === 'spin_reveal') {
        this.broadcast({ type: 'wheel_spin_result', club: this.state.currentClubName!, season: this.state.currentSeason!, round: this.state.currentRound, thinkSeconds: 5 });
        this.alarmPhase = 'show_squad';
        await this.ctx.storage.setAlarm(Date.now() + 5000);
        return;
      }
      if (this.alarmPhase === 'show_squad') {
        this.broadcast({ type: 'squad_board', players: this.state.currentSquad, round: this.state.currentRound, timerSeconds: DRAFT_TIMER_SECONDS });
        this.alarmPhase = 'draft_timer';
        await this.ctx.storage.setAlarm(Date.now() + DRAFT_TIMER_SECONDS * 1000);
        return;
      }
      if (this.alarmPhase === 'draft_timer') {
        await this.resolveExpiredTimer();
      }
    }
    
    if (this.state.phase === 'TOURNAMENT' && this.alarmPhase === 'next_match') {
      await this.runNextMatch();
    }
  }
  
  private alarmPhase: 'spin_reveal' | 'show_squad' | 'draft_timer' | 'next_match' = 'draft_timer';
  
  // ── Join / Start Early ──
  
  private async handleJoin(ws: WebSocket, playerId: string, playerName: string, isBot: boolean, teamName?: string): Promise<void> {
    if (this.state.players.size >= MAX_PLAYERS && !this.state.players.has(playerId)) {
      this.sendError(ws, 'Lobby is full', 'LOBBY_FULL');
      return;
    }
    
    const existing = this.state.players.get(playerId);
    if (existing) {
      existing.connected = true;
      await this.sendState(ws, playerId);
      return;
    }
    
    this.state.players.set(playerId, {
      id: playerId, name: playerName, teamName: teamName || playerName,
      draftPicks: [], team: [], connected: true, isBot,
    });
    
    await this.saveState();
    
    // Notify all of updated player list
    this.broadcastLobbyState();
    
    // If all 4 joined, move to blueprint
    if (this.state.players.size === MAX_PLAYERS) {
      await this.startBlueprint();
    }
  }
  
  private async handleStartEarly(ws: WebSocket, playerId: string): Promise<void> {
    const humanCount = Array.from(this.state.players.values()).filter(p => !p.isBot).length;
    if (humanCount < MIN_PLAYERS) {
      this.sendError(ws, `Need at least ${MIN_PLAYERS} players to start`, 'NOT_ENOUGH_PLAYERS');
      return;
    }
    
    // Fill remaining slots with bots
    const allIds = ['p1', 'p2', 'p3', 'p4'];
    for (const id of allIds) {
      if (!this.state.players.has(id)) {
        const botNames = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'];
        this.state.players.set(id, {
          id, name: botNames[allIds.indexOf(id)], teamName: botNames[allIds.indexOf(id)],
          draftPicks: [], team: [], connected: true, isBot: true,
        });
      }
    }
    
    await this.saveState();
    this.broadcastLobbyState();
    await this.startBlueprint();
  }
  
  private async startBlueprint(): Promise<void> {
    this.state.phase = 'BLUEPRINT';
    await this.saveState();
    this.broadcast({ type: 'lobby_state', phase: 'BLUEPRINT' });
    
    // Bots auto-submit blueprint
    for (const [id, p] of this.state.players) {
      if (p.isBot) {
        const formation = VALID_FORMATIONS[Math.floor(Math.random() * VALID_FORMATIONS.length)];
        setTimeout(() => {
          this.handleSubmitBlueprintRaw(id, formation, p.teamName || p.name);
        }, 1000 + Math.random() * 2000);
      }
    }
  }
  
  // ── Blueprint ──
  
  private async handleSubmitBlueprint(ws: WebSocket, playerId: string, formation: string, teamName: string): Promise<void> {
    if (this.state.phase !== 'BLUEPRINT') {
      this.sendError(ws, 'Not in blueprint phase', 'WRONG_PHASE');
      return;
    }
    if (!VALID_FORMATIONS.includes(formation)) {
      this.sendError(ws, `Invalid formation: ${formation}`, 'INVALID_FORMATION');
      return;
    }
    await this.handleSubmitBlueprintRaw(playerId, formation, teamName);
  }
  
  private async handleSubmitBlueprintRaw(playerId: string, formation: string, teamName: string): Promise<void> {
    const player = this.state.players.get(playerId);
    if (!player) return;
    
    player.formation = formation;
    player.teamName = teamName;
    player.team = FORMATION_SLOTS[formation].map(slot => ({ slot, player: null }));
    
    await this.saveState();
    
    const allSubmitted = Array.from(this.state.players.values()).every(p => p.formation);
    if (allSubmitted && this.state.players.size === MAX_PLAYERS) {
      // Reveal all formations + team names
      const playerList = Array.from(this.state.players.values()).map(p => ({
        id: p.id, name: p.name,
        formation: p.formation!, teamName: p.teamName || p.name,
      }));
      this.broadcast({ type: 'blueprint_reveal', yourFormation: '', players: playerList });
      
      // Start draft
      this.state.phase = 'DRAFT';
      this.state.currentRound = 1;
      await this.saveState();
      await this.startDraftRound();
    }
  }
  
  // ── Draft ──
  
  private async startDraftRound(): Promise<void> {
    const db = (this.env as any).DB;
    const result = await db.prepare(
      'SELECT id, club, season FROM club_seasons ORDER BY RANDOM() LIMIT 1'
    ).first() as { id: string; club: string; season: string } | null;
    
    if (!result) {
      this.broadcast({ type: 'error', message: 'No club-seasons available', code: 'NO_DATA' });
      return;
    }
    
    this.state.currentClubSeasonId = result.id;
    this.state.currentClubName = result.club;
    this.state.currentSeason = result.season;
    this.state.claimedPlayers = new Map();
    this.state.roundComplete = new Set();
    
    const squadResult = await db.prepare(
      'SELECT id, name, positions, overall, pace, shooting, passing, dribbling, defending, physicality FROM players WHERE club = ? AND season = ? ORDER BY overall DESC LIMIT 25'
    ).bind(result.club, result.season).all() as { results: unknown[] };
    
    this.state.currentSquad = (squadResult.results as unknown[]).map((p: any) => ({
      id: p.id as string, name: p.name as string,
      positions: String(p.positions).split(',').map((s: string) => s.trim()),
      overall: p.overall as number,
      pace: p.pace as number | null, shooting: p.shooting as number | null,
      passing: p.passing as number | null, dribbling: p.dribbling as number | null,
      defending: p.defending as number | null, physicality: p.physicality as number | null,
    }));
    
    await this.saveState();
    
    this.alarmPhase = 'spin_reveal';
    this.broadcast({ type: 'wheel_spin_start', round: this.state.currentRound });
    await this.ctx.storage.setAlarm(Date.now() + 2000);
  }
  
  private async handleDraftPick(ws: WebSocket, playerId: string, pickedPlayerId: string, clientSlot?: string, clientSlotIndex?: number): Promise<void> {
    if (this.state.phase !== 'DRAFT') {
      this.sendError(ws, 'Not in draft phase', 'WRONG_PHASE');
      return;
    }
    
    const player = this.state.players.get(playerId);
    if (!player) { this.sendError(ws, 'Not in lobby', 'NOT_IN_LOBBY'); return; }
    if (this.state.roundComplete.has(playerId)) {
      this.sendError(ws, 'Already submitted this round', 'ALREADY_PICKED');
      return;
    }
    
    const pickedPlayer = this.state.currentSquad.find(p => p.id === pickedPlayerId);
    if (!pickedPlayer) { this.sendError(ws, 'Player not in current squad', 'INVALID_PICK'); return; }
    
    // Check if any other player already claimed this
    for (const [pid, claimId] of this.state.claimedPlayers) {
      if (claimId === pickedPlayerId && pid !== playerId) {
        this.sendError(ws, 'Already claimed by another player!', 'ALREADY_CLAIMED');
        return;
      }
    }
    
    // Need at least one unfilled compatible slot
    const availableSlot = player.team.find(sl => sl.player === null && canPlayInSlot(pickedPlayer.positions, sl.slot));
    if (!availableSlot) { this.sendError(ws, 'No available slot for this position', 'NO_SLOT'); return; }
    
    this.state.claimedPlayers.set(playerId, pickedPlayerId);
    this.state.roundComplete.add(playerId);
    
    let slot: PlayerSlot | undefined;
    if (clientSlotIndex !== undefined && clientSlotIndex >= 0 && clientSlotIndex < player.team.length) {
      const exactSlot = player.team[clientSlotIndex];
      if (exactSlot.player === null && canPlayInSlot(pickedPlayer.positions, exactSlot.slot)) {
        slot = exactSlot;
      }
    }
    if (!slot) {
      slot = player.team.find(sl => sl.player === null && sl.slot === clientSlot && canPlayInSlot(pickedPlayer.positions, sl.slot));
    }
    if (!slot) {
      slot = player.team.find(sl => sl.player === null && canPlayInSlot(pickedPlayer.positions, sl.slot))!;
    }
    
    const exactSlotIndex = player.team.indexOf(slot);
    
    const playerSummary: PlayerSummary = {
      id: pickedPlayer.id, name: pickedPlayer.name,
      positions: pickedPlayer.positions, overall: pickedPlayer.overall, slot: slot.slot,
    };
    
    slot.player = playerSummary;
    player.draftPicks.push({
      round: this.state.currentRound,
      clubSeasonId: this.state.currentClubSeasonId!,
      player: playerSummary, slot: slot.slot,
    });
    
    await this.saveState();
    
    this.broadcast({
      type: 'player_claimed',
      playerId, playerName: player.name,
      claimedPlayer: playerSummary, slotIndex: exactSlotIndex,
      round: this.state.currentRound,
    });
    
    // Check if ALL players have picked
    if (this.state.roundComplete.size === MAX_PLAYERS) {
      await this.advanceDraftRound();
    }
  }
  
  private async resolveExpiredTimer(): Promise<void> {
    for (const [pid, player] of this.state.players) {
      if (!this.state.roundComplete.has(pid)) {
        const claimedIds = new Set(Array.from(this.state.claimedPlayers.values()));
        const remaining = this.state.currentSquad.filter(p => !claimedIds.has(p.id));
        const validPicks = remaining.filter(p =>
          player.team.some(sl => sl.player === null && canPlayInSlot(p.positions, sl.slot))
        );
        const autoPick = validPicks.length > 0
          ? validPicks[Math.floor(Math.random() * validPicks.length)]
          : remaining[Math.floor(Math.random() * remaining.length)];
        
        if (autoPick) {
          this.state.claimedPlayers.set(pid, autoPick.id);
          this.state.roundComplete.add(pid);
          
          const slot = player.team.find(sl => sl.player === null && canPlayInSlot(autoPick.positions, sl.slot))
            || player.team.find(sl => sl.player === null)!;
          const autoSlotIndex = player.team.indexOf(slot);
          
          slot.player = { id: autoPick.id, name: autoPick.name, positions: autoPick.positions, overall: autoPick.overall, slot: slot.slot };
          player.draftPicks.push({ round: this.state.currentRound, clubSeasonId: this.state.currentClubSeasonId!, player: slot.player, slot: slot.slot });
          
          this.broadcast({ type: 'player_claimed', playerId: pid, playerName: player.name, claimedPlayer: slot.player, slotIndex: autoSlotIndex, round: this.state.currentRound });
        }
      }
    }
    
    await this.saveState();
    await this.advanceDraftRound();
  }
  
  private async advanceDraftRound(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.saveState();
    
    this.state.currentRound++;
    
    if (this.state.currentRound > DRAFT_ROUNDS) {
      await this.startTournament();
    } else {
      await this.startDraftRound();
    }
  }
  
  // ── Tournament ──
  
  private async startTournament(): Promise<void> {
    this.state.phase = 'TOURNAMENT';
    
    // Build full teams for all 4 players
    const db = (this.env as any).DB;
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    
    for (const pid of playerIds) {
      const player = this.state.players.get(pid)!;
      const fullTeam: any[] = [];
      for (const sl of player.team) {
        if (!sl.player) continue;
        const dbPlayer = await db.prepare('SELECT * FROM players WHERE id = ?')
          .bind(sl.player.id).first() as Record<string, unknown> | null;
        
        fullTeam.push({
          ...sl.player,
          pace: dbPlayer?.pace ?? null, shooting: dbPlayer?.shooting ?? null,
          passing: dbPlayer?.passing ?? null, dribbling: dbPlayer?.dribbling ?? null,
          defending: dbPlayer?.defending ?? null, physicality: dbPlayer?.physicality ?? null,
          overall: sl.player.overall, slot: sl.slot,
        });
      }
      this.state.playerTeams.set(pid, fullTeam);
    }
    
    // Send draft complete with all teams
    for (const pid of playerIds) {
      const player = this.state.players.get(pid)!;
      const allPlayers = playerIds.map(id => {
        const p = this.state.players.get(id)!;
        return { id, name: p.name, teamName: p.teamName || p.name, team: p.team.filter(s => s.player).map(s => s.player!) };
      });
      this.broadcastToPlayer(pid, { type: 'draft_complete', yourTeam: player.team.filter(s => s.player).map(s => s.player!), players: allPlayers });
    }
    
    this.state.tournamentCurrentMatch = 0;
    this.state.tournamentMatches = [];
    await this.saveState();
    
    // Run first match
    await this.runNextMatch();
  }
  
  private async runNextMatch(): Promise<void> {
    if (this.state.tournamentCurrentMatch >= TOURNAMENT_PAIRINGS.length) {
      // Tournament complete
      const table = this.computeTable();
      this.broadcast({ type: 'tournament_complete', table });
      this.state.phase = 'OVER';
      await this.saveState();
      return;
    }
    
    const [homeIdx, awayIdx] = TOURNAMENT_PAIRINGS[this.state.tournamentCurrentMatch];
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const homeId = playerIds[homeIdx];
    const awayId = playerIds[awayIdx];
    
    const homeTeam = this.state.playerTeams.get(homeId)!;
    const awayTeam = this.state.playerTeams.get(awayId)!;
    const homePlayer = this.state.players.get(homeId)!;
    const awayPlayer = this.state.players.get(awayId)!;
    
    // Announce the match
    this.broadcast({
      type: 'tournament_match',
      homeId, awayId,
      homeName: homePlayer.teamName || homePlayer.name,
      awayName: awayPlayer.teamName || awayPlayer.name,
      matchNumber: this.state.tournamentCurrentMatch + 1,
      totalMatches: TOURNAMENT_PAIRINGS.length,
    });
    
    // Run simulation
    const result = simulateMatch(homeTeam, awayTeam, homePlayer.formation || '4-4-2', awayPlayer.formation || '4-4-2');
    
    // Sort performers into home/away
    const homeTeamRatings = result.topPerformers.filter(p => homeTeam.some(hp => hp.id === p.playerId));
    const awayTeamRatings = result.topPerformers.filter(p => awayTeam.some(ap => ap.id === p.playerId));
    const homeOvr = Math.round(homeTeam.reduce((s: number, p: any) => s + p.overall, 0) / homeTeam.length);
    const awayOvr = Math.round(awayTeam.reduce((s: number, p: any) => s + p.overall, 0) / awayTeam.length);
    
    // Store result
    this.state.tournamentMatches.push({
      homeId, awayId,
      score: result.score,
      possession: result.possession,
      shotsOnTarget: result.shotsOnTarget,
      totalShots: result.totalShots,
      topPerformers: result.topPerformers,
      events: result.events,
      matchScript: result.matchScript,
    });
    
    // Send commentary
    this.broadcast({
      type: 'match_script',
      events: result.matchScript,
      homeName: homePlayer.teamName || homePlayer.name,
      awayName: awayPlayer.teamName || homePlayer.name,
    });
    
    // Send result
    this.broadcast({
      type: 'match_result',
      score: result.score,
      stats: {
        possession: { home: result.possession, away: 100 - result.possession },
        shotsOnTarget: result.shotsOnTarget,
        totalShots: result.totalShots,
      },
      topPerformers: result.topPerformers,
      homeTeam: homeTeamRatings,
      awayTeam: awayTeamRatings,
      homeOvr, awayOvr,
      homeName: homePlayer.teamName || homePlayer.name,
      awayName: awayPlayer.teamName || awayPlayer.name,
      winner: result.score.home > result.score.away ? 'home' : result.score.away > result.score.home ? 'away' : 'draw',
    });
    
    // Send updated table
    const table = this.computeTable();
    this.broadcast({ type: 'tournament_table', table });
    
    this.state.tournamentCurrentMatch++;
    await this.saveState();
    
    // Schedule next match via alarm (3s pause for table viewing)
    this.alarmPhase = 'next_match';
    await this.ctx.storage.setAlarm(Date.now() + 3000);
  }
  
  private computeTable(): TournamentRow[] {
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const rows: Map<string, TournamentRow> = new Map();
    
    for (const pid of playerIds) {
      const p = this.state.players.get(pid)!;
      rows.set(pid, {
        playerId: pid, name: p.name, teamName: p.teamName || p.name,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, points: 0,
      });
    }
    
    for (const match of this.state.tournamentMatches) {
      const home = rows.get(match.homeId)!;
      const away = rows.get(match.awayId)!;
      
      home.played++; away.played++;
      home.goalsFor += match.score.home; home.goalsAgainst += match.score.away;
      away.goalsFor += match.score.away; away.goalsAgainst += match.score.home;
      
      if (match.score.home > match.score.away) { home.won++; home.points += 3; away.lost++; }
      else if (match.score.away > match.score.home) { away.won++; away.points += 3; home.lost++; }
      else { home.drawn++; away.drawn++; home.points += 1; away.points += 1; }
    }
    
    return Array.from(rows.values()).sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
  }
  
  // ── Messaging ──
  
  private sendMessage(ws: WebSocket, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg));
  }
  
  private sendError(ws: WebSocket, message: string, code: string): void {
    this.sendMessage(ws, { type: 'error', message, code });
  }
  
  private broadcast(msg: ServerMessage): void {
    for (const ws of this.ctx.getWebSockets()) {
      this.sendMessage(ws, msg);
    }
  }
  
  private broadcastToPlayer(playerId: string, msg: ServerMessage): void {
    for (const ws of this.ctx.getWebSockets(playerId)) {
      this.sendMessage(ws, msg);
    }
  }
  
  private broadcastLobbyState(): void {
    const players = Array.from(this.state.players.values()).map(p => ({
      id: p.id, name: p.name, isBot: p.isBot,
    }));
    this.broadcast({ type: 'lobby_state', phase: 'LOBBY', players });
  }
  
  private async sendState(ws: WebSocket, playerId: string): Promise<void> {
    const player = this.state.players.get(playerId);
    this.sendMessage(ws, {
      type: 'lobby_state',
      phase: this.state.phase,
      yourFormation: player?.formation,
      currentRound: this.state.currentRound,
    });
  }
  
  private async cleanup(): Promise<void> {
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }
}

interface Env {
  LOBBY: DurableObjectNamespace<LobbyDO>;
  DB: D1Database;
}
