"use client";

import { useEffect, useState } from "react";
import { X, Undo2 } from "lucide-react";

export interface ToastData {
  id: string;
  message: string;
  onUndo?: () => void;
  duration?: number; // ms, default 5000
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastProps) {
  const [exiting, setExiting] = useState(false);
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  function handleUndo() {
    toast.onUndo?.();
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }

  function handleDismiss() {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-black dark:bg-white text-white dark:text-black shadow-lg transition-all duration-300 ${
        exiting ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      }`}
    >
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      {toast.onUndo && (
        <button
          onClick={handleUndo}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/20 dark:bg-black/15 hover:bg-white/30 dark:hover:bg-black/25 transition-default"
        >
          <Undo2 size={12} />
          Undo
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="text-white/50 dark:text-black/50 hover:text-white dark:hover:text-black transition-default"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
