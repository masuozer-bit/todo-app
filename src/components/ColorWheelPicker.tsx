"use client";
import { useRef, useState, useCallback, useEffect } from "react";

// ── Color math ────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return [h, max === 0 ? 0 : (d / max) * 100, max * 100];
}

export function hsvToHex(h: number, s: number, v: number): string {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const hex2 = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  value: string; // hex
  onChange: (hex: string) => void;
}

export default function ColorWheelPicker({ value, onChange }: Props) {
  const [h, setH] = useState(0);
  const [s, setS] = useState(70);
  const [v, setV] = useState(80);

  // Sync from external value (on mount or when changed from outside)
  useEffect(() => {
    if (value && /^#[0-9a-f]{6}$/i.test(value)) {
      const [nh, ns, nv] = hexToHsv(value);
      setH(nh);
      setS(ns);
      setV(nv);
    }
  }, [value]);

  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef   = useRef<HTMLDivElement>(null);
  const draggingSquare = useRef(false);
  const draggingHue    = useRef(false);

  const applySquare = useCallback(
    (e: { clientX: number; clientY: number }) => {
      if (!squareRef.current) return;
      const rect = squareRef.current.getBoundingClientRect();
      const nx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const ny = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      const ns = nx * 100;
      const nv = (1 - ny) * 100;
      setS(ns);
      setV(nv);
      onChange(hsvToHex(h, ns, nv));
    },
    [h, onChange]
  );

  const applyHue = useCallback(
    (e: { clientX: number }) => {
      if (!hueRef.current) return;
      const rect = hueRef.current.getBoundingClientRect();
      const nx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const nh = nx * 360;
      setH(nh);
      onChange(hsvToHex(nh, s, v));
    },
    [s, v, onChange]
  );

  // Global pointer-move / up for dragging
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (draggingSquare.current) applySquare(e);
      if (draggingHue.current)   applyHue(e);
    };
    const up = () => {
      draggingSquare.current = false;
      draggingHue.current   = false;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [applySquare, applyHue]);

  const currentHex = hsvToHex(h, s, v);
  const pureHue    = `hsl(${h}, 100%, 50%)`;

  return (
    <div className="flex flex-col gap-4 select-none">
      {/* ── Saturation / Brightness square ── */}
      <div
        ref={squareRef}
        className="relative w-full rounded-xl overflow-hidden cursor-crosshair"
        style={{ height: 180 }}
        onPointerDown={(e) => {
          draggingSquare.current = true;
          applySquare(e);
        }}
      >
        {/* Hue base layer */}
        <div
          className="absolute inset-0"
          style={{ background: pureHue }}
        />
        {/* White left-to-right gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))",
          }}
        />
        {/* Black bottom-to-top gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))",
          }}
        />
        {/* Crosshair */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${s}%`,
            top:  `${100 - v}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.4)]"
            style={{ background: currentHex }}
          />
        </div>
      </div>

      {/* ── Hue slider ── */}
      <div className="flex items-center gap-3">
        {/* Color preview */}
        <div
          className="w-10 h-10 rounded-xl flex-shrink-0 border border-white/20 shadow-inner"
          style={{ background: currentHex }}
        />

        <div className="flex-1 flex flex-col gap-2">
          <div
            ref={hueRef}
            className="relative h-5 rounded-full cursor-pointer overflow-hidden"
            style={{
              background:
                "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
            }}
            onPointerDown={(e) => {
              draggingHue.current = true;
              applyHue(e);
            }}
          >
            {/* Thumb */}
            <div
              className="absolute top-1/2 pointer-events-none"
              style={{
                left: `${(h / 360) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div
                className="w-5 h-5 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.3)]"
                style={{ background: pureHue }}
              />
            </div>
          </div>

          {/* Hex input */}
          <input
            type="text"
            value={currentHex.toUpperCase()}
            onChange={(e) => {
              const v2 = e.target.value;
              if (/^#[0-9a-f]{6}$/i.test(v2)) {
                const [nh, ns, nv] = hexToHsv(v2);
                setH(nh); setS(ns); setV(nv);
                onChange(v2.toLowerCase());
              }
            }}
            className="w-full px-2 py-1 rounded-lg text-xs font-mono bg-black/10 dark:bg-white/5 text-black dark:text-white border border-black/10 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
            maxLength={7}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
