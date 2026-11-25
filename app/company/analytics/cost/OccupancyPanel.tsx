"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { SectionHeading, UtilizationBar } from "../components/ui";
import { useCostFetch, useFmt, filterQuery, type CostFilters } from "./hooks";
import { OccupancyBandsChart, OccupancyTrendChart } from "./charts";
import { BasisBadge, Drawer, EmptyNote, ErrorNote, FigureValue, MethodNote, Skeleton, StatBlock, Tag } from "./ui";
import type { OccupancyReport, OccupancyRow, OccupancyStatus } from "./types";

const STATUS_TONE: Record<OccupancyStatus, "success" | "warning" | "neutral" | "danger" | "brand"> = {
  UNDERUTILISED: "warning",
  OK: "success",
  FULL: "brand",
  OVER_CAPACITY: "danger",
  CAPACITY_UNKNOWN: "neutral",
  NO_ROSTER: "neutral",
};

export function OccupancyPanel({ filters }: { filters: CostFilters }) {
  const t = useTranslations("company.costOptimization.occupancy");
  const tc = useTranslations("company.costOptimization");
  const fmt = useFmt();
  const report = useCostFetch<OccupancyReport>(`/company/cost-optimization/occupancy?${filterQuery(filters)}`);
  const [selected, setSelected] = useState<OccupancyRow | null>(null);

  if (report.error) return <ErrorNote message={tc("loadFailed")} detail={report.error} onRetry={report.reload} />;
  if (!report.data) return <Skeleton className="h-72" />;
  const r = report.data;
  const s = r.summary;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={t("title")} description={t("description")} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBlock label={t("average")} figure={s.average_occupancy} hint={t("assignedSeats", { assigned: s.assigned, seats: s.seats })} />
        <CountBlock
          label={t("underutilisedVehicles")}
          value={s.underutilised_vehicles ?? s.underutilised}
          hint={t("underutilisedTrips", { trips: s.underutilised })}
          tone="warning"
        />
        <CountBlock label={t("overCapacity")} value={s.over_capacity} hint={t("overCapacityHint")} tone="danger" />
        <CountBlock label={t("capacityUnknown")} value={s.capacity_unknown} hint={t("capacityUnknownHint")} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="rounded-2xl border border-line bg-card p-4 xl:col-span-2">
          <p className="mb-3 text-sm font-semibold text-fg">{t("bandsTitle")}</p>
          <OccupancyBandsChart bands={s.bands} />
        </div>
        <div className="rounded-2xl border border-line bg-card p-4 xl:col-span-3">
          <p className="text-sm font-semibold text-fg">{t("trendTitle")}</p>
          <p className="mb-2 text-xs text-fg-muted">{t("trendDescription")}</p>
          {r.trend.some((p) => p.occupancy_pct !== null) ? <OccupancyTrendChart trend={r.trend} /> : <EmptyNote>{t("noTrend")}</EmptyNote>}
        </div>
      </div>

      {r.rows.length === 0 ? (
        <EmptyNote>{t("empty")}</EmptyNote>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-fg-muted">
                <th className="px-4 py-3 text-start font-medium">{t("colRoute")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("colVehicle")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("colSeats")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("colAssigned")}</th>
                <th className="w-44 px-3 py-3 text-start font-medium">{t("colOccupancy")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("colEmpty")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("colTripCost")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("colPerEmployee")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.rows.map((row) => (
                <tr key={`${row.route.id}-${row.direction}`} className="cursor-pointer hover:bg-subtle/50" onClick={() => setSelected(row)}>
                  <td className="px-4 py-3">
                    <button type="button" className="text-start font-semibold text-fg hover:underline" onClick={() => setSelected(row)}>
                      {row.route.name}
                    </button>
                    <p className="text-xs text-fg-muted">{t(`dir.${row.direction}` as never)}</p>
                  </td>
                  <td className="px-3 py-3 text-fg-muted">{row.vehicle?.plate ?? "—"}</td>
                  <td className="px-3 py-3 text-end tabular-nums">{fmt.n(row.occupancy.capacity)}</td>
                  <td className="px-3 py-3 text-end tabular-nums">{fmt.n(row.occupancy.assigned)}</td>
                  <td className="px-3 py-3">{row.occupancy.occupancy_pct.value === null ? <span className="text-xs text-fg-muted">—</span> : <UtilizationBar pct={Math.round(row.occupancy.occupancy_pct.value)} lowBelow={50} />}</td>
                  <td className="px-3 py-3 text-end tabular-nums">{fmt.fig(row.occupancy.empty_seats)}</td>
                  <td className="px-3 py-3 text-end tabular-nums">{fmt.fig(row.trip_cost.total)}</td>
                  <td className="px-3 py-3 text-end tabular-nums">{fmt.fig(row.cost_per_assigned_employee)}</td>
                  <td className="px-4 py-3">
                    <Tag tone={STATUS_TONE[row.occupancy.status]}>{t(`status.${row.occupancy.status}` as never)}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MethodNote lines={r.method} />
      <OccupancyDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function CountBlock({ label, value, hint, tone }: { label: string; value: number; hint: string; tone?: "warning" | "danger" }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4">
      <p className="text-[13px] font-medium text-fg-muted">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${value > 0 && tone === "warning" ? "text-warning-ink" : value > 0 && tone === "danger" ? "text-danger-ink" : "text-fg"}`}>{value}</p>
      <p className="text-xs text-fg-muted">{hint}</p>
    </div>
  );
}

function OccupancyDrawer({ row, onClose }: { row: OccupancyRow | null; onClose: () => void }) {
  const t = useTranslations("company.costOptimization.occupancy");
  const fmt = useFmt();
  if (!row) return null;
  const figs: Array<[string, typeof row.cost_per_seat]> = [
    [t("colOccupancy"), row.occupancy.occupancy_pct],
    [t("colEmpty"), row.occupancy.empty_seats],
    [t("fixedShare"), row.trip_cost.fixed],
    [t("fuelPerTrip"), row.trip_cost.fuel],
    [t("colTripCost"), row.trip_cost.total],
    [t("colPerEmployee"), row.cost_per_assigned_employee],
    [t("perSeat"), row.cost_per_seat],
  ];
  const a = row.attendance;
  return (
    <Drawer open onClose={onClose} title={`${row.route.name} · ${t(`dir.${row.direction}` as never)}`} subtitle={row.vehicle ? `${row.vehicle.label} · ${row.vehicle.category}` : t("noVehicle")}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={STATUS_TONE[row.occupancy.status]}>{t(`status.${row.occupancy.status}` as never)}</Tag>
          <span className="text-sm text-fg-muted">{t("assignedOf", { assigned: row.occupancy.assigned, seats: row.occupancy.capacity ?? "—" })}</span>
        </div>
        <div className="divide-y divide-line rounded-2xl border border-line bg-card">
          {figs.map(([label, f]) => (
            <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm text-fg-muted">
                {label}
                {!f.locked && <BasisBadge basis={f.basis} />}
              </span>
              <FigureValue figure={f} />
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="text-fg-muted">{t("tripsInWindow")}</span>
            <span className="font-semibold tabular-nums">{fmt.n(row.trips)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="text-fg-muted">{t("avgKm")}</span>
            <span className="font-semibold tabular-nums">{fmt.n(row.avg_km, 1)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Info className="size-4 text-fg-muted" />
            {t("attendanceTitle")}
          </p>
          <p className="mt-1 text-xs text-fg-muted">{t("attendanceNote")}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Info2 label={t("avgRiders")} value={fmt.n(a.avg_riders_per_trip, 1)} />
            <Info2 label={t("boarded")} value={fmt.n(a.total_boarded)} />
            <Info2 label={t("absent")} value={fmt.n(a.total_absent)} />
            <Info2 label={t("unmarked")} value={fmt.n(a.total_unmarked)} />
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function Info2({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="font-semibold tabular-nums text-fg">{value}</p>
    </div>
  );
}
