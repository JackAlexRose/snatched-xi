"use client";

import { useState } from "react";

export function LobbyScreen({ onConnect, onDebug, lobbyId, playerId }: {
  onConnect: (lid: string, pid: string) => void;
  onDebug: () => void;
  lobbyId: string | null;
  playerId: string;
}) {
  const [joinId, setJoinId] = useState("");

  const createLobby = async () => {
    const res = await fetch("https://snatched-xi.jackalexanderrose.workers.dev/api/lobby/create", { method: "POST" });
    const data = await res.json();
    onConnect(data.lobbyId, "p1");
  };

  const joinLobby = () => {
    const id = joinId.trim();
    if (id) onConnect(id, "p2");
  };

  const shareUrl = lobbyId ? `https://snatched-xi-client.jackalexanderrose.workers.dev/?lobby=${lobbyId}` : "";

  return (
    <div className="max-w-md mx-auto mt-20 px-6 text-center">
      <button onClick={createLobby} className="bg-navy text-white px-8 py-3 text-base rounded-xl font-display font-bold cursor-pointer hover:bg-navy/90 transition-colors mb-8">
        Create Lobby
      </button>

      <div className="flex items-center gap-3 justify-center mb-8">
        <input value={joinId} onChange={(e) => setJoinId(e.target.value)} placeholder="Lobby ID"
          className="bg-white text-navy border border-[#E2E8F0] rounded-lg px-4 py-2 w-48 font-display text-sm placeholder:text-slate-soft focus:outline-none focus:border-mint" />
        <button onClick={joinLobby} className="bg-mint text-white px-6 py-2 rounded-lg font-display font-bold text-sm cursor-pointer hover:bg-mint/90 transition-colors">Join</button>
      </div>

      {lobbyId && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-left mb-8 shadow-sm">
          <div className="text-slate-soft text-xs font-display mb-2">Share this link with your opponent:</div>
          <a href={shareUrl} className="text-coral break-all text-sm font-display"
            onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(shareUrl); }}>
            {shareUrl}
          </a>
          <div className="text-slate-soft text-xs font-display mt-3 italic flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse inline-block" />
            Waiting for opponent to join...
          </div>
        </div>
      )}

      <div className="border-t border-[#E2E8F0] pt-8 mt-8">
        <button onClick={onDebug} className="bg-white text-navy border-2 border-dashed border-[#CBD5E1] rounded-xl px-6 py-3 font-display text-sm cursor-pointer hover:border-mint hover:text-mint transition-colors">
          Debug Mode (vs Bot)
        </button>
        <div className="text-slate-soft text-xs mt-2 font-display">Single-player test — bot auto-drafts</div>
      </div>
    </div>
  );
}
