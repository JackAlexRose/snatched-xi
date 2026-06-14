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
    <div className="max-w-lg mx-auto mt-20 px-6 text-center">
      <button onClick={createLobby} className="bg-[#e9393f] text-white px-8 py-3 text-lg cursor-pointer hover:opacity-90 mb-6">
        Create Lobby
      </button>

      <div className="flex items-center gap-3 justify-center mb-6">
        <input value={joinId} onChange={(e) => setJoinId(e.target.value)} placeholder="Lobby ID"
          className="bg-[#1a1a1a] text-[#c4c4c4] border border-[#444] px-4 py-2 w-48" />
        <button onClick={joinLobby} className="bg-[#e9393f] text-white px-6 py-2 cursor-pointer hover:opacity-90">Join</button>
      </div>

      {lobbyId && (
        <div className="bg-[#1a1a1a] border border-[#444] p-4 text-left mb-6">
          <div className="text-[#888] mb-2">Share this link:</div>
          <a href={shareUrl} className="text-[#e9393f] break-all text-sm" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(shareUrl); }}>
            {shareUrl}
          </a>
          <div className="text-[#888] mt-2 italic">Waiting for opponent to join...</div>
        </div>
      )}

      <div className="border-t border-[#444] pt-6 mt-6">
        <button onClick={onDebug} className="bg-[#1a1a1a] text-[#f1c40f] border border-[#f1c40f] px-6 py-3 cursor-pointer hover:bg-[#f1c40f]/10">
          Debug Mode (vs Bot)
        </button>
        <div className="text-[#666] text-xs mt-2">Single-player test — bot auto-drafts</div>
      </div>
    </div>
  );
}
