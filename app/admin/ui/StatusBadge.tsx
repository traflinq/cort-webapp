"use client";

import * as React from "react";
import { Badge, type BadgeTone } from "./Badge";
import { humanize } from "../lib/format";

export type StatusEntry = { tone: BadgeTone; label?: string };

/**
 * The single status → tone registry for the admin portal.
 * Keys are upper-snake-case. Unknown statuses fall back to neutral + humanized text.
 */
export const STATUS_REGISTRY: Record<string, StatusEntry> = {
  // awaiting action
  PENDING: { tone: "warning" },
  PENDING_APPROVAL: { tone: "warning", label: "Pending approval" },
  REQUESTED: { tone: "warning" },
  UNASSIGNED: { tone: "warning" },
  DUE: { tone: "warning" },
  PARTIAL: { tone: "warning" },
  PARTIALLY_PAID: { tone: "warning", label: "Partially paid" },
  DELAYED: { tone: "warning" },
  MAINTENANCE: { tone: "warning" },
  UNDER_REVIEW: { tone: "warning", label: "Under review" },
  // scheduled / assigned
  SCHEDULED: { tone: "info" },
  ASSIGNED: { tone: "info" },
  CONFIRMED: { tone: "info" },
  ACCEPTED: { tone: "info" },
  ADVANCE: { tone: "info" },
  PAID_ADVANCE: { tone: "info", label: "Advance paid" },
  SENT: { tone: "info" },
  // live
  IN_PROGRESS: { tone: "brand", label: "In progress" },
  ONGOING: { tone: "brand" },
  STARTED: { tone: "brand" },
  EN_ROUTE: { tone: "brand", label: "En route" },
  LIVE: { tone: "brand" },
  // good
  ACTIVE: { tone: "success" },
  COMPLETED: { tone: "success" },
  ENDED: { tone: "success" },
  DONE: { tone: "success" },
  APPROVED: { tone: "success" },
  PAID: { tone: "success" },
  SETTLED: { tone: "success" },
  ONLINE: { tone: "success" },
  VERIFIED: { tone: "success" },
  ENABLED: { tone: "success" },
  // neutral / off
  INACTIVE: { tone: "neutral" },
  DRAFT: { tone: "neutral" },
  ARCHIVED: { tone: "neutral" },
  OFFLINE: { tone: "neutral" },
  DEACTIVATED: { tone: "neutral" },
  DISABLED: { tone: "neutral" },
  EXPIRED: { tone: "neutral" },
  NOT_STARTED: { tone: "neutral", label: "Not started" },
  // bad
  CANCELLED: { tone: "danger" },
  CANCELED: { tone: "danger", label: "Cancelled" },
  REJECTED: { tone: "danger" },
  FAILED: { tone: "danger" },
  OVERDUE: { tone: "danger" },
  UNPAID: { tone: "danger" },
  SUSPENDED: { tone: "danger" },
  NO_SHOW: { tone: "danger", label: "No show" },
  ERROR: { tone: "danger" },
  // misc
  TRIAL: { tone: "purple" },
  SHUTTLE: { tone: "info" },
  CHAUFFEUR: { tone: "purple" },
  POOL: { tone: "brand" },
  MORNING: { tone: "warning" },
  EVENING: { tone: "purple" },
};

export function statusKey(status: string | null | undefined): string {
  return String(status ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function statusTone(status: string | null | undefined, overrides?: Record<string, StatusEntry>): BadgeTone {
  const key = statusKey(status);
  return overrides?.[key]?.tone ?? STATUS_REGISTRY[key]?.tone ?? "neutral";
}

export interface StatusBadgeProps {
  status: string | null | undefined;
  /** Override the displayed text. */
  label?: React.ReactNode;
  size?: "sm" | "md";
  dot?: boolean;
  variant?: "soft" | "outline" | "solid";
  /** Page-specific additions or overrides to the registry. */
  overrides?: Record<string, StatusEntry>;
  className?: string;
}

/** Status pill driven by the shared registry. Always shows text, never colour alone. */
export function StatusBadge({ status, label, size = "md", dot = true, variant = "soft", overrides, className }: StatusBadgeProps) {
  const key = statusKey(status);
  const entry = overrides?.[key] ?? STATUS_REGISTRY[key];
  const text = label ?? entry?.label ?? humanize(status) ?? "—";
  return (
    <Badge tone={entry?.tone ?? "neutral"} dot={dot} size={size} variant={variant} className={className}>
      {text || "—"}
    </Badge>
  );
}
