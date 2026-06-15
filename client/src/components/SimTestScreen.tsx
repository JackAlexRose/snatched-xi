"use client";

import { useState, useEffect } from "react";
import { MiniPitch } from "./MiniPitch";

interface SimTestResult {
  homeFormation: string;
  awayFormation: string;
  homeTeam: { id: string; name: string; positions: string[]; overall: number; slot: string }[];
  awayTeam: { id: string; name: string; positions: string[]; overall: number; slot: string }[];
  homeOvr: number;
  awayOvr: number;
  results: {
    score: { home: number; away: number };
    possession: number;
    shotsOnTarget: { home: number; away: number };
    totalShots: { home: number; away: number };
    topPerformers: { playerName: string; rating: number; goals?: number; assists?: number }[];
    events: { minute: number; type: string; player: string; team: string; assist?: string }[];
  }[];
  summary: { homeWins: number; awayWins: number; draws: number; totalHomeGoals: number; totalAwayGoals: number };
}

export function SimTestScreen({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<SimTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("https://snatched-xi.jackalexanderrose.workers.dev/api/sim-test", {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setRuns(r => r + 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run on mount
  useEffect(() => { runTest(); }, []);

  const statCell = "px-2 py-1 text-right font-display text-xs";
  const statLabel = "px-2 py-1 text-left font-display text-xs text-slate-soft";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-slate-soft hover:text-navy font-display text-sm transition-colors cursor-pointer">
          ← Back
        </button>
        <h1 className="font-display font-bold text-lg text-navy">Simulation Tester</h1>
        <button
          onClick={runTest}
          disabled={loading}
          className="bg-mint text-white px-4 py-1.5 rounded-lg font-display text-sm font-bold cursor-pointer hover:bg-mint/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Simulating..." : "Re-roll"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm font-display text-red-600">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-12 text-slate-soft font-display">
          Drafting random teams and running 5 matches...
        </div>
      )}

      {data && (
        <>
          {/* Teams overview */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Home Team */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display font-bold text-navy text-sm">Home</span>
                <span className="font-display text-xs text-slate-soft">{data.homeFormation}</span>
              </div>
              <div className="text-2xl font-display font-bold text-navy mb-3">
                {data.homeOvr} <span className="text-xs text-slate-soft font-normal">OVR</span>
              </div>
              <div className="space-y-1">
                {data.homeTeam.map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-xs font-display">
                    <span className="w-8 text-right text-slate-soft">{p.slot}</span>
                    <span className="text-navy truncate">{p.name}</span>
                    <span className="ml-auto text-slate-soft">{p.overall}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Away Team */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display font-bold text-navy text-sm">Away</span>
                <span className="font-display text-xs text-slate-soft">{data.awayFormation}</span>
              </div>
              <div className="text-2xl font-display font-bold text-navy mb-3">
                {data.awayOvr} <span className="text-xs text-slate-soft font-normal">OVR</span>
              </div>
              <div className="space-y-1">
                {data.awayTeam.map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-xs font-display">
                    <span className="w-8 text-right text-slate-soft">{p.slot}</span>
                    <span className="text-navy truncate">{p.name}</span>
                    <span className="ml-auto text-slate-soft">{p.overall}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results table */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E2E8F0] font-display font-bold text-sm text-navy">
              Match Results
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-3 py-2 text-left font-display text-xs text-slate-soft">#</th>
                    <th className="px-3 py-2 text-center font-display text-xs text-slate-soft">Score</th>
                    <th className="px-3 py-2 text-center font-display text-xs text-slate-soft">Poss</th>
                    <th className="px-3 py-2 text-center font-display text-xs text-slate-soft">SoT</th>
                    <th className="px-3 py-2 text-center font-display text-xs text-slate-soft">Shots</th>
                    <th className="px-3 py-2 text-left font-display text-xs text-slate-soft">Events</th>
                    <th className="px-3 py-2 text-left font-display text-xs text-slate-soft">Top Performer</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r, i) => {
                    const top = r.topPerformers[0];
                    const winner = r.score.home > r.score.away ? "H" : r.score.away > r.score.home ? "A" : "D";
                    const winnerColor = winner === "H" ? "text-coral" : winner === "A" ? "text-mint" : "text-slate-soft";
                    return (
                      <tr key={i} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-3 py-2 font-display text-xs text-slate-soft">
                          <span className={winnerColor + " font-bold mr-1"}>{winner}</span>
                          {i + 1}
                        </td>
                        <td className="px-3 py-2 text-center font-display text-sm font-bold text-navy">
                          {r.score.home} – {r.score.away}
                        </td>
                        <td className="px-3 py-2 text-center font-display text-xs text-navy">
                          {r.possession}% – {100 - r.possession}%
                        </td>
                        <td className="px-3 py-2 text-center font-display text-xs text-navy">
                          {r.shotsOnTarget.home} – {r.shotsOnTarget.away}
                        </td>
                        <td className="px-3 py-2 text-center font-display text-xs text-navy">
                          {r.totalShots.home} – {r.totalShots.away}
                        </td>
                        <td className="px-3 py-2 font-display text-xs text-navy">
                          {r.events.map((e, j) => (
                            <div key={j} className="whitespace-nowrap">
                              <span className="text-slate-soft">{e.minute}&apos;</span>{" "}
                              <span className={e.team === "home" ? "text-coral" : "text-mint"}>
                                {e.player}
                              </span>
                              {e.assist && <span className="text-slate-soft"> (A: {e.assist})</span>}
                            </div>
                          ))}
                        </td>
                        <td className="px-3 py-2 font-display text-xs text-navy">
                          {top && (
                            <>
                              <span className="font-bold">{top.rating.toFixed(1)}</span>{" "}
                              {top.playerName}
                              {top.goals ? <span className="text-slate-soft"> ⚽{top.goals}</span> : ""}
                              {top.assists ? <span className="text-slate-soft"> 🅰{top.assists}</span> : ""}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary row */}
            <div className="border-t-2 border-navy/20 bg-[#F8FAFC]">
              <div className="flex items-center gap-6 px-4 py-3 font-display text-xs text-navy">
                <div>
                  <span className="text-slate-soft">Home </span>
                  <span className="font-bold">{data.summary.homeWins}W</span>
                  {" · "}
                  <span className="font-bold">{data.summary.totalHomeGoals}</span>
                  <span className="text-slate-soft"> GF</span>
                </div>
                <div className="text-slate-soft font-bold">{data.summary.draws}D</div>
                <div>
                  <span className="text-slate-soft">Away </span>
                  <span className="font-bold">{data.summary.awayWins}W</span>
                  {" · "}
                  <span className="font-bold">{data.summary.totalAwayGoals}</span>
                  <span className="text-slate-soft"> GF</span>
                </div>
                <div className="ml-auto text-slate-soft">
                  Run {runs > 0 ? `#${runs}` : ""}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
