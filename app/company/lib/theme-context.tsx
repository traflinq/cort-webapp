"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type CompanyTheme = "light" | "dark";

/** Company portal theme. Light by default; the pre-redesign key is migrated once. */
export const COMPANY_THEME_KEY = "cort-company-theme";
const LEGACY_THEME_KEY = "cort-theme";

interface ThemeContextValue {
  theme: CompanyTheme;
  toggle: () => void;
  setTheme: (theme: CompanyTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "light", toggle: () => {}, setTheme: () => {} });

function readTheme(): CompanyTheme {
  try {
    const stored = localStorage.getItem(COMPANY_THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY);
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function writeTheme(theme: CompanyTheme) {
  try {
    localStorage.setItem(COMPANY_THEME_KEY, theme);
  } catch {
    /* private mode: the theme still applies for this page view */
  }
  document.documentElement.setAttribute("data-theme", theme);
  listeners.forEach((l) => l());
}

/**
 * Runs before paint (rendered at the top of the company layout) so the page never flashes
 * the other theme. Must stay in sync with readTheme().
 */
export function CompanyThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var t=localStorage.getItem('${COMPANY_THEME_KEY}')||localStorage.getItem('${LEGACY_THEME_KEY}');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`,
      }}
    />
  );
}

export function CompanyThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as CompanyTheme);

  // Other portals share <html data-theme>; make sure ours is applied while mounted.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback((next: CompanyTheme) => writeTheme(next), []);
  const toggle = useCallback(() => writeTheme(readTheme() === "dark" ? "light" : "dark"), []);
  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useCompanyTheme = () => useContext(ThemeContext);
