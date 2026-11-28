"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { DEFAULT_THEME, setTheme, setThemeAnimated, useTheme, type Theme, type ThemeOrigin } from "@/app/lib/theme-store";

export type { Theme, ThemeOrigin };

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** `origin` is the viewport point the circular reveal grows from (e.g. the clicked button). */
  toggle: (origin?: ThemeOrigin) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggle: () => {},
});

/** Kept for existing imports; the theme is shared across the app (app/lib/theme-store.ts). */
export const setAdminTheme = setTheme;
export const setAdminThemeAnimated = setThemeAnimated;

/**
 * Theme for the Super Admin and Cort-vendor portals. It is the app-wide setting (dark by default),
 * so switching here also applies to the company portal and the sign-in pages.
 */
export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggle: (origin) => setThemeAnimated(theme === "dark" ? "light" : "dark", origin),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useAdminTheme = () => useContext(ThemeContext);
