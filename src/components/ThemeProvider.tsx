"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createClient } from "@/lib/supabase/client";

/** What the user picked. "system" follows prefers-color-scheme. */
export type ThemePreference = "system" | "light" | "dark";
/** What is actually on screen. */
export type ResolvedTheme = "light" | "dark";
export type Density = "comfortable" | "compact";

// ── Accent presets ───────────────────────────────────────────────────────────
// Six colours, each holding at least 4.5:1 as text on its own background.
// The light values are darkened against the concept for exactly that reason.

export interface AccentPreset {
  id: string;
  /** English label; the settings page runs it through t(). */
  label: string;
  light: { base: string; hover: string; soft: string };
  dark: { base: string; hover: string; soft: string };
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: "blue",
    label: "Blue",
    light: { base: "#2A66D8", hover: "#1F5ED0", soft: "rgba(42, 102, 216, 0.10)" },
    dark: { base: "#5B8DEF", hover: "#7AA3F5", soft: "rgba(91, 141, 239, 0.14)" },
  },
  {
    id: "indigo",
    label: "Indigo",
    light: { base: "#5B5BD6", hover: "#5048C8", soft: "rgba(91, 91, 214, 0.10)" },
    dark: { base: "#8A8AF0", hover: "#A3A3F5", soft: "rgba(138, 138, 240, 0.14)" },
  },
  {
    id: "green",
    label: "Green",
    light: { base: "#1F7F4C", hover: "#186740", soft: "rgba(31, 127, 76, 0.10)" },
    dark: { base: "#3DBE7A", hover: "#5FCD93", soft: "rgba(61, 190, 122, 0.14)" },
  },
  {
    id: "orange",
    label: "Orange",
    light: { base: "#9C600B", hover: "#8A5309", soft: "rgba(156, 96, 11, 0.10)" },
    dark: { base: "#E7A33A", hover: "#EFB865", soft: "rgba(231, 163, 58, 0.14)" },
  },
  {
    id: "pink",
    label: "Pink",
    light: { base: "#BE3576", hover: "#A32663", soft: "rgba(190, 53, 118, 0.10)" },
    dark: { base: "#E8699F", hover: "#EF8AB4", soft: "rgba(232, 105, 159, 0.14)" },
  },
  {
    id: "grey",
    label: "Grey",
    light: { base: "#5B6470", hover: "#4B535D", soft: "rgba(91, 100, 112, 0.10)" },
    dark: { base: "#9AA3B2", hover: "#B4BBC7", soft: "rgba(154, 163, 178, 0.14)" },
  },
];

const DEFAULT_ACCENT = "blue";

function findAccent(id: string): AccentPreset {
  return ACCENT_PRESETS.find((a) => a.id === id) ?? ACCENT_PRESETS[0];
}

// ── Applying to the document ─────────────────────────────────────────────────

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia("(prefers-color-scheme: light)").matches;
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  return systemPrefersDark() ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function applyAccent(id: string, resolved: ResolvedTheme) {
  const preset = findAccent(id);
  const set = resolved === "dark" ? preset.dark : preset.light;
  const root = document.documentElement.style;
  root.setProperty("--accent", set.base);
  root.setProperty("--accent-hover", set.hover);
  root.setProperty("--accent-soft", set.soft);
  // Blue on white reads at 5.3:1, the same blue on near-black only at 3.2:1,
  // so a filled button carries dark text in dark mode and white text in light.
  root.setProperty("--accent-contrast", resolved === "dark" ? "#0F1115" : "#FFFFFF");
}

function applyDensity(density: Density) {
  document.documentElement.classList.toggle("density-compact", density === "compact");
}

// ── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextType {
  /** What the user picked, including "system". */
  themePreference: ThemePreference;
  /** What is on screen right now. */
  theme: ResolvedTheme;
  setThemePreference: (pref: ThemePreference) => void;
  /** Steps light, dark, back to light. Used by the one button in the nav foot. */
  toggleTheme: () => void;
  /** Apply the theme the server already knows about, without an auth roundtrip. */
  syncServerTheme: (theme: ResolvedTheme | null, userId?: string | null) => void;
  accent: string;
  setAccent: (id: string) => void;
  density: Density;
  setDensity: (density: Density) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themePreference: "system",
  theme: "dark",
  setThemePreference: () => {},
  toggleTheme: () => {},
  syncServerTheme: () => {},
  accent: DEFAULT_ACCENT,
  setAccent: () => {},
  density: "comfortable",
  setDensity: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Server and first client render agree; the stored choice lands on mount,
  // and the inline script in layout.tsx has already painted the right theme.
  const [themePreference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<ResolvedTheme>("dark");
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);
  const [density, setDensityState] = useState<Density>("comfortable");

  // Set once the page knows who is signed in, so a toggle needs no auth roundtrip
  const userIdRef = useRef<string | null>(null);
  const accentRef = useRef(accent);
  accentRef.current = accent;

  useEffect(() => {
    let storedTheme: string | null = null;
    let storedAccent: string | null = null;
    let storedDensity: string | null = null;
    try {
      storedTheme = localStorage.getItem("theme");
      storedAccent = localStorage.getItem("accent");
      storedDensity = localStorage.getItem("density");
    } catch {
      /* private mode, stay on the defaults */
    }

    const pref: ThemePreference =
      storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
        ? storedTheme
        : "system";
    const resolved = resolve(pref);
    setPreferenceState(pref);
    setTheme(resolved);
    applyTheme(resolved);

    const accentId = storedAccent && findAccent(storedAccent).id === storedAccent ? storedAccent : DEFAULT_ACCENT;
    setAccentState(accentId);
    applyAccent(accentId, resolved);

    const nextDensity: Density = storedDensity === "compact" ? "compact" : "comfortable";
    setDensityState(nextDensity);
    applyDensity(nextDensity);
  }, []);

  // Follow the system while the preference is "system"
  useEffect(() => {
    if (themePreference !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const resolved = resolve("system");
      setTheme(resolved);
      applyTheme(resolved);
      applyAccent(accentRef.current, resolved);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themePreference]);

  const persistServerTheme = useCallback((resolved: ResolvedTheme) => {
    const supabase = createClient();
    const knownUserId = userIdRef.current;
    if (knownUserId) {
      supabase.from("profiles").update({ theme_preference: resolved }).eq("id", knownUserId).then(() => {});
      return;
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      userIdRef.current = user.id;
      supabase.from("profiles").update({ theme_preference: resolved }).eq("id", user.id).then(() => {});
    });
  }, []);

  const setThemePreference = useCallback(
    (pref: ThemePreference) => {
      const resolved = resolve(pref);
      setPreferenceState(pref);
      setTheme(resolved);
      applyTheme(resolved);
      applyAccent(accentRef.current, resolved);
      try { localStorage.setItem("theme", pref); } catch { /* ignore */ }
      persistServerTheme(resolved);
    },
    [persistServerTheme]
  );

  const toggleTheme = useCallback(() => {
    setThemePreference(theme === "dark" ? "light" : "dark");
  }, [theme, setThemePreference]);

  // Called by pages that already resolved the user server-side
  const syncServerTheme = useCallback(
    (serverTheme: ResolvedTheme | null, userId?: string | null) => {
      if (userId) userIdRef.current = userId;
      if (serverTheme !== "light" && serverTheme !== "dark") return;
      // A local choice wins over the stored one, so nothing flips under the user
      let storedTheme: string | null = null;
      try { storedTheme = localStorage.getItem("theme"); } catch { /* ignore */ }
      if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") return;

      setPreferenceState(serverTheme);
      setTheme(serverTheme);
      applyTheme(serverTheme);
      applyAccent(accentRef.current, serverTheme);
      try { localStorage.setItem("theme", serverTheme); } catch { /* ignore */ }
    },
    []
  );

  const setAccent = useCallback(
    (id: string) => {
      const next = findAccent(id).id;
      setAccentState(next);
      applyAccent(next, theme);
      try { localStorage.setItem("accent", next); } catch { /* ignore */ }
    },
    [theme]
  );

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    applyDensity(next);
    try { localStorage.setItem("density", next); } catch { /* ignore */ }
  }, []);

  const value = useMemo(
    () => ({
      themePreference,
      theme,
      setThemePreference,
      toggleTheme,
      syncServerTheme,
      accent,
      setAccent,
      density,
      setDensity,
    }),
    [themePreference, theme, setThemePreference, toggleTheme, syncServerTheme, accent, setAccent, density, setDensity]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
