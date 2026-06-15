"use client";

import { useState, useCallback, useRef } from "react";
import { LobbyScreen } from "@/components/LobbyScreen";
import { BlueprintScreen } from "@/components/BlueprintScreen";
import { DraftScreen } from "@/components/DraftScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { SimTestScreen } from "@/components/SimTestScreen";
import { CommentaryFeed } from "@/components/CommentaryFeed";
import { TournamentTable } from "@/components/TournamentTable";
import { ServerMessage, FORMATIONS, FORMATION_SLOTS, DraftablePlayer, TournamentRow } from "@/types";

export default function Home() {
  const [phase, setPhase] = useState<"lobby" | "blueprint" | "draft" | "commentary" | "result" | "simTest">("lobby");
  const [devTaps, setDevTaps] = useState(0);
  const [devUnlocked, setDevUnlocked] = useState(false);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [yourFormation, setYourFormation] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<any[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);
  const [squad, setSquad] = useState<DraftablePlayer[]>([]);
  const [wheelClub, setWheelClub] = useState("");
  const [wheelSeason, setWheelSeason] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerMax, setTimerMax] = useState(30);
  const [timerLabel, setTimerLabel] = useState("");
  const [opponentMsg, setOpponentMsg] = useState("");
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [commentaryEvents, setCommentaryEvents] = useState<any[]>([]);
  const [pendingResult, setPendingResult] = useState<any>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<{ id: string; name: string; isBot: boolean }[]>([]);
  const [tournamentTable, setTournamentTable] = useState<TournamentRow[]>([]);
  const [tournamentMatch, setTournamentMatch] = useState<{ homeName: string; awayName: string; matchNumber: number; totalMatches: number } | null>(null);
  const commentaryRef = useRef(false);
  const pendingRef = useRef<any>(null);
  const quickSimRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const botRef = useRef<WebSocket | null>(null);
  const spinRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = () => {
    if (spinRef.current) { clearInterval(spinRef.current); spinRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const startCountdown = useCallback((seconds: number, label: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const end = Date.now() + seconds * 1000;
    setTimer(seconds); setTimerMax(seconds); setTimerLabel(label);
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setTimer(remaining);
      if (remaining <= 0) { if (timerRef.current) clearInterval(timerRef.current); }
    }, 100);
  }, []);

  const connect = useCallback((lid: string, pid: string, isBot?: boolean) => {
    setLobbyId(lid);
    if (!isBot) setPlayerId(pid);
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const botParam = isBot ? "&bot=1" : "";
    const ws = new WebSocket(`${proto}//snatched-xi.jackalexanderrose.workers.dev/lobby/${lid}/ws?player=${pid}${botParam}`);
    
    if (isBot) {
      botRef.current = ws;
    } else {
      wsRef.current = ws;
    }

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_lobby", playerName: isBot ? "Bot" : (pid === "p1" ? "Home" : "Away") }));
    };

    ws.onmessage = (e) => {
      const msg: ServerMessage = JSON.parse(e.data);
      
      if (isBot) {
        handleBotMessage(msg, ws);
        return;
      }
      
      switch (msg.type) {
        case "lobby_state":
          if (msg.players) setLobbyPlayers(msg.players);
          if (msg.phase === "BLUEPRINT") setPhase("blueprint");
          else if (msg.phase === "DRAFT") {
            setPhase("draft");
            if (msg.yourTeam) setMyTeam(msg.yourTeam);
            if (msg.currentRound) setCurrentRound(msg.currentRound);
          }
          break;
        case "blueprint_reveal":
          // Find your own formation + team name
          const you = msg.players.find(p => p.id === pid);
          setYourFormation(you?.formation || msg.yourFormation);
          setMyTeam((FORMATION_SLOTS[you?.formation || msg.yourFormation || FORMATIONS[0]] || []).map((s: string) => ({ slot: s, player: null })));
          setPhase("draft");
          break;
        case "wheel_spin_start":
          clearTimers();
          setSpinning(true); setSquad([]);
          setTimerLabel(`Round ${msg.round} — Wheel spinning...`);
          startSpinAnimation();
          break;
        case "wheel_spin_result":
          clearTimers();
          setSpinning(false);
          setWheelClub(msg.club); setWheelSeason(msg.season);
          setCurrentRound(msg.round);
          startCountdown(msg.thinkSeconds, `Squad reveal in ${msg.thinkSeconds}s...`);
          break;
        case "squad_board":
          clearTimers();
          setSquad(msg.players); setCurrentRound(msg.round);
          startCountdown(msg.timerSeconds, `Round ${msg.round} — ${msg.timerSeconds}s`);
          break;
        case "player_claimed":
          setClaimed(prev => new Set(prev).add(msg.claimedPlayer.id));
          if (msg.playerId === pid) {
            setMyTeam((prev: any[]) => {
              const copy = [...prev];
              const idx = msg.slotIndex;
              if (idx >= 0 && idx < copy.length && !copy[idx].player) {
                copy[idx] = { ...copy[idx], player: msg.claimedPlayer };
              }
              return copy;
            });
          } else {
            setOpponentMsg(`${msg.playerName} picked ${msg.claimedPlayer.name} (OVR ${msg.claimedPlayer.overall})`);
            setTimeout(() => setOpponentMsg(""), 3000);
          }
          break;
        case "draft_complete":
          setMyTeam(msg.yourTeam);
          setTimer(0); setTimerLabel("Tournament starting...");
          break;
        case "tournament_match":
          setTournamentMatch({ homeName: msg.homeName, awayName: msg.awayName, matchNumber: msg.matchNumber, totalMatches: msg.totalMatches });
          // Reset for next match
          setCommentaryEvents([]);
          setResult(null);
          pendingRef.current = null;
          commentaryRef.current = false;
          setPhase("commentary");  // show the match banner while waiting for script
          break;
        case "match_script":
          setCommentaryEvents(msg.events);
          commentaryRef.current = true;
          setPhase("commentary");
          break;
        case "match_result":
          if (commentaryRef.current) {
            pendingRef.current = msg;
          } else {
            setResult(msg);
          }
          break;
        case "tournament_table":
          setTournamentTable(msg.table);
          // After each match result + table, server will send next tournament_match
          break;
        case "tournament_complete":
          setTournamentTable(msg.table);
          setResult((prev: any) => prev); // keep last match result
          setPhase("result");
          break;
        case "error":
          setError(msg.message); break;
      }
    };

    ws.onclose = () => { if (!isBot) setError("Disconnected"); };
    ws.onerror = () => { if (!isBot) setError("Connection error"); };
  }, [startCountdown]);

  const handleBotMessage = (msg: ServerMessage, ws: WebSocket) => {
    switch (msg.type) {
      case "lobby_state":
        if (msg.phase === "BLUEPRINT") {
          const randFormation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];
          setTimeout(() => ws.send(JSON.stringify({ type: "submit_blueprint", formation: randFormation, teamName: "Bot" })), 1000);
        }
        break;
      case "squad_board":
        const delay = 2000 + Math.random() * 3000;
        setTimeout(() => {
          const available = msg.players.filter(p => !claimed.has(p.id));
          if (available.length > 0) {
            const pick = available[Math.floor(Math.random() * available.length)];
            ws.send(JSON.stringify({ type: "draft_pick", playerId: pick.id }));
          }
        }, delay);
        break;
    }
  };

  const sendMessage = useCallback((msg: object) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  const startQuickSim = useCallback(async () => {
    try {
      const res = await fetch("https://snatched-xi.jackalexanderrose.workers.dev/api/quick-sim", { method: "POST" });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setMyTeam(data.homeTeam);
      setResult({
        type: "match_result", score: data.result.score,
        stats: { possession: { home: data.result.possession, away: 100 - data.result.possession }, shotsOnTarget: data.result.shotsOnTarget, totalShots: data.result.totalShots },
        topPerformers: data.result.topPerformers, homeTeam: data.result.homeTeam, awayTeam: data.result.awayTeam,
        winner: data.result.winner, homeOvr: data.homeOvr, awayOvr: data.awayOvr,
      });
      setCommentaryEvents(data.matchScript);
      commentaryRef.current = true;
      setPhase("commentary");
    } catch (err: any) { setError(err.message); }
  }, []);

  const startSpinAnimation = () => {
    const clubs = ["Man United","Liverpool","Chelsea","Arsenal","Man City","Tottenham","Leicester","Everton","West Ham","Newcastle"];
    const seasons = ["2014-15","2015-16","2016-17","2017-18","2018-19","2019-20","2020-21","2021-22","2022-23"];
    let i = 0;
    spinRef.current = setInterval(() => {
      setWheelClub(clubs[i % clubs.length]);
      setWheelSeason(seasons[Math.floor(Math.random() * seasons.length)]);
      i++;
    }, 80);
  };

  const startEarly = () => {
    wsRef.current?.send(JSON.stringify({ type: "start_early" }));
  };

  // Commentary phase
  if (phase === "commentary") {
    return (
      <main className="min-h-screen bg-cream text-navy">
        <header className="sticky top-0 z-20 bg-cream/95 backdrop-blur-sm border-b border-[#E2E8F0] px-4 py-3 max-w-[480px] mx-auto flex justify-between items-center">
          <h1 className="font-bold text-lg text-navy font-display tracking-tight">
            Snatched XI
          </h1>
          <span className="bg-navy text-white text-[0.65rem] font-bold font-display px-2 py-0.5 rounded-md">LIVE</span>
        </header>
        {tournamentMatch && (
          <div className="text-center mt-3 text-slate-soft text-xs font-display">
            Match {tournamentMatch.matchNumber} of {tournamentMatch.totalMatches}
          </div>
        )}
        <CommentaryFeed
          events={commentaryEvents}
          homeLabel={
            result?.homeName || (
              playerId
                ? (playerId === "p1" ? `Your XI · ${result?.homeOvr ?? "?"} OVR (you)` : `Opponent · ${result?.homeOvr ?? "?"} OVR (them)`)
                : `Home · ${result?.homeOvr ?? "?"} OVR`
            )
          }
          awayLabel={
            result?.awayName || (
              playerId
                ? (playerId === "p2" ? `Your XI · ${result?.awayOvr ?? "?"} OVR (you)` : `Opponent · ${result?.awayOvr ?? "?"} OVR (them)`)
                : `Away · ${result?.awayOvr ?? "?"} OVR`
            )
          }
          onComplete={() => {
            commentaryRef.current = false;
            if (!result && (pendingRef.current || pendingResult)) {
              const res = pendingRef.current || pendingResult;
              if (res) setResult(res);
            }
            // For tournament: show result + table, wait for next match
            setPhase("result");
          }}
        />
      </main>
    );
  }

  // Draft phase uses its own shell
  if (phase === "draft") {
    return (
      <DraftScreen
        sendMessage={sendMessage}
        myTeam={myTeam}
        yourFormation={yourFormation!}
        playerId={playerId!}
        squad={squad}
        wheelClub={wheelClub} wheelSeason={wheelSeason} spinning={spinning}
        timer={timer} timerMax={timerMax} timerLabel={timerLabel}
        opponentMsg={opponentMsg} claimed={claimed}
        currentRound={currentRound}
      />
    );
  }

  return (
    <main className="min-h-screen bg-cream text-navy">
      <header className="sticky top-0 z-20 bg-cream/95 backdrop-blur-sm border-b border-[#E2E8F0] px-4 py-3 max-w-[480px] mx-auto flex justify-between items-center">
        <h1 className="font-bold text-lg text-navy font-display tracking-tight">
          Snatched XI{debug ? " [DEBUG]" : ""}
        </h1>
        <span
          onClick={() => {
            const next = devTaps + 1;
            setDevTaps(next);
            if (next >= 5 && !devUnlocked) { setDevUnlocked(true); setDevTaps(0); }
          }}
          className={`bg-navy text-white text-[0.65rem] font-bold font-display px-2 py-0.5 rounded-md select-none cursor-pointer transition-all ${
            devTaps >= 3 && !devUnlocked ? "ring-2 ring-coral/50 scale-105" : ""
          } ${devUnlocked ? "bg-navy/70" : ""}`}
          title={devUnlocked ? "dev unlocked" : undefined}
        >
          {phase === "lobby" ? "LOBBY" : phase === "blueprint" ? "SETUP" : phase === "simTest" ? "TEST" : "GAME OVER"}
        </span>
        {error && <span className="text-coral text-xs ml-2">{error}</span>}
      </header>

      {phase === "lobby" && <LobbyScreen onConnect={(lid, pid) => connect(lid, pid)} onDebug={() => {}} onSimTest={() => setPhase("simTest")} onQuickSim={startQuickSim} onStartEarly={startEarly} lobbyId={lobbyId} playerId={playerId || ""} lobbyPlayers={lobbyPlayers} devUnlocked={devUnlocked} />}
      {phase === "blueprint" && <BlueprintScreen onLock={(f, t) => sendMessage({ type: "submit_blueprint", formation: f, teamName: t })} />}
      {phase === "result" && result && (
        <>
          <ResultScreen result={result} playerId={playerId} myTeam={myTeam} />
          {tournamentTable.length > 0 && (
            <div className="max-w-md mx-auto px-6 pb-8">
              <TournamentTable table={tournamentTable} />
            </div>
          )}
        </>
      )}
      {phase === "simTest" && <SimTestScreen onBack={() => setPhase("lobby")} />}
    </main>
  );
}
