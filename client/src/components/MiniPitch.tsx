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
}) {
  return (
    <div className="w-full max-w-[360px] mx-auto">
      {/* Header */}
      <div className="text-center text-navy font-display text-xs mb-2">
        YOUR XI — {yourFormation}
        {avgOvr !== null && (
          <span className="text-coral ml-2 font-bold">{avgOvr} OVR</span>
        )}
      </div>

      {/* Pitch */}
      <div className="relative w-full aspect-[3/4] max-h-[440px] rounded-xl overflow-hidden border border-[#DCFCE7]"
        style={{ background: "linear-gradient(180deg, #F0FDF4 0%, #ECFDF5 50%, #F0FDF4 100%)" }}>
        
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
          const isValid = !filled && selectedPlayerId && selectedPositions.some(sp => canPlaySlot([sp], slotName));
          const isClickable = isValid || (!selectedPlayerId && !filled);

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
                  ? "bg-white border-2 border-mint shadow-sm"
                  : isValid
                    ? "bg-white border-2 border-dashed border-mint shadow-[0_0_10px_rgba(16,185,129,0.25)] animate-slot-bounce cursor-pointer"
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
                <PlayerAvatar name={item.player.name} size={36} />
              ) : (
                <span className={`font-display text-[0.55rem] font-bold ${isValid ? "text-mint" : "text-slate-soft"}`}>
                  {slotName}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
