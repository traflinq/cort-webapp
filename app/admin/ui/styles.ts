/**
 * Shared class fragments for the admin design system.
 * Keep these tiny and composable; components own their own layout classes.
 */

/** Keyboard-only focus ring (WCAG 2.4.7). Buttons, links, rows, pills. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page";

/** Inset variant for elements that can't show an outer ring (table rows, list items). */
export const focusRingInset =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

/** Base for text-like form controls (Input, Select, Textarea). */
export const inputBase =
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-[var(--bg-input)] px-3 text-sm text-fg shadow-xs transition-colors placeholder:text-fg-placeholder hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:focus-visible:ring-destructive/30";

/** Surface for cards and panels. */
export const surface =
  "rounded-2xl border border-line bg-card text-fg shadow-[var(--shadow-card)]";
