/** Theme-aware class strings for admin UI — use instead of bg-white / text-gray-* */

export const adminCard =
  "rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] transition-[box-shadow,border-color,transform] duration-200";

export const adminCardPadding = `${adminCard} p-4`;

export const adminPanel = `${adminCard} overflow-hidden`;

export const adminStatCard = `${adminCardPadding}`;

export const adminInput =
  "w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--text-placeholder)] focus:border-[var(--cort-orange)] focus:ring-2 focus:ring-[var(--focus-ring)]";

export const adminSelect = adminInput;

export const adminTableHead =
  "bg-[var(--bg-subtle)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]";

export const adminTableRow = "hover:bg-[var(--row-hover)] transition-colors";

export const adminPageTitle = "text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]";

export const adminEyebrow = "text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]";

export const adminModalTitle = "text-lg font-bold text-[var(--text-primary)]";

export const adminBtnOutline =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-card)] hover:border-[var(--border-strong)] hover:bg-[var(--row-hover)]";

export const adminBtnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--row-hover)] hover:text-[var(--text-primary)]";

export const adminBtnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 text-[var(--text-secondary)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-primary)]";

export const adminBtnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 bg-[var(--cort-navy)] text-white shadow-sm hover:bg-[var(--cort-navy-hover)]";

export const adminBtnDestructive =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 bg-rose-600 text-white shadow-sm hover:bg-rose-700";

export const adminSectionTitle = "text-sm font-semibold tracking-tight text-[var(--text-primary)]";

export const adminModalHeader =
  "flex items-center justify-between border-b border-[var(--border-default)] px-6 py-4 sticky top-0 bg-[var(--bg-card)] rounded-t-xl z-10";

export const adminModalBody = "p-6 max-h-[80vh] overflow-y-auto text-[var(--text-primary)]";

export const adminModalShell =
  "relative w-full rounded-xl bg-[var(--bg-card)] shadow-[var(--shadow-modal)] ring-1 ring-[var(--border-default)] admin-pop-in my-auto";

export const badgeColorsLight = {
  blue: "bg-blue-500/10 text-blue-700 ring-blue-600/15",
  green: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/15",
  red: "bg-red-500/10 text-red-700 ring-red-600/15",
  orange: "bg-orange-500/10 text-orange-800 ring-orange-600/20",
  purple: "bg-purple-500/10 text-purple-700 ring-purple-600/15",
  gray: "bg-slate-500/10 text-slate-700 ring-slate-600/15",
} as const;

export const badgeColorsDark = {
  blue: "bg-blue-500/15 text-blue-300 ring-blue-400/20",
  green: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20",
  red: "bg-red-500/15 text-red-300 ring-red-400/20",
  orange: "bg-orange-500/15 text-orange-300 ring-orange-400/20",
  purple: "bg-purple-500/15 text-purple-300 ring-purple-400/20",
  gray: "bg-slate-500/15 text-slate-300 ring-slate-400/20",
} as const;

export type BadgeColor = keyof typeof badgeColorsLight;
