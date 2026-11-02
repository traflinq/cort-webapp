'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bus, MapPin, Navigation, RefreshCw, Radio, ChevronLeft, X } from 'lucide-react';
import { PillButton } from '@/app/company/ui';
import { PageHeader, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS } from '@/app/company/components/PageLayout';
import { Card } from '@/app/company/components/DashboardComponents';
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
                color: s.id === selectedTrip?.current_stop_id ? '#f06a22' : '#1c1b4d',
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
                color: '#1c1b4d',
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
                    color: '#f06a22',
                    weight: 6,
                    opacity: 1,
                });
            }
        } else {
            // If no driver yet, show the full line as solid orange or navy
            lines.push({
                positions: allPoints,
                color: '#f06a22',
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

    return (
        <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
            <PageHeader
                label={tRoutes('shuttleOperations')}
                title={selectedTrip?.routes?.name || t('liveRouteStatus')}
                description={t('description')}
                action={
                    <div className="flex items-center gap-3">
                        <PillButton variant="outline" onClick={() => router.back()}>
                            <ChevronLeft className="w-4 h-4 rtl-flip" />
                            {tCommon('actions.back')}
                        </PillButton>
                        <PillButton
                            variant="secondary"
                            onClick={loadTrips}
                            disabled={loading}
                            icon={<RefreshCw className={loading ? 'animate-spin' : ''} />}
                        >
                            {t('refreshData')}
                        </PillButton>
                    </div>
                }
            />

            <div className="flex flex-col lg:flex-row gap-6 min-h-[700px]">
                {/* Left Sidebar - Structured Selection & Info */}
                <aside className="w-full lg:w-96 shrink-0 flex flex-col gap-6 dashboard-section">
                    <Card className={`overflow-hidden !p-0 ${TABLE_CARD_CLASS}`}>
                        <div className={TABLE_TOP_BAR_CLASS}>
                            <h2 className="text-xl font-medium text-[var(--text-primary)] mb-4">{t('todaysSchedule')}</h2>
                            <div className="space-y-3 overflow-y-auto max-h-[40vh] pe-1 custom-scrollbar">
                                {trips.length === 0 && !loading && (
                                    <div className="p-8 text-center border border-dashed border-[var(--border-strong)] rounded-[20px]">
                                        <Bus className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-40" />
                                        <p className="text-xs text-[var(--text-muted)]">{t('noTripsToday')}</p>
                                    </div>
                                )}

                                {trips.map((trip, idx) => (
                                    <button
                                        key={trip.id}
                                        type="button"
                                        onClick={() => setSelectedTripId(trip.id)}
                                        className={`
 w-full text-start rounded-[20px] transition-colors
 p-4
 ${selectedTripId === trip.id
 ? 'bg-[var(--cort-navy)] text-white'
 : 'bg-[var(--tile-bg)] text-[var(--text-primary)] hover:bg-[var(--row-hover)]'
 }
 `}
                                        style={{ animationDelay: `${(idx + 1) * 80}ms` }}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`
 w-10 h-10 rounded-full flex items-center justify-center transition-colors
 ${selectedTripId === trip.id ? 'bg-white/15' : 'bg-[var(--bg-card)]'}
 `}
                                                >
                                                    <Bus
                                                        className={`w-4 h-4 ${selectedTripId === trip.id ? 'text-white' : 'text-[var(--cort-orange)]'}`}
                                                    />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm tracking-tight">
                                                        {t('directionTrip', { direction: trip.direction })}
                                                    </p>
                                                    <p className={`text-xs mt-0.5 ${selectedTripId === trip.id ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
                                                        {trip.routes?.vehicles?.plate_number ?? t('noVehicle')}
                                                    </p>
                                                </div>
                                            </div>
                                            <span
                                                className={`
 text-[11px] font-medium px-2.5 py-1 rounded-full
 ${selectedTripId === trip.id ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] text-[var(--text-primary)]'}
 `}
                                            >
                                                {trip.status}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Active Trip Details - Sidebar Section */}
                        <div className="p-5 space-y-6">
                            {selectedTrip ? (
                                <>
                                    <div>
                                        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4">{t('liveTelemetry')}</h2>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 rounded-[18px] bg-[var(--tile-bg)]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-[var(--bg-card)] flex items-center justify-center">
                                                        <Navigation className="w-4 h-4 text-[var(--cort-orange)]" />
                                                    </div>
                                                    <span className="text-sm font-medium text-[var(--text-primary)]">{t('tripStatus')}</span>
                                                </div>
                                                <span className="text-sm font-medium text-[var(--cort-orange)]">{selectedTrip.status}</span>
                                            </div>

                                            <div className="flex items-center justify-between p-3 rounded-[18px] bg-[var(--tile-bg)]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-[var(--bg-card)] flex items-center justify-center">
                                                        <Radio className={`w-4 h-4 ${isConnected ? 'text-[var(--tone-success-ink)]' : 'text-[var(--tone-info-ink)]'}`} />
                                                    </div>
                                                    <span className="text-sm font-medium text-[var(--text-primary)]">{t('connection')}</span>
                                                </div>
                                                <span className={`text-xs font-medium ${isConnected ? 'text-[var(--tone-success-ink)]' : 'text-[var(--text-muted)]'}`}>
                                                    {isConnected ? t('highPrecision') : t('awaitingSignals')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4">{t('routeInfo')}</h2>
                                        <div className="p-5 rounded-[20px] bg-[var(--cort-navy)] text-white">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                                                    <MapPin className="w-5 h-5 text-[var(--cort-orange)]" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-white/50">{t('totalStops')}</p>
                                                    <p className="text-lg font-medium">{t('scheduled', { count: selectedTrip.routes?.route_stops?.length || 0 })}</p>
                                                </div>
                                            </div>
                                            <div className="h-px bg-white/15 w-full mb-4" />
                                            <div className="flex items-center justify-between text-[11px] font-medium text-white/70">
                                                <span>{t('platformStatus')}</span>
                                                <span className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-success)] animate-pulse" />
                                                    {t('cloudIntegrated')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="py-8 flex flex-col items-center justify-center text-center grayscale opacity-50">
                                    <MapPin className="w-10 h-10 mb-3 text-[var(--text-muted)]" />
                                    <p className="text-xs font-medium text-[var(--text-muted)]">{t('selectTripTelemetry')}</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </aside>

                {/* Main Content Area - Map Framed in Card */}
                <main className="flex-1 min-h-[500px] lg:min-h-[700px] dashboard-section dashboard-section-delay-1">
                    <Card className={`w-full h-full overflow-hidden flex flex-col relative !p-0 ${TABLE_CARD_CLASS}`}>
                        <div className="flex-1 relative">
                            <Map
                                center={mapCenter}
                                zoom={13}
                                markers={mapMarkers}
                                polylines={mapPolylines}
                                height="100%"
                                className="w-full h-full border-none shadow-none rounded-none"
                            />

                            {/* Map Floating Legend */}
                            {selectedTrip && (
                                <div className="absolute top-4 start-4 z-10">
                                    <div className="bg-[var(--bg-card)] shadow-[var(--shadow-card)] px-4 py-2.5 rounded-full flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 pe-3 border-e border-[var(--divider)] text-xs text-[var(--text-primary)]">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[var(--cort-orange)] animate-pulse" />
                                            {t('liveDriver')}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                            <div className="w-2.5 h-0.5 bg-[var(--cort-navy)]" />
                                            {t('plannedRoute')}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </main>
            </div>

            {/* Error Overlay */}
            {error && (
                <div className="fixed top-20 start-1/2 -translate-x-1/2 z-50">
                    <div className="bg-[var(--bg-card)] text-[var(--tone-danger-ink)] px-6 py-3 rounded-full shadow-[var(--shadow-modal)] flex items-center gap-3 animate-fade-slide-up font-medium text-sm">
                        <X className="w-4 h-4" />
                        {error}
                        <button onClick={() => setError(null)} aria-label="Close" className="ms-4 text-[var(--text-muted)] hover:text-[var(--tone-danger-ink)]">
                            <X className="w-4 h-4 font-medium" />
                        </button>
                    </div>
                </div>
            )}

            {/* Global Loading Overlay */}
            {loading && trips.length === 0 && (
                <div className="fixed inset-0 z-[100] bg-[var(--bg-overlay)] backdrop-blur-[2px] flex items-center justify-center">
                    <div className="bg-[var(--bg-card)] p-8 rounded-[var(--radius-card)] shadow-[var(--shadow-modal)] flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-[var(--cort-navy)] border-t-transparent rounded-full animate-spin" />
                        <p className="text-[var(--text-primary)] font-medium text-sm">{t('inSync')}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
