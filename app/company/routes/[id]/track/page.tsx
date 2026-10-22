"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bus, CheckCircle2, MapPin, Navigation, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/app/lib/services/api-client";
import { useShuttleTracking } from "@/app/lib/hooks/useShuttleTracking";
import type { MapMarker, MapPolyline } from "@/app/ui/Map";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardSkeleton,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiGrid,
  PageHeader,
  RefreshButton,
  StatusBadge,
  focusRing,
  useFormatters,
  usePageBreadcrumbs,
} from "@/app/ui";
import { useCompanyBasePath } from "../../../lib/use-company-base-path";
import { MAP_COLORS } from "../../lib/map-colors";

const Map = dynamic(() => import("@/app/ui/Map"), { ssr: false });

// ---- Types ----------------------------------------------------------------

type RouteStop = {
  id: number;
  name: string;
  sequence_order: number;
  morning_eta: string | null;
  evening_eta: string | null;
  lat: number | null;
  lng: number | null;
};

type ShuttleTrip = {
  id: number;
  direction: "MORNING" | "EVENING";
  status: string;
  started_at: string | null;
  completed_at: string | null;
  current_stop_id: number | null;
  /** Last-known driver GPS position (Redis shuttle:last_coord), embedded by the backend
   * for STARTED/IN_PROGRESS trips — avoids a separate .../last-location request. */
  last_lat?: number | null;
  last_lng?: number | null;
  routes?: {
    id: number;
    name: string;
    vehicles?: { id: number; plate_number: string; model: string | null } | null;
    route_stops?: RouteStop[];
  } | null;
};

type PolylineResponse = {
  points: { lat: number; lng: number }[];
  encodedPolyline: string;
};

const RUNNING_STATUSES = new Set(["STARTED", "IN_PROGRESS", "ONGOING", "LIVE"]);
const COMPLETED_STATUSES = new Set(["COMPLETED", "ENDED", "DONE"]);

function todayYmdLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ---- Component -------------------------------------------------------------

export default function CompanyRouteTrackingPage() {
  const params = useParams();
  const t = useTranslations("company.routes.tracking");
  const tRoutes = useTranslations("company.routes");
  const { companyPath } = useCompanyBasePath();
  const { formatTime } = useFormatters();
  const routeId = params.id ? +params.id : null;

  const [trips, setTrips] = useState<ShuttleTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [polylineState, setPolylineState] = useState<{ tripId: number; data: PolylineResponse | null } | null>(null);
  // Only the polyline of the currently selected trip is drawn (no stale line while the next one loads).
  const polyline = polylineState?.tripId === selectedTripId ? polylineState.data : null;

  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === selectedTripId) ?? null, [trips, selectedTripId]);
  const routeName = selectedTrip?.routes?.name ?? trips[0]?.routes?.name ?? null;
  usePageBreadcrumbs(routeName ? [{ label: routeName, href: companyPath(`/company/routes/${routeId}`) }, { label: t("liveRouteStatus") }] : [{ label: t("liveRouteStatus") }]);

  const { driverCoord, isConnected } = useShuttleTracking({
    tripId: selectedTripId,
    initialLat: selectedTrip?.last_lat ?? null,
    initialLng: selectedTrip?.last_lng ?? null,
  });

  // ---- Data fetching -------------------------------------------------------

  // Only depends on the route (and the refresh key): selecting a trip must not refetch the list.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!routeId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.request<ShuttleTrip[]>(`/shuttle-trips/today?date=${todayYmdLocal()}&route_id=${routeId}`);
        if (cancelled) return;
        const list = Array.isArray(data) ? data : ((data as unknown as { data: ShuttleTrip[] }).data ?? []);
        setTrips(list);
        setError(null);
        // Select the first trip (usually the active one, thanks to backend sorting) unless one is already chosen.
        setSelectedTripId((current) => (current && list.some((trip) => trip.id === current) ? current : (list[0]?.id ?? null)));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("failedToLoadTracking"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId, t, reloadKey]);

  const refresh = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!selectedTripId) return;
    const tripId = selectedTripId;
    let cancelled = false;
    apiClient
      .request<PolylineResponse>(`/shuttle-trips/${tripId}/polyline`)
      .then((data) => !cancelled && setPolylineState({ tripId, data }))
      .catch(() => !cancelled && setPolylineState({ tripId, data: null }));
    return () => {
      cancelled = true;
    };
  }, [selectedTripId]);

  // ---- Map data -------------------------------------------------------

  const stopMarkers: MapMarker[] = useMemo(() => {
    const stops = selectedTrip?.routes?.route_stops ?? [];
    return stops
      .filter((s) => s.lat !== null && s.lng !== null)
      .map((s) => {
        const eta = selectedTrip?.direction === "MORNING" ? s.morning_eta : s.evening_eta;
        return {
          id: `stop-${s.id}`,
          position: [s.lat!, s.lng!] as [number, number],
          label: `${s.name}${eta ? ` · ${formatTime(eta)}` : ""}`,
          color: s.id === selectedTrip?.current_stop_id ? MAP_COLORS.current : MAP_COLORS.pickup,
        };
      });
  }, [selectedTrip, formatTime]);

  const driverMarker: MapMarker | null = useMemo(() => {
    if (!driverCoord) return null;
    return {
      id: "driver",
      type: "shuttle",
      position: [driverCoord.lat, driverCoord.lng],
      heading: driverCoord.heading,
      label: driverCoord.speed !== undefined ? t("driverLabel", { speed: `${Math.round((driverCoord.speed ?? 0) * 3.6)} km/h` }) : t("driverLive"),
    };
  }, [driverCoord, t]);

  const mapMarkers = useMemo(() => [...stopMarkers, ...(driverMarker ? [driverMarker] : [])], [stopMarkers, driverMarker]);

  const mapPolylines: MapPolyline[] = useMemo(() => {
    if (!polyline?.points?.length) return [];
    const allPoints = polyline.points.map((p) => [p.lat, p.lng] as [number, number]);
    const lines: MapPolyline[] = [{ positions: allPoints, color: MAP_COLORS.route, weight: 4, opacity: 0.2 }];

    if (driverCoord) {
      let minDist = Infinity;
      let nearestIdx = 0;
      for (let i = 0; i < allPoints.length; i++) {
        const dLat = allPoints[i][0] - driverCoord.lat;
        const dLng = allPoints[i][1] - driverCoord.lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }
      const remainingPoints = allPoints.slice(nearestIdx);
      if (remainingPoints.length >= 2) lines.push({ positions: remainingPoints, color: MAP_COLORS.driverPath, weight: 6, opacity: 1 });
    } else {
      lines.push({ positions: allPoints, color: MAP_COLORS.driverPath, weight: 5, opacity: 0.8, dashArray: "10, 5" });
    }
    return lines;
  }, [polyline, driverCoord]);

  // Centre on the driver, else the first stop; nothing to show → the map card renders an empty state instead.
  const mapCenter = useMemo((): [number, number] | undefined => {
    if (driverCoord) return [driverCoord.lat, driverCoord.lng];
    const firstStop = selectedTrip?.routes?.route_stops?.find((s) => s.lat && s.lng);
    if (firstStop) return [firstStop.lat!, firstStop.lng!];
    return undefined;
  }, [driverCoord, selectedTrip]);

  const running = trips.filter((trip) => RUNNING_STATUSES.has(trip.status)).length;
  const completed = trips.filter((trip) => COMPLETED_STATUSES.has(trip.status)).length;

  // ---- Render ----------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: companyPath(`/company/routes/${routeId}`), label: tRoutes("backToRoute") }}
        title={routeName ?? t("liveRouteStatus")}
        description={t("description")}
        actions={<RefreshButton label={t("refreshData")} loading={loading} onClick={refresh} />}
      />

      {error ? (
        <Card>
          <ErrorState title={t("failedToLoadTracking")} message={error} onRetry={refresh} />
        </Card>
      ) : (
        <>
          <KpiGrid cols={3}>
            <KpiCard label={t("tripsToday")} value={trips.length} icon={<Bus />} tone="brand" loading={loading && trips.length === 0} />
            <KpiCard label={t("running")} value={running} icon={<Navigation />} tone="info" loading={loading && trips.length === 0} />
            <KpiCard label={t("completed")} value={completed} icon={<CheckCircle2 />} tone="success" loading={loading && trips.length === 0} />
          </KpiGrid>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
            <div className="space-y-4">
              <Card>
                <CardHeader title={t("todaysSchedule")} description={t("scheduled", { count: trips.length })} />
                <CardContent className="p-3">
                  {loading && trips.length === 0 ? (
                    <div className="space-y-2">
                      {[0, 1].map((i) => (
                        <CardSkeleton key={i} lines={1} />
                      ))}
                    </div>
                  ) : trips.length === 0 ? (
                    <EmptyState compact icon={<Bus aria-hidden="true" />} title={t("noTripsToday")} />
                  ) : (
                    <ul className="space-y-2" role="listbox" aria-label={t("todaysSchedule")}>
                      {trips.map((trip) => {
                        const selected = selectedTripId === trip.id;
                        return (
                          <li key={trip.id} role="option" aria-selected={selected}>
                            <button
                              type="button"
                              onClick={() => setSelectedTripId(trip.id)}
                              className={cn(
                                "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-start transition-colors",
                                selected ? "border-brand-line bg-brand-soft/40" : "border-line hover:bg-subtle",
                                focusRing,
                              )}
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", selected ? "bg-brand text-white" : "bg-subtle text-fg-muted")} aria-hidden="true">
                                  <Bus className="size-4" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-fg">
                                    {t("directionTrip", { direction: trip.direction === "MORNING" ? tRoutes("morning") : tRoutes("evening") })}
                                  </span>
                                  <span className="block text-xs text-fg-muted">{trip.routes?.vehicles?.plate_number ?? t("noVehicle")}</span>
                                </span>
                              </span>
                              <StatusBadge status={trip.status} size="sm" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader title={t("liveTelemetry")} />
                <CardContent>
                  {selectedTrip ? (
                    <dl className="space-y-3">
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-subtle p-3">
                        <dt className="flex items-center gap-3 text-sm font-medium text-fg">
                          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand-ink" aria-hidden="true">
                            <Navigation className="size-4" />
                          </span>
                          {t("tripStatus")}
                        </dt>
                        <dd>
                          <StatusBadge status={selectedTrip.status} size="sm" />
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-subtle p-3">
                        <dt className="flex items-center gap-3 text-sm font-medium text-fg">
                          <span className={cn("flex size-8 items-center justify-center rounded-lg", isConnected ? "bg-success-soft text-success-ink" : "bg-info-soft text-info-ink")} aria-hidden="true">
                            <Radio className="size-4" />
                          </span>
                          {t("connection")}
                        </dt>
                        <dd>
                          <Badge tone={isConnected ? "success" : "neutral"} size="sm" dot>
                            {isConnected ? t("highPrecision") : t("awaitingSignals")}
                          </Badge>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-subtle p-3">
                        <dt className="flex items-center gap-3 text-sm font-medium text-fg">
                          <span className="flex size-8 items-center justify-center rounded-lg bg-subtle text-fg-muted" aria-hidden="true">
                            <MapPin className="size-4" />
                          </span>
                          {t("totalStops")}
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums text-fg">{selectedTrip.routes?.route_stops?.length ?? 0}</dd>
                      </div>
                    </dl>
                  ) : (
                    <EmptyState compact icon={<MapPin aria-hidden="true" />} title={t("selectTripTelemetry")} />
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="overflow-hidden lg:sticky lg:top-20 lg:col-span-2">
              <CardHeader
                title={t("liveRouteStatus")}
                actions={
                  selectedTrip ? (
                    <ul className="flex items-center gap-3 text-[11px] font-medium text-fg-secondary" aria-label={t("mapLegend")}>
                      <li className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 animate-pulse rounded-full" style={{ backgroundColor: MAP_COLORS.driverPath }} aria-hidden="true" /> {t("liveDriver")}
                      </li>
                      <li className="inline-flex items-center gap-1.5">
                        <span className="h-0.5 w-3" style={{ backgroundColor: MAP_COLORS.route, opacity: 0.4 }} aria-hidden="true" /> {t("plannedRoute")}
                      </li>
                    </ul>
                  ) : undefined
                }
              />
              <div className="h-[420px] lg:h-[calc(100vh-18rem)] lg:min-h-[480px]">
                {mapCenter ? (
                  <Map center={mapCenter} zoom={13} markers={mapMarkers} polylines={mapPolylines} height="100%" className="h-full w-full rounded-none border-none shadow-none" />
                ) : (
                  <EmptyState icon={<MapPin aria-hidden="true" />} title={t("mapEmpty")} description={t("mapEmptyDescription")} className="h-full" />
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
