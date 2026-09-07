"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";

/**
 * Login and sign up share one card: 400 px, centred on the app background,
 * with the same fields and buttons as everything else.
 */
export default function AuthShell({
  title,
  subtitle,
  error,
  info,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  error?: string;
  info?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="surface border border-border rounded-lg p-8">
          <h1 className="text-xl font-semibold text-text">{title}</h1>
          <p className="text-[13px] text-text-muted mt-1">{subtitle}</p>

          {error && (
            <p
              role="alert"
              className="mt-4 px-3 py-2 rounded text-[13px]"
              style={{ background: "var(--surface-2)", color: "var(--danger)" }}
            >
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="mt-4 px-3 py-2 rounded surface-2 text-[13px] text-text-muted">
              {info}
            </p>
          )}

          <div className="mt-6">{children}</div>
          <div className="mt-6 text-center text-[13px] text-text-muted">{footer}</div>
        </div>
      </div>
    </div>
  );
}

export function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] text-text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <>
      <div className="flex items-center gap-3 my-5">
        <span className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-faint">{t("or")}</span>
        <span className="flex-1 h-px bg-border" />
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="btn btn-secondary w-full h-10"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="flex-none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {t("Continue with Google")}
      </button>
    </>
  );
}
