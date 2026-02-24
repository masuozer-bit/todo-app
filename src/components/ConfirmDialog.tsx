"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative glass-card p-6 w-full max-w-sm">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-black dark:hover:text-white transition-default"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <h2
          id="confirm-title"
          className="text-lg font-semibold text-black dark:text-white mb-2"
        >
          {title}
        </h2>
        <p className="text-sm text-gray-400 mb-6">{message}</p>

        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl glass-card-subtle text-sm font-medium text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/15 transition-default"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-default"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
