"use client";

import * as React from "react";

/**
 * Text the primitives render on their own (button captions, aria names, empty-state copy).
 * Admin uses the English defaults; the company portal supplies translations through
 * <UiLabelsProvider>. Explicit props on a primitive always win over these.
 */
export type UiLabels = {
  cancel: string;
  confirm: string;
  delete: string;
  close: string;
  apply: string;
  clear: string;
  retry: string;
  refresh: string;
  loading: string;
  somethingWentWrong: string;
  areYouSure: string;
  pleaseConfirm: string;
  /** "Type <word> to confirm" — word is rendered emphasised. */
  typeToConfirm: (word: React.ReactNode) => React.ReactNode;
  dialog: string;
  panel: string;
  search: string;
  clearSearch: string;
  clearFilters: (count: number) => string;
  removeFilter: string;
  dateRange: string;
  presets: string;
  from: string;
  to: string;
  allTime: string;
  presetLabels: { today: string; last7Days: string; last30Days: string; thisMonth: string; lastMonth: string; last90Days: string };
  pagination: string;
  showing: (from: number, to: number, total: number) => React.ReactNode;
  totalCount: (total: number) => React.ReactNode;
  pageOf: (page: number, totalPages: number) => React.ReactNode;
  rows: string;
  rowsPerPage: string;
  previousPage: string;
  nextPage: string;
  pageN: (n: number) => string;
  bulkActions: string;
  selectedCount: (n: number) => string;
  selectAllRows: string;
  nothingHereYet: string;
  expandRow: string;
  collapseRow: string;
  relative: { justNow: string; minutesAgo: (n: number) => string; hoursAgo: (n: number) => string };
  // shell
  skipToContent: string;
  openNavigation: string;
  closeNavigation: string;
  mainNavigation: string;
  switchToLight: string;
  switchToDark: string;
  lightTheme: string;
  darkTheme: string;
  account: string;
  accountMenuFor: (name: string) => string;
  signOut: string;
  back: string;
  /** Translate a status key (e.g. "IN_PROGRESS"); return undefined to keep the registry/humanised label. */
  statusLabel?: (key: string) => string | undefined;
};

const strong = (v: React.ReactNode) => <span className="font-medium text-fg">{v}</span>;

export const EN_UI_LABELS: UiLabels = {
  cancel: "Cancel",
  confirm: "Confirm",
  delete: "Delete",
  close: "Close",
  apply: "Apply",
  clear: "Clear",
  retry: "Try again",
  refresh: "Refresh",
  loading: "Loading…",
  somethingWentWrong: "Something went wrong",
  areYouSure: "Are you sure?",
  pleaseConfirm: "Please confirm",
  typeToConfirm: (word) => (
    <>
      Type <span className="font-mono font-semibold text-fg">{word}</span> to confirm
    </>
  ),
  dialog: "Dialog",
  panel: "Panel",
  search: "Search…",
  clearSearch: "Clear search",
  clearFilters: (n) => (n > 1 ? `Clear ${n} filters` : "Clear filter"),
  removeFilter: "Remove filter",
  dateRange: "Date range",
  presets: "Presets",
  from: "From",
  to: "To",
  allTime: "All time",
  presetLabels: { today: "Today", last7Days: "Last 7 days", last30Days: "Last 30 days", thisMonth: "This month", lastMonth: "Last month", last90Days: "Last 90 days" },
  pagination: "Pagination",
  showing: (from, to, total) => (
    <>
      Showing {strong(<>{from}–{to}</>)} of {strong(total)}
    </>
  ),
  totalCount: (total) => <>{strong(total)} total</>,
  pageOf: (page, totalPages) => (
    <>
      Page {strong(page)} of {strong(totalPages)}
    </>
  ),
  rows: "Rows",
  rowsPerPage: "Rows per page",
  previousPage: "Previous page",
  nextPage: "Next page",
  pageN: (n) => `Page ${n}`,
  bulkActions: "Bulk actions",
  selectedCount: (n) => `${n} selected`,
  selectAllRows: "Select all rows on this page",
  nothingHereYet: "Nothing here yet",
  expandRow: "Expand row",
  collapseRow: "Collapse row",
  relative: { justNow: "just now", minutesAgo: (n) => `${n}m ago`, hoursAgo: (n) => `${n}h ago` },
  skipToContent: "Skip to content",
  openNavigation: "Open navigation",
  closeNavigation: "Close navigation",
  mainNavigation: "Main",
  switchToLight: "Switch to light theme",
  switchToDark: "Switch to dark theme",
  lightTheme: "Light theme",
  darkTheme: "Dark theme",
  account: "Account",
  accountMenuFor: (name) => `Account menu for ${name}`,
  signOut: "Sign out",
  back: "Back",
};

const UiLabelsContext = React.createContext<UiLabels>(EN_UI_LABELS);

export function UiLabelsProvider({ labels, children }: { labels: Partial<UiLabels>; children: React.ReactNode }) {
  const value = React.useMemo<UiLabels>(
    () => ({
      ...EN_UI_LABELS,
      ...labels,
      presetLabels: { ...EN_UI_LABELS.presetLabels, ...labels.presetLabels },
      relative: { ...EN_UI_LABELS.relative, ...labels.relative },
    }),
    [labels],
  );
  return <UiLabelsContext.Provider value={value}>{children}</UiLabelsContext.Provider>;
}

/** Labels for the current portal; English when no provider is mounted. */
export function useUiLabels(): UiLabels {
  return React.useContext(UiLabelsContext);
}
