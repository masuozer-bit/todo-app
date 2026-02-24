"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  email?: string;
}

export default function Header({ email }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="w-full py-4 px-4 md:px-8">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <h1 className="text-xl font-bold text-black dark:text-white tracking-tight">
          todos
        </h1>

        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden sm:block text-sm text-gray-400 truncate max-w-[200px]">
              {email}
            </span>
          )}

          <ThemeToggle />

          {email && (
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-xl glass-card-subtle flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/15 transition-default active:scale-95"
              aria-label="Sign out"
            >
              <LogOut size={18} className="text-black dark:text-white" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
