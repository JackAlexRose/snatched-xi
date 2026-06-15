"use client";

import { TournamentRow } from "@/types";

export function TournamentTable({ table }: { table: TournamentRow[] }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
      <h3 className="font-display font-bold text-sm text-navy px-4 py-2.5 border-b border-[#E2E8F0]">Tournament Table</h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <th className="px-2 py-1.5 text-left font-display text-[0.6rem] text-slate-soft w-6">#</th>
            <th className="px-2 py-1.5 text-left font-display text-[0.6rem] text-slate-soft">Team</th>
            <th className="px-1 py-1.5 text-center font-display text-[0.6rem] text-slate-soft w-6">P</th>
            <th className="px-1 py-1.5 text-center font-display text-[0.6rem] text-slate-soft w-6">W</th>
            <th className="px-1 py-1.5 text-center font-display text-[0.6rem] text-slate-soft w-6">D</th>
            <th className="px-1 py-1.5 text-center font-display text-[0.6rem] text-slate-soft w-6">L</th>
            <th className="px-1 py-1.5 text-center font-display text-[0.6rem] text-slate-soft w-8">GF</th>
            <th className="px-1 py-1.5 text-center font-display text-[0.6rem] text-slate-soft w-8">GA</th>
            <th className="px-2 py-1.5 text-center font-display text-[0.6rem] text-slate-soft w-8">Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => (
            <tr key={row.playerId} className={`border-b border-[#E2E8F0] last:border-0 ${i === 0 ? "bg-mint/5" : ""}`}>
              <td className="px-2 py-2 font-display text-xs text-slate-soft">{i + 1}</td>
              <td className="px-2 py-2 font-display text-xs text-navy font-bold">{row.teamName}</td>
              <td className="px-1 py-2 text-center font-display text-xs text-navy">{row.played}</td>
              <td className="px-1 py-2 text-center font-display text-xs text-navy">{row.won}</td>
              <td className="px-1 py-2 text-center font-display text-xs text-navy">{row.drawn}</td>
              <td className="px-1 py-2 text-center font-display text-xs text-navy">{row.lost}</td>
              <td className="px-1 py-2 text-center font-display text-xs text-navy">{row.goalsFor}</td>
              <td className="px-1 py-2 text-center font-display text-xs text-navy">{row.goalsAgainst}</td>
              <td className="px-2 py-2 text-center font-display text-xs font-bold text-navy">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
