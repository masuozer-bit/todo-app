"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Square, RotateCcw, Clock, X } from "lucide-react";
import type { Todo, List } from "@/lib/types";

interface LiveTaskBarProps {
  todo: Todo;
  lists?: List[];
  onSaveTime: (todoId: string, totalSeconds: number) => void;
  onClose: () => void;
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function LiveTaskBar({ todo, lists, onSaveTime, onClose }: LiveTaskBarProps) {
  const previousTime = todo.time_spent ?? 0;
  const [elapsed, setElapsed] = useState(previousTime);
  const [running, setRunning] = useState(true); // auto-start
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(Date.now() - previousTime * 1000);

  const listColor = todo.list_id && lists
    ? lists.find(l => l.id === todo.list_id)?.color ?? null
    : null;

  const tick = useCallback(() => {
    setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
  }, []);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, tick]);

  const handlePause = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onSaveTime(todo.id, elapsed);
  };

  const handleResume = () => {
    setRunning(true);
  };

  const handleStop = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onSaveTime(todo.id, elapsed);
    onClose();
  };

  const handleReset = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setElapsed(0);
    startRef.current = Date.now();
    onSaveTime(todo.id, 0);
  };

  // Save periodically (every 30s while running)
  useEffect(() => {
    if (!running) return;
    const save = setInterval(() => {
      onSaveTime(todo.id, Math.floor((Date.now() - startRef.current) / 1000));
    }, 30_000);
    return () => clearInterval(save);
  }, [running, todo.id, onSaveTime]);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl glass-card-raised shadow-2xl max-w-lg w-[calc(100%-2rem)]"
      style={listColor ? { borderBottom: `3px solid ${listColor}` } : undefined}
    >
      {/* Pulse indicator */}
      <div className="relative flex-shrink-0">
        <Clock size={16} className={running ? "text-emerald-400" : "text-gray-500"} />
        {running && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        )}
      </div>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-black dark:text-white truncate">{todo.title}</p>
        <p className="text-[10px] text-black/40 dark:text-gray-500">
          {running ? "Tracking..." : "Paused"}
        </p>
      </div>

      {/* Timer display */}
      <div className="flex-shrink-0 tabular-nums text-lg font-mono font-bold text-black dark:text-white tracking-wider">
        {formatTime(elapsed)}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {running ? (
          <button
            onClick={handlePause}
            className="p-2 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-default"
            title="Pause"
          >
            <Pause size={14} />
          </button>
        ) : (
          <button
            onClick={handleResume}
            className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-default"
            title="Resume"
          >
            <Play size={14} />
          </button>
        )}
        <button
          onClick={handleReset}
          className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-default"
          title="Reset"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={handleStop}
          className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-default"
          title="Stop & save"
        >
          <Square size={14} />
        </button>
        <button
          onClick={handleStop}
          className="p-1.5 rounded-lg text-gray-500 hover:text-white transition-default"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
