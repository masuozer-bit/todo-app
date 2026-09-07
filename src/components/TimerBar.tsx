"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { useI18n } from "./I18nProvider";
import type { Todo } from "@/lib/types";

const SAVE_INTERVAL = 30_000;

function clock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * One timer surface, 40 px at the bottom of the content column: what is
 * running, for how long, pause and stop. Reset asks first, because it throws
 * tracked time away.
 */
export default function TimerBar({
  todo,
  onSaveTime,
  onClose,
}: {
  todo: Todo;
  onSaveTime: (todoId: string, totalSeconds: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const previous = todo.time_spent ?? 0;
  const [elapsed, setElapsed] = useState(previous);
  const [running, setRunning] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const startRef = useRef(Date.now() - previous * 1000);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - elapsed * 1000;
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // A crash or a closed tab must not lose more than half a minute
  useEffect(() => {
    if (!running) return;
    const save = setInterval(() => {
      onSaveTime(todo.id, Math.floor((Date.now() - startRef.current) / 1000));
    }, SAVE_INTERVAL);
    return () => clearInterval(save);
  }, [running, todo.id, onSaveTime]);

  const pause = useCallback(() => {
    setRunning(false);
    if (tickRef.current) clearInterval(tickRef.current);
    onSaveTime(todo.id, elapsed);
  }, [elapsed, onSaveTime, todo.id]);

  const stop = useCallback(() => {
    setRunning(false);
    if (tickRef.current) clearInterval(tickRef.current);
    onSaveTime(todo.id, elapsed);
    onClose();
  }, [elapsed, onSaveTime, onClose, todo.id]);

  const reset = useCallback(() => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    setConfirmReset(false);
    setRunning(false);
    if (tickRef.current) clearInterval(tickRef.current);
    setElapsed(0);
    startRef.current = Date.now();
    onSaveTime(todo.id, 0);
  }, [confirmReset, onSaveTime, todo.id]);

  return (
    <div className="flex-none flex items-center gap-3 h-10 px-4 border-t border-border surface">
      <span
        className="w-2 h-2 rounded-full flex-none"
        style={{ background: running ? "var(--success)" : "var(--text-faint)" }}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0 truncate text-[13px] text-text">{todo.title}</span>
      <span className="flex-none tabular-nums text-sm font-medium text-text">{clock(elapsed)}</span>
      <span className="flex items-center gap-1 flex-none">
        {running ? (
          <button onClick={pause} className="icon-btn w-7 h-7" aria-label={t("Pause")} title={t("Pause")}>
            <Pause size={14} />
          </button>
        ) : (
          <button onClick={() => setRunning(true)} className="icon-btn w-7 h-7" aria-label={t("Resume")} title={t("Resume")}>
            <Play size={14} />
          </button>
        )}
        <button
          onClick={reset}
          className={`icon-btn w-7 h-7 ${confirmReset ? "icon-btn-on" : ""}`}
          aria-label={confirmReset ? t("Click again to reset") : t("Reset")}
          title={confirmReset ? t("Click again to reset") : t("Reset")}
          style={confirmReset ? { color: "var(--danger)", background: "var(--surface-2)" } : undefined}
        >
          <RotateCcw size={14} />
        </button>
        <button onClick={stop} className="icon-btn w-7 h-7" aria-label={t("Stop and save")} title={t("Stop and save")}>
          <Square size={14} />
        </button>
      </span>
    </div>
  );
}
