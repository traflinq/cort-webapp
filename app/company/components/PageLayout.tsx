"use client";

import React from "react";
import { Inbox } from "lucide-react";

/** Shared page header: optional section name, title, description and right-aligned actions. */
export function PageHeader({
  label,
  title,
  description,
  action,
}: {
  label?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {label && <p className="mb-1 text-xs font-medium text-fg-muted">{label}</p>}
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{action}</div>}
    </header>
  );
}

/** Shared empty state for tables. */
export function TableEmptyState({
  message,
  icon: Icon,
}: {
  message: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const IconComponent = Icon ?? Inbox;
  return (
    <tr>
      <td colSpan={100} className="px-4 py-12 text-center">
        <div className="flex flex-col items-center justify-center gap-3 text-sm text-fg-muted">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-subtle">
            <IconComponent className="size-5" />
          </span>
          <span>{message}</span>
        </div>
      </td>
    </tr>
  );
}

/** Table card pieces: consistent top bar + table + optional pagination footer. */
export const TABLE_CARD_CLASS = "overflow-hidden !p-0";
export const TABLE_TOP_BAR_CLASS = "border-b border-line px-4 py-3 sm:px-5";
export const TABLE_HEADER_CELL_CLASS = "px-4 py-3 text-xs font-medium text-fg-muted whitespace-nowrap";
export const TABLE_CELL_CLASS = "px-4 py-3 tabular-nums";
export const TABLE_PAGINATION_WRAPPER_CLASS = "flex justify-center border-t border-line px-4 py-3";
