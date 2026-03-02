"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

interface Command {
  syntax: string;
  description: string;
  example: string;
}

interface CommandCategory {
  name: string;
  commands: Command[];
}

const CATEGORIES: CommandCategory[] = [
  {
    name: "Dates",
    commands: [
      { syntax: "today", description: "Set due date to today", example: "Buy groceries today" },
      { syntax: "tomorrow", description: "Set due date to tomorrow", example: "Call dentist tomorrow" },
      { syntax: "tonight", description: "Today at 8:00 PM", example: "Watch movie tonight" },
      { syntax: "this morning", description: "Today at 9:00 AM", example: "Yoga this morning" },
      { syntax: "this afternoon", description: "Today at 2:00 PM", example: "Meeting this afternoon" },
      { syntax: "this evening", description: "Today at 6:00 PM", example: "Cook dinner this evening" },
      { syntax: "monday", description: "This/next occurrence of the day", example: "Submit report monday" },
      { syntax: "friday", description: "This/next occurrence of the day", example: "Deploy friday" },
      { syntax: "this monday", description: "This week's Monday (or today)", example: "Standup this monday" },
      { syntax: "next monday", description: "Next week's Monday", example: "Sprint planning next monday" },
      { syntax: "next week", description: "7 days from now", example: "Start project next week" },
      { syntax: "next month", description: "1st of next month", example: "Pay rent next month" },
      { syntax: "next year", description: "Jan 1 of next year", example: "Renew license next year" },
      { syntax: "in 3 days", description: "N days from today", example: "Follow up in 3 days" },
      { syntax: "in 2 weeks", description: "N weeks from today", example: "Review in 2 weeks" },
      { syntax: "in 1 month", description: "N months from today", example: "Checkup in 1 month" },
      { syntax: "Jan 15", description: "Specific month and day", example: "Birthday party Jan 15" },
      { syntax: "March 3rd", description: "Month with ordinal day", example: "Conference March 3rd" },
      { syntax: "3/15", description: "MM/DD date format", example: "Deadline 3/15" },
      { syntax: "end of week", description: "This Sunday", example: "Clean up end of week" },
      { syntax: "eow", description: "Short for end of week", example: "Report due eow" },
      { syntax: "end of month", description: "Last day of this month", example: "Invoice end of month" },
      { syntax: "eom", description: "Short for end of month", example: "Submit expenses eom" },
    ],
  },
  {
    name: "Times",
    commands: [
      { syntax: "at 9am", description: "Set time to 9:00 AM", example: "Standup at 9am" },
      { syntax: "at 3pm", description: "Set time to 3:00 PM", example: "Pick up package at 3pm" },
      { syntax: "at 3:30pm", description: "Set time to 3:30 PM", example: "Doctor at 3:30pm" },
      { syntax: "at 15:00", description: "24-hour format", example: "Deploy at 15:00" },
      { syntax: "3pm", description: "Time without 'at' prefix", example: "Dentist 3pm" },
      { syntax: "9:30am", description: "Time with minutes, no 'at'", example: "Call client 9:30am" },
    ],
  },
  {
    name: "Priority",
    commands: [
      { syntax: "!high", description: "Set high priority", example: "Fix production bug !high" },
      { syntax: "!medium", description: "Set medium priority", example: "Update docs !medium" },
      { syntax: "!med", description: "Short for medium", example: "Refactor utils !med" },
      { syntax: "!low", description: "Set low priority", example: "Organize bookmarks !low" },
      { syntax: "!urgent", description: "Alias for high priority", example: "Server down !urgent" },
      { syntax: "!important", description: "Alias for high priority", example: "Client call !important" },
      { syntax: "!p1", description: "Priority 1 (high)", example: "Critical fix !p1" },
      { syntax: "!p2", description: "Priority 2 (medium)", example: "Enhancement !p2" },
      { syntax: "!p3", description: "Priority 3 (low)", example: "Nice to have !p3" },
    ],
  },
  {
    name: "Tags",
    commands: [
      { syntax: "#tagname", description: "Assign a tag (matches existing)", example: "Write blog post #work" },
      { syntax: "#work #personal", description: "Multiple tags at once", example: "Review slides #work #urgent" },
    ],
  },
];

const EXAMPLES: { input: string; parsed: string }[] = [
  {
    input: "Buy groceries tomorrow at 3pm !high #personal",
    parsed: "Due tomorrow at 3:00 PM, high priority, tagged personal",
  },
  {
    input: "Submit report next friday !medium #work",
    parsed: "Due next Friday, medium priority, tagged work",
  },
  {
    input: "Review PR in 2 days #dev",
    parsed: "Due in 2 days, tagged dev",
  },
  {
    input: "Client presentation March 15 at 2pm !p1 #work",
    parsed: "Due March 15 at 2:00 PM, high priority, tagged work",
  },
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
          cmd.example.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.commands.length > 0);
  }, [search]);

  const filteredExamples = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return EXAMPLES;

    return EXAMPLES.filter(
      (ex) =>
        ex.input.toLowerCase().includes(q) ||
        ex.parsed.toLowerCase().includes(q)
    );
  }, [search]);

  const hasResults =
    filteredCategories.length > 0 || filteredExamples.length > 0;
  const totalCommands = CATEGORIES.reduce(
    (sum, cat) => sum + cat.commands.length,
    0
  );

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
          placeholder={`Search ${totalCommands} commands...`}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.1] text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-black/10 dark:focus:ring-white/20 transition-all duration-200"
          aria-label="Search commands"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span className="text-xs">Clear</span>
          </button>
        )}
      </div>

      {/* Command categories */}
      {hasResults ? (
        <div className="space-y-2">
          {filteredCategories.map((category) => {
            const isExpanded =
              search.trim() !== "" || expandedCategories.has(category.name);
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
                  <div className="px-4 pb-3 space-y-1">
                    {category.commands.map((cmd) => (
                      <div
                        key={cmd.syntax}
                        className="flex items-start gap-3 py-1.5 border-t border-black/[0.03] dark:border-white/[0.05] first:border-0"
                      >
                        <code className="shrink-0 text-xs font-mono px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.08] text-black dark:text-white border border-black/[0.06] dark:border-white/[0.08]">
                          {cmd.syntax}
                        </code>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-600 dark:text-gray-400 leading-snug">
                            {cmd.description}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                            e.g. &ldquo;{cmd.example}&rdquo;
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Examples section */}
          {filteredExamples.length > 0 && (
            <div className="border border-black/[0.06] dark:border-white/[0.1] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5">
                <span className="text-xs font-semibold text-black dark:text-white uppercase tracking-wide">
                  Full Examples
                </span>
              </div>
              <div className="px-4 pb-3 space-y-3">
                {filteredExamples.map((ex) => (
                  <div key={ex.input} className="space-y-1">
                    <code className="block text-xs font-mono px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.06] text-black dark:text-white border border-black/[0.06] dark:border-white/[0.08] break-words">
                      {ex.input}
                    </code>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 pl-3">
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
            No commands matching &ldquo;{search}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
