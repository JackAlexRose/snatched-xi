// Snatched XI — Match Simulation Engine v2
// Attribute-based football match resolution with position-weighted shooting
// and formation matchup modifiers.

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

export interface SimulationResult {
  score: { home: number; away: number };
  possession: number;
  shotsOnTarget: { home: number; away: number };
  totalShots: { home: number; away: number };
  topPerformers: PlayerRating[];
  events: MatchEvent[];
}

interface MatchEvent {
  minute: number;
  type: 'goal' | 'shot' | 'save' | 'tackle' | 'foul';
  player: string;
  team: 'home' | 'away';
  detail?: string;
  assist?: string;
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
// Key: homeFormation -> awayFormation -> { possessionBonus, attackBonus }
// possessionBonus: shifts possession % (applied to home team)
// attackBonus: multiplies xG (applied to home team)

interface FormationModifier {
  possessionBonus: number;  // -0.10 to +0.10
  attackBonus: number;      // -0.10 to +0.10
}

const FORMATION_MATCHUPS: Record<string, Record<string, FormationModifier>> = {
  '4-3-3': {
    '3-5-2':   { possessionBonus: 0.05, attackBonus: -0.03 },  // extra mid but lone ST vs 3 CBs
    '5-3-2':   { possessionBonus: 0.08, attackBonus: -0.05 },  // dominates mid, struggles to break down
    '4-4-2':   { possessionBonus: 0.03, attackBonus:  0.02 },  // extra man in midfield
    '4-2-3-1': { possessionBonus: 0.00, attackBonus:  0.00 },  // mirror match essentially
    '3-4-3':   { possessionBonus: 0.02, attackBonus:  0.03 },  // both attacking, wide spaces
    '4-5-1':   { possessionBonus:-0.03, attackBonus: -0.02 },  // 4-5-1 packs midfield
  },
  '3-5-2': {
    '4-4-2':   { possessionBonus: 0.05, attackBonus:  0.02 },  // wing-backs overload wide areas
    '4-3-3':   { possessionBonus:-0.05, attackBonus:  0.03 },  // vulnerability out wide
    '4-2-3-1': { possessionBonus: 0.02, attackBonus:  0.00 },
    '5-3-2':   { possessionBonus: 0.00, attackBonus: -0.03 },  // two defensive shapes
    '3-4-3':   { possessionBonus: 0.02, attackBonus:  0.04 },  // both wing-back systems
    '4-5-1':   { possessionBonus: 0.03, attackBonus: -0.02 },
  },
  '4-4-2': {
    '4-3-3':   { possessionBonus:-0.03, attackBonus: -0.02 },
    '3-5-2':   { possessionBonus:-0.05, attackBonus: -0.02 },
    '4-2-3-1': { possessionBonus:-0.02, attackBonus:  0.02 },  // two-striker threat vs single pivot
    '5-3-2':   { possessionBonus: 0.00, attackBonus: -0.04 },
    '3-4-3':   { possessionBonus:-0.02, attackBonus:  0.02 },
    '4-5-1':   { possessionBonus:-0.04, attackBonus:  0.03 },  // direct 2 up top vs packed mid
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
    '5-3-2':   { possessionBonus: 0.05, attackBonus: -0.05 },  // 3 forwards stretching 5 at back
    '4-5-1':   { possessionBonus: 0.02, attackBonus: -0.03 },
  },
  '5-3-2': {
    '4-3-3':   { possessionBonus:-0.08, attackBonus:  0.05 },  // defensive shape, counter threat
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

// Default neutral modifier for formations not explicitly defined
const NEUTRAL_MOD: FormationModifier = { possessionBonus: 0, attackBonus: 0 };

function getFormationMod(homeFormation: string, awayFormation: string): FormationModifier {
  return FORMATION_MATCHUPS[homeFormation]?.[awayFormation] ?? NEUTRAL_MOD;
}

// ═══════════════════════════════════════════
// Team strength
// ═══════════════════════════════════════════

function weightedTeamStrength(players: FullPlayer[]): number {
  let total = 0;
  let weightTotal = 0;
  
  for (const p of players) {
    const weights = POSITION_WEIGHTS[p.slot] || { overall: 1.0 };
    for (const [attr, weight] of Object.entries(weights)) {
      if (attr === 'overall') {
        total += p.overall * weight;
      } else {
        const val = getBaseAttribute(p, attr as any);
        total += val * weight;
      }
      weightTotal += weight;
    }
  }
  
  return weightTotal > 0 ? total / weightTotal : 50;
}

// ═══════════════════════════════════════════
// Weighted random shooter selection
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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ═══════════════════════════════════════════
// Weighted random assister selection
// ═══════════════════════════════════════════

function pickAssister(team: FullPlayer[], scorer: FullPlayer): FullPlayer | null {
  // Filter: no GK, no goalscorer
  const candidates = team.filter(
    p => p.slot !== 'GK' && p.id !== scorer.id
  );
  if (candidates.length === 0) return null;
  
  // Weight by Passing attribute
  const weights = candidates.map(p => {
    const passing = getBaseAttribute(p, 'passing');
    return Math.max(passing, 1);  // Minimum weight of 1
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  
  let r = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
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
  
  // Formation matchup modifiers
  const mod = getFormationMod(homeFormation, awayFormation);
  
  // ── Possession ──
  // Base: passing + dribbling. Modified by formation matchup.
  const homePassAvg = homeTeam.reduce((s, p) => s + getBaseAttribute(p, 'passing'), 0) / 11;
  const awayPassAvg = awayTeam.reduce((s, p) => s + getBaseAttribute(p, 'passing'), 0) / 11;
  const homeDribAvg = homeTeam.reduce((s, p) => s + getBaseAttribute(p, 'dribbling'), 0) / 11;
  const awayDribAvg = awayTeam.reduce((s, p) => s + getBaseAttribute(p, 'dribbling'), 0) / 11;
  
  const homePossRaw = (homePassAvg * 0.7 + homeDribAvg * 0.3);
  const awayPossRaw = (awayPassAvg * 0.7 + awayDribAvg * 0.3);
  const basePossession = (homePossRaw / (homePossRaw + awayPossRaw)) * 100;
  const homePossession = clamp(
    Math.round(basePossession + mod.possessionBonus * 100),
    25, 75
  );
  
  // ── Expected Goals ──
  // Based on team strength difference. No home advantage.
  const strengthDiff = homeStrength - awayStrength;
  const baseXg = 1.2;
  
  // Apply formation attack bonus to xG
  const homeXg = clamp(
    baseXg * (1 + strengthDiff / 200) * (1 + mod.attackBonus),
    0.3, 4.0
  );
  const awayXg = clamp(
    baseXg * (1 - strengthDiff / 200) * (1 - mod.attackBonus),
    0.3, 4.0
  );
  
  // Randomness (±30%)
  const homeXgRandom = homeXg * (0.7 + Math.random() * 0.6);
  const awayXgRandom = awayXg * (0.7 + Math.random() * 0.6);
  
  // ── Shot Resolution ──
  let homeGoals = 0;
  let awayGoals = 0;
  
  // Track who scored / assisted for ratings
  const homeScorers: FullPlayer[] = [];
  const awayScorers: FullPlayer[] = [];
  const homeAssisters: FullPlayer[] = [];
  const awayAssisters: FullPlayer[] = [];
  
  const homeChances = Math.round(homeXgRandom * 3 + Math.random() * 4);
  const awayChances = Math.round(awayXgRandom * 3 + Math.random() * 4);
  
  // Home team shoots
  const awayGk = awayTeam.find(p => p.slot === 'GK')!;
  for (let i = 0; i < homeChances; i++) {
    const shooter = pickShooter(homeTeam);
    const shotQuality = getBaseAttribute(shooter, 'shooting') / 100;
    const saveQuality = fullAttr(awayGk.overall, awayGk.overall) / 100;
    
    if (Math.random() < shotQuality * 0.7 - saveQuality * 0.3 + 0.2) {
      homeGoals++;
      homeScorers.push(shooter);
      
      // Pick assister (weighted by Passing, excludes GK + scorer)
      const assister = pickAssister(homeTeam, shooter);
      if (assister) {
        homeAssisters.push(assister);
      }
    }
  }
  
  // Away team shoots
  const homeGk = homeTeam.find(p => p.slot === 'GK')!;
  for (let i = 0; i < awayChances; i++) {
    const shooter = pickShooter(awayTeam);
    const shotQuality = getBaseAttribute(shooter, 'shooting') / 100;
    const saveQuality = fullAttr(homeGk.overall, homeGk.overall) / 100;
    
    if (Math.random() < shotQuality * 0.7 - saveQuality * 0.3 + 0.2) {
      awayGoals++;
      awayScorers.push(shooter);
      
      const assister = pickAssister(awayTeam, shooter);
      if (assister) {
        awayAssisters.push(assister);
      }
    }
  }
  
  // ── Stats ──
  const shotsOnTarget = {
    home: Math.max(homeGoals, Math.floor(homeChances * 0.4 + Math.random() * 3)),
    away: Math.max(awayGoals, Math.floor(awayChances * 0.4 + Math.random() * 3)),
  };
  
  const totalShots = {
    home: shotsOnTarget.home + Math.floor(Math.random() * 4),
    away: shotsOnTarget.away + Math.floor(Math.random() * 4),
  };
  
  // ── Player Ratings (Dynamic — based on match performance) ──
  const topPerformers: PlayerRating[] = [];
  const allPlayers = [
    ...homeTeam.map(p => ({ ...p, team: 'home' as const, goalsConceded: awayGoals })),
    ...awayTeam.map(p => ({ ...p, team: 'away' as const, goalsConceded: homeGoals })),
  ];
  
  // Count goals + assists per player
  const goalCount = new Map<string, number>();
  const assistCount = new Map<string, number>();
  for (const s of homeScorers) goalCount.set(s.id, (goalCount.get(s.id) || 0) + 1);
  for (const s of awayScorers) goalCount.set(s.id, (goalCount.get(s.id) || 0) + 1);
  for (const a of homeAssisters) assistCount.set(a.id, (assistCount.get(a.id) || 0) + 1);
  for (const a of awayAssisters) assistCount.set(a.id, (assistCount.get(a.id) || 0) + 1);
  
  // Team-level metrics
  const homePossPct = homePossession;
  const awayPossPct = 100 - homePossession;
  
  for (const p of allPlayers) {
    const goals = goalCount.get(p.id) || 0;
    const assists = assistCount.get(p.id) || 0;
    const teamPoss = p.team === 'home' ? homePossPct : awayPossPct;
    const conceded = (p as any).goalsConceded as number;
    const slot = p.slot;
    
    // Base: OVR-weighted starting point
    let rating = 6.0 + (p.overall - 70) / 20 + (Math.random() - 0.5) * 1.5;
    
    // ── Attacking contribution (all positions) ──
    rating += goals * 1.0;          // +1.0 per goal
    rating += assists * 0.5;        // +0.5 per assist
    
    // ── Position-specific modifiers ──
    if (slot === 'GK') {
      // Goalkeeper: heavily penalised for conceding, rewarded for clean sheets
      rating -= conceded * 0.4;
      if (conceded === 0) rating += 1.5;  // Clean sheet bonus
      // Good distribution boosts rating slightly
      const passAttr = getBaseAttribute(p, 'passing');
      if (passAttr > 70) rating += 0.3;
    } else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(slot)) {
      // Defenders: penalised for goals conceded, rewarded for clean sheets
      rating -= conceded * 0.35;
      if (conceded === 0) rating += 0.8;
      // Good passing from the back
      const passAttr = getBaseAttribute(p, 'passing');
      if (passAttr > 75) rating += 0.2;
      // If team had good possession, defenders weren't under siege
      if (teamPoss > 55) rating += 0.2;
      if (teamPoss < 40) rating -= 0.2;
    } else if (['CDM'].includes(slot)) {
      // Defensive mids: slightly penalised for conceding
      rating -= conceded * 0.2;
      if (conceded === 0) rating += 0.5;
      // Possession matters for CDMs
      if (teamPoss > 55) rating += 0.3;
      if (teamPoss < 40) rating -= 0.3;
    } else if (['CM', 'LM', 'RM'].includes(slot)) {
      // Central/wide mids: driven by possession and creative output
      if (teamPoss > 55) rating += 0.3;
      if (teamPoss < 40) rating -= 0.2;
      // Passing quality bonus
      const passAttr = getBaseAttribute(p, 'passing');
      if (passAttr > 80) rating += 0.2;
    } else if (['CAM'].includes(slot)) {
      // Attacking mids: goals + assists matter most, possession helps
      if (teamPoss > 55) rating += 0.3;
      if (goals === 0 && assists === 0) rating -= 0.3;  // Ghost game penalty
    } else {
      // Forwards (ST, CF, LW, RW): goals are everything
      if (goals === 0 && assists === 0) rating -= 0.4;  // Ghost game penalty
      // Multiple goals = star performance
      if (goals >= 2) rating += 0.5;
      // Hattrick bonus
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
  
  // ── Match Events ──
  const events: MatchEvent[] = [];
  let eventMinute = 0;
  
  for (let i = 0; i < homeGoals; i++) {
    eventMinute += Math.floor(Math.random() * 15) + 5;
    if (eventMinute > 90) eventMinute = 85 + Math.floor(Math.random() * 5);
    const scorer = homeScorers[i] || pickShooter(homeTeam.filter(p => p.slot !== 'GK'));
    const assister = homeAssisters[i] || null;
    events.push({
      minute: Math.min(eventMinute, 90),
      type: 'goal',
      player: scorer.name,
      team: 'home',
      assist: assister?.name,
    });
  }
  
  eventMinute = 0;
  for (let i = 0; i < awayGoals; i++) {
    eventMinute += Math.floor(Math.random() * 15) + 5;
    if (eventMinute > 90) eventMinute = 85 + Math.floor(Math.random() * 5);
    const scorer = awayScorers[i] || pickShooter(awayTeam.filter(p => p.slot !== 'GK'));
    const assister = awayAssisters[i] || null;
    events.push({
      minute: Math.min(eventMinute, 90),
      type: 'goal',
      player: scorer.name,
      team: 'away',
      assist: assister?.name,
    });
  }
  
  events.sort((a, b) => a.minute - b.minute);
  
  const winner = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw';
  
  return {
    score: { home: homeGoals, away: awayGoals },
    possession: homePossession,
    shotsOnTarget,
    totalShots,
    topPerformers: topPerformers.slice(0, 6),
    events,
  };
}
