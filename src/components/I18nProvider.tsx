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
import { detectLocale, translate, type Locale } from "@/lib/i18n";
import { setFormatLocale } from "@/lib/format";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Server and first client render agree on English; the stored choice is
  // applied right after mount to avoid a hydration mismatch
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem("locale"); } catch { /* ignore */ }
    const next: Locale = stored === "de" || stored === "en" ? stored : detectLocale();
    setLocaleState(next);
    setFormatLocale(next);
    document.documentElement.lang = next;
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setFormatLocale(next);
    try { localStorage.setItem("locale", next); } catch { /* ignore */ }
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
