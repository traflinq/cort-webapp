"use client";

import React from "react";
import { EmptyState, PageHeader as KitPageHeader } from "../ui";

/**
 * Legacy entry points, now thin wrappers over the company design system (app/company/ui) so
 * pages that have not been migrated yet already use the shared header and table styling.
 * New code should import from "@/app/company/ui" directly.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  /** Kept for old call sites; the section name now lives in the top-bar breadcrumbs. */
  label?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <KitPageHeader title={title} description={description} actions={action} />;
}

/** Empty state row for hand-written tables. */
export function TableEmptyState({ message, icon: Icon }: { message: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <tr>
      <td colSpan={100}>
        <EmptyState title={message} icon={Icon ? <Icon /> : undefined} compact />
      </td>
    </tr>
  );
}

export const TABLE_CARD_CLASS = "overflow-hidden !p-0";
export const TABLE_TOP_BAR_CLASS = "border-b border-line px-4 py-3";
export const TABLE_HEADER_CELL_CLASS = "whitespace-nowrap bg-subtle px-4 py-2.5 text-start text-xs font-semibold text-fg-muted";
export const TABLE_CELL_CLASS = "px-4 py-3 text-sm";
export const TABLE_PAGINATION_WRAPPER_CLASS = "border-t border-line";
