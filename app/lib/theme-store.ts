"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { DEFAULT_THEME, LEGACY_THEME_KEYS, THEME_STORAGE_KEY, type Theme } from "./theme-constants";
import { switchThemeAnimated, type ThemeOrigin } from "./theme-transition";

/**
 * The one theme setting for the whole web app: every portal (company, Super Admin, vendors) and the
 * sign-in pages read and write the same value, so the app looks the same wherever you are.
 * Dark is the default. Stored per browser in localStorage.
 *
 * The pre-paint script in admin/lib/theme-script.tsx applies the same value before first paint, using the
 * same keys and default from ./theme-constants.
 */
export { DEFAULT_THEME, LEGACY_THEME_KEYS, THEME_STORAGE_KEY };
export type { Theme, ThemeOrigin };

const listeners = new Set<() => void>();

const isTheme = (v: string | null): v is Theme => v === "dark" || v === "light";

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
    for (const key of LEGACY_THEME_KEYS) {
      const legacy = localStorage.getItem(key);
      if (isTheme(legacy)) return legacy;
    }
  } catch {
    /* storage blocked: fall through to the default */
  }
  return DEFAULT_THEME;
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

export function setTheme(next: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* private mode: still applies for this page */
  }
  document.documentElement.setAttribute("data-theme", next);
  listeners.forEach((l) => l());
}

/** Switches with a circular reveal from `origin`; instant when unsupported or under reduced motion. */
export function setThemeAnimated(next: Theme, origin?: ThemeOrigin) {
  // flushSync so React-driven bits (logos, icons, chart colours) are in the "new" snapshot too.
  switchThemeAnimated(() => flushSync(() => setTheme(next)), origin);
}

/** Current theme. The server snapshot is the default, so hydration never mismatches. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
}
