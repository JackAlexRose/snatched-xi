"use client";

import { useRef, useEffect, useState } from "react";
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
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Use IntersectionObserver to detect which card is centered
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || players.length === 0) return;

    // Clean up previous observer
    if (observerRef.current) observerRef.current.disconnect();

    let bestIdx = 0;
    let bestRatio = 0;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Update best ratios
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIdx = idx;
          }
        }
        setActiveIndex(bestIdx);
      },
      {
        root: el,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    // Observe all cards
    const cards = el.querySelectorAll("[data-index]");
    cards.forEach((card) => observerRef.current!.observe(card));

    return () => observerRef.current?.disconnect();
  }, [players.map(p => p.id).join(",").slice(0, 50)]);

  // Scroll to start when squad changes
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
      <div className="text-center text-slate-soft text-[0.6rem] font-display mb-1 select-none">
        ← swipe to browse {players.length} players →
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar px-[calc(50%-70px)]"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {players.map((player, i) => {
          const isActive = i === activeIndex;
          const isSelected = selectedPlayerId === player.id;

          return (
            <div
              key={player.id}
              data-index={i}
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
