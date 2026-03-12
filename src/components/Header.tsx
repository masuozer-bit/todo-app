"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Settings, MoreHorizontal, Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import Link from "next/link";

interface HeaderProps {
  email?: string;
}

export default function Header({ email }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { theme, toggleTheme } = useTheme();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Expanded controls */}
      {open && (
        <div className="flex flex-col items-center gap-1 glass-card-raised rounded-2xl p-1.5">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {email && (
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="p-2.5 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
              aria-label="Settings"
            >
              <Settings size={16} />
            </Link>
          )}

          {email && (
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-default shadow-md ${
          open
            ? "bg-black dark:bg-white text-white dark:text-black"
            : "glass-card-subtle text-gray-400 hover:text-black dark:hover:text-white"
        }`}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}
