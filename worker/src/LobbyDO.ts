// Snatched XI — LobbyDO: Real-time 1v1 football draft game
// All game state lives here, server-side, inside a Durable Object.

import { DurableObject } from 'cloudflare:workers';

import {
  ClientMessage, ServerMessage,
  DraftablePlayer, PlayerSummary, PlayerRating,
  FORMATION_SLOTS, canPlayInSlot,
} from './protocol';
import { simulateMatch, SimulationResult } from './simulation';

// ── Constants ──

const MAX_PLAYERS = 2;
const DRAFT_ROUNDS = 11;
const DRAFT_TIMER_SECONDS = 30;
const DISCONNECT_GRACE_SECONDS = 120;
const VALID_FORMATIONS = Object.keys(FORMATION_SLOTS);

// ── State Types ──

interface PlayerState {
  id: string;          // "p1" or "p2"
  name: string;
  formation?: string;
  draftPicks: DraftPick[];
  team: PlayerSlot[];   // 11 slots filled during draft
  connected: boolean;
  wsTag?: string;       // WebSocket hibernation tag
}

interface DraftPick {
  round: number;
  clubSeasonId: string;
  player: PlayerSummary;
  slot: string;          // Position slot they're placed in
}

interface PlayerSlot {
  slot: string;          // "GK", "CB", "ST", etc.
  player: PlayerSummary | null;
}

interface LobbyState {
  phase: 'LOBBY' | 'BLUEPRINT' | 'DRAFT' | 'SIMULATE' | 'OVER';
  lobbyId: string;
  players: Map<string, PlayerState>;  // "p1", "p2"
  
  // Draft state
  currentRound: number;
  currentClubSeasonId: string | null;
  currentClubName: string | null;
  currentSeason: string | null;
  currentSquad: DraftablePlayer[];     // Players available this round
  claimedPlayers: Map<string, string>; // playerId -> claimedPlayerId (immediate, first-to-claim)
  roundComplete: Set<string>;          // playerIds who've finished picking this round
  
  // Simulation
  matchResult: SimulationResult | null;
}

// ── Durable Object ──

export class LobbyDO extends DurableObject {
  private state: LobbyState;
  private draftTimerAlarm: number | null = null;
  
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    // Initialize or restore state
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
      matchResult: null,
    };
    
    // Restore from storage if available
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<LobbyState>('gameState');
      if (stored) {
        // Reconstruct Map objects (they serialize as arrays)
        this.state.phase = stored.phase;
        this.state.currentRound = stored.currentRound;
        this.state.currentClubSeasonId = stored.currentClubSeasonId;
        this.state.currentClubName = stored.currentClubName;
        this.state.currentSeason = stored.currentSeason;
        this.state.currentSquad = stored.currentSquad || [];
        this.state.matchResult = stored.matchResult;
        this.state.players = new Map(stored.players as any);
        this.state.claimedPlayers = new Map(stored.claimedPlayers as any);
        this.state.roundComplete = new Set(stored.roundComplete as any);
      }
    });
  }
  
  // ── Persistence ──
  
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
      matchResult: this.state.matchResult,
    });
  }
  
  // ── WebSocket Handling (Hibernation API) ──
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // WebSocket upgrade
    if (path.endsWith('/ws')) {
      const playerId = url.searchParams.get('player') || 'p1';
      
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      // Hibernation: store the server socket and return the client
      this.ctx.acceptWebSocket(server, [playerId]);
      
      return new Response(null, { status: 101, webSocket: client });
    }
    
    // HTTP status endpoint
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
    try {
      msg = JSON.parse(message);
    } catch {
      this.sendError(ws, 'Invalid JSON', 'PARSE_ERROR');
      return;
    }
    
    switch (msg.type) {
      case 'join_lobby':
        await this.handleJoin(ws, playerId, msg.playerName);
        break;
      case 'submit_blueprint':
        await this.handleSubmitBlueprint(ws, playerId, msg.formation);
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
    if (player) {
      player.connected = false;
    }
    
    // Set grace period alarm for disconnect
    const bothDisconnected = Array.from(this.state.players.values())
      .every(p => !p.connected);
    
    if (bothDisconnected) {
      await this.ctx.storage.setAlarm(Date.now() + DISCONNECT_GRACE_SECONDS * 1000);
    }
  }
  
  async webSocketError(ws: WebSocket, error: Error): Promise<void> {
    console.error(`WebSocket error: ${error.message}`);
  }
  
  // ── Alarm Handler (timers + disconnect cleanup) ──
  
  async alarm(): Promise<void> {
    // Check if both players disconnected (grace period expired)
    const allDisconnected = Array.from(this.state.players.values())
      .every(p => !p.connected);
    if (allDisconnected) {
      await this.cleanup();
      return;
    }
    
    // ── Wheel Spin Sequence ──
    if (this.state.phase === 'DRAFT' && this.state.currentClubName) {
      if (this.alarmPhase === 'spin_reveal') {
        // Reveal the club/season, then set alarm for squad reveal (5s think time)
        this.broadcast({
          type: 'wheel_spin_result',
          club: this.state.currentClubName!,
          season: this.state.currentSeason!,
          round: this.state.currentRound,
          thinkSeconds: 5,
        });
        this.alarmPhase = 'show_squad';
        await this.ctx.storage.setAlarm(Date.now() + 5000);
        return;
      }
      
      if (this.alarmPhase === 'show_squad') {
        // Show the squad board + start draft timer
        this.broadcast({
          type: 'squad_board',
          players: this.state.currentSquad,
          round: this.state.currentRound,
          timerSeconds: DRAFT_TIMER_SECONDS,
        });
        this.alarmPhase = 'draft_timer';
        await this.ctx.storage.setAlarm(Date.now() + DRAFT_TIMER_SECONDS * 1000);
        return;
      }
      
      if (this.alarmPhase === 'draft_timer') {
        // Timer expired — auto-assign
        await this.resolveExpiredTimer();
      }
    }
  }
  
  // ── Game Logic ──
  
  private async handleJoin(ws: WebSocket, playerId: string, playerName: string): Promise<void> {
    if (this.state.players.size >= MAX_PLAYERS) {
      this.sendError(ws, 'Lobby is full', 'LOBBY_FULL');
      return;
    }
    
    // If player was disconnected and reconnected
    const existing = this.state.players.get(playerId);
    if (existing) {
      existing.connected = true;
      // Send current state
      await this.sendState(ws, playerId);
      return;
    }
    
    // New player
    this.state.players.set(playerId, {
      id: playerId,
      name: playerName,
      draftPicks: [],
      team: [],
      connected: true,
    });
    
    await this.saveState();
    
    // If both players joined, move to blueprint
    if (this.state.players.size === MAX_PLAYERS) {
      this.state.phase = 'BLUEPRINT';
      await this.saveState();
      this.broadcast({ type: 'lobby_state', phase: 'BLUEPRINT' });
    } else {
      this.sendMessage(ws, { type: 'lobby_state', phase: 'LOBBY' });
    }
  }
  
  private async handleSubmitBlueprint(ws: WebSocket, playerId: string, formation: string): Promise<void> {
    if (this.state.phase !== 'BLUEPRINT') {
      this.sendError(ws, 'Not in blueprint phase', 'WRONG_PHASE');
      return;
    }
    
    if (!VALID_FORMATIONS.includes(formation)) {
      this.sendError(ws, `Invalid formation: ${formation}`, 'INVALID_FORMATION');
      return;
    }
    
    const player = this.state.players.get(playerId);
    if (!player) {
      this.sendError(ws, 'Player not in lobby', 'NOT_IN_LOBBY');
      return;
    }
    
    player.formation = formation;
    
    // Initialize empty team slots
    player.team = FORMATION_SLOTS[formation].map(slot => ({
      slot,
      player: null,
    }));
    
    await this.saveState();
    
    // Check if both players submitted
    const bothSubmitted = Array.from(this.state.players.values())
      .every(p => p.formation);
    
    if (bothSubmitted) {
      // Reveal formations then start draft
      const p1 = this.state.players.get('p1')!;
      const p2 = this.state.players.get('p2')!;
      
      this.broadcastToPlayer('p1', {
        type: 'blueprint_reveal',
        yourFormation: p1.formation!,
        opponentFormation: p2.formation!,
      });
      
      this.broadcastToPlayer('p2', {
        type: 'blueprint_reveal',
        yourFormation: p2.formation!,
        opponentFormation: p1.formation!,
      });
      
      // Start first draft round
      this.state.phase = 'DRAFT';
      this.state.currentRound = 1;
      await this.saveState();
      await this.startDraftRound();
    }
  }
  
  private async startDraftRound(): Promise<void> {
    // Fetch a random club-season from D1
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
    
    // Start the wheel spin alarm sequence
    this.alarmPhase = 'spin_reveal';
    
    // Fetch squad for this club-season
    const squadResult = await db.prepare(
      'SELECT id, name, positions, overall, pace, shooting, passing, dribbling, defending, physicality FROM players WHERE club = ? AND season = ? ORDER BY overall DESC LIMIT 25'
    ).bind(result.club, result.season).all() as { results: unknown[] };

    this.state.currentSquad = (squadResult.results as unknown[]).map((p: any) => ({
      id: p.id as string,
      name: p.name as string,
      positions: String(p.positions).split(',').map((s: string) => s.trim()),
      overall: p.overall as number,
      pace: p.pace as number | null,
      shooting: p.shooting as number | null,
      passing: p.passing as number | null,
      dribbling: p.dribbling as number | null,
      defending: p.defending as number | null,
      physicality: p.physicality as number | null,
    }));
    
    await this.saveState();
    
    // ── Wheel Spin Sequence ──
    // Phase 1: Start spinning (client animates)
    this.broadcast({
      type: 'wheel_spin_start',
      round: this.state.currentRound,
    });
    
    // Set alarm for the reveal (2 seconds of spinning)
    await this.ctx.storage.setAlarm(Date.now() + 2000);
  }
  
  // Track what the alarm is for (since DO alarms can only have one pending)
  private alarmPhase: 'spin_reveal' | 'show_squad' | 'draft_timer' | 'disconnect' = 'draft_timer';

  private async handleDraftPick(ws: WebSocket, playerId: string, pickedPlayerId: string, clientSlot?: string, clientSlotIndex?: number): Promise<void> {
    if (this.state.phase !== 'DRAFT') {
      this.sendError(ws, 'Not in draft phase', 'WRONG_PHASE');
      return;
    }

    const player = this.state.players.get(playerId);
    if (!player) {
      this.sendError(ws, 'Not in lobby', 'NOT_IN_LOBBY');
      return;
    }

    // Already picked this round?
    if (this.state.roundComplete.has(playerId)) {
      this.sendError(ws, 'Already submitted your pick this round', 'ALREADY_PICKED');
      return;
    }

    // Validate the pick is in the current squad
    const pickedPlayer = this.state.currentSquad.find(p => p.id === pickedPlayerId);
    if (!pickedPlayer) {
      this.sendError(ws, 'Player not in current squad', 'INVALID_PICK');
      return;
    }

    // Check if opponent already claimed this player
    const opponentId = playerId === 'p1' ? 'p2' : 'p1';
    const opponentClaim = this.state.claimedPlayers.get(opponentId);
    if (opponentClaim === pickedPlayerId) {
      this.sendError(ws, 'Opponent already claimed this player! Pick another.', 'ALREADY_CLAIMED');
      return;
    }

    // Check position compatibility — need at least one unfilled slot they can play in
    const availableSlot = player.team.find(sl => 
      sl.player === null && canPlayInSlot(pickedPlayer.positions, sl.slot)
    );
    if (!availableSlot) {
      this.sendError(ws, 'No available slot for this player\'s position', 'NO_SLOT');
      return;
    }

    // FIRST TO CLAIM — lock it immediately
    this.state.claimedPlayers.set(playerId, pickedPlayerId);
    this.state.roundComplete.add(playerId);

    // Assign player to slot — use exact index if provided, else match by name
    let slot;
    if (clientSlotIndex !== undefined && clientSlotIndex >= 0 && clientSlotIndex < player.team.length) {
      const exactSlot = player.team[clientSlotIndex];
      if (exactSlot.player === null && canPlayInSlot(pickedPlayer.positions, exactSlot.slot)) {
        slot = exactSlot;
      }
    }
    // Fallback: find first empty slot matching the slot name
    if (!slot) {
      slot = player.team.find(sl =>
        sl.player === null && sl.slot === clientSlot && canPlayInSlot(pickedPlayer.positions, sl.slot)
      );
    }
    // Fallback: auto-pick first matching slot
    if (!slot) {
      slot = player.team.find(sl =>
        sl.player === null && canPlayInSlot(pickedPlayer.positions, sl.slot)
      )!;
    }
    
    // Find the index of this slot in the team array for exact client placement
    const exactSlotIndex = player.team.indexOf(slot);
    
    const playerSummary: PlayerSummary = {
      id: pickedPlayer.id,
      name: pickedPlayer.name,
      positions: pickedPlayer.positions,
      overall: pickedPlayer.overall,
      slot: slot.slot,
    };
    
    slot.player = playerSummary;
    player.draftPicks.push({
      round: this.state.currentRound,
      clubSeasonId: this.state.currentClubSeasonId!,
      player: playerSummary,
      slot: slot.slot,
    });

    await this.saveState();

    // Notify BOTH players immediately about the claim
    this.broadcast({
      type: 'player_claimed',
      playerId: playerId,
      playerName: player.name,
      claimedPlayer: playerSummary,
      slotIndex: exactSlotIndex,
      round: this.state.currentRound,
    });

    // Check if both have picked
    if (this.state.roundComplete.size === MAX_PLAYERS) {
      // Round complete — advance
      await this.advanceDraftRound();
    }
  }
  
  private async resolveExpiredTimer(): Promise<void> {
    // Auto-assign random players to any player who hasn't picked
    const allPlayerIds = Array.from(this.state.players.keys());

    for (const pid of allPlayerIds) {
      if (!this.state.roundComplete.has(pid)) {
        const player = this.state.players.get(pid)!;

        // Find remaining unclaimed players from the squad
        const claimedIds = new Set(Array.from(this.state.claimedPlayers.values()));
        const remaining = this.state.currentSquad.filter(p => !claimedIds.has(p.id));

        // Pick a random player that fits a slot
        const validPicks = remaining.filter(p =>
          player.team.some(sl => sl.player === null && canPlayInSlot(p.positions, sl.slot))
        );

        const autoPick = validPicks.length > 0
          ? validPicks[Math.floor(Math.random() * validPicks.length)]
          : remaining[Math.floor(Math.random() * remaining.length)];

        if (autoPick) {
          this.state.claimedPlayers.set(pid, autoPick.id);
          this.state.roundComplete.add(pid);

          const slot = player.team.find(sl =>
            sl.player === null && canPlayInSlot(autoPick.positions, sl.slot)
          ) || player.team.find(sl => sl.player === null)!;

          const playerSummary: PlayerSummary = {
            id: autoPick.id,
            name: autoPick.name,
            positions: autoPick.positions,
            overall: autoPick.overall,
            slot: slot.slot,
          };

          const autoSlotIndex = player.team.indexOf(slot);

          slot.player = playerSummary;
          player.draftPicks.push({
            round: this.state.currentRound,
            clubSeasonId: this.state.currentClubSeasonId!,
            player: playerSummary,
            slot: slot.slot,
          });

          // Notify about auto-assignment
          this.broadcastToPlayer(pid, {
            type: 'player_claimed',
            playerId: pid,
            playerName: player.name,
            claimedPlayer: playerSummary,
            slotIndex: autoSlotIndex,
            round: this.state.currentRound,
          });
        }
      }
    }

    await this.saveState();
    await this.advanceDraftRound();
  }

  private async advanceDraftRound(): Promise<void> {
    // Clear any pending alarm
    await this.ctx.storage.deleteAlarm();
    await this.saveState();

    // Advance round
    this.state.currentRound++;
    
    if (this.state.currentRound > DRAFT_ROUNDS) {
      // Draft complete — move to simulation
      await this.startSimulation();
    } else {
      await this.startDraftRound();
    }
  }
  
  private async startSimulation(): Promise<void> {
    this.state.phase = 'SIMULATE';
    await this.saveState();
    
    const p1 = this.state.players.get('p1')!;
    const p2 = this.state.players.get('p2')!;
    
    // Build full player objects (with attributes) for simulation
    // We need to fetch attributes from D1 for each drafted player
    const db = (this.env as any).DB;
    
    const buildFullTeam = async (player: PlayerState) => {
      const slots: any[] = [];
      for (const sl of player.team) {
        if (!sl.player) continue;
        
        const dbPlayer = await db.prepare(
          'SELECT * FROM players WHERE id = ?'
        ).bind(sl.player.id).first() as Record<string, unknown> | null;
        
        slots.push({
          ...sl.player,
          pace: dbPlayer?.pace ?? null,
          shooting: dbPlayer?.shooting ?? null,
          passing: dbPlayer?.passing ?? null,
          dribbling: dbPlayer?.dribbling ?? null,
          defending: dbPlayer?.defending ?? null,
          physicality: dbPlayer?.physicality ?? null,
          overall: sl.player.overall,
          slot: sl.slot,
        });
      }
      return slots;
    };
    
    const homeTeam = await buildFullTeam(p1);
    const awayTeam = await buildFullTeam(p2);
    
    // Broadcast draft complete
    this.broadcastToPlayer('p1', {
      type: 'draft_complete',
      yourTeam: p1.team.filter(s => s.player).map(s => s.player!),
      opponentTeam: p2.team.filter(s => s.player).map(s => s.player!),
    });
    
    this.broadcastToPlayer('p2', {
      type: 'draft_complete',
      yourTeam: p2.team.filter(s => s.player).map(s => s.player!),
      opponentTeam: p1.team.filter(s => s.player).map(s => s.player!),
    });
    
    // Run simulation
    const result = simulateMatch(
      homeTeam,
      awayTeam,
      p1.formation || '4-4-2',
      p2.formation || '4-4-2'
    );
    
    this.state.matchResult = result;
    this.state.phase = 'OVER';
    await this.saveState();
    
    // Broadcast play-by-play commentary first
    this.broadcast({
      type: 'match_script',
      events: result.matchScript,
    });
    
    // Split player ratings into home/away teams
    const homeTeamRatings = result.topPerformers.filter(
      p => homeTeam.some(hp => hp.id === p.playerId)
    );
    const awayTeamRatings = result.topPerformers.filter(
      p => awayTeam.some(ap => ap.id === p.playerId)
    );
    
    // Compute average team OVRs
    const homeOvr = Math.round(homeTeam.reduce((s, p) => s + p.overall, 0) / homeTeam.length);
    const awayOvr = Math.round(awayTeam.reduce((s, p) => s + p.overall, 0) / awayTeam.length);
    
    // Broadcast result
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
      homeOvr,
      awayOvr,
      winner: result.score.home > result.score.away ? 'p1' 
        : result.score.away > result.score.home ? 'p2' : 'draw',
    });
  }
  
  // ── Cleanup ──
  
  private async cleanup(): Promise<void> {
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }
  
  // ── Messaging Helpers ──
  
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
  
  private async sendState(ws: WebSocket, playerId: string): Promise<void> {
    // Send full state sync to reconnected player
    const player = this.state.players.get(playerId);
    const opponent = Array.from(this.state.players.values()).find(p => p.id !== playerId);
    
    this.sendMessage(ws, {
      type: 'lobby_state',
      phase: this.state.phase,
      yourFormation: player?.formation,
      opponentFormation: opponent?.formation,
      currentRound: this.state.currentRound,
      yourTeam: player?.team.filter(s => s.player).map(s => s.player!),
      opponentTeam: opponent?.team.filter(s => s.player).map(s => s.player!),
    });
  }
}

// ── Env Interface ──

interface Env {
  LOBBY: DurableObjectNamespace<LobbyDO>;
  DB: D1Database;
}
