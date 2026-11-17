"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ActionMenu, type ActionMenuItem } from "./Menu";
import { EmptyState, ErrorState, Skeleton, type EmptyStateProps } from "./Feedback";
import { Pagination, type PaginationProps } from "./Pagination";
import { focusRingInset } from "./styles";

export type SortState = { key: string; dir: "asc" | "desc" };

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  /** Text alignment; numbers should be `end`. */
  align?: "start" | "end" | "center";
  /** Tabular digits + end alignment. */
  numeric?: boolean;
  sortable?: boolean;
  /** CSS width, e.g. "12rem" or "1%" to shrink to content. */
  width?: string;
  /** Hide the column below this breakpoint. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: EmptyStateProps;
  /** Opens the row (keyboard: Enter / Space). */
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ActionMenuItem[];
  rowClassName?: (row: T) => string | undefined;
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  pagination?: PaginationProps;
  /** Rendered above the table inside the card (filters, title). */
  toolbar?: React.ReactNode;
  /** Minimum width before the table scrolls horizontally. */
  minWidth?: number;
  /** Screen-reader caption. */
  caption?: string;
  skeletonRows?: number;
  /** Render without the card frame (inside a Card / Drawer). */
  bare?: boolean;
  className?: string;
}

const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;
const ALIGN = { start: "text-start", end: "text-end", center: "text-center" } as const;
const INTERACTIVE = "a,button,input,select,textarea,label,[role=menuitem],[role=checkbox],[role=switch]";

/** Client-side sort helper for tables that hold all their rows. */
export function sortRows<T>(rows: T[], sort: SortState | null | undefined, accessors: Record<string, (row: T) => string | number | null | undefined>) {
  if (!sort || !accessors[sort.key]) return rows;
  const get = accessors[sort.key];
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
  });
}

/**
 * The one table. Handles loading / empty / error, sorting, row-open (mouse + keyboard),
 * row overflow actions, responsive column hiding, horizontal scroll and pagination.
 * Data fetching stays in the page.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  onRetry,
  empty,
  onRowClick,
  rowActions,
  rowClassName,
  sort,
  onSortChange,
  pagination,
  toolbar,
  minWidth = 640,
  caption,
  skeletonRows = 6,
  bare = false,
  className,
}: DataTableProps<T>) {
  const t = useTranslations("common.ui");
  const colCount = columns.length + (rowActions ? 1 : 0);
  const align = (c: Column<T>) => ALIGN[c.align ?? (c.numeric ? "end" : "start")];

  const body = () => {
    if (error) {
      return (
        <tr>
          <td colSpan={colCount}>
            <ErrorState message={error} onRetry={onRetry} compact />
          </td>
        </tr>
      );
    }
    if (loading && rows.length === 0) {
      return Array.from({ length: skeletonRows }).map((_, r) => (
        <tr key={`sk-${r}`} className="border-b border-line last:border-0">
          {columns.map((c) => (
            <td key={c.key} className={cn("px-4 py-3.5", c.hideBelow && HIDE[c.hideBelow])}>
              <Skeleton className="h-4" style={{ width: `${55 + ((r * 13 + c.key.length * 7) % 40)}%` }} />
            </td>
          ))}
          {rowActions && <td className="px-2" />}
        </tr>
      ));
    }
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={colCount}>
            <EmptyState {...empty} compact />
          </td>
        </tr>
      );
    }
    return rows.map((row, i) => {
      const actions = rowActions?.(row);
      return (
        <tr
          key={rowKey(row)}
          tabIndex={onRowClick ? 0 : undefined}
          aria-label={onRowClick ? t("openDetails") : undefined}
          onClick={
            onRowClick
              ? (e) => {
                  if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
                  onRowClick(row);
                }
              : undefined
          }
          onKeyDown={
            onRowClick
              ? (e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(row);
                  }
                }
              : undefined
          }
          className={cn(
            "border-b border-line last:border-0",
            onRowClick && cn("cursor-pointer transition-colors hover:bg-row-hover", focusRingInset),
            loading && "opacity-60",
            rowClassName?.(row),
          )}
        >
          {columns.map((c) => (
            <td key={c.key} className={cn("px-4 py-3 align-middle text-sm text-fg", align(c), c.numeric && "tabular-nums", c.hideBelow && HIDE[c.hideBelow], c.className)}>
              {c.cell(row, i)}
            </td>
          ))}
          {rowActions && <td className="w-px px-2 py-1 text-end align-middle">{actions && <ActionMenu items={actions} />}</td>}
        </tr>
      );
    });
  };

  return (
    <div className={cn(!bare && "overflow-hidden rounded-lg border border-line bg-card", className)}>
      {toolbar && <div className="border-b border-line px-4 py-3">{toolbar}</div>}
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth }} aria-busy={loading || undefined}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-line bg-subtle">
              {columns.map((c) => {
                const active = sort?.key === c.key ? sort.dir : null;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={c.sortable ? (active === "asc" ? "ascending" : active === "desc" ? "descending" : "none") : undefined}
                    className={cn("whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-fg-muted", align(c), c.hideBelow && HIDE[c.hideBelow])}
                  >
                    {c.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange({ key: c.key, dir: active === "asc" ? "desc" : "asc" })}
                        className={cn("inline-flex cursor-pointer items-center gap-1 rounded hover:text-fg", focusRingInset, active && "text-fg")}
                      >
                        {c.header}
                        {active === "asc" ? <ArrowUp className="size-3.5" aria-hidden="true" /> : active === "desc" ? <ArrowDown className="size-3.5" aria-hidden="true" /> : <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden="true" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th scope="col" className="w-px px-2">
                  <span className="sr-only">{t("moreActions")}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>{body()}</tbody>
        </table>
      </div>
      {pagination && !error && <Pagination {...pagination} className={cn("border-t border-line", pagination.className)} />}
    </div>
  );
}
