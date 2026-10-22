"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle, Calendar, Clock, MapPin, Navigation, Radio, Users, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, IconButton, RefreshButton, Skeleton, StatusBadge, useFormatters } from "@/app/ui";
import type { MapMarker } from "@/app/ui/Map";
import { cn } from "@/lib/utils";
import { apiClient } from "../../lib/services/api-client";
import { useAppSelector } from "../../lib/store/hooks";
import { selectDashboardStats } from "../../lib/store/slices/dashboardSlice";
import { selectCompany } from "../../lib/store/slices/companySlice";
import { useLiveMobilityTracking } from "../../lib/hooks/useLiveMobilityTracking";
import { useCompanyBasePath } from "../lib/use-company-base-path";

function MapLoading() {
  const t = useTranslations("company.mobility");
  return (
    <div className="flex h-full w-full items-center justify-center bg-subtle">
      <span className="text-sm text-fg-muted">{t("initializingMap")}</span>
    </div>
  );
}

const Map = dynamic(() => import("@/app/ui/Map"), { ssr: false, loading: () => <MapLoading /> });

interface LiveMobilityCenterProps {
  data: { activeRides: number; employeesTraveling: number; shuttlesRunning: number; chauffeurRides: number; upcomingBookings: number };
}

interface RawStop { id: number; name?: string; lat?: number | null; lng?: number | null }
interface RawShuttleTrip {
  id: number;
  status?: string;
  direction?: string;
  route_id: number;
  current_stop_id?: number;
  last_lat?: number | null;
  last_lng?: number | null;
  started_at?: string | null;
  route_stops_with_coords?: RawStop[];
  routes?: { name?: string; route_stops?: RawStop[]; _count?: { employee_route_assignments?: number }; vehicles?: { model?: string; plate_number?: string } };
}
interface RawBooking {
  id: number;
  status?: string;
  passenger_name?: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  users_chauffeur_bookings_passenger_idTousers?: { full_name?: string };
}
interface RawEmployee {
  id?: number;
  users?: { full_name?: string; department?: string };
  route_stops?: { name?: string };
  boarding?: { status?: string; drop_off_at?: string | null; scanned_at?: string | null };
  droppedOffAt?: string;
  boardedAt?: string;
}

interface TripEntry {
  id: number;
  type: "shuttle" | "chauffeur";
  label: string;
  /** Last known REST position (driver ping / stop coord / pickup coord). */
  restLat: number | null;
  restLng: number | null;
  /** Full raw trip object — shuttles only, used for the detail panel. */
  rawTrip?: RawShuttleTrip;
}

const SECOND = 1000;
const subscribeSecond = (cb: () => void) => {
  const id = window.setInterval(cb, SECOND);
  return () => window.clearInterval(id);
};
/** Isolated so the ticking clock only re-renders this small element, not the map card. */
function OpsClock() {
  const t = useTranslations("company.mobility");
  const now = useSyncExternalStore(subscribeSecond, () => Math.floor(Date.now() / SECOND), () => 0);
  return (
    <div className="hidden flex-col items-end sm:flex">
      <span className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">{t("opsTime")}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-fg">
        {now > 0 ? new Date(now * SECOND).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}
      </span>
    </div>
  );
}

function extractList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as { data?: { data?: unknown } | unknown } | null;
  const inner = (r?.data as { data?: unknown } | undefined)?.data;
  if (Array.isArray(inner)) return inner as T[];
  if (Array.isArray(r?.data)) return r!.data as T[];
  return [];
}

export default function LiveMobilityCenter({ data }: LiveMobilityCenterProps) {
  const t = useTranslations("company.mobility");
  const tDashboard = useTranslations("company.dashboard");
  const { formatTime } = useFormatters();
  const { companyPath } = useCompanyBasePath();
  const company = useAppSelector(selectCompany);
  const dashboardStats = useAppSelector(selectDashboardStats);

  const [trips, setTrips] = useState<TripEntry[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selectedShuttleTrip, setSelectedShuttleTrip] = useState<RawShuttleTrip | null>(null);
  const [tripEmployees, setTripEmployees] = useState<RawEmployee[]>([]);
  const [tripEmployeesLoading, setTripEmployeesLoading] = useState(false);

  const hasShuttle = company?.services_enabled?.shuttle_enabled ?? false;
  const hasChauffeur = company?.services_enabled?.chauffeur_enabled ?? false;

  const mobility = dashboardStats?.mobility ?? data;
  const stats = [
    { label: t("activeRidesLabel"), value: mobility.activeRides, show: true },
    { label: t("employeesTravelingLabel"), value: mobility.employeesTraveling, show: true },
    { label: t("shuttlesRunningLabel"), value: mobility.shuttlesRunning, show: hasShuttle },
    { label: t("chauffeurRidesLabel"), value: mobility.chauffeurRides, show: hasChauffeur },
    { label: t("upcomingRidesLabel"), value: mobility.upcomingBookings, show: true },
  ].filter((s) => s.show);

  // ── Fetch active trips: shuttles + chauffeur ───────────────────────────────
  const fetchActiveTrips = useCallback(async () => {
    const companyId = company?.id;
    if (!companyId) return;
    setTripsLoading(true);
    try {
      const [shuttleResp, chauffeurResp] = await Promise.allSettled([
        hasShuttle ? apiClient.getTodayShuttleTrips(companyId) : Promise.resolve(null),
        hasChauffeur ? apiClient.getActiveCompanyChauffeurBookings(companyId) : Promise.resolve(null),
      ]);
      const collected: TripEntry[] = [];

      if (hasShuttle && shuttleResp.status === "fulfilled" && shuttleResp.value !== null) {
        const active = extractList<RawShuttleTrip>(shuttleResp.value).filter((trip) => ["STARTED", "IN_PROGRESS"].includes(trip.status ?? ""));
        for (const trip of active) {
          const routeName = trip.routes?.name ?? t("routeLabel", { id: trip.route_id });
          const direction = trip.direction === "MORNING" ? t("morning") : t("evening");
          const occupancy = trip.routes?._count?.employee_route_assignments ?? null;
          // Prefer the driver's real last-known GPS position (from Redis via the backend) over a stop's coordinates.
          const stops: RawStop[] = trip.route_stops_with_coords ?? trip.routes?.route_stops ?? [];
          let restLat: number | null = trip.last_lat ?? null;
          let restLng: number | null = trip.last_lng ?? null;
          if (restLat == null || restLng == null) {
            const current = stops.find((s) => s.id === trip.current_stop_id);
            const first = current?.lat && current?.lng ? current : stops.find((s) => s.lat && s.lng);
            if (first) {
              restLat = first.lat ?? null;
              restLng = first.lng ?? null;
            }
          }
          collected.push({
            id: trip.id as number,
            type: "shuttle",
            label: `${routeName} ${direction} · ${trip.status}${occupancy !== null ? ` · ${occupancy}` : ""}`,
            restLat,
            restLng,
            rawTrip: trip,
          });
        }
      }

      // OTW + ARRIVED + IN_PROGRESS — the same three statuses the activeRides counter uses.
      if (hasChauffeur && chauffeurResp.status === "fulfilled" && chauffeurResp.value !== null) {
        const [otw, arrived] = await Promise.allSettled([
          apiClient.request<unknown>(`/companies/${companyId}/chauffeur-bookings?status=OTW&limit=50`),
          apiClient.request<unknown>(`/companies/${companyId}/chauffeur-bookings?status=ARRIVED&limit=50`),
        ]);
        const settled = (res: PromiseSettledResult<unknown>) => (res.status === "fulfilled" ? extractList<RawBooking>(res.value) : []);
        const all = [...settled(otw), ...settled(arrived), ...extractList<RawBooking>(chauffeurResp.value)];
        const seen = new Set<number>();
        for (const booking of all) {
          if (seen.has(booking.id)) continue;
          seen.add(booking.id);
          const passengerName = booking.passenger_name ?? booking.users_chauffeur_bookings_passenger_idTousers?.full_name ?? t("passenger");
          // pickup_lat/lng are usually null here; the socket hook supplies live coordinates once the driver pings.
          collected.push({
            id: booking.id as number,
            type: "chauffeur",
            label: `${t("chauffeur")} · ${passengerName} · ${booking.status ?? ""}`,
            restLat: booking.pickup_lat ?? null,
            restLng: booking.pickup_lng ?? null,
          });
        }
      }

      setTrips(collected);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("[LiveMobilityCenter] fetchActiveTrips error", err);
      setTrips([]);
    } finally {
      setTripsLoading(false);
    }
  }, [company?.id, hasShuttle, hasChauffeur, t]);

  useEffect(() => {
    // Kick off asynchronously so the loading flag is set from a callback, not synchronously in the effect body.
    void Promise.resolve().then(fetchActiveTrips);
    const interval = setInterval(fetchActiveTrips, 60_000);
    return () => clearInterval(interval);
  }, [fetchActiveTrips]);

  // ── Live socket tracking ───────────────────────────────────────────────────
  const tripsKey = trips.map((trip) => `${trip.type}:${trip.id}:${trip.restLat ?? ""}:${trip.restLng ?? ""}`).join(",");
  const trackingInput = useMemo(
    () => trips.map((trip) => ({ id: trip.id, type: trip.type, lastLat: trip.restLat, lastLng: trip.restLng })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tripsKey],
  );
  const { vehicleCoords, isConnected } = useLiveMobilityTracking(trackingInput);

  // Only trips with a real position get a marker; the rest are listed as "awaiting location" (no fake fallback point).
  const { markers, awaitingLocation } = useMemo(() => {
    const out: MapMarker[] = [];
    let awaiting = 0;
    for (const trip of trips) {
      const live = vehicleCoords[String(trip.id)];
      const hasLive = !!live && live.updatedAt > 0 && live.lat !== 0 && live.lng !== 0;
      const lat = hasLive ? live.lat : trip.restLat;
      const lng = hasLive ? live.lng : trip.restLng;
      if (lat == null || lng == null) {
        awaiting += 1;
        continue;
      }
      out.push({ id: `${trip.type}-${trip.id}`, position: [lat, lng], label: trip.label, type: trip.type, heading: hasLive ? live.heading : undefined });
    }
    return { markers: out, awaitingLocation: awaiting };
  }, [trips, vehicleCoords]);

  // Seed the camera once from the first positioned marker; never follow every tick (fights user pan/zoom).
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || markers.length === 0) return;
    seeded.current = true;
    setMapCenter(markers[0].position);
  }, [markers]);

  const liveCount = useMemo(() => Object.values(vehicleCoords).filter((c) => c.updatedAt > 0 && c.lat !== 0).length, [vehicleCoords]);
  const shuttleCount = trips.filter((trip) => trip.type === "shuttle").length;
  const chauffeurCount = trips.filter((trip) => trip.type === "chauffeur").length;

  const handleMarkerClick = useCallback(
    async (markerId: string) => {
      const firstDash = markerId.indexOf("-");
      const type = markerId.slice(0, firstDash);
      const tripId = Number(markerId.slice(firstDash + 1));
      if (type !== "shuttle" || Number.isNaN(tripId)) return;
      const entry = trips.find((trip) => trip.type === "shuttle" && trip.id === tripId);
      if (!entry) return;
      setSelectedShuttleTrip(entry.rawTrip ?? { id: tripId, route_id: tripId });
      setTripEmployees([]);
      setTripEmployeesLoading(true);
      try {
        const list = await apiClient.request<RawEmployee[]>(`/shuttle-trips/${tripId}/employees`);
        setTripEmployees(Array.isArray(list) ? list : []);
      } catch {
        setTripEmployees([]);
      } finally {
        setTripEmployeesLoading(false);
      }
    },
    [trips],
  );

  // API-backed: shuttles running now vs total routes.
  const routesRunning = hasShuttle && dashboardStats && dashboardStats.shuttle.totalRoutes > 0 ? Math.min(100, Math.round((mobility.shuttlesRunning / dashboardStats.shuttle.totalRoutes) * 100)) : null;
  const unassigned = hasChauffeur ? (dashboardStats?.chauffeur.unassignedBookings ?? 0) : 0;
  const mapStatus = tripsLoading ? t("syncing") : liveCount > 0 ? t("vehiclesLive", { count: liveCount }) : trips.length > 0 ? t("tripsTracked", { count: trips.length }) : t("noActiveTrips");

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60", isConnected ? "animate-ping bg-success" : "bg-fg-muted")} />
              <span className={cn("relative inline-flex size-2.5 rounded-full", isConnected ? "bg-success" : "bg-fg-muted")} />
            </span>
            {t("commandCenter")}
          </span>
        }
        description={t("operationalOverview")}
        actions={
          <>
            <Badge tone={isConnected ? "success" : "neutral"} size="sm" icon={<Radio aria-hidden="true" />}>
              {isConnected ? t("live") : t("connecting")}
            </Badge>
            <OpsClock />
            <RefreshButton label={t("refreshTrips")} loading={tripsLoading} onClick={() => void fetchActiveTrips()} />
          </>
        }
      />

      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card px-4 py-3">
            <dt className="truncate text-[11px] font-medium uppercase tracking-wider text-fg-muted">{stat.label}</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Map */}
        <div className="relative order-2 h-[320px] sm:h-[400px] lg:order-1 lg:h-auto lg:min-h-[440px] lg:flex-1">
          {markers.length > 0 && mapCenter ? (
            <div className="absolute inset-0">
              <Map height="100%" markers={markers} center={mapCenter} zoom={12} className="!rounded-none !border-0 !shadow-none" onMarkerClick={handleMarkerClick} />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-subtle">
              {tripsLoading ? (
                <Skeleton className="h-full w-full rounded-none" />
              ) : (
                <EmptyState
                  icon={<MapPin aria-hidden="true" />}
                  title={trips.length > 0 ? t("mapAwaitingTitle") : t("noActiveTrips")}
                  description={trips.length > 0 ? t("mapAwaitingDescription", { count: awaitingLocation }) : t("noTripsToday")}
                />
              )}
            </div>
          )}

          <div className="pointer-events-none absolute start-3 top-3 z-[500] flex max-w-[calc(100%-1.5rem)] flex-col gap-1.5">
            <Badge tone={liveCount > 0 ? "success" : trips.length > 0 ? "brand" : "neutral"} dot className="w-fit bg-card/90 backdrop-blur">
              {mapStatus}
            </Badge>
            {lastRefreshed && (
              <Badge tone="neutral" size="sm" icon={<Clock aria-hidden="true" />} className="w-fit bg-card/90 backdrop-blur">
                {t("synced", { time: formatTime(lastRefreshed) })}
              </Badge>
            )}
            {awaitingLocation > 0 && markers.length > 0 && (
              <Badge tone="warning" size="sm" className="w-fit bg-card/90 backdrop-blur">
                {t("awaitingLocation", { count: awaitingLocation })}
              </Badge>
            )}
          </div>

          {(shuttleCount > 0 || chauffeurCount > 0) && (
            <ul className={cn("pointer-events-none absolute bottom-3 end-3 z-[500] flex flex-col gap-1 rounded-lg border border-line bg-card/90 px-2.5 py-2 text-xs text-fg backdrop-blur", selectedShuttleTrip && "hidden sm:flex")} aria-label={t("liveLegend")}>
              {hasShuttle && (
                <li className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/bus_birdeye.png" alt="" className="size-4 object-contain" /> {t("shuttle")}
                  {shuttleCount > 0 ? ` (${shuttleCount})` : ""}
                </li>
              )}
              {hasChauffeur && (
                <li className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/car_birdeye.png" alt="" className="size-4 object-contain" /> {t("chauffeur")}
                  {chauffeurCount > 0 ? ` (${chauffeurCount})` : ""}
                </li>
              )}
            </ul>
          )}

          {selectedShuttleTrip && (
            <section
              aria-label={selectedShuttleTrip.routes?.name ?? t("routeLabel", { id: selectedShuttleTrip.route_id })}
              className="absolute inset-x-2 bottom-2 z-[600] flex max-h-[75%] flex-col overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-modal)] sm:inset-x-auto sm:bottom-3 sm:end-3 sm:top-3 sm:w-72"
            >
              <div className="flex items-start justify-between gap-2 border-b border-line p-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={selectedShuttleTrip.direction} size="sm" />
                    <StatusBadge status={selectedShuttleTrip.status} size="sm" />
                  </div>
                  <h3 className="text-sm font-semibold text-fg">{selectedShuttleTrip.routes?.name ?? t("routeLabel", { id: selectedShuttleTrip.route_id })}</h3>
                  {selectedShuttleTrip.routes?.vehicles && (
                    <p className="text-xs text-fg-muted">{[selectedShuttleTrip.routes.vehicles.model, selectedShuttleTrip.routes.vehicles.plate_number].filter(Boolean).join(" · ")}</p>
                  )}
                  {selectedShuttleTrip.started_at && <p className="mt-0.5 text-xs text-fg-muted">{t("startedAt", { time: formatTime(selectedShuttleTrip.started_at) })}</p>}
                </div>
                <IconButton label={t("closePanel")} size="icon-sm" tooltip={false} onClick={() => setSelectedShuttleTrip(null)}>
                  <X />
                </IconButton>
              </div>
              {(() => {
                const stops: RawStop[] = selectedShuttleTrip.routes?.route_stops ?? [];
                const currentStop = stops.find((s) => s.id === selectedShuttleTrip.current_stop_id);
                return currentStop ? (
                  <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm">
                    <MapPin className="size-4 shrink-0 text-brand-ink" aria-hidden="true" />
                    <span className="text-fg-muted">{t("currentStop")}:</span>
                    <span className="truncate font-medium text-fg">{currentStop.name}</span>
                  </div>
                ) : null;
              })()}
              <div className="flex items-center justify-between border-b border-line px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-fg-muted">
                  <Users className="size-4" aria-hidden="true" /> {t("passengers")}
                </span>
                <span className="font-semibold tabular-nums text-fg">{selectedShuttleTrip.routes?._count?.employee_route_assignments ?? "—"}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{t("assignedEmployees")}</p>
                {tripEmployeesLoading ? (
                  <div className="space-y-2 p-1">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-10" />
                    ))}
                  </div>
                ) : tripEmployees.length === 0 ? (
                  <EmptyState compact title={t("noEmployeesAssigned")} />
                ) : (
                  <ul className="space-y-1">
                    {tripEmployees.map((emp, i) => {
                      const dropOffAt = emp.boarding?.drop_off_at ? formatTime(emp.boarding.drop_off_at) : emp.droppedOffAt;
                      const boardedAt = emp.boarding?.scanned_at ? formatTime(emp.boarding.scanned_at) : emp.boardedAt;
                      const state =
                        emp.boarding?.status === "ABSENT"
                          ? { tone: "danger" as const, text: t("absent") }
                          : dropOffAt
                            ? { tone: "info" as const, text: t("droppedOffAt", { time: dropOffAt }) }
                            : boardedAt
                              ? { tone: "success" as const, text: t("boardedAt", { time: boardedAt }) }
                              : { tone: "neutral" as const, text: t("notYetBoarded") };
                      return (
                        <li key={emp.id ?? i} className="rounded-lg border border-line bg-subtle px-2.5 py-2">
                          <p className="truncate text-sm font-medium text-fg">{emp.users?.full_name ?? "—"}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
                            {emp.route_stops?.name && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="size-3" aria-hidden="true" /> {emp.route_stops.name}
                              </span>
                            )}
                            {emp.users?.department && <span className="truncate">{emp.users.department}</span>}
                            <Badge tone={state.tone} size="sm">
                              {state.text}
                            </Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Alerts panel */}
        <aside className="order-1 flex w-full shrink-0 flex-col gap-3 border-b border-line p-4 lg:order-2 lg:w-80 lg:border-b-0 lg:border-s">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">{t("activeAlerts")}</h3>
            {unassigned > 0 && (
              <Badge tone="warning" size="sm">
                {t("unassigned", { count: unassigned })}
              </Badge>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-2">
            {unassigned > 0 && (
              <Link href={companyPath("/company/bookings")} className="rounded-lg border border-warning-line bg-warning-soft p-3 transition-colors hover:bg-warning-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="font-medium text-fg">{tDashboard("unassignedBookings")}</p>
                    <p className="text-xs text-fg-secondary">{t("unassignedDescription", { count: unassigned })}</p>
                  </div>
                </div>
              </Link>
            )}
            {mobility.upcomingBookings > 0 && (
              <Link
                href={companyPath(hasChauffeur ? "/company/bookings" : "/company/routes")}
                className="rounded-lg border border-line bg-subtle p-3 transition-colors hover:bg-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start gap-2.5">
                  <Calendar className="mt-0.5 size-4 shrink-0 text-info-ink" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="font-medium text-fg">{t("upcomingBookings")}</p>
                    <p className="text-xs text-fg-secondary">
                      {t("upcomingDescription", { count: mobility.upcomingBookings })} · {t("next7Days")}
                    </p>
                  </div>
                </div>
              </Link>
            )}
            {trips.length > 0 && (
              <div className="rounded-lg border border-line bg-subtle p-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <Navigation className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-fg">{t("onTheMap")}</p>
                    <p className="text-xs text-fg-secondary">
                      {[hasShuttle && shuttleCount > 0 ? t("onMapShuttle", { count: shuttleCount }) : null, hasChauffeur && chauffeurCount > 0 ? t("onMapChauffeur", { count: chauffeurCount }) : null, liveCount > 0 ? t("onMapLive", { count: liveCount }) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {unassigned === 0 && mobility.upcomingBookings === 0 && trips.length === 0 && <EmptyState compact title={t("allClear")} description={t("noActiveAlerts")} />}
          </div>

          {routesRunning !== null && (
            <div className="border-t border-line pt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-fg-muted">{t("routesRunningToday")}</span>
                <span className="font-semibold tabular-nums text-fg">{routesRunning}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={routesRunning} aria-label={t("routesRunningToday")}>
                <div className="h-full rounded-full bg-brand" style={{ width: `${routesRunning}%` }} />
              </div>
            </div>
          )}

          {hasShuttle ? (
            <Button asChild variant="outline" size="sm">
              <Link href={companyPath("/company/routes")}>{t("trackRoutesLive")}</Link>
            </Button>
          ) : hasChauffeur ? (
            <Button asChild variant="outline" size="sm">
              <Link href={companyPath("/company/bookings")}>{t("viewBookings")}</Link>
            </Button>
          ) : null}
        </aside>
      </div>
    </Card>
  );
}
