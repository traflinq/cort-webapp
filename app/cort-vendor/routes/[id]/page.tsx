"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Tabs,
  TabsList,
  TabsTrigger,
  type DataTableColumn,
} from "../../../admin/ui";
import type { MapMarker, MapPolyline } from "../../../admin/ui/Map";
import { formatDate, formatTime } from "../../../admin/lib/format";
import { apiClient } from "../../../lib/services/api-client";
import type {
  CortVendorRouteAssignment,
  CortVendorRouteStop,
  CortVendorTripRow,
  Polyline,
  ShuttleDirection,
} from "../../../lib/services/types/cort-vendor";
import { useLoad } from "../../components/useLoad";

const Map = dynamic(() => import("../../../admin/ui/Map"), { ssr: false });

export default function CortVendorRouteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const routeId = Number(params.id);
  const [direction, setDirection] = useState<ShuttleDirection>("MORNING");
  const [polylineFor, setPolylineFor] = useState<{ direction: ShuttleDirection; data: Polyline } | null>(null);

  const { data: route, loading, error, reload } = useLoad(() => apiClient.getCortVendorRoute(routeId), [routeId]);
  const { data: recent } = useLoad(() => apiClient.getCortVendorTrips({ route_id: routeId, limit: 10 }), [routeId]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getCortVendorRoutePolyline(routeId, direction)
      .then((data) => !cancelled && setPolylineFor({ direction, data }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [routeId, direction]);
  const polyline = polylineFor?.direction === direction ? polylineFor.data : null;

  const stops = useMemo(() => {
    const seqOf = (s: CortVendorRouteStop) => (direction === "MORNING" ? s.morning_sequence : s.evening_sequence);
    return (route?.route_stops ?? [])
      .filter((s) => seqOf(s) != null)
      .sort((a, b) => (seqOf(a) ?? 0) - (seqOf(b) ?? 0));
  }, [route, direction]);

  const riderCountByStop = useMemo(() => {
    const counts = new globalThis.Map<number, number>();
    route?.employee_route_assignments.forEach((a) => a.pickup_stop_id != null && counts.set(a.pickup_stop_id, (counts.get(a.pickup_stop_id) ?? 0) + 1));
    return counts;
  }, [route]);

  const markers = useMemo<MapMarker[]>(
    () =>
      stops
        .filter((s) => s.lat != null && s.lng != null)
        .map((s, i) => {
          const eta = direction === "MORNING" ? s.morning_eta : s.evening_eta;
          return {
            id: `stop-${s.id}`,
            position: [s.lat!, s.lng!] as [number, number],
            label: `${i + 1}. ${s.name}${eta ? ` · ${formatTime(eta)}` : ""}`,
            color: s.stop_type === "OFFICE" ? "#f47f00" : "#6366f1",
          };
        }),
    [stops, direction],
  );

  const polylines = useMemo<MapPolyline[]>(() => {
    const positions = polyline?.points.length
      ? polyline.points.map((p) => [p.lat, p.lng] as [number, number])
      : markers.map((m) => m.position);
    return positions.length > 1 ? [{ positions, color: "#6366f1", weight: 4, opacity: 0.85 }] : [];
  }, [polyline, markers]);

  if (loading && !route) return <PageSkeleton />;
  if (error || !route) return <ErrorState message={error ?? "Route not found"} onRetry={reload} />;

  const vehicle = direction === "EVENING" && route.evening_vehicle ? route.evening_vehicle : route.vehicles;
  const driver = direction === "EVENING" && route.evening_driver ? route.evening_driver : route.users;

  const stopColumns: DataTableColumn<CortVendorRouteStop>[] = [
    { key: "seq", header: "#", width: "48px", cell: (_s, i) => i + 1 },
    { key: "name", header: "Stop", cell: (s) => <span className="font-medium text-fg">{s.name}</span> },
    { key: "type", header: "Type", cell: (s) => <StatusBadge status={s.stop_type === "OFFICE" ? "OFFICE" : "PICKUP"} dot={false} size="sm" /> },
    { key: "eta", header: "ETA", cell: (s) => formatTime(direction === "MORNING" ? s.morning_eta : s.evening_eta) },
    { key: "riders", header: "Employees", align: "right", cell: (s) => riderCountByStop.get(s.id) ?? (s.stop_type === "OFFICE" ? "—" : 0) },
  ];

  const employeeColumns: DataTableColumn<CortVendorRouteAssignment>[] = [
    { key: "name", header: "Employee", cell: (a) => <span className="font-medium text-fg">{a.users?.full_name ?? "—"}</span> },
    { key: "phone", header: "Phone", mono: true, cell: (a) => a.users?.phone ?? "—" },
    { key: "department", header: "Department", hideBelow: "md", cell: (a) => a.users?.department ?? "—" },
    { key: "stop", header: "Pickup stop", cell: (a) => a.route_stops?.name ?? "—" },
  ];

  const tripColumns: DataTableColumn<CortVendorTripRow>[] = [
    { key: "date", header: "Date", cell: (t) => formatDate(t.trip_date) },
    { key: "direction", header: "Shift", cell: (t) => <StatusBadge status={t.direction} dot={false} size="sm" /> },
    { key: "vehicle", header: "Vehicle", mono: true, cell: (t) => t.vehicles?.plate_number ?? "—" },
    { key: "driver", header: "Driver", hideBelow: "md", cell: (t) => t.users?.full_name ?? "—" },
    { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} size="sm" /> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/cort-vendor/routes", label: "Routes" }}
        title={route.name}
        description={route.companies?.name}
        meta={<StatusBadge status={route.is_active ? "ACTIVE" : "INACTIVE"} size="sm" />}
        tabs={
          <Tabs value={direction} onValueChange={(v) => setDirection(v as ShuttleDirection)}>
            <TabsList>
              <TabsTrigger value="MORNING">Morning</TabsTrigger>
              <TabsTrigger value="EVENING">Evening</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <StatStrip
        aria-label="Route summary"
        items={[
          { key: "vehicle", label: "Vehicle", value: vehicle?.plate_number ?? "—", hint: vehicle ? `${vehicle.make} ${vehicle.model}` : undefined },
          { key: "driver", label: "Driver", value: driver?.full_name ?? "—", hint: driver?.phone ?? undefined },
          { key: "stops", label: "Stops", value: stops.length },
          {
            key: "km",
            label: "Planned",
            value: route.expected_km != null ? `${Number(route.expected_km).toFixed(1)} km` : "—",
            hint: route.expected_duration_min != null ? `${Math.round(Number(route.expected_duration_min))} min` : undefined,
          },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardContent>
            <Map markers={markers} polylines={polylines} height="460px" autoFit viewKey={direction === "MORNING" ? 0 : 1} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Stops" description={direction === "MORNING" ? "Morning pickup order" : "Evening drop-off order"} />
          <DataTable columns={stopColumns} rows={stops} rowKey={(s) => s.id} density="compact" empty={{ title: "No stops for this shift" }} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Employees" description={`${route.employee_route_assignments.length} assigned to this route`} />
        <DataTable
          columns={employeeColumns}
          rows={route.employee_route_assignments}
          rowKey={(a) => a.user_id}
          empty={{ title: "No employees assigned" }}
        />
      </Card>

      <Card>
        <CardHeader title="Recent trips" />
        <DataTable
          columns={tripColumns}
          rows={recent?.data ?? []}
          rowKey={(t) => t.id}
          onRowClick={(t) => router.push(`/cort-vendor/trips/${t.id}`)}
          empty={{ title: "No trips yet" }}
        />
      </Card>
    </div>
  );
}
