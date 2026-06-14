"use client";

// Muted palette — works on dark backgrounds, same color per player (hash-based)
const PALETTE = [
  "#e9393f", // red
  "#3498db", // blue
  "#2ecc71", // green
  "#f39c12", // amber
  "#9b59b6", // purple
  "#1abc9c", // teal
  "#e91e63", // pink
  "#e67e22", // orange
  "#00bcd4", // cyan
  "#8e44ad", // violet
  "#27ae60", // emerald
  "#d35400", // rust
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  // Skip short abbreviations like "K." in "K. De Bruyne"
  const first = parts[0].replace(/\.$/, "");
  const last = parts[parts.length - 1].replace(/\.$/, "");
  return (first[0] + last[0]).toUpperCase();
}

export function PlayerAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const color = PALETTE[hashName(name) % PALETTE.length];
  const fontStyle = {
    fontFamily: "'Departure Mono', monospace",
    fontSize: `${Math.round(size * 0.42)}px`,
    fontWeight: 700,
    lineHeight: `${size}px`,
    color: "#c4c4c4",
  };

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        backgroundColor: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={fontStyle}>{initials(name)}</span>
    </div>
  );
}
