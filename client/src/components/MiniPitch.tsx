"use client";

import { PlayerAvatar } from "./PlayerAvatar";

interface SlotData {
  slot: string;
  player: any;
}

export function MiniPitch({
  myTeam,
  yourFormation,
  pitchSlots,
  pitchIdx,
  selectedPositions,
  selectedPlayerId,
  slotCounts,
  onSelectSlot,
  avgOvr,
  collapsed,
  onToggle,
}: {
  myTeam: any[];
  yourFormation: string;
  pitchSlots: Record<string, { x: number; y: number }>;
  pitchIdx: Record<string, { item: SlotData; index: number }>;
  selectedPositions: string[];
  selectedPlayerId: string | null;
  slotCounts: Record<string, number>;
  onSelectSlot: (slotIndex: number) => void;
  avgOvr: number | null;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const filledCount = myTeam.filter((s: any) => s.player).length;

  return (
    <div className="w-full max-w-[360px] mx-auto">
      {/* Drawer handle — always visible, tap to toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="w-full flex items-center justify-center gap-2 py-2 text-navy font-display text-xs font-bold cursor-pointer hover:bg-[#E2E8F0]/30 rounded-t-xl transition-colors select-none"
      >
        <span>YOUR XI — {yourFormation}</span>
        {avgOvr !== null && (
          <span className="text-coral font-bold">{avgOvr} OVR</span>
        )}
        <span className="text-slate-soft ml-1">{filledCount}/11</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12"
          className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
        >
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {/* Pitch — only visible when expanded */}
      <div
        className={`relative w-full rounded-xl overflow-hidden border border-[#DCFCE7] transition-all duration-300 ease-out ${
          collapsed ? "h-0 border-transparent opacity-0" : "aspect-[3/4] max-h-[42dvh] opacity-100"
        }`}
        style={{ background: collapsed ? "transparent" : "linear-gradient(180deg, #F0FDF4 0%, #ECFDF5 50%, #F0FDF4 100%)" }}
      >
        {/* Field markings */}
        <div className="absolute top-1/2 left-[5%] right-[5%] border-t border-[#DCFCE7] pointer-events-none" />
        <div className="absolute top-[5%] bottom-[5%] left-1/2 border-l border-[#DCFCE7] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-[#DCFCE7] rounded-full pointer-events-none" />
        <div className="absolute top-[5%] left-[15%] right-[15%] h-[18%] border border-t-0 border-[#DCFCE7] rounded-b-lg pointer-events-none" />
        <div className="absolute bottom-[5%] left-[15%] right-[15%] h-[18%] border border-b-0 border-[#DCFCE7] rounded-t-lg pointer-events-none" />

        {/* Slot nodes */}
        {Object.entries(pitchSlots).map(([key, pos]) => {
          const entry = pitchIdx[key];
          const item = entry?.item;
          const filled = item?.player;
          const slotName = item?.slot || key;
          const slotIndex = entry?.index ?? -1;

          // Draft mode: is this slot a valid target for the selected player?
          const isValid = !filled && selectedPlayerId && selectedPositions.some(sp => canPlaySlot([sp], slotName));
          // Is it the player's natural position? (no penalty)
          const isNatural = !filled && selectedPlayerId && selectedPositions.some(sp =>
            sp.toUpperCase() === slotName.toUpperCase()
          );
          // Playable but out of position — will incur 15% penalty
          const isOffPosition = isValid && !isNatural;

          const isClickable = isValid || (!selectedPlayerId && !filled);

          // After draft: check if filled player is out of position
          const filledOffPosition = filled && item.player.positions && !isNaturalPosition(
            item.player.positions, slotName
          );

          return (
            <div
              key={key}
              onClick={() => {
                if (isValid) onSelectSlot(slotIndex);
              }}
              className={`
                absolute w-11 h-11 rounded-full flex items-center justify-center
                transition-all duration-200
                ${filled
                  ? filledOffPosition
                    ? "bg-white border-2 border-amber-400 shadow-sm"
                    : "bg-white border-2 border-mint shadow-sm"
                  : isValid
                    ? isOffPosition
                      ? "bg-white border-2 border-dashed border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.25)] animate-slot-bounce cursor-pointer"
                      : "bg-white border-2 border-dashed border-mint shadow-[0_0_10px_rgba(16,185,129,0.25)] animate-slot-bounce cursor-pointer"
                    : isClickable
                      ? "bg-white/70 border border-[#DCFCE7] cursor-pointer hover:border-slate-soft"
                      : "bg-[#E2E8F0]/50 border border-[#CBD5E1] cursor-not-allowed"
                }
              `}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {filled ? (
                <>
                  <PlayerAvatar name={item.player.name} size={36} />
                  {filledOffPosition && (
                    <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center shadow-sm"
                      title={`Out of position: ${slotName} not in [${item.player.positions.join(", ")}]`}
                    >
                      <span className="text-white text-[0.45rem] font-bold leading-none">!</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <span className={`font-display text-[0.55rem] font-bold ${
                    isOffPosition ? "text-amber-500" : isValid ? "text-mint" : "text-slate-soft"
                  }`}>
                    {slotName}
                  </span>
                  {isOffPosition && (
                    <span className="text-amber-400 text-[0.4rem] font-bold leading-none mt-0.5">-15%</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Permissive check: can this player play in this slot at all?
function canPlaySlot(playerPositions: string[], slot: string): boolean {
  const sp = playerPositions.map(p => p.toUpperCase());
  const sl = slot.toUpperCase();
  if (sl === "GK") return sp.includes("GK");
  if (sl === "CB") return sp.some(p => ["CB"].includes(p));
  if (["LB", "LWB"].includes(sl)) return sp.some(p => ["LB", "LWB"].includes(p));
  if (["RB", "RWB"].includes(sl)) return sp.some(p => ["RB", "RWB"].includes(p));
  if (sl === "CDM") return sp.some(p => ["CDM", "CM"].includes(p));
  if (sl === "CM") return sp.some(p => ["CM", "CDM", "CAM"].includes(p));
  if (sl === "CAM") return sp.some(p => ["CAM", "CM", "CF"].includes(p));
  if (["LM", "RM"].includes(sl)) return sp.some(p => ["LM", "RM", "LW", "RW", "CM"].includes(p));
  if (["LW", "RW"].includes(sl)) return sp.some(p => ["LW", "RW", "LM", "RM", "ST", "CF"].includes(p));
  if (sl === "ST") return sp.some(p => ["ST", "CF", "LW", "RW"].includes(p));
  return sp.includes(sl);
}

// Strict check: is the slot literally in the player's positions list?
// This matches the simulation engine's positionFitPenalty() logic.
function isNaturalPosition(playerPositions: string[], slot: string): boolean {
  return playerPositions.some(p => p.trim().toUpperCase() === slot.toUpperCase());
}
