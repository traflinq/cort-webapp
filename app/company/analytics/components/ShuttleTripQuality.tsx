"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Bus, Fuel, Map as MapIcon, Navigation, RefreshCw, X, Zap } from "lucide-react";
import { apiClient } from "@/app/lib/services/api-client";
import type { MapMarker, MapPolyline } from "@/app/admin/ui/Map";
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

function fmt(v: string | null | undefined, decimals = 1) {
  if (v == null) return "—";
  const n = parseFloat(v);
  return isNaN(n) ? "—" : n.toFixed(decimals);
}
const pct = (v: string | null | undefined) => (v == null ? "—" : `${fmt(v, 1)}%`);

const TH = "px-5 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted";

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
          <KpiTile label={t("tripsAnalysed")} value={summary.count.toLocaleString()} icon={<Bus />} />
          <KpiTile
            label={t("avgDetourRatio")}
            value={summary.avgDetour ? `${summary.avgDetour.toFixed(2)}×` : "—"}
            icon={<Navigation />}
            tone={!summary.avgDetour || summary.avgDetour < 1.1 ? undefined : "warning"}
          />
          <KpiTile
            label={t("totalIdleMin")}
            value={Math.round(summary.totalIdleMin).toLocaleString()}
            icon={<Zap />}
            tone={summary.totalIdleMin < 300 ? undefined : "warning"}
          />
        </div>
      )}

      {fuelFlags.length > 0 && (
        <Panel>
          <div className="border-b border-line p-5">
            <div className="flex items-center gap-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Fuel className="size-4 text-rose-400" /> {t("flaggedFuelVariance")}
              </h4>
              <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400">
                {t("flagged", { count: fuelFlags.length })}
              </span>
            </div>
            <p className="mt-1 text-xs text-fg-muted">{t("fuelVarianceNote")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle/60">
                  <th className={`${TH} text-start`}>{t("vehicle")}</th>
                  <th className={`${TH} text-start`}>{t("date")}</th>
                  <th className={`${TH} text-end`}>{t("variance")}</th>
                  <th className={`${TH} text-end`}>{t("actualL")}</th>
                  <th className={`${TH} text-end`}>{t("expectedL")}</th>
                  <th className={`${TH} text-end`}>{t("streak")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {fuelFlags.slice(0, 8).map((f) => (
                  <tr key={f.id}>
                    <td className="px-5 py-3 font-semibold text-fg">{f.vehicles?.plate_number ?? f.vehicle_id}</td>
                    <td className="px-5 py-3 text-fg-muted">{new Date(f.flag_date).toLocaleDateString()}</td>
                    <td className={`px-5 py-3 text-end font-semibold ${parseFloat(f.variance_pct) > 20 ? "text-rose-400" : "text-[var(--cort-orange)]"}`}>
                      {pct(f.variance_pct)}
                    </td>
                    <td className="px-5 py-3 text-end text-fg">{fmt(f.actual_litres)}</td>
                    <td className="px-5 py-3 text-end text-fg">{fmt(f.expected_litres)}</td>
                    <td className="px-5 py-3 text-end text-fg-muted">{f.consecutive_days}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {metrics.length > 0 && (
        <Panel>
          <div className="border-b border-line p-5">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Bus className="size-4 text-blue-400" /> {t("recentShuttleTrips")}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle/60">
                  <th className={`${TH} text-start`}>{t("date")}</th>
                  <th className={`${TH} text-start`}>{t("dir")}</th>
                  <th className={`${TH} text-start`}>{t("vehicle")}</th>
                  <th className={`${TH} text-start`}>{t("driver")}</th>
                  <th className={`${TH} text-end`}>{t("occupancy")}</th>
                  <th className={`${TH} text-end`}>{t("detour")}</th>
                  <th className={`${TH} text-end`}>{t("idleMin")}</th>
                  <th className={`${TH} text-end`}>{t("fuelVar")}</th>
                  <th className={`${TH} text-end`}>{t("route")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {metrics.map((m) => (
                  <tr key={m.id} className={selectedTrip === m.shuttle_trip_id ? "bg-[var(--cort-orange)]/5" : undefined}>
                    <td className="px-5 py-3 text-fg">{new Date(m.trip_date).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-fg-muted">{m.direction}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-fg">{m.vehicles?.plate_number ?? "—"}</div>
                      {(m.vehicles?.make || m.vehicles?.model) && (
                        <div className="text-xs text-fg-muted">{[m.vehicles?.make, m.vehicles?.model].filter(Boolean).join(" ")}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-fg">{m.shuttle_trips?.users?.full_name ?? "—"}</td>
                    <td className={`px-5 py-3 text-end font-medium ${m.occupancy_pct && parseFloat(m.occupancy_pct) < 50 ? "text-[var(--cort-orange)]" : "text-fg"}`}>
                      {pct(m.occupancy_pct)}
                    </td>
                    <td className={`px-5 py-3 text-end font-medium ${m.detour_ratio && parseFloat(m.detour_ratio) > 1.2 ? "text-rose-400" : "text-fg"}`}>
                      {m.detour_ratio ? `${fmt(m.detour_ratio, 2)}×` : "—"}
                    </td>
                    <td className="px-5 py-3 text-end text-fg-muted">{fmt(m.idle_minutes, 0)}</td>
                    <td className={`px-5 py-3 text-end font-medium ${m.fuel_variance_pct && Math.abs(parseFloat(m.fuel_variance_pct)) > 15 ? "text-rose-400" : "text-fg"}`}>
                      {pct(m.fuel_variance_pct)}
                    </td>
                    <td className="px-5 py-3 text-end">
                      <button
                        type="button"
                        onClick={() => openTrip(m.shuttle_trip_id, m.route_id)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          selectedTrip === m.shuttle_trip_id
                            ? "border-[var(--cort-orange)]/20 bg-[var(--cort-orange)]/10 text-[var(--cort-orange)]"
                            : "border-line bg-subtle text-fg-muted hover:text-fg"
                        }`}
                      >
                        <MapIcon className="size-3" />
                        {selectedTrip === m.shuttle_trip_id ? t("close") : t("view")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedTrip !== null && (
            <div className="border-t border-line">
              <div className="flex items-center justify-between border-b border-line bg-subtle/50 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <MapIcon className="size-4 text-fg-muted" />
                  <span className="text-sm font-semibold text-fg">{t("routeMapOverlay")}</span>
                  <span className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <span className="inline-block h-2.5 w-6 rounded-sm bg-blue-500" /> {t("planned")}
                    <span className="ms-1 inline-block h-2.5 w-6 rounded-sm bg-[var(--cort-orange)]" /> {t("actual")}
                  </span>
                </div>
                <button type="button" onClick={close} aria-label={t("close")} className="text-fg-muted hover:text-fg">
                  <X className="size-4" />
                </button>
              </div>
              {mapLoading ? (
                <div className="flex h-64 items-center justify-center text-sm text-fg-muted">
                  <RefreshCw className="me-2 size-5 animate-spin" /> {t("loadingRouteData")}
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
  const planned: MapPolyline | null =
    comparison.planned_points.length > 1
      ? { positions: comparison.planned_points.map((p) => [p.lat, p.lng] as [number, number]), color: "#2563eb", weight: 4, opacity: 0.85 }
      : null;
  const actual: MapPolyline | null =
    comparison.actual_points.length > 1
      ? { positions: comparison.actual_points.map((p) => [p.lat, p.lng] as [number, number]), color: "#f97316", weight: 3, opacity: 0.9, dashArray: "6 4" }
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
  const detourPct = detour !== null ? ((detour - 1) * 100).toFixed(1) : null;

  return (
    <div className="flex flex-col lg:flex-row">
      <div className="min-h-0 flex-1" style={{ height: 360 }}>
        {polylines.length > 0 || markers.length > 0 ? (
          <Map markers={markers} polylines={polylines} height="360px" />
        ) : (
          <div className="flex h-full items-center justify-center bg-subtle text-sm text-fg-muted">{t("noPolylineData")}</div>
        )}
      </div>
      <div className="flex w-full flex-col gap-4 border-t border-line bg-subtle/30 p-5 lg:w-64 lg:border-s lg:border-t-0">
        {detour !== null && (
          <div
            className={`rounded-xl border px-4 py-3 text-center ${
              detour > 1.15 ? "border-rose-500/20 bg-rose-500/10" : detour > 1.05 ? "border-[var(--cort-orange)]/20 bg-[var(--cort-orange)]/10" : "border-emerald-500/20 bg-emerald-500/10"
            }`}
          >
            <p className="mb-0.5 text-xs text-fg-muted">{t("detourRatio")}</p>
            <p className={`text-2xl font-bold ${detour > 1.15 ? "text-rose-400" : detour > 1.05 ? "text-[var(--cort-orange)]" : "text-emerald-400"}`}>{detour.toFixed(2)}×</p>
            {detourPct && <p className="text-xs text-fg-muted">{t("extraDistance", { percent: detourPct })}</p>}
          </div>
        )}
        <div className="space-y-2 text-sm">
          {m?.planned_distance_km != null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-fg-muted">
                <span className="inline-block h-2 w-4 rounded-sm bg-blue-500" /> {t("planned")}
              </span>
              <span className="font-medium text-fg">{m.planned_distance_km.toFixed(2)} km</span>
            </div>
          )}
          {m?.actual_distance_km != null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-fg-muted">
                <span className="inline-block h-2 w-4 rounded-sm bg-[var(--cort-orange)]" /> {t("actual")}
              </span>
              <span className="font-medium text-fg">{m.actual_distance_km.toFixed(2)} km</span>
            </div>
          )}
          {comparison.idle_minutes != null && (
            <div className="flex items-center justify-between">
              <span className="text-fg-muted">{t("idleTime")}</span>
              <span className="font-medium text-fg">{comparison.idle_minutes.toFixed(0)} min</span>
            </div>
          )}
          {m?.fuel_variance_pct != null && (
            <div className="flex items-center justify-between">
              <span className="text-fg-muted">{t("fuelVariance")}</span>
              <span className={`font-medium ${Math.abs(m.fuel_variance_pct) > 15 ? "text-rose-400" : "text-fg"}`}>
                {m.fuel_variance_pct > 0 ? "+" : ""}
                {m.fuel_variance_pct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        {routeInsight && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <Navigation className="size-3.5 text-purple-400" />
              <span className="text-xs font-semibold text-purple-400">{t("aiNote")}</span>
            </div>
            <p className="text-xs text-purple-400">{routeInsight.data.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
