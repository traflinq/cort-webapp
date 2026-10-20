"use client";

import { KpiCard, type BadgeTone } from "../../../ui";
import type { BookingStats } from "../hooks/usePendingBookings";

type BookingStatsBarProps = {
  stats: BookingStats | null;
  loading?: boolean;
  activeStatus: string;
  onFilterByStatus: (status: string) => void;
};

const ITEMS: { label: string; key: keyof BookingStats; status: string; tone: BadgeTone }[] = [
  { label: "Total", key: "total", status: "", tone: "neutral" },
  { label: "Pending", key: "pending", status: "PENDING", tone: "warning" },
  { label: "Assigned", key: "assigned", status: "ASSIGNED", tone: "info" },
  { label: "Arrived", key: "arrived", status: "ARRIVED", tone: "info" },
  { label: "In progress", key: "in_progress", status: "IN_PROGRESS", tone: "brand" },
  { label: "Ended", key: "ended", status: "ENDED", tone: "purple" },
  { label: "Completed", key: "completed", status: "COMPLETED", tone: "success" },
  { label: "Cancelled", key: "cancelled", status: "CANCELLED", tone: "danger" },
];

/** Clickable status counts; clicking one applies it as the status filter (click again to clear). */
export function BookingStatsBar({ stats, loading, activeStatus, onFilterByStatus }: BookingStatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8" role="group" aria-label="Bookings by status">
      {ITEMS.map((item) => {
        const active = activeStatus === item.status;
        return (
          <KpiCard
            key={item.key}
            loading={loading && !stats}
            label={item.label}
            value={stats ? stats[item.key] : "—"}
            tone={item.tone}
            emphasis={active ? "brand" : "none"}
            onClick={() => onFilterByStatus(active && item.status ? "" : item.status)}
            className="p-3 [&_p:first-child]:text-xs"
            hint={active ? "Filtering" : undefined}
          />
        );
      })}
    </div>
  );
}
