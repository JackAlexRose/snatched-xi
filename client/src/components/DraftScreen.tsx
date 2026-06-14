"use client";

import { useState } from "react";
import { FORMATION_SLOTS, PITCH_SLOTS, DraftablePlayer } from "@/types";
import { PlayerAvatar } from "./PlayerAvatar";

function canPlaySlot(playerPositions: string[], slot: string): boolean {
  const sp = playerPositions.map(p => p.toUpperCase());
  const sl = slot.toUpperCase();
  if (sl === 'GK') return sp.includes('GK');
  if (sl === 'CB') return sp.some(p => ['CB'].includes(p));
  if (['LB','LWB'].includes(sl)) return sp.some(p => ['LB','LWB'].includes(p));
  if (['RB','RWB'].includes(sl)) return sp.some(p => ['RB','RWB'].includes(p));
  if (sl === 'CDM') return sp.some(p => ['CDM','CM'].includes(p));
  if (sl === 'CM') return sp.some(p => ['CM','CDM','CAM'].includes(p));
  if (sl === 'CAM') return sp.some(p => ['CAM','CM','CF'].includes(p));
  if (['LM','RM'].includes(sl)) return sp.some(p => ['LM','RM','LW','RW','CM'].includes(p));
  if (['LW','RW'].includes(sl)) return sp.some(p => ['LW','RW','LM','RM','ST','CF'].includes(p));
  if (sl === 'ST') return sp.some(p => ['ST','CF','LW','RW'].includes(p));
  return sp.includes(sl);
}

export function DraftScreen({ sendMessage, myTeam, yourFormation, playerId, squad, wheelClub, wheelSeason, spinning, timer, timerMax, timerLabel, opponentMsg, claimed, currentRound }: {
  sendMessage: (msg: object) => void;
  myTeam: any[];
  yourFormation: string;
  playerId: string;
  squad: DraftablePlayer[];
  wheelClub: string; wheelSeason: string; spinning: boolean;
  timer: number; timerMax: number; timerLabel: string;
  opponentMsg: string; claimed: Set<string>;
  currentRound: number;
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const slots = FORMATION_SLOTS[yourFormation] || [];
  const pitchSlots = PITCH_SLOTS[yourFormation] || {};

  const selectPlayer = (pid: string) => {
    if (claimed.has(pid)) return;
    setSelectedPlayerId(pid);
  };

  const selectSlot = (slotIndex: number) => {
    if (!selectedPlayerId) return;
    sendMessage({ type: "draft_pick", playerId: selectedPlayerId, slotIndex });
    setSelectedPlayerId(null);
  };

  const pitchIdx: Record<string, { item: any; index: number }> = {};
  const slotCounts: Record<string, number> = {};
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    slotCounts[s] = (slotCounts[s] || 0) + 1;
    const key = slotCounts[s] > 1 ? s + slotCounts[s] : s;
    pitchIdx[key] = { item: myTeam[i], index: i };
  }

  const selectedPositions = selectedPlayerId
    ? squad.find(p => p.id === selectedPlayerId)?.positions.map(s => s.toUpperCase()) || []
    : [];

  const filledCount = myTeam.filter((s: any) => s.player).length;
  const avgOvr = filledCount > 0
    ? Math.round(myTeam.filter((s: any) => s.player).reduce((sum: number, s: any) => sum + s.player.overall, 0) / filledCount)
    : null;

  return (
    <div className="flex gap-4 px-4 mt-4 max-w-[960px] mx-auto">
      {/* Pitch */}
      <div className="flex-shrink-0 w-[300px]">
        <div className="text-center text-[#888] text-xs mb-2">
          Your XI{avgOvr && <span className="text-[#f1c40f] ml-2">{avgOvr} OVR</span>}
        </div>
        <div className="relative w-[300px] h-[440px] bg-gradient-to-b from-[#1a3a1a] via-[#1e441e] to-[#1a3a1a] border-2 border-[#555] rounded overflow-hidden">
          {/* Pitch markings — pointer-events-none so clicks pass through to slots */}
          <div className="absolute top-1/2 left-[5%] right-[5%] border-t border-white/10 pointer-events-none" />
          <div className="absolute top-[5%] bottom-[5%] left-1/2 border-l border-white/10 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-white/10 rounded-full pointer-events-none" />
          <div className="absolute top-[5%] left-[15%] right-[15%] h-[18%] border border-t-0 border-white/10 pointer-events-none" />
          <div className="absolute bottom-[5%] left-[15%] right-[15%] h-[18%] border border-b-0 border-white/10 pointer-events-none" />

          {Object.entries(pitchSlots).map(([key, pos]) => {
            const entry = pitchIdx[key];
            const item = entry?.item;
            const filled = item?.player;
            const slotName = item?.slot || key;
            const slotIndex = entry?.index ?? -1;
            const valid = !filled && selectedPlayerId && selectedPositions.some(sp => canPlaySlot([sp], slotName));

            return (
              <div key={key}
                onClick={() => { if (valid) selectSlot(slotIndex); }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-[52px] h-[36px] border text-[0.6rem] flex flex-col items-center justify-center transition-all
                  ${filled ? "border-[#2ecc71] bg-[#2ecc71]/10 border-solid cursor-default"
                    : valid ? "border-[#f1c40f] border-solid shadow-[0_0_8px_rgba(241,196,15,0.4)] animate-pulse cursor-pointer"
                    : selectedPlayerId ? "border-dashed border-[#444] opacity-25 cursor-not-allowed"
                    : "border-dashed border-[#444] bg-black/50 hover:border-[#c4c4c4] cursor-pointer"}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                {filled ? (
                  <>
                    <PlayerAvatar name={item?.player.name} size={16} />
                    <span className="text-[#c4c4c4] text-[0.5rem] leading-tight text-center mt-0.5">{item?.player.name}</span>
                  </>
                ) : (
                  <span className="text-[#888] text-[0.5rem]">{slotName}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel */}
      <div className="flex-1">
        <div className="h-1 bg-[#444] rounded mb-2 overflow-hidden">
          <div className="h-full bg-[#e9393f] transition-all duration-1000" style={{ width: `${timerMax > 0 ? (timer / timerMax) * 100 : 0}%` }} />
        </div>
        <div className="text-center text-sm mb-2">{timerLabel}</div>

        {opponentMsg && (
          <div className="text-xs text-[#f1c40f] bg-[#1a1a1a] border border-[#f1c40f] p-2 mb-3">{opponentMsg}</div>
        )}

        {wheelClub && (
          <div className={`text-center p-3 mb-3 bg-[#1a1a1a] border ${spinning ? "border-[#f1c40f]" : "border-[#e9393f]"} rounded`}>
            <div className={`text-lg ${spinning ? "text-[#888]" : "text-[#e9393f]"}`}>{wheelClub}</div>
            <div className="text-[#888] text-xs">{wheelSeason}</div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {squad.map((p) => {
            const isClaimed = claimed.has(p.id);
            const isSelected = selectedPlayerId === p.id;
            const attrs = [p.pace, p.shooting, p.passing, p.dribbling, p.defending, p.physicality].map(v => v ?? "?").join("/");

            return (
              <div key={p.id}
                onClick={() => !isClaimed && selectPlayer(p.id)}
                className={`bg-[#1a1a1a] border p-2 cursor-pointer transition-all text-xs
                  ${isClaimed ? "opacity-30 border-[#444] cursor-not-allowed" : "border-[#444] hover:border-[#e9393f]"}
                  ${isSelected ? "!border-[#f1c40f] shadow-[0_0_6px_rgba(241,196,15,0.4)]" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <PlayerAvatar name={p.name} size={24} />
                  <span className="font-bold text-[0.8rem]">{isClaimed ? "TAKEN" : p.name}</span>
                </div>
                <div className="text-[#888] text-[0.65rem]">{p.positions.join(", ")}</div>
                <div className="text-[#e9393f] text-[0.7rem] font-bold">OVR {p.overall}</div>
                <div className="text-[#666] text-[0.6rem]">{attrs}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
