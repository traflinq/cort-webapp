"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  Clock,
  Crosshair,
  Maximize2,
  PanelRightOpen,
  Radio,
  Square,
  Users,
} from "lucide-react";
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
  Drawer,
  DrawerContent,
  EmptyState,
  ErrorState,
  PageHeader,
  RefreshButton,
  SearchInput,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  focusRing,
  useChartTheme,
} from "@/app/admin/ui";
import { formatRelative, formatTime } from "@/app/admin/lib/format";
import { todayYmd } from "@/app/admin/lib/dates";
import {
  SHUTTLE_STATUS_OVERRIDES,
  TripDetailPanel,
  type TripEmployee,
} from "./TripDetailPanel";
import {
  currentStopIndex,
  isDone,
  isLive,
  isScheduled,
  mergePositions,
  nextStop,
  pktMinutesNow,
  stopEta,
  tripHealth,
  urgencyRank,
  type LivePosition,
  type ShuttleTrip,
  type TripHealth,
} from "./fleet";

const Map = dynamic(() => import("@/app/admin/ui/Map"), { ssr: false });

/** Cheap fleet poll (status + last GPS fix). */
const POSITIONS_POLL_MS = 15_000;
/** Full trip reload (stops, roster counts, drivers) every Nth poll — ~5 min. */
const FULL_RELOAD_EVERY = 20;
/** If the positions endpoint is unavailable, fall back to a full reload every Nth poll — ~1 min. */
const FALLBACK_RELOAD_EVERY = 4;

type PolylineResponse = {
  points: { lat: number; lng: number }[];
  encodedPolyline: string;
};
type Filter = "all" | "live" | "issues" | "scheduled" | "done";
type DirectionFilter = "all" | "MORNING" | "EVENING";

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const inner = (data as { data?: unknown } | null)?.data;
  return Array.isArray(inner) ? (inner as T[]) : [];
}

const tripLabel = (trip: ShuttleTrip) =>
  trip.routes?.name ?? `Trip #${trip.id}`;

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
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [companiesLoading, setCompaniesLoading] = useState(true);
  /** null = nothing chosen yet: no trips are fetched or polled until a company is picked. */
  const [companyId, setCompanyId] = useState<number | null>(null);

  const [trips, setTrips] = useState<ShuttleTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  /** Clock for health checks and relative times; advanced by each poll. */
  const [now, setNow] = useState(() => Date.now());

  const [filter, setFilter] = useState<Filter>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [search, setSearch] = useState("");

  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [polyline, setPolyline] = useState<PolylineResponse | null>(null);
  const [employees, setEmployees] = useState<TripEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [follow, setFollow] = useState(false);
  /** Bumped to re-frame the map (initial load, trip selected, "Fit"). */
  const [viewKey, setViewKey] = useState(0);
  const [endingTripId, setEndingTripId] = useState<number | null>(null);

  const companyNames = useMemo(
    () => new globalThis.Map(companies.map((c) => [c.id, c.name])),
    [companies],
  );

  // ---- Data: companies ------------------------------------------------------

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
      } catch {
        /* the picker stays empty; the empty state explains what to do */
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Data: trips (full) + positions (cheap poll) ---------------------------

  const tripsRef = useRef(trips);
  useEffect(() => {
    tripsRef.current = trips;
  }, [trips]);
  /** Drops responses from superseded requests (company switched mid-flight). */
  const loadSeq = useRef(0);
  /** Whether the map has been framed on the fleet yet (once per company view). */
  const [framed, setFramed] = useState(false);

  const loadTrips = useCallback(async () => {
    if (!companyId) return;
    const seq = ++loadSeq.current;
    try {
      const params = new URLSearchParams({
        date: todayYmd(),
        include_completed: "true",
        company_id: String(companyId),
      });
      const data = await apiClient.request<ShuttleTrip[]>(
        `/shuttle-trips/today?${params.toString()}`,
      );
      if (seq !== loadSeq.current) return;
      setTrips(unwrapList<ShuttleTrip>(data));
      setError(null);
      const t = Date.now();
      setLastSync(t);
      setNow(t);
    } catch (err) {
      if (seq === loadSeq.current)
        setError(err instanceof Error ? err.message : "Failed to load trips");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    // Started from a callback: loadTrips only sets state once its request resolves.
    void Promise.resolve().then(loadTrips);
  }, [loadTrips]);

  // Positions poll — only while the tab is visible; resumes immediately when it becomes visible.
  const positionsBroken = useRef(false);
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    let ticks = 0;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      ticks += 1;
      if (
        positionsBroken.current
          ? ticks % FALLBACK_RELOAD_EVERY === 0
          : ticks % FULL_RELOAD_EVERY === 0
      ) {
        await loadTrips();
        return;
      }
      if (positionsBroken.current) {
        setNow(Date.now());
        return;
      }
      try {
        const params = new URLSearchParams({
          date: todayYmd(),
          company_id: String(companyId),
        });
        const data = await apiClient.request<LivePosition[]>(
          `/shuttle-trips/live-positions?${params.toString()}`,
        );
        if (cancelled) return;
        const { trips: merged, needsFullReload } = mergePositions(
          tripsRef.current,
          unwrapList<LivePosition>(data),
        );
        if (merged !== tripsRef.current) setTrips(merged);
        if (needsFullReload) void loadTrips();
        setLastSync(Date.now());
      } catch {
        // Older backend without the endpoint, or a blip: degrade to periodic full reloads.
        positionsBroken.current = true;
      } finally {
        if (!cancelled) setNow(Date.now());
      }
    };
    const timer = setInterval(() => void tick(), POSITIONS_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [companyId, loadTrips]);

  // ---- Selected trip ---------------------------------------------------------

  const selectedTrip = useMemo(
    () => trips.find((t) => t.id === selectedTripId) ?? null,
    [trips, selectedTripId],
  );
  const selectedIsLive = !!selectedTrip && isLive(selectedTrip.status);

  const selectTrip = useCallback((id: number | null) => {
    setSelectedTripId(id);
    setPolyline(null);
    setEmployees([]);
    setEmployeesLoading(!!id);
    setFollow(false);
    setViewKey((k) => k + 1);
  }, []);

  // Stable handler so memoised rows don't re-render on every live GPS tick.
  const selectedIdRef = useRef(selectedTripId);
  useEffect(() => {
    selectedIdRef.current = selectedTripId;
  }, [selectedTripId]);
  const handleRowSelect = useCallback(
    (id: number) => {
      if (id !== selectedIdRef.current) selectTrip(id);
      // The panel floats over the map at lg+; smaller screens open it as a drawer.
      if (!window.matchMedia("(min-width: 1024px)").matches)
        setDetailOpen(true);
    },
    [selectTrip],
  );

  const loadEmployees = useCallback(async (tripId: number) => {
    try {
      const data = await apiClient.request<TripEmployee[]>(
        `/shuttle-trips/${tripId}/employees`,
      );
      setEmployees(unwrapList<TripEmployee>(data));
    } catch {
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  // Polyline + passengers for the selected trip.
  useEffect(() => {
    if (!selectedTripId) return;
    let cancelled = false;
    (async () => {
      const [poly, emps] = await Promise.allSettled([
        apiClient.request<PolylineResponse>(
          `/shuttle-trips/${selectedTripId}/polyline`,
        ),
        apiClient.request<TripEmployee[]>(
          `/shuttle-trips/${selectedTripId}/employees`,
        ),
      ]);
      if (cancelled) return;
      setPolyline(poly.status === "fulfilled" ? poly.value : null);
      setEmployees(
        emps.status === "fulfilled" ? unwrapList<TripEmployee>(emps.value) : [],
      );
      setEmployeesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTripId]);

  const patchTrip = useCallback(
    (id: number | null, patch: Partial<ShuttleTrip>) => {
      if (!id) return;
      setTrips((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  // Live socket only for the selected *live* trip; everything else moves with the poll.
  const {
    driverCoord,
    isConnected,
    currentStopName: liveStopName,
    nextStopName: liveNextStopName,
  } = useShuttleTracking({
    tripId: selectedIsLive ? selectedTripId : null,
    initialLat: selectedTrip?.last_lat ?? null,
    initialLng: selectedTrip?.last_lng ?? null,
    onStopArrived: (data) =>
      patchTrip(selectedTripId, {
        current_stop_id: data.stopId,
        current_stop_status: "AT_STOP",
      }),
    onRideProceeding: () =>
      patchTrip(selectedTripId, { current_stop_status: "EN_ROUTE" }),
    onAttendanceMarked: () => {
      if (selectedTripId) void loadEmployees(selectedTripId);
    },
    onRideEnded: () => {
      patchTrip(selectedTripId, { status: "COMPLETED" });
      if (selectedTripId) void loadEmployees(selectedTripId);
    },
  });

  // ---- Derived: health, counts, visible list ---------------------------------

  const healthById = useMemo(() => {
    const nowMin = pktMinutesNow(now);
    return new globalThis.Map(
      trips.map((t) => [t.id, tripHealth(t, now, nowMin)]),
    );
  }, [trips, now]);

  const directionTrips = useMemo(
    () =>
      direction === "all"
        ? trips
        : trips.filter((t) => t.direction === direction),
    [trips, direction],
  );

  const counts = useMemo(() => {
    const c = {
      all: directionTrips.length,
      live: 0,
      issues: 0,
      scheduled: 0,
      done: 0,
      riders: 0,
    };
    for (const t of directionTrips) {
      if (isLive(t.status)) {
        c.live += 1;
        c.riders += t.routes?._count?.employee_route_assignments ?? 0;
      } else if (isScheduled(t.status)) c.scheduled += 1;
      else if (isDone(t.status)) c.done += 1;
      if (healthById.get(t.id)?.issues.length) c.issues += 1;
    }
    return c;
  }, [directionTrips, healthById]);

  const visibleTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return directionTrips
      .filter((t) => {
        const h = healthById.get(t.id);
        if (filter === "live" && !isLive(t.status)) return false;
        if (filter === "issues" && !h?.issues.length) return false;
        if (filter === "scheduled" && !isScheduled(t.status)) return false;
        if (filter === "done" && !isDone(t.status)) return false;
        if (!q) return true;
        const company = t.routes?.company_id
          ? companyNames.get(t.routes.company_id)
          : "";
        return [
          tripLabel(t),
          t.routes?.vehicles?.plate_number,
          t.users?.full_name,
          company,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .map((t) => ({
        trip: t,
        health: healthById.get(t.id)!,
        rank: urgencyRank(t, healthById.get(t.id)!),
      }))
      .sort(
        (a, b) =>
          a.rank[0] - b.rank[0] ||
          a.rank[1] - b.rank[1] ||
          tripLabel(a.trip).localeCompare(tripLabel(b.trip)),
      );
  }, [directionTrips, healthById, filter, search, companyNames]);

  // ---- Actions -----------------------------------------------------------------

  const handleRefresh = useCallback(() => {
    if (!companyId) return;
    setLoading(true);
    void loadTrips();
    if (selectedTripId) void loadEmployees(selectedTripId);
  }, [companyId, loadTrips, loadEmployees, selectedTripId]);

  const handleCompanyChange = (value: string) => {
    selectTrip(null);
    setTrips([]);
    setError(null);
    setLastSync(null);
    setLoading(!!value);
    setFramed(false);
    positionsBroken.current = false;
    setCompanyId(value ? Number(value) : null);
  };

  const handleForceEndTrip = async (trip: ShuttleTrip) => {
    if (!canMutate || !isLive(trip.status)) return;
    const label = `${trip.direction === "MORNING" ? "Morning" : "Evening"} · ${tripLabel(trip)}`;
    const ok = await confirm({
      title: "Force end this trip?",
      message: `${label} will be marked as completed now.`,
      description: "Use this only when the driver forgot to end the ride.",
      consequences: [
        "The driver app stops tracking this trip",
        "Passengers not yet dropped off keep their current boarding status",
        "This cannot be undone",
      ],
      confirmLabel: "Force end trip",
      destructive: true,
    });
    if (!ok) return;
    try {
      setEndingTripId(trip.id);
      await apiClient.completeShuttleTrip(trip.id);
      toast.success(`${label} marked as completed`);
      patchTrip(trip.id, { status: "COMPLETED" });
      void loadTrips();
      if (selectedTripId === trip.id) await loadEmployees(trip.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to end trip");
    } finally {
      setEndingTripId(null);
    }
  };

  // ---- Map data ------------------------------------------------------------------

  const colors = useMemo(
    () => ({
      current: chart.colors[0],
      upcoming: chart.colors[3],
      passed: chart.axis,
      routeActive: chart.colors[1],
      routeIdle: chart.axis,
    }),
    [chart],
  );

  /** Selected vehicle position: live socket first, then the last polled fix. */
  const selectedCoord: [number, number] | null = driverCoord
    ? [driverCoord.lat, driverCoord.lng]
    : selectedTrip?.last_lat != null && selectedTrip.last_lng != null
      ? [selectedTrip.last_lat, selectedTrip.last_lng]
      : null;

  const vehicleMarkers: MapMarker[] = useMemo(
    () =>
      trips
        .filter(
          (t) =>
            isLive(t.status) &&
            t.last_lat != null &&
            t.last_lng != null &&
            t.id !== selectedTripId,
        )
        .map((t) => ({
          id: `trip-${t.id}`,
          type: "shuttle",
          position: [t.last_lat!, t.last_lng!] as [number, number],
          label: `${tripLabel(t)} · ${t.routes?.vehicles?.plate_number ?? "—"}`,
          description: t.users?.full_name ?? undefined,
        })),
    [trips, selectedTripId],
  );

  // Frame the fleet once, as soon as the first vehicle reports a position (render-time adjustment).
  if (!framed && !selectedTripId && vehicleMarkers.length > 0) {
    setFramed(true);
    setViewKey((k) => k + 1);
  }

  const selectedMarkers: MapMarker[] = useMemo(() => {
    if (!selectedTrip) return [];
    const stops = selectedTrip.routes?.route_stops ?? [];
    const idx = currentStopIndex(selectedTrip);
    const passedBefore =
      idx < 0
        ? 0
        : selectedTrip.current_stop_status === "EN_ROUTE"
          ? idx + 1
          : idx;
    const done = isDone(selectedTrip.status);
    const markers: MapMarker[] = stops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => {
        const i = stops.indexOf(s);
        const eta = stopEta(selectedTrip, s);
        return {
          id: `stop-${s.id}`,
          position: [s.lat!, s.lng!] as [number, number],
          label: String(i + 1),
          description: `${s.name}${eta ? ` · ${formatTime(eta)}` : ""}`,
          color:
            i === idx && selectedTrip.current_stop_status !== "EN_ROUTE"
              ? colors.current
              : done || i < passedBefore
                ? colors.passed
                : colors.upcoming,
        };
      });
    if (selectedCoord) {
      markers.push({
        id: `trip-${selectedTrip.id}`,
        type: "shuttle",
        position: selectedCoord,
        heading: driverCoord?.heading,
        label: `${tripLabel(selectedTrip)} · ${selectedTrip.routes?.vehicles?.plate_number ?? "—"}`,
        description: selectedTrip.users?.full_name ?? undefined,
      });
    }
    return markers;
    // selectedCoord is derived from driverCoord + the trip; listing its parts keeps the memo stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrip, driverCoord, colors]);

  const mapMarkers = useMemo(
    () => [...vehicleMarkers, ...selectedMarkers],
    [vehicleMarkers, selectedMarkers],
  );

  /** What "Fit" frames: the selected trip (stops + bus), else the whole live fleet. */
  const fitTo = useMemo<[number, number][]>(
    () =>
      selectedTrip
        ? selectedMarkers.map((m) => m.position)
        : vehicleMarkers.map((m) => m.position),
    [selectedTrip, selectedMarkers, vehicleMarkers],
  );

  const mapPolylines: MapPolyline[] = useMemo(() => {
    if (!polyline?.points?.length) return [];
    let points = polyline.points;
    // While live, draw only the road still ahead of the bus.
    if (selectedIsLive && driverCoord) {
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
        color: isDone(selectedTrip?.status ?? "")
          ? colors.routeIdle
          : colors.routeActive,
      },
    ];
  }, [polyline, driverCoord, selectedIsLive, selectedTrip?.status, colors]);

  const followCenter =
    follow && selectedIsLive && selectedCoord ? selectedCoord : undefined;

  // ---- Render --------------------------------------------------------------------

  const selectedHealth = selectedTrip
    ? healthById.get(selectedTrip.id)
    : undefined;
  const live = {
    connected: isConnected,
    speedKmh:
      driverCoord?.speed != null ? Math.round(driverCoord.speed * 3.6) : null,
    lastSeen:
      isConnected && driverCoord
        ? "Live"
        : selectedTrip?.last_location_ts
          ? formatRelative(selectedTrip.last_location_ts)
          : null,
  };

  const forceEndButton =
    selectedTrip && canMutate && selectedIsLive ? (
      <Button
        variant="danger"
        size="sm"
        leftIcon={<Square />}
        loading={endingTripId === selectedTrip.id}
        onClick={() => void handleForceEndTrip(selectedTrip)}
      >
        Force end trip
      </Button>
    ) : null;

  const panelProps =
    selectedTrip && selectedHealth
      ? {
          trip: selectedTrip,
          employees,
          loading: employeesLoading,
          health: selectedHealth,
          companyName: selectedTrip.routes?.company_id
            ? companyNames.get(selectedTrip.routes.company_id)
            : null,
          live,
          liveStopName,
          liveNextStopName,
        }
      : null;

  const syncFresh = lastSync != null && now - lastSync < POSITIONS_POLL_MS * 3;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live: Shuttle"
        description="Every shuttle on the road today. Problems rise to the top."
        meta={
          companyId ? (
            <Badge tone={syncFresh ? "success" : "neutral"} dot>
              {lastSync ? `Synced ${formatRelative(lastSync)}` : "Syncing…"}
            </Badge>
          ) : undefined
        }
        actions={
          <>
            <Select
              aria-label="Company"
              width="auto"
              value={companyId ?? ""}
              onChange={(e) => handleCompanyChange(e.target.value)}
              disabled={companiesLoading}
              className="min-w-44"
            >
              <option value="">
                {companiesLoading ? "Loading companies…" : "Select a company"}
              </option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <RefreshButton
              label="Refresh trips"
              onClick={handleRefresh}
              loading={loading}
              disabled={!companyId}
            />
          </>
        }
      />

      {!companyId ? (
        <Card>
          <EmptyState
            icon={<Bus aria-hidden="true" />}
            title="Select a company"
            description="Pick a company to see its shuttles on the map, with live positions and boarding."
            action={
              <Select
                aria-label="Company"
                value=""
                onChange={(e) => handleCompanyChange(e.target.value)}
                disabled={companiesLoading}
                className="w-64"
              >
                <option value="">
                  {companiesLoading ? "Loading companies…" : "Select a company"}
                </option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            }
          />
        </Card>
      ) : (
        <>
          {/* At-a-glance counts; each one is a shortcut to that filter. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile
              label="On the road"
              value={counts.live}
              hint={`${counts.riders} riders`}
              icon={<Radio />}
              tone="success"
              active={filter === "live"}
              onClick={() => setFilter(filter === "live" ? "all" : "live")}
            />
            <StatTile
              label="Need attention"
              value={counts.issues}
              icon={<AlertTriangle />}
              tone="warning"
              emphasis={counts.issues > 0}
              active={filter === "issues"}
              onClick={() => setFilter(filter === "issues" ? "all" : "issues")}
            />
            <StatTile
              label="Not started"
              value={counts.scheduled}
              icon={<Clock />}
              tone="neutral"
              active={filter === "scheduled"}
              onClick={() =>
                setFilter(filter === "scheduled" ? "all" : "scheduled")
              }
            />
            <StatTile
              label="Completed"
              value={counts.done}
              icon={<CheckCircle2 />}
              tone="info"
              active={filter === "done"}
              onClick={() => setFilter(filter === "done" ? "all" : "done")}
            />
            <StatTile
              label="All trips today"
              value={counts.all}
              icon={<Bus />}
              tone="neutral"
              active={filter === "all"}
              onClick={() => setFilter("all")}
              className="col-span-2 sm:col-span-1"
            />
          </div>

          {error && trips.length === 0 && !loading ? (
            <ErrorState
              title="Couldn't load today's trips"
              message={error}
              onRetry={handleRefresh}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,360px)_1fr]">
              {/* Trip list */}
              <Card className="flex min-h-[420px] flex-col lg:h-[calc(100vh-17rem)] lg:min-h-[520px]">
                <div className="shrink-0 space-y-2.5 border-b border-line p-3">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Route, plate, driver, company"
                    aria-label="Search trips"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Tabs
                      value={direction}
                      onValueChange={(v) => setDirection(v as DirectionFilter)}
                    >
                      <TabsList variant="pills" aria-label="Direction">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="MORNING">Morning</TabsTrigger>
                        <TabsTrigger value="EVENING">Evening</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <span className="text-xs tabular-nums text-fg-muted">
                      {visibleTrips.length} shown
                    </span>
                  </div>
                  {error && (
                    <p className="text-xs text-danger-ink">
                      Last refresh failed. Showing the previous data.
                    </p>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                  {loading && trips.length === 0 ? (
                    <div className="space-y-2" aria-busy="true">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="space-y-2 rounded-lg border border-line p-3"
                        >
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : visibleTrips.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<Bus aria-hidden="true" />}
                      title={
                        trips.length === 0
                          ? "No shuttle trips today"
                          : "Nothing matches"
                      }
                      description={
                        trips.length === 0
                          ? companyId
                            ? "Try another company."
                            : undefined
                          : "Change the filter or search."
                      }
                      action={
                        trips.length > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFilter("all");
                              setDirection("all");
                              setSearch("");
                            }}
                          >
                            Clear filters
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : (
                    <ul className="space-y-1.5">
                      {visibleTrips.map(({ trip, health }) => (
                        <li key={trip.id}>
                          <TripRow
                            trip={trip}
                            health={health}
                            selected={trip.id === selectedTripId}
                            onSelect={handleRowSelect}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>

              {/* Map with floating controls and the trip panel */}
              <div className="relative h-[60vh] min-h-[420px] overflow-hidden rounded-xl border border-line lg:h-[calc(100vh-17rem)] lg:min-h-[520px]">
                <Map
                  markers={mapMarkers}
                  polylines={mapPolylines}
                  height="100%"
                  className="!rounded-none !border-0 !shadow-none"
                  autoFit={false}
                  viewKey={viewKey}
                  fitTo={fitTo}
                  center={followCenter}
                  followCenter={!!followCenter}
                  onMarkerClick={(id) => {
                    if (id.startsWith("trip-")) {
                      const tripId = Number(id.slice(5));
                      if (tripId !== selectedTripId) selectTrip(tripId);
                    }
                  }}
                />

                <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
                  <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-line bg-card/95 p-1 shadow-[var(--shadow-card)] backdrop-blur">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Maximize2 />}
                      onClick={() => setViewKey((k) => k + 1)}
                    >
                      {selectedTrip ? "Fit trip" : "Fit fleet"}
                    </Button>
                    {selectedIsLive && (
                      <Button
                        variant={follow ? "secondary" : "ghost"}
                        size="sm"
                        leftIcon={<Crosshair />}
                        aria-pressed={follow}
                        onClick={() => setFollow((f) => !f)}
                        disabled={!selectedCoord}
                      >
                        Follow
                      </Button>
                    )}
                    {selectedTrip && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectTrip(null)}
                      >
                        Show all
                      </Button>
                    )}
                  </div>
                  {selectedTrip && (
                    <ul
                      className="pointer-events-auto hidden items-center gap-3 rounded-lg border border-line bg-card/95 px-3 py-2 text-[11px] text-fg-muted shadow-[var(--shadow-card)] backdrop-blur sm:flex"
                      aria-label="Map legend"
                    >
                      <LegendDot color={colors.current} label="Current" />
                      <LegendDot color={colors.upcoming} label="Upcoming" />
                      <LegendDot color={colors.passed} label="Passed" />
                    </ul>
                  )}
                </div>

                {vehicleMarkers.length === 0 && !selectedTrip && !loading && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                    <span className="rounded-full border border-line bg-card/95 px-3 py-1.5 text-xs text-fg-muted shadow-[var(--shadow-card)]">
                      No vehicles reporting a location right now
                    </span>
                  </div>
                )}

                {/* Trip panel floats over the map at lg+; a drawer below that. */}
                {panelProps && (
                  <>
                    <div className="absolute bottom-3 right-3 top-3 hidden w-[360px] lg:block">
                      <TripDetailPanel
                        {...panelProps}
                        footer={forceEndButton}
                        onClose={() => selectTrip(null)}
                        className="shadow-[var(--shadow-card-hover)]"
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<PanelRightOpen />}
                      className="absolute bottom-3 right-3 shadow-[var(--shadow-card)] lg:hidden"
                      onClick={() => setDetailOpen(true)}
                    >
                      Trip details
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <Drawer open={detailOpen && !!panelProps} onOpenChange={setDetailOpen}>
        <DrawerContent
          title={selectedTrip ? tripLabel(selectedTrip) : "Trip details"}
          description="Driver, stops and boarding"
          flush
          size="md"
          footer={forceEndButton ?? undefined}
        >
          {panelProps && <TripDetailPanel flush {...panelProps} />}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// ---- Pieces --------------------------------------------------------------------

function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
  active,
  emphasis,
  onClick,
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: React.ReactNode;
  tone: "success" | "warning" | "neutral" | "info";
  active: boolean;
  emphasis?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const toneCls = {
    success: "bg-success-soft text-success-ink",
    warning: "bg-warning-soft text-warning-ink",
    neutral: "bg-subtle text-fg-muted",
    info: "bg-info-soft text-info-ink",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
        active
          ? "border-brand ring-1 ring-brand"
          : emphasis
            ? "border-warning-line"
            : "border-line hover:border-line-strong",
        focusRing,
        className,
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
          toneCls,
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-xl font-semibold leading-tight tabular-nums",
            emphasis ? "text-warning-ink" : "text-fg",
          )}
        >
          {value}
        </span>
        <span className="block truncate text-xs text-fg-muted">
          {label}
          {hint && <> · {hint}</>}
        </span>
      </span>
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="size-2.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </li>
  );
}

/** One trip in the list. Memoised: the poll keeps unchanged trips' object identity. */
const TripRow = memo(function TripRow({
  trip,
  health,
  selected,
  onSelect,
}: {
  trip: ShuttleTrip;
  health: TripHealth;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const stops = trip.routes?.route_stops ?? [];
  const idx = currentStopIndex(trip);
  const passed = isDone(trip.status)
    ? stops.length
    : idx < 0
      ? 0
      : trip.current_stop_status === "EN_ROUTE"
        ? idx + 1
        : idx;
  const target = nextStop(trip);
  const live = isLive(trip.status);
  const issue = health.issues[0];

  let progress: string;
  if (live) {
    progress =
      trip.current_stop_status === "AT_STOP" && idx >= 0
        ? `At ${stops[idx]?.name}`
        : target
          ? `→ ${target.name}${stopEta(trip, target) ? ` · ${formatTime(stopEta(trip, target)!)}` : ""}`
          : "Heading to office";
  } else if (isScheduled(trip.status)) {
    const first =
      trip.direction === "EVENING"
        ? trip.routes?.office_stop?.evening_eta
        : stops[0]
          ? stopEta(trip, stops[0])
          : null;
    progress = first ? `Departs ${formatTime(first)}` : "Not started";
  } else {
    progress = trip.completed_at
      ? `Completed ${formatTime(trip.completed_at)}`
      : "Completed";
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(trip.id)}
      aria-pressed={selected}
      className={cn(
        "w-full cursor-pointer rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-brand-line bg-brand-soft/60"
          : "border-transparent hover:bg-subtle",
        issue && !selected && "border-warning-line bg-warning-soft/40",
        focusRing,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            issue
              ? "bg-warning"
              : live
                ? "bg-success"
                : isDone(trip.status)
                  ? "bg-fg-muted/40"
                  : "bg-line-strong",
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
          {tripLabel(trip)}
        </span>
        <span className="shrink-0 text-[11px] font-medium text-fg-muted">
          {trip.direction === "MORNING" ? "AM" : "PM"}
        </span>
        <StatusBadge
          status={trip.status}
          size="sm"
          overrides={SHUTTLE_STATUS_OVERRIDES}
        />
      </div>
      <p className="mt-1 truncate pl-4 text-xs text-fg-muted">
        <span className="font-mono">
          {trip.routes?.vehicles?.plate_number ?? "No vehicle"}
        </span>
        {trip.users?.full_name && <> · {trip.users.full_name}</>}
      </p>
      <div className="mt-2 flex items-center gap-2 pl-4">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs",
            live ? "font-medium text-fg-secondary" : "text-fg-muted",
          )}
        >
          {progress}
        </span>
        {stops.length > 0 && (
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-fg-muted">
            <span
              className="h-1 w-12 overflow-hidden rounded-full bg-line"
              aria-hidden="true"
            >
              <span
                className={cn(
                  "block h-full rounded-full",
                  live ? "bg-success" : "bg-fg-muted/50",
                )}
                style={{
                  width: `${(Math.min(passed, stops.length) / stops.length) * 100}%`,
                }}
              />
            </span>
            {Math.min(passed, stops.length)}/{stops.length}
          </span>
        )}
        {trip.routes?._count?.employee_route_assignments != null && (
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums text-fg-muted">
            <Users className="size-3" aria-hidden="true" />
            {trip.routes._count.employee_route_assignments}
          </span>
        )}
      </div>
      {issue && (
        <p className="mt-1.5 flex items-center gap-1 pl-4 text-xs font-medium text-warning-ink">
          <AlertTriangle className="size-3" aria-hidden="true" />
          {health.issues.map((i) => i.label).join(" · ")}
        </p>
      )}
    </button>
  );
});
