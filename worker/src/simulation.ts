// Snatched XI — Match Simulation Engine
// Attribute-based football match resolution

import { PlayerSummary, PlayerRating, MatchResultMessage } from './protocol';

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
  // GKs get overall as proxy for outfield attributes
  return attr ?? overall;
}

function getBaseAttribute(player: FullPlayer, attr: 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physicality'): number {
  return fullAttr(player[attr], player.overall);
}

export interface SimulationResult {
  score: { home: number; away: number };
  possession: number;    // 0-100, home team %
  shotsOnTarget: { home: number; away: number };
  totalShots: { home: number; away: number };
  topPerformers: PlayerRating[];
  events: MatchEvent[];
}

interface MatchEvent {
  minute: number;
  type: 'goal' | 'shot' | 'save' | 'tackle' | 'foul';
  player: string;  // player name
  team: 'home' | 'away';
  detail?: string;
}

// Weight factors for different attributes by position
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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function simulateMatch(
  homeTeam: FullPlayer[],
  awayTeam: FullPlayer[],
  homeFormation: string,
  awayFormation: string
): SimulationResult {
  const homeStrength = weightedTeamStrength(homeTeam);
  const awayStrength = weightedTeamStrength(awayTeam);
  
  // Possession: based on passing + dribbling
  const homePassAvg = homeTeam.reduce((s, p) => s + getBaseAttribute(p, 'passing'), 0) / 11;
  const awayPassAvg = awayTeam.reduce((s, p) => s + getBaseAttribute(p, 'passing'), 0) / 11;
  const homeDribAvg = homeTeam.reduce((s, p) => s + getBaseAttribute(p, 'dribbling'), 0) / 11;
  const awayDribAvg = awayTeam.reduce((s, p) => s + getBaseAttribute(p, 'dribbling'), 0) / 11;
  
  const homePossRaw = (homePassAvg * 0.7 + homeDribAvg * 0.3);
  const awayPossRaw = (awayPassAvg * 0.7 + awayDribAvg * 0.3);
  const homePossession = clamp(
    Math.round((homePossRaw / (homePossRaw + awayPossRaw)) * 100),
    30, 70
  );
  
  // Expected goals based on team strength ratio
  const strengthDiff = homeStrength - awayStrength;
  const baseXg = 1.2;  // Average goals per team per match
  
  // Home advantage
  const homeAdvantage = 1.05;
  
  // Adjust xG based on strength difference
  const homeXg = clamp(baseXg * homeAdvantage * (1 + strengthDiff / 200), 0.3, 4.0);
  const awayXg = clamp(baseXg * (1 - strengthDiff / 200), 0.3, 4.0);
  
  // Add randomness
  const homeXgRandom = homeXg * (0.7 + Math.random() * 0.6);
  const awayXgRandom = awayXg * (0.7 + Math.random() * 0.6);
  
  // Poisson-style goal generation
  let homeGoals = 0;
  let awayGoals = 0;
  
  // Simulate chances
  const homeChances = Math.round(homeXgRandom * 3 + Math.random() * 4);
  const awayChances = Math.round(awayXgRandom * 3 + Math.random() * 4);
  
  // Home chances
  for (let i = 0; i < homeChances; i++) {
    // Shot quality depends on attacker's shooting vs defender's GK
    const shooter = homeTeam[Math.floor(Math.random() * 11)];
    const gk = awayTeam.find(p => p.slot === 'GK')!;
    
    const shotQuality = getBaseAttribute(shooter, 'shooting') / 100;
    const saveQuality = fullAttr(gk.overall, gk.overall) / 100;
    
    if (Math.random() < shotQuality * 0.7 - saveQuality * 0.3 + 0.2) {
      homeGoals++;
    }
  }
  
  // Away chances
  for (let i = 0; i < awayChances; i++) {
    const shooter = awayTeam[Math.floor(Math.random() * 11)];
    const gk = homeTeam.find(p => p.slot === 'GK')!;
    
    const shotQuality = getBaseAttribute(shooter, 'shooting') / 100;
    const saveQuality = fullAttr(gk.overall, gk.overall) / 100;
    
    if (Math.random() < shotQuality * 0.7 - saveQuality * 0.3 + 0.2) {
      awayGoals++;
    }
  }
  
  const shotsOnTarget = {
    home: Math.max(homeGoals, Math.floor(homeChances * 0.4 + Math.random() * 3)),
    away: Math.max(awayGoals, Math.floor(awayChances * 0.4 + Math.random() * 3)),
  };
  
  const totalShots = {
    home: shotsOnTarget.home + Math.floor(Math.random() * 4),
    away: shotsOnTarget.away + Math.floor(Math.random() * 4),
  };
  
  // Player ratings
  const topPerformers: PlayerRating[] = [];
  const allPlayers = [
    ...homeTeam.map(p => ({ ...p, team: 'home' as const })),
    ...awayTeam.map(p => ({ ...p, team: 'away' as const })),
  ];
  
  for (const p of allPlayers) {
    const baseRating = 6.0;
    const overallFactor = (p.overall - 70) / 20;  // +/- 1.5 for 40-100 overall range
    const randomness = (Math.random() - 0.5) * 2;   // +/- 1.0
    
    let rating = baseRating + overallFactor + randomness;
    
    // Goal bonus
    const isHomeScorer = p.team === 'home' && homeGoals > 0;
    const isAwayScorer = p.team === 'away' && awayGoals > 0;
    if (isHomeScorer || isAwayScorer) {
      rating += Math.random() * 1.5;
    }
    
    rating = clamp(Math.round(rating * 10) / 10, 4.0, 10.0);
    
    topPerformers.push({
      playerId: p.id,
      playerName: p.name,
      rating,
    });
  }
  
  // Sort and take top 6
  topPerformers.sort((a, b) => b.rating - a.rating);
  
  // Generate match events
  const events: MatchEvent[] = [];
  let eventMinute = 0;
  
  // Home goals
  for (let i = 0; i < homeGoals; i++) {
    eventMinute += Math.floor(Math.random() * 15) + 5;
    if (eventMinute > 90) eventMinute = 85 + Math.floor(Math.random() * 5);
    const scorer = homeTeam[Math.floor(Math.random() * 10) + 1]; // Skip GK
    events.push({
      minute: Math.min(eventMinute, 90),
      type: 'goal',
      player: scorer.name,
      team: 'home',
    });
  }
  
  // Away goals (interleave)
  eventMinute = 0;
  for (let i = 0; i < awayGoals; i++) {
    eventMinute += Math.floor(Math.random() * 15) + 5;
    if (eventMinute > 90) eventMinute = 85 + Math.floor(Math.random() * 5);
    const scorer = awayTeam[Math.floor(Math.random() * 10) + 1];
    events.push({
      minute: Math.min(eventMinute, 90),
      type: 'goal',
      player: scorer.name,
      team: 'away',
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
