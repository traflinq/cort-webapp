"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { switchThemeAnimated, type ThemeOrigin } from "@/app/lib/theme-transition";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** `origin` is the viewport point the circular reveal grows from (e.g. the clicked button). */
  toggle: (origin?: ThemeOrigin) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

const STORAGE_KEY = "cort-admin-theme";
const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** Imperative setter (also used by the pre-paint theme script's consumers). */
export function setAdminTheme(next: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode */
  }
  document.documentElement.setAttribute("data-theme", next);
  listeners.forEach((l) => l());
}

export type { ThemeOrigin };

/**
 * Switches theme with a circular reveal growing from `origin` (shared with the company portal).
 * Falls back to an instant switch when unsupported or the user prefers reduced motion.
 */
export function setAdminThemeAnimated(next: Theme, origin?: ThemeOrigin) {
  // flushSync so React-driven bits (logo, icons) are in the "new" snapshot too.
  switchThemeAnimated(() => flushSync(() => setAdminTheme(next)), origin);
}

/**
 * Theme store backed by localStorage via useSyncExternalStore: the server snapshot is
 * "light", so there is no hydration mismatch and no setState-in-effect.
 */
export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setAdminTheme,
      toggle: (origin) => setAdminThemeAnimated(theme === "dark" ? "light" : "dark", origin),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useAdminTheme = () => useContext(ThemeContext);
