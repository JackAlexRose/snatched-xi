"use client";

import { useState, useEffect, useRef } from "react";
import { FORMATION_SLOTS, PITCH_SLOTS, DraftablePlayer } from "@/types";
import { HeaderBar, WheelBanner } from "./HeaderBar";
import { CardCarousel } from "./CardCarousel";
import { MiniPitch } from "./MiniPitch";

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
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [pitchExpanded, setPitchExpanded] = useState(false);
  const slots = FORMATION_SLOTS[yourFormation] || [];
  const pitchSlots = PITCH_SLOTS[yourFormation] || {};

  const selectPlayer = (pid: string) => {
    if (claimed.has(pid)) return;
    if (pid === selectedPlayerId) {
      setSelectedPlayerId(null);
    } else {
      setSelectedPlayerId(pid);
      // Auto-expand pitch when selecting a player so they can see slot targets
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

  const prevSquadRef = useRef<string>("");

  // Reset carousel + selection when squad changes completely
  const squadId = squad.length > 0 ? squad.map(p => p.id).join(",").slice(0, 50) : "";
  useEffect(() => {
    if (squadId && squadId !== prevSquadRef.current) {
      prevSquadRef.current = squadId;
      setCarouselIndex(0);
      setSelectedPlayerId(null);
      setPitchExpanded(false);
    }
  }, [squadId]);

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Sticky Header */}
      <HeaderBar
        currentRound={currentRound}
        timer={timer}
        opponentMsg={opponentMsg}
      />

      {/* Timer progress bar */}
      <div className="h-1 bg-[#E2E8F0]">
        <div
          className={`h-full transition-all duration-1000 ${timer <= 3 ? "bg-coral" : "bg-mint"}`}
          style={{ width: `${timerMax > 0 ? (timer / timerMax) * 100 : 0}%` }}
        />
      </div>

      {/* Wheel Banner */}
      <WheelBanner club={wheelClub} season={wheelSeason} spinning={spinning} />

      {/* Timer label */}
      <div className="text-center text-slate-soft text-xs font-display py-2">
        {timerLabel}
      </div>

      {/* Main content area — clicking here collapses the pitch */}
      <div
        className="flex-1 flex flex-col justify-center"
        onClick={() => setPitchExpanded(false)}
      >
        <CardCarousel
          players={squad}
          centerIndex={carouselIndex}
          onNavigate={setCarouselIndex}
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={selectPlayer}
          claimed={claimed}
        />
      </div>

      {/* Pitch drawer — fixed at bottom */}
      <div className="sticky bottom-0 bg-cream/95 backdrop-blur-sm border-t border-[#E2E8F0] px-2 pb-3">
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
