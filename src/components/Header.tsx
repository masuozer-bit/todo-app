"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Settings } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Link from "next/link";

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
      <div className="max-w-3xl mx-auto flex items-center justify-end">
        <div className="flex items-center gap-1.5">
          <ThemeToggle />

          {email && (
            <Link
              href="/settings"
              className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-black dark:hover:text-white transition-default"
              aria-label="Settings"
            >
              <Settings size={16} />
            </Link>
          )}

          {email && (
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-black dark:hover:text-white transition-default active:scale-95"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
