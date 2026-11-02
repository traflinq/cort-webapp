'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
    Users,
    Calendar,
    AlertTriangle,
    Navigation,
    Clock,
    RefreshCw,
    Radio,
    MapPin,
    X,
    Maximize2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Card } from './DashboardComponents';
import { apiClient } from '../../lib/services/api-client';
import { useAppSelector } from '../../lib/store/hooks';
import { selectDashboardStats } from '../../lib/store/slices/dashboardSlice';
import { selectCompany } from '../../lib/store/slices/companySlice';
import { useLiveMobilityTracking } from '../../lib/hooks/useLiveMobilityTracking';
import type { MapMarker } from '../../admin/ui/Map';
import { Dialog, DialogContent } from '../../admin/ui/Dialog';
import { IconCircleButton, Illustration, PillButton, StatTile } from '../ui';

/** Initial map viewport before the first fetch resolves. */
const DEFAULT_MAP_CENTER: [number, number] = [24.8607, 67.0011];

// Dynamic import for Map to avoid SSR issues with Leaflet
function MapLoading() {
    const t = useTranslations('company.mobility');
    return (
        <div className="w-full h-full bg-[var(--surface-muted)] animate-pulse flex items-center justify-center rounded-2xl">
            <span className="text-[var(--text-muted)] text-sm font-medium">{t('initializingMap')}</span>
        </div>
    );
}

const Map = dynamic(() => import('../../admin/ui/Map'), {
    ssr: false,
    loading: () => <MapLoading />,
});

interface LiveMobilityCenterProps {
    /** "compact": dashboard map card that expands into the full command center. */
    variant?: 'full' | 'compact';
    data: {
        activeRides: number;
        employeesTraveling: number;
        shuttlesRunning: number;
        chauffeurRides: number;
        upcomingBookings: number;
    };
}

// ── Internal trip registry ────────────────────────────────────────────────────
interface TripEntry {
    id: number;
    type: 'shuttle' | 'chauffeur';
    label: string;
    /** Last known REST position (stop coord / pickup coord) */
    restLat: number | null;
    restLng: number | null;
    /** Full raw trip object — shuttles only, used for the click detail panel */
    rawTrip?: any;
}

const LiveMobilityCenter = ({ data, variant = 'full' }: LiveMobilityCenterProps) => {
    const t = useTranslations('company.mobility');
    const tDashboard = useTranslations('company.dashboard');
    const router = useRouter();
    const company = useAppSelector(selectCompany);
    const dashboardStats = useAppSelector(selectDashboardStats);

    const [currentTime, setCurrentTime] = useState(new Date());
    const [trips, setTrips] = useState<TripEntry[]>([]);
    const [tripsLoading, setTripsLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [defaultCenter, setDefaultCenter] = useState<[number, number]>(DEFAULT_MAP_CENTER);
    const [selectedShuttleTrip, setSelectedShuttleTrip] = useState<any | null>(null);
    const [tripEmployees, setTripEmployees] = useState<any[]>([]);
    const [tripEmployeesLoading, setTripEmployeesLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    // Clock tick
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // ── Service gates ──────────────────────────────────────────────────────────
    const hasShuttle = company?.services_enabled?.shuttle_enabled ?? false;
    const hasChauffeur = company?.services_enabled?.chauffeur_enabled ?? false;
    const showShuttle = hasShuttle;
    const showChauffeur = hasChauffeur;

    // ── Real counters from mobility block ──────────────────────────────────────
    const mobility = dashboardStats?.mobility ?? data;
    const stats = [
        { label: t('activeRidesLabel'), value: mobility.activeRides, icon: <Navigation size={20} />, show: true },
        { label: t('employeesTravelingLabel'), value: mobility.employeesTraveling, icon: <Users size={20} />, show: true },
        { label: t('shuttlesRunningLabel'), value: mobility.shuttlesRunning, icon: <img src="/bus_birdeye.png" alt="" className="w-5 h-5 object-contain" />, show: showShuttle },
        { label: t('chauffeurRidesLabel'), value: mobility.chauffeurRides, icon: <img src="/car_birdeye.png" alt="" className="w-5 h-5 object-contain" />, show: showChauffeur },
        { label: t('upcomingRidesLabel'), value: mobility.upcomingBookings, icon: <Calendar size={20} />, show: true },
    ].filter(s => s.show);

    // ── Fetch active trip IDs: shuttles + chauffeur ────────────────────────────
    const fetchActiveTrips = useCallback(async () => {
        const companyId = company?.id;
        if (!companyId) return;

        setTripsLoading(true);
        try {
            const [shuttleResp, chauffeurResp] = await Promise.allSettled([
                hasShuttle
                    ? apiClient.getTodayShuttleTrips(companyId)
                    : Promise.resolve(null),
                hasChauffeur
                    ? apiClient.getActiveCompanyChauffeurBookings(companyId)
                    : Promise.resolve(null),
            ]);

            const collected: TripEntry[] = [];

            // ── Shuttle trips ────────────────────────────────────────────────
            if (hasShuttle && shuttleResp.status === 'fulfilled' && shuttleResp.value !== null) {
                const raw = shuttleResp.value;
                // The today endpoint returns a plain array directly
                const list: any[] = Array.isArray(raw)
                    ? raw
                    : Array.isArray(raw?.data?.data)
                        ? raw.data.data
                        : Array.isArray(raw?.data)
                            ? raw.data
                            : [];
                const active = list.filter((t: any) =>
                    ['STARTED', 'IN_PROGRESS'].includes(t.status ?? ''),
                );

                for (const trip of active) {
                    const routeName = trip.routes?.name ?? `Route ${trip.route_id}`;
                    const direction = trip.direction === 'MORNING' ? '↑ AM' : '↓ PM';
                    const occupancy = trip.routes?._count?.employee_route_assignments ?? null;
                    const occupancyStr = occupancy !== null ? ` · ${occupancy} emp` : '';

                    // Prefer the driver's real last-known GPS position (embedded by the backend
                    // from Redis shuttle:last_coord) over a stop's coordinates — a stop location
                    // is only a rough placeholder, whereas last_lat/last_lng is where the driver
                    // actually was as of their last ping.
                    const stops: any[] = trip.route_stops_with_coords ?? trip.routes?.route_stops ?? [];
                    let restLat: number | null = trip.last_lat ?? null;
                    let restLng: number | null = trip.last_lng ?? null;

                    if (restLat == null || restLng == null) {
                        const current = stops.find((s: any) => s.id === trip.current_stop_id);
                        if (current?.lat && current?.lng) {
                            restLat = current.lat;
                            restLng = current.lng;
                        } else {
                            const first = stops.find((s: any) => s.lat && s.lng);
                            if (first) { restLat = first.lat; restLng = first.lng; }
                        }
                    }

                    if (collected.length === 0 && restLat !== null && restLng !== null) {
                        setDefaultCenter([restLat, restLng]);
                    }

                    collected.push({
                        id: trip.id as number,
                        type: 'shuttle',
                        label: `${routeName} ${direction} — ${trip.status}${occupancyStr}`,
                        restLat,
                        restLng,
                        rawTrip: trip,
                    });
                }
            }

            // ── Chauffeur bookings ────────────────────────────────────────────
            // Fetch OTW + ARRIVED + IN_PROGRESS in parallel — these are the same
            // three statuses the dashboard activeRides counter uses.
            if (hasChauffeur && chauffeurResp.status === 'fulfilled' && chauffeurResp.value !== null) {
                const [otw, arrived] = await Promise.allSettled([
                    apiClient.request<any>(`/companies/${companyId}/chauffeur-bookings?status=OTW&limit=50`),
                    apiClient.request<any>(`/companies/${companyId}/chauffeur-bookings?status=ARRIVED&limit=50`),
                ]);

                const extractList = (res: PromiseSettledResult<any>): any[] => {
                    if (res.status !== 'fulfilled') return [];
                    const raw = res.value;
                    return Array.isArray(raw)
                        ? raw
                        : Array.isArray(raw?.data?.data)
                            ? raw.data.data
                            : Array.isArray(raw?.data)
                                ? raw.data
                                : [];
                };

                // IN_PROGRESS was already fetched via chauffeurResp
                const inProgressRaw = chauffeurResp.value;
                const inProgressList: any[] = Array.isArray(inProgressRaw)
                    ? inProgressRaw
                    : Array.isArray(inProgressRaw?.data?.data)
                        ? inProgressRaw.data.data
                        : Array.isArray(inProgressRaw?.data)
                            ? inProgressRaw.data
                            : [];

                const allBookings = [...extractList(otw), ...extractList(arrived), ...inProgressList];
                // Deduplicate by id
                const seen = new Set<number>();
                const list = allBookings.filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true; });

                for (const booking of list) {
                    const passengerName =
                        booking.passenger_name ??
                        booking.users_chauffeur_bookings_passenger_idTousers?.full_name ??
                        'Passenger';

                    // pickup_lat/lng come from PostGIS and are NOT returned by the standard
                    // Prisma endpoint — they will be null here. The socket tracking hook
                    // (useLiveMobilityTracking) will supply live coordinates once the driver
                    // emits a location update; the marker uses defaultCenter as a temporary
                    // placeholder until the first socket update arrives.
                    collected.push({
                        id: booking.id as number,
                        type: 'chauffeur',
                        label: `Chauffeur · ${passengerName} — ${booking.status}`,
                        restLat: booking.pickup_lat ?? null,
                        restLng: booking.pickup_lng ?? null,
                    });
                }
            }

            setTrips(collected);
            setLastRefreshed(new Date());
        } catch (err) {
            console.error('[LiveMobilityCenter] fetchActiveTrips error', err);
            setTrips([]);
        } finally {
            setTripsLoading(false);
        }
    }, [company?.id, hasShuttle, hasChauffeur]);

    useEffect(() => {
        fetchActiveTrips();
        const interval = setInterval(fetchActiveTrips, 60_000);
        return () => clearInterval(interval);
    }, [fetchActiveTrips]);

    // ── Live socket tracking ───────────────────────────────────────────────────
    // Stable reference: only re-create when the set of ids/types changes.
    const trackingInput = useMemo(
        () => trips
            .map((t) => ({ id: t.id, type: t.type, lastLat: t.restLat, lastLng: t.restLng })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [trips.map((t) => `${t.type}:${t.id}:${t.restLat ?? ''}:${t.restLng ?? ''}`).join(',')],
    );
    const { vehicleCoords, isConnected } = useLiveMobilityTracking(trackingInput);

    // ── Build map markers: socket coords override REST fallback ───────────────
    // If neither source has coords yet (e.g. chauffeur booking before first socket
    // update, since pickup_lat/lng aren't returned by the Prisma endpoint), fall back
    // to the city default so the marker is visible and snaps to real position once the
    // socket fires its first update.
    const markers = useMemo((): MapMarker[] => {
        return trips.flatMap((trip) => {
            const live = vehicleCoords[String(trip.id)];
            const hasLive = live && live.updatedAt > 0 && live.lat !== 0 && live.lng !== 0;
            const lat = hasLive ? live.lat : (trip.restLat ?? defaultCenter[0]);
            const lng = hasLive ? live.lng : (trip.restLng ?? defaultCenter[1]);
            const isPending = !hasLive && trip.restLat === null;
            return [{
                id: `${trip.type}-${trip.id}`,
                position: [lat, lng] as [number, number],
                label: trip.label + (hasLive ? ' 🔴' : isPending ? ' ⏳' : ''),
                type: trip.type,
                heading: hasLive ? live.heading : undefined,
            }];
        });
    }, [trips, vehicleCoords, defaultCenter]);

    // Keep map camera stable: seed once from first live ping (or REST defaultCenter).
    // Do NOT follow every socket tick — that fights user pan/zoom.
    const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);
    const centerSeededRef = useRef(false);

    useEffect(() => {
        // New fleet / city default → allow a fresh initial frame
        centerSeededRef.current = false;
        setMapCenter(defaultCenter);
    }, [defaultCenter[0], defaultCenter[1]]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (centerSeededRef.current) return;
        for (const trip of trips) {
            const live = vehicleCoords[String(trip.id)];
            if (live && live.updatedAt > 0 && live.lat !== 0) {
                centerSeededRef.current = true;
                setMapCenter([live.lat, live.lng]);
                return;
            }
        }
        // REST/demo default is good enough until a live ping arrives
        if (defaultCenter[0] && defaultCenter[1]) {
            centerSeededRef.current = true;
        }
    }, [vehicleCoords, trips, defaultCenter]);

    const liveCount = useMemo(
        () => Object.values(vehicleCoords).filter((c) => c.updatedAt > 0 && c.lat !== 0).length,
        [vehicleCoords],
    );
    const shuttleCount = trips.filter((t) => t.type === 'shuttle').length;
    const chauffeurCount = trips.filter((t) => t.type === 'chauffeur').length;

    // ── Shuttle marker click: show onboard detail panel ───────────────────────
    const handleMarkerClick = useCallback(async (markerId: string) => {
        const firstDash = markerId.indexOf('-');
        const type = markerId.slice(0, firstDash);
        const tripId = Number(markerId.slice(firstDash + 1));
        if (type !== 'shuttle' || isNaN(tripId)) return;
        const entry = trips.find(t => t.type === 'shuttle' && t.id === tripId);
        if (!entry) return;
        setSelectedShuttleTrip(entry.rawTrip ?? { id: tripId, label: entry.label });
        setTripEmployees([]);
        setTripEmployeesLoading(true);

        try {
            const data = await apiClient.request<any[]>(`/shuttle-trips/${tripId}/employees`);
            setTripEmployees(Array.isArray(data) ? data : []);
        } catch {
            setTripEmployees([]);
        } finally {
            setTripEmployeesLoading(false);
        }
    }, [trips]);

    // ── Service performance ────────────────────────────────────────────────────
    const onTimeRate = useMemo(() => {
        if (!hasChauffeur) return null;
        if (!dashboardStats || dashboardStats.chauffeur.completedThisMonth <= 0) return null;
        return Math.min(100, Math.round(
            ((dashboardStats.chauffeur.completedThisMonth - (dashboardStats.chauffeur.unassignedBookings || 0))
                / dashboardStats.chauffeur.completedThisMonth) * 100,
        ));
    }, [dashboardStats, hasChauffeur]);

    const fleetUtilization = useMemo(() => {
        if (!hasShuttle) return null;
        if (!dashboardStats || dashboardStats.shuttle.totalRoutes === 0) return null;
        return Math.min(100, Math.round((mobility.shuttlesRunning / dashboardStats.shuttle.totalRoutes) * 100));
    }, [dashboardStats, mobility.shuttlesRunning, hasShuttle]);

    // ── Render ─────────────────────────────────────────────────────────────────
    const syncLabel = tripsLoading
        ? t('syncing')
        : liveCount > 0
            ? t('vehiclesLive', { count: liveCount })
            : trips.length > 0
                ? t('tripsTracked', { count: trips.length })
                : t('noActiveTrips');

    const refreshButton = (
        <IconCircleButton label={t('refreshTrips')} variant="outline" size="sm" onClick={fetchActiveTrips}>
            <RefreshCw className={tripsLoading ? 'animate-spin' : ''} strokeWidth={1.6} />
        </IconCircleButton>
    );

    const legend = (
        <div className={`absolute bottom-4 start-4 z-[500] flex flex-col gap-2 rounded-2xl bg-[var(--bg-card)] p-3 shadow-[var(--shadow-card)] pointer-events-none ${selectedShuttleTrip ? 'hidden sm:flex' : ''}`}>
            {showShuttle && (
                <div className="flex items-center gap-2">
                    <img src="/bus_birdeye.png" alt="" className="size-5 object-contain" />
                    <span className="text-xs text-[var(--text-primary)]">
                        {t('shuttle')}{shuttleCount > 0 ? ` (${shuttleCount})` : ''}
                    </span>
                </div>
            )}
            {showChauffeur && (
                <div className="flex items-center gap-2">
                    <img src="/car_birdeye.png" alt="" className="size-4 object-contain" />
                    <span className="text-xs text-[var(--text-primary)]">
                        {t('chauffeur')}{chauffeurCount > 0 ? ` (${chauffeurCount})` : ''}
                    </span>
                </div>
            )}
            {liveCount > 0 && (
                <div className="flex items-center gap-2 border-t border-[var(--divider)] pt-2">
                    <span className="size-2 rounded-full bg-[var(--accent-success)] animate-pulse" />
                    <span className="text-xs text-[var(--tone-success-ink)]">{t('socketLive')}</span>
                </div>
            )}
        </div>
    );

    // Google Maps bills per map load, so the map only mounts while there is something to show,
    // and only one instance (card or expanded view) exists at a time.
    const mapView = (heightClass: string) => (
        <div className={`relative overflow-hidden rounded-[20px] bg-[var(--tile-bg)] ${heightClass}`}>
            {trips.length > 0 ? (
                <Map
                    height="100%"
                    markers={markers}
                    center={mapCenter}
                    zoom={12}
                    className="!rounded-none !border-0 !shadow-none"
                    onMarkerClick={handleMarkerClick}
                />
            ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <Illustration name="map" size={88} />
                    <span className="text-sm text-[var(--text-muted)]">{tripsLoading ? t('syncing') : t('noActiveTrips')}</span>
                </div>
            )}
        </div>
    );

    const shuttlePanel = (
            selectedShuttleTrip && (
                <div className="absolute inset-x-2 bottom-2 top-auto max-h-[75%] sm:inset-x-auto sm:top-3 sm:end-3 sm:bottom-3 sm:w-80 z-[600] flex flex-col bg-[var(--bg-card)] rounded-[20px] shadow-[var(--shadow-modal)] overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-[var(--border-default)]">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
 selectedShuttleTrip.direction === 'MORNING'
 ? 'bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)] border-[var(--tone-warning-line)]'
 : 'bg-[var(--tone-info-soft)] text-[var(--tone-info-ink)] border-[var(--tone-info-line)]'
 }`}>
                                        {selectedShuttleTrip.direction === 'MORNING' ? t('morning') : t('evening')}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--tone-success-soft)] text-[var(--tone-success-ink)] border border-[var(--tone-success-line)]">
                                        {selectedShuttleTrip.status}
                                    </span>
                                </div>
                                <h3 className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                                    {selectedShuttleTrip.routes?.name ?? t('routeLabel', { id: selectedShuttleTrip.route_id })}
                                </h3>
                                {selectedShuttleTrip.routes?.vehicles && (
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">
                                        {[selectedShuttleTrip.routes.vehicles.model, selectedShuttleTrip.routes.vehicles.plate_number].filter(Boolean).join(' · ')}
                                    </p>
                                )}
                                {selectedShuttleTrip.started_at && (
                                    <p className="text-[11px] text-[var(--text-muted)] mt-1 font-medium flex items-center gap-1">
                                        <Clock size={9} />
                                        {t('startedAt', { time: new Date(selectedShuttleTrip.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedShuttleTrip(null)}
                                aria-label="Close"
                                className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--pill-line)] hover:bg-[var(--bg-subtle)] transition-colors flex-shrink-0"
                            >
                                <X size={13} className="text-[var(--text-primary)]" />
                            </button>
                        </div>
                    </div>

                    {/* Current stop */}
                    {(() => {
                        const stops: any[] = selectedShuttleTrip.routes?.route_stops ?? [];
                        const currentStop = stops.find((s: any) => s.id === selectedShuttleTrip.current_stop_id);
                        if (!currentStop) return null;
                        return (
                            <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-[var(--cort-orange)]/10 flex items-center justify-center flex-shrink-0">
                                    <MapPin size={12} className="text-[var(--cort-orange)]" />
                                </div>
                                <div>
                                    <div className="text-[11px] font-medium text-[var(--text-muted)]">{t('currentStop')}</div>
                                    <div className="text-xs font-medium text-[var(--text-primary)]">{currentStop.name}</div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Occupancy */}
                    <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users size={13} className="text-[var(--text-muted)]" />
                            <span className="text-xs font-medium text-[var(--text-muted)]">{t('passengers')}</span>
                        </div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                            {selectedShuttleTrip.routes?._count?.employee_route_assignments ?? '—'}
                        </span>
                    </div>

                    {/* Employee list */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="px-4 py-2.5 bg-[var(--surface-subtle)] border-b border-[var(--border-default)]">
                            <span className="text-[11px] font-medium text-[var(--text-muted)]">
                                {t('assignedEmployees')}
                            </span>
                        </div>
                        <div className="p-3 space-y-2">
                            {tripEmployeesLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--surface-subtle)] animate-pulse">
                                        <div className="w-7 h-7 rounded-full bg-[var(--border-default)]" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-2.5 bg-[var(--border-default)] rounded w-3/4" />
                                            <div className="h-2 bg-[var(--border-default)] rounded w-1/2" />
                                        </div>
                                    </div>
                                ))
                            ) : tripEmployees.length === 0 ? (
                                <div className="py-8 flex flex-col items-center gap-2">
                                    <Users size={20} className="text-[var(--text-muted)] opacity-40" />
                                    <p className="text-xs text-[var(--text-muted)] font-medium">{t('noEmployeesAssigned')}</p>
                                </div>
                            ) : (
                                tripEmployees.map((emp: any, i: number) => (
                                    <div key={emp.id ?? i} className="flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--tile-bg)]">
                                        <div className="w-7 h-7 rounded-full bg-[var(--cort-orange)]/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-medium text-[var(--cort-orange)]">
                                                {(emp.users?.full_name ?? '?').charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                                                {emp.users?.full_name ?? 'Unknown'}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                {emp.route_stops?.name && (
                                                    <span className="text-[11px] text-[var(--text-muted)] font-medium flex items-center gap-0.5">
                                                        <MapPin size={8} />
                                                        {emp.route_stops.name}
                                                    </span>
                                                )}
                                                {emp.users?.department && (
                                                    <span className="text-[11px] text-[var(--text-muted)] truncate">{emp.users.department}</span>
                                                )}
                                            </div>
                                            <div className="mt-0.5">
                                                {(() => {
                                                    const dropOffAt = emp.boarding?.drop_off_at
                                                        ? new Date(emp.boarding.drop_off_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                                                        : emp.droppedOffAt;
                                                    const boardedAt = emp.boarding?.scanned_at
                                                        ? new Date(emp.boarding.scanned_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                                                        : emp.boardedAt;

                                                    if (emp.boarding?.status === 'ABSENT') {
                                                        return <span className="text-[11px] text-[var(--tone-danger-ink)] font-medium">{t('absent')}</span>;
                                                    }
                                                    if (dropOffAt) {
                                                        return (
                                                            <span className="text-[11px] text-[var(--tone-info-ink)] font-medium flex items-center gap-0.5">
                                                                <MapPin size={8} />
                                                                {t('droppedOffAt', { time: dropOffAt })}
                                                            </span>
                                                        );
                                                    }
                                                    if (boardedAt) {
                                                        return (
                                                            <span className="text-[11px] text-[var(--tone-success-ink)] font-medium flex items-center gap-0.5">
                                                                <Clock size={8} />
                                                                {t('boardedAt', { time: boardedAt })}
                                                            </span>
                                                        );
                                                    }
                                                    return <span className="text-[11px] text-[var(--text-muted)] font-medium">{t('notYetBoarded')}</span>;
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )
    );

    const alertRow = (icon: React.ReactNode, title: string, description: string, meta: string | null, onClick?: () => void) => {
        const body = (
            <>
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--cort-orange)] shadow-[var(--shadow-card)]">{icon}</span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-[var(--text-primary)]">{title}</span>
                    <span className="mt-0.5 block text-sm text-[var(--text-muted)]">{description}</span>
                    {meta && <span className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Clock size={12} />{meta}</span>}
                </span>
            </>
        );
        const cls = 'flex w-full items-start gap-3 rounded-[18px] bg-[var(--tile-bg)] p-4 text-start';
        return onClick ? (
            <button type="button" onClick={onClick} className={`${cls} transition-colors hover:bg-[var(--bg-card-hover)]`}>{body}</button>
        ) : (
            <div className={cls}>{body}</div>
        );
    };

    const fullView = (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${isConnected ? 'bg-[var(--tone-success-soft)] text-[var(--tone-success-ink)]' : 'bg-[var(--tile-bg)] text-[var(--text-muted)]'}`}>
                        <Radio size={12} />
                        {isConnected ? t('live') : t('connecting')}
                    </span>
                    <span>{syncLabel}</span>
                    {lastRefreshed && (
                        <span className="inline-flex items-center gap-1"><Clock size={12} />{t('synced', { time: lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })}</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-muted)]">{t('opsTime')}</span>
                    <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
                        {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {refreshButton}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {stats.map((stat) => (
                    <StatTile key={stat.label} value={stat.value} label={stat.label} />
                ))}
            </div>

            <div className="flex flex-col gap-5 lg:flex-row">
                <div className="relative min-w-0 flex-1">
                    {mapView('h-[320px] sm:h-[420px] lg:h-[540px]')}
                    {trips.length > 0 && legend}
                    {shuttlePanel}
                </div>

                <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-medium text-[var(--text-primary)]">{t('activeAlerts')}</h3>
                        {hasChauffeur && (dashboardStats?.chauffeur.unassignedBookings ?? 0) > 0 && (
                            <span className="rounded-full bg-[var(--tone-brand-soft)] px-3 py-1 text-xs text-[var(--tone-brand-ink)]">
                                {t('unassigned', { count: dashboardStats!.chauffeur.unassignedBookings })}
                            </span>
                        )}
                    </div>

                    {hasChauffeur && (dashboardStats?.chauffeur.unassignedBookings ?? 0) > 0 &&
                        alertRow(<AlertTriangle size={18} />, tDashboard('unassignedBookings'), t('unassignedDescription', { count: dashboardStats!.chauffeur.unassignedBookings }), t('needsAttention'), () => router.push('/company/bookings'))}

                    {mobility.upcomingBookings > 0 &&
                        alertRow(<Calendar size={18} />, t('upcomingBookings'), t('upcomingDescription', { count: mobility.upcomingBookings }), t('next7Days'),
                            hasChauffeur ? () => router.push('/company/bookings') : hasShuttle ? () => router.push('/company/routes') : undefined)}

                    {trips.length > 0 &&
                        alertRow(<Navigation size={18} />, t('onTheMap'), [
                            showShuttle && shuttleCount > 0 ? t('onMapShuttle', { count: shuttleCount }) : null,
                            showChauffeur && chauffeurCount > 0 ? t('onMapChauffeur', { count: chauffeurCount }) : null,
                        ].filter(Boolean).join(' · ') + (liveCount > 0 ? ` ${t('onMapLive', { count: liveCount })}` : ''), null)}

                    {(!hasChauffeur || (dashboardStats?.chauffeur.unassignedBookings ?? 0) === 0) &&
                        mobility.upcomingBookings === 0 &&
                        trips.length === 0 && (
                        <div className="rounded-[18px] bg-[var(--tile-bg)] p-4 text-center">
                            <div className="text-[15px] text-[var(--text-primary)]">{t('allClear')}</div>
                            <div className="mt-0.5 text-sm text-[var(--text-muted)]">{t('noActiveAlerts')}</div>
                        </div>
                    )}

                    {hasShuttle && (
                        <PillButton variant="primary" className="w-full" onClick={() => router.push('/company/routes')}>{t('trackRoutesLive')}</PillButton>
                    )}
                    {!hasShuttle && hasChauffeur && (
                        <PillButton variant="primary" className="w-full" onClick={() => router.push('/company/bookings')}>{t('viewBookings')}</PillButton>
                    )}

                    <div className="mt-2 border-t border-[var(--divider)] pt-4">
                        <div className="mb-3 text-sm text-[var(--text-muted)]">{t('servicePerformance')}</div>
                        <div className="space-y-3">
                            {onTimeRate !== null && (
                                <div>
                                    <div className="mb-1.5 flex justify-between text-sm text-[var(--text-primary)]">
                                        <span>{t('onTimeRate')}</span>
                                        <span className="tabular-nums">{onTimeRate}%</span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--tile-bg)]">
                                        <div className="h-full rounded-full bg-[var(--cort-orange)]" style={{ width: `${onTimeRate}%` }} />
                                    </div>
                                </div>
                            )}
                            {fleetUtilization !== null && (
                                <div>
                                    <div className="mb-1.5 flex justify-between text-sm text-[var(--text-primary)]">
                                        <span>{t('shuttleUtilization')}</span>
                                        <span className="tabular-nums">{fleetUtilization}%</span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--tile-bg)]">
                                        <div className="h-full rounded-full bg-[var(--cort-navy)]" style={{ width: `${fleetUtilization}%` }} />
                                    </div>
                                </div>
                            )}
                            {onTimeRate === null && fleetUtilization === null && (
                                <p className="py-1 text-center text-sm text-[var(--text-muted)]">{t('collectingData')}</p>
                            )}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );

    if (variant === 'compact') {
        return (
            <>
                <div className="relative h-full min-h-[320px] overflow-hidden rounded-[var(--radius-card)] bg-[var(--tile-bg)] shadow-[var(--shadow-card)]">
                    {!expanded && trips.length > 0 ? (
                        <div className="absolute inset-0">
                            <Map
                                height="100%"
                                markers={markers}
                                center={mapCenter}
                                zoom={12}
                                className="!rounded-none !border-0 !shadow-none"
                                onMarkerClick={() => setExpanded(true)}
                            />
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                            <Illustration name="map" size={104} />
                            <span className="max-w-[14rem] text-sm text-[var(--text-muted)]">{tripsLoading ? t('syncing') : t('noActiveTrips')}</span>
                        </div>
                    )}

                    {/* Floating label chip ("Current Route 17,4 / 24,6 km") */}
                    <div className="pointer-events-none absolute start-5 top-5 z-[500] rounded-[18px] bg-[var(--bg-card)] px-5 py-3 shadow-[var(--shadow-card)]">
                        <div className="text-lg text-[var(--text-primary)]">{t('liveTrips')}</div>
                        <div className="mt-1 text-[15px] text-[var(--text-muted)] tabular-nums">
                            <span className="text-[var(--text-primary)]">{liveCount}</span> / {trips.length} {t('liveSuffix')}
                        </div>
                    </div>

                    <div className="absolute bottom-5 end-5 z-[500]">
                        <IconCircleButton label={t('expandMap')} variant="navy" size="lg" onClick={() => setExpanded(true)}>
                            <Maximize2 strokeWidth={1.8} />
                        </IconCircleButton>
                    </div>
                </div>

                <Dialog open={expanded} onOpenChange={setExpanded}>
                    <DialogContent size="full" title={t('commandCenter')} description={syncLabel} className="company-dialog rounded-[var(--radius-card)] lg:max-w-[1400px]" flush>
                        <div className="p-4 sm:p-6">{fullView}</div>
                    </DialogContent>
                </Dialog>
            </>
        );
    }

    return <Card className="!p-4 sm:!p-6">{fullView}</Card>;
};

export default LiveMobilityCenter;
