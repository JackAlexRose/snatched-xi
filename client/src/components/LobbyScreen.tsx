"use client";

import { useState } from "react";

export function LobbyScreen({ onConnect, onDebug, onSimTest, onQuickSim, lobbyId, playerId, lobbyPlayers, onStartEarly, devUnlocked }: {
  onConnect: (lid: string, pid: string) => void;
  onDebug: () => void;
  onSimTest: () => void;
  onQuickSim: () => void;
  lobbyId: string | null;
  playerId: string;
  lobbyPlayers: { id: string; name: string; isBot: boolean }[];
  onStartEarly: () => void;
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
  const humanCount = lobbyPlayers.filter(p => !p.isBot).length;
  const canStart = humanCount >= 2;

  return (
    <div className="max-w-md mx-auto mt-12 px-6 text-center">
      <h1 className="font-display font-bold text-2xl text-navy mb-2">Snatched XI</h1>
      <p className="font-display text-xs text-slate-soft mb-8">
        4-team tournament &mdash; draft, sim, round-robin
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
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-left mb-6 shadow-sm">
          <div className="text-slate-soft text-xs font-display mb-2">Share this link:</div>
          <a href={shareUrl} className="text-coral break-all text-sm font-display"
            onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(shareUrl); }}>
            {shareUrl}
          </a>

          {/* Player slots */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {["p1", "p2", "p3", "p4"].map(pid => {
              const p = lobbyPlayers.find(lp => lp.id === pid);
              return (
                <div key={pid} className={`rounded-lg px-3 py-2 text-xs font-display border ${
                  p ? (p.isBot ? "bg-[#F8FAFC] border-[#CBD5E1]" : "bg-mint/5 border-mint")
                    : "bg-[#F8FAFC] border-dashed border-[#CBD5E1]"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${p ? (p.isBot ? "bg-slate-soft" : "bg-mint animate-pulse") : "bg-[#CBD5E1]"}`} />
                    <span className="font-bold text-navy">{p ? p.name : "Open"}</span>
                    {p?.isBot && <span className="text-slate-soft text-[0.55rem] ml-auto">🤖</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Start Early button */}
          {canStart && (
            <button onClick={onStartEarly} className="w-full mt-3 bg-coral text-white px-4 py-2 rounded-lg font-display font-bold text-sm cursor-pointer hover:bg-coral/90 transition-colors">
              Start Tournament ({humanCount} human{humanCount > 1 ? "s" : ""} · {4 - humanCount} bots)
            </button>
          )}

          {lobbyPlayers.length < 4 && !canStart && (
            <div className="text-slate-soft text-xs font-display mt-3 italic flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse inline-block" />
              Waiting for players... ({lobbyPlayers.length}/4, need 2+ to start)
            </div>
          )}
          {lobbyPlayers.length === 4 && (
            <div className="text-mint text-xs font-display mt-3 italic">
              Lobby full — starting tournament...
            </div>
          )}
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
            <div>
              <p>Snatched XI is a 4-team tournament draft game using real Premier League squads.</p>
              <p className="text-slate-soft mt-1">2-4 human players draft 11 players each, then the engine simulates a round-robin tournament with play-by-play commentary and a live table.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-navy text-white text-[0.55rem] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">1</span>
                <span className="font-bold">Blueprint</span>
              </div>
              <p className="text-slate-soft pl-6">Pick a <span className="text-navy font-bold">team name</span> and <span className="text-navy font-bold">formation</span> (4-3-3, 4-4-2, etc.). Choices hidden until all submitted.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-navy text-white text-[0.55rem] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">2</span>
                <span className="font-bold">Draft · 11 Rounds</span>
              </div>
              <p className="text-slate-soft pl-6">Each round the wheel picks a club. All 4 players draft from the same squad — first to claim wins. Positional locking applies.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-navy text-white text-[0.55rem] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">3</span>
                <span className="font-bold">Tournament</span>
              </div>
              <p className="text-slate-soft pl-6">Round-robin — every team plays every other team once (6 matches total). Live commentary for each, table updates after each match.</p>
            </div>
          </div>
        )}
      </div>

      {devUnlocked && (
        <div className="border-t border-[#E2E8F0] pt-8 mt-8">
          <div className="flex flex-col gap-3">
            <button onClick={onQuickSim} className="bg-white text-navy border-2 border-dashed border-[#CBD5E1] rounded-xl px-6 py-3 font-display text-sm cursor-pointer hover:border-amber-400 hover:text-amber-500 transition-colors">
              Quick Sim
            </button>
            <button onClick={onSimTest} className="bg-white text-navy border-2 border-dashed border-[#CBD5E1] rounded-xl px-6 py-3 font-display text-sm cursor-pointer hover:border-coral hover:text-coral transition-colors">
              Simulation Tester
            </button>
          </div>
          <div className="text-slate-soft text-xs mt-2 font-display">Dev tools</div>
        </div>
      )}
    </div>
  );
}
