"use client";

import { PlayerRating } from "@/types";
import { PlayerAvatar } from "./PlayerAvatar";

export function ResultScreen({ result, playerId, myTeam, seasonScore, matchNumber, totalMatches, myTeamName, oppTeamName, isSeasonFinal }: {
  result: any;
  playerId: string | null;
  myTeam: any[];
  seasonScore?: { p1: number; p2: number } | null;
  matchNumber?: number;
  totalMatches?: number;
  myTeamName?: string;
  oppTeamName?: string;
  isSeasonFinal?: boolean;
}) {
  const isQuickSim = !playerId;
  const isHome = playerId === "p1";
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

  // Labels
  const myLabel = myTeamName || (isQuickSim ? `Home · ${myAvgOvr ?? "?"} OVR` : "Your Team");
  const oppLabel = oppTeamName || (isQuickSim ? `Away · ${oppAvgOvr ?? "?"} OVR` : "Opponent");
  const myDot = isQuickSim ? "bg-coral" : "bg-mint";
  const oppDot = isQuickSim ? "bg-mint" : "bg-coral";

  // Result text
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

  // Season final banner
  if (isSeasonFinal && seasonScore) {
    const p1Won = seasonScore.p1 > seasonScore.p2;
    const isDraw = seasonScore.p1 === seasonScore.p2;
    const youWon = playerId === "p1" ? p1Won : !p1Won;
    const seasonColor = isDraw ? "text-slate-soft" : youWon ? "text-mint" : "text-coral";
    const seasonText = isDraw ? "Season Drawn" : youWon ? "You Won the Season!" : "You Lost the Season";

    return (
      <div className="max-w-md mx-auto mt-8 px-6 text-center">
        <div className="text-6xl font-display font-bold mb-4">{seasonScore.p1} – {seasonScore.p2}</div>
        <div className={`text-2xl font-display font-bold mb-8 ${seasonColor}`}>{seasonText}</div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 mb-8 shadow-sm">
          <div className="text-slate-soft text-xs font-display mb-3">Season Results</div>
          <div className="flex items-center justify-center gap-6 font-display text-sm text-navy">
            <div>
              <span className="font-bold">{myTeamName || (playerId === "p1" ? "Home" : "Away")}</span>
              <div className="text-lg font-bold mt-1">{seasonScore.p1}</div>
            </div>
            <span className="text-slate-soft">–</span>
            <div>
              <span className="font-bold">{oppTeamName || (playerId === "p1" ? "Away" : "Home")}</span>
              <div className="text-lg font-bold mt-1">{seasonScore.p2}</div>
            </div>
          </div>
        </div>

        <button onClick={() => location.reload()} className="w-full bg-navy text-white rounded-xl px-6 py-3 font-display font-bold cursor-pointer hover:bg-navy/90 transition-colors">
          Play Again
        </button>
      </div>
    );
  }

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
        {matchNumber && totalMatches && (
          <span className="text-slate-soft text-xs font-normal ml-2">(Match {matchNumber} of {totalMatches})</span>
        )}
      </div>

      {/* Season score (running) */}
      {seasonScore && !isSeasonFinal && (
        <div className="text-center mb-6 pb-4 border-b border-[#E2E8F0]">
          <div className="text-slate-soft text-xs font-display mb-1">Season</div>
          <div className="inline-flex items-center gap-3 font-display font-bold text-lg text-navy">
            <span className={seasonScore.p1 > seasonScore.p2 ? "text-mint" : seasonScore.p1 === seasonScore.p2 ? "text-slate-soft" : "text-coral"}>
              {seasonScore.p1}
            </span>
            <span className="text-slate-soft text-sm">–</span>
            <span className={seasonScore.p2 > seasonScore.p1 ? "text-mint" : seasonScore.p2 === seasonScore.p1 ? "text-slate-soft" : "text-coral"}>
              {seasonScore.p2}
            </span>
          </div>
        </div>
      )}

      {/* My Team / Home */}
      <h3 className="font-display font-bold text-navy text-sm mb-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full inline-block ${myDot}`} />
        {myLabel}
        {!myTeamName && myAvgOvr != null && <span className="text-coral font-bold ml-1">{myAvgOvr} OVR</span>}
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
        {!oppTeamName && oppAvgOvr != null && <span className="text-coral ml-1">{oppAvgOvr} OVR</span>}
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
