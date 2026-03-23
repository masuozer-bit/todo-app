"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useTodos } from "@/hooks/useTodos";
import { useTags } from "@/hooks/useTags";
import { Download, Trash2, User, AlertTriangle, Calendar, FileText, Terminal, Bell, Palette, ChevronRight } from "lucide-react";
import { useTheme, PRESET_TINTS } from "@/components/ThemeProvider";
import ColorWheelPicker from "@/components/ColorWheelPicker";
import { exportTodosPDF } from "@/lib/pdf-export";
import CommandReference from "@/components/CommandReference";
import {
  getCalendarStatus,
  disconnectCalendar,
  bulkSyncCalendar,
} from "@/lib/calendar-sync-client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type Tab = "profile" | "appearance" | "calendar" | "notifications" | "data" | "commands" | "danger";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "data", label: "Data & Export", icon: Download },
  { id: "commands", label: "Commands", icon: Terminal },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
];

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
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkSyncMsg, setBulkSyncMsg] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const router = useRouter();
  const supabase = createClient();

  const { tags } = useTags(user?.id);
  const { todos, clearCompleted, exportTodos } = useTodos(user?.id, tags);
  const { permission: notifPermission, isSubscribed: notifSubscribed, subscribe: subscribeNotifications, unsubscribe: unsubscribeNotifications } = usePushNotifications();
  const { tint, setTint, lavaLamp, setLavaLamp, theme } = useTheme();

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
        scopes: "https://www.googleapis.com/auth/calendar",
        queryParams: { access_type: "offline", prompt: "consent" },
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
    await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
    await supabase.from("calendar_sync").delete().eq("user_id", user.id);
    await supabase.from("habit_calendar_sync").delete().eq("user_id", user.id);
    await supabase.from("google_tokens").delete().eq("user_id", user.id);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-400/30 border-t-black dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors">
      <Header email={user?.email} />

      <main className="max-w-4xl mx-auto px-4 pb-16">
        <div className="mt-4 mb-6">
          <h2 className="text-2xl font-bold text-black dark:text-white">Settings</h2>
        </div>

        <div className="flex gap-6">
          {/* Sidebar nav */}
          <nav className="w-48 flex-shrink-0 hidden md:block">
            <div className="space-y-0.5 sticky top-20">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isDanger = tab.id === "danger";
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left transition-default ${
                      isActive
                        ? isDanger
                          ? "bg-red-500/10 text-red-400 font-medium"
                          : "glass-nav-active text-white font-medium"
                        : isDanger
                          ? "text-red-400/60 hover:text-red-400 hover:bg-red-500/5"
                          : "text-gray-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Mobile tab bar */}
          <div className="md:hidden w-full mb-4 overflow-x-auto flex gap-1 pb-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-default ${
                    isActive
                      ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                      : "text-gray-500 hover:text-black dark:hover:text-white"
                  }`}
                >
                  <Icon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeTab === "profile" && (
              <Section title="Profile" subtitle="Your account information">
                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <Field label="Email">
                    <p className="text-sm text-black dark:text-white">{user?.email}</p>
                  </Field>
                  <Field label="Display name">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      maxLength={50}
                      className="w-full max-w-xs bg-transparent border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                    />
                  </Field>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-80 transition-default disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    {saveMsg && <span className="text-xs text-green-500">{saveMsg}</span>}
                  </div>
                </form>
              </Section>
            )}

            {activeTab === "appearance" && (
              <Section title="Appearance" subtitle="Customize the look and feel">
                {/* Preset quick picks */}
                <p className="text-xs text-gray-400 mb-3 font-medium">Presets</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {PRESET_TINTS.map((t) => {
                    const isActive = tint.toLowerCase() === t.hex.toLowerCase();
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTint(t.hex)}
                        title={t.label}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-default border ${
                          isActive
                            ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium"
                            : "border-black/10 dark:border-white/10 text-gray-500 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                          style={{ background: t.hex }}
                        />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Color wheel */}
                <p className="text-xs text-gray-400 mb-3 font-medium">Custom color</p>
                <div className="rounded-2xl glass-card-subtle p-4">
                  <ColorWheelPicker
                    value={tint}
                    onChange={(hex) => setTint(hex)}
                  />
                </div>
                {/* Lava Lamp toggle — dark mode only */}
                <div className="mt-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-black dark:text-white">Lava lamp background</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Animated glowing blobs behind glass cards{theme !== "dark" ? " (dark mode only)" : ""}</p>
                  </div>
                  <button
                    onClick={() => setLavaLamp(!lavaLamp)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${lavaLamp && theme === "dark" ? "bg-indigo-500" : "bg-black/10 dark:bg-white/10"}`}
                    role="switch"
                    aria-checked={lavaLamp}
                    disabled={theme !== "dark"}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${lavaLamp && theme === "dark" ? "translate-x-5" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>

                <p className="text-[10px] text-gray-500 mt-4">
                  Use <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px] font-mono">⌘D</kbd> to toggle dark/light mode
                </p>
              </Section>
            )}

            {activeTab === "calendar" && (
              <Section title="Google Calendar" subtitle="Sync tasks and events with Google Calendar">
                <Row
                  label="Calendar sync"
                  description={
                    calendarLoading
                      ? "Checking connection..."
                      : calendarConnected
                        ? "Connected — tasks sync to a \"Todos\" calendar"
                        : "Connect to sync tasks, habits & view your schedule"
                  }
                  action={
                    !calendarLoading && (
                      calendarConnected ? (
                        <ActionButton onClick={handleDisconnectCalendar} variant="danger">Disconnect</ActionButton>
                      ) : (
                        <ActionButton onClick={handleConnectCalendar}>Connect</ActionButton>
                      )
                    )
                  }
                />

                {calendarConnected && (
                  <>
                    <Divider />
                    <div className="py-3">
                      <p className="text-xs text-gray-400 font-medium mb-2">What syncs</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          "Tasks with due dates",
                          "Start/end times",
                          "Recurring habits",
                          "Subtasks in description",
                          "Priority color coding",
                          "Completion status",
                          "Google → app import",
                          "Reminders",
                        ].map((f) => (
                          <p key={f} className="text-[11px] text-gray-500 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-green-500 flex-shrink-0" />
                            {f}
                          </p>
                        ))}
                      </div>
                    </div>
                    <Divider />
                    <Row
                      label="Sync all"
                      description={bulkSyncMsg || "Push all existing tasks and habits to Google Calendar"}
                      action={
                        <ActionButton onClick={async () => {
                          setBulkSyncing(true);
                          setBulkSyncMsg("Syncing...");
                          const result = await bulkSyncCalendar();
                          if (result.success) {
                            setBulkSyncMsg(`Synced ${result.synced_todos ?? 0} tasks, ${result.synced_habits ?? 0} habits`);
                          } else {
                            setBulkSyncMsg(result.error || "Failed");
                          }
                          setBulkSyncing(false);
                          setTimeout(() => setBulkSyncMsg(""), 5000);
                        }} disabled={bulkSyncing}>
                          {bulkSyncing ? "Syncing..." : "Sync all"}
                        </ActionButton>
                      }
                    />
                  </>
                )}
              </Section>
            )}

            {activeTab === "notifications" && (
              <Section title="Notifications" subtitle="Stay on top of your tasks">
                <Row
                  label="Push notifications"
                  description={
                    notifPermission === "denied"
                      ? "Blocked — enable in browser settings"
                      : notifSubscribed
                        ? "Active — you'll be notified when tasks are due"
                        : "Get reminders when tasks are due"
                  }
                  action={
                    <ActionButton
                      onClick={notifSubscribed ? unsubscribeNotifications : subscribeNotifications}
                      disabled={notifPermission === "denied"}
                      variant={notifSubscribed ? "danger" : "default"}
                    >
                      {notifSubscribed ? "Disable" : "Enable"}
                    </ActionButton>
                  }
                />

                {notifSubscribed && (
                  <>
                    <Divider />
                    <div className="py-3">
                      <p className="text-xs text-gray-400 font-medium mb-2">When you&apos;ll be notified</p>
                      <div className="space-y-1.5">
                        {[
                          "Timed tasks starting now or in ~15 min",
                          "All-day tasks due today (8 AM)",
                          "Overdue tasks (9 AM daily digest)",
                        ].map((item) => (
                          <p key={item} className="text-[11px] text-gray-500 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                            {item}
                          </p>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-600 mt-3">Times based on UTC. Works when browser is closed.</p>
                    </div>
                  </>
                )}
              </Section>
            )}

            {activeTab === "data" && (
              <Section title="Data & Export" subtitle="Export or clean up your data">
                <Row
                  label="Export JSON"
                  description="All tasks with subtasks, notes, and tags"
                  action={<ActionButton onClick={() => exportTodos("json")}>Export</ActionButton>}
                />
                <Divider />
                <Row
                  label="Export CSV"
                  description="Compatible with Excel and Google Sheets"
                  action={<ActionButton onClick={() => exportTodos("csv")}>Export</ActionButton>}
                />
                <Divider />
                <Row
                  label="Export PDF"
                  description="Printable task report"
                  action={
                    <ActionButton onClick={() => exportTodosPDF(todos, { title: "Task Report" })}>
                      <FileText size={13} className="mr-1.5" />
                      Export
                    </ActionButton>
                  }
                />
                <Divider />
                <Row
                  label="Clear completed"
                  description={`${completedCount} completed task${completedCount !== 1 ? "s" : ""} will be deleted`}
                  action={
                    <ActionButton onClick={() => setShowClearConfirm(true)} disabled={completedCount === 0}>
                      Clear
                    </ActionButton>
                  }
                />
              </Section>
            )}

            {activeTab === "commands" && (
              <Section title="Smart Input Commands" subtitle="Type these shortcuts in the task input to quickly set dates, times, priorities, and tags">
                <CommandReference />
              </Section>
            )}

            {activeTab === "danger" && (
              <Section title="Danger Zone" subtitle="Irreversible actions" danger>
                <Row
                  label="Delete account"
                  description="Permanently delete your account and all data. Cannot be undone."
                  action={
                    <ActionButton onClick={() => setShowDeleteConfirm(true)} variant="danger">
                      Delete account
                    </ActionButton>
                  }
                />
              </Section>
            )}
          </div>
        </div>
      </main>

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

/* ──── Reusable sub-components ──── */

function Section({ title, subtitle, danger, children }: { title: string; subtitle?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className={`glass-card p-6 ${danger ? "border border-red-500/20" : ""}`}>
      <h3 className={`text-base font-semibold mb-0.5 ${danger ? "text-red-400" : "text-black dark:text-white"}`}>
        {title}
      </h3>
      {subtitle && <p className="text-xs text-gray-500 mb-5">{subtitle}</p>}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-400 font-medium block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, description, action }: { label: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm text-black dark:text-white">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-black/5 dark:border-white/5" />;
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm transition-default disabled:opacity-40 disabled:cursor-not-allowed ${
        variant === "danger"
          ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
          : "border-black/10 dark:border-white/10 text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
