'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Clock, RefreshCw, MapPin, X } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card } from './Card';
import { Badge, buttonVariants, CardDescription, CardTitle, IconButton, Skeleton, StatusBadge } from '../../admin/ui';
import { useCompanyLocale } from '../lib/locale-context';
import { useCompanyBasePath } from '../lib/use-company-base-path';
import { formatLocaleTime } from '../../lib/i18n/format';
import { apiClient } from '../../lib/services/api-client';
import { useAppSelector } from '../../lib/store/hooks';
import { selectDashboardStats } from '../../lib/store/slices/dashboardSlice';
import { useCompanyAccess } from '../lib/access-context';
import { useLiveMobilityTracking } from '../../lib/hooks/useLiveMobilityTracking';
import type { MapMarker } from '../../admin/ui/Map';

/** Initial map viewport before the first fetch resolves. */
const DEFAULT_MAP_CENTER: [number, number] = [24.8607, 67.0011];

// Dynamic import for Map to avoid SSR issues with Leaflet
function MapLoading() {
    const t = useTranslations('company.mobility');
    return (
        <div className="flex h-full w-full items-center justify-center bg-subtle">
            <span className="text-sm text-fg-muted">{t('initializingMap')}</span>
        </div>
    );
}

const Map = dynamic(() => import('../../admin/ui/Map'), {
    ssr: false,
    loading: () => <MapLoading />,
});

interface LiveMobilityCenterProps {
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

const LiveMobilityCenter = ({ data }: LiveMobilityCenterProps) => {
    const t = useTranslations('company.mobility');
    const tDashboard = useTranslations('company.dashboard');
    const tCommon = useTranslations('common');
    const { locale } = useCompanyLocale();
    const { companyPath } = useCompanyBasePath();
    const { company, access } = useCompanyAccess();
    const dashboardStats = useAppSelector(selectDashboardStats);

    const [trips, setTrips] = useState<TripEntry[]>([]);
    const [tripsLoading, setTripsLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [defaultCenter, setDefaultCenter] = useState<[number, number]>(DEFAULT_MAP_CENTER);
    const [selectedShuttleTrip, setSelectedShuttleTrip] = useState<any | null>(null);
    const [tripEmployees, setTripEmployees] = useState<any[]>([]);
    const [tripEmployeesLoading, setTripEmployeesLoading] = useState(false);

    // ── Service gates ──────────────────────────────────────────────────────────
    const hasShuttle = access.services.shuttle;
    const hasChauffeur = access.services.chauffeur;
    const showShuttle = hasShuttle;
    const showChauffeur = hasChauffeur;

    // ── Real counters from mobility block ──────────────────────────────────────
    const mobility = dashboardStats?.mobility ?? data;
    const stats = [
        { label: t('activeRidesLabel'), value: mobility.activeRides, show: true },
        { label: t('employeesTravelingLabel'), value: mobility.employeesTraveling, show: true },
        { label: t('shuttlesRunningLabel'), value: mobility.shuttlesRunning, show: showShuttle },
        { label: t('chauffeurRidesLabel'), value: mobility.chauffeurRides, show: showChauffeur },
        { label: t('upcomingRidesLabel'), value: mobility.upcomingBookings, show: true },
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

    const routesHref = companyPath('/company/routes');
    const bookingsHref = companyPath('/company/bookings');
    const fmtTime = (d: Date | string) =>
        formatLocaleTime(d, locale, { hour: '2-digit', minute: '2-digit' });

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <Card className="flex flex-col p-0 sm:p-0 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{t('title')}</CardTitle>
                        <Badge tone={isConnected ? 'success' : 'neutral'} size="sm" dot>
                            {isConnected ? t('live') : t('connecting')}
                        </Badge>
                    </div>
                    <CardDescription>
                        {tripsLoading
                            ? t('syncing')
                            : lastRefreshed
                                ? t('synced', { time: fmtTime(lastRefreshed) })
                                : t('operationalOverview')}
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    {hasShuttle ? (
                        <Link href={routesHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>{t('trackRoutesLive')}</Link>
                    ) : hasChauffeur ? (
                        <Link href={bookingsHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>{t('viewBookings')}</Link>
                    ) : null}
                    <IconButton label={t('refreshTrips')} variant="outline" size="icon-sm" onClick={fetchActiveTrips}>
                        <RefreshCw className={tripsLoading ? 'animate-spin' : ''} />
                    </IconButton>
                </div>
            </div>

            {/* Counters */}
            <div className="overflow-hidden border-t border-line">
                <dl className="-mb-px -me-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                    {stats.map((stat) => (
                        <div key={stat.label} className="min-w-0 border-b border-e border-line px-4 py-3 sm:px-5">
                            <dt className="truncate text-xs text-fg-muted">{stat.label}</dt>
                            <dd className="mt-1 text-xl font-semibold tracking-tight text-fg tabular-nums">{stat.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            {/* Map */}
            <div className="relative h-[300px] border-t border-line sm:h-[380px] lg:h-[440px]">
                <Map
                    height="100%"
                    markers={markers}
                    center={mapCenter}
                    zoom={12}
                    className="!rounded-none !border-0 !shadow-none"
                    onMarkerClick={handleMarkerClick}
                />

                {/* Map status */}
                <div className="pointer-events-none absolute start-3 top-3 z-[500] max-w-[calc(100%-1.5rem)]">
                    <div className="flex items-center gap-2 rounded-lg border border-line bg-card/95 px-2.5 py-1.5 text-xs font-medium text-fg shadow-sm">
                        <span className={`size-1.5 shrink-0 rounded-full ${liveCount > 0 ? 'bg-success' : trips.length > 0 ? 'bg-brand' : 'bg-fg-muted'}`} aria-hidden="true" />
                        <span className="truncate">
                            {tripsLoading
                                ? t('syncing')
                                : liveCount > 0
                                    ? t('vehiclesLive', { count: liveCount })
                                    : trips.length > 0
                                        ? t('tripsTracked', { count: trips.length })
                                        : t('noActiveTrips')}
                        </span>
                    </div>
                </div>

                {/* Legend */}
                {(showShuttle || showChauffeur) && (
                    <ul className={`pointer-events-none absolute bottom-3 end-3 z-[500] flex flex-col gap-1.5 rounded-lg border border-line bg-card/95 px-3 py-2 text-xs text-fg shadow-sm ${selectedShuttleTrip ? 'hidden sm:flex' : ''}`}>
                        {showShuttle && (
                            <li className="flex items-center gap-2">
                                <img src="/bus_birdeye.png" alt="" className="size-4 object-contain" />
                                <span>{t('shuttle')}</span>
                                <span className="ms-auto ps-2 font-medium tabular-nums">{shuttleCount}</span>
                            </li>
                        )}
                        {showChauffeur && (
                            <li className="flex items-center gap-2">
                                <img src="/car_birdeye.png" alt="" className="size-4 object-contain" />
                                <span>{t('chauffeur')}</span>
                                <span className="ms-auto ps-2 font-medium tabular-nums">{chauffeurCount}</span>
                            </li>
                        )}
                    </ul>
                )}

                {/* Shuttle detail panel — bottom sheet on mobile, side panel on sm+ */}
                {selectedShuttleTrip && (
                    <div
                        role="dialog"
                        aria-label={selectedShuttleTrip.routes?.name ?? t('routeLabel', { id: selectedShuttleTrip.route_id })}
                        className="absolute inset-x-2 bottom-2 top-auto z-[600] flex max-h-[75%] flex-col overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-modal)] sm:inset-x-auto sm:bottom-3 sm:end-3 sm:top-3 sm:max-h-none sm:w-80"
                    >
                        <div className="flex items-start justify-between gap-2 border-b border-line p-4">
                            <div className="min-w-0">
                                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                    <Badge tone="neutral" size="sm">
                                        {selectedShuttleTrip.direction === 'MORNING' ? t('morning') : t('evening')}
                                    </Badge>
                                    {selectedShuttleTrip.status && (
                                        <StatusBadge status={selectedShuttleTrip.status} size="sm" />
                                    )}
                                </div>
                                <h3 className="truncate text-sm font-semibold text-fg">
                                    {selectedShuttleTrip.routes?.name ?? t('routeLabel', { id: selectedShuttleTrip.route_id })}
                                </h3>
                                {selectedShuttleTrip.routes?.vehicles && (
                                    <p className="mt-0.5 truncate text-xs text-fg-muted">
                                        {[selectedShuttleTrip.routes.vehicles.model, selectedShuttleTrip.routes.vehicles.plate_number].filter(Boolean).join(' · ')}
                                    </p>
                                )}
                                {selectedShuttleTrip.started_at && (
                                    <p className="mt-1 flex items-center gap-1 text-xs text-fg-muted">
                                        <Clock className="size-3" aria-hidden="true" />
                                        {t('startedAt', { time: fmtTime(selectedShuttleTrip.started_at) })}
                                    </p>
                                )}
                            </div>
                            <IconButton label={tCommon('actions.close')} tooltip={false} size="icon-xs" onClick={() => setSelectedShuttleTrip(null)}>
                                <X />
                            </IconButton>
                        </div>

                        {(() => {
                            const stops: any[] = selectedShuttleTrip.routes?.route_stops ?? [];
                            const currentStop = stops.find((s: any) => s.id === selectedShuttleTrip.current_stop_id);
                            return (
                                <dl className="divide-y divide-line border-b border-line text-sm">
                                    {currentStop && (
                                        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                                            <dt className="flex items-center gap-1.5 text-fg-muted"><MapPin className="size-3.5" aria-hidden="true" />{t('currentStop')}</dt>
                                            <dd className="truncate font-medium text-fg">{currentStop.name}</dd>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                                        <dt className="flex items-center gap-1.5 text-fg-muted"><Users className="size-3.5" aria-hidden="true" />{t('passengers')}</dt>
                                        <dd className="font-medium text-fg tabular-nums">{selectedShuttleTrip.routes?._count?.employee_route_assignments ?? '—'}</dd>
                                    </div>
                                </dl>
                            );
                        })()}

                        <div className="flex-1 overflow-y-auto">
                            <p className="px-4 pb-1 pt-3 text-xs font-medium text-fg-muted">{t('assignedEmployees')}</p>
                            {tripEmployeesLoading ? (
                                <ul className="space-y-2 p-3">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <li key={i} className="flex items-center gap-3 rounded-lg p-2">
                                            <Skeleton className="size-7 rounded-full" />
                                            <div className="flex-1 space-y-1.5">
                                                <Skeleton className="h-2.5 w-3/4" />
                                                <Skeleton className="h-2 w-1/2" />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : tripEmployees.length === 0 ? (
                                <p className="px-4 py-8 text-center text-xs text-fg-muted">{t('noEmployeesAssigned')}</p>
                            ) : (
                                <ul className="divide-y divide-line">
                                    {tripEmployees.map((emp: any, i: number) => {
                                        const dropOffAt = emp.boarding?.drop_off_at ? fmtTime(emp.boarding.drop_off_at) : emp.droppedOffAt;
                                        const boardedAt = emp.boarding?.scanned_at ? fmtTime(emp.boarding.scanned_at) : emp.boardedAt;
                                        const status = emp.boarding?.status === 'ABSENT'
                                            ? <span className="text-danger-ink">{t('absent')}</span>
                                            : dropOffAt
                                                ? <span className="text-info-ink">{t('droppedOffAt', { time: dropOffAt })}</span>
                                                : boardedAt
                                                    ? <span className="text-success-ink">{t('boardedAt', { time: boardedAt })}</span>
                                                    : <span>{t('notYetBoarded')}</span>;
                                        return (
                                            <li key={emp.id ?? i} className="flex items-start gap-3 px-4 py-2.5">
                                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-medium text-fg-secondary">
                                                    {(emp.users?.full_name ?? '?').charAt(0).toUpperCase()}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-fg">{emp.users?.full_name ?? t('unknownEmployee')}</p>
                                                    <p className="truncate text-xs text-fg-muted">
                                                        {[emp.route_stops?.name, emp.users?.department].filter(Boolean).join(' · ')}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-fg-muted">{status}</p>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default LiveMobilityCenter;
