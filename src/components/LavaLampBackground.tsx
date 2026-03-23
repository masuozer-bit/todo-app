"use client";

import type { Tint } from "./ThemeProvider";

/* Per-tint blob colours (dark mode only) */
const TINT_COLORS: Record<Tint, [string, string, string, string, string]> = {
  lavender: [
    "rgba(120, 50, 230, 0.72)",
    "rgba(60,  45, 190, 0.58)",
    "rgba(160, 120, 255, 0.48)",
    "rgba(100, 30, 210, 0.62)",
    "rgba(200, 170, 255, 0.38)",
  ],
  warm: [
    "rgba(210, 110,   5, 0.70)",
    "rgba(175,  75,   8, 0.58)",
    "rgba(240, 155,  10, 0.50)",
    "rgba(155,  65,   0, 0.65)",
    "rgba(250, 185,  35, 0.38)",
  ],
  sage: [
    "rgba(  4, 145, 100, 0.68)",
    "rgba(  3, 115,  80, 0.56)",
    "rgba( 50, 205, 145, 0.48)",
    "rgba(  5,  90,  65, 0.62)",
    "rgba( 80, 220, 160, 0.38)",
  ],
  rose: [
    "rgba(220,  25,  68, 0.68)",
    "rgba(185,  18,  90, 0.56)",
    "rgba(240,  55,  95, 0.48)",
    "rgba(155,  14,  55, 0.62)",
    "rgba(255, 100, 135, 0.38)",
  ],
  ocean: [
    "rgba( 12, 158, 228, 0.68)",
    "rgba(  2, 100, 158, 0.56)",
    "rgba(  5, 175, 210, 0.48)",
    "rgba(  1,  72, 120, 0.62)",
    "rgba( 50, 200, 240, 0.38)",
  ],
  neutral: [
    "rgba(100, 108, 120, 0.58)",
    "rgba( 70,  80,  95, 0.48)",
    "rgba(150, 158, 170, 0.42)",
    "rgba( 52,  60,  75, 0.55)",
    "rgba(180, 188, 200, 0.32)",
  ],
};

interface Blob {
  size: number;
  top: string;
  left: string;
  animation: string;
  delay: string;
  colorIdx: number;
}

const BLOBS: Blob[] = [
  { size: 660, top: "-8%",  left: "-8%",  animation: "lava-1", delay: "0s",    colorIdx: 0 },
  { size: 560, top: "35%",  left: "65%",  animation: "lava-2", delay: "-9s",   colorIdx: 1 },
  { size: 500, top: "60%",  left: "10%",  animation: "lava-3", delay: "-17s",  colorIdx: 2 },
  { size: 440, top: "5%",   left: "45%",  animation: "lava-4", delay: "-6s",   colorIdx: 3 },
  { size: 390, top: "75%",  left: "55%",  animation: "lava-1", delay: "-22s",  colorIdx: 4 },
];

export default function LavaLampBackground({ tint }: { tint: Tint }) {
  const colors = TINT_COLORS[tint];

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {BLOBS.map((blob, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width:  blob.size,
            height: blob.size,
            top:    blob.top,
            left:   blob.left,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${colors[blob.colorIdx]} 0%, transparent 68%)`,
            filter: "blur(110px)",
            animation: `${blob.animation} ${22 + i * 5}s ease-in-out infinite`,
            animationDelay: blob.delay,
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
