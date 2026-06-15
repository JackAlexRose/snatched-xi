"use client";

import { useState } from "react";

export function LobbyScreen({ onConnect, onDebug, onSimTest, onQuickSim, lobbyId, playerId, devUnlocked }: {
  onConnect: (lid: string, pid: string) => void;
  onDebug: () => void;
  onSimTest: () => void;
  onQuickSim: () => void;
  lobbyId: string | null;
  playerId: string;
  devUnlocked: boolean;
}) {
  const [joinId, setJoinId] = useState("");
  const [showHow, setShowHow] = useState(false);

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
    <div className="max-w-md mx-auto mt-12 px-6 text-center">
      {/* Title */}
      <h1 className="font-display font-bold text-2xl text-navy mb-2">Snatched XI</h1>
      <p className="font-display text-xs text-slate-soft mb-8">
        1v1 football draft &amp; sim &mdash; pick a club&rsquo;s squad, draft your XI, let the engine decide
      </p>

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

      {/* How to Play */}
      <div className="text-left border-t border-[#E2E8F0] pt-6 mt-6">
        <button
          onClick={() => setShowHow(!showHow)}
          className="w-full flex items-center justify-between font-display text-sm font-bold text-navy cursor-pointer hover:text-navy/70 transition-colors"
        >
          How to Play
          <svg width="12" height="12" viewBox="0 0 12 12"
            className={`transition-transform duration-200 ${showHow ? "rotate-180" : ""}`}>
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </button>

        {showHow && (
          <div className="mt-4 mb-8 bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-5 text-xs font-display leading-relaxed text-navy shadow-sm">
            {/* Overview */}
            <div>
              <p>Snatched XI is a 1v1 competitive draft game using real Premier League squads from the last decade.</p>
              <p className="text-slate-soft mt-1">You and an opponent draft 11 players round-by-round, then a server-side engine simulates the match live with play-by-play commentary.</p>
            </div>

            {/* Phase 1 */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-navy text-white text-[0.55rem] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">1</span>
                <span className="font-bold">Blueprint</span>
              </div>
              <p className="text-slate-soft pl-6">Both players secretly lock in a <span className="text-navy font-bold">formation</span> (4-3-3, 4-4-2, 3-5-2, etc.). Choices are hidden until both have submitted.</p>
            </div>

            {/* Phase 2 */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-navy text-white text-[0.55rem] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">2</span>
                <span className="font-bold">The Draft · 11 Rounds</span>
              </div>
              <p className="text-slate-soft pl-6">Each round the wheel selects a random <span className="text-navy font-bold">club &amp; season</span> — you both see the same squad. Pick one player and slot them into your formation.</p>
              <div className="pl-6 mt-1.5 space-y-1 text-slate-soft">
                <p>&bull; <span className="text-navy font-bold">First to claim wins</span> — if both want the same player, whoever clicks first gets them</p>
                <p>&bull; <span className="text-navy font-bold">Positional locking</span> — a striker can&rsquo;t go in a CB slot. Valid slots pulse green during draft</p>
                <p>&bull; <span className="text-navy font-bold">30-second timer</span> — don&rsquo;t miss your pick or you&rsquo;ll get a random player</p>
              </div>
            </div>

            {/* Phase 3 */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-navy text-white text-[0.55rem] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">3</span>
                <span className="font-bold">The Match</span>
              </div>
              <p className="text-slate-soft pl-6">The engine simulates a full 90-minute match using your drafted players&rsquo; attributes, formations, and real-time commentary.</p>
              <div className="pl-6 mt-1.5 space-y-1 text-slate-soft">
                <p>&bull; <span className="text-navy font-bold">Live commentary</span> — passes, shots, saves, goals play out one by one</p>
                <p>&bull; <span className="text-navy font-bold">Player ratings</span> — every player scored 3-10 based on performance</p>
                <p>&bull; <span className="text-navy font-bold">Full stats</span> — possession, shots, goal events, top performers</p>
              </div>
            </div>

            {/* Tips */}
            <div className="border-t border-[#E2E8F0] pt-4">
              <p className="font-bold mb-1">Tips</p>
              <p className="text-slate-soft">Drafting elite defenders matters — they actively block shots in the engine. Balance your squad across all positions for the best results.</p>
            </div>
          </div>
        )}
      </div>

      {devUnlocked && (
        <div className="border-t border-[#E2E8F0] pt-8 mt-8">
          <div className="flex flex-col gap-3">
            <button onClick={onDebug} className="bg-white text-navy border-2 border-dashed border-[#CBD5E1] rounded-xl px-6 py-3 font-display text-sm cursor-pointer hover:border-mint hover:text-mint transition-colors">
              Debug Mode (vs Bot)
            </button>
            <button onClick={onSimTest} className="bg-white text-navy border-2 border-dashed border-[#CBD5E1] rounded-xl px-6 py-3 font-display text-sm cursor-pointer hover:border-coral hover:text-coral transition-colors">
              Simulation Tester
            </button>
            <button onClick={onQuickSim} className="bg-white text-navy border-2 border-dashed border-[#CBD5E1] rounded-xl px-6 py-3 font-display text-sm cursor-pointer hover:border-amber-400 hover:text-amber-500 transition-colors">
              Quick Sim
            </button>
          </div>
          <div className="text-slate-soft text-xs mt-2 font-display">Dev tools — test the engine</div>
        </div>
      )}
    </div>
  );
}
