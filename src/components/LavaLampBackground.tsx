"use client";

import { useEffect, useRef } from "react";
import type { Tint } from "./ThemeProvider";

/* Blob fill colour per tint – saturated so blur+contrast renders well */
const TINT_HEX: Record<Tint, string> = {
  lavender: "#3a0e8c",
  warm:     "#7a1e05",
  sage:     "#074d22",
  rose:     "#7a0a28",
  ocean:    "#083a85",
  neutral:  "#1e1e2e",
};

interface Blob {
  x: number; y: number;           // absolute pixels
  rx: number; ry: number;         // radii (ellipse, so we can stretch)
  vx: number; vy: number;
  /** stretch target: 1 = circle, >1 = tall, <1 = wide */
  stretchTarget: number;
  stretch: number;
  stretchV: number;
  stretchTimer: number;
}

function randBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function makeBlobs(w: number, h: number): Blob[] {
  const blobs: Blob[] = [];

  // 4 large primary blobs
  for (let i = 0; i < 4; i++) {
    const r = randBetween(120, 220);
    blobs.push({
      x: randBetween(r, w - r),
      y: randBetween(h * 0.3, h - r),
      rx: r, ry: r,
      vx: randBetween(-0.35, 0.35),
      vy: randBetween(-0.5, -0.2),   // slight upward tendency
      stretch: 1, stretchTarget: 1, stretchV: 0,
      stretchTimer: randBetween(0, 300),
    });
  }

  // 5 medium blobs
  for (let i = 0; i < 5; i++) {
    const r = randBetween(65, 115);
    blobs.push({
      x: randBetween(r, w - r),
      y: randBetween(h * 0.1, h - r),
      rx: r, ry: r,
      vx: randBetween(-0.55, 0.55),
      vy: randBetween(-0.6, 0.3),
      stretch: 1, stretchTarget: 1, stretchV: 0,
      stretchTimer: randBetween(0, 300),
    });
  }

  // 5 small satellite blobs
  for (let i = 0; i < 5; i++) {
    const r = randBetween(28, 58);
    blobs.push({
      x: randBetween(r, w - r),
      y: randBetween(0, h),
      rx: r, ry: r,
      vx: randBetween(-0.7, 0.7),
      vy: randBetween(-0.8, 0.4),
      stretch: 1, stretchTarget: 1, stretchV: 0,
      stretchTimer: randBetween(0, 300),
    });
  }

  return blobs;
}

export default function LavaLampBackground({ tint }: { tint: Tint }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tintRef   = useRef(tint);
  tintRef.current = tint;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width  = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d")!;
    let blobs = makeBlobs(w, h);
    let animId = 0;

    const onResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width  = w;
      canvas.height = h;
      blobs = makeBlobs(w, h);
    };
    window.addEventListener("resize", onResize);

    const GRAVITY   =  0.012;   // gentle pull toward bottom
    const BUOYANCY  = -0.022;   // blobs at bottom get pushed up
    const DAMPING   =  0.998;

    const draw = () => {
      /* ── clear with black ── */
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = TINT_HEX[tintRef.current];

      for (const b of blobs) {
        /* ── physics ── */
        const bottomness = b.y / h;               // 0 top, 1 bottom
        b.vy += GRAVITY * bottomness - BUOYANCY * (1 - bottomness);
        b.vx *= DAMPING;
        b.vy *= DAMPING;

        b.x += b.vx;
        b.y += b.vy;

        /* bounce off walls */
        if (b.x - b.rx < 0)  { b.x = b.rx;      b.vx =  Math.abs(b.vx); }
        if (b.x + b.rx > w)  { b.x = w - b.rx;  b.vx = -Math.abs(b.vx); }
        if (b.y - b.ry < 0)  { b.y = b.ry;      b.vy =  Math.abs(b.vy); }
        if (b.y + b.ry > h)  { b.y = h - b.ry;  b.vy = -Math.abs(b.vy); }

        /* ── organic stretch ── */
        b.stretchTimer--;
        if (b.stretchTimer <= 0) {
          b.stretchTarget = randBetween(0.65, 1.7);   // tall or wide
          b.stretchTimer  = randBetween(180, 480);
        }
        const dStretch = (b.stretchTarget - b.stretch) * 0.012;
        b.stretch += dStretch;
        b.stretchV *= 0.9;

        /* apply stretch preserving area roughly */
        const baseR = b.rx;  // use rx as base radius
        const ry = baseR * b.stretch;
        const rx = baseR / Math.sqrt(b.stretch);   // area-conserving squeeze

        /* ── draw ellipse ── */
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);   // run once; tint is read via ref

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        0,
        width:         "100%",
        height:        "100%",
        pointerEvents: "none",
        /* The magic: blur spreads colour, contrast snaps edges back → goo shapes */
        filter:  "blur(32px) contrast(16)",
        opacity: 0.55,
      }}
    />
  );
}
