"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton, focusRing } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { formatLocaleNumber } from "@/app/lib/i18n/format";
import type { Locale } from "@/i18n/config";

/** Rows per page for every paged table in the company portal. */
export const COMPANY_PAGE_SIZE = 10;

export interface TablePaginationProps {
  page: number;
  totalPages: number;
  /** Total rows across all pages. */
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Wording for the range, e.g. t("showingRange", range). Defaults to "Showing 1–10 of 57". */
  summary?: (range: { from: string; to: string; total: string }) => React.ReactNode;
}

/** 1 … 4 5 6 … 20 — first, last and the current page's neighbours. */
function pageRange(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev > 1) out.push(p - prev === 2 ? prev + 1 : "…");
    out.push(p);
    prev = p;
  }
  return out;
}

/**
 * Table footer used by every paged list in the company portal: the visible range on the
 * start side, page controls on the end side. Renders nothing when the table is empty.
 */
export function TablePagination({ page, totalPages, total, pageSize, onPageChange, summary }: TablePaginationProps) {
  const t = useTranslations("common.pagination");
  const locale = useLocale() as Locale;
  if (total <= 0) return null;

  const pages = Math.max(1, totalPages || 1);
  const current = Math.min(Math.max(1, page), pages);
  const num = (n: number) => formatLocaleNumber(n, locale);
  const range = {
    from: num(Math.min(total, (current - 1) * pageSize + 1)),
    to: num(Math.min(total, current * pageSize)),
    total: num(total),
  };

  return (
    <nav
      aria-label={t("label")}
      className="flex flex-col items-center gap-3 border-t border-line px-4 py-3 sm:flex-row sm:justify-between sm:px-5"
    >
      <p className="text-xs tabular-nums text-fg-muted">{summary ? summary(range) : t("showing", range)}</p>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          <IconButton
            label={t("previous")}
            size="icon-sm"
            variant="outline"
            disabled={current <= 1}
            onClick={() => onPageChange(current - 1)}
            tooltip={false}
          >
            <ChevronLeft className="rtl:rotate-180" />
          </IconButton>
          <ul className="hidden items-center gap-1 sm:flex">
            {pageRange(current, pages).map((p, i) =>
              p === "…" ? (
                <li key={`gap-${i}`} className="px-1 text-xs text-fg-muted" aria-hidden="true">
                  …
                </li>
              ) : (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => p !== current && onPageChange(p)}
                    aria-current={p === current ? "page" : undefined}
                    aria-label={t("page", { page: num(p) })}
                    className={cn(
                      "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-medium tabular-nums transition-colors",
                      p === current ? "bg-fg text-page" : "text-fg-secondary hover:bg-subtle hover:text-fg",
                      focusRing,
                    )}
                  >
                    {num(p)}
                  </button>
                </li>
              ),
            )}
          </ul>
          <span className="px-2 text-xs font-medium tabular-nums text-fg sm:hidden" aria-live="polite">
            {t("pageOf", { page: num(current), pages: num(pages) })}
          </span>
          <IconButton
            label={t("next")}
            size="icon-sm"
            variant="outline"
            disabled={current >= pages}
            onClick={() => onPageChange(current + 1)}
            tooltip={false}
          >
            <ChevronRight className="rtl:rotate-180" />
          </IconButton>
        </div>
      )}
    </nav>
  );
}
