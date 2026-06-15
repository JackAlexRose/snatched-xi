// Snatched XI — Match Simulation Engine v3
// Attribute-based football match resolution with position-weighted shooting,
// formation matchup modifiers, defensive pressure, and position-fit penalties.
// v3.1 — Added play-by-play commentary generation.

import { PlayerSummary, PlayerRating } from './protocol';

interface FullPlayer extends PlayerSummary {
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physicality: number | null;
  overall: number;
  slot: string;
}

function fullAttr(attr: number | null | undefined, overall: number): number {
  return attr ?? overall;
}

function getBaseAttribute(player: FullPlayer, attr: 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physicality'): number {
  return fullAttr(player[attr], player.overall);
}

// ── Commentary Event Types ──

export type CommentaryEventType =
  | 'kickoff' | 'halftime' | 'fulltime'
  | 'possession' | 'pass' | 'dribble' | 'cross'
  | 'shot' | 'goal' | 'save' | 'block' | 'miss'
  | 'tackle' | 'foul';

export interface CommentaryEvent {
  minute: number;
  type: CommentaryEventType;
  player: string;
  team: 'home' | 'away';
  detail?: string;
  assist?: string;
}

export interface SimulationResult {
  score: { home: number; away: number };
  possession: number;
  shotsOnTarget: { home: number; away: number };
  totalShots: { home: number; away: number };
  topPerformers: PlayerRating[];
  events: MatchEvent[];
  matchScript: CommentaryEvent[];
}

interface MatchEvent {
  minute: number;
  type: 'goal' | 'shot' | 'save' | 'tackle' | 'foul';
  player: string;
  team: 'home' | 'away';
  detail?: string;
  assist?: string;
}

interface ShotRecord {
  shooter: FullPlayer;
  team: 'home' | 'away';
  outcome: 'goal' | 'save' | 'block' | 'miss';
  assister: FullPlayer | null;
  gk: FullPlayer;
  blocker: FullPlayer | null;  // defender who blocked
  minute: number;
}

// ═══════════════════════════════════════════
// Position weights for team strength
// ═══════════════════════════════════════════

const POSITION_WEIGHTS: Record<string, Record<string, number>> = {
  GK:  { defending: 1.0, physicality: 0.5, pace: 0.2, passing: 0.3 },
  CB:  { defending: 1.0, physicality: 0.9, pace: 0.5, passing: 0.4 },
  LB:  { pace: 0.9, defending: 0.8, passing: 0.6, physicality: 0.5, dribbling: 0.4 },
  RB:  { pace: 0.9, defending: 0.8, passing: 0.6, physicality: 0.5, dribbling: 0.4 },
  LWB: { pace: 0.9, dribbling: 0.7, passing: 0.7, defending: 0.6, physicality: 0.5 },
  RWB: { pace: 0.9, dribbling: 0.7, passing: 0.7, defending: 0.6, physicality: 0.5 },
  CDM: { defending: 0.9, passing: 0.8, physicality: 0.7, dribbling: 0.4 },
  CM:  { passing: 1.0, dribbling: 0.7, shooting: 0.5, physicality: 0.5, defending: 0.4 },
  CAM: { dribbling: 0.9, passing: 0.9, shooting: 0.7, pace: 0.5 },
  LM:  { pace: 0.8, dribbling: 0.8, passing: 0.8, shooting: 0.5 },
  RM:  { pace: 0.8, dribbling: 0.8, passing: 0.8, shooting: 0.5 },
  LW:  { pace: 0.9, dribbling: 0.9, shooting: 0.7, passing: 0.5 },
  RW:  { pace: 0.9, dribbling: 0.9, shooting: 0.7, passing: 0.5 },
  ST:  { shooting: 1.0, pace: 0.7, physicality: 0.6, dribbling: 0.6 },
  CF:  { shooting: 0.8, dribbling: 0.8, passing: 0.7, pace: 0.5 },
};

// ═══════════════════════════════════════════
// Positional chance weights (who shoots)
// ═══════════════════════════════════════════

const POSITION_CHANCE_WEIGHTS: Record<string, number> = {
  ST:  5.0,
  CF:  4.5,
  LW:  4.0,
  RW:  4.0,
  CAM: 3.0,
  CM:  2.0,
  LM:  1.5,
  RM:  1.5,
  CDM: 1.0,
  LWB: 0.5,
  RWB: 0.5,
  LB:  0.5,
  RB:  0.5,
  CB:  0.5,
  GK:  0.1,
};

// ═══════════════════════════════════════════
// Formation matchup modifiers
// ═══════════════════════════════════════════

interface FormationModifier {
  possessionBonus: number;
  attackBonus: number;
}

const FORMATION_MATCHUPS: Record<string, Record<string, FormationModifier>> = {
  '4-3-3': {
    '3-5-2':   { possessionBonus: 0.05, attackBonus: -0.03 },
    '5-3-2':   { possessionBonus: 0.08, attackBonus: -0.05 },
    '4-4-2':   { possessionBonus: 0.03, attackBonus:  0.02 },
    '4-2-3-1': { possessionBonus: 0.00, attackBonus:  0.00 },
    '3-4-3':   { possessionBonus: 0.02, attackBonus:  0.03 },
    '4-5-1':   { possessionBonus:-0.03, attackBonus: -0.02 },
  },
  '3-5-2': {
    '4-4-2':   { possessionBonus: 0.05, attackBonus:  0.02 },
    '4-3-3':   { possessionBonus:-0.05, attackBonus:  0.03 },
    '4-2-3-1': { possessionBonus: 0.02, attackBonus:  0.00 },
    '5-3-2':   { possessionBonus: 0.00, attackBonus: -0.03 },
    '3-4-3':   { possessionBonus: 0.02, attackBonus:  0.04 },
    '4-5-1':   { possessionBonus: 0.03, attackBonus: -0.02 },
  },
  '4-4-2': {
    '4-3-3':   { possessionBonus:-0.03, attackBonus: -0.02 },
    '3-5-2':   { possessionBonus:-0.05, attackBonus: -0.02 },
    '4-2-3-1': { possessionBonus:-0.02, attackBonus:  0.02 },
    '5-3-2':   { possessionBonus: 0.00, attackBonus: -0.04 },
    '3-4-3':   { possessionBonus:-0.02, attackBonus:  0.02 },
    '4-5-1':   { possessionBonus:-0.04, attackBonus:  0.03 },
  },
  '4-2-3-1': {
    '4-3-3':   { possessionBonus: 0.00, attackBonus:  0.00 },
    '3-5-2':   { possessionBonus:-0.02, attackBonus:  0.00 },
    '4-4-2':   { possessionBonus: 0.02, attackBonus: -0.02 },
    '5-3-2':   { possessionBonus: 0.03, attackBonus: -0.03 },
    '3-4-3':   { possessionBonus: 0.01, attackBonus:  0.01 },
    '4-5-1':   { possessionBonus:-0.02, attackBonus:  0.00 },
  },
  '3-4-3': {
    '4-3-3':   { possessionBonus:-0.02, attackBonus: -0.03 },
    '3-5-2':   { possessionBonus:-0.02, attackBonus: -0.04 },
    '4-4-2':   { possessionBonus: 0.02, attackBonus: -0.02 },
    '4-2-3-1': { possessionBonus:-0.01, attackBonus: -0.01 },
    '5-3-2':   { possessionBonus: 0.05, attackBonus: -0.05 },
    '4-5-1':   { possessionBonus: 0.02, attackBonus: -0.03 },
  },
  '5-3-2': {
    '4-3-3':   { possessionBonus:-0.08, attackBonus:  0.05 },
    '3-5-2':   { possessionBonus: 0.00, attackBonus:  0.03 },
    '4-4-2':   { possessionBonus: 0.00, attackBonus:  0.04 },
    '4-2-3-1': { possessionBonus:-0.03, attackBonus:  0.03 },
    '3-4-3':   { possessionBonus:-0.05, attackBonus:  0.05 },
    '4-5-1':   { possessionBonus:-0.02, attackBonus:  0.02 },
  },
  '4-5-1': {
    '4-3-3':   { possessionBonus: 0.03, attackBonus:  0.02 },
    '3-5-2':   { possessionBonus:-0.03, attackBonus:  0.02 },
    '4-4-2':   { possessionBonus: 0.04, attackBonus: -0.03 },
    '4-2-3-1': { possessionBonus: 0.02, attackBonus:  0.00 },
    '3-4-3':   { possessionBonus:-0.02, attackBonus:  0.03 },
    '5-3-2':   { possessionBonus: 0.02, attackBonus: -0.02 },
  },
};

const NEUTRAL_MOD: FormationModifier = { possessionBonus: 0, attackBonus: 0 };

function getFormationMod(homeFormation: string, awayFormation: string): FormationModifier {
  return FORMATION_MATCHUPS[homeFormation]?.[awayFormation] ?? NEUTRAL_MOD;
}

// ═══════════════════════════════════════════
// Out-of-position penalty
// ═══════════════════════════════════════════

function positionFitPenalty(player: FullPlayer): number {
  const naturalPositions = player.positions.map(p => p.trim().toUpperCase());
  if (naturalPositions.includes(player.slot.toUpperCase())) return 1.0;
  return 0.85;
}

// ═══════════════════════════════════════════
// Team strength
// ═══════════════════════════════════════════

function weightedTeamStrength(players: FullPlayer[]): number {
  let total = 0;
  let weightTotal = 0;
  
  for (const p of players) {
    const weights = POSITION_WEIGHTS[p.slot] || { overall: 1.0 };
    const posPenalty = positionFitPenalty(p);
    
    for (const [attr, weight] of Object.entries(weights)) {
      if (attr === 'overall') {
        total += p.overall * weight * posPenalty;
      } else {
        const val = getBaseAttribute(p, attr as any);
        total += val * weight * posPenalty;
      }
      weightTotal += weight;
    }
  }
  
  return weightTotal > 0 ? total / weightTotal : 50;
}

// ═══════════════════════════════════════════
// Weighted random player selection helpers
// ═══════════════════════════════════════════

function pickShooter(team: FullPlayer[]): FullPlayer {
  const weights = team.map(p => POSITION_CHANCE_WEIGHTS[p.slot] ?? 1.0);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  
  let r = Math.random() * totalWeight;
  for (let i = 0; i < team.length; i++) {
    r -= weights[i];
    if (r <= 0) return team[i];
  }
  return team[team.length - 1];
}

function pickPasser(team: FullPlayer[], exclude: Set<string>): FullPlayer {
  // Weighted toward midfielders for build-up play
  const candidates = team.filter(p => !exclude.has(p.id) && p.slot !== 'GK');
  if (candidates.length === 0) return team.filter(p => p.slot !== 'GK')[0];
  
  const mfWeights: Record<string, number> = {
    CM: 4, CAM: 3, CDM: 3, LM: 2, RM: 2, LWB: 2, RWB: 2, LB: 2, RB: 2, CB: 1, LW: 1, RW: 1, ST: 0.5, CF: 0.5,
  };
  
  const weights = candidates.map(p => mfWeights[p.slot] ?? 1);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) { r -= weights[i]; if (r <= 0) return candidates[i]; }
  return candidates[candidates.length - 1];
}

function pickDefender(team: FullPlayer[]): FullPlayer {
  const defenders = team.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(p.slot));
  if (defenders.length === 0) return team.filter(p => p.slot !== 'GK')[0];
  return defenders[Math.floor(Math.random() * defenders.length)];
}

// ═══════════════════════════════════════════
// Defensive pressure
// ═══════════════════════════════════════════

const PRESSURE_POSITIONS = new Set(['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM']);

function getDefensivePressure(defendingTeam: FullPlayer[]): number {
  const defenders = defendingTeam.filter(p => PRESSURE_POSITIONS.has(p.slot));
  if (defenders.length === 0) return 0.15;
  const avgDefending = defenders.reduce((s, p) => s + getBaseAttribute(p, 'defending'), 0) / defenders.length;
  return (avgDefending / 100) * 0.35;
}

// ═══════════════════════════════════════════
// Assister selection
// ═══════════════════════════════════════════

function pickAssister(team: FullPlayer[], scorer: FullPlayer): FullPlayer | null {
  const candidates = team.filter(p => p.slot !== 'GK' && p.id !== scorer.id);
  if (candidates.length === 0) return null;
  const weights = candidates.map(p => Math.max(getBaseAttribute(p, 'passing'), 1));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) { r -= weights[i]; if (r <= 0) return candidates[i]; }
  return candidates[candidates.length - 1];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ═══════════════════════════════════════════
// Commentary generation
// ═══════════════════════════════════════════
// Weaves shot records into a full 90-minute narrative.

function generateCommentary(shots: ShotRecord[], homeTeam: FullPlayer[], awayTeam: FullPlayer[]): CommentaryEvent[] {
  const script: CommentaryEvent[] = [];
  
  // Kickoff
  script.push({ minute: 0, type: 'kickoff', player: '', team: 'home' });
  
  // Add filler events + shot sequences spread across 90 mins
  const totalShots = shots.length;
  const fillerCount = 8 + Math.floor(Math.random() * 6);  // 8-13 filler events
  
  // Build a timeline: interleave shots with fillers
  interface TimelineItem {
    minute: number;
    kind: 'shot' | 'filler';
    shot?: ShotRecord;
  }
  
  const timeline: TimelineItem[] = [];
  
  // Place shots roughly evenly through the match
  const shotIntervals = 90 / (totalShots + 1);
  for (let i = 0; i < totalShots; i++) {
    const baseMin = Math.round(shotIntervals * (i + 1));
    const jitter = Math.floor(Math.random() * 7) - 3; // ±3 minutes jitter
    timeline.push({ minute: clamp(baseMin + jitter, 1, 90), kind: 'shot', shot: shots[i] });
  }
  
  // Place filler events in gaps
  const fillerIntervals = 90 / (fillerCount + 1);
  for (let i = 0; i < fillerCount; i++) {
    const baseMin = Math.round(fillerIntervals * (i + 1));
    const jitter = Math.floor(Math.random() * 5) - 2;
    timeline.push({ minute: clamp(baseMin + jitter, 1, 90), kind: 'filler' });
  }
  
  // Sort by minute
  timeline.sort((a, b) => a.minute - b.minute);
  
  // Add halftime marker at ~45'
  const halftimeIdx = timeline.findIndex(t => t.minute >= 45);
  
  // Generate events from timeline
  let shotIdx = 0;
  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    
    // Halftime break
    if (i === halftimeIdx && halftimeIdx > 0) {
      script.push({ minute: 45, type: 'halftime', player: '', team: 'home' });
    }
    
    if (item.kind === 'shot' && item.shot) {
      const s = item.shot;
      const attacker = s.team === 'home' ? homeTeam : awayTeam;
      const defender = s.team === 'home' ? awayTeam : homeTeam;
      
      // Build-up: 1-2 passes
      const buildup = Math.random();
      if (buildup > 0.3) {
        // 1-2 pass sequence
        const passer1 = pickPasser(attacker, new Set([s.shooter.id]));
        script.push({
          minute: item.minute,
          type: 'pass',
          player: passer1.name,
          team: s.team,
          detail: `finds ${s.shooter.name}`,
        });
      }
      if (buildup > 0.6) {
        const passer2 = pickPasser(attacker, new Set([s.shooter.id]));
        script.push({
          minute: item.minute,
          type: 'dribble',
          player: s.shooter.name,
          team: s.team,
          detail: 'drives forward',
        });
      }
      
      // Shot
      script.push({
        minute: item.minute,
        type: 'shot',
        player: s.shooter.name,
        team: s.team,
      });
      
      // Resolution
      switch (s.outcome) {
        case 'goal':
          script.push({
            minute: item.minute,
            type: 'goal',
            player: s.shooter.name,
            team: s.team,
            detail: `GOAL! ${s.shooter.name} scores!`,
            assist: s.assister?.name,
          });
          break;
        case 'save':
          script.push({
            minute: item.minute,
            type: 'save',
            player: s.gk.name,
            team: s.team === 'home' ? 'away' : 'home',
            detail: `${s.gk.name} with a great save!`,
          });
          break;
        case 'block':
          script.push({
            minute: item.minute,
            type: 'block',
            player: s.blocker?.name || 'Defender',
            team: s.team === 'home' ? 'away' : 'home',
            detail: 'blocks the shot!',
          });
          break;
        case 'miss':
          script.push({
            minute: item.minute,
            type: 'miss',
            player: s.shooter.name,
            team: s.team,
            detail: Math.random() > 0.5 ? 'shoots wide!' : 'fires over the bar!',
          });
          break;
      }
      
      // If goal, add a brief celebration moment
      if (s.outcome === 'goal') {
        // Small chance of a mini restart event
        if (Math.random() > 0.6) {
          script.push({
            minute: Math.min(item.minute + 1, 90),
            type: 'possession',
            player: '',
            team: s.team === 'home' ? 'away' : 'home',
            detail: 'restart play from the centre',
          });
        }
      }
      
      shotIdx++;
    } else {
      // Filler event
      const fillerTeam: 'home' | 'away' = Math.random() > 0.5 ? 'home' : 'away';
      const team = fillerTeam === 'home' ? homeTeam : awayTeam;
      const oppTeam = fillerTeam === 'home' ? awayTeam : homeTeam;
      const r = Math.random();
      
      if (r < 0.35) {
        // Possession
        const player = pickPasser(team, new Set());
        script.push({
          minute: item.minute,
          type: 'possession',
          player: player.name,
          team: fillerTeam,
          detail: 'builds from the back',
        });
      } else if (r < 0.6) {
        // Pass sequence
        const p1 = pickPasser(team, new Set());
        const exclude = new Set([p1.id]);
        const p2 = pickPasser(team, exclude);
        script.push({
          minute: item.minute,
          type: 'pass',
          player: p1.name,
          team: fillerTeam,
          detail: `plays it to ${p2.name}`,
        });
      } else if (r < 0.8) {
        // Tackle
        const tackler = pickDefender(oppTeam);
        const victim = pickPasser(team, new Set());
        script.push({
          minute: item.minute,
          type: 'tackle',
          player: tackler.name,
          team: fillerTeam === 'home' ? 'away' : 'home',
          detail: `wins the ball from ${victim.name}`,
        });
      } else {
        // Dribble
        const dribbler = team.find(p => ['ST', 'CF', 'LW', 'RW', 'CAM'].includes(p.slot)) || pickPasser(team, new Set());
        script.push({
          minute: item.minute,
          type: 'dribble',
          player: dribbler.name,
          team: fillerTeam,
          detail: 'carries it forward',
        });
      }
    }
  }
  
  // Full-time
  script.push({ minute: 90, type: 'fulltime', player: '', team: 'home' });
  
  return script;
}

// ═══════════════════════════════════════════
// Main simulation
// ═══════════════════════════════════════════

export function simulateMatch(
  homeTeam: FullPlayer[],
  awayTeam: FullPlayer[],
  homeFormation: string,
  awayFormation: string
): SimulationResult {
  const homeStrength = weightedTeamStrength(homeTeam);
  const awayStrength = weightedTeamStrength(awayTeam);
  
  const mod = getFormationMod(homeFormation, awayFormation);
  
  // ── Possession ──
  const homePassAvg = homeTeam.reduce((s, p) => s + getBaseAttribute(p, 'passing'), 0) / 11;
  const awayPassAvg = awayTeam.reduce((s, p) => s + getBaseAttribute(p, 'passing'), 0) / 11;
  const homeDribAvg = homeTeam.reduce((s, p) => s + getBaseAttribute(p, 'dribbling'), 0) / 11;
  const awayDribAvg = awayTeam.reduce((s, p) => s + getBaseAttribute(p, 'dribbling'), 0) / 11;
  
  const homePossRaw = (homePassAvg * 0.7 + homeDribAvg * 0.3);
  const awayPossRaw = (awayPassAvg * 0.7 + awayDribAvg * 0.3);
  const basePossession = (homePossRaw / (homePossRaw + awayPossRaw)) * 100;
  const homePossession = clamp(Math.round(basePossession + mod.possessionBonus * 100), 25, 75);
  
  // ── Expected Goals v3 ──
  const strengthDiff = homeStrength - awayStrength;
  const baseXg = 1.2;
  
  const homeXg = clamp(baseXg * (1 + strengthDiff / 60) * (1 + mod.attackBonus), 0.3, 4.0);
  const awayXg = clamp(baseXg * (1 - strengthDiff / 60) * (1 - mod.attackBonus), 0.3, 4.0);
  
  const homeXgRandom = homeXg * (0.88 + Math.random() * 0.24);
  const awayXgRandom = awayXg * (0.88 + Math.random() * 0.24);
  
  // ── Shot Resolution (with detailed tracking) ──
  let homeGoals = 0;
  let awayGoals = 0;
  
  const homeScorers: FullPlayer[] = [];
  const awayScorers: FullPlayer[] = [];
  const homeAssisters: FullPlayer[] = [];
  const awayAssisters: FullPlayer[] = [];
  
  // Track all shots for commentary
  const allShots: ShotRecord[] = [];
  
  const homeChances = Math.round(homeXgRandom * 3 + Math.random() * 4);
  const awayChances = Math.round(awayXgRandom * 3 + Math.random() * 4);
  
  const homeDefPressure = getDefensivePressure(homeTeam);
  const awayDefPressure = getDefensivePressure(awayTeam);
  
  // Shot minute tracking (spread across the match)
  let homeShotMinutes = distributeMinutes(homeChances);
  let awayShotMinutes = distributeMinutes(awayChances);
  
  const awayGk = awayTeam.find(p => p.slot === 'GK')!;
  const homeGk = homeTeam.find(p => p.slot === 'GK')!;
  
  // Home team shoots
  for (let i = 0; i < homeChances; i++) {
    const shooter = pickShooter(homeTeam);
    const shotQuality = getBaseAttribute(shooter, 'shooting') / 100;
    const saveQuality = fullAttr(awayGk.overall, awayGk.overall) / 100;
    const assister = pickAssister(homeTeam, shooter);
    const blocker = pickDefender(awayTeam);
    
    const roll = Math.random();
    const goalThreshold = shotQuality * 0.7 - saveQuality * 0.35 - awayDefPressure + 0.15;
    const saveThreshold = goalThreshold + 0.15;
    const blockThreshold = saveThreshold + 0.12;
    
    let outcome: ShotRecord['outcome'];
    if (roll < goalThreshold) {
      outcome = 'goal';
      homeGoals++;
      homeScorers.push(shooter);
      if (assister) homeAssisters.push(assister);
    } else if (roll < saveThreshold) {
      outcome = 'save';
    } else if (roll < blockThreshold) {
      outcome = 'block';
    } else {
      outcome = 'miss';
    }
    
    allShots.push({
      shooter, team: 'home', outcome, assister,
      gk: awayGk, blocker: outcome === 'block' ? blocker : null,
      minute: homeShotMinutes[i],
    });
  }
  
  // Away team shoots
  for (let i = 0; i < awayChances; i++) {
    const shooter = pickShooter(awayTeam);
    const shotQuality = getBaseAttribute(shooter, 'shooting') / 100;
    const saveQuality = fullAttr(homeGk.overall, homeGk.overall) / 100;
    const assister = pickAssister(awayTeam, shooter);
    const blocker = pickDefender(homeTeam);
    
    const roll = Math.random();
    const goalThreshold = shotQuality * 0.7 - saveQuality * 0.35 - homeDefPressure + 0.15;
    const saveThreshold = goalThreshold + 0.15;
    const blockThreshold = saveThreshold + 0.12;
    
    let outcome: ShotRecord['outcome'];
    if (roll < goalThreshold) {
      outcome = 'goal';
      awayGoals++;
      awayScorers.push(shooter);
      if (assister) awayAssisters.push(assister);
    } else if (roll < saveThreshold) {
      outcome = 'save';
    } else if (roll < blockThreshold) {
      outcome = 'block';
    } else {
      outcome = 'miss';
    }
    
    allShots.push({
      shooter, team: 'away', outcome, assister,
      gk: homeGk, blocker: outcome === 'block' ? blocker : null,
      minute: awayShotMinutes[i],
    });
  }
  
  // Sort shots by minute
  allShots.sort((a, b) => a.minute - b.minute);
  
  // ── Generate commentary ──
  const matchScript = generateCommentary(allShots, homeTeam, awayTeam);
  
  // ── Stats ──
  const shotsOnTarget = {
    home: Math.max(homeGoals, Math.floor(homeChances * 0.4 + Math.random() * 3)),
    away: Math.max(awayGoals, Math.floor(awayChances * 0.4 + Math.random() * 3)),
  };
  
  const totalShots = {
    home: shotsOnTarget.home + Math.floor(Math.random() * 4),
    away: shotsOnTarget.away + Math.floor(Math.random() * 4),
  };
  
  // ── Player Ratings ──
  const topPerformers: PlayerRating[] = [];
  const allPlayers = [
    ...homeTeam.map(p => ({ ...p, team: 'home' as const, goalsConceded: awayGoals })),
    ...awayTeam.map(p => ({ ...p, team: 'away' as const, goalsConceded: homeGoals })),
  ];
  
  const goalCount = new Map<string, number>();
  const assistCount = new Map<string, number>();
  for (const s of homeScorers) goalCount.set(s.id, (goalCount.get(s.id) || 0) + 1);
  for (const s of awayScorers) goalCount.set(s.id, (goalCount.get(s.id) || 0) + 1);
  for (const a of homeAssisters) assistCount.set(a.id, (assistCount.get(a.id) || 0) + 1);
  for (const a of awayAssisters) assistCount.set(a.id, (assistCount.get(a.id) || 0) + 1);
  
  const homePossPct = homePossession;
  const awayPossPct = 100 - homePossession;
  
  for (const p of allPlayers) {
    const goals = goalCount.get(p.id) || 0;
    const assists = assistCount.get(p.id) || 0;
    const teamPoss = p.team === 'home' ? homePossPct : awayPossPct;
    const conceded = (p as any).goalsConceded as number;
    const slot = p.slot;
    
    let rating = 6.0 + (p.overall - 70) / 20 + (Math.random() - 0.5) * 1.5;
    rating += goals * 1.0;
    rating += assists * 0.5;
    
    if (slot === 'GK') {
      rating -= conceded * 0.4;
      if (conceded === 0) rating += 1.5;
      const passAttr = getBaseAttribute(p, 'passing');
      if (passAttr > 70) rating += 0.3;
    } else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(slot)) {
      rating -= conceded * 0.35;
      if (conceded === 0) rating += 0.8;
      const passAttr = getBaseAttribute(p, 'passing');
      if (passAttr > 75) rating += 0.2;
      if (teamPoss > 55) rating += 0.2;
      if (teamPoss < 40) rating -= 0.2;
    } else if (['CDM'].includes(slot)) {
      rating -= conceded * 0.2;
      if (conceded === 0) rating += 0.5;
      if (teamPoss > 55) rating += 0.3;
      if (teamPoss < 40) rating -= 0.3;
    } else if (['CM', 'LM', 'RM'].includes(slot)) {
      if (teamPoss > 55) rating += 0.3;
      if (teamPoss < 40) rating -= 0.2;
      const passAttr = getBaseAttribute(p, 'passing');
      if (passAttr > 80) rating += 0.2;
    } else if (['CAM'].includes(slot)) {
      if (teamPoss > 55) rating += 0.3;
      if (goals === 0 && assists === 0) rating -= 0.3;
    } else {
      if (goals === 0 && assists === 0) rating -= 0.4;
      if (goals >= 2) rating += 0.5;
      if (goals >= 3) rating += 0.5;
    }
    
    rating = clamp(Math.round(rating * 10) / 10, 3.0, 10.0);
    
    topPerformers.push({
      playerId: p.id,
      playerName: p.name,
      positions: p.positions,
      rating,
      goals: goals || undefined,
      assists: assists || undefined,
    });
  }
  
  topPerformers.sort((a, b) => b.rating - a.rating);
  
  // ── Match Events (goals only, for legacy display) ──
  const events: MatchEvent[] = [];
  let eventMinute = 0;
  for (let i = 0; i < homeGoals; i++) {
    eventMinute += Math.floor(Math.random() * 15) + 5;
    if (eventMinute > 90) eventMinute = 85 + Math.floor(Math.random() * 5);
    const scorer = homeScorers[i] || pickShooter(homeTeam.filter(p => p.slot !== 'GK'));
    const assister = homeAssisters[i] || null;
    events.push({ minute: Math.min(eventMinute, 90), type: 'goal', player: scorer.name, team: 'home', assist: assister?.name });
  }
  eventMinute = 0;
  for (let i = 0; i < awayGoals; i++) {
    eventMinute += Math.floor(Math.random() * 15) + 5;
    if (eventMinute > 90) eventMinute = 85 + Math.floor(Math.random() * 5);
    const scorer = awayScorers[i] || pickShooter(awayTeam.filter(p => p.slot !== 'GK'));
    const assister = awayAssisters[i] || null;
    events.push({ minute: Math.min(eventMinute, 90), type: 'goal', player: scorer.name, team: 'away', assist: assister?.name });
  }
  events.sort((a, b) => a.minute - b.minute);
  
  return {
    score: { home: homeGoals, away: awayGoals },
    possession: homePossession,
    shotsOnTarget,
    totalShots,
    topPerformers: topPerformers.slice(0, 6),
    events,
    matchScript,
  };
}

// ── Helper: distribute N events roughly evenly across 90 minutes ──
function distributeMinutes(count: number): number[] {
  if (count === 0) return [];
  const minutes: number[] = [];
  const interval = 90 / (count + 1);
  for (let i = 0; i < count; i++) {
    const base = Math.round(interval * (i + 1));
    const jitter = Math.floor(Math.random() * 8) - 4; // ±4 min
    minutes.push(clamp(base + jitter, 1, 90));
  }
  minutes.sort((a, b) => a - b);
  return minutes;
}
