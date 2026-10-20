"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing, focusRingInset } from "./styles";
import { Checkbox } from "./Checkbox";
import { IconButton } from "./IconButton";
import { Button } from "./Button";
import { ActionMenu, type ActionMenuItem } from "./DropdownMenu";
import { EmptyState, type EmptyStateProps } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { TableSkeletonRows } from "./Skeleton";
import { Pagination, type PaginationProps } from "./Pagination";

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir };
export type RowKey = string | number;

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  /** CSS width, e.g. "12rem" or "1%" for shrink-to-fit. */
  width?: string;
  className?: string;
  headerClassName?: string;
  /** Monospace + tabular numbers (IDs, plates, amounts). */
  mono?: boolean;
  /** Hide the column below this breakpoint. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
}

export interface DataTableExpandable<T> {
  isExpanded: (row: T) => boolean;
  onToggle: (row: T) => void;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => RowKey;

  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: Omit<EmptyStateProps, "compact">;
  skeletonRows?: number;

  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;

  selectable?: boolean;
  selectedKeys?: RowKey[];
  onSelectedKeysChange?: (keys: RowKey[]) => void;
  isRowSelectable?: (row: T) => boolean;
  /** Rendered in the bulk bar when rows are selected. */
  bulkActions?: (selectedKeys: RowKey[], clear: () => void) => React.ReactNode;

  rowActions?: (row: T) => ActionMenuItem[];
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  expandable?: DataTableExpandable<T>;

  pagination?: PaginationProps;
  density?: "compact" | "comfortable";
  stickyHeader?: boolean;
  /** Minimum table width before horizontal scrolling kicks in. */
  minWidth?: number | string;
  /** Screen-reader table caption. */
  caption?: string;
  footer?: React.ReactNode;
  className?: string;
}

const hideCls = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
} as const;

const alignCls = { left: "text-left", right: "text-right", center: "text-center" } as const;

const INTERACTIVE_SELECTOR = "a,button,input,select,textarea,label,[role=menuitem],[role=checkbox],[role=switch]";

function SortIcon({ state }: { state: SortDir | null }) {
  const cls = "size-3.5";
  if (state === "asc") return <ArrowUp className={cls} aria-hidden="true" />;
  if (state === "desc") return <ArrowDown className={cls} aria-hidden="true" />;
  return <ArrowUpDown className={cn(cls, "opacity-40 group-hover:opacity-80")} aria-hidden="true" />;
}

/**
 * The one table. Handles loading / empty / error, sorting (aria-sort), selection + bulk bar,
 * row overflow actions, expandable rows, keyboard-operable row click, and pagination.
 * Data fetching stays in the page; this component is presentational and controlled.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  onRetry,
  empty,
  skeletonRows = 6,
  sort,
  onSortChange,
  selectable = false,
  selectedKeys = [],
  onSelectedKeysChange,
  isRowSelectable,
  bulkActions,
  rowActions,
  onRowClick,
  rowClassName,
  expandable,
  pagination,
  density = "comfortable",
  stickyHeader = false,
  minWidth,
  caption,
  footer,
  className,
}: DataTableProps<T>) {
  const pad = density === "compact" ? "px-3 py-2" : "px-4 py-3";
  const showSkeleton = loading && rows.length === 0 && !error;
  const showError = !!error && rows.length === 0;
  const showEmpty = !loading && !error && rows.length === 0;
  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0) + (expandable ? 1 : 0);

  const selectedSet = React.useMemo(() => new Set<RowKey>(selectedKeys), [selectedKeys]);
  const selectableRows = React.useMemo(() => (isRowSelectable ? rows.filter(isRowSelectable) : rows), [rows, isRowSelectable]);
  const selectableKeys = React.useMemo(() => selectableRows.map(rowKey), [selectableRows, rowKey]);
  const selectedOnPage = selectableKeys.filter((k) => selectedSet.has(k)).length;
  const allSelected = selectableKeys.length > 0 && selectedOnPage === selectableKeys.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  const clearSelection = () => onSelectedKeysChange?.([]);

  const toggleAll = (checked: boolean) => {
    if (!onSelectedKeysChange) return;
    if (checked) onSelectedKeysChange([...new Set([...selectedKeys, ...selectableKeys])]);
    else onSelectedKeysChange(selectedKeys.filter((k) => !selectableKeys.includes(k)));
  };

  const toggleOne = (key: RowKey, checked: boolean) => {
    if (!onSelectedKeysChange) return;
    if (checked) onSelectedKeysChange([...selectedKeys, key]);
    else onSelectedKeysChange(selectedKeys.filter((k) => k !== key));
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {selectable && bulkActions && selectedKeys.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          aria-live="polite"
          className="flex flex-wrap items-center gap-3 border-b border-brand-line bg-brand-soft px-4 py-2 text-sm"
        >
          <span className="font-medium text-fg">
            {selectedKeys.length} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">{bulkActions(selectedKeys, clearSelection)}</div>
          <Button variant="ghost" size="sm" onClick={clearSelection} className="ml-auto">
            Clear
          </Button>
        </div>
      )}

      <div className="relative overflow-x-auto" aria-busy={loading || undefined}>
        {loading && rows.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-brand-soft" aria-hidden="true">
            <div className="h-full w-1/3 animate-indeterminate bg-brand" />
          </div>
        )}

        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead
            className={cn(
              "bg-subtle text-left text-[11px] font-semibold uppercase tracking-wider text-fg-muted",
              stickyHeader && "sticky top-0 z-10 backdrop-blur",
            )}
          >
            <tr>
              {selectable && (
                <th scope="col" className={cn(pad, "w-10")}>
                  <Checkbox
                    aria-label="Select all rows on this page"
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(c) => toggleAll(c === true)}
                    disabled={selectableKeys.length === 0}
                  />
                </th>
              )}
              {expandable && (
                <th scope="col" className="w-8">
                  <span className="sr-only">Expand</span>
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const dir: SortDir | null = isSorted ? sort!.dir : null;
                const ariaSort = isSorted ? (dir === "asc" ? "ascending" : "descending") : col.sortable ? "none" : undefined;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={ariaSort}
                    style={{ width: col.width }}
                    className={cn(pad, "whitespace-nowrap font-semibold", alignCls[col.align ?? "left"], col.hideBelow && hideCls[col.hideBelow], col.headerClassName)}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange({ key: col.key, dir: isSorted && dir === "asc" ? "desc" : "asc" })}
                        className={cn("group -mx-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 uppercase tracking-wider hover:text-fg", focusRing)}
                      >
                        {col.header}
                        <SortIcon state={dir} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th scope="col" className={cn(pad, "w-12 text-right")}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {showSkeleton && <TableSkeletonRows columns={colCount} rows={skeletonRows} cellClassName={pad} />}

            {showError && (
              <tr>
                <td colSpan={colCount} className="p-0">
                  <ErrorState compact message={error} onRetry={onRetry} />
                </td>
              </tr>
            )}

            {showEmpty && (
              <tr>
                <td colSpan={colCount} className="p-0">
                  <EmptyState compact title={empty?.title ?? "Nothing here yet"} description={empty?.description} icon={empty?.icon} action={empty?.action} />
                </td>
              </tr>
            )}

            {!showSkeleton &&
              !showError &&
              rows.map((row, index) => {
                const key = rowKey(row);
                const selected = selectedSet.has(key);
                const clickable = !!onRowClick;
                const expanded = expandable?.isExpanded(row) ?? false;
                const canSelect = isRowSelectable ? isRowSelectable(row) : true;
                return (
                  <React.Fragment key={key}>
                    <tr
                      data-state={selected ? "selected" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={
                        clickable
                          ? (e) => {
                              if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
                              onRowClick(row);
                            }
                          : undefined
                      }
                      onKeyDown={
                        clickable
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
                        "group/row transition-colors hover:bg-row-hover",
                        clickable && cn("cursor-pointer", focusRingInset),
                        selected && "bg-brand-soft/60 hover:bg-brand-soft",
                        loading && "opacity-60",
                        rowClassName?.(row),
                      )}
                    >
                      {selectable && (
                        <td className={pad}>
                          <Checkbox
                            aria-label={`Select row ${index + 1}`}
                            checked={selected}
                            disabled={!canSelect}
                            onCheckedChange={(c) => toggleOne(key, c === true)}
                          />
                        </td>
                      )}
                      {expandable && (
                        <td className="pl-2">
                          <IconButton
                            label={expanded ? "Collapse row" : "Expand row"}
                            size="icon-xs"
                            tooltip={false}
                            aria-expanded={expanded}
                            onClick={() => expandable.onToggle(row)}
                          >
                            <ChevronRight className={cn("transition-transform duration-150", expanded && "rotate-90")} />
                          </IconButton>
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            pad,
                            "align-middle text-fg",
                            alignCls[col.align ?? "left"],
                            col.mono && "font-mono text-[13px] tabular-nums",
                            col.hideBelow && hideCls[col.hideBelow],
                            col.className,
                          )}
                        >
                          {col.cell(row, index)}
                        </td>
                      ))}
                      {rowActions && (
                        <td className={cn(pad, "text-right")}>
                          <ActionMenu items={rowActions(row)} />
                        </td>
                      )}
                    </tr>
                    {expandable && expanded && (
                      <tr className="bg-subtle/60">
                        <td colSpan={colCount} className="p-0">
                          {expandable.render(row)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
          {footer && <tfoot className="border-t border-line bg-subtle text-sm font-medium">{footer}</tfoot>}
        </table>
      </div>

      {pagination && !showSkeleton && !showError && (
        <div className="border-t border-line px-3">
          <Pagination {...pagination} />
        </div>
      )}
    </div>
  );
}

/** Client-side sort helper for small lists (server lists should sort on the API). */
export function sortRows<T>(rows: T[], sort: SortState | null | undefined, accessor: (row: T, key: string) => unknown): T[] {
  if (!sort) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = accessor(a, sort.key);
    const bv = accessor(b, sort.key);
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * dir;
  });
}
