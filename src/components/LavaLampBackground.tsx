"use client";

import { useEffect, useRef } from "react";
import { hexToHsv } from "@/lib/color-utils";

// The CSS blur+contrast goo trick requires the dominant RGB channel to exceed
// ~118/255 (~0.46) so it survives contrast(14). Use 65% lightness to guarantee
// that. Canvas opacity keeps the overall look subtle.
function blobColorFromHex(hex: string): string {
  const [h, s] = hexToHsv(hex);
  const sat = Math.max(s, 55); // minimum saturation so neutral greys still have colour
  return `hsl(${h}, ${Math.min(sat * 1.4, 92)}%, 65%)`;
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

export default function LavaLampBackground({ tint, opacity = 0.58 }: { tint: string; opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tintRef   = useRef(tint);
  tintRef.current = tint;

  // Smoothed mouse position in normalised coords (0–1), starts off-screen
  const mouseRef = useRef({ x: -2, y: -2, tx: -2, ty: -2 });

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
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    /* ── mouse tracking (normalised to 0-1) ── */
    const onMouse = (e: MouseEvent) => {
      mouseRef.current.tx = e.clientX / window.innerWidth;
      mouseRef.current.ty = e.clientY / window.innerHeight;
    };
    window.addEventListener("mousemove", onMouse);

    const ctx   = canvas.getContext("2d")!;
    let   t     = Math.random() * 50_000;
    let   animId = 0;

    const draw = () => {
      t++;
      const w = canvas.width;
      const h = canvas.height;

      /* Smoothly lerp the displayed mouse toward the real position.
         Low alpha = very lazy follow → the influence feels dreamy, not snappy. */
      const m = mouseRef.current;
      const alpha = 0.04;
      m.x += (m.tx - m.x) * alpha;
      m.y += (m.ty - m.y) * alpha;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = blobColorFromHex(tintRef.current);

      /* Influence radius: blobs within 45% of the screen diagonal feel the cursor */
      const diagPx  = Math.sqrt(w * w + h * h);
      const influence = diagPx * 0.45;

      for (const b of blobs) {
        let x  = (b.cx + evalWave(b.wx, t)) * w;
        let y  = (b.cy + evalWave(b.wy, t)) * h;

        /* Apply a tiny cursor attraction — falls off with distance squared */
        if (m.x >= 0) {
          const mx   = m.x * w;
          const my   = m.y * h;
          const dx   = mx - x;
          const dy   = my - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < influence && dist > 1) {
            /* strength peaks near the cursor, fades smoothly to 0 at influence edge */
            const t2 = 1 - dist / influence;
            /* max pull: ~3% of screen diagonal — barely noticeable but present */
            const pull = diagPx * 0.03 * t2 * t2;
            x += (dx / dist) * pull;
            y += (dy / dist) * pull;
          }
        }

        const rot = Math.sin(b.wr.freq * t + b.wr.phase) * b.wr.amp;
        const stretch = Math.max(0.45, Math.min(2.4,
          1 + b.ws.amp * Math.sin(b.ws.freq * t + b.ws.phase)
        ));
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
      window.removeEventListener("mousemove", onMouse);
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
        opacity,
      }}
    />
  );
}
