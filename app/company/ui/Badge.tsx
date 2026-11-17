"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "purple";

const TONE: Record<Tone, string> = {
  neutral: "bg-neutral-soft text-neutral-ink border-neutral-line",
  brand: "bg-brand-soft text-brand-ink border-brand-line",
  success: "bg-success-soft text-success-ink border-success-line",
  warning: "bg-warning-soft text-warning-ink border-warning-line",
  danger: "bg-danger-soft text-danger-ink border-danger-line",
  info: "bg-info-soft text-info-ink border-info-line",
  purple: "bg-purple-soft text-purple-ink border-purple-line",
};

export function Badge({
  tone = "neutral",
  dot = false,
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean; icon?: React.ReactNode }) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:size-3.5",
        TONE[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Every backend status / enum the company portal shows, with its tone and translation key
 * (`company.status.*`). Unknown values fall back to neutral + humanised text — never a raw enum.
 */
const STATUS: Record<string, { tone: Tone; key: string }> = {
  // bookings / trips
  PENDING: { tone: "warning", key: "pending" },
  ASSIGNED: { tone: "info", key: "assigned" },
  CONFIRMED: { tone: "info", key: "confirmed" },
  OTW: { tone: "info", key: "onTheWay" },
  ARRIVED: { tone: "purple", key: "arrived" },
  IN_PROGRESS: { tone: "brand", key: "inProgress" },
  ONGOING: { tone: "brand", key: "inProgress" },
  STARTED: { tone: "brand", key: "inProgress" },
  DROPPED_OFF: { tone: "success", key: "completed" },
  ENDED: { tone: "success", key: "completed" },
  COMPLETED: { tone: "success", key: "completed" },
  CANCELLED: { tone: "neutral", key: "cancelled" },
  SCHEDULED: { tone: "neutral", key: "scheduled" },
  NOT_STARTED: { tone: "neutral", key: "notStarted" },
  // vendor requests
  ACCEPTED: { tone: "success", key: "accepted" },
  REJECTED: { tone: "danger", key: "rejected" },
  DECLINED: { tone: "danger", key: "rejected" },
  EXPIRED: { tone: "neutral", key: "expired" },
  // people / assets
  ACTIVE: { tone: "success", key: "active" },
  INACTIVE: { tone: "neutral", key: "inactive" },
  MAINTENANCE: { tone: "warning", key: "maintenance" },
  // invoices
  PAID: { tone: "success", key: "paid" },
  UNPAID: { tone: "warning", key: "unpaid" },
  PARTIALLY_PAID: { tone: "info", key: "partiallyPaid" },
  OVERDUE: { tone: "danger", key: "overdue" },
  DRAFT: { tone: "neutral", key: "draft" },
  // boarding
  BOARDED: { tone: "success", key: "boarded" },
  ABSENT: { tone: "danger", key: "absent" },
  // fulfilment
  CORT_MANAGED: { tone: "info", key: "cortManaged" },
  EXTERNAL_VENDOR: { tone: "purple", key: "externalVendor" },
  SELF_MANAGED: { tone: "neutral", key: "selfManaged" },
  // directions / trip types / driver types
  MORNING: { tone: "warning", key: "morning" },
  EVENING: { tone: "info", key: "evening" },
  IN_CITY: { tone: "info", key: "inCity" },
  OUT_STATION: { tone: "brand", key: "outstation" },
  CHAUFFEUR: { tone: "info", key: "chauffeur" },
  SHUTTLE: { tone: "purple", key: "shuttle" },
  BOTH: { tone: "neutral", key: "both" },
  // severity
  LOW: { tone: "info", key: "low" },
  MEDIUM: { tone: "warning", key: "medium" },
  HIGH: { tone: "brand", key: "high" },
  CRITICAL: { tone: "danger", key: "critical" },
};

const humanize = (v: string) => v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Translated label for a backend status/enum value. */
export function useStatusLabel() {
  const t = useTranslations("company.status");
  return React.useCallback(
    (status: string | null | undefined) => {
      if (!status) return "—";
      const entry = STATUS[status.toUpperCase()];
      return entry ? t(entry.key) : humanize(status);
    },
    [t],
  );
}

export function StatusBadge({
  status,
  label,
  tone,
  dot = true,
  className,
}: {
  status: string | null | undefined;
  /** Override the translated label. */
  label?: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  const statusLabel = useStatusLabel();
  const entry = status ? STATUS[status.toUpperCase()] : undefined;
  return (
    <Badge tone={tone ?? entry?.tone ?? "neutral"} dot={dot} className={className}>
      {label ?? statusLabel(status)}
    </Badge>
  );
}
