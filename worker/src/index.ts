// Snatched XI — Cloudflare Worker Entry Point
// Routes: create lobby, join lobby, WebSocket upgrades

/// <reference types="@cloudflare/workers-types" />

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

      // Upgrade to WebSocket via the DO
      const doId = env.LOBBY.idFromName(lobbyId);
      const stub = env.LOBBY.get(doId);

      const wsUrl = new URL(request.url);
      wsUrl.pathname = '/ws';
      wsUrl.searchParams.set('player', playerId);

      // Forward the upgrade request to the DO
      return stub.fetch(new Request(wsUrl.toString(), {
        headers: {
          'Upgrade': 'websocket',
        },
      }));
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
      return new Response(HTML_CLIENT, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

// ── Minimal MVP Client (served inline for now) ──

const HTML_CLIENT = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Snatched XI</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: 'Departure Mono', 'Courier New', monospace;
    background: #262626; color: #c4c4c4; 
    max-width: 800px; margin: 40px auto; padding: 20px;
  }
  h1 { color: #e9393f; margin-bottom: 8px; }
  p { margin-bottom: 16px; color: #888; }
  button {
    background: #e9393f; color: #fff; border: none;
    padding: 10px 20px; cursor: pointer; font-family: inherit;
  }
  button:hover { opacity: 0.9; }
  input {
    background: #1a1a1a; color: #c4c4c4; border: 1px solid #444;
    padding: 8px 12px; font-family: inherit; width: 200px;
  }
  #status { margin-top: 16px; }
  .lobby-link { margin-top: 16px; padding: 12px; background: #1a1a1a; border: 1px solid #444; }
  .lobby-link a { color: #e9393f; }
</style>
</head>
<body>
<h1>Snatched XI</h1>
<p>1v1 competitive football draft — coming soon</p>
<div id="app">
  <div id="create">
    <button onclick="createLobby()">Create Lobby</button>
    <div class="lobby-link" id="lobbyLink" style="display:none"></div>
  </div>
  <div id="join" style="margin-top:20px">
    <input type="text" id="lobbyId" placeholder="Lobby ID">
    <button onclick="joinLobby()">Join Lobby</button>
  </div>
  <div id="status"></div>
</div>
<script>
async function createLobby() {
  const res = await fetch('/api/lobby/create', { method: 'POST' });
  const data = await res.json();
  document.getElementById('lobbyLink').style.display = 'block';
  document.getElementById('lobbyLink').innerHTML = 
    'Share this link: <a href="/lobby/' + data.lobbyId + '/ws?player=p1">' + 
    window.location.origin + '/lobby/' + data.lobbyId + '/ws?player=p1</a>';
  document.getElementById('status').textContent = 'Lobby created! Waiting for opponent...';
}
async function joinLobby() {
  const id = document.getElementById('lobbyId').value.trim();
  if (!id) return;
  window.location.href = '/lobby/' + id + '/ws?player=p2';
}
</script>
</body>
</html>`;
