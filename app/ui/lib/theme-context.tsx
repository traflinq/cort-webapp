"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

/** One key for every portal (admin, company). */
export const THEME_STORAGE_KEY = "cort-portal-theme";
/** Pre-redesign keys: admin used the first, company the second. Read once, then removed. */
export const LEGACY_THEME_KEYS = ["cort-admin-theme", "cort-theme"] as const;
export const DEFAULT_THEME: Theme = "light";

const listeners = new Set<() => void>();

function isTheme(v: unknown): v is Theme {
  return v === "dark" || v === "light";
}

/**
 * Current theme from storage. Migrates a legacy key the first time it runs, so a user
 * who had picked dark in either portal keeps dark after the key change.
 */
export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
    let migrated: Theme | null = null;
    for (const key of LEGACY_THEME_KEYS) {
      const legacy = localStorage.getItem(key);
      if (migrated === null && isTheme(legacy)) migrated = legacy;
      localStorage.removeItem(key);
    }
    if (migrated) localStorage.setItem(THEME_STORAGE_KEY, migrated);
    return migrated ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** Imperative setter (also used by the pre-paint theme script's consumers). */
export function setPortalTheme(next: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* private mode */
  }
  document.documentElement.setAttribute("data-theme", next);
  listeners.forEach((l) => l());
}

/**
 * Theme store backed by localStorage via useSyncExternalStore: the server snapshot is
 * the default, so there is no hydration mismatch and no setState-in-effect.
 */
export function PortalThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, () => DEFAULT_THEME);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setPortalTheme,
      toggle: () => setPortalTheme(theme === "dark" ? "light" : "dark"),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const usePortalTheme = () => useContext(ThemeContext);
/** @deprecated alias kept for admin code; prefer usePortalTheme. */
export const useAdminTheme = usePortalTheme;
