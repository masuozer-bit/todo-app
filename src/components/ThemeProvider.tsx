"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import { createClient } from "@/lib/supabase/client";
import { hexToHsv } from "@/lib/color-utils";

type Theme = "light" | "dark";

// Still exported for compat — now just a hex string alias
export type Tint = string;

// Preset quick-pick swatches
export const PRESET_TINTS: { id: string; label: string; hex: string }[] = [
  { id: "lavender", label: "Lavender", hex: "#5540A0" },
  { id: "warm",     label: "Warm",     hex: "#A05820" },
  { id: "sage",     label: "Sage",     hex: "#207840" },
  { id: "rose",     label: "Rose",     hex: "#A02045" },
  { id: "ocean",    label: "Ocean",    hex: "#1E4FA0" },
  { id: "neutral",  label: "Neutral",  hex: "#606060" },
];

// Old name → hex for backward compat
const LEGACY_MAP: Record<string, string> = {
  lavender: "#5540A0",
  warm:     "#A05820",
  sage:     "#207840",
  rose:     "#A02045",
  ocean:    "#1E4FA0",
  neutral:  "#606060",
};

function resolveStoredTint(raw: string | null): string {
  if (!raw) return "#5540A0";
  if (raw.startsWith("#")) return raw;
  return LEGACY_MAP[raw] ?? "#5540A0";
}

// ── Derive CSS vars from a hex color ────────────────────────────────────────

function applyTintColor(hex: string, isDark: boolean) {
  const [h, s] = hexToHsv(hex);
  const root   = document.documentElement;

  if (isDark) {
    const sc = Math.min(s * 0.4, 20);
    root.style.setProperty("--tint-bg",     `hsl(${h}, ${sc}%, 4%)`);
    root.style.setProperty("--tint-blob-1", `hsla(${h}, ${Math.min(s * 2.5, 80)}%, 36%, 0.40)`);
    root.style.setProperty("--tint-blob-2", `hsla(${(h + 20) % 360}, ${Math.min(s * 2.0, 68)}%, 28%, 0.28)`);
    root.style.setProperty("--tint-blob-3", `hsla(${(h + 10) % 360}, ${Math.min(s * 1.5, 55)}%, 20%, 0.15)`);
  } else {
    const sc = Math.min(s * 0.45, 20);
    root.style.setProperty("--tint-bg",     `hsl(${h}, ${sc}%, 94%)`);
    root.style.setProperty("--tint-blob-1", `hsla(${h}, ${Math.min(s * 1.6, 68)}%, 79%, 0.58)`);
    root.style.setProperty("--tint-blob-2", `hsla(${(h + 15) % 360}, ${Math.min(s * 1.3, 60)}%, 76%, 0.40)`);
    root.style.setProperty("--tint-blob-3", `hsla(${(h + 5) % 360}, ${Math.min(s * 1.1, 52)}%, 82%, 0.28)`);
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  tint: string; // hex color
  setTint: (hex: string) => void;
  lavaLamp: boolean;
  setLavaLamp: (v: boolean) => void;
  lavaColor: string; // hex color for lava blobs (defaults to tint)
  setLavaColor: (hex: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  tint: "#5540A0",
  setTint: () => {},
  lavaLamp: false,
  setLavaLamp: () => {},
  lavaColor: "#5540A0",
  setLavaColor: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme]            = useState<Theme>("light");
  const [tint, setTintState]         = useState<string>("#5540A0");
  const [lavaLamp, setLavaLampState] = useState(false);
  const [lavaColor, setLavaColorState] = useState<string>("#5540A0");

  useEffect(() => {
    // Theme
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    const isDark = storedTheme === "dark";
    if (storedTheme) {
      setTheme(storedTheme);
      document.documentElement.classList.toggle("dark", isDark);
    }

    // Tint
    const hex = resolveStoredTint(localStorage.getItem("tint"));
    setTintState(hex);
    applyTintColor(hex, isDark);

    // Lava lamp
    setLavaLampState(localStorage.getItem("lava-lamp") === "1");

    // Lava color (defaults to tint if not set)
    const storedLavaColor = localStorage.getItem("lava-color");
    setLavaColorState(storedLavaColor ?? hex);

    // Sync theme from DB
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profiles")
          .select("theme_preference")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data?.theme_preference) {
              const dbTheme = data.theme_preference as Theme;
              setTheme(dbTheme);
              localStorage.setItem("theme", dbTheme);
              document.documentElement.classList.toggle("dark", dbTheme === "dark");
              // Re-apply tint vars with correct dark mode
              applyTintColor(hex, dbTheme === "dark");
            }
          });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    applyTintColor(tint, next === "dark");

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").update({ theme_preference: next }).eq("id", user.id).then(() => {});
      }
    });
  }, [theme, tint]);

  const setTint = useCallback(
    (hex: string) => {
      setTintState(hex);
      localStorage.setItem("tint", hex);
      applyTintColor(hex, theme === "dark");
    },
    [theme]
  );

  const setLavaLamp = useCallback((v: boolean) => {
    setLavaLampState(v);
    localStorage.setItem("lava-lamp", v ? "1" : "0");
  }, []);

  const setLavaColor = useCallback((hex: string) => {
    setLavaColorState(hex);
    localStorage.setItem("lava-color", hex);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, tint, setTint, lavaLamp, setLavaLamp, lavaColor, setLavaColor }}>
      {children}
    </ThemeContext.Provider>
  );
}
