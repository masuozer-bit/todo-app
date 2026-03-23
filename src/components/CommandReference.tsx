"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronRight, Keyboard } from "lucide-react";

interface Command {
  syntax: string;
  description: string;
  example?: string;
}

interface CommandCategory {
  name: string;
  icon: string;
  commands: Command[];
}

const CATEGORIES: CommandCategory[] = [
  {
    name: "Dates",
    icon: "📅",
    commands: [
      { syntax: "today", description: "Due today", example: "Buy groceries today" },
      { syntax: "tomorrow", description: "Due tomorrow", example: "Call dentist tomorrow" },
      { syntax: "tonight", description: "Today at 8 PM", example: "Watch movie tonight" },
      { syntax: "this morning", description: "Today at 9 AM", example: "Yoga this morning" },
      { syntax: "this afternoon", description: "Today at 2 PM", example: "Meeting this afternoon" },
      { syntax: "this evening", description: "Today at 6 PM", example: "Cook dinner this evening" },
      { syntax: "monday … sunday", description: "This/next occurrence of that day", example: "Submit report friday" },
      { syntax: "this monday", description: "This week's Monday", example: "Standup this monday" },
      { syntax: "next monday", description: "Next week's Monday", example: "Sprint planning next monday" },
      { syntax: "next week", description: "7 days from now", example: "Start project next week" },
      { syntax: "next month", description: "1st of next month", example: "Pay rent next month" },
      { syntax: "next year", description: "Jan 1 of next year", example: "Renew license next year" },
      { syntax: "in 3 days", description: "N days from today", example: "Follow up in 3 days" },
      { syntax: "in 2 weeks", description: "N weeks from today", example: "Review in 2 weeks" },
      { syntax: "in 1 month", description: "N months from today", example: "Checkup in 1 month" },
      { syntax: "Jan 15", description: "Specific date (month + day)", example: "Birthday party Jan 15" },
      { syntax: "March 3rd", description: "With ordinal suffix", example: "Conference March 3rd" },
      { syntax: "3/15", description: "MM/DD format", example: "Deadline 3/15" },
      { syntax: "on Jan 15", description: "Date with \"on\" prefix", example: "Meet on Jan 15" },
      { syntax: "end of week / eow", description: "This Sunday", example: "Clean up eow" },
      { syntax: "end of month / eom", description: "Last day of this month", example: "Invoice eom" },
    ],
  },
  {
    name: "Times",
    icon: "🕐",
    commands: [
      { syntax: "at 9am", description: "Set time (12h)", example: "Standup at 9am" },
      { syntax: "at 3:30pm", description: "With minutes", example: "Doctor at 3:30pm" },
      { syntax: "at 15:00", description: "24-hour format", example: "Deploy at 15:00" },
      { syntax: "3pm", description: "Without \"at\" prefix", example: "Dentist 3pm" },
      { syntax: "3pm-5pm", description: "Time range (start & end)", example: "Workshop 3pm-5pm" },
      { syntax: "from 3pm to 5pm", description: "Verbose time range", example: "Meeting from 2pm to 4pm" },
    ],
  },
  {
    name: "Priority",
    icon: "🔴",
    commands: [
      { syntax: "!high", description: "High priority", example: "Fix bug !high" },
      { syntax: "!medium / !med", description: "Medium priority", example: "Update docs !med" },
      { syntax: "!low", description: "Low priority", example: "Organize files !low" },
      { syntax: "!urgent", description: "Alias for high", example: "Server down !urgent" },
      { syntax: "!important", description: "Alias for high", example: "Client call !important" },
      { syntax: "!p1 / !p2 / !p3", description: "Priority 1–3 (high → low)", example: "Critical fix !p1" },
    ],
  },
  {
    name: "Lists & Events",
    icon: "📂",
    commands: [
      { syntax: "#ListName", description: "Assign to a list (from suggestions)", example: "Buy groceries #Personal" },
      { syntax: "@EventName", description: "Assign to an event (from suggestions)", example: "Prepare slides @Workshop" },
    ],
  },
];

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "N", description: "New task" },
  { keys: "/ or ⌘K", description: "Search" },
  { keys: "C", description: "Toggle calendar & schedule panel" },
  { keys: "S", description: "Open week planner" },
  { keys: "⌘D", description: "Toggle dark / light mode" },
  { keys: "?", description: "Keyboard shortcuts overlay" },
  { keys: "Enter", description: "Save / confirm" },
  { keys: "Esc", description: "Cancel / close / blur" },
];

const EXAMPLES: { input: string; parsed: string }[] = [
  { input: "Buy groceries tomorrow at 3pm !high #Personal", parsed: "Due tomorrow 3:00 PM · High · Personal list" },
  { input: "Submit report next friday !med", parsed: "Due next Friday · Medium" },
  { input: "Workshop 2pm-4pm today", parsed: "Due today 2:00–4:00 PM" },
  { input: "Prepare slides in 2 days @Workshop", parsed: "Due in 2 days · Workshop event" },
  { input: "Client presentation March 15 at 2pm !p1", parsed: "Due Mar 15 2:00 PM · High" },
  { input: "Clean up eow !low", parsed: "Due Sunday · Low" },
];

export default function CommandReference() {
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES.map((c) => c.name))
  );

  function toggleCategory(name: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      commands: cat.commands.filter(
        (cmd) =>
          cmd.syntax.toLowerCase().includes(q) ||
          cmd.description.toLowerCase().includes(q) ||
          (cmd.example && cmd.example.toLowerCase().includes(q))
      ),
    })).filter((cat) => cat.commands.length > 0);
  }, [search]);

  const filteredShortcuts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return SHORTCUTS;
    return SHORTCUTS.filter(
      (s) => s.keys.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredExamples = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return EXAMPLES;
    return EXAMPLES.filter(
      (ex) => ex.input.toLowerCase().includes(q) || ex.parsed.toLowerCase().includes(q)
    );
  }, [search]);

  const totalCommands = CATEGORIES.reduce((sum, cat) => sum + cat.commands.length, 0);
  const hasResults = filteredCategories.length > 0 || filteredExamples.length > 0 || filteredShortcuts.length > 0;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${totalCommands} commands & ${SHORTCUTS.length} shortcuts...`}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.1] text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-black/10 dark:focus:ring-white/20 transition-all duration-200"
          aria-label="Search commands"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {hasResults ? (
        <div className="space-y-2">
          {/* Keyboard Shortcuts */}
          {filteredShortcuts.length > 0 && (
            <div className="border border-black/[0.06] dark:border-white/[0.1] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCategory("__shortcuts")}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-default"
              >
                <div className="flex items-center gap-2">
                  <Keyboard size={13} className="text-gray-400" />
                  <span className="text-xs font-semibold text-black dark:text-white uppercase tracking-wide">
                    Keyboard Shortcuts
                  </span>
                  <span className="text-[10px] text-gray-400 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-full">
                    {filteredShortcuts.length}
                  </span>
                </div>
                {(search.trim() !== "" || expandedCategories.has("__shortcuts")) ? (
                  <ChevronDown size={14} className="text-gray-400" />
                ) : (
                  <ChevronRight size={14} className="text-gray-400" />
                )}
              </button>
              {(search.trim() !== "" || expandedCategories.has("__shortcuts")) && (
                <div className="px-4 pb-3 grid grid-cols-2 gap-x-6 gap-y-1">
                  {filteredShortcuts.map((s) => (
                    <div key={s.keys} className="flex items-center justify-between py-1.5 border-t border-black/[0.03] dark:border-white/[0.05]">
                      <span className="text-xs text-gray-600 dark:text-gray-400">{s.description}</span>
                      <kbd className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.08] text-black dark:text-white border border-black/[0.06] dark:border-white/[0.08]">
                        {s.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Command categories */}
          {filteredCategories.map((category) => {
            const isExpanded = search.trim() !== "" || expandedCategories.has(category.name);
            return (
              <div
                key={category.name}
                className="border border-black/[0.06] dark:border-white/[0.1] rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleCategory(category.name)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-default"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{category.icon}</span>
                    <span className="text-xs font-semibold text-black dark:text-white uppercase tracking-wide">
                      {category.name}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-full">
                      {category.commands.length}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 space-y-0">
                    {category.commands.map((cmd) => (
                      <div
                        key={cmd.syntax}
                        className="flex items-start gap-3 py-2 border-t border-black/[0.03] dark:border-white/[0.05] first:border-0"
                      >
                        <code className="shrink-0 text-[11px] font-mono px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.08] text-black dark:text-white border border-black/[0.06] dark:border-white/[0.08]">
                          {cmd.syntax}
                        </code>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-600 dark:text-gray-400 leading-snug">
                            {cmd.description}
                          </p>
                          {cmd.example && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                              e.g. &ldquo;{cmd.example}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Examples */}
          {filteredExamples.length > 0 && (
            <div className="border border-black/[0.06] dark:border-white/[0.1] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2">
                <span className="text-sm">💡</span>
                <span className="text-xs font-semibold text-black dark:text-white uppercase tracking-wide">
                  Examples
                </span>
              </div>
              <div className="px-4 pb-3 space-y-3">
                {filteredExamples.map((ex) => (
                  <div key={ex.input} className="space-y-1">
                    <code className="block text-xs font-mono px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.06] text-black dark:text-white border border-black/[0.06] dark:border-white/[0.08] break-words">
                      {ex.input}
                    </code>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 pl-3">
                      → {ex.parsed}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-black/[0.06] dark:border-white/[0.1] rounded-xl p-8 text-center">
          <p className="text-sm text-gray-400">
            No results for &ldquo;{search}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
