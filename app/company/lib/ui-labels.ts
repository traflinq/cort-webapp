"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { UiLabels } from "@/app/ui";

/** Translated defaults for the shared primitives (keys live under common.ui.* in both message files). */
export function useCompanyUiLabels(): Partial<UiLabels> {
  const t = useTranslations("common");
  return useMemo<Partial<UiLabels>>(
    () => ({
      cancel: t("actions.cancel"),
      confirm: t("actions.confirm"),
      delete: t("actions.delete"),
      close: t("actions.close"),
      apply: t("ui.apply"),
      clear: t("ui.clear"),
      retry: t("actions.tryAgain"),
      refresh: t("ui.refresh"),
      loading: t("status.loading"),
      somethingWentWrong: t("errors.somethingWentWrong"),
      areYouSure: t("ui.areYouSure"),
      pleaseConfirm: t("ui.pleaseConfirm"),
      typeToConfirm: (word) => t.rich("ui.typeToConfirm", { word: () => word }),
      dialog: t("ui.dialog"),
      panel: t("ui.panel"),
      search: t("ui.searchPlaceholder"),
      clearSearch: t("ui.clearSearch"),
      clearFilters: (n) => t("ui.clearFilters", { count: n }),
      removeFilter: t("ui.removeFilter"),
      dateRange: t("ui.dateRange"),
      presets: t("ui.presets"),
      from: t("ui.from"),
      to: t("ui.to"),
      allTime: t("ui.allTime"),
      presetLabels: {
        today: t("misc.today"),
        last7Days: t("ui.last7Days"),
        last30Days: t("ui.last30Days"),
        thisMonth: t("ui.thisMonth"),
        lastMonth: t("ui.lastMonth"),
        last90Days: t("ui.last90Days"),
      },
      pagination: t("ui.pagination"),
      showing: (from, to, total) => t.rich("ui.showing", { from, to, total, strong: (c) => c }),
      totalCount: (total) => t("ui.totalCount", { total }),
      pageOf: (page, totalPages) => t("ui.pageOf", { page, totalPages }),
      rows: t("ui.rows"),
      rowsPerPage: t("ui.rowsPerPage"),
      previousPage: t("ui.previousPage"),
      nextPage: t("ui.nextPage"),
      pageN: (n) => t("ui.pageN", { n }),
      bulkActions: t("ui.bulkActions"),
      selectedCount: (n) => t("ui.selectedCount", { count: n }),
      selectAllRows: t("ui.selectAllRows"),
      nothingHereYet: t("ui.nothingHereYet"),
      expandRow: t("ui.expandRow"),
      collapseRow: t("ui.collapseRow"),
      relative: {
        justNow: t("ui.justNow"),
        minutesAgo: (n) => t("ui.minutesAgo", { n }),
        hoursAgo: (n) => t("ui.hoursAgo", { n }),
      },
      skipToContent: t("ui.skipToContent"),
      openNavigation: t("ui.openNavigation"),
      closeNavigation: t("ui.closeNavigation"),
      mainNavigation: t("ui.mainNavigation"),
      switchToLight: t("ui.switchToLight"),
      switchToDark: t("ui.switchToDark"),
      lightTheme: t("ui.lightTheme"),
      darkTheme: t("ui.darkTheme"),
      account: t("ui.account"),
      accountMenuFor: (name) => t("ui.accountMenuFor", { name }),
      signOut: t("actions.signOut"),
      back: t("actions.back"),
      statusLabel: (key) => {
        const k = STATUS_KEY_MAP[key];
        if (!k) return undefined;
        return k.includes(".") ? t(k) : t(`status.${k}`);
      },
    }),
    [t],
  );
}

/** Registry key → common.status.* key. Add here when a status gets a translation. */
const STATUS_KEY_MAP: Record<string, string> = {
  PENDING: "pending",
  ASSIGNED: "assigned",
  ARRIVED: "arrived",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  ACTIVE: "active",
  INACTIVE: "inactive",
  OVERDUE: "overdue",
  CORT_MANAGED: "fulfillment.cortManaged",
  EXTERNAL_VENDOR: "fulfillment.externalVendor",
  SELF_MANAGED: "fulfillment.selfManaged",
};
