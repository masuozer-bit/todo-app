"use client";

import { useEffect, useRef } from "react";
import { hexToHsv } from "./ColorWheelPicker";

// Darken a hex color for use as lava blob fill (low brightness, saturated)
function blobColorFromHex(hex: string): string {
  const [h, s] = hexToHsv(hex);
  // dark, saturated version of the picked color
  return `hsl(${h}, ${Math.min(s * 1.2, 85)}%, 22%)`;
}

/*
  Movement algorithm: each blob's position is a sum of three sine waves
  per axis, each with an irrational frequency. Because the ratios between
  all frequencies are irrational (√prime), the trajectory never exactly
  repeats — quasi-periodic motion.

  √2, √3, √5, √7, √11 … are all linearly independent over the rationals,
  so any linear combination is aperiodic.
*/
const SQPRIMES = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71].map(Math.sqrt);

interface Wave { amp: number; freq: number; phase: number }
interface BlobDef {
  cx: number; cy: number;  // centre (normalised 0-1)
  wx: [Wave,Wave,Wave];
  wy: [Wave,Wave,Wave];
  wr: Wave;                // rotation wave
  ws: Wave;                // stretch wave
  r: number;
}

let _fi = 0;
const nextFreq = (speed: number) => SQPRIMES[_fi++ % SQPRIMES.length] * speed;

function wave(amp: number, speed: number): Wave {
  return { amp, freq: nextFreq(speed), phase: Math.random() * Math.PI * 2 };
}

function makeBlob(r: number): BlobDef {
  const S = 0.00022; // global speed — tweak here to make faster/slower
  return {
    r,
    cx: 0.1  + Math.random() * 0.8,
    cy: 0.1  + Math.random() * 0.8,
    wx: [wave(0.32, S), wave(0.13, S * 1.6), wave(0.05, S * 3.3)],
    wy: [wave(0.32, S), wave(0.13, S * 1.6), wave(0.05, S * 3.3)],
    wr: wave(Math.PI * 0.8, S * 0.7),
    ws: wave(0.50, S * 2.1),
  };
}

const evalWave = (ws: [Wave,Wave,Wave], t: number) =>
  ws[0].amp * Math.sin(ws[0].freq * t + ws[0].phase) +
  ws[1].amp * Math.sin(ws[1].freq * t + ws[1].phase) +
  ws[2].amp * Math.sin(ws[2].freq * t + ws[2].phase);

export default function LavaLampBackground({ tint }: { tint: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tintRef   = useRef(tint);
  tintRef.current = tint;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* reset index so every mount gets a fresh deterministic spread */
    _fi = 0;

    /* ── blob definitions (created once, moved via maths) ── */
    const blobs: BlobDef[] = [
      /* 4 large  */ ...Array.from({ length: 4  }, () => makeBlob(145 + Math.random() * 65)),
      /* 5 medium */ ...Array.from({ length: 5  }, () => makeBlob(75  + Math.random() * 55)),
      /* 5 small  */ ...Array.from({ length: 5  }, () => makeBlob(32  + Math.random() * 38)),
      /* 3 micro  */ ...Array.from({ length: 3  }, () => makeBlob(14  + Math.random() * 18)),
    ];

    /* ── canvas sizing ── */
    const resize = () => {
      /* Use CSS pixels matching the viewport so it works at any zoom level */
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx   = canvas.getContext("2d")!;
    let   t     = Math.random() * 50_000; // random start → no two sessions look the same
    let   animId = 0;

    const draw = () => {
      t++;
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = blobColorFromHex(tintRef.current);

      for (const b of blobs) {
        const x  = (b.cx + evalWave(b.wx, t)) * w;
        const y  = (b.cy + evalWave(b.wy, t)) * h;
        const rot = Math.sin(b.wr.freq * t + b.wr.phase) * b.wr.amp;

        /* stretch: values >1 = tall teardrop, <1 = wide disc */
        const stretch = Math.max(0.45, Math.min(2.4,
          1 + b.ws.amp * Math.sin(b.ws.freq * t + b.ws.phase)
        ));
        /* preserve approximate area during stretch */
        const rx = b.r / Math.sqrt(stretch);
        const ry = b.r * Math.sqrt(stretch);

        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      "fixed",
        top:           0,
        left:          0,
        /* 100vw/vh always matches the visible viewport, even when zoomed */
        width:         "100vw",
        height:        "100vh",
        zIndex:        0,
        pointerEvents: "none",
        /*
          blur  — spreads colour so nearby blobs merge organically
          contrast — snaps blurred edges back into hard organic outlines
          Together these produce the classic "metaball / goo" silhouette.
        */
        filter:        "blur(30px) contrast(14)",
        opacity:       0.58,
      }}
    />
  );
}
