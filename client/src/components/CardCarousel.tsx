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
  const [justSnapped, setJustSnapped] = useState<number | null>(null);
  const snapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track which card is centered via scroll position
  // Use hardcoded card dimensions — DOM-measured width varies with scale transforms
  const CARD_WIDTH = 140; // w-[140px]
  const GAP = 8;          // gap-2
  const SNAP_WIDTH = CARD_WIDTH + GAP; // 148px center-to-center

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || players.length === 0) return;

    const idx = Math.round(el.scrollLeft / SNAP_WIDTH);
    const clamped = Math.max(0, Math.min(players.length - 1, idx));

    if (clamped !== activeIndex) {
      setActiveIndex(clamped);
      // Trigger a squash-stretch burst on the newly-active card
      setJustSnapped(clamped);
      if (snapTimeout.current !== null) clearTimeout(snapTimeout.current);
      snapTimeout.current = setTimeout(() => setJustSnapped(null), 450);
    }
  }, [players.length, activeIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Scroll to start when squad changes
  useEffect(() => {
    if (scrollRef.current && players.length > 0) {
      scrollRef.current.scrollLeft = 0;
      setActiveIndex(0);
      setJustSnapped(0);
      if (snapTimeout.current !== null) clearTimeout(snapTimeout.current);
      snapTimeout.current = setTimeout(() => setJustSnapped(null), 450);
    }
  }, [players.map(p => p.id).join(",").slice(0, 50)]);

  if (players.length === 0) {
    return (
      <div className="w-full flex items-center justify-center h-40 text-slate-soft text-sm font-display">
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
          const isSnapping = justSnapped === i;
          const isSelected = selectedPlayerId === player.id;

          return (
            <div
              key={player.id}
              data-index={i}
              className="flex-shrink-0 snap-center"
              style={{
                transition: "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out",
                transform: isSnapping
                  ? "scale(1)" // animation applies squash-stretch via keyframe class
                  : isActive
                    ? "scale(1)"
                    : "scale(0.88)",
                opacity: isActive ? 1 : 0.55,
                animation: isSnapping ? "card-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" : "none",
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
