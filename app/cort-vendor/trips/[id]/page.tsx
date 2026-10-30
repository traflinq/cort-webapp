"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Radio } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  DataTable,
  ErrorState,
  PageHeader,
  PageSkeleton,
  StatStrip,
  StatusBadge,
  type DataTableColumn,
} from "../../../admin/ui";
import type { MapMarker, MapPolyline } from "../../../admin/ui/Map";
import { formatDate, formatTime, humanize } from "../../../admin/lib/format";
import { apiClient } from "../../../lib/services/api-client";
import { useShuttleTracking } from "../../../lib/hooks/useShuttleTracking";
import type { CortVendorRouteStop, CortVendorTripDetail, CortVendorTripEmployee, Polyline } from "../../../lib/services/types/cort-vendor";
import { useLoad } from "../../components/useLoad";
import { decodePolyline, isLiveStatus, vehicleLabel } from "../../lib";

const Map = dynamic(() => import("../../../admin/ui/Map"), { ssr: false });

type StopLog = CortVendorTripDetail["shuttle_trip_stop_logs"][number];

const minutesBetween = (a?: string | null, b?: string | null) =>
  a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : null;

export default function CortVendorTripDetailPage() {
  const params = useParams<{ id: string }>();
  const tripId = Number(params.id);
  const { data: trip, loading, error, reload } = useLoad(() => apiClient.getCortVendorTrip(tripId), [tripId]);
  const [planned, setPlanned] = useState<Polyline | null>(null);
  const [stops, setStops] = useState<CortVendorRouteStop[]>([]);

  useEffect(() => {
    apiClient.getCortVendorTripPolyline(tripId).then(setPlanned).catch(() => setPlanned(null));
  }, [tripId]);

  const routeId = trip?.routes?.id;
  useEffect(() => {
    if (!routeId) return;
    // Stop coordinates come from the route; if the route itself is not in scope the map just shows the paths.
    apiClient
      .getCortVendorRoute(routeId)
      .then((r) => setStops(r.route_stops))
      .catch(() => setStops([]));
  }, [routeId]);

  const live = isLiveStatus(trip?.status);
  const { driverCoord, isConnected } = useShuttleTracking({
    tripId: live ? tripId : null,
    initialLat: trip?.last_location?.lat ?? null,
    initialLng: trip?.last_location?.lng ?? null,
  });

  const markers = useMemo<MapMarker[]>(() => {
    if (!trip) return [];
    const evening = trip.direction === "EVENING";
    const seq = (s: CortVendorRouteStop) => (evening ? s.evening_sequence : s.morning_sequence);
    const visited = new Set(trip.shuttle_trip_stop_logs.map((l) => l.route_stops.id));
    const list: MapMarker[] = stops
      .filter((s) => seq(s) != null && s.lat != null && s.lng != null)
      .sort((a, b) => (seq(a) ?? 0) - (seq(b) ?? 0))
      .map((s, i) => ({
        id: `stop-${s.id}`,
        position: [s.lat!, s.lng!] as [number, number],
        label: `${i + 1}. ${s.name}`,
        color: s.stop_type === "OFFICE" ? "#f47f00" : visited.has(s.id) ? "#16a34a" : "#6366f1",
      }));
    const coord = driverCoord ?? (live ? trip.last_location : null);
    if (coord?.lat && coord?.lng) {
      list.push({
        id: "vehicle",
        type: "shuttle",
        position: [coord.lat, coord.lng],
        heading: (coord as { heading?: number }).heading,
        label: trip.vehicles?.plate_number ?? "Vehicle",
      });
    }
    return list;
  }, [trip, stops, driverCoord, live]);

  const polylines = useMemo<MapPolyline[]>(() => {
    const lines: MapPolyline[] = [];
    if (planned?.points.length) {
      lines.push({ positions: planned.points.map((p) => [p.lat, p.lng] as [number, number]), color: "#6366f1", weight: 4, opacity: 0.5, dashArray: "8 8" });
    }
    const actual = decodePolyline(trip?.actual_path_polyline);
    if (actual.length > 1) lines.push({ positions: actual, color: "#f47f00", weight: 4, opacity: 0.9 });
    return lines;
  }, [planned, trip]);

  if (loading && !trip) return <PageSkeleton />;
  if (error || !trip) return <ErrorState message={error ?? "Trip not found"} onRetry={reload} />;

  const m = trip.shuttle_trip_metrics;
  const duration = m?.actual_duration_min != null ? Math.round(Number(m.actual_duration_min)) : minutesBetween(trip.started_at, trip.completed_at);
  const distance = m?.actual_distance_km ?? trip.total_distance_km;
  const boarded = trip.employees.filter((e) => e.boarding?.status === "BOARDED" || e.boarding?.status === "DROPPED_OFF").length;

  const stopColumns: DataTableColumn<StopLog>[] = [
    { key: "stop", header: "Stop", cell: (l) => <span className="font-medium text-fg">{l.route_stops.name}</span> },
    { key: "arrived", header: "Arrived", cell: (l) => formatTime(l.arrived_at) },
    { key: "departed", header: "Departed", cell: (l) => (l.departed_at ? formatTime(l.departed_at) : "—") },
    {
      key: "wait",
      header: "Wait",
      align: "right",
      cell: (l) => {
        const min = minutesBetween(l.arrived_at, l.departed_at);
        return min != null ? `${min} min` : "—";
      },
    },
  ];

  const employeeColumns: DataTableColumn<CortVendorTripEmployee>[] = [
    { key: "name", header: "Employee", cell: (e) => <span className="font-medium text-fg">{e.users?.full_name ?? "—"}</span> },
    { key: "phone", header: "Phone", mono: true, hideBelow: "md", cell: (e) => e.users?.phone ?? "—" },
    { key: "stop", header: "Stop", cell: (e) => e.route_stops?.name ?? "—" },
    {
      key: "status",
      header: "Attendance",
      cell: (e) => (e.boarding?.status ? <StatusBadge status={e.boarding.status} size="sm" /> : <span className="text-fg-muted">Not marked</span>),
    },
    { key: "scanned", header: "Boarded at", hideBelow: "lg", cell: (e) => (e.boarding?.scanned_at ? formatTime(e.boarding.scanned_at) : "—") },
    { key: "dropped", header: "Dropped at", hideBelow: "lg", cell: (e) => (e.boarding?.drop_off_at ? formatTime(e.boarding.drop_off_at) : "—") },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/cort-vendor/trips", label: "Trips" }}
        title={trip.routes?.name ?? `Trip #${trip.id}`}
        description={`${trip.routes?.companies?.name ?? ""}${trip.routes?.companies ? " · " : ""}${formatDate(trip.trip_date)}`}
        meta={
          <>
            <StatusBadge status={trip.direction} dot={false} size="sm" />
            <StatusBadge status={trip.status} size="sm" />
            {live && (
              <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                <Radio size={14} className={isConnected ? "text-success-ink" : undefined} aria-hidden="true" />
                {isConnected ? "Live" : "Connecting…"}
              </span>
            )}
          </>
        }
        actions={
          trip.routes ? (
            <Link href={`/cort-vendor/routes/${trip.routes.id}`} className="text-sm font-medium text-brand-ink hover:underline">
              View route
            </Link>
          ) : undefined
        }
      />

      <StatStrip
        aria-label="Trip summary"
        items={[
          { key: "vehicle", label: "Vehicle", value: trip.vehicles?.plate_number ?? "—", hint: vehicleLabel(trip.vehicles) },
          { key: "driver", label: "Driver", value: trip.users?.full_name ?? "—", hint: trip.users?.phone ?? undefined },
          {
            key: "time",
            label: "Start – End",
            value: trip.started_at ? `${formatTime(trip.started_at)} – ${trip.completed_at ? formatTime(trip.completed_at) : "…"}` : "Not started",
            hint: duration != null ? `${duration} min` : undefined,
          },
          {
            key: "distance",
            label: "Distance",
            value: distance != null ? `${Number(distance).toFixed(1)} km` : "—",
            hint: m?.planned_distance_km != null ? `Planned ${Number(m.planned_distance_km).toFixed(1)} km` : undefined,
          },
        ]}
      />

      <Card>
        <CardHeader
          title="Map"
          description={
            <span className="inline-flex flex-wrap items-center gap-3">
              <Legend color="#6366f1" dashed label="Planned route" />
              <Legend color="#f47f00" label="Driven path" />
              <Legend color="#16a34a" dot label="Stop reached" />
            </span>
          }
        />
        <CardContent>
          <Map markers={markers} polylines={polylines} height="480px" autoFit followCenter={live && !!driverCoord} />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Stop timeline" description={`${trip.shuttle_trip_stop_logs.length} stops reached`} />
          <DataTable
            columns={stopColumns}
            rows={trip.shuttle_trip_stop_logs}
            rowKey={(l) => `${l.route_stops.id}-${l.arrived_at}`}
            density="compact"
            empty={{ title: "No stops reached yet" }}
          />
        </Card>
        <Card>
          <CardHeader
            title="Passengers"
            description={`${boarded} of ${trip.employees.length} boarded${trip.current_stop_status ? ` · ${humanize(trip.current_stop_status)}` : ""}`}
          />
          <DataTable
            columns={employeeColumns}
            rows={trip.employees}
            rowKey={(e) => e.user_id}
            density="compact"
            empty={{ title: "No passengers on this trip" }}
          />
        </Card>
      </div>
    </div>
  );
}

function Legend({ color, label, dashed, dot }: { color: string; label: string; dashed?: boolean; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {dot ? (
        <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      ) : (
        <span className="h-0 w-5 border-t-[3px]" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
