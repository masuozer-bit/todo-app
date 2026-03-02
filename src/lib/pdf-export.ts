import type { Todo, Priority } from "@/lib/types";

interface ExportOptions {
  title?: string;
  filterDate?: string | null;
  listName?: string | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getPriorityLabel(priority: Priority): string {
  const labels: Record<Priority, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
    none: "None",
  };
  return labels[priority];
}

function getPriorityColor(priority: Priority): string {
  const colors: Record<Priority, string> = {
    high: "#dc2626",
    medium: "#d97706",
    low: "#2563eb",
    none: "#6b7280",
  };
  return colors[priority];
}

function groupByPriority(todos: Todo[]): Record<Priority, Todo[]> {
  const groups: Record<Priority, Todo[]> = {
    high: [],
    medium: [],
    low: [],
    none: [],
  };
  for (const todo of todos) {
    groups[todo.priority].push(todo);
  }
  return groups;
}

function renderTodoItem(todo: Todo): string {
  const completedSubtasks = todo.subtasks?.filter((s) => s.completed).length ?? 0;
  const totalSubtasks = todo.subtasks?.length ?? 0;
  const priorityColor = getPriorityColor(todo.priority);

  let timeRange = "";
  if (todo.start_time) {
    timeRange = formatTime(todo.start_time);
    if (todo.end_time) {
      timeRange += ` – ${formatTime(todo.end_time)}`;
    }
  }

  const notesPreview =
    todo.notes && todo.notes.length > 0
      ? todo.notes.length > 120
        ? escapeHtml(todo.notes.substring(0, 120)) + "…"
        : escapeHtml(todo.notes)
      : null;

  return `
    <div class="todo-item ${todo.completed ? "completed" : ""}">
      <div class="todo-header">
        <span class="todo-checkbox">${todo.completed ? "☑" : "☐"}</span>
        <span class="todo-title">${escapeHtml(todo.title)}</span>
        ${
          todo.priority !== "none"
            ? `<span class="priority-badge" style="background: ${priorityColor}15; color: ${priorityColor}; border: 1px solid ${priorityColor}30;">${getPriorityLabel(todo.priority)}</span>`
            : ""
        }
      </div>
      <div class="todo-meta">
        ${todo.due_date ? `<span class="meta-item"><span class="meta-icon">📅</span> ${formatDate(todo.due_date)}</span>` : ""}
        ${timeRange ? `<span class="meta-item"><span class="meta-icon">🕐</span> ${timeRange}</span>` : ""}
        ${totalSubtasks > 0 ? `<span class="meta-item"><span class="meta-icon">☑</span> ${completedSubtasks}/${totalSubtasks} subtasks</span>` : ""}
      </div>
      ${
        (todo.tags && todo.tags.length > 0)
          ? `<div class="todo-tags">${todo.tags.map((t) => `<span class="tag">${escapeHtml(t.name)}</span>`).join("")}</div>`
          : ""
      }
      ${notesPreview ? `<div class="todo-notes">${notesPreview}</div>` : ""}
    </div>
  `;
}

function renderPrioritySection(priority: Priority, todos: Todo[]): string {
  if (todos.length === 0) return "";
  const color = getPriorityColor(priority);
  const label = getPriorityLabel(priority);

  return `
    <div class="priority-group">
      <div class="priority-header" style="border-left: 3px solid ${color};">
        <span class="priority-label" style="color: ${color};">${label} Priority</span>
        <span class="priority-count">${todos.length} task${todos.length !== 1 ? "s" : ""}</span>
      </div>
      ${todos.map(renderTodoItem).join("")}
    </div>
  `;
}

export function exportTodosPDF(todos: Todo[], options: ExportOptions = {}): void {
  const title = options.title || "Task Report";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);
  const completedCount = completedTodos.length;
  const totalCount = todos.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const activeGrouped = groupByPriority(activeTodos);
  const priorityOrder: Priority[] = ["high", "medium", "low", "none"];

  const activeSectionsHtml = priorityOrder
    .map((p) => renderPrioritySection(p, activeGrouped[p]))
    .join("");

  const completedSectionHtml =
    completedTodos.length > 0
      ? `
    <div class="section">
      <h2 class="section-title completed-section-title">
        <span>Completed</span>
        <span class="section-count">${completedTodos.length}</span>
      </h2>
      ${completedTodos.map(renderTodoItem).join("")}
    </div>
  `
      : "";

  const filterInfo = [
    options.filterDate ? `Date: ${formatDate(options.filterDate)}` : null,
    options.listName ? `List: ${escapeHtml(options.listName)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      margin: 1.5cm 2cm;
      size: A4;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1a1a1a;
      background: #ffffff;
      line-height: 1.6;
      font-size: 13px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    /* Header */
    .report-header {
      text-align: center;
      padding-bottom: 28px;
      margin-bottom: 32px;
      border-bottom: 2px solid #e5e5e5;
    }

    .report-title {
      font-size: 28px;
      font-weight: 700;
      color: #111111;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }

    .report-date {
      font-size: 13px;
      color: #888888;
      font-weight: 400;
    }

    .report-filter {
      font-size: 12px;
      color: #999999;
      margin-top: 4px;
    }

    /* Progress Summary */
    .progress-summary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 20px 28px;
      background: #fafafa;
      border: 1px solid #eeeeee;
      border-radius: 10px;
      margin-bottom: 36px;
    }

    .progress-ring {
      position: relative;
      width: 64px;
      height: 64px;
      flex-shrink: 0;
    }

    .progress-ring svg {
      transform: rotate(-90deg);
    }

    .progress-ring .bg {
      fill: none;
      stroke: #e5e5e5;
      stroke-width: 6;
    }

    .progress-ring .fg {
      fill: none;
      stroke: #111111;
      stroke-width: 6;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.3s;
    }

    .progress-percentage {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 700;
      color: #111111;
    }

    .progress-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .progress-label {
      font-size: 20px;
      font-weight: 700;
      color: #111111;
    }

    .progress-sublabel {
      font-size: 12px;
      color: #888888;
    }

    /* Sections */
    .section {
      margin-bottom: 28px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #111111;
      padding-bottom: 10px;
      margin-bottom: 16px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .completed-section-title {
      color: #666666;
    }

    .section-count {
      font-size: 12px;
      font-weight: 500;
      color: #999999;
      background: #f0f0f0;
      padding: 2px 10px;
      border-radius: 12px;
    }

    /* Priority Groups */
    .priority-group {
      margin-bottom: 20px;
    }

    .priority-header {
      padding: 6px 12px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fafafa;
      border-radius: 6px;
    }

    .priority-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .priority-count {
      font-size: 11px;
      color: #999999;
    }

    /* Todo Items */
    .todo-item {
      padding: 12px 14px;
      margin-bottom: 6px;
      border: 1px solid #f0f0f0;
      border-radius: 8px;
      background: #ffffff;
      page-break-inside: avoid;
    }

    .todo-item.completed {
      opacity: 0.55;
    }

    .todo-item.completed .todo-title {
      text-decoration: line-through;
      color: #999999;
    }

    .todo-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .todo-checkbox {
      font-size: 15px;
      flex-shrink: 0;
      line-height: 1;
    }

    .todo-title {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      flex: 1;
    }

    .priority-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 2px 8px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .todo-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding-left: 26px;
      margin-top: 4px;
    }

    .meta-item {
      font-size: 11px;
      color: #777777;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .meta-icon {
      font-size: 11px;
    }

    .todo-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding-left: 26px;
      margin-top: 6px;
    }

    .tag {
      font-size: 10px;
      font-weight: 600;
      color: #555555;
      background: #f0f0f0;
      padding: 2px 8px;
      border-radius: 4px;
      letter-spacing: 0.2px;
    }

    .todo-notes {
      font-size: 11px;
      color: #888888;
      padding-left: 26px;
      margin-top: 6px;
      line-height: 1.5;
      font-style: italic;
      border-left: 2px solid #e5e5e5;
      margin-left: 26px;
      padding: 4px 0 4px 10px;
    }

    /* Footer */
    .report-footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e5e5;
      text-align: center;
      font-size: 10px;
      color: #cccccc;
    }

    /* Print overrides */
    @media print {
      body {
        font-size: 12px;
      }

      .container {
        padding: 0;
        max-width: 100%;
      }

      .todo-item {
        border-color: #e5e5e5;
      }

      .progress-summary {
        background: #fafafa;
      }

      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="report-header">
      <h1 class="report-title">${escapeHtml(title)}</h1>
      <p class="report-date">${dateStr} at ${timeStr}</p>
      ${filterInfo ? `<p class="report-filter">${filterInfo}</p>` : ""}
    </header>

    <div class="progress-summary">
      <div class="progress-ring">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle class="bg" cx="32" cy="32" r="26"/>
          <circle class="fg" cx="32" cy="32" r="26"
            stroke-dasharray="${2 * Math.PI * 26}"
            stroke-dashoffset="${2 * Math.PI * 26 * (1 - percentage / 100)}"/>
        </svg>
        <span class="progress-percentage">${percentage}%</span>
      </div>
      <div class="progress-details">
        <span class="progress-label">${completedCount} of ${totalCount}</span>
        <span class="progress-sublabel">tasks completed</span>
      </div>
    </div>

    ${
      activeTodos.length > 0
        ? `
    <div class="section">
      <h2 class="section-title">
        <span>Active Tasks</span>
        <span class="section-count">${activeTodos.length}</span>
      </h2>
      ${activeSectionsHtml}
    </div>
    `
        : ""
    }

    ${completedSectionHtml}

    <footer class="report-footer">
      Generated on ${dateStr}
    </footer>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
