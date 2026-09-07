"use client";

import { CalendarDays, MoreHorizontal, Plus, Repeat, Sun } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import type { ViewKind } from "@/hooks/useDashboardView";

/**
 * The phone keeps its navigation at the bottom: four places and the one
 * button that adds something. Everything else lives behind "More".
 */
export default function BottomNav({
  view,
  onSelectView,
  onAdd,
  onMore,
}: {
  view: ViewKind;
  onSelectView: (kind: ViewKind) => void;
  onAdd: () => void;
  onMore: () => void;
}) {
  const { t } = useI18n();

  const items: { kind: ViewKind; label: string; icon: React.ElementType }[] = [
    { kind: "today", label: "Today", icon: Sun },
    { kind: "week", label: "This Week", icon: CalendarDays },
  ];
  const right: { kind: ViewKind; label: string; icon: React.ElementType }[] = [
    { kind: "habits", label: "Habits", icon: Repeat },
  ];

  return (
    <nav className="bottom-nav md:hidden" aria-label={t("Views")}>
      {items.map(({ kind, label, icon: Icon }) => (
        <Item key={kind} active={view === kind} label={t(label)} onClick={() => onSelectView(kind)}>
          <Icon size={20} />
        </Item>
      ))}

      <button onClick={onAdd} className="bottom-nav-item" aria-label={t("Add a task")}>
        <span className="bottom-nav-fab">
          <Plus size={20} />
        </span>
      </button>

      {right.map(({ kind, label, icon: Icon }) => (
        <Item key={kind} active={view === kind} label={t(label)} onClick={() => onSelectView(kind)}>
          <Icon size={20} />
        </Item>
      ))}

      <Item active={false} label={t("More")} onClick={onMore}>
        <MoreHorizontal size={20} />
      </Item>
    </nav>
  );
}

function Item({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="bottom-nav-item"
      style={active ? { color: "var(--accent)" } : undefined}
      aria-current={active ? "page" : undefined}
    >
      {children}
      <span className="text-xs">{label}</span>
    </button>
  );
}
