"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative w-10 h-10 rounded-xl glass-card-subtle flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/15 transition-default active:scale-95"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <Moon size={18} className="text-black" />
      ) : (
        <Sun size={18} className="text-white" />
      )}
    </button>
  );
}
