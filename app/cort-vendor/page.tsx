"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bus, Car, Map as MapIcon, Radio, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  DataTable,
  ErrorState,
  KpiCard,
  KpiGrid,
  PageHeader,
  RefreshButton,
  StatusBadge,
  type DataTableColumn,
} from "../admin/ui";
import type { MapMarker } from "../admin/ui/Map";
import { formatTime } from "../admin/lib/format";
import { apiClient } from "../lib/services/api-client";
import { useLiveMobilityTracking } from "../lib/hooks/useLiveMobilityTracking";
import type { CortVendorDayTrip, CortVendorSummary } from "../lib/services/types/cort-vendor";
import { errorMessage, isLiveStatus, todayISO } from "./lib";

const Map = dynamic(() => import("../admin/ui/Map"), { ssr: false });

const REFRESH_MS = 60_000;

export default function CortVendorDashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<CortVendorSummary | null>(null);
  const [trips, setTrips] = useState<CortVendorDayTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const date = todayISO();
    Promise.all([apiClient.getCortVendorSummary(date), apiClient.getCortVendorDayTrips(date)])
      .then(([s, t]) => {
        if (cancelled) return;
        setSummary(s);
        setTrips(t);
        setError(null);
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

  const liveTrips = useMemo(() => trips.filter((t) => isLiveStatus(t.status)), [trips]);
  const { vehicleCoords, isConnected } = useLiveMobilityTracking(
    liveTrips.map((t) => ({ id: t.id, type: "shuttle" as const, lastLat: t.last_lat, lastLng: t.last_lng })),
  );

  const markers = useMemo<MapMarker[]>(
    () =>
      liveTrips.flatMap((t) => {
        const c = vehicleCoords[String(t.id)];
        const lat = c?.lat || t.last_lat;
        const lng = c?.lng || t.last_lng;
        if (!lat || !lng) return [];
        return [
          {
            id: `trip-${t.id}`,
            type: "shuttle",
            position: [lat, lng] as [number, number],
            heading: c?.heading,
            label: `${t.vehicles?.plate_number ?? "Vehicle"} · ${t.routes?.name ?? ""}`,
            description: t.users?.full_name ?? undefined,
          },
        ];
      }),
    [liveTrips, vehicleCoords],
  );

  const byStatus = summary?.trips_today_by_status ?? {};
  const liveCount = (byStatus.STARTED ?? 0) + (byStatus.IN_PROGRESS ?? 0);

  const columns: DataTableColumn<CortVendorDayTrip>[] = [
    { key: "route", header: "Route", cell: (t) => <span className="font-medium text-fg">{t.routes?.name ?? "—"}</span> },
    { key: "direction", header: "Shift", cell: (t) => <StatusBadge status={t.direction} dot={false} size="sm" /> },
    { key: "vehicle", header: "Vehicle", mono: true, cell: (t) => t.vehicles?.plate_number ?? "—" },
    { key: "driver", header: "Driver", hideBelow: "md", cell: (t) => t.users?.full_name ?? "—" },
    {
      key: "time",
      header: "Started / Completed",
      hideBelow: "lg",
      cell: (t) => (t.started_at ? `${formatTime(t.started_at)}${t.completed_at ? ` – ${formatTime(t.completed_at)}` : ""}` : "—"),
    },
    { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} size="sm" /> },
  ];

  if (error && !summary) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={summary?.vendor?.name ?? "Dashboard"}
        description="Your vehicles, drivers and today's trips across all clients Cort serves with your fleet."
        actions={<RefreshButton label="Refresh dashboard" onClick={refresh} />}
      />

      <KpiGrid cols={4}>
        <KpiCard label="Vehicles" value={summary?.counts.vehicles ?? "—"} icon={<Car size={16} />} href="/cort-vendor/vehicles" loading={loading} />
        <KpiCard label="Drivers" value={summary?.counts.drivers ?? "—"} icon={<Users size={16} />} href="/cort-vendor/drivers" loading={loading} />
        <KpiCard label="Active routes" value={summary?.counts.active_routes ?? "—"} icon={<MapIcon size={16} />} href="/cort-vendor/routes" loading={loading} />
        <KpiCard
          label="Trips today"
          value={summary?.counts.trips_today ?? "—"}
          hint={`${liveCount} live · ${byStatus.COMPLETED ?? 0} completed · ${byStatus.SCHEDULED ?? 0} scheduled`}
          icon={<Bus size={16} />}
          tone="brand"
          href="/cort-vendor/trips"
          loading={loading}
        />
      </KpiGrid>

      <Card>
        <CardHeader
          title="Live vehicles"
          actions={
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
              <Radio size={14} className={isConnected ? "text-success-ink" : "text-fg-muted"} aria-hidden="true" />
              {liveTrips.length === 0 ? "No trips running right now" : isConnected ? `${liveTrips.length} on the road · live` : "Connecting…"}
            </span>
          }
        />
        <CardContent>
          <Map markers={markers} height="420px" autoFit center={[31.5204, 74.3587]} zoom={6} onMarkerClick={(id) => router.push(`/cort-vendor/trips/${id.replace("trip-", "")}`)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Today's trips"
          actions={
            <Link href="/cort-vendor/trips" className="text-sm font-medium text-brand-ink hover:underline">
              Trip history
            </Link>
          }
        />
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            rows={trips}
            rowKey={(t) => t.id}
            loading={loading}
            onRowClick={(t) => router.push(`/cort-vendor/trips/${t.id}`)}
            empty={{ title: "No trips today", description: "Trips appear here once they are scheduled for your vehicles." }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
