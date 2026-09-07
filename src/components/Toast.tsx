"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { X, Undo2 } from "lucide-react";

export interface ToastData {
  id: string;
  message: string;
  onUndo?: () => void;
  duration?: number; // ms, default 5000
  variant?: "default" | "error";
  /* Optional secondary action, e.g. "Show" for a task added to another view */
  action?: { label: string; onClick: () => void };
}

export type ToastInput = Omit<ToastData, "id">;

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

  function close() {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }

  function handleUndo() {
    toast.onUndo?.();
    close();
  }

  function handleAction() {
    toast.action?.onClick();
    close();
  }

  const isError = toast.variant === "error";

  return (
    <div
      role="status"
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg transition-all duration-300 ${
        isError
          ? "bg-red-600 text-white"
          : "bg-black dark:bg-white text-white dark:text-black"
      } ${exiting ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}
    >
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      {toast.action && (
        <button
          onClick={handleAction}
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-default ${
            isError
              ? "bg-white/20 hover:bg-white/30"
              : "bg-white/20 dark:bg-black/15 hover:bg-white/30 dark:hover:bg-black/25"
          }`}
        >
          {toast.action.label}
        </button>
      )}
      {toast.onUndo && (
        <button
          onClick={handleUndo}
          className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-default ${
            isError
              ? "bg-white/20 hover:bg-white/30"
              : "bg-white/20 dark:bg-black/15 hover:bg-white/30 dark:hover:bg-black/25"
          }`}
        >
          <Undo2 size={12} />
          Undo
        </button>
      )}
      <button
        onClick={close}
        className={
          isError
            ? "text-white/60 hover:text-white transition-default"
            : "text-white/50 dark:text-black/50 hover:text-white dark:hover:text-black transition-default"
        }
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

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-full max-w-sm px-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── Context ──────────────────────────────────────────────────────────────────

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
  /* Something failed — always tell the user instead of failing silently */
  showError: (message: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  showError: () => {},
  dismissToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }].slice(-MAX_VISIBLE));
  }, []);

  const showError = useCallback(
    (message: string) => showToast({ message, variant: "error", duration: 6000 }),
    [showToast]
  );

  const value = useMemo(
    () => ({ showToast, showError, dismissToast }),
    [showToast, showError, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export default ToastContainer;
