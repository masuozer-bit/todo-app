"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import Popover, { PopoverItem } from "@/components/ui/Popover";
import { PRIORITY_META } from "@/lib/priority";
import type { Event, List as ListType, Priority } from "@/lib/types";

type Trigger = (props: {
  ref: (el: HTMLElement | null) => void;
  onClick: (e: React.MouseEvent) => void;
  "aria-expanded": boolean;
}) => ReactNode;

const PRIORITIES: Priority[] = ["high", "medium", "low", "none"];

/** The priority bar as it appears in a menu, or a blank of the same width. */
export function PriorityMark({ priority }: { priority: Priority }) {
  const bar = PRIORITY_META[priority].bar;
  if (!bar) return <span className="w-4 flex-none" />;
  return <span className="w-[3px] h-4 rounded-full block ml-[6px] mr-[6px]" style={{ background: bar }} />;
}

export function ListDot({ color }: { color?: string | null }) {
  return (
    <span
      className="w-2 h-2 rounded-full block ml-[7px] mr-[7px]"
      style={{ background: color ?? "var(--text-faint)" }}
    />
  );
}

export function PriorityPopover({
  value,
  onChange,
  trigger,
  align,
}: {
  value: Priority;
  onChange: (priority: Priority) => void;
  trigger: Trigger;
  align?: "start" | "end";
}) {
  const { t } = useI18n();
  return (
    <Popover align={align} label={t("Priority")} trigger={trigger}>
      {(close) => (
        <div className="min-w-[160px]">
          {PRIORITIES.map((p) => (
            <PopoverItem
              key={p}
              icon={<PriorityMark priority={p} />}
              onClick={() => { onChange(p); close(); }}
            >
              {t(PRIORITY_META[p].label)}
              {value === p && <span className="sr-only"> ({t("Selected")})</span>}
            </PopoverItem>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function ListPopover({
  lists,
  onChange,
  trigger,
  align,
}: {
  lists: ListType[];
  onChange: (listId: string | null) => void;
  trigger: Trigger;
  align?: "start" | "end";
}) {
  const { t } = useI18n();
  return (
    <Popover align={align} label={t("List")} trigger={trigger}>
      {(close) => (
        <div className="min-w-[200px]">
          <PopoverItem icon={<span className="w-4 flex-none" />} onClick={() => { onChange(null); close(); }}>
            {t("No list")}
          </PopoverItem>
          {lists.map((l) => (
            <PopoverItem key={l.id} icon={<ListDot color={l.color} />} onClick={() => { onChange(l.id); close(); }}>
              {l.name}
            </PopoverItem>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function ProjectPopover({
  events,
  onChange,
  trigger,
  align,
}: {
  events: Event[];
  onChange: (eventId: string | null) => void;
  trigger: Trigger;
  align?: "start" | "end";
}) {
  const { t } = useI18n();
  return (
    <Popover align={align} label={t("Project")} trigger={trigger}>
      {(close) => (
        <div className="min-w-[200px]">
          <PopoverItem icon={<span className="w-4 flex-none" />} onClick={() => { onChange(null); close(); }}>
            {t("No project")}
          </PopoverItem>
          {events.map((e) => (
            <PopoverItem key={e.id} icon={<span className="w-4 flex-none" />} onClick={() => { onChange(e.id); close(); }}>
              {e.title}
            </PopoverItem>
          ))}
        </div>
      )}
    </Popover>
  );
}
