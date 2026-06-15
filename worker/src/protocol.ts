// Snatched XI — WebSocket Protocol (Tournament Edition)
// All messages between client and server

// ── Client → Server ──

export interface JoinLobbyMessage {
  type: 'join_lobby';
  playerName: string;
  teamName?: string;
}

export interface SubmitBlueprintMessage {
  type: 'submit_blueprint';
  formation: string;
  teamName: string;  // e.g. "Red Devils", "FC Nuc"
}

export interface StartEarlyMessage {
  type: 'start_early';  // fill remaining slots with bots
}

export interface DraftPickMessage {
  type: 'draft_pick';
  playerId: string;
  slot?: string;
  slotIndex?: number;
}

// ── Server → Client ──

export interface LobbyStateMessage {
  type: 'lobby_state';
  phase: string;
  players?: { id: string; name: string; isBot: boolean }[];
  yourFormation?: string;
  currentRound?: number;
  yourTeam?: PlayerSummary[];
}

export interface BlueprintRevealMessage {
  type: 'blueprint_reveal';
  yourFormation: string;
  players: { id: string; name: string; formation: string; teamName: string }[];
}

export interface WheelSpinStartMessage {
  type: 'wheel_spin_start';
  round: number;
}

export interface WheelSpinResultMessage {
  type: 'wheel_spin_result';
  club: string;
  season: string;
  round: number;
  thinkSeconds: number;
}

export interface SquadBoardMessage {
  type: 'squad_board';
  players: DraftablePlayer[];
  round: number;
  timerSeconds: number;
}

export interface PlayerClaimedMessage {
  type: 'player_claimed';
  playerId: string;
  playerName: string;
  claimedPlayer: PlayerSummary;
  slotIndex?: number;
  round: number;
}

export interface DraftCompleteMessage {
  type: 'draft_complete';
  yourTeam: PlayerSummary[];
  players: { id: string; name: string; teamName: string; team: PlayerSummary[] }[];
}

export interface CommentaryEvent {
  minute: number;
  type: string;
  player: string;
  team: 'home' | 'away';
  detail?: string;
  assist?: string;
}

export interface MatchScriptMessage {
  type: 'match_script';
  events: CommentaryEvent[];
  homeName: string;
  awayName: string;
}

export interface MatchResultMessage {
  type: 'match_result';
  score: { home: number; away: number };
  stats: {
    possession: { home: number; away: number };
    shotsOnTarget: { home: number; away: number };
    totalShots: { home: number; away: number };
  };
  topPerformers: PlayerRating[];
  homeTeam: PlayerRating[];
  awayTeam: PlayerRating[];
  homeOvr?: number;
  awayOvr?: number;
  winner: string;
  homeName?: string;
  awayName?: string;
}

export interface TournamentMatchMessage {
  type: 'tournament_match';
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  matchNumber: number;
  totalMatches: number;
}

export interface TournamentTableMessage {
  type: 'tournament_table';
  table: TournamentRow[];
}

export interface TournamentCompleteMessage {
  type: 'tournament_complete';
  table: TournamentRow[];
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  code: string;
}

// ── Data Types ──

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
  slot?: string;
}

export interface PlayerRating {
  playerId: string;
  playerName: string;
  positions?: string[];
  rating: number;
  goals?: number;
  assists?: number;
}

export interface TournamentRow {
  playerId: string;
  name: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

// ── Union Types ──

export type ClientMessage = 
  | JoinLobbyMessage 
  | SubmitBlueprintMessage 
  | StartEarlyMessage
  | DraftPickMessage;

export type ServerMessage =
  | LobbyStateMessage
  | BlueprintRevealMessage
  | WheelSpinStartMessage
  | WheelSpinResultMessage
  | SquadBoardMessage
  | PlayerClaimedMessage
  | DraftCompleteMessage
  | MatchScriptMessage
  | MatchResultMessage
  | TournamentMatchMessage
  | TournamentTableMessage
  | TournamentCompleteMessage
  | ErrorMessage;

// ── Formation Slot Definitions ──

export const FORMATION_SLOTS: Record<string, string[]> = {
  '4-4-2':   ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '4-3-3':   ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'],
  '3-5-2':   ['GK', 'CB', 'CB', 'CB', 'LWB', 'CM', 'CM', 'CM', 'RWB', 'ST', 'ST'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'CAM', 'LM', 'RM', 'ST'],
  '3-4-3':   ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
  '5-3-2':   ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CM', 'CM', 'ST', 'ST'],
  '4-5-1':   ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST'],
};

export function canPlayInSlot(playerPositions: string[], slot: string): boolean {
  const slotUpper = slot.toUpperCase();
  const posUpper = playerPositions.map(p => p.toUpperCase());
  
  if (slotUpper === 'GK') return posUpper.includes('GK');
  if (['CB'].includes(slotUpper)) return posUpper.some(p => ['CB'].includes(p));
  if (['LB', 'LWB'].includes(slotUpper)) return posUpper.some(p => ['LB', 'LWB'].includes(p));
  if (['RB', 'RWB'].includes(slotUpper)) return posUpper.some(p => ['RB', 'RWB'].includes(p));
  if (['CDM'].includes(slotUpper)) return posUpper.some(p => ['CDM', 'CM'].includes(p));
  if (['CM'].includes(slotUpper)) return posUpper.some(p => ['CM', 'CDM', 'CAM'].includes(p));
  if (['CAM'].includes(slotUpper)) return posUpper.some(p => ['CAM', 'CM', 'CF'].includes(p));
  if (['LM', 'RM'].includes(slotUpper)) return posUpper.some(p => ['LM', 'RM', 'LW', 'RW', 'CM'].includes(p));
  if (['LW', 'RW'].includes(slotUpper)) return posUpper.some(p => ['LW', 'RW', 'LM', 'RM', 'ST', 'CF'].includes(p));
  if (['ST'].includes(slotUpper)) return posUpper.some(p => ['ST', 'CF', 'LW', 'RW'].includes(p));
  
  return false;
}
