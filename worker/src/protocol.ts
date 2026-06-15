// Snatched XI — WebSocket Protocol
// All messages between client and server

// ── Client → Server ──

export interface JoinLobbyMessage {
  type: 'join_lobby';
  playerName: string;
}

export interface SubmitBlueprintMessage {
  type: 'submit_blueprint';
  formation: string;
  teamName?: string;
}

export interface DraftPickMessage {
  type: 'draft_pick';
  playerId: string;   // The selected player's DB id
  slot?: string;       // Which formation slot to place them in (client-side choice)
  slotIndex?: number;  // Exact index in the formationSlots array (for duplicate slots)
}

// ── Server → Client ──

export interface LobbyStateMessage {
  type: 'lobby_state';
  phase: string;
  yourFormation?: string;
  opponentFormation?: string;
  currentRound?: number;
  yourTeam?: PlayerSummary[];
  opponentTeam?: PlayerSummary[];
  matchResult?: MatchResultMessage;
}

export interface BlueprintRevealMessage {
  type: 'blueprint_reveal';
  yourFormation: string;
  opponentFormation: string;
  opponentTeamName?: string;
}

export interface WheelSpinMessage {
  type: 'wheel_spin';
  club: string;
  season: string;
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
  playerId: string;        // "p1" or "p2" — who made the claim
  playerName: string;      // Display name of the claiming player
  claimedPlayer: PlayerSummary;
  slotIndex?: number;       // Exact array index for duplicate slots
  round: number;
}

export interface TimerTickMessage {
  type: 'timer_tick';
  secondsRemaining: number;
}

export interface DraftCompleteMessage {
  type: 'draft_complete';
  yourTeam: PlayerSummary[];
  opponentTeam: PlayerSummary[];
}

export interface CommentaryEvent {
  minute: number;
  type: string;  // 'kickoff' | 'pass' | 'dribble' | 'shot' | 'goal' | 'save' | 'block' | 'miss' | 'tackle' | 'possession' | 'halftime' | 'fulltime'
  player: string;
  team: 'home' | 'away';
  detail?: string;
  assist?: string;
}

export interface MatchScriptMessage {
  type: 'match_script';
  events: CommentaryEvent[];
  matchNumber?: number;
  totalMatches?: number;
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
  matchNumber?: number;
  totalMatches?: number;
}

export interface SeriesResultMessage {
  type: 'series_result';
  seriesScore: { p1: number; p2: number };
  winner: string;
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
  positions: string[];   // ["CM", "CDM"]
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
  slot?: string;  // Where they're placed in formation
}

export interface PlayerRating {
  playerId: string;
  playerName: string;
  positions?: string[];
  rating: number;   // 0-10 match rating
  goals?: number;
  assists?: number;
}

// ── Union Types ──

export type ClientMessage = 
  | JoinLobbyMessage 
  | SubmitBlueprintMessage 
  | DraftPickMessage;

export type ServerMessage =
  | LobbyStateMessage
  | BlueprintRevealMessage
  | WheelSpinMessage
  | WheelSpinStartMessage
  | WheelSpinResultMessage
  | SquadBoardMessage
  | PlayerClaimedMessage
  | TimerTickMessage
  | DraftCompleteMessage
  | MatchScriptMessage
  | MatchResultMessage
  | SeriesResultMessage
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

// Map FIFA positions to formation slots
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
