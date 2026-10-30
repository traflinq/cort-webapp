"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Radio, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  ErrorState,
  PageHeader,
  RefreshButton,
  StatStrip,
  StatusBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  type DataTableColumn,
} from "../admin/ui";
import type { MapMarker } from "../admin/ui/Map";
import { BUSINESS_TZ, formatTime } from "../admin/lib/format";
import { apiClient } from "../lib/services/api-client";
import { useLiveMobilityTracking } from "../lib/hooks/useLiveMobilityTracking";
import type { CortVendorDayTrip, CortVendorRouteRow, CortVendorSummary, ShuttleDirection } from "../lib/services/types/cort-vendor";
import { errorMessage, isLiveStatus, todayISO } from "./lib";

const Map = dynamic(() => import("../admin/ui/Map"), { ssr: false });

const REFRESH_MS = 60_000;
/** Hour (business timezone) after which a still-SCHEDULED trip of that shift is shown as "Not started". */
const SHIFT_END_HOUR: Record<ShuttleDirection, number> = { MORNING: 12, EVENING: 22 };

const businessHour = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TZ, hour: "numeric", hourCycle: "h23" }).format(new Date()));
const todayLabel = () => new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date());

/** SCHEDULED trips whose shift is already over are surfaced as not started instead of "Scheduled". */
function displayStatus(t: CortVendorDayTrip, hour: number): string {
  return t.status === "SCHEDULED" && hour >= SHIFT_END_HOUR[t.direction] ? "NOT_STARTED" : t.status;
}
const STATUS_OVERRIDES = { NOT_STARTED: { tone: "warning" as const, label: "Not started" } };

export default function CortVendorDashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<CortVendorSummary | null>(null);
  const [trips, setTrips] = useState<CortVendorDayTrip[]>([]);
  const [routes, setRoutes] = useState<CortVendorRouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const [hour, setHour] = useState(businessHour);
  const [shift, setShift] = useState<ShuttleDirection>(() => (businessHour() < 12 ? "MORNING" : "EVENING"));

  useEffect(() => {
    let cancelled = false;
    const date = todayISO();
    Promise.all([apiClient.getCortVendorSummary(date), apiClient.getCortVendorDayTrips(date), apiClient.getCortVendorRoutes()])
      .then(([s, t, r]) => {
        if (cancelled) return;
        setSummary(s);
        setTrips(t);
        setRoutes(r);
        setError(null);
        setUpdatedAt(new Date());
        setHour(businessHour());
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "Failed to load dashboard")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const clientByRoute = useMemo(() => new globalThis.Map(routes.map((r) => [r.id, r.companies?.name ?? null])), [routes]);
  const clients = useMemo(() => [...new Set(routes.map((r) => r.companies?.name).filter(Boolean))] as string[], [routes]);

  const liveTrips = useMemo(() => trips.filter((t) => isLiveStatus(t.status)), [trips]);
  const { vehicleCoords, isConnected } = useLiveMobilityTracking(
    liveTrips.map((t) => ({ id: t.id, type: "shuttle" as const, lastLat: t.last_lat, lastLng: t.last_lng })),
  );

  // Map: offices + pickup stops of today's routes frame the operating area; live vehicles on top.
  const { markers, fitTo } = useMemo(() => {
    const stops = new globalThis.Map<number, { name: string; lat: number; lng: number; office: boolean }>();
    trips.forEach((t) =>
      t.routes?.route_stops.forEach((s) => {
        if (s.lat != null && s.lng != null) stops.set(s.id, { name: s.name, lat: s.lat, lng: s.lng, office: s.stop_type === "OFFICE" });
      }),
    );
    const stopMarkers: MapMarker[] = [...stops.entries()]
      .filter(([, s]) => s.office)
      .map(([id, s]) => ({ id: `office-${id}`, position: [s.lat, s.lng] as [number, number], label: s.name, color: "#f47f00" }));
    const vehicleMarkers: MapMarker[] = liveTrips.flatMap((t) => {
      const c = vehicleCoords[String(t.id)];
      const lat = c?.lat || t.last_lat;
      const lng = c?.lng || t.last_lng;
      if (!lat || !lng) return [];
      return [{
        id: `trip-${t.id}`,
        type: "shuttle",
        position: [lat, lng] as [number, number],
        heading: c?.heading,
        label: `${t.vehicles?.plate_number ?? "Vehicle"} · ${t.routes?.name ?? ""}`,
        description: t.users?.full_name ?? undefined,
      }];
    });
    const points = [...stops.values()].map((s) => [s.lat, s.lng] as [number, number]);
    return { markers: [...stopMarkers, ...vehicleMarkers], fitTo: points.length ? points : undefined };
  }, [trips, liveTrips, vehicleCoords]);

  const byShift = useMemo(() => {
    const group = (d: ShuttleDirection) => trips.filter((t) => t.direction === d);
    return { MORNING: group("MORNING"), EVENING: group("EVENING") };
  }, [trips]);

  if (error && !summary) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  const counts = summary?.counts;
  const done = trips.filter((t) => t.status === "COMPLETED").length;
  const notStarted = trips.filter((t) => displayStatus(t, hour) === "NOT_STARTED").length;
  const assignedVehicles = new Set(routes.flatMap((r) => [r.vehicles?.id, r.evening_vehicle?.id]).filter(Boolean)).size;

  const columns: DataTableColumn<CortVendorDayTrip>[] = [
    {
      key: "route",
      header: "Route",
      cell: (t) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">{t.routes?.name ?? "—"}</div>
          <div className="truncate text-xs text-fg-muted">
            {/* The plate has its own column from sm up. */}
            <span className="sm:hidden">{t.vehicles?.plate_number}{clients.length > 1 ? " · " : ""}</span>
            {clients.length > 1 && clientByRoute.get(t.route_id ?? -1)}
          </div>
        </div>
      ),
    },
    { key: "vehicle", header: "Vehicle", mono: true, hideBelow: "sm", className: "whitespace-nowrap", cell: (t) => t.vehicles?.plate_number ?? "—" },
    { key: "driver", header: "Driver", hideBelow: "md", cell: (t) => t.users?.full_name ?? "—" },
    {
      key: "time",
      header: "Started – Ended",
      hideBelow: "sm",
      cell: (t) => (t.started_at ? `${formatTime(t.started_at)} – ${t.completed_at ? formatTime(t.completed_at) : "…"}` : "—"),
    },
    { key: "status", header: "Status", cell: (t) => <StatusBadge status={displayStatus(t, hour)} overrides={STATUS_OVERRIDES} size="sm" /> },
  ];

  const shiftCard = (
    <Card>
      <CardHeader title="Today by shift" />
      <CardContent className="space-y-4">
        <ShiftProgress label="Morning" icon={<Sun size={14} />} trips={byShift.MORNING} hour={hour} />
        <ShiftProgress label="Evening" icon={<Moon size={14} />} trips={byShift.EVENING} hour={hour} />
      </CardContent>
    </Card>
  );

  const roadCard = (
    <Card className="flex-1">
      <CardHeader title="On the road" />
      {liveTrips.length === 0 ? (
        <CardContent className="flex items-start gap-3 text-sm">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-fg-muted">
            <Radio size={16} aria-hidden="true" />
          </span>
          <div>
            <div className="font-medium text-fg">No vehicles on the road right now</div>
            <div className="mt-0.5 text-fg-muted">The live map opens here as soon as a driver starts a route.</div>
          </div>
        </CardContent>
      ) : (
        <ul className="divide-y divide-line">
          {liveTrips.map((t) => (
            <li key={t.id}>
              <Link href={`/cort-vendor/trips/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-subtle">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg">{t.routes?.name}</div>
                  <div className="truncate text-xs text-fg-muted">
                    {t.vehicles?.plate_number} · {t.users?.full_name}
                  </div>
                </div>
                <StatusBadge status={t.status} size="sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`${todayLabel()}${clients.length ? ` · ${clients.join(", ")}` : ""}`}
        actions={
          <>
            {updatedAt && <span className="hidden text-xs text-fg-muted sm:inline">Updated {formatTime(updatedAt)}</span>}
            <RefreshButton label="Refresh dashboard" onClick={refresh} loading={loading && !summary} />
          </>
        }
      />

      <StatStrip
        aria-label="Fleet summary"
        items={[
          { key: "vehicles", label: "Vehicles", value: counts?.vehicles ?? "—", hint: routes.length ? `${assignedVehicles} assigned to routes` : undefined, href: "/cort-vendor/vehicles" },
          { key: "drivers", label: "Drivers", value: counts?.drivers ?? "—", href: "/cort-vendor/drivers" },
          { key: "routes", label: "Active routes", value: counts?.active_routes ?? "—", hint: clients.length ? `${clients.length} client${clients.length > 1 ? "s" : ""}` : undefined, href: "/cort-vendor/routes" },
          {
            key: "trips",
            label: "Trips today",
            value: summary ? `${done} / ${counts?.trips_today ?? 0}` : "—",
            hint: summary ? `completed · ${liveTrips.length} live${notStarted ? ` · ${notStarted} not started` : ""}` : undefined,
            status: notStarted ? "warning" : "none",
            href: "/cort-vendor/trips",
          },
        ]}
      />

      {/* The map (and the Google Maps script) only loads while a trip is live, to save Maps API requests. */}
      {liveTrips.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden">
            {/* Fills the card so it matches the side column's height; 340px floor when stacked. */}
            <div className="relative h-full min-h-[340px]">
              <Map
                markers={markers}
                fitTo={fitTo}
                autoFit={false}
                viewKey={fitTo?.length ?? 0}
                height="100%"
                onMarkerClick={(id) => id.startsWith("trip-") && router.push(`/cort-vendor/trips/${id.slice(5)}`)}
              />
              <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-card/95 px-3 py-1.5 text-xs font-medium text-fg shadow-sm">
                <Radio size={14} className={isConnected ? "text-success-ink" : "text-fg-muted"} aria-hidden="true" />
                {isConnected ? `${liveTrips.length} on the road · live` : "Connecting…"}
              </div>
            </div>
          </Card>
          <div className="flex flex-col gap-5">
            {shiftCard}
            {roadCard}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {shiftCard}
          {roadCard}
        </div>
      )}

      <Card>
        <CardHeader
          title="Today's trips"
          actions={
            <Link href="/cort-vendor/trips" className="text-sm font-medium text-brand-ink hover:underline">
              Trip history
            </Link>
          }
        >
          <Tabs value={shift} onValueChange={(v) => setShift(v as ShuttleDirection)} className="mt-3">
            <TabsList>
              <TabsTrigger value="MORNING" count={byShift.MORNING.length}>
                Morning
              </TabsTrigger>
              <TabsTrigger value="EVENING" count={byShift.EVENING.length}>
                Evening
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <DataTable
          caption={`${shift === "MORNING" ? "Morning" : "Evening"} trips today`}
          columns={columns}
          rows={byShift[shift]}
          rowKey={(t) => t.id}
          loading={loading && !summary}
          onRowClick={(t) => router.push(`/cort-vendor/trips/${t.id}`)}
          empty={{ title: `No ${shift === "MORNING" ? "morning" : "evening"} trips today` }}
        />
      </Card>
    </div>
  );
}

function ShiftProgress({ label, icon, trips, hour }: { label: string; icon: React.ReactNode; trips: CortVendorDayTrip[]; hour: number }) {
  const total = trips.length;
  const parts = [
    { key: "done", n: trips.filter((t) => t.status === "COMPLETED").length, cls: "bg-success", text: "completed" },
    { key: "live", n: trips.filter((t) => isLiveStatus(t.status)).length, cls: "bg-brand", text: "live" },
    { key: "missed", n: trips.filter((t) => displayStatus(t, hour) === "NOT_STARTED").length, cls: "bg-warning", text: "not started" },
  ];
  const upcoming = total - parts.reduce((s, p) => s + p.n, 0);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-fg">
          <span className="text-fg-muted">{icon}</span>
          {label}
        </span>
        <span className="tabular-nums text-fg-muted">
          {parts[0].n}/{total} done
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-subtle" role="img" aria-label={`${label}: ${parts.map((p) => `${p.n} ${p.text}`).join(", ")}, ${upcoming} upcoming`}>
        {total > 0 && parts.map((p) => p.n > 0 && <span key={p.key} className={cn("h-full", p.cls)} style={{ width: `${(p.n / total) * 100}%` }} />)}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {parts.filter((p) => p.n > 0).map((p) => (
          <Badge key={p.key} size="sm" tone={p.key === "done" ? "success" : p.key === "live" ? "brand" : "warning"}>
            {p.n} {p.text}
          </Badge>
        ))}
        {upcoming > 0 && (
          <Badge size="sm" tone="neutral">
            {upcoming} upcoming
          </Badge>
        )}
      </div>
    </div>
  );
}
