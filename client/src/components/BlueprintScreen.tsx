"use client";

import { useState } from "react";
import { FORMATIONS } from "@/types";

export function BlueprintScreen({ onLock }: { onLock: (f: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const lock = () => {
    if (!selected || locked) return;
    setLocked(true);
    onLock(selected);
  };

  return (
    <div className="max-w-md mx-auto mt-16 px-6">
      <h2 className="text-lg font-bold font-display text-navy mb-8 text-center">Choose Your Formation</h2>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {FORMATIONS.map((f) => (
          <button key={f} onClick={() => !locked && setSelected(f)}
            disabled={locked}
            className={`px-3 py-4 text-sm text-center rounded-xl border-2 font-display font-bold cursor-pointer transition-all
              ${selected === f
                ? "bg-navy text-white border-navy shadow-md"
                : "bg-white text-navy border-[#E2E8F0] hover:border-slate-soft"}
              ${locked ? "opacity-40 cursor-not-allowed" : ""}`}>
            {f}
          </button>
        ))}
      </div>
      <button onClick={lock} disabled={!selected || locked}
        className="w-full bg-mint text-white px-6 py-3 rounded-xl font-display font-bold cursor-pointer hover:bg-mint/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
        Lock In
      </button>
      {locked && (
        <div className="text-mint text-center mt-4 font-display text-sm flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse inline-block" />
          Waiting for opponent...
        </div>
      )}
    </div>
  );
}
