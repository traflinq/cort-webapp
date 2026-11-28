"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { DEFAULT_THEME, setThemeAnimated, useTheme, type Theme, type ThemeOrigin } from "@/app/lib/theme-store";

interface ThemeContextValue {
    theme: Theme;
    /** `origin` is the viewport point the circular reveal grows from (e.g. the clicked button). */
    toggle: (origin?: ThemeOrigin) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: DEFAULT_THEME,
    toggle: () => {},
});

/**
 * Company portal theme. It is the app-wide setting (dark by default, app/lib/theme-store.ts), so
 * switching here also applies to the Super Admin, vendor portals and sign-in pages.
 */
export function CompanyThemeProvider({ children }: { children: React.ReactNode }) {
    const theme = useTheme();

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    const value = useMemo<ThemeContextValue>(
        () => ({
            theme,
            toggle: (origin) => setThemeAnimated(theme === "dark" ? "light" : "dark", origin),
        }),
        [theme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useCompanyTheme = () => useContext(ThemeContext);
