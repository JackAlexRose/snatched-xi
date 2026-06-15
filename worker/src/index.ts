// Snatched XI — Cloudflare Worker Entry Point
// Routes: create lobby, join lobby, WebSocket upgrades, sim tester
// Types (DurableObjectNamespace, D1Database) are globally available via @cloudflare/workers-types.

import { simulateMatch } from './simulation';
import { canPlayInSlot, FORMATION_SLOTS, DraftablePlayer, PlayerSummary } from './protocol';

export { LobbyDO } from './LobbyDO';

interface Env {
  LOBBY: DurableObjectNamespace;
  DB: D1Database;
}

// Generate a short lobby ID
function generateLobbyId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ── Auto-draft helper ──
// Fetches random players from D1 and fills a full formation roster.

async function autoDraftTeam(formation: string, db: D1Database): Promise<any[]> {
  const slots = FORMATION_SLOTS[formation];
  // Fetch a big pool of random players to fill slots from
  const poolResult = await db.prepare(
    'SELECT id, name, positions, overall, pace, shooting, passing, dribbling, defending, physicality FROM players ORDER BY RANDOM() LIMIT 120'
  ).all<DraftablePlayer>();

  const pool: any[] = poolResult.results.map((p: any) => ({
    ...p,
    positions: typeof p.positions === 'string' 
      ? p.positions.split(',').map((s: string) => s.trim()) 
      : (p.positions as unknown as string[]),
  }));

  const used = new Set<string>();
  const team: any[] = [];

  for (const slot of slots) {
    // Find a compatible player not yet used
    const match = pool.find(
      p => !used.has(p.id) && canPlayInSlot(p.positions, slot)
    );
    if (match) {
      used.add(match.id);
      team.push({
        id: match.id,
        name: match.name,
        positions: match.positions,
        overall: match.overall,
        pace: match.pace,
        shooting: match.shooting,
        passing: match.passing,
        dribbling: match.dribbling,
        defending: match.defending,
        physicality: match.physicality,
        slot,
      });
    }
  }

  // If any slots are still unfilled (unlikely with 120 pool), fill from remaining pool
  if (team.length < 11) {
    const filledSlots = new Set(team.map(p => p.slot));
    for (const slot of slots) {
      if (filledSlots.has(slot)) continue;
      const match = pool.find(p => !used.has(p.id));
      if (match) {
        used.add(match.id);
        team.push({
          id: match.id,
          name: match.name,
          positions: match.positions,
          overall: match.overall,
          pace: match.pace,
          shooting: match.shooting,
          passing: match.passing,
          dribbling: match.dribbling,
          defending: match.defending,
          physicality: match.physicality,
          slot,
        });
      }
    }
  }

  return team;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for client
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ── Quick Sim (Tournament) ──
    // Auto-drafts 4 random teams, runs 6-match round-robin, returns all commentary + table.
    if (path === '/api/quick-sim' && request.method === 'POST') {
      try {
        const formations = Object.keys(FORMATION_SLOTS);
        const teamNames = ["Red Devils", "City Blues", "Gunners FC", "Spurs United"];
        
        // Draft 4 teams
        const teams: any[] = [];
        for (let i = 0; i < 4; i++) {
          const formation = formations[Math.floor(Math.random() * formations.length)];
          const fullTeam = await autoDraftTeam(formation, env.DB);
          const ovr = Math.round(fullTeam.reduce((s: number, p: any) => s + p.overall, 0) / fullTeam.length);
          const summary = fullTeam.map((p: any) => ({
            id: p.id, name: p.name, positions: p.positions, overall: p.overall, slot: p.slot,
          }));
          teams.push({
            id: `p${i + 1}`, name: teamNames[i], teamName: teamNames[i], formation, ovr,
            players: summary, fullTeam,
          });
        }

        // Round-robin: 6 matches
        const pairings: [number, number][] = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
        const matches: any[] = [];
        
        // Table tracking
        const table = teams.map(t => ({
          id: t.id, name: t.name, teamName: t.teamName,
          played: 0, won: 0, drawn: 0, lost: 0,
          goalsFor: 0, goalsAgainst: 0, points: 0,
        }));

        for (const [hi, ai] of pairings) {
          const home = teams[hi];
          const away = teams[ai];
          const sim = simulateMatch(home.fullTeam, away.fullTeam, home.formation, away.formation);
          
          const homeRatings = sim.topPerformers.filter((p: any) => home.fullTeam.some((hp: any) => hp.id === p.playerId));
          const awayRatings = sim.topPerformers.filter((p: any) => away.fullTeam.some((ap: any) => ap.id === p.playerId));
          
          // Update table
          const trHome = table[hi];
          const trAway = table[ai];
          trHome.played++; trAway.played++;
          trHome.goalsFor += sim.score.home; trHome.goalsAgainst += sim.score.away;
          trAway.goalsFor += sim.score.away; trAway.goalsAgainst += sim.score.home;
          if (sim.score.home > sim.score.away) { trHome.won++; trHome.points += 3; trAway.lost++; }
          else if (sim.score.away > sim.score.home) { trAway.won++; trAway.points += 3; trHome.lost++; }
          else { trHome.drawn++; trAway.drawn++; trHome.points++; trAway.points++; }
          
          matches.push({
            homeId: home.id, awayId: away.id,
            homeName: home.teamName, awayName: away.teamName,
            matchScript: sim.matchScript,
            result: {
              score: sim.score,
              possession: sim.possession,
              shotsOnTarget: sim.shotsOnTarget,
              totalShots: sim.totalShots,
              topPerformers: sim.topPerformers,
              homeTeam: homeRatings, awayTeam: awayRatings,
              homeOvr: home.ovr, awayOvr: away.ovr,
              winner: sim.score.home > sim.score.away ? 'home' : sim.score.away > sim.score.home ? 'away' : 'draw',
            },
          });
        }

        // Sort table
        table.sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));

        return new Response(JSON.stringify({
          teams: teams.map(t => ({ id: t.id, name: t.name, teamName: t.teamName, formation: t.formation, ovr: t.ovr, players: t.players })),
          matches,
          table,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Simulation Tester ──
    // Auto-drafts two random teams, runs 5 simulations, returns all stats.
    if (path === '/api/sim-test' && request.method === 'POST') {
      try {
        const formations = Object.keys(FORMATION_SLOTS);
        const homeFormation = formations[Math.floor(Math.random() * formations.length)];
        let awayFormation = formations[Math.floor(Math.random() * formations.length)];
        // Avoid mirror match
        while (awayFormation === homeFormation) {
          awayFormation = formations[Math.floor(Math.random() * formations.length)];
        }

        const homeTeam = await autoDraftTeam(homeFormation, env.DB);
        const awayTeam = await autoDraftTeam(awayFormation, env.DB);

        const homeOvr = Math.round(homeTeam.reduce((s: number, p: any) => s + p.overall, 0) / homeTeam.length);
        const awayOvr = Math.round(awayTeam.reduce((s: number, p: any) => s + p.overall, 0) / awayTeam.length);

        // Run 5 simulations
        const results = [];
        let homeWins = 0, awayWins = 0, draws = 0;
        let totalHomeGoals = 0, totalAwayGoals = 0;

        for (let i = 0; i < 5; i++) {
          const sim = simulateMatch(homeTeam, awayTeam, homeFormation, awayFormation);
          results.push(sim);
          totalHomeGoals += sim.score.home;
          totalAwayGoals += sim.score.away;
          if (sim.score.home > sim.score.away) homeWins++;
          else if (sim.score.away > sim.score.home) awayWins++;
          else draws++;
        }

        // Strip full attribute objects from team summaries (client only needs summaries)
        const homeSummary = homeTeam.map((p: any) => ({
          id: p.id,
          name: p.name,
          positions: p.positions,
          overall: p.overall,
          slot: p.slot,
        }));
        const awaySummary = awayTeam.map((p: any) => ({
          id: p.id,
          name: p.name,
          positions: p.positions,
          overall: p.overall,
          slot: p.slot,
        }));

        return new Response(JSON.stringify({
          homeFormation,
          awayFormation,
          homeTeam: homeSummary,
          awayTeam: awaySummary,
          homeOvr,
          awayOvr,
          results,
          matchScripts: results.map(r => r.matchScript),
          summary: { homeWins, awayWins, draws, totalHomeGoals, totalAwayGoals },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Create Lobby ──
    if (path === '/api/lobby/create' && request.method === 'POST') {
      const lobbyId = generateLobbyId();
      const doId = env.LOBBY.idFromName(lobbyId);
      const stub = env.LOBBY.get(doId);

      // Touch the DO to ensure it exists
      await stub.fetch(new Request(`https://lobby/status`));

      return new Response(JSON.stringify({ lobbyId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── WebSocket Connection ──
    const wsMatch = path.match(/^\/lobby\/([a-z0-9]+)\/ws$/);
    if (wsMatch) {
      const lobbyId = wsMatch[1];
      const playerId = url.searchParams.get('player') || 'p1';

      // Only upgrade if the client is actually requesting a WebSocket
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
        // Forward to DO for actual WebSocket upgrade
        const doId = env.LOBBY.idFromName(lobbyId);
        const stub = env.LOBBY.get(doId);

        const wsUrl = new URL(request.url);
        wsUrl.pathname = '/ws';
        wsUrl.searchParams.set('player', playerId);

        return stub.fetch(new Request(wsUrl.toString(), {
          headers: { 'Upgrade': 'websocket' },
        }));
      }

      // Regular browser request — redirect to Next.js client with lobby ID
      const redirectUrl = `https://snatched-xi-client.jackalexanderrose.workers.dev/?lobby=${lobbyId}`;
      return Response.redirect(redirectUrl, 302);
    }

    // ── Lobby Status ──
    const statusMatch = path.match(/^\/api\/lobby\/([a-z0-9]+)\/status$/);
    if (statusMatch) {
      const lobbyId = statusMatch[1];
      const doId = env.LOBBY.idFromName(lobbyId);
      const stub = env.LOBBY.get(doId);
      const response = await stub.fetch(new Request('https://lobby/status'));
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Serve Client — redirect to Next.js app ──
    if (path === '/' || path === '') {
      return Response.redirect('https://snatched-xi-client.jackalexanderrose.workers.dev', 302);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

