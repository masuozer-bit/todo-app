import type { Todo, Priority } from "@/lib/types";

interface ExportOptions {
  title?: string;
  filterDate?: string | null;
  listName?: string | null;
}

/* ── helpers ── */

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(d: string): string {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateLong(d: string): string {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":");
  const hr = parseInt(h, 10);
  const ap = hr >= 12 ? "PM" : "AM";
  const d = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${d}:${m} ${ap}`;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRIO_COLOR: Record<Priority, string> = { high: "#e74c3c", medium: "#f39c12", low: "#3498db", none: "#95a5a6" };
const PRIO_BG: Record<Priority, string> = { high: "#fdecea", medium: "#fef5e7", low: "#ebf5fb", none: "#f4f6f7" };
const PRIO_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low", none: "" };

type Urgency = "overdue" | "today" | "week" | "upcoming" | "someday";
const URG_META: Record<Urgency, { label: string; color: string; bg: string }> = {
  overdue:  { label: "Overdue",   color: "#c0392b", bg: "#fdf2f2" },
  today:    { label: "Today",     color: "#e67e22", bg: "#fef9f0" },
  week:     { label: "This Week", color: "#2980b9", bg: "#f0f7fc" },
  upcoming: { label: "Upcoming",  color: "#27ae60", bg: "#f0faf4" },
  someday:  { label: "Someday",   color: "#7f8c8d", bg: "#f7f9f9" },
};

function classifyUrgency(todo: Todo, todayStr: string, eowStr: string): Urgency {
  const due = todo.due_date || todo.start_date;
  if (!due) return "someday";
  if (due < todayStr) return "overdue";
  if (due === todayStr) return "today";
  if (due <= eowStr) return "week";
  return "upcoming";
}

/* ── render a single task row ── */

function renderTask(todo: Todo): string {
  const prio = todo.priority;
  const prioHtml = prio !== "none"
    ? `<span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${PRIO_COLOR[prio]};background:${PRIO_BG[prio]};padding:2px 7px;border-radius:3px;">${PRIO_LABEL[prio]}</span>`
    : "";

  let timeStr = "";
  if (todo.start_time) {
    timeStr = fmtTime(todo.start_time);
    if (todo.end_time) timeStr += ` – ${fmtTime(todo.end_time)}`;
  }

  const metaParts: string[] = [];
  if (todo.due_date) metaParts.push(fmtDate(todo.due_date));
  if (timeStr) metaParts.push(timeStr);

  const completedSub = todo.subtasks?.filter(s => s.completed).length ?? 0;
  const totalSub = todo.subtasks?.length ?? 0;

  const tagsHtml = (todo.tags && todo.tags.length > 0)
    ? todo.tags.map(t => `<span style="display:inline-block;font-size:9px;color:#666;background:#f0f0f0;padding:1px 6px;border-radius:3px;margin-right:3px;">${esc(t.name)}</span>`).join("")
    : "";

  const subtasksHtml = (todo.subtasks && todo.subtasks.length > 0)
    ? `<div style="margin-top:6px;padding-left:4px;">${todo.subtasks.map(s =>
        `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px;color:${s.completed ? "#bbb" : "#555"};">
          <span style="font-size:12px;">${s.completed ? "✓" : "○"}</span>
          <span style="${s.completed ? "text-decoration:line-through;" : ""}">${esc(s.title)}</span>
        </div>`
      ).join("")}</div>`
    : "";

  const notesHtml = todo.notes
    ? `<div style="margin-top:6px;font-size:11px;color:#888;line-height:1.5;padding-left:4px;border-left:2px solid #e8e8e8;padding:4px 0 4px 10px;">${esc(todo.notes.length > 200 ? todo.notes.slice(0, 200) + "…" : todo.notes)}</div>`
    : "";

  return `
    <tr style="page-break-inside:avoid;">
      <td style="width:24px;vertical-align:top;padding:10px 0 10px 12px;color:${todo.completed ? "#ccc" : "#333"};font-size:14px;">
        ${todo.completed ? "✓" : "○"}
      </td>
      <td style="padding:10px 12px 10px 6px;vertical-align:top;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:13px;font-weight:600;color:${todo.completed ? "#bbb" : "#222"};${todo.completed ? "text-decoration:line-through;" : ""}">${esc(todo.title)}</span>
          ${prioHtml}
        </div>
        ${metaParts.length > 0 ? `<div style="font-size:11px;color:#999;margin-top:3px;">${metaParts.join(" · ")}</div>` : ""}
        ${tagsHtml ? `<div style="margin-top:4px;">${tagsHtml}</div>` : ""}
        ${subtasksHtml}
        ${notesHtml}
      </td>
      <td style="width:60px;vertical-align:top;padding:10px 12px 10px 0;text-align:right;">
        ${totalSub > 0 ? `<span style="font-size:10px;color:#aaa;">${completedSub}/${totalSub}</span>` : ""}
      </td>
    </tr>`;
}

/* ── main export ── */

export function exportTodosPDF(todos: Todo[], options: ExportOptions = {}): void {
  const title = options.title || "Task Report";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const todayStr = toDateStr(now);
  const eow = new Date(now); eow.setDate(eow.getDate() + (7 - eow.getDay()));
  const eowStr = toDateStr(eow);

  const activeTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);
  const total = todos.length;
  const done = completedTodos.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Group active by urgency
  const urgencyOrder: Urgency[] = ["overdue", "today", "week", "upcoming", "someday"];
  const urgencyGroups: Record<Urgency, Todo[]> = { overdue: [], today: [], week: [], upcoming: [], someday: [] };
  for (const t of activeTodos) urgencyGroups[classifyUrgency(t, todayStr, eowStr)].push(t);

  // Sort each group by priority
  const prioOrd: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };
  for (const key of urgencyOrder) {
    urgencyGroups[key].sort((a, b) => prioOrd[a.priority] - prioOrd[b.priority]);
  }

  // Stats
  const overdue = urgencyGroups.overdue.length;
  const todayCount = urgencyGroups.today.length;
  const highCount = activeTodos.filter(t => t.priority === "high").length;

  // Build urgency sections
  const urgencySectionsHtml = urgencyOrder.map(urg => {
    const group = urgencyGroups[urg];
    if (group.length === 0) return "";
    const meta = URG_META[urg];
    return `
      <div style="margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${meta.color};flex-shrink:0;"></span>
          <span style="font-size:14px;font-weight:700;color:${meta.color};letter-spacing:-0.2px;">${meta.label}</span>
          <span style="font-size:11px;color:#aaa;font-weight:500;">${group.length} task${group.length !== 1 ? "s" : ""}</span>
          <span style="flex:1;height:1px;background:#eee;"></span>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #f0f0f0;border-radius:8px;overflow:hidden;">
          ${group.map((t, i) =>
            `${i > 0 ? '<tr><td colspan="3" style="border-top:1px solid #f5f5f5;"></td></tr>' : ""}${renderTask(t)}`
          ).join("")}
        </table>
      </div>`;
  }).join("");

  // Completed section
  const completedHtml = completedTodos.length > 0
    ? `
      <div style="margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#27ae60;flex-shrink:0;"></span>
          <span style="font-size:14px;font-weight:700;color:#27ae60;">Completed</span>
          <span style="font-size:11px;color:#aaa;font-weight:500;">${completedTodos.length}</span>
          <span style="flex:1;height:1px;background:#eee;"></span>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #f0f0f0;border-radius:8px;overflow:hidden;">
          ${completedTodos.map((t, i) =>
            `${i > 0 ? '<tr><td colspan="3" style="border-top:1px solid #f0f0f0;"></td></tr>' : ""}${renderTask(t)}`
          ).join("")}
        </table>
      </div>`
    : "";

  const filterInfo = [
    options.filterDate ? `Date: ${fmtDateLong(options.filterDate)}` : null,
    options.listName ? `List: ${esc(options.listName)}` : null,
  ].filter(Boolean).join(" · ");

  const circumference = 2 * Math.PI * 40;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <style>
    @page { margin: 1.8cm 2cm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      color: #222; background: #fff; line-height: 1.5; font-size: 13px;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .page { max-width: 680px; margin: 0 auto; padding: 32px 0; }
    @media print { .page { padding: 0; max-width: 100%; } .no-print { display: none !important; } }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:24px;border-bottom:2px solid #111;margin-bottom:28px;">
    <div>
      <h1 style="font-size:26px;font-weight:800;color:#111;letter-spacing:-0.5px;margin-bottom:2px;">${esc(title)}</h1>
      <p style="font-size:12px;color:#999;">${dateStr} · ${timeStr}</p>
      ${filterInfo ? `<p style="font-size:11px;color:#bbb;margin-top:2px;">${filterInfo}</p>` : ""}
    </div>
    <div style="text-align:center;">
      <svg width="88" height="88" viewBox="0 0 88 88" style="transform:rotate(-90deg);">
        <circle cx="44" cy="44" r="40" fill="none" stroke="#f0f0f0" stroke-width="5"/>
        <circle cx="44" cy="44" r="40" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"
          stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - pct / 100)}"/>
      </svg>
      <div style="margin-top:-62px;position:relative;">
        <span style="font-size:22px;font-weight:800;color:#111;">${pct}%</span><br>
        <span style="font-size:10px;color:#aaa;font-weight:500;">complete</span>
      </div>
    </div>
  </div>

  <!-- Quick stats -->
  <div style="display:flex;gap:12px;margin-bottom:32px;">
    <div style="flex:1;padding:14px 16px;background:#fafafa;border:1px solid #f0f0f0;border-radius:8px;">
      <div style="font-size:22px;font-weight:800;color:#111;">${activeTodos.length}</div>
      <div style="font-size:10px;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Active</div>
    </div>
    <div style="flex:1;padding:14px 16px;background:#fafafa;border:1px solid #f0f0f0;border-radius:8px;">
      <div style="font-size:22px;font-weight:800;color:#27ae60;">${done}</div>
      <div style="font-size:10px;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Done</div>
    </div>
    ${overdue > 0 ? `
    <div style="flex:1;padding:14px 16px;background:#fdf2f2;border:1px solid #fce4e4;border-radius:8px;">
      <div style="font-size:22px;font-weight:800;color:#c0392b;">${overdue}</div>
      <div style="font-size:10px;color:#c0392b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Overdue</div>
    </div>` : ""}
    ${todayCount > 0 ? `
    <div style="flex:1;padding:14px 16px;background:#fef9f0;border:1px solid #fdebd0;border-radius:8px;">
      <div style="font-size:22px;font-weight:800;color:#e67e22;">${todayCount}</div>
      <div style="font-size:10px;color:#e67e22;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Today</div>
    </div>` : ""}
    ${highCount > 0 ? `
    <div style="flex:1;padding:14px 16px;background:#fdecea;border:1px solid #f9d6d5;border-radius:8px;">
      <div style="font-size:22px;font-weight:800;color:#e74c3c;">${highCount}</div>
      <div style="font-size:10px;color:#e74c3c;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">High Priority</div>
    </div>` : ""}
  </div>

  <!-- Active tasks by urgency -->
  ${urgencySectionsHtml}

  <!-- Completed -->
  ${completedHtml}

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:14px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:9px;color:#ccc;">Generated ${dateStr}</span>
    <span style="font-size:9px;color:#ccc;">${done}/${total} tasks completed</span>
  </div>

</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)};</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}
