'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Bus, MapPin, RefreshCw, X } from "@/app/components/icons";
import { cn } from '@/lib/utils';
import {
    Badge,
    Button,
    CardTitle,
    EmptyState,
    IconButton,
    InlineError,
    LoadingBlock,
    PageHeader,
    StatusBadge,
    focusRing,
} from '@/app/admin/ui';
import { Card } from '@/app/company/components/Card';
import { useOverviewFormat } from '@/app/company/components/overview/format';
import { apiClient } from '@/app/lib/services/api-client';
import { useShuttleTracking } from '@/app/lib/hooks/useShuttleTracking';
import type { MapMarker, MapPolyline } from '@/app/admin/ui/Map';

const Map = dynamic(() => import('@/app/admin/ui/Map'), { ssr: false });

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
    direction: 'MORNING' | 'EVENING';
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

// ---- Helpers ---------------------------------------------------------------


// ---- Component -------------------------------------------------------------

export default function CompanyRouteTrackingPage() {
    const params = useParams();
    const router = useRouter();
    const t = useTranslations('company.routes.tracking');
    const tRoutes = useTranslations('company.routes');
    const tCommon = useTranslations('common');
    const tMobility = useTranslations('company.mobility');
    const f = useOverviewFormat();
    const routeId = params.id ? +params.id : null;

    const [trips, setTrips] = useState<ShuttleTrip[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
    const [polyline, setPolyline] = useState<PolylineResponse | null>(null);

    const selectedTrip = useMemo(
        () => trips.find((t) => t.id === selectedTripId) ?? null,
        [trips, selectedTripId],
    );

    const { driverCoord, isConnected } = useShuttleTracking({
        tripId: selectedTripId,
        initialLat: selectedTrip?.last_lat ?? null,
        initialLng: selectedTrip?.last_lng ?? null,
    });

    // ---- Data fetching -------------------------------------------------------

    const loadTrips = useCallback(async () => {
        if (!routeId) return;
        try {
            setLoading(true);
            setError(null);
            const now = new Date();
            const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            // Fetch trips for this specific route for today
            const data = await apiClient.request<ShuttleTrip[]>(`/shuttle-trips/today?date=${date}&route_id=${routeId}`);
            const list = Array.isArray(data) ? data : ((data as unknown) as { data: ShuttleTrip[] }).data ?? [];
            setTrips(list);

            // Select the first trip (usually the active one if available due to backend sorting)
            if (list.length > 0 && !selectedTripId) {
                setSelectedTripId(list[0].id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('failedToLoadTracking'));
        } finally {
            setLoading(false);
        }
    }, [routeId, selectedTripId]);

    const loadPolyline = useCallback(async (tripId: number) => {
        try {
            const data = await apiClient.request<PolylineResponse>(`/shuttle-trips/${tripId}/polyline`);
            setPolyline(data);
        } catch {
            setPolyline(null);
        }
    }, []);

    useEffect(() => {
        loadTrips();
    }, [loadTrips]);

    useEffect(() => {
        if (selectedTripId) {
            setPolyline(null);
            loadPolyline(selectedTripId);
        }
    }, [selectedTripId, loadPolyline]);

    // ---- Map data -------------------------------------------------------

    const stopMarkers: MapMarker[] = useMemo(() => {
        const stops = selectedTrip?.routes?.route_stops ?? [];
        return stops
            .filter((s) => s.lat !== null && s.lng !== null)
            .map((s) => ({
                id: `stop-${s.id}`,
                position: [s.lat!, s.lng!] as [number, number],
                label: `${s.name}${selectedTrip?.direction === 'MORNING' ? (s.morning_eta ? ` · ${s.morning_eta}` : '') : (s.evening_eta ? ` · ${s.evening_eta}` : '')}`,
                color: s.id === selectedTrip?.current_stop_id ? '#e2622a' : '#6e7ff0',
            }));
    }, [selectedTrip]);

    const driverMarker: MapMarker | null = useMemo(() => {
        if (!driverCoord) return null;
        return {
            id: 'driver',
            type: 'shuttle',
            position: [driverCoord.lat, driverCoord.lng],
            heading: driverCoord.heading,
            label: driverCoord.speed !== undefined
                ? t('driverLabel', { speed: `${Math.round((driverCoord.speed ?? 0) * 3.6)} km/h` })
                : t('driverLive'),
        };
    }, [driverCoord]);

    const mapMarkers = useMemo(
        () => [...stopMarkers, ...(driverMarker ? [driverMarker] : [])],
        [stopMarkers, driverMarker],
    );

    const mapPolylines: MapPolyline[] = useMemo(() => {
        if (!polyline?.points?.length) return [];
        const allPoints = polyline.points.map((p) => [p.lat, p.lng] as [number, number]);

        const lines: MapPolyline[] = [
            {
                positions: allPoints,
                color: '#0C225E',
                weight: 4,
                opacity: 0.2,
            }
        ];

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

            // Slice remaining points
            const remainingPoints = allPoints.slice(nearestIdx);

            if (remainingPoints.length >= 2) {
                lines.push({
                    positions: remainingPoints,
                    color: '#e2622a',
                    weight: 6,
                    opacity: 1,
                });
            }
        } else {
            // If no driver yet, show the full line as solid orange or navy
            lines.push({
                positions: allPoints,
                color: '#e2622a',
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 5'
            });
        }

        return lines;
    }, [polyline, driverCoord]);

    const mapCenter = useMemo((): [number, number] => {
        if (driverCoord) return [driverCoord.lat, driverCoord.lng];
        const firstStop = selectedTrip?.routes?.route_stops?.find((s) => s.lat && s.lng);
        if (firstStop) return [firstStop.lat!, firstStop.lng!];
        return [24.8607, 67.0011];
    }, [driverCoord, selectedTrip]);

    // ---- Render ----------------------------------------------------------------

    const directionLabel = (direction: ShuttleTrip['direction']) =>
        direction === 'MORNING' ? tRoutes('morning') : tRoutes('evening');

    // The one animated element on the page: it only appears while the tracking socket is connected.
    const liveIndicator = isConnected ? (
        <Badge tone="success">
            <span className="relative flex size-1.5 shrink-0" aria-hidden="true">
                <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            {tMobility('live')}
        </Badge>
    ) : (
        <Badge tone="neutral" dot>
            {t('awaitingSignals')}
        </Badge>
    );

    const connectionBadge = isConnected ? (
        <Badge tone="success" dot>
            {tMobility('live')}
        </Badge>
    ) : (
        <Badge tone="neutral" dot>
            {t('awaitingSignals')}
        </Badge>
    );

    return (
        <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-6 pb-12">
            <Button
                variant="ghost"
                size="sm"
                className="-ms-2 self-start"
                leftIcon={<ArrowLeft className="rtl:rotate-180" aria-hidden="true" />}
                onClick={() => router.back()}
            >
                {tCommon('actions.back')}
            </Button>

            <PageHeader
                title={selectedTrip?.routes?.name || t('liveRouteStatus')}
                description={t('description')}
                meta={selectedTrip ? liveIndicator : undefined}
                actions={
                    <Button
                        variant="outline"
                        onClick={loadTrips}
                        disabled={loading}
                        leftIcon={<RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />}
                    >
                        {t('refreshData')}
                    </Button>
                }
            />

            {error && (
                <InlineError>
                    <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 break-words">{error}</span>
                        <IconButton
                            label={tCommon('actions.close')}
                            size="icon-xs"
                            tooltip={false}
                            className="-my-1 -me-1 text-danger-ink hover:bg-transparent hover:text-danger-ink"
                            onClick={() => setError(null)}
                        >
                            <X />
                        </IconButton>
                    </div>
                </InlineError>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                {/* Side panel: today's trips and the selected trip */}
                <aside className="flex min-w-0 flex-col gap-4">
                    <Card className="h-auto overflow-hidden !p-0">
                        <div className="border-b border-line px-4 py-3">
                            <CardTitle>{t('todaysSchedule')}</CardTitle>
                        </div>
                        <div className="max-h-[40vh] overflow-y-auto p-2 custom-scrollbar">
                            {loading && trips.length === 0 ? (
                                <LoadingBlock label={tCommon('status.loading')} className="py-10" />
                            ) : trips.length === 0 ? (
                                <EmptyState compact icon={<Bus aria-hidden="true" />} title={t('noTripsToday')} />
                            ) : (
                                <ul className="flex flex-col gap-1">
                                    {trips.map((trip) => {
                                        const selected = selectedTripId === trip.id;
                                        return (
                                            <li key={trip.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedTripId(trip.id)}
                                                    aria-pressed={selected}
                                                    className={cn(
                                                        'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-start transition-colors',
                                                        focusRing,
                                                        selected
                                                            ? 'border-brand-line bg-brand-soft'
                                                            : 'border-transparent hover:bg-row-hover',
                                                    )}
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className={cn(
                                                            'flex size-8 shrink-0 items-center justify-center rounded-lg',
                                                            selected ? 'bg-card text-brand-ink' : 'bg-subtle text-fg-muted',
                                                        )}
                                                    >
                                                        <Bus className="size-4" />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-medium text-fg">
                                                            {t('directionTrip', { direction: directionLabel(trip.direction) })}
                                                        </span>
                                                        <span className="mt-0.5 block truncate text-xs text-fg-muted tabular-nums">
                                                            {trip.routes?.vehicles?.plate_number ?? t('noVehicle')}
                                                        </span>
                                                    </span>
                                                    <StatusBadge status={trip.status} className="shrink-0" />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </Card>

                    <Card className="h-auto">
                        {selectedTrip ? (
                            <>
                                <CardTitle>{t('liveTelemetry')}</CardTitle>
                                <dl className="mt-3 divide-y divide-line border-t border-line">
                                    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                        <dt className="text-fg-muted">{t('tripStatus')}</dt>
                                        <dd><StatusBadge status={selectedTrip.status} /></dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                        <dt className="text-fg-muted">{t('connection')}</dt>
                                        <dd>{connectionBadge}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                        <dt className="text-fg-muted">{tRoutes('vehicle')}</dt>
                                        <dd className="min-w-0 truncate text-end font-medium text-fg tabular-nums">
                                            {selectedTrip.routes?.vehicles?.plate_number ?? t('noVehicle')}
                                        </dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                        <dt className="text-fg-muted">{t('totalStops')}</dt>
                                        <dd className="text-end font-medium text-fg tabular-nums">
                                            {f.num(selectedTrip.routes?.route_stops?.length || 0)}
                                        </dd>
                                    </div>
                                </dl>
                            </>
                        ) : (
                            <EmptyState compact icon={<MapPin aria-hidden="true" />} title={t('selectTripTelemetry')} />
                        )}
                    </Card>
                </aside>

                {/* Map */}
                <main className="min-h-[500px] min-w-0 lg:min-h-[700px]">
                    <Card className="relative flex h-full min-h-[500px] w-full flex-col overflow-hidden !p-0 lg:min-h-[700px]">
                        <div className="relative flex-1">
                            <Map
                                center={mapCenter}
                                zoom={13}
                                markers={mapMarkers}
                                polylines={mapPolylines}
                                height="100%"
                                className="w-full h-full border-none shadow-none rounded-none"
                            />

                            {selectedTrip && (
                                <div className="absolute top-3 start-3 z-10 flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium text-fg-secondary">
                                    <span className="flex items-center gap-1.5">
                                        <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" />
                                        {t('liveDriver')}
                                    </span>
                                    <span aria-hidden="true" className="h-3 w-px bg-line" />
                                    <span className="flex items-center gap-1.5">
                                        <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-fg-muted" />
                                        {t('plannedRoute')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </Card>
                </main>
            </div>
        </div>
    );
}
