/** Shared class fragments for the company design system. Tokens only — never raw colours. */

export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page";

export const focusRingInset = "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** Text inputs, selects and textareas. */
export const controlBase =
  "w-full rounded-md border border-input bg-[var(--bg-input)] text-sm text-fg placeholder:text-fg-placeholder " +
  "transition-colors hover:border-line-strong focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 " +
  "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-muted " +
  "aria-[invalid=true]:border-danger-ink aria-[invalid=true]:focus:ring-danger-ink/25";

export const controlHeight = { sm: "h-8", md: "h-10 sm:h-9" } as const;

export const surface = "rounded-lg border border-line bg-card";
