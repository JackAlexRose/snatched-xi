// Snatched XI — Cloudflare Worker Entry Point
// Routes: create lobby, join lobby, WebSocket upgrades

import { DurableObjectNamespace, D1Database } from 'cloudflare:workers';

import clientHTML from './client.html';

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

      // Regular browser request — serve the client so JS can open WS
      return new Response(clientHTML, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
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

    // ── Serve Client (in production, this would be static assets) ──
    if (path === '/' || path === '') {
      return new Response(clientHTML, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

// ── Type declarations for non-TS imports ──

declare module '*.html' {
  const content: string;
  export default content;
}
