"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { DraftablePlayer } from "@/types";
import { PlayerCard } from "./PlayerCard";

export function CardCarousel({
  players,
  onSelectPlayer,
  selectedPlayerId,
  claimed,
}: {
  players: DraftablePlayer[];
  onSelectPlayer: (pid: string) => void;
  selectedPlayerId: string | null;
  claimed: Set<string>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Track which card is centered via scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || players.length === 0) return;

    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 140;
    const gap = 8;
    const snapWidth = cardWidth + gap;
    const center = el.scrollLeft + el.clientWidth / 2;
    const idx = Math.round(center / snapWidth);
    const clamped = Math.max(0, Math.min(players.length - 1, idx));
    setActiveIndex(clamped);
  }, [players.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    // Initial calculation
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Auto-scroll to index 0 when players change
  useEffect(() => {
    if (scrollRef.current && players.length > 0) {
      scrollRef.current.scrollLeft = 0;
      setActiveIndex(0);
    }
  }, [players.map(p => p.id).join(",").slice(0, 50)]);

  if (players.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-soft text-sm font-display">
        Loading squad...
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      {/* Swipe hint */}
      <div className="text-center text-slate-soft text-[0.6rem] font-display mb-1 select-none">
        ← swipe to browse {players.length} players →
      </div>

      {/* Scroll-snap carousel */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar px-[calc(50%-80px)]"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {players.map((player, i) => {
          const isActive = i === activeIndex;
          const isSelected = selectedPlayerId === player.id;

          return (
            <div
              key={player.id}
              className="flex-shrink-0 snap-center transition-all duration-300"
              style={{
                transform: isActive ? "scale(1)" : "scale(0.88)",
                opacity: isActive ? 1 : 0.55,
              }}
            >
              <PlayerCard
                player={player}
                isSelected={isSelected}
                isClaimed={claimed.has(player.id)}
                onClick={() => onSelectPlayer(player.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
