"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useTodos } from "@/hooks/useTodos";
import { useTags } from "@/hooks/useTags";
import TagManager from "@/components/TagManager";
import Link from "next/link";
import { Download, Trash2, User, AlertTriangle, Calendar, FileText, Terminal, Bell, Palette, ChevronRight, ArrowLeft, Languages } from "lucide-react";
import { useTheme, ACCENT_PRESETS, type ThemePreference, type Density } from "@/components/ThemeProvider";
import { exportTodosPDF } from "@/lib/pdf-export";
import CommandReference from "@/components/CommandReference";
import {
  getCalendarStatus,
  disconnectCalendar,
  bulkSyncCalendar,
} from "@/lib/calendar-sync-client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useI18n } from "@/components/I18nProvider";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { LOCALES } from "@/lib/i18n";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type Tab = "profile" | "appearance" | "language" | "calendar" | "notifications" | "data" | "commands" | "danger";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "language", label: "Language & format", icon: Languages },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "data", label: "Data & Export", icon: Download },
  { id: "commands", label: "Commands", icon: Terminal },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
];

const THEME_CHOICES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const DENSITY_CHOICES: { value: Density; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

const DEFAULT_VIEWS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "all", label: "All Tasks" },
];

export default function SettingsPage() {
  // Same phone viewport handling as the app shell
  useVisualViewport();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [defaultView, setDefaultView] = useState("today");
  const [passwordMsg, setPasswordMsg] = useState("");
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

  // Tasks are only needed for export and "clear completed" — load them when
  // that tab is opened instead of on every visit to settings
  const dataUserId = activeTab === "data" ? user?.id : undefined;
  const { tags, addTag, deleteTag } = useTags(dataUserId);
  const { todos, clearCompleted, exportTodos } = useTodos(dataUserId, tags);
  const { permission: notifPermission, isSubscribed: notifSubscribed, subscribe: subscribeNotifications, unsubscribe: unsubscribeNotifications } = usePushNotifications();
  const { themePreference, setThemePreference, accent, setAccent, density, setDensity } = useTheme();
  /* Whether the app opens on the focus view. The dashboard reads the same key. */
  const [focusStart, setFocusStart] = useState(true);
  useEffect(() => {
    try { setFocusStart(localStorage.getItem("focusStart") !== "off"); } catch { /* ignore */ }
  }, []);
  const changeFocusStart = (on: boolean) => {
    setFocusStart(on);
    try {
      localStorage.setItem("focusStart", on ? "on" : "off");
      // Turning it off should also stop the next reload from going there
      if (!on) localStorage.setItem("focusView", "off");
    } catch { /* ignore */ }
  };
  const { locale, setLocale, t } = useI18n();

  // Esc leaves settings, the same way the panel closes elsewhere
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (document.querySelector('[aria-modal="true"]')) return;
      router.push("/dashboard");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("defaultView");
      if (stored) setDefaultView(stored);
    } catch { /* ignore */ }
  }, []);

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error ? error.message : "Password changed");
    if (!error) setNewPassword("");
    setTimeout(() => setPasswordMsg(""), 3000);
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

  /* Deletes the data, not the login — the wording says so */
  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    const tables = [
      "push_subscriptions",
      "calendar_sync",
      "habit_calendar_sync",
      "google_tokens",
      "todos",
      "events",
      "habits",
      "rules",
      "templates",
      "tags",
      "lists",
      "folders",
    ];
    for (const table of tables) {
      await supabase.from(table).delete().eq("user_id", user.id);
    }
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
      <div className="settings-shell flex items-center justify-center">
        <span className="text-sm text-text-faint">{t("Loading...")}</span>
      </div>
    );
  }

  return (
    <div className="settings-shell">
      <div className="app-content">
        <div className="app-col-head">
          <Link href="/dashboard" className="btn btn-ghost flex-none" aria-label={t("Back to tasks")}>
            <ArrowLeft size={16} />
            {t("Back")}
          </Link>
          <h1 className="text-xl font-semibold text-text truncate min-w-0">{t("Settings")}</h1>
        </div>

        <div className="app-col-body">
          <div className="flex gap-6 px-4 py-4 max-w-[1000px]">
            {/* Tabs, left of the content */}
            <nav className="w-48 flex-none hidden md:block" aria-label={t("Settings")}>
              <div className="sticky top-0">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`nav-row w-full ${isActive ? "is-active" : ""}`}
                      style={tab.id === "danger" && !isActive ? { color: "var(--danger)" } : undefined}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="flex-none nav-row-icon"><Icon size={18} /></span>
                      <span className="flex-1 text-left truncate">{t(tab.label)}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Tabs as a strip on a phone */}
            <div className="md:hidden w-full mb-4 overflow-x-auto flex gap-1 pb-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`chip flex-none h-8 ${isActive ? "chip-accent" : ""}`}
                  >
                    <Icon size={13} />
                    {t(tab.label)}
                  </button>
                );
              })}
            </div>


          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeTab === "profile" && (
              <Section title={t("Profile")} subtitle={t("Your account information")}>
                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <Field label="Email">
                    <p className="text-sm text-text">{user?.email}</p>
                  </Field>
                  <Field label="Display name">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t("Your name")}
                      maxLength={50}
                      className="w-full max-w-xs bg-transparent border border-border rounded px-3 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                    />
                  </Field>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 rounded btn-primary text-sm font-medium hover:opacity-80 transition-default disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    {saveMsg && <span className="text-xs text-green-500">{saveMsg}</span>}
                  </div>
                </form>

                <Divider />

                <form onSubmit={handleChangePassword} className="space-y-3">
                  <Field label="New password">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t("At least 8 characters")}
                      autoComplete="new-password"
                      className="w-full max-w-xs bg-transparent border border-border rounded px-3 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                    />
                  </Field>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={newPassword.length < 8}
                      className="px-4 py-2 rounded btn-primary text-sm font-medium hover:opacity-80 transition-default disabled:opacity-40"
                    >{t("Change password")}</button>
                    {passwordMsg && <span className="text-xs text-green-500">{passwordMsg}</span>}
                  </div>
                </form>
              </Section>
            )}

            {activeTab === "appearance" && (
              <Section title={t("Appearance")} subtitle={t("Customize the look and feel")}>
                <div className="space-y-6">
                  <Field label={t("Theme")}>
                    <div className="flex flex-wrap gap-2">
                      {THEME_CHOICES.map((choice) => (
                        <Choice
                          key={choice.value}
                          active={themePreference === choice.value}
                          onClick={() => setThemePreference(choice.value)}
                        >
                          {t(choice.label)}
                        </Choice>
                      ))}
                    </div>
                  </Field>

                  <Field label={t("Accent color")}>
                    <div className="flex flex-wrap gap-2">
                      {ACCENT_PRESETS.map((preset) => (
                        <Choice
                          key={preset.id}
                          active={accent === preset.id}
                          onClick={() => setAccent(preset.id)}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ background: preset.dark.base }}
                          />
                          {t(preset.label)}
                        </Choice>
                      ))}
                    </div>
                  </Field>

                  <Field label={t("Density")}>
                    <div className="flex flex-wrap gap-2">
                      {DENSITY_CHOICES.map((choice) => (
                        <Choice
                          key={choice.value}
                          active={density === choice.value}
                          onClick={() => setDensity(choice.value)}
                        >
                          {t(choice.label)}
                        </Choice>
                      ))}
                    </div>
                  </Field>

                  <Field label={t("Start in the focus view")}>
                    <div className="flex flex-wrap gap-2">
                      <Choice active={focusStart} onClick={() => changeFocusStart(true)}>
                        {t("On")}
                      </Choice>
                      <Choice active={!focusStart} onClick={() => changeFocusStart(false)}>
                        {t("Off")}
                      </Choice>
                    </div>
                  </Field>

                  <p className="text-xs text-text-muted">
                    {t("Use")}
                    <kbd className="mx-1 px-1.5 py-0.5 rounded surface-2 text-xs font-mono">
                      {"\u2318\u21E7L"}
                    </kbd>
                    {t("to switch between dark and light.")}
                  </p>
                </div>
              </Section>
            )}

            {activeTab === "language" && (
              <Section title={t("Language & format")} subtitle={t("How the app talks to you")}>
                <Field label={t("Language")}>
                  <div className="flex gap-2">
                    {LOCALES.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => setLocale(l.value)}
                        className={`px-3 py-1.5 rounded text-sm border transition-default ${
                          locale === l.value
                            ? "border-border-strong surface-2 text-text font-medium"
                            : "border-border text-text-muted hover:text-text"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Divider />

                <Field label={t("Default view")}>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_VIEWS.map((v) => (
                      <button
                        key={v.value}
                        onClick={() => {
                          setDefaultView(v.value);
                          try { localStorage.setItem("defaultView", v.value); } catch { /* ignore */ }
                        }}
                        className={`px-3 py-1.5 rounded text-sm border transition-default ${
                          defaultView === v.value
                            ? "border-border-strong surface-2 text-text font-medium"
                            : "border-border text-text-muted hover:text-text"
                        }`}
                      >
                        {t(v.label)}
                      </button>
                    ))}
                  </div>
                </Field>

                <Divider />

                <p className="text-xs text-text-muted">
                  {t("Times are shown in 24-hour format and weeks start on Monday.")}
                </p>
              </Section>
            )}

            {activeTab === "calendar" && (
              <Section title={t("Google Calendar")} subtitle={t("Sync tasks and events with Google Calendar")}>
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
                        <ActionButton onClick={handleDisconnectCalendar} variant="danger">{t("Disconnect")}</ActionButton>
                      ) : (
                        <ActionButton onClick={handleConnectCalendar}>{t("Connect")}</ActionButton>
                      )
                    )
                  }
                />

                {calendarConnected && (
                  <>
                    <Divider />
                    <div className="py-3">
                      <p className="text-xs text-text-faint font-medium mb-2">{t("What syncs")}</p>
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
                          <p key={f} className="text-xs text-text-muted flex items-center gap-1.5">
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
              <Section title={t("Notifications")} subtitle={t("Stay on top of your tasks")}>
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
                      <p className="text-xs text-text-faint font-medium mb-2">When you&apos;ll be notified</p>
                      <div className="space-y-1.5">
                        {[
                          "Timed tasks starting now or in ~15 min",
                          "All-day tasks due today (8 AM)",
                          "Overdue tasks (9 AM daily digest)",
                        ].map((item) => (
                          <p key={item} className="text-xs text-text-muted flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                            {item}
                          </p>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-3">{t("The daily reminder goes out in the morning in your own timezone and arrives even when the browser is closed.")}</p>
                    </div>
                  </>
                )}
              </Section>
            )}

            {activeTab === "data" && (
              <Section title={t("Data & Export")} subtitle={t("Export or clean up your data")}>
                <Row
                  label="Export JSON"
                  description="All tasks with subtasks, notes, and tags"
                  action={<ActionButton onClick={() => exportTodos("json")}>{t("Export")}</ActionButton>}
                />
                <Divider />
                <Row
                  label="Export CSV"
                  description="Compatible with Excel and Google Sheets"
                  action={<ActionButton onClick={() => exportTodos("csv")}>{t("Export")}</ActionButton>}
                />
                <Divider />
                <Row
                  label="Export PDF"
                  description="Printable task report"
                  action={
                    <ActionButton onClick={() => exportTodosPDF(todos, { title: "Task Report" })}>
                      <FileText size={13} className="mr-1.5" />{t("Export")}</ActionButton>
                  }
                />
                <Divider />
                <Row
                  label="Clear completed"
                  description={`${completedCount} completed task${completedCount !== 1 ? "s" : ""} will be deleted`}
                  action={
                    <ActionButton onClick={() => setShowClearConfirm(true)} disabled={completedCount === 0}>{t("Clear")}</ActionButton>
                  }
                />
                <Divider />
                {/* Tags belong to the account, not to one task, so managing
                    them lives here rather than in the task panel. */}
                <div className="pt-2">
                  <p className="text-xs text-text-faint font-medium mb-2">{t("Tags")}</p>
                  <TagManager tags={tags} onAdd={addTag} onDelete={deleteTag} />
                </div>
              </Section>
            )}

            {activeTab === "commands" && (
              <Section title={t("Smart Input Commands")} subtitle="Type these shortcuts in the task input to quickly set dates, times, priorities, and tags">
                <CommandReference />
              </Section>
            )}

            {activeTab === "danger" && (
              <Section title={t("Danger Zone")} subtitle={t("Irreversible actions")} danger>
                <Row
                  label="Delete all data"
                  description="Removes every task, project, habit, list and setting. Your login stays, so you can start over with an empty account. Cannot be undone."
                  action={
                    <ActionButton onClick={() => setShowDeleteConfirm(true)} variant="danger">{t("Delete all data")}</ActionButton>
                  }
                />
              </Section>
            )}
          </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        title={t("Clear completed tasks")}
        message={t("Delete {n} completed tasks? This cannot be undone.", { n: completedCount })}
        onConfirm={handleClearCompleted}
        onCancel={() => setShowClearConfirm(false)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t("Delete all data")}
        message={t("This removes every task, project, habit, list and setting. Your login stays and the account will be empty. This cannot be undone.")}
        confirmLabel={t("Delete everything")}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

/* ──── Reusable sub-components ──── */

function Section({ title, subtitle, danger, children }: { title: string; subtitle?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className="surface border rounded-lg p-6" style={danger ? { borderColor: "var(--danger)" } : { borderColor: "var(--border)" }}>
      <h3 className="text-base font-medium mb-0.5" style={danger ? { color: "var(--danger)" } : { color: "var(--text)" }}>
        {title}
      </h3>
      {subtitle && <p className="text-[13px] text-text-muted mb-5">{subtitle}</p>}
      {children}
    </div>
  );
}

/** One option in a small group: theme, accent, density. */
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 h-8 px-3 rounded text-sm border transition-default ${
        active
          ? "border-border-strong surface-2 text-text font-medium"
          : "border-border text-text-muted hover:text-text hover:border-black/20 dark:hover:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-text-faint font-medium block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, description, action }: { label: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm text-text">{label}</p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
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
          : "border-border text-text hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}
