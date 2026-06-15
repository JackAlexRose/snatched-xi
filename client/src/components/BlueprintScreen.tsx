"use client";

import { useState } from "react";
import { FORMATIONS } from "@/types";

export function BlueprintScreen({ onLock }: { onLock: (formation: string, teamName: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [locked, setLocked] = useState(false);

  const lock = () => {
    if (!selected || locked || !teamName.trim()) return;
    setLocked(true);
    onLock(selected, teamName.trim());
  };

  return (
    <div className="max-w-md mx-auto mt-12 px-6">
      <h2 className="text-lg font-bold font-display text-navy mb-1 text-center">Choose Your Formation</h2>
      <p className="text-slate-soft text-xs font-display text-center mb-6">Pick a shape and name your team</p>

      <div className="mb-6">
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Team name"
          maxLength={24}
          disabled={locked}
          className="w-full bg-white text-navy border border-[#E2E8F0] rounded-lg px-4 py-2.5 font-display text-sm placeholder:text-slate-soft focus:outline-none focus:border-mint disabled:opacity-40"
        />
      </div>

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
      <button onClick={lock} disabled={!selected || locked || !teamName.trim()}
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
