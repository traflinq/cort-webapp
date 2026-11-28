/**
 * Shared by the theme store (client) and the pre-paint theme script (server-rendered), so this module
 * must stay free of "use client".
 */
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "traflinq-theme";
/** Keys from when each portal kept its own setting; read so existing choices carry over. */
export const LEGACY_THEME_KEYS = ["cort-theme", "cort-admin-theme"] as const;
/** One default for the whole app. */
export const DEFAULT_THEME: Theme = "dark";
