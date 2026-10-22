"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { NextIntlClientProvider } from "next-intl";
import { usePathname } from "next/navigation";
import {
  defaultLocale,
  isRtlLocale,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  type Locale,
  locales,
} from "@/i18n/config";
import { loadMessages } from "@/i18n/load-messages";
import { isSaudiRoute } from "@/app/lib/i18n/saudi-route";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  isRtl: boolean;
  isSaudiRoute: boolean;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
  toggleLocale: () => {},
  isRtl: false,
  isSaudiRoute: false,
});

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && locales.includes(stored as Locale)) {
    return stored as Locale;
  }
  return defaultLocale;
}

function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

const subscribeNoop = () => () => {};

function resolveInitialLocale(onSaudiRoute: boolean): Locale {
  if (!onSaudiRoute) return defaultLocale;
  if (typeof window === "undefined") return "ar";
  return readStoredLocale() || "ar";
}

export function CompanyLocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onSaudiRoute = isSaudiRoute(pathname);
  const [locale, setLocaleState] = useState<Locale>(() => resolveInitialLocale(onSaudiRoute));
  // Re-resolve when moving between the Saudi and default trees (render-time state adjustment, no effect).
  const [prevSaudi, setPrevSaudi] = useState(onSaudiRoute);
  if (prevSaudi !== onSaudiRoute) {
    setPrevSaudi(onSaudiRoute);
    setLocaleState(resolveInitialLocale(onSaudiRoute));
  }
  // The server snapshot renders the fallback provider; the first client render switches to the real one.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    applyDocumentLocale(locale);
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (!onSaudiRoute) return;
      setLocaleState(next);
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
      applyDocumentLocale(next);
    },
    [onSaudiRoute],
  );

  const toggleLocale = useCallback(() => {
    setLocale(locale === "en" ? "ar" : "en");
  }, [locale, setLocale]);

  const messages = useMemo(() => loadMessages(locale), [locale]);
  const isRtl = isRtlLocale(locale);

  if (!mounted) {
    const fallbackLocale = onSaudiRoute ? "ar" : defaultLocale;
    return (
      <NextIntlClientProvider locale={fallbackLocale} messages={loadMessages(fallbackLocale)}>
        {children}
      </NextIntlClientProvider>
    );
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, toggleLocale, isRtl, isSaudiRoute: onSaudiRoute }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export const useCompanyLocale = () => useContext(LocaleContext);
