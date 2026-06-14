"use client";

import { PlayerRating } from "@/types";
import { PlayerAvatar } from "./PlayerAvatar";

export function ResultScreen({ result, playerId, myTeam }: { result: any; playerId: string; myTeam: any[] }) {
  const isHome = playerId === "p1";
  const myScore = isHome ? result.score.home : result.score.away;
  const oppScore = isHome ? result.score.away : result.score.home;
  const myStats = isHome
    ? { poss: result.stats.possession.home, sot: result.stats.shotsOnTarget.home, shots: result.stats.totalShots.home }
    : { poss: result.stats.possession.away, sot: result.stats.shotsOnTarget.away, shots: result.stats.totalShots.away };
  const oppStats = isHome
    ? { poss: result.stats.possession.away, sot: result.stats.shotsOnTarget.away, shots: result.stats.totalShots.away }
    : { poss: result.stats.possession.home, sot: result.stats.shotsOnTarget.home, shots: result.stats.totalShots.home };
  const myTeamRatings: PlayerRating[] = (isHome ? result.homeTeam : result.awayTeam).slice(0, 5);
  const oppTeamRatings: PlayerRating[] = (isHome ? result.awayTeam : result.homeTeam).slice(0, 5);
  
  // Compute average OVR from myTeam (filled slots only)
  const filledSlots = myTeam.filter((s: any) => s.player);
  const myAvgOvr = filledSlots.length > 0
    ? Math.round(filledSlots.reduce((sum: number, s: any) => sum + s.player.overall, 0) / filledSlots.length)
    : null;

  const PlayerRow = ({ p }: { p: PlayerRating }) => (
    <div className="flex justify-between items-center py-2 px-3 bg-[#1a1a1a] border border-[#444] mb-1">
      <div className="flex items-center gap-2">
        <PlayerAvatar name={p.playerName} size={24} />
        <span>
          {p.playerName}
          <span className="text-[#888] text-xs ml-1">{p.positions?.slice(0, 2).join("/")}</span>
          {p.goals ? <span className="ml-1">⚽{p.goals}</span> : null}
          {p.assists ? <span className="ml-1">🅰{p.assists}</span> : null}
        </span>
      </div>
      <span className="text-[#f1c40f] font-bold">{p.rating}</span>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto mt-8 px-6">
      <div className="text-center text-4xl text-[#f1c40f] mb-2">
        {myScore} — {oppScore}
      </div>
      <div className="text-center text-xl mb-6 text-[#2ecc71]">
        {result.winner === "draw" ? "It's a Draw!" : result.winner === playerId ? "You Win!" : "You Lose"}
      </div>

      {/* Your Team */}
      <h3 className="text-[#2ecc71] font-bold mb-3">
        Your Team{myAvgOvr && <span className="text-[#f1c40f] ml-2 text-sm font-normal">{myAvgOvr} OVR</span>}
      </h3>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatBox value={`${myStats.poss}%`} label="Possession" />
        <StatBox value={myStats.sot} label="Shots on Target" />
        <StatBox value={myStats.shots} label="Total Shots" />
      </div>
      {myTeamRatings.map((p) => <PlayerRow key={p.playerId} p={p} />)}

      {/* Opponent */}
      <h3 className="text-[#e9393f] font-bold mt-8 mb-3">Opponent</h3>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatBox value={`${oppStats.poss}%`} label="Possession" />
        <StatBox value={oppStats.sot} label="Shots on Target" />
        <StatBox value={oppStats.shots} label="Total Shots" />
      </div>
      {oppTeamRatings.map((p) => <PlayerRow key={p.playerId} p={p} />)}

      <button onClick={() => location.reload()} className="w-full mt-8 bg-[#1a1a1a] text-[#c4c4c4] border border-[#444] px-6 py-3 cursor-pointer hover:border-[#e9393f]">
        Play Again
      </button>
    </div>
  );
}

function StatBox({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#444] p-3 text-center">
      <div className="text-xl text-[#e9393f]">{value}</div>
      <div className="text-[#888] text-[0.6rem] mt-1">{label}</div>
    </div>
  );
}
