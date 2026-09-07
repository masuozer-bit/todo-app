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
import { useI18n } from "./I18nProvider";

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
  const { t } = useI18n();
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
      className="flex items-center gap-2 h-10 px-3 surface border border-border rounded"
      style={{
        boxShadow: "var(--shadow-popover)",
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateY(4px)" : "none",
        transition: "opacity var(--duration) var(--ease), transform var(--duration) var(--ease)",
      }}
    >
      {isError && (
        <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: "var(--danger)" }} aria-hidden="true" />
      )}
      <span className="flex-1 min-w-0 truncate text-[13px] text-text">{t(toast.message)}</span>
      {toast.action && (
        <button onClick={handleAction} className="btn btn-ghost h-7 px-2 text-[13px]" style={{ color: "var(--accent)" }}>
          {t(toast.action.label)}
        </button>
      )}
      {toast.onUndo && (
        <button onClick={handleUndo} className="btn btn-ghost h-7 px-2 text-[13px]" style={{ color: "var(--accent)" }}>
          <Undo2 size={13} />
          {t("Undo")}
        </button>
      )}
      <button onClick={close} className="icon-btn w-7 h-7 flex-none" aria-label={t("Dismiss")}>
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
    <div className="toast-stack">
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
