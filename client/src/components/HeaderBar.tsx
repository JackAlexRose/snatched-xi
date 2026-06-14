"use client";

export function HeaderBar({
  currentRound,
  timer,
  opponentMsg,
}: {
  currentRound: number;
  timer: number;
  opponentMsg: string;
}) {
  const isUrgent = timer <= 3 && timer > 0;

  return (
    <header className="sticky top-0 z-20 bg-cream/95 backdrop-blur-sm border-b border-[#E2E8F0]">
      <div className="flex items-center justify-between px-4 py-3 max-w-[480px] mx-auto">
        {/* Left: Title + Round */}
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-lg text-navy font-display tracking-tight">
            Snatched XI
          </h1>
          <span className="bg-navy text-white text-[0.65rem] font-bold font-display px-2 py-0.5 rounded-md">
            R{currentRound}/11
          </span>
        </div>

        {/* Right: Timer capsule */}
        <div
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-display font-bold text-sm
            transition-colors duration-200
            ${isUrgent
              ? "border-coral bg-[#FEF2F2] text-coral animate-timer-pulse"
              : "border-[#E2E8F0] bg-white text-navy"
            }
          `}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 4v3.5L9.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>0:{String(timer).padStart(2, "0")}</span>
        </div>
      </div>

      {/* Opponent status */}
      {opponentMsg && (
        <div className="flex items-center justify-center gap-1.5 pb-2 text-[0.65rem] text-slate-soft font-display">
          <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse inline-block" />
          {opponentMsg}
        </div>
      )}
    </header>
  );
}

export function WheelBanner({
  club,
  season,
  spinning,
}: {
  club: string;
  season: string;
  spinning: boolean;
}) {
  if (!club) return null;

  return (
    <div
      className="w-full py-4 px-4 mx-auto max-w-[480px]"
      style={{
        background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,0.06)",
      }}
    >
      <div className={`text-center font-bold font-display tracking-wide transition-all duration-200 ${
        spinning ? "text-slate-soft text-sm" : "text-navy text-base"
      }`}>
        {club}
      </div>
      <div className="text-center text-slate-soft text-[0.65rem] font-display mt-0.5">
        {season || "\u00A0"}
      </div>
    </div>
  );
}
