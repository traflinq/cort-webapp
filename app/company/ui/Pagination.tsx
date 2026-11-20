"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { useFormatters } from "./format";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Total rows — enables "1–10 of 123". */
  total?: number;
  pageSize?: number;
  className?: string;
}

function pageRange(current: number, total: number): Array<number | "…"> {
  const out: Array<number | "…"> = [];
  let last = 0;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      if (last && i - last > 1) out.push("…");
      out.push(i);
      last = i;
    }
  }
  return out;
}

export function Pagination({ page, totalPages, onPageChange, total, pageSize, className }: PaginationProps) {
  const t = useTranslations("common.ui");
  const { number } = useFormatters();
  if (totalPages <= 1 && !total) return null;
  const pages = Math.max(1, totalPages);
  const summary =
    total !== undefined && pageSize
      ? t("showingRange", { from: number(total === 0 ? 0 : (page - 1) * pageSize + 1), to: number(Math.min(page * pageSize, total)), total: number(total) })
      : t("pageOf", { page: number(page), total: number(pages) });

  return (
    <nav aria-label={t("pagination")} className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3", className)}>
      <p className="text-[13px] text-fg-muted tabular-nums">{summary}</p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon-sm" aria-label={t("previousPage")} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="rtl:-scale-x-100" aria-hidden="true" />
          </Button>
          <div className="hidden items-center gap-1 sm:flex">
            {pageRange(page, pages).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-fg-muted" aria-hidden="true">
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "primary" : "ghost"}
                  size="icon-sm"
                  aria-current={p === page ? "page" : undefined}
                  onClick={() => onPageChange(p)}
                  className="tabular-nums"
                >
                  {number(p)}
                </Button>
              ),
            )}
          </div>
          <Button variant="secondary" size="icon-sm" aria-label={t("nextPage")} disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="rtl:-scale-x-100" aria-hidden="true" />
          </Button>
        </div>
      )}
    </nav>
  );
}
