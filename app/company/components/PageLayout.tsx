"use client";

import React from "react";
import { EmptyState, type IllustrationName } from "../ui";

/** Shared page header: muted label + navy title. Matches company dashboard pattern. */
export function PageHeader({
  label,
  title,
  description,
  action,
}: {
  label: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {label && <div className="mb-2 text-sm text-[var(--text-muted)]">{label}</div>}
        <h1 className="text-[2rem] font-medium leading-[1.1] tracking-[-0.02em] text-[var(--text-primary)] sm:text-[2.5rem]">{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-[15px] text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center gap-3">{action}</div>}
    </div>
  );
}

/** Shared empty state for tables: 3D illustration + message, spanning every column. */
export function TableEmptyState({
  message,
  description,
  illustration = "clipboard",
  action,
}: {
  message: string;
  description?: string;
  /** Kept for compatibility; the 3D illustration replaces the old line icon. */
  icon?: React.ComponentType<{ className?: string }>;
  illustration?: IllustrationName;
  action?: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={100} className="px-6">
        <EmptyState illustration={illustration} title={message} description={description} action={action} />
      </td>
    </tr>
  );
}

/** Wrapper for table cards: consistent top bar (optional) + table + optional pagination footer. */
export const TABLE_CARD_CLASS = "min-h-[500px] overflow-x-auto !p-0";
export const TABLE_TOP_BAR_CLASS = "border-b border-[var(--divider)] p-5 sm:p-6";
export const TABLE_HEADER_CELL_CLASS = "px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] text-start whitespace-nowrap";
export const TABLE_CELL_CLASS = "px-6 py-4";
export const TABLE_PAGINATION_WRAPPER_CLASS = "px-6 py-2 border-t border-[var(--divider)] flex justify-center";
