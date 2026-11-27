"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { switchThemeAnimated, type ThemeOrigin } from "@/app/lib/theme-transition";

type Theme = "dark" | "light";

interface ThemeContextValue {
    theme: Theme;
    /** `origin` is the viewport point the circular reveal grows from (e.g. the clicked button). */
    toggle: (origin?: ThemeOrigin) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: "dark",
    toggle: () => {},
});

const STORAGE_KEY = "cort-theme";
const listeners = new Set<() => void>();

function readTheme(): Theme {
    try {
        return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
    } catch {
        return "dark";
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

function setCompanyTheme(next: Theme) {
    try {
        localStorage.setItem(STORAGE_KEY, next);
    } catch {
        /* private mode */
    }
    document.documentElement.setAttribute("data-theme", next);
    listeners.forEach((l) => l());
}

/**
 * Company portal theme. Same switch as the Super Admin portal: a circular reveal from the toggle,
 * instant under reduced motion. The server snapshot is "dark" (the portal default), so hydration
 * never mismatches.
 */
export function CompanyThemeProvider({ children }: { children: React.ReactNode }) {
    const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    const value = useMemo<ThemeContextValue>(
        () => ({
            theme,
            // flushSync so React-driven bits (theme icon, chart colours) are in the "new" snapshot too.
            toggle: (origin) => {
                const next: Theme = theme === "dark" ? "light" : "dark";
                switchThemeAnimated(() => flushSync(() => setCompanyTheme(next)), origin);
            },
        }),
        [theme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useCompanyTheme = () => useContext(ThemeContext);
