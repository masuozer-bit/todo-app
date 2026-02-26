"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useTodos } from "@/hooks/useTodos";
import { useTags } from "@/hooks/useTags";
import { Download, Trash2, User, AlertTriangle, Calendar } from "lucide-react";
import {
  getCalendarStatus,
  disconnectCalendar,
} from "@/lib/calendar-sync-client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export default function SettingsPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const { tags } = useTags(user?.id);
  const { todos, clearCompleted, exportTodos } = useTodos(user?.id, tags);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!user) {
          await supabase.auth.signOut();
          router.push("/login");
          return;
        }
        setUser(user);
        // Load profile
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data?.display_name) setDisplayName(data.display_name);
          });
        setAuthLoading(false);
      })
      .catch(async () => {
        await supabase.auth.signOut();
        router.push("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getCalendarStatus().then((status) => {
      setCalendarConnected(status.connected && status.hasCalendarScope);
      setCalendarLoading(false);
    });
  }, []);

  async function handleConnectCalendar() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
        scopes: "https://www.googleapis.com/auth/calendar.events",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) setSaveMsg(error.message);
  }

  async function handleDisconnectCalendar() {
    const success = await disconnectCalendar();
    if (success) setCalendarConnected(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);
    setSaveMsg("Saved!");
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 2000);
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    // Delete calendar sync data
    await supabase.from("calendar_sync").delete().eq("user_id", user.id);
    await supabase.from("google_tokens").delete().eq("user_id", user.id);
    // Delete all user data (cascades via RLS / foreign keys)
    await supabase.from("todos").delete().eq("user_id", user.id);
    await supabase.from("tags").delete().eq("user_id", user.id);
    await supabase.from("lists").delete().eq("user_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleClearCompleted() {
    await clearCompleted();
    setShowClearConfirm(false);
  }

  const completedCount = todos.filter((t) => t.completed).length;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="w-6 h-6 border-2 border-gray-400/30 border-t-black dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors">
      <Header email={user?.email} />

      <main className="max-w-2xl mx-auto px-4 pb-16">
        <div className="mt-4 mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white">
            Settings
          </h2>
          <p className="text-gray-400 mt-1 text-sm">
            Manage your account and preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile */}
          <section className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <User size={16} className="text-gray-400" />
              <h3 className="font-semibold text-black dark:text-white">
                Profile
              </h3>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">
                  Email
                </label>
                <p className="text-sm text-black dark:text-white">
                  {user?.email}
                </p>
              </div>

              <div>
                <label
                  htmlFor="displayName"
                  className="text-xs text-gray-400 font-medium block mb-1.5"
                >
                  Display name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  maxLength={50}
                  className="w-full bg-transparent border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-80 transition-default disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                {saveMsg && (
                  <span className="text-xs text-gray-400">{saveMsg}</span>
                )}
              </div>
            </form>
          </section>

          {/* Data & Export */}
          <section className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Download size={16} className="text-gray-400" />
              <h3 className="font-semibold text-black dark:text-white">
                Data & Export
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-black dark:text-white">
                    Export as JSON
                  </p>
                  <p className="text-xs text-gray-400">
                    All tasks with subtasks, notes, and tags
                  </p>
                </div>
                <button
                  onClick={() => exportTodos("json")}
                  className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-sm text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
                >
                  Export JSON
                </button>
              </div>

              <div className="border-t border-black/5 dark:border-white/5 pt-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-black dark:text-white">
                    Export as CSV
                  </p>
                  <p className="text-xs text-gray-400">
                    Compatible with Excel and Google Sheets
                  </p>
                </div>
                <button
                  onClick={() => exportTodos("csv")}
                  className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-sm text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
                >
                  Export CSV
                </button>
              </div>

              <div className="border-t border-black/5 dark:border-white/5 pt-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-black dark:text-white">
                    Clear completed tasks
                  </p>
                  <p className="text-xs text-gray-400">
                    {completedCount} completed task
                    {completedCount !== 1 ? "s" : ""} will be deleted
                  </p>
                </div>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={completedCount === 0}
                  className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-sm text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
              </div>
            </div>
          </section>

          {/* Google Calendar */}
          <section className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} className="text-gray-400" />
              <h3 className="font-semibold text-black dark:text-white">
                Google Calendar
              </h3>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black dark:text-white">
                  Sync tasks with due dates
                </p>
                <p className="text-xs text-gray-400">
                  {calendarLoading
                    ? "Checking connection..."
                    : calendarConnected
                      ? "Connected — tasks with due dates sync automatically"
                      : "Connect to sync tasks as all-day calendar events"}
                </p>
              </div>
              {!calendarLoading &&
                (calendarConnected ? (
                  <button
                    onClick={handleDisconnectCalendar}
                    className="px-3 py-1.5 rounded-lg border border-red-500/30 text-sm text-red-500 hover:bg-red-500/10 transition-default"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnectCalendar}
                    className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-sm text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
                  >
                    Connect
                  </button>
                ))}
            </div>
          </section>

          {/* Keyboard shortcuts */}
          <section className="glass-card p-6">
            <h3 className="font-semibold text-black dark:text-white mb-4">
              Keyboard shortcuts
            </h3>
            <div className="space-y-2">
              {[
                ["N", "Focus new task input"],
                ["/ or ⌘K", "Focus search"],
                ["⌘D", "Toggle dark/light mode"],
                ["Enter", "Save edit / Add subtask"],
                ["Escape", "Cancel / Close panel"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {desc}
                  </span>
                  <kbd className="text-xs px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-black dark:text-white font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          {/* Danger zone */}
          <section className="glass-card p-6 border border-red-500/20">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-red-500" />
              <h3 className="font-semibold text-red-500">Danger zone</h3>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black dark:text-white">
                  Delete account
                </p>
                <p className="text-xs text-gray-400">
                  Permanently delete your account and all data. This cannot be
                  undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 rounded-lg border border-red-500/30 text-sm text-red-500 hover:bg-red-500/10 transition-default"
              >
                Delete account
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={showClearConfirm}
        title="Clear completed tasks"
        message={`Are you sure you want to delete ${completedCount} completed task${completedCount !== 1 ? "s" : ""}? This cannot be undone.`}
        onConfirm={handleClearCompleted}
        onCancel={() => setShowClearConfirm(false)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete account"
        message="Are you sure you want to permanently delete your account and all your data? This cannot be undone."
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
