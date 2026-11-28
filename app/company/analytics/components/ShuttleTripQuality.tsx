"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { MapIcon, X } from "@/app/components/icons";
import { apiClient } from "@/app/lib/services/api-client";
import { Badge, Button, IconButton, Spinner } from "@/app/admin/ui";
import type { MapMarker, MapPolyline } from "@/app/admin/ui/Map";
import { cn } from "@/lib/utils";
import { TABLE_HEADER_CELL_CLASS } from "../../components/PageLayout";
import { useChartColors } from "../cost/charts";
import { useFmt } from "../cost/hooks";
import type { FleetInsight } from "./insights";
import { KpiTile, Panel, SectionHeading } from "./ui";

const Map = dynamic(() => import("@/app/admin/ui/Map"), { ssr: false });

export type ShuttleMetricsSummary = {
  count: number;
  avgOccupancy: number;
  avgDetour: number;
  totalIdleMin: number;
};

export type ShuttleMetric = {
  id: number;
  shuttle_trip_id: number;
  route_id: number | null;
  vehicle_id: number | null;
  trip_date: string;
  direction: string;
  occupancy_pct: string | null;
  detour_ratio: string | null;
  idle_minutes: string | null;
  fuel_variance_pct: string | null;
  actual_distance_km: string | null;
  planned_distance_km: string | null;
  vehicles: { plate_number: string; make: string | null; model: string | null } | null;
  shuttle_trips: { users: { full_name: string } | null } | null;
};

export type FuelVarianceFlag = {
  id: number;
  vehicle_id: number;
  flag_date: string;
  variance_pct: string;
  actual_litres: string;
  expected_litres: string;
  consecutive_days: number;
  is_flagged: boolean;
  vehicles: { plate_number: string; fuel_avg_city: string } | null;
};

type RouteComparison = {
  id: number;
  planned_points: { lat: number; lng: number }[];
  actual_points: { lat: number; lng: number }[];
  total_distance_km: number | null;
  idle_minutes: number | null;
  metrics: {
    planned_distance_km: number | null;
    actual_distance_km: number | null;
    detour_ratio: number | null;
    occupancy_pct: number | null;
    fuel_variance_pct: number | null;
  } | null;
};

/** Parses a decimal string from the API; null when it isn't a number. */
const num = (v: string | null | undefined) => {
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

const TH = `${TABLE_HEADER_CELL_CLASS} px-5`;
const TD = "px-5 py-3";

/** Planned = solid swatch, actual = dashed swatch, so the two lines differ by more than colour. */
function LineSwatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[3px] w-5 shrink-0 rounded-full"
      style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 5px, transparent 5px 8px)` : color }}
    />
  );
}

/**
 * Last-30-days trip quality for shuttles: detours, idle time, flagged fuel variance and the
 * planned-vs-actual route of any recent trip. (Occupancy is shown with the month's figures.)
 */
export function ShuttleTripQuality({
  summary,
  metrics,
  fuelFlags,
  insights,
}: {
  summary: ShuttleMetricsSummary | null;
  metrics: ShuttleMetric[];
  fuelFlags: FuelVarianceFlag[];
  insights: FleetInsight[];
}) {
  const t = useTranslations("company.fleetAnalytics");
  const tA = useTranslations("company.analytics");
  const fmt = useFmt();
  const c = useChartColors();
  const dec = (v: string | null | undefined, dp = 1) => {
    const n = num(v);
    return n === null ? "—" : fmt.n(n, dp);
  };
  const pct = (v: string | null | undefined) => (num(v) === null ? "—" : `${dec(v, 1)}%`);

  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [comparison, setComparison] = useState<RouteComparison | null>(null);
  const [mapLoading, setMapLoading] = useState(false);

  const close = () => {
    setSelectedTrip(null);
    setComparison(null);
    setSelectedRouteId(null);
  };

  const openTrip = useCallback(
    async (tripId: number, routeId: number | null) => {
      if (selectedTrip === tripId) return close();
      setSelectedTrip(tripId);
      setSelectedRouteId(routeId);
      setComparison(null);
      setMapLoading(true);
      try {
        setComparison(await apiClient.request<RouteComparison>(`/company/shuttle-trips/${tripId}/route-comparison`));
      } catch {
        setComparison(null);
      } finally {
        setMapLoading(false);
      }
    },
    [selectedTrip],
  );

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title={tA("tripQualityTitle")} description={tA("tripQualityDescription")} badge={tA("last30Days")} />

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiTile label={t("tripsAnalysed")} value={fmt.n(summary.count)} />
          <KpiTile
            label={t("avgDetourRatio")}
            value={summary.avgDetour ? `${fmt.n(summary.avgDetour, 2)}×` : "—"}
            tone={!summary.avgDetour || summary.avgDetour < 1.1 ? undefined : "warning"}
          />
          <KpiTile label={t("totalIdleMin")} value={fmt.n(Math.round(summary.totalIdleMin))} tone={summary.totalIdleMin < 300 ? undefined : "warning"} />
        </div>
      )}

      {fuelFlags.length > 0 && (
        <Panel>
          <div className="border-b border-line px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-fg">{t("flaggedFuelVariance")}</h4>
              <Badge tone="warning" size="sm" dot>
                {t("flagged", { count: fuelFlags.length })}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-fg-muted">{t("fuelVarianceNote")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={`${TH} text-start`}>{t("vehicle")}</th>
                  <th scope="col" className={`${TH} text-start`}>{t("date")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("variance")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("actualL")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("expectedL")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("streak")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {fuelFlags.slice(0, 8).map((f) => (
                  <tr key={f.id} className="hover:bg-row-hover">
                    <td className={`${TD} font-medium text-fg`}>{f.vehicles?.plate_number ?? f.vehicle_id}</td>
                    <td className={`${TD} whitespace-nowrap text-fg-muted tabular-nums`}>{fmt.date(f.flag_date)}</td>
                    <td className={cn(TD, "text-end font-medium tabular-nums", (num(f.variance_pct) ?? 0) > 20 ? "text-danger-ink" : "text-warning-ink")}>
                      {pct(f.variance_pct)}
                    </td>
                    <td className={`${TD} text-end text-fg tabular-nums`}>{dec(f.actual_litres)}</td>
                    <td className={`${TD} text-end text-fg tabular-nums`}>{dec(f.expected_litres)}</td>
                    <td className={`${TD} text-end text-fg-muted tabular-nums`}>{fmt.n(f.consecutive_days)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {metrics.length > 0 && (
        <Panel>
          <div className="border-b border-line px-5 py-4">
            <h4 className="text-sm font-semibold text-fg">{t("recentShuttleTrips")}</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={`${TH} text-start`}>{t("date")}</th>
                  <th scope="col" className={`${TH} text-start`}>{t("dir")}</th>
                  <th scope="col" className={`${TH} text-start`}>{t("vehicle")}</th>
                  <th scope="col" className={`${TH} text-start`}>{t("driver")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("occupancy")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("detour")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("idleMin")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("fuelVar")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("route")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {metrics.map((m) => {
                  const open = selectedTrip === m.shuttle_trip_id;
                  const occ = num(m.occupancy_pct);
                  const detour = num(m.detour_ratio);
                  const fuelVar = num(m.fuel_variance_pct);
                  return (
                    <tr key={m.id} className={open ? "bg-subtle" : "hover:bg-row-hover"}>
                      <td className={`${TD} whitespace-nowrap text-fg tabular-nums`}>{fmt.date(m.trip_date)}</td>
                      <td className={`${TD} text-fg-muted`}>{m.direction}</td>
                      <td className={TD}>
                        <div className="font-medium text-fg">{m.vehicles?.plate_number ?? "—"}</div>
                        {(m.vehicles?.make || m.vehicles?.model) && (
                          <div className="text-xs text-fg-muted">{[m.vehicles?.make, m.vehicles?.model].filter(Boolean).join(" ")}</div>
                        )}
                      </td>
                      <td className={`${TD} text-fg`}>{m.shuttle_trips?.users?.full_name ?? "—"}</td>
                      <td className={cn(TD, "text-end tabular-nums", occ !== null && occ < 50 ? "font-medium text-warning-ink" : "text-fg")}>{pct(m.occupancy_pct)}</td>
                      <td className={cn(TD, "text-end tabular-nums", detour !== null && detour > 1.2 ? "font-medium text-danger-ink" : "text-fg")}>
                        {detour !== null ? `${dec(m.detour_ratio, 2)}×` : "—"}
                      </td>
                      <td className={`${TD} text-end text-fg-muted tabular-nums`}>{dec(m.idle_minutes, 0)}</td>
                      <td className={cn(TD, "text-end tabular-nums", fuelVar !== null && Math.abs(fuelVar) > 15 ? "font-medium text-danger-ink" : "text-fg")}>
                        {pct(m.fuel_variance_pct)}
                      </td>
                      <td className={`${TD} text-end`}>
                        <Button
                          size="sm"
                          variant={open ? "secondary" : "outline"}
                          leftIcon={<MapIcon />}
                          aria-expanded={open}
                          onClick={() => openTrip(m.shuttle_trip_id, m.route_id)}
                        >
                          {open ? t("close") : t("view")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedTrip !== null && (
            <div className="border-t border-line">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-fg">{t("routeMapOverlay")}</span>
                  <span className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <LineSwatch color={c.series[1]} /> {t("planned")}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <LineSwatch color={c.series[0]} dashed /> {t("actual")}
                  </span>
                </div>
                <IconButton label={t("close")} size="icon-sm" onClick={close}>
                  <X />
                </IconButton>
              </div>
              {mapLoading ? (
                <div className="flex h-64 items-center justify-center gap-2 text-sm text-fg-muted">
                  <Spinner size="sm" label={t("loadingRouteData")} />
                  <span aria-hidden="true">{t("loadingRouteData")}</span>
                </div>
              ) : comparison ? (
                <RouteMapOverlay
                  comparison={comparison}
                  routeInsight={insights.find((i) => i.insight_type === "ROUTE_DETOUR" && i.route_id === selectedRouteId) ?? null}
                />
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-fg-muted">{t("noRouteData")}</div>
              )}
            </div>
          )}
        </Panel>
      )}
    </section>
  );
}

function RouteMapOverlay({ comparison, routeInsight }: { comparison: RouteComparison; routeInsight: FleetInsight | null }) {
  const t = useTranslations("company.fleetAnalytics");
  const fmt = useFmt();
  const c = useChartColors();
  const planned: MapPolyline | null =
    comparison.planned_points.length > 1
      ? { positions: comparison.planned_points.map((p) => [p.lat, p.lng] as [number, number]), color: c.series[1], weight: 4, opacity: 0.85 }
      : null;
  const actual: MapPolyline | null =
    comparison.actual_points.length > 1
      ? { positions: comparison.actual_points.map((p) => [p.lat, p.lng] as [number, number]), color: c.series[0], weight: 3, opacity: 0.9, dashArray: "6 4" }
      : null;
  const polylines = [planned, actual].filter(Boolean) as MapPolyline[];

  const markers: MapMarker[] = [];
  if (comparison.planned_points.length > 0) {
    const first = comparison.planned_points[0];
    const last = comparison.planned_points[comparison.planned_points.length - 1];
    markers.push({ id: "start", position: [first.lat, first.lng], label: t("start"), color: "#22c55e", type: "pickup" });
    markers.push({ id: "end", position: [last.lat, last.lng], label: t("end"), color: "#ef4444", type: "dropoff" });
  }

  const m = comparison.metrics;
  const detour = m?.detour_ratio ?? null;
  const detourPct = detour !== null ? fmt.n((detour - 1) * 100, 1) : null;
  const detourTone = detour === null ? null : detour > 1.15 ? "danger" : detour > 1.05 ? "warning" : "success";

  return (
    <div className="flex flex-col lg:flex-row">
      <div className="min-h-0 flex-1" style={{ height: 360 }}>
        {polylines.length > 0 || markers.length > 0 ? (
          <Map markers={markers} polylines={polylines} height="360px" />
        ) : (
          <div className="flex h-full items-center justify-center bg-subtle text-sm text-fg-muted">{t("noPolylineData")}</div>
        )}
      </div>
      <div className="flex w-full flex-col gap-4 border-t border-line p-5 lg:w-64 lg:border-s lg:border-t-0">
        {detour !== null && (
          <div className="rounded-lg border border-line px-4 py-3">
            <p className="text-xs font-medium text-fg-muted">{t("detourRatio")}</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
                detourTone === "danger" ? "text-danger-ink" : detourTone === "warning" ? "text-warning-ink" : "text-success-ink",
              )}
            >
              {fmt.n(detour, 2)}×
            </p>
            {detourPct && <p className="mt-0.5 text-xs text-fg-muted tabular-nums">{t("extraDistance", { percent: detourPct })}</p>}
          </div>
        )}
        <dl className="space-y-2 text-sm">
          {m?.planned_distance_km != null && (
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-fg-muted">
                <LineSwatch color={c.series[1]} /> {t("planned")}
              </dt>
              <dd className="font-medium text-fg tabular-nums">{fmt.value(m.planned_distance_km, "km")}</dd>
            </div>
          )}
          {m?.actual_distance_km != null && (
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-fg-muted">
                <LineSwatch color={c.series[0]} dashed /> {t("actual")}
              </dt>
              <dd className="font-medium text-fg tabular-nums">{fmt.value(m.actual_distance_km, "km")}</dd>
            </div>
          )}
          {comparison.idle_minutes != null && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-muted">{t("idleTime")}</dt>
              <dd className="font-medium text-fg tabular-nums">
                {fmt.n(comparison.idle_minutes, 0)} {fmt.unit("min")}
              </dd>
            </div>
          )}
          {m?.fuel_variance_pct != null && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-muted">{t("fuelVariance")}</dt>
              <dd className={cn("font-medium tabular-nums", Math.abs(m.fuel_variance_pct) > 15 ? "text-danger-ink" : "text-fg")}>
                {m.fuel_variance_pct > 0 ? "+" : ""}
                {fmt.n(m.fuel_variance_pct, 1)}%
              </dd>
            </div>
          )}
        </dl>
        {routeInsight && (
          <div className="rounded-lg border border-line bg-subtle p-3">
            <p className="text-xs font-medium text-fg-muted">{t("aiNote")}</p>
            <p className="mt-1 text-sm text-fg" dir="auto">{routeInsight.data.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
