"use client";

import { useEffect, useState } from "react";
import { Inbox, Play, Trash2, X } from "lucide-react";
import { useI18n } from "./I18nProvider";
import DateTimePopover from "./ui/DateTimePopover";
import { templateSize, templateTasks, templateTypeLabel } from "./TemplateListView";
import { formatRowDate } from "@/lib/format";
import { getToday } from "@/lib/date-helpers";
import type { List as ListType, Template } from "@/lib/types";

/** Column 3 for the templates view: what it holds, and when to apply it. */
export default function TemplateDetail({
  template,
  lists,
  onClose,
  onRename,
  onDelete,
  onApply,
}: {
  template: Template | null;
  lists: ListType[];
  onClose: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onApply: (template: Template, startDate: string) => void;
}) {
  const { t } = useI18n();
  const [startDate, setStartDate] = useState<string>(getToday());
  const [name, setName] = useState(template?.name ?? "");

  useEffect(() => { setName(template?.name ?? ""); }, [template?.id, template?.name]);

  if (!template) {
    return (
      <>
        <div className="app-col-head" />
        <div className="app-col-body flex flex-col items-center justify-center gap-3 p-6 text-center">
          <Inbox size={24} className="text-text-faint" />
          <p className="text-sm text-text-muted">{t("No template selected")}</p>
        </div>
      </>
    );
  }

  const size = templateSize(template);
  const tasks = templateTasks(template);

  return (
    <>
      <div className="app-col-head">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim();
            if (next && next !== template.name) onRename(template.id, next);
            else setName(template.name);
          }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          aria-label={t("Template name")}
          className="detail-title"
        />
        <button onClick={onClose} className="icon-btn flex-none" aria-label={t("Close")}>
          <X size={16} />
        </button>
      </div>

      <div className="app-col-body p-4">
        <div className="props">
          <div className="prop-label">{t("Type")}</div>
          <div className="prop-value"><span className="h-8 flex items-center">{t(templateTypeLabel(template.type))}</span></div>
          <div className="prop-label">{t("Contains")}</div>
          <div className="prop-value">
            <span className="h-8 flex items-center">
              {size.projects > 0 ? `${t("{n} projects", { n: size.projects })}, ` : ""}
              {t("{n} tasks", { n: size.tasks })}
            </span>
          </div>
          <div className="prop-label">{t("Apply from")}</div>
          <div className="prop-value">
            <DateTimePopover
              date={startDate}
              withTime={false}
              onChange={(date) => setStartDate(date ?? getToday())}
              trigger={(p) => (
                <button ref={p.ref as (el: HTMLButtonElement | null) => void} onClick={p.onClick} aria-expanded={p["aria-expanded"]} className="prop-button">
                  {t(formatRowDate(startDate))}
                </button>
              )}
            />
          </div>
        </div>

        {tasks.length > 0 && (
          <>
            <p className="section-title mt-6 mb-2">{t("Tasks")}</p>
            <ul>
              {tasks.map((task, i) => {
                const list = task.list_id ? lists.find((l) => l.id === task.list_id) ?? null : null;
                return (
                  <li key={`${task.title}-${i}`} className="flex items-center gap-2 h-8 text-[13px]">
                    <span className="w-4 flex-none text-text-faint tabular-nums text-right">
                      {task.day ? task.day : ""}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-text">{task.title}</span>
                    {list && (
                      <span className="flex items-center gap-1.5 flex-none text-text-muted">
                        <span className="w-2 h-2 rounded-full" style={{ background: list.color ?? "var(--text-faint)" }} />
                        {list.name}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="panel-foot">
        <button onClick={() => onApply(template, startDate)} className="btn btn-primary flex-1">
          <Play size={14} />
          {t("Apply")}
        </button>
        <button onClick={() => onDelete(template.id)} className="btn btn-text-danger">
          <Trash2 size={14} />
          {t("Delete")}
        </button>
      </div>
    </>
  );
}
