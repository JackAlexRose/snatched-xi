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
    <div className="max-w-lg mx-auto mt-16 px-6">
      <h2 className="text-lg mb-6 text-center">Choose Your Formation</h2>
      <div className="grid grid-cols-4 gap-3 mb-8">
        {FORMATIONS.map((f) => (
          <button key={f} onClick={() => !locked && setSelected(f)}
            disabled={locked}
            className={`px-3 py-3 text-sm text-center border cursor-pointer transition-colors
              ${selected === f ? "bg-[#e9393f] text-white border-[#e9393f]" : "bg-[#1a1a1a] text-[#c4c4c4] border-[#444] hover:border-[#e9393f]"}
              ${locked ? "opacity-30 cursor-not-allowed" : ""}`}>
            {f}
          </button>
        ))}
      </div>
      <button onClick={lock} disabled={!selected || locked}
        className="w-full bg-[#e9393f] text-white px-6 py-3 cursor-pointer hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed">
        Lock In
      </button>
      {locked && <div className="text-[#2ecc71] text-center mt-4">Formation locked — waiting for opponent...</div>}
    </div>
  );
}
