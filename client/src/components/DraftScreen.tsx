"use client";

import { useState } from "react";
import { FORMATION_SLOTS, PITCH_SLOTS, DraftablePlayer } from "@/types";
import { HeaderBar, WheelBanner } from "./HeaderBar";
import { CardCarousel } from "./CardCarousel";
import { MiniPitch } from "./MiniPitch";

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
  const [pitchExpanded, setPitchExpanded] = useState(false);
  const slots = FORMATION_SLOTS[yourFormation] || [];
  const pitchSlots = PITCH_SLOTS[yourFormation] || {};

  const selectPlayer = (pid: string) => {
    if (claimed.has(pid)) return;
    if (pid === selectedPlayerId) {
      setSelectedPlayerId(null);
    } else {
      setSelectedPlayerId(pid);
      // Auto-expand pitch so player can see slot targets
      setPitchExpanded(true);
    }
  };

  const selectSlot = (slotIndex: number) => {
    if (!selectedPlayerId) return;
    sendMessage({ type: "draft_pick", playerId: selectedPlayerId, slotIndex });
    setSelectedPlayerId(null);
  };

  // Build pitch index
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
    <div className="min-h-[100dvh] bg-cream flex flex-col overflow-hidden">
      {/* Sticky Header */}
      <HeaderBar
        currentRound={currentRound}
        timer={timer}
        opponentMsg={opponentMsg}
      />

      {/* Timer progress bar */}
      <div className="h-1 bg-[#E2E8F0] flex-shrink-0">
        <div
          className={`h-full transition-all duration-1000 ${timer <= 3 ? "bg-coral" : "bg-mint"}`}
          style={{ width: `${timerMax > 0 ? (timer / timerMax) * 100 : 0}%` }}
        />
      </div>

      {/* Wheel Banner */}
      <WheelBanner club={wheelClub} season={wheelSeason} spinning={spinning} />

      {/* Timer label */}
      <div className="text-center text-slate-soft text-xs font-display py-1.5 flex-shrink-0">
        {timerLabel}
      </div>

      {/* Main content — clicking here collapses pitch */}
      <div
        className="flex-1 flex flex-col justify-center min-h-0"
        onClick={() => setPitchExpanded(false)}
      >
        <CardCarousel
          players={squad}
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={selectPlayer}
          claimed={claimed}
        />
      </div>

      {/* Pitch drawer — fixed at bottom */}
      <div className="flex-shrink-0 sticky bottom-0 bg-cream/95 backdrop-blur-sm border-t border-[#E2E8F0] px-2 pb-3 pt-1">
        <MiniPitch
          myTeam={myTeam}
          yourFormation={yourFormation}
          pitchSlots={pitchSlots}
          pitchIdx={pitchIdx}
          selectedPositions={selectedPositions}
          selectedPlayerId={selectedPlayerId}
          slotCounts={slotCounts}
          onSelectSlot={selectSlot}
          avgOvr={avgOvr}
          collapsed={!pitchExpanded}
          onToggle={() => setPitchExpanded(prev => !prev)}
        />
      </div>
    </div>
  );
}
