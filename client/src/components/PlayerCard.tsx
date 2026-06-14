"use client";

import { DraftablePlayer } from "@/types";
import { PlayerAvatar } from "./PlayerAvatar";

const STAT_LABELS: [string, keyof DraftablePlayer][] = [
  ["PAC", "pace"],
  ["SHO", "shooting"],
  ["PAS", "passing"],
  ["DRI", "dribbling"],
  ["DEF", "defending"],
  ["PHY", "physicality"],
];

export function PlayerCard({
  player,
  isSelected,
  isClaimed,
  onClick,
  scale = 1,
  faded = false,
}: {
  player: DraftablePlayer;
  isSelected: boolean;
  isClaimed: boolean;
  onClick: () => void;
  scale?: number;
  faded?: boolean;
}) {
  const borderColor = isSelected
    ? "border-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.3)]"
    : isClaimed
      ? "border-[#CBD5E1] opacity-40"
      : "border-[#E2E8F0] hover:border-[#94A3B8]";

  const cursor = isClaimed ? "cursor-not-allowed" : "cursor-pointer";

  return (
    <div
      onClick={isClaimed ? undefined : onClick}
      className={`
        flex-shrink-0 w-[140px] min-h-[240px] rounded-2xl border-2 ${borderColor} ${cursor}
        bg-gradient-to-b from-[#FEFCE8] to-[#FFFBEB]
        transition-all duration-300 flex flex-col
        ${faded ? "opacity-50" : "opacity-100"}
      `}
      style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
    >
      {/* Top section: Avatar + OVR badge */}
      <div className="flex flex-col items-center pt-6 pb-3 relative">
        <PlayerAvatar name={player.name} size={56} />
        <div className="absolute top-4 right-3 bg-navy text-white text-[0.7rem] font-bold rounded-lg px-2 py-0.5 font-display">
          {player.overall}
        </div>
      </div>

      {/* Middle: Name + Position */}
      <div className="px-3 text-center flex-1">
        <div className="font-display font-bold text-[0.75rem] text-navy leading-tight truncate">
          {isClaimed ? "TAKEN" : player.name}
        </div>
        <div className="text-slate-soft text-[0.6rem] font-display mt-0.5 mb-3">
          {player.positions.slice(0, 2).join(" / ")}
        </div>

        {/* 2x3 stats grid */}
        <div className="grid grid-cols-3 gap-x-1 gap-y-1.5">
          {STAT_LABELS.map(([label, key]) => (
            <div key={label} className="text-center">
              <div className="text-[0.55rem] text-slate-soft font-display leading-none mb-0.5">
                {label}
              </div>
              <div className="text-[0.75rem] font-bold text-navy font-display leading-tight">
                {player[key] ?? "?"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom spacer for card feel */}
      <div className="h-3" />
    </div>
  );
}
