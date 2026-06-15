"use client";

import { PlayerRating } from "@/types";
import { PlayerAvatar } from "./PlayerAvatar";

export function ResultScreen({ result, playerId, myTeam }: { result: any; playerId: string | null; myTeam: any[] }) {
  const isQuickSim = !playerId;
  const isHome = playerId === "p1";

  // Determine which stats belong to which side
  const showAsHome = isQuickSim ? true : isHome;
  const myScore = showAsHome ? result.score.home : result.score.away;
  const oppScore = showAsHome ? result.score.away : result.score.home;
  const myStats = showAsHome
    ? { poss: result.stats.possession.home, sot: result.stats.shotsOnTarget.home, shots: result.stats.totalShots.home }
    : { poss: result.stats.possession.away, sot: result.stats.shotsOnTarget.away, shots: result.stats.totalShots.away };
  const oppStats = showAsHome
    ? { poss: result.stats.possession.away, sot: result.stats.shotsOnTarget.away, shots: result.stats.totalShots.away }
    : { poss: result.stats.possession.home, sot: result.stats.shotsOnTarget.home, shots: result.stats.totalShots.home };
  const myTeamRatings: PlayerRating[] = (showAsHome ? result.homeTeam : result.awayTeam).slice(0, 5);
  const oppTeamRatings: PlayerRating[] = (showAsHome ? result.awayTeam : result.homeTeam).slice(0, 5);
  
  const myAvgOvr = showAsHome ? result.homeOvr : result.awayOvr;
  const oppAvgOvr = showAsHome ? result.awayOvr : result.homeOvr;

  // Result labels
  let resultColor: string;
  let resultText: string;
  if (isQuickSim) {
    if (result.winner === "draw") { resultColor = "text-slate-soft"; resultText = "Draw"; }
    else if (result.winner === "home") { resultColor = "text-coral"; resultText = "Home Wins"; }
    else { resultColor = "text-mint"; resultText = "Away Wins"; }
  } else {
    if (result.winner === "draw") { resultColor = "text-slate-soft"; resultText = "It's a Draw"; }
    else if (result.winner === playerId) { resultColor = "text-mint"; resultText = "You Win!"; }
    else { resultColor = "text-coral"; resultText = "You Lose"; }
  }

  const myLabel = isQuickSim
    ? `Home · ${myAvgOvr ?? "?"} OVR`
    : "Your Team";
  const oppLabel = isQuickSim
    ? `Away · ${oppAvgOvr ?? "?"} OVR`
    : "Opponent";
  const myDot = isQuickSim ? "bg-coral" : "bg-mint";
  const oppDot = isQuickSim ? "bg-mint" : "bg-coral";

  const PlayerRow = ({ p }: { p: PlayerRating }) => (
    <div className="flex justify-between items-center py-2.5 px-3 bg-white border border-[#E2E8F0] rounded-lg mb-1.5">
      <div className="flex items-center gap-2.5">
        <PlayerAvatar name={p.playerName} size={28} />
        <div>
          <span className="text-navy font-display font-bold text-sm">{p.playerName}</span>
          <span className="text-slate-soft text-xs ml-1.5">{p.positions?.slice(0, 2).join("/")}</span>
          {p.goals ? <span className="ml-1.5 text-xs">⚽{p.goals}</span> : null}
          {p.assists ? <span className="ml-1.5 text-xs">🅰{p.assists}</span> : null}
        </div>
      </div>
      <span className="text-navy font-display font-bold text-lg">{p.rating.toFixed(1)}</span>
    </div>
  );

  return (
    <div className="max-w-md mx-auto mt-8 px-6">
      <div className="text-center text-5xl font-display font-bold text-navy mb-1">
        {myScore} — {oppScore}
      </div>
      <div className={`text-center text-xl font-display font-bold mb-8 ${resultColor}`}>
        {resultText}
      </div>

      {/* My Team / Home */}
      <h3 className="font-display font-bold text-navy text-sm mb-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full inline-block ${myDot}`} />
        {myLabel}
        {!isQuickSim && myAvgOvr != null && <span className="text-coral font-bold ml-1">{myAvgOvr} OVR</span>}
      </h3>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatBox value={`${myStats.poss}%`} label="Possession" />
        <StatBox value={myStats.sot} label="On Target" />
        <StatBox value={myStats.shots} label="Shots" />
      </div>
      {myTeamRatings.map((p) => <PlayerRow key={p.playerId} p={p} />)}

      {/* Opponent / Away */}
      <h3 className="font-display font-bold text-navy text-sm mt-8 mb-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full inline-block ${oppDot}`} />
        {oppLabel}
        {!isQuickSim && oppAvgOvr != null && <span className="text-coral ml-1">{oppAvgOvr} OVR</span>}
      </h3>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatBox value={`${oppStats.poss}%`} label="Possession" />
        <StatBox value={oppStats.sot} label="On Target" />
        <StatBox value={oppStats.shots} label="Shots" />
      </div>
      {oppTeamRatings.map((p) => <PlayerRow key={p.playerId} p={p} />)}

      <button onClick={() => location.reload()} className="w-full mt-8 bg-navy text-white rounded-xl px-6 py-3 font-display font-bold cursor-pointer hover:bg-navy/90 transition-colors">
        Play Again
      </button>
    </div>
  );
}

function StatBox({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 text-center">
      <div className="text-xl font-display font-bold text-navy">{value}</div>
      <div className="text-slate-soft text-[0.6rem] font-display mt-0.5">{label}</div>
    </div>
  );
}
