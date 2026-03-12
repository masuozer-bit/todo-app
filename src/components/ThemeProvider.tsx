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

type Theme = "light" | "dark";
export type Tint = "lavender" | "warm" | "sage" | "rose" | "ocean" | "neutral";

export const TINTS: { id: Tint; label: string; light: string; dark: string }[] = [
  { id: "lavender", label: "Lavender", light: "#C4C0E8", dark: "#5540A0" },
  { id: "warm",     label: "Warm",     light: "#E8C89A", dark: "#A05820" },
  { id: "sage",     label: "Sage",     light: "#9ACFAD", dark: "#207840" },
  { id: "rose",     label: "Rose",     light: "#E8AABC", dark: "#A02045" },
  { id: "ocean",    label: "Ocean",    light: "#9AB8E4", dark: "#1E4FA0" },
  { id: "neutral",  label: "Neutral",  light: "#C0C0C0", dark: "#606060" },
];

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  tint: Tint;
  setTint: (t: Tint) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  tint: "lavender",
  setTint: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTint(tint: Tint) {
  const html = document.documentElement;
  TINTS.forEach((t) => html.classList.remove(`tint-${t.id}`));
  html.classList.add(`tint-${tint}`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [tint, setTintState] = useState<Tint>("lavender");

  useEffect(() => {
    // Apply theme
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    if (storedTheme) {
      setTheme(storedTheme);
      document.documentElement.classList.toggle("dark", storedTheme === "dark");
    }

    // Apply tint
    const storedTint = (localStorage.getItem("tint") as Tint | null) ?? "lavender";
    setTintState(storedTint);
    applyTint(storedTint);

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
              setTheme(data.theme_preference as Theme);
              localStorage.setItem("theme", data.theme_preference);
              document.documentElement.classList.toggle(
                "dark",
                data.theme_preference === "dark"
              );
            }
          });
      }
    });
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profiles")
          .update({ theme_preference: next })
          .eq("id", user.id)
          .then(() => {});
      }
    });
  }, [theme]);

  const setTint = useCallback((t: Tint) => {
    setTintState(t);
    localStorage.setItem("tint", t);
    applyTint(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, tint, setTint }}>
      {children}
    </ThemeContext.Provider>
  );
}
