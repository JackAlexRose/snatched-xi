"use client";

import { useRef } from "react";
import { DraftablePlayer } from "@/types";
import { PlayerCard } from "./PlayerCard";

function wrapIndex(i: number, len: number): number {
  return ((i % len) + len) % len;
}

export function CardCarousel({
  players,
  centerIndex,
  onNavigate,
  selectedPlayerId,
  onSelectPlayer,
  claimed,
}: {
  players: DraftablePlayer[];
  centerIndex: number;
  onNavigate: (i: number) => void;
  selectedPlayerId: string | null;
  onSelectPlayer: (pid: string) => void;
  claimed: Set<string>;
}) {
  const touchStartX = useRef<number | null>(null);

  if (players.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-soft text-sm font-display">
        Loading squad...
      </div>
    );
  }

  const len = players.length;
  const leftIdx = wrapIndex(centerIndex - 1, len);
  const rightIdx = wrapIndex(centerIndex + 1, len);

  const left = players[leftIdx];
  const center = players[centerIndex];
  const right = players[rightIdx];

  const handleCardClick = (player: DraftablePlayer, position: "left" | "center" | "right") => {
    if (position === "center") {
      onSelectPlayer(player.id);
    } else {
      const idx = position === "left" ? leftIdx : rightIdx;
      onNavigate(idx);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;

    const SWIPE_THRESHOLD = 50;
    if (Math.abs(diff) < SWIPE_THRESHOLD) return;

    if (diff > 0) {
      // Swiped left → next card (rightwards navigation)
      onNavigate(rightIdx);
    } else {
      // Swiped right → previous card (leftwards navigation)
      onNavigate(leftIdx);
    }
  };

  return (
    <div className="perspective-container flex items-center justify-center gap-2 py-4 px-2 select-none">
      {/* Left arrow — hidden on touch devices */}
      <button
        onClick={() => onNavigate(leftIdx)}
        className="hidden sm:flex flex-shrink-0 w-8 h-8 rounded-full bg-white border border-[#E2E8F0] items-center justify-center text-navy hover:bg-[#F1F5F9] transition-colors font-display text-sm"
        aria-label="Previous player"
      >
        ‹
      </button>

      {/* Cards row — swipeable */}
      <div
        className="flex items-center gap-1 overflow-visible touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Left card (faded, smaller) */}
        <div
          onClick={() => handleCardClick(left, "left")}
          className="cursor-pointer transition-all duration-300"
          style={{ transform: "rotateY(12deg) scale(0.85)" }}
        >
          <PlayerCard
            player={left}
            isSelected={false}
            isClaimed={claimed.has(left.id)}
            onClick={() => {}}
            faded
          />
        </div>

        {/* Center card (active, scaled up) */}
        <div
          onClick={() => handleCardClick(center, "center")}
          className="z-10 transition-all duration-300"
          style={{ transform: "scale(1.15)" }}
        >
          <PlayerCard
            player={center}
            isSelected={selectedPlayerId === center.id}
            isClaimed={claimed.has(center.id)}
            onClick={() => {}}
          />
        </div>

        {/* Right card (faded, smaller) */}
        <div
          onClick={() => handleCardClick(right, "right")}
          className="cursor-pointer transition-all duration-300"
          style={{ transform: "rotateY(-12deg) scale(0.85)" }}
        >
          <PlayerCard
            player={right}
            isSelected={false}
            isClaimed={claimed.has(right.id)}
            onClick={() => {}}
            faded
          />
        </div>
      </div>

      {/* Right arrow — hidden on touch devices */}
      <button
        onClick={() => onNavigate(rightIdx)}
        className="hidden sm:flex flex-shrink-0 w-8 h-8 rounded-full bg-white border border-[#E2E8F0] items-center justify-center text-navy hover:bg-[#F1F5F9] transition-colors font-display text-sm"
        aria-label="Next player"
      >
        ›
      </button>
    </div>
  );
}
