// Snatched XI — Shared types (mirrors backend protocol.ts)

export const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '3-4-3', '5-3-2', '4-5-1'];

export const FORMATION_SLOTS: Record<string, string[]> = {
  '4-4-2':   ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '4-3-3':   ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'],
  '3-5-2':   ['GK', 'CB', 'CB', 'CB', 'LWB', 'CM', 'CM', 'CM', 'RWB', 'ST', 'ST'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'CAM', 'LM', 'RM', 'ST'],
  '3-4-3':   ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
  '5-3-2':   ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CM', 'CM', 'ST', 'ST'],
  '4-5-1':   ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST'],
};

// Pitch slot positions (x%, y%)
export const PITCH_SLOTS: Record<string, Record<string, { x: number; y: number }>> = {
  '4-4-2':   { GK:{x:50,y:88}, LB:{x:10,y:70}, CB:{x:35,y:70}, CB2:{x:65,y:70}, RB:{x:90,y:70}, LM:{x:10,y:43}, CM:{x:35,y:43}, CM2:{x:65,y:43}, RM:{x:90,y:43}, ST:{x:40,y:15}, ST2:{x:60,y:15} },
  '4-3-3':   { GK:{x:50,y:88}, LB:{x:10,y:70}, CB:{x:35,y:70}, CB2:{x:65,y:70}, RB:{x:90,y:70}, CM:{x:22,y:43}, CM2:{x:50,y:38}, CM3:{x:78,y:43}, LW:{x:15,y:15}, ST:{x:50,y:12}, RW:{x:85,y:15} },
  '3-5-2':   { GK:{x:50,y:88}, CB:{x:22,y:70}, CB2:{x:50,y:70}, CB3:{x:78,y:70}, LWB:{x:8,y:50}, CM:{x:30,y:43}, CM2:{x:50,y:38}, CM3:{x:70,y:43}, RWB:{x:92,y:50}, ST:{x:40,y:15}, ST2:{x:60,y:15} },
  '4-2-3-1': { GK:{x:50,y:88}, LB:{x:10,y:70}, CB:{x:35,y:70}, CB2:{x:65,y:70}, RB:{x:90,y:70}, CDM:{x:35,y:50}, CDM2:{x:65,y:50}, CAM:{x:50,y:35}, LM:{x:12,y:28}, RM:{x:88,y:28}, ST:{x:50,y:12} },
  '3-4-3':   { GK:{x:50,y:88}, CB:{x:22,y:70}, CB2:{x:50,y:70}, CB3:{x:78,y:70}, LM:{x:8,y:55}, CM:{x:35,y:43}, CM2:{x:65,y:43}, RM:{x:92,y:55}, LW:{x:18,y:15}, ST:{x:50,y:12}, RW:{x:82,y:15} },
  '5-3-2':   { GK:{x:50,y:88}, LWB:{x:8,y:52}, CB:{x:22,y:70}, CB2:{x:50,y:70}, CB3:{x:78,y:70}, RWB:{x:92,y:52}, CM:{x:28,y:38}, CM2:{x:50,y:33}, CM3:{x:72,y:38}, ST:{x:40,y:15}, ST2:{x:60,y:15} },
  '4-5-1':   { GK:{x:50,y:88}, LB:{x:10,y:70}, CB:{x:35,y:70}, CB2:{x:65,y:70}, RB:{x:90,y:70}, LM:{x:8,y:45}, CM:{x:28,y:40}, CM2:{x:50,y:38}, CM3:{x:72,y:40}, RM:{x:92,y:45}, ST:{x:50,y:14} },
};

export interface DraftablePlayer {
  id: string;
  name: string;
  positions: string[];
  overall: number;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physicality: number | null;
}

export interface PlayerSummary {
  id: string;
  name: string;
  positions: string[];
  overall: number;
  slot: string;
}

export interface PlayerRating {
  playerId: string;
  playerName: string;
  positions?: string[];
  rating: number;
  goals?: number;
  assists?: number;
}

// ── Server → Client Messages ──

export type ServerMessage =
  | { type: "lobby_state"; phase: string; yourFormation?: string; opponentFormation?: string; currentRound?: number; yourTeam?: any[] }
  | { type: "blueprint_reveal"; yourFormation: string; opponentFormation: string }
  | { type: "wheel_spin_start"; round: number }
  | { type: "wheel_spin_result"; club: string; season: string; round: number; thinkSeconds: number }
  | { type: "squad_board"; players: DraftablePlayer[]; round: number; timerSeconds: number }
  | { type: "player_claimed"; playerId: string; playerName: string; claimedPlayer: PlayerSummary; slotIndex: number; round: number }
  | { type: "draft_complete"; yourTeam: PlayerSummary[]; opponentTeam: PlayerSummary[] }
  | { type: "match_result"; score: { home: number; away: number }; stats: any; topPerformers: PlayerRating[]; homeTeam: PlayerRating[]; awayTeam: PlayerRating[]; winner: string }
  | { type: "error"; message: string; code: string };

// ── Client → Server Messages ──

export type ClientMessage =
  | { type: "join_lobby"; playerName: string }
  | { type: "submit_blueprint"; formation: string }
  | { type: "draft_pick"; playerId: string; slot?: string };
