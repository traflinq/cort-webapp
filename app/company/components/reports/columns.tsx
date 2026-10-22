"use client";

import type { DataTableColumn, Formatters } from "@/app/ui";
import { StatusBadge } from "@/app/ui";
import type { ChauffeurReport, ShuttleReport } from "@/app/lib/services/types/reports";

type T = (key: string, values?: Record<string, string | number>) => string;

export function extrasTotal(r: ChauffeurReport): number {
  return Number(r.breakdown.toll) + Number(r.breakdown.parking) + Number(r.breakdown.accommodation) + Number(r.breakdown.outstation_allowance);
}

/** Chauffeur report columns, labelled with `company.reports.*`. */
export function chauffeurColumns(t: T, fmt: Formatters): DataTableColumn<ChauffeurReport>[] {
  return [
    { key: "completed_at", header: t("date"), width: "11rem", cell: (r) => <span className="whitespace-nowrap text-fg-secondary">{r.completed_at ? fmt.formatDateTime(r.completed_at) : "—"}</span> },
    { key: "city", header: t("city"), hideBelow: "xl", cell: (r) => r.city || <span className="text-fg-muted">—</span> },
    { key: "id", header: t("bookingId"), mono: true, cell: (r) => <span className="font-medium text-fg">#{r.id}</span> },
    {
      key: "passenger",
      header: t("passenger"),
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-fg">{r.passenger?.full_name || t("guest")}</div>
          <div className="truncate text-xs text-fg-muted">{r.passenger?.employee_id || "—"}</div>
        </div>
      ),
    },
    {
      key: "vehicle",
      header: t("vehicle"),
      hideBelow: "md",
      cell: (r) =>
        r.vehicle ? (
          <div className="min-w-0">
            <div className="text-fg">{r.vehicle.make} {r.vehicle.model}</div>
            <div className="font-mono text-xs text-fg-muted">{r.vehicle.plate_number}</div>
          </div>
        ) : (
          <span className="text-fg-muted">—</span>
        ),
    },
    {
      key: "route",
      header: t("route"),
      hideBelow: "lg",
      cell: (r) => (
        <div className="min-w-0 max-w-xs">
          <div className="truncate text-fg" title={r.route.pickup}>
            <span className="me-1 font-semibold text-success-ink">A</span>
            {r.route.pickup || "—"}
          </div>
          <div className="truncate text-xs text-fg-muted" title={r.route.dropoff}>
            <span className="me-1 font-semibold text-danger-ink">B</span>
            {r.route.dropoff || "—"}
          </div>
        </div>
      ),
    },
    { key: "total_duration_minutes", header: t("durMin"), align: "right", mono: true, hideBelow: "sm", cell: (r) => fmt.formatNumber(r.total_duration_minutes) },
    { key: "total_distance_km", header: t("distKm"), align: "right", mono: true, hideBelow: "sm", cell: (r) => fmt.formatNumber(r.total_distance_km, { digits: 1 }) },
    { key: "service_charge", header: t("svcChg"), align: "right", mono: true, hideBelow: "xl", cell: (r) => <span className="text-fg-secondary">{fmt.formatNumber(r.breakdown.service_charge)}</span> },
    { key: "fuel", header: t("fuel"), align: "right", mono: true, hideBelow: "xl", cell: (r) => <span className="text-fg-secondary">{fmt.formatNumber(r.breakdown.fuel_cost)}</span> },
    { key: "extras", header: t("extras"), align: "right", mono: true, hideBelow: "xl", cell: (r) => <span className="text-fg-secondary">{fmt.formatNumber(extrasTotal(r))}</span> },
    { key: "total_cost", header: t("totalPkr"), align: "right", mono: true, cell: (r) => <span className="font-medium text-fg">{fmt.formatCurrency(r.total_cost)}</span> },
  ];
}

/** Shuttle report columns, labelled with `company.reports.*`. */
export function shuttleColumns(t: T, fmt: Formatters): DataTableColumn<ShuttleReport>[] {
  return [
    { key: "trip_date", header: t("tripDate"), width: "8rem", cell: (l) => <span className="whitespace-nowrap font-medium text-fg">{fmt.formatDate(l.trip_date)}</span> },
    { key: "direction", header: t("direction"), cell: (l) => <StatusBadge status={l.direction} /> },
    { key: "id", header: t("tripId"), mono: true, hideBelow: "md", cell: (l) => <span className="font-medium text-fg">#{l.id}</span> },
    { key: "route", header: t("route"), cell: (l) => <span className="font-medium text-fg">{l.route?.name || "—"}</span> },
    {
      key: "vehicle",
      header: t("vehicle"),
      hideBelow: "lg",
      cell: (l) =>
        l.vehicle ? (
          <div className="min-w-0">
            <div className="text-fg">{l.vehicle.make} {l.vehicle.model}</div>
            <div className="font-mono text-xs text-fg-muted">{l.vehicle.plate_number}</div>
          </div>
        ) : (
          <span className="text-fg-muted">—</span>
        ),
    },
    { key: "driver", header: t("driver"), hideBelow: "lg", cell: (l) => l.driver?.full_name || <span className="text-fg-muted">—</span> },
    {
      key: "passengers",
      header: t("boardingSummary"),
      align: "right",
      mono: true,
      cell: (l) => (
        <span className="whitespace-nowrap">
          <span className="text-success-ink">{l.passengers.boarded}</span>
          <span className="text-fg-muted"> / </span>
          <span className="text-danger-ink">{l.passengers.absent}</span>
          <span className="text-fg-muted"> / {l.passengers.total}</span>
        </span>
      ),
    },
    { key: "started_at", header: t("startedAt"), hideBelow: "xl", cell: (l) => <span className="whitespace-nowrap text-xs text-fg-secondary">{l.started_at ? fmt.formatDateTime(l.started_at) : "—"}</span> },
    { key: "completed_at", header: t("completedAt"), hideBelow: "xl", cell: (l) => <span className="whitespace-nowrap text-xs text-fg-secondary">{l.completed_at ? fmt.formatDateTime(l.completed_at) : "—"}</span> },
  ];
}
