"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

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

export type ThemeOrigin = { x: number; y: number };

/**
 * Switches theme with a circular reveal growing from `origin` (View Transitions API).
 * Falls back to an instant switch when unsupported or the user prefers reduced motion.
 */
export function setAdminThemeAnimated(next: Theme, origin?: ThemeOrigin) {
  // Typed locally: the project's DOM lib predates the View Transitions API.
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> };
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduceMotion) {
    setAdminTheme(next);
    return;
  }

  const x = origin?.x ?? window.innerWidth - 40;
  const y = origin?.y ?? 32;
  // Radius that reaches the farthest viewport corner from the origin.
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  // flushSync so React-driven bits (logo, icons) are in the "new" snapshot too.
  const transition = doc.startViewTransition(() => flushSync(() => setAdminTheme(next)));
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 550, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {
      /* transition skipped; theme is already applied */
    });
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
