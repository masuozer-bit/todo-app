"use client";

import { useI18n } from "./I18nProvider";
import type { EventTemplateData, PlanTemplateData, TaskTemplateData, Template } from "@/lib/types";

/** How many things a template would create. */
export function templateSize(template: Template): { tasks: number; projects: number } {
  if (template.type === "task") return { tasks: 1, projects: 0 };
  if (template.type === "event") {
    const data = template.data as EventTemplateData;
    return { tasks: data.tasks?.length ?? 0, projects: 1 };
  }
  const data = template.data as PlanTemplateData;
  return {
    tasks: (data.tasks?.length ?? 0) + (data.events ?? []).reduce((n, e) => n + (e.tasks?.length ?? 0), 0),
    projects: data.events?.length ?? 0,
  };
}

export function templateTypeLabel(type: Template["type"]): string {
  if (type === "task") return "Task";
  if (type === "event") return "Project";
  return "Plan";
}

export default function TemplateListView({
  templates,
  selectedId,
  onSelect,
}: {
  templates: Template[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();

  if (templates.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-text-muted">{t("No templates yet")}</p>
        <p className="text-[13px] text-text-faint mt-1">
          {t("Save a task as a template from its detail panel.")}
        </p>
      </div>
    );
  }

  return (
    <div role="listbox" aria-label={t("Templates")}>
      {templates.map((template) => {
        const size = templateSize(template);
        return (
          <div
            key={template.id}
            role="option"
            aria-selected={selectedId === template.id}
            tabIndex={0}
            data-task-row=""
            onClick={() => onSelect(template.id)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSelect(template.id); } }}
            className={`task-row ${selectedId === template.id ? "is-selected" : ""}`}
          >
            <span className="task-row-title">{template.name}</span>
            <span className="task-row-meta">
              <span className="task-meta-tag">{t(templateTypeLabel(template.type))}</span>
              {size.projects > 0 && <span className="tabular-nums">{t("{n} projects", { n: size.projects })}</span>}
              <span className="tabular-nums">{t("{n} tasks", { n: size.tasks })}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The flat list of task titles a template would create, for the panel. */
export function templateTasks(template: Template): TaskTemplateData[] {
  if (template.type === "task") return [template.data as TaskTemplateData];
  if (template.type === "event") return (template.data as EventTemplateData).tasks ?? [];
  const data = template.data as PlanTemplateData;
  return [...(data.tasks ?? []), ...(data.events ?? []).flatMap((e) => e.tasks ?? [])];
}
