"use client";

import { useState, useEffect, useRef } from "react";

interface CommentaryEvent {
  minute: number;
  type: string;
  player: string;
  team: "home" | "away";
  detail?: string;
  assist?: string;
}

const EVENT_DELAYS: Record<string, number> = {
  kickoff: 1500,
  possession: 1100,
  pass: 1000,
  dribble: 900,
  shot: 700,
  goal: 2000,
  save: 1500,
  block: 1200,
  miss: 1000,
  tackle: 900,
  foul: 1000,
  halftime: 2500,
  fulltime: 3000,
};

function eventLabel(ev: CommentaryEvent): string {
  switch (ev.type) {
    case "kickoff": return "Kick-off! The match is underway.";
    case "possession": return ev.detail ? `${ev.player} — ${ev.detail}` : `${ev.player} builds possession`;
    case "pass": return ev.detail ? `${ev.player} ${ev.detail}` : `${ev.player} passes`;
    case "dribble": return ev.detail ? `${ev.player} ${ev.detail}` : `${ev.player} carries forward`;
    case "shot": return `${ev.player} takes a shot!`;
    case "goal": return ev.detail || `GOAL! ${ev.player} scores!`;
    case "save": return ev.detail || `${ev.player} makes the save!`;
    case "block": return ev.detail ? `${ev.player} ${ev.detail}` : `${ev.player} blocks the shot!`;
    case "miss": return ev.detail ? `${ev.player} — ${ev.detail}` : `${ev.player} misses the target`;
    case "tackle": return ev.detail ? `${ev.player} ${ev.detail}` : `${ev.player} wins the ball`;
    case "foul": return ev.detail || `${ev.player} commits a foul`;
    case "halftime": return "Half-time! The teams head to the dressing room.";
    case "fulltime": return "Full-time! The referee blows the whistle.";
    default: return ev.detail || `${ev.player} ${ev.type}`;
  }
}

function eventColour(ev: CommentaryEvent): string {
  if (ev.type === "goal") return ev.team === "home" ? "text-coral font-bold" : "text-mint font-bold";
  if (ev.type === "halftime" || ev.type === "fulltime") return "text-navy font-bold";
  if (ev.type === "save" || ev.type === "block") return "text-amber-500";
  if (ev.type === "miss") return "text-slate-soft italic";
  if (ev.type === "shot") return ev.team === "home" ? "text-coral" : "text-mint";
  return ev.team === "home" ? "text-navy" : "text-navy/70";
}

function eventBg(ev: CommentaryEvent): string {
  if (ev.type === "goal") return ev.team === "home" ? "bg-coral/5" : "bg-mint/5";
  if (ev.type === "halftime" || ev.type === "fulltime") return "bg-navy/5";
  return "";
}

export function CommentaryFeed({
  events,
  homeLabel,
  awayLabel,
  onComplete,
}: {
  events: CommentaryEvent[];
  homeLabel?: string;
  awayLabel?: string;
  onComplete: () => void;
}) {
  const [visible, setVisible] = useState<number>(0);
  const [showScore, setShowScore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset when events change (new match)
  const eventsRef = useRef(events);
  useEffect(() => {
    if (events !== eventsRef.current) {
      eventsRef.current = events;
      setVisible(0);
      setShowScore(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [events]);

  const homeGoals = events.slice(0, visible).filter(e => e.type === "goal" && e.team === "home").length;
  const awayGoals = events.slice(0, visible).filter(e => e.type === "goal" && e.team === "away").length;

  useEffect(() => {
    if (visible >= events.length) {
      timerRef.current = setTimeout(() => {
        setShowScore(true);
        setTimeout(onComplete, 2000);
      }, 1500);
      return;
    }

    const delay = EVENT_DELAYS[events[visible].type] || 1000;
    const speedFactor = visible > 20 ? 0.7 : 1;
    
    timerRef.current = setTimeout(() => {
      setVisible(v => v + 1);
    }, delay * speedFactor);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, events, onComplete]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visible]);

  const displayedEvents = events.slice(0, visible);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Team headers */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-coral" />
          <span className="font-display text-xs font-bold text-navy">
            {homeLabel || "HOME"}
          </span>
        </div>
        <span className="text-slate-soft text-xs font-display">vs</span>
        <div className="flex items-center gap-2">
          <span className="font-display text-xs font-bold text-navy">
            {awayLabel || "AWAY"}
          </span>
          <span className="w-2.5 h-2.5 rounded-full bg-mint" />
        </div>
      </div>

      {/* Live scoreboard */}
      {showScore && (
        <div className="text-center mb-4 animate-fade-in">
          <div className="inline-flex items-center gap-4 bg-navy text-white px-6 py-3 rounded-xl font-display font-bold text-lg shadow-lg">
            <span className={homeGoals > awayGoals ? "text-coral" : ""}>{homeGoals}</span>
            <span className="text-white/60">–</span>
            <span className={awayGoals > homeGoals ? "text-coral" : ""}>{awayGoals}</span>
          </div>
          <div className="text-slate-soft text-xs mt-1 font-display">FULL TIME</div>
        </div>
      )}

      {/* Commentary feed */}
      <div
        ref={containerRef}
        className="max-h-[50vh] overflow-y-auto space-y-1 rounded-xl bg-white/50 border border-[#E2E8F0] p-3"
      >
        {displayedEvents.length === 0 && (
          <div className="text-center py-12 text-slate-soft font-display text-sm animate-pulse">
            Kicking off...
          </div>
        )}

        {displayedEvents.map((ev, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 px-2 py-1.5 rounded-lg transition-all duration-300 animate-slide-up ${eventBg(ev)}`}
          >
            <span className="text-slate-soft text-[0.6rem] font-display w-8 text-right shrink-0 pt-0.5">
              {ev.minute}&apos;
            </span>

            <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${
              ev.type === "halftime" || ev.type === "fulltime" || ev.type === "kickoff"
                ? "bg-navy/30"
                : ev.team === "home" ? "bg-coral" : "bg-mint"
            }`} />

            <span className={`font-display text-xs leading-snug ${eventColour(ev)}`}>
              {eventLabel(ev)}
              {ev.assist && ev.type === "goal" && (
                <span className="text-slate-soft font-normal"> — Assist: {ev.assist}</span>
              )}
            </span>
          </div>
        ))}

        {visible < events.length && displayedEvents.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="text-slate-soft text-[0.6rem] font-display w-8 text-right shrink-0" />
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-slate-soft/30" />
            <span className="font-display text-xs text-slate-soft animate-pulse">▊</span>
          </div>
        )}
      </div>

      {/* Live score ticker */}
      {visible > 0 && !showScore && (
        <div className="text-center mt-3 font-display text-xs text-slate-soft animate-fade-in">
          Live: <span className="text-coral font-bold">{homeGoals}</span> –{" "}
          <span className="text-mint font-bold">{awayGoals}</span>
          {" · "}
          {events[Math.min(visible, events.length - 1)]?.minute}&apos;
        </div>
      )}
    </div>
  );
}
