"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "./styles";
import { IconButton } from "./IconButton";
import { Select } from "./Select";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Total row count — enables "Showing 1–10 of 123". */
  total?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

function pageRange(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push(p - prev === 2 ? prev + 1 : "…");
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({ page, totalPages, onPageChange, total, pageSize, onPageSizeChange, pageSizeOptions = [10, 25, 50, 100], className }: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const hasPages = safeTotalPages > 1;
  if (!hasPages && total === undefined && !onPageSizeChange) return null;

  const from = total !== undefined && pageSize ? Math.min(total, (page - 1) * pageSize + 1) : undefined;
  const to = total !== undefined && pageSize ? Math.min(total, page * pageSize) : undefined;

  return (
    <nav aria-label="Pagination" className={cn("flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center gap-3 text-xs text-fg-muted">
        {total !== undefined ? (
          from !== undefined ? (
            <span>
              Showing <span className="font-medium text-fg">{total === 0 ? 0 : from}–{to}</span> of{" "}
              <span className="font-medium text-fg">{total}</span>
            </span>
          ) : (
            <span>
              <span className="font-medium text-fg">{total}</span> total
            </span>
          )
        ) : (
          <span>
            Page <span className="font-medium text-fg">{page}</span> of <span className="font-medium text-fg">{safeTotalPages}</span>
          </span>
        )}
        {onPageSizeChange && pageSize && (
          <label className="flex items-center gap-1.5">
            <span>Rows</span>
            <Select
              width="auto"
              aria-label="Rows per page"
              className="h-7 py-0 pr-7 text-xs"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>

      {hasPages && (
        <div className="flex items-center gap-1">
          <IconButton label="Previous page" size="icon-sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)} tooltip={false}>
            <ChevronLeft />
          </IconButton>
          <ul className="hidden items-center gap-1 sm:flex">
            {pageRange(page, safeTotalPages).map((p, i) =>
              p === "…" ? (
                <li key={`e${i}`} className="px-1 text-xs text-fg-muted" aria-hidden="true">
                  …
                </li>
              ) : (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => onPageChange(p)}
                    aria-current={p === page ? "page" : undefined}
                    aria-label={`Page ${p}`}
                    className={cn(
                      "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-medium tabular-nums transition-colors",
                      p === page ? "bg-fg text-page" : "text-fg-secondary hover:bg-subtle hover:text-fg",
                      focusRing,
                    )}
                  >
                    {p}
                  </button>
                </li>
              ),
            )}
          </ul>
          <span className="px-2 text-xs font-medium tabular-nums text-fg sm:hidden" aria-live="polite">
            {page} / {safeTotalPages}
          </span>
          <IconButton
            label="Next page"
            size="icon-sm"
            variant="outline"
            disabled={page >= safeTotalPages}
            onClick={() => onPageChange(page + 1)}
            tooltip={false}
          >
            <ChevronRight />
          </IconButton>
        </div>
      )}
    </nav>
  );
}
