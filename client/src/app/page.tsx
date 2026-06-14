"use client";

import { useState, useCallback, useRef } from "react";
import { LobbyScreen } from "@/components/LobbyScreen";
import { BlueprintScreen } from "@/components/BlueprintScreen";
import { DraftScreen } from "@/components/DraftScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { ServerMessage, FORMATIONS, FORMATION_SLOTS, DraftablePlayer } from "@/types";

export default function Home() {
  const [phase, setPhase] = useState<"lobby" | "blueprint" | "draft" | "result">("lobby");
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [yourFormation, setYourFormation] = useState<string | null>(null);
  const [opponentFormation, setOpponentFormation] = useState<string | null>(null);
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
    const ws = new WebSocket(`${proto}//snatched-xi.jackalexanderrose.workers.dev/lobby/${lid}/ws?player=${pid}`);
    
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
          if (msg.phase === "BLUEPRINT") setPhase("blueprint");
          else if (msg.phase === "DRAFT") {
            setPhase("draft");
            if (msg.yourTeam) setMyTeam(msg.yourTeam);
            if (msg.currentRound) setCurrentRound(msg.currentRound);
          }
          break;
        case "blueprint_reveal":
          setYourFormation(msg.yourFormation);
          setOpponentFormation(msg.opponentFormation);
          setMyTeam((FORMATION_SLOTS[msg.yourFormation] || []).map((s: string) => ({ slot: s, player: null })));
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
              const idx = copy.findIndex((sl: any) =>
                sl.slot === msg.claimedPlayer.slot && !sl.player
              );
              if (idx !== -1) copy[idx] = { ...copy[idx], player: msg.claimedPlayer };
              return copy;
            });
          } else {
            setOpponentMsg(`Opponent picked ${msg.claimedPlayer.name} (OVR ${msg.claimedPlayer.overall})`);
            setTimeout(() => setOpponentMsg(""), 3000);
          }
          break;
        case "draft_complete":
          setMyTeam(msg.yourTeam);
          setTimer(0); setTimerLabel("Simulating match...");
          break;
        case "match_result":
          setResult(msg); setPhase("result");
          break;
        case "error":
          setError(msg.message); break;
      }
    };

    ws.onclose = () => { if (!isBot) setError("Disconnected"); };
    ws.onerror = () => { if (!isBot) setError("Connection error"); };
  }, [startCountdown]);

  // Bot auto-responds to game messages
  const handleBotMessage = (msg: ServerMessage, ws: WebSocket) => {
    switch (msg.type) {
      case "lobby_state":
        if (msg.phase === "BLUEPRINT") {
          const randFormation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];
          setTimeout(() => ws.send(JSON.stringify({ type: "submit_blueprint", formation: randFormation })), 1000);
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

  const startDebugGame = useCallback(async () => {
    setDebug(true);
    const res = await fetch("https://snatched-xi.jackalexanderrose.workers.dev/api/lobby/create", { method: "POST" });
    const data = await res.json();
    connect(data.lobbyId, "p1");
    setTimeout(() => connect(data.lobbyId, "p2", true), 500);
  }, [connect]);

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

  // Draft phase uses its own internal header — other phases use a minimal shell
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
        <span className="bg-navy text-white text-[0.65rem] font-bold font-display px-2 py-0.5 rounded-md">
          {phase === "lobby" ? "LOBBY" : phase === "blueprint" ? "SETUP" : "GAME OVER"}
        </span>
        {error && <span className="text-coral text-xs ml-2">{error}</span>}
      </header>

      {phase === "lobby" && <LobbyScreen onConnect={(lid, pid) => connect(lid, pid)} onDebug={startDebugGame} lobbyId={lobbyId} playerId={playerId || ""} />}
      {phase === "blueprint" && <BlueprintScreen onLock={(f: string) => sendMessage({ type: "submit_blueprint", formation: f })} />}
      {phase === "result" && result && <ResultScreen result={result} playerId={playerId!} myTeam={myTeam} />}
    </main>
  );
}
