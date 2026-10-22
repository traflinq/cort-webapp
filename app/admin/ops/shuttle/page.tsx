"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bus, MapPin, Navigation, PanelRightOpen, Radio, Square, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/app/admin/components/PermissionGate";
import { AdminCan } from "@/app/lib/abilities/AdminAbilityProvider";
import { apiClient } from "@/app/lib/services/api-client";
import { useAuth } from "@/app/lib/contexts/auth-context";
import { useConfirm } from "@/app/lib/hooks/useConfirm";
import { useShuttleTracking } from "@/app/lib/hooks/useShuttleTracking";
import type { MapMarker, MapPolyline } from "@/app/admin/ui/Map";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Drawer,
  DrawerContent,
  EmptyState,
  ErrorState,
  RefreshButton,
  PageHeader,
  Select,
  Skeleton,
  Spinner,
  StatusBadge,
  focusRing,
  useChartTheme,
} from "@/app/admin/ui";
import { formatRelative, formatTime } from "@/app/admin/lib/format";
import { todayYmd } from "@/app/admin/lib/dates";
import { occupancyCounts, SHUTTLE_STATUS_OVERRIDES, TripDetailPanel, type TripEmployee } from "./TripDetailPanel";

const Map = dynamic(() => import("@/app/admin/ui/Map"), { ssr: false });

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
  current_stop_status?: string | null;
  /** Last-known driver GPS position (Redis shuttle:last_coord), embedded by the backend
   * for STARTED/IN_PROGRESS trips — avoids a separate .../last-location request. */
  last_lat?: number | null;
  last_lng?: number | null;
  last_location_ts?: number | null;
  routes?: {
    id: number;
    name: string;
    vehicles?: { id: number; plate_number: string; model: string | null } | null;
    route_stops?: RouteStop[];
    _count?: { employee_route_assignments?: number };
  } | null;
};

type PolylineResponse = {
  points: { lat: number; lng: number }[];
  encodedPolyline: string;
};

// ---- Helpers ---------------------------------------------------------------

function isActiveShuttleStatus(status: string) {
  return status === "STARTED" || status === "IN_PROGRESS";
}

function currentStopNameForTrip(trip: ShuttleTrip) {
  const stops = trip.routes?.route_stops ?? [];
  return stops.find((s) => s.id === trip.current_stop_id)?.name ?? null;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const inner = (data as { data?: unknown } | null)?.data;
  return Array.isArray(inner) ? (inner as T[]) : [];
}

// ---- Component -------------------------------------------------------------

export default function OpsShuttlePage() {
  return (
    <PermissionGate permission="ops_shuttle">
      <AdminCan I="read" a="OpsShuttle">
        <OpsShuttleContent />
      </AdminCan>
    </PermissionGate>
  );
}

function OpsShuttleContent() {
  const confirm = useConfirm();
  const chart = useChartTheme();
  const { hasCrud } = useAuth();
  const canMutate = hasCrud("ops_shuttle", "update");
  // Loaded locally (not from the shared admin-companies slice, which may hold only one page of results).
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState<string | null>(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [trips, setTrips] = useState<ShuttleTrip[]>([]);
  // Nothing is fetched until a company is chosen.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [polyline, setPolyline] = useState<PolylineResponse | null>(null);
  const [polylineLoading, setPolylineLoading] = useState(false);
  const [endingTripId, setEndingTripId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<TripEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  /** Change the selected trip and reset its dependent state in one place. */
  const selectTrip = useCallback((id: number | null) => {
    setSelectedTripId(id);
    setPolyline(null);
    setEmployees([]);
    setPolylineLoading(!!id);
    setEmployeesLoading(!!id);
  }, []);

  const patchSelectedTrip = useCallback(
    (patch: Partial<Pick<ShuttleTrip, "current_stop_id" | "current_stop_status" | "status">>) => {
      if (!selectedTripId) return;
      setTrips((prev) => prev.map((t) => (t.id === selectedTripId ? { ...t, ...patch } : t)));
    },
    [selectedTripId],
  );

  const loadEmployees = useCallback(async (tripId: number) => {
    try {
      setEmployeesLoading(true);
      const data = await apiClient.request<TripEmployee[]>(`/shuttle-trips/${tripId}/employees`);
      setEmployees(unwrapList<TripEmployee>(data));
    } catch {
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  const selectedTrip = useMemo(() => trips.find((t) => t.id === selectedTripId) ?? null, [trips, selectedTripId]);

  const {
    driverCoord,
    isConnected,
    currentStopName: liveStopName,
    nextStopName: liveNextStopName,
  } = useShuttleTracking({
    tripId: selectedTripId,
    initialLat: selectedTrip?.last_lat ?? null,
    initialLng: selectedTrip?.last_lng ?? null,
    onStopArrived: (data) => {
      patchSelectedTrip({ current_stop_id: data.stopId, current_stop_status: "AT_STOP" });
    },
    onRideProceeding: () => {
      patchSelectedTrip({ current_stop_status: "EN_ROUTE" });
    },
    onAttendanceMarked: () => {
      if (selectedTripId) loadEmployees(selectedTripId);
    },
    onRideEnded: () => {
      patchSelectedTrip({ status: "COMPLETED" });
      if (selectedTripId) loadEmployees(selectedTripId);
    },
  });

  const selectedOccupancy = useMemo(() => occupancyCounts(employees), [employees]);

  // ---- Data fetching -------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getCompanies({ limit: 1000 });
        if (cancelled) return;
        // Response is { data: { data: Company[], pagination } } (or a bare page object / array).
        const page = (res as { data?: unknown } | null)?.data ?? res;
        const rows = unwrapList<{ id: number; name: string }>(page);
        setCompanies([...rows].sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        if (!cancelled) setCompaniesError(err instanceof Error ? err.message : "Failed to load companies");
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // One effect loads today's trips on company change and on manual refresh. No company, no request.
  useEffect(() => {
    if (!selectedCompanyId) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ date: todayYmd(), company_id: String(selectedCompanyId) });
        const data = await apiClient.request<ShuttleTrip[]>(`/shuttle-trips/today?${params.toString()}`);
        if (cancelled) return;
        const list = unwrapList<ShuttleTrip>(data);
        setTrips(list);
        setError(null);
        setLastRefresh(Date.now());
        setSelectedTripId((prev) => {
          if (prev != null && list.some((t) => t.id === prev)) return prev;
          const next = list[0]?.id ?? null;
          if (next !== prev) {
            setPolyline(null);
            setEmployees([]);
            setPolylineLoading(!!next);
            setEmployeesLoading(!!next);
          }
          return next;
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load trips");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, reloadKey]);

  // Polyline + passengers for the selected trip.
  useEffect(() => {
    if (!selectedTripId) return;
    let cancelled = false;
    (async () => {
      const [poly, emps] = await Promise.allSettled([
        apiClient.request<PolylineResponse>(`/shuttle-trips/${selectedTripId}/polyline`),
        apiClient.request<TripEmployee[]>(`/shuttle-trips/${selectedTripId}/employees`),
      ]);
      if (cancelled) return;
      setPolyline(poly.status === "fulfilled" ? poly.value : null);
      setPolylineLoading(false);
      setEmployees(emps.status === "fulfilled" ? unwrapList<TripEmployee>(emps.value) : []);
      setEmployeesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTripId]);

  const reloadTrips = useCallback(() => {
    if (!selectedCompanyId) return;
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, [selectedCompanyId]);

  const handleRefresh = useCallback(() => {
    reloadTrips();
    if (selectedTripId) void loadEmployees(selectedTripId);
  }, [reloadTrips, loadEmployees, selectedTripId]);

  const handleCompanyChange = (value: string) => {
    selectTrip(null);
    setTrips([]);
    setError(null);
    setLastRefresh(null);
    setLoading(!!value);
    setSelectedCompanyId(value ? Number(value) : null);
  };

  const handleForceEndTrip = async (trip: ShuttleTrip) => {
    if (!canMutate || !isActiveShuttleStatus(trip.status)) return;
    const label = `${trip.direction === "MORNING" ? "Morning" : "Evening"} · ${trip.routes?.name ?? `Trip #${trip.id}`}`;
    const ok = await confirm({
      title: "Force end this trip?",
      message: `${label} will be marked as completed now.`,
      description: "Use this only when the driver forgot to end the ride.",
      consequences: ["The driver app stops tracking this trip", "Passengers not yet dropped off keep their current boarding status", "This cannot be undone"],
      confirmLabel: "Force end trip",
      destructive: true,
    });
    if (!ok) return;
    try {
      setEndingTripId(trip.id);
      await apiClient.completeShuttleTrip(trip.id);
      toast.success(`${label} marked as completed`);
      reloadTrips();
      if (selectedTripId === trip.id) await loadEmployees(trip.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to end trip");
    } finally {
      setEndingTripId(null);
    }
  };

  // ---- Map data -------------------------------------------------------

  const markerColors = useMemo(
    () => ({ currentStop: chart.colors[0], stop: chart.colors[3], routeActive: chart.colors[1], routeIdle: chart.axis }),
    [chart],
  );

  const stopMarkers: MapMarker[] = useMemo(() => {
    const stops = selectedTrip?.routes?.route_stops ?? [];
    return stops
      .filter((s) => s.lat !== null && s.lng !== null)
      .map((s) => {
        const etaRaw = selectedTrip?.direction === "MORNING" ? s.morning_eta : s.evening_eta;
        return {
          id: `stop-${s.id}`,
          position: [s.lat!, s.lng!] as [number, number],
          label: `${s.name}${etaRaw ? ` · ${formatTime(etaRaw)}` : ""}`,
          color: s.id === selectedTrip?.current_stop_id ? markerColors.currentStop : markerColors.stop,
        };
      });
  }, [selectedTrip, markerColors]);

  const driverMarker: MapMarker | null = useMemo(() => {
    if (!driverCoord) return null;
    return {
      id: "driver",
      type: "shuttle",
      position: [driverCoord.lat, driverCoord.lng],
      heading: driverCoord.heading,
      label: `Driver · ${driverCoord.speed !== undefined ? `${Math.round((driverCoord.speed ?? 0) * 3.6)} km/h` : "live"}`,
    };
  }, [driverCoord]);

  const mapMarkers = useMemo(() => [...stopMarkers, ...(driverMarker ? [driverMarker] : [])], [stopMarkers, driverMarker]);

  const mapPolylines: MapPolyline[] = useMemo(() => {
    if (!polyline?.points?.length) return [];

    let points = polyline.points;
    const isActiveTrip = selectedTrip?.status === "STARTED" || selectedTrip?.status === "IN_PROGRESS";
    const shouldGrayDefaultRoute = isActiveTrip && !!driverCoord;

    if (driverCoord) {
      let minDist = Infinity;
      let nearestIdx = 0;
      for (let i = 0; i < points.length; i++) {
        const dLat = points[i].lat - driverCoord.lat;
        const dLng = points[i].lng - driverCoord.lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }
      points = points.slice(nearestIdx);
    }

    return [
      {
        positions: points.map((p) => [p.lat, p.lng] as [number, number]),
        color: shouldGrayDefaultRoute ? markerColors.routeIdle : markerColors.routeActive,
      },
    ];
  }, [polyline, driverCoord, selectedTrip?.status, markerColors]);

  const mapCenter = useMemo((): [number, number] => {
    if (driverCoord) return [driverCoord.lat, driverCoord.lng];
    const current = selectedTrip?.routes?.route_stops?.find((s) => s.id === selectedTrip.current_stop_id && s.lat && s.lng);
    if (current) return [current.lat!, current.lng!];
    const firstStop = selectedTrip?.routes?.route_stops?.find((s) => s.lat && s.lng);
    if (firstStop) return [firstStop.lat!, firstStop.lng!];
    return [24.8607, 67.0011];
  }, [driverCoord, selectedTrip]);

  // ---- Render ----------------------------------------------------------------

  const selectedIsActive = !!selectedTrip && isActiveShuttleStatus(selectedTrip.status);

  const forceEndButton = selectedTrip && canMutate && selectedIsActive && (
    <Button
      variant="danger"
      size="sm"
      leftIcon={<Square />}
      loading={endingTripId === selectedTrip.id}
      onClick={() => handleForceEndTrip(selectedTrip)}
    >
      Force end trip
    </Button>
  );

  const detailPanel = selectedTrip ? (
    <TripDetailPanel trip={selectedTrip} employees={employees} loading={employeesLoading} liveStopName={liveStopName} liveNextStopName={liveNextStopName} />
  ) : (
    <Card className="flex h-full items-center justify-center">
      <EmptyState compact icon={<Users aria-hidden="true" />} title="Select a trip" description="Boarding details appear here." />
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live: Shuttle"
        description="Today's shuttle trips with live driver positions and boarding."
        meta={
          <>
            <Badge tone={selectedIsActive && isConnected ? "success" : "neutral"} dot>
              {selectedIsActive ? (isConnected ? "Live tracking" : "Connecting…") : "Live"}
            </Badge>
            {lastRefresh && <span className="text-xs text-fg-muted">Updated {formatRelative(lastRefresh)}</span>}
          </>
        }
        actions={
          <>
            <Select
              aria-label="Company"
              width="auto"
              value={selectedCompanyId ?? ""}
              onChange={(e) => handleCompanyChange(e.target.value)}
              disabled={companiesLoading}
              className="min-w-44"
            >
              <option value="">{companiesLoading ? "Loading companies…" : "Select a company"}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <RefreshButton label="Refresh trips" onClick={handleRefresh} loading={loading} disabled={!selectedCompanyId} />
          </>
        }
      />

      {error && trips.length === 0 && !loading ? (
        <ErrorState title="Couldn't load today's trips" message={error} onRetry={reloadTrips} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Trip list */}
          <div className="flex flex-col gap-3 lg:col-span-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
            {error && (
              <ErrorState compact message={error} onRetry={reloadTrips} />
            )}
            {loading && trips.length === 0 &&
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} padding="md" className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </Card>
              ))}
            {!selectedCompanyId && (
              <Card>
                <EmptyState
                  compact
                  icon={<Bus aria-hidden="true" />}
                  title="Select a company"
                  description={companiesError ?? "Choose a company above to load today's shuttle trips."}
                />
              </Card>
            )}
            {selectedCompanyId && !loading && trips.length === 0 && !error && (
              <Card>
                <EmptyState compact icon={<Bus aria-hidden="true" />} title="No trips scheduled for today" description="Try another company." />
              </Card>
            )}
            {trips.map((trip) => {
              const stopName = currentStopNameForTrip(trip);
              const assignedCount = trip.routes?._count?.employee_route_assignments;
              const isSelected = selectedTripId === trip.id;
              const active = isActiveShuttleStatus(trip.status);
              const showSelectedBoarding = isSelected && active && !employeesLoading && employees.length > 0;

              return (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => {
                    if (!isSelected) selectTrip(trip.id);
                  }}
                  aria-pressed={isSelected}
                  className={cn(
                    "w-full cursor-pointer rounded-xl border p-4 text-left transition-colors",
                    isSelected ? "border-brand-line bg-brand-soft/60" : "border-line bg-card hover:border-line-strong",
                    focusRing,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <Bus className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-fg">{trip.routes?.name ?? `Trip #${trip.id}`}</p>
                        <p className="mt-0.5 text-xs text-fg-muted">
                          {trip.direction === "MORNING" ? "Morning" : "Evening"} · <span className="font-mono">{trip.routes?.vehicles?.plate_number ?? "—"}</span>
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={trip.status} size="sm" overrides={SHUTTLE_STATUS_OVERRIDES} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" aria-hidden="true" />
                      {trip.routes?.route_stops?.length ?? 0} stops
                    </span>
                    {assignedCount != null && (
                      <span className="flex items-center gap-1">
                        <Users className="size-3" aria-hidden="true" />
                        {assignedCount} passengers
                      </span>
                    )}
                    {trip.started_at && (
                      <span className="flex items-center gap-1">
                        <Navigation className="size-3" aria-hidden="true" />
                        Started {formatTime(trip.started_at)}
                      </span>
                    )}
                  </div>

                  {active && (
                    <div className="mt-2 space-y-0.5 text-[11px]">
                      {stopName && (
                        <p className="flex items-center gap-1 font-medium text-brand-ink">
                          <MapPin className="size-3" aria-hidden="true" />
                          {trip.current_stop_status === "EN_ROUTE" ? "En route from" : "At"} {stopName}
                        </p>
                      )}
                      {showSelectedBoarding && (
                        <p className="text-fg-muted">
                          Boarded {selectedOccupancy.boarded}/{selectedOccupancy.total}
                          {selectedOccupancy.absent > 0 ? ` · Absent ${selectedOccupancy.absent}` : ""}
                        </p>
                      )}
                    </div>
                  )}

                  {isSelected && active && (
                    <div className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium", isConnected ? "text-success-ink" : "text-fg-muted")}>
                      <Radio className="size-3" aria-hidden="true" />
                      {isConnected ? "Live tracking active" : "Connecting…"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail panel (inline at lg+) */}
          <div className="hidden min-h-[320px] lg:col-span-3 lg:block lg:h-[calc(100vh-12rem)]">{detailPanel}</div>

          {/* Map */}
          <div className="lg:col-span-6">
            <Card className="overflow-hidden">
              <CardHeader
                title={selectedTrip ? selectedTrip.routes?.name ?? `Trip #${selectedTrip.id}` : "Map"}
                description={
                  selectedTrip
                    ? `${selectedTrip.direction === "MORNING" ? "Morning" : "Evening"} route · ${
                        driverCoord ? `Driver at ${driverCoord.lat.toFixed(5)}, ${driverCoord.lng.toFixed(5)}` : "Waiting for driver location…"
                      }`
                    : "Select a trip to see its route."
                }
                actions={
                  <>
                    {polylineLoading && <Spinner size="sm" label="Loading route" />}
                    {selectedTrip && (
                      <Button variant="outline" size="sm" className="lg:hidden" leftIcon={<PanelRightOpen />} onClick={() => setDetailOpen(true)}>
                        Details
                      </Button>
                    )}
                    {forceEndButton}
                  </>
                }
              />
              <div style={{ height: "clamp(300px, 55vh, 600px)" }}>
                <Map center={mapCenter} zoom={13} markers={mapMarkers} polylines={mapPolylines} height="100%" />
              </div>
              {selectedTrip && (
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[11px] text-fg-muted" aria-label="Map legend">
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: markerColors.currentStop }} /> Current stop
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: markerColors.stop }} /> Other stops
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ background: markerColors.routeActive }} /> Route
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ background: markerColors.routeIdle }} /> Remaining route while live
                  </li>
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Detail drawer below lg */}
      <Drawer open={detailOpen} onOpenChange={setDetailOpen}>
        <DrawerContent title={selectedTrip?.routes?.name ?? "Trip details"} description="Boarding and stop progress" flush size="md" footer={forceEndButton || undefined}>
          {selectedTrip && (
            <TripDetailPanel flush trip={selectedTrip} employees={employees} loading={employeesLoading} liveStopName={liveStopName} liveNextStopName={liveNextStopName} />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
