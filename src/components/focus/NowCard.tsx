"use client";

import { Check, CheckCircle2, MoreHorizontal, Clock } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import Popover, { PopoverItem } from "@/components/ui/Popover";
import { formatRowDate, formatTime } from "@/lib/format";
import type { FocusItem } from "@/lib/focus";
import type { List } from "@/lib/types";

/**
 * The one thing to do now. Everything else on the screen is context for this
 * card, so it carries the only two buttons that matter: done, or later.
 */
export default function NowCard({
  item,
  list,
  next,
  onDone,
  onDefer,
  onTomorrow,
  onOpen,
}: {
  /** Nothing left to do means the card says so instead of hiding. */
  item: FocusItem | null;
  list?: List;
  /** Title of the task that follows, so the card shows what it buys you. */
  next?: string | null;
  onDone: () => void;
  onDefer: () => void;
  onTomorrow: () => void;
  onOpen: () => void;
}) {
  const { t } = useI18n();

  if (!item) {
    return (
      <div className="focus-now">
        <p className="focus-now-label">
          <span className="focus-now-dot" aria-hidden="true" />
          {t("Now")}
        </p>
        <p className="focus-now-title flex items-center gap-3">
          <CheckCircle2 size={28} style={{ color: "var(--success)" }} aria-hidden="true" />
          {t("All done")}
        </p>
        <p className="focus-now-meta">{t("Nothing left for today.")}</p>
      </div>
    );
  }

  return (
    <div className="focus-now">
      <p className="focus-now-label">
        <span className="focus-now-dot" aria-hidden="true" />
        {t("Now")}
      </p>
      <h2 className="focus-now-title">{item.todo.title}</h2>

      <div className="focus-now-meta">
        {item.overdue ? (
          <span className="focus-pill focus-pill-danger">
            {t("Overdue since {date}", { date: t(formatRowDate(item.date)) })}
          </span>
        ) : item.time ? (
          <span className="focus-pill focus-pill-strong">
            <Clock size={12} />
            {formatTime(item.time)}
          </span>
        ) : (
          <span className="focus-pill focus-pill-strong">{t("Today")}</span>
        )}
        {list && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="focus-list-dot"
              style={{ background: list.color ?? "var(--text-faint)" }}
              aria-hidden="true"
            />
            {list.name}
          </span>
        )}
      </div>

      <div className="focus-now-actions">
        <button onClick={onDone} className="focus-btn">
          <Check size={16} />
          {t("Done")}
        </button>
        <button onClick={onDefer} className="focus-btn-2">
          {t("Later")}
        </button>
        <Popover
          align="start"
          label={t("More")}
          trigger={(p) => (
            <button
              ref={p.ref as (el: HTMLButtonElement | null) => void}
              onClick={p.onClick}
              aria-expanded={p["aria-expanded"]}
              className="focus-icon-btn"
              aria-label={t("More")}
            >
              <MoreHorizontal size={16} />
            </button>
          )}
        >
          {(close) => (
            <div className="min-w-[200px]">
              <PopoverItem onClick={() => { onTomorrow(); close(); }}>
                {t("Move to tomorrow")}
              </PopoverItem>
              <PopoverItem onClick={() => { onOpen(); close(); }}>
                {t("Open in the app")}
              </PopoverItem>
            </div>
          )}
        </Popover>
      </div>

      {next && (
        <p className="focus-next">{t("Up next: {title}", { title: next })}</p>
      )}
    </div>
  );
}
