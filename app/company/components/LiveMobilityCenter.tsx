'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Users, Clock, RefreshCw, MapPin, X } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Badge, buttonVariants, CardDescription, CardTitle, focusRingInset, IconButton, Skeleton, StatusBadge } from '../../admin/ui';
import { useCompanyLocale } from '../lib/locale-context';
import { useCompanyBasePath } from '../lib/use-company-base-path';
import { formatLocaleTime } from '../../lib/i18n/format';
import { apiClient } from '../../lib/services/api-client';
import { useAppSelector } from '../../lib/store/hooks';
import { selectDashboardStats } from '../../lib/store/slices/dashboardSlice';
import { useCompanyAccess } from '../lib/access-context';
import { useLiveMobilityTracking } from '../../lib/hooks/useLiveMobilityTracking';
import { useOverviewFormat } from './overview/format';
import type { MapMarker } from '../../admin/ui/Map';

/** Initial map viewport before any trip reports a position. Never used as a vehicle position. */
const DEFAULT_MAP_CENTER: [number, number] = [24.8607, 67.0011];
const POLL_MS = 60_000;
/** Page size of the chauffeur-bookings endpoint; a full page means the count may be truncated. */
const PAGE_LIMIT = 50;

// Dynamic import for Map to avoid SSR issues with the map SDK
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
// Raw facts only; display labels are built at render time so they follow the locale.
interface TripEntry {
    id: number;
    type: 'shuttle' | 'chauffeur';
    /** Route name (shuttle) or passenger name (chauffeur), when the API provides one. */
    name: string | null;
    routeId?: number;
    direction?: 'MORNING' | 'EVENING';
    status: string;
    /** Assigned riders on the route (shuttle only). */
    occupancy: number | null;
    /** Last known REST position (driver's last ping or a stop coordinate). Null when unknown. */
    restLat: number | null;
    restLng: number | null;
    /** Full raw trip object (shuttles only), used for the detail panel. */
    rawTrip?: any;
}

/** Live counts derived from the same poll as the map. Null = that source failed or was truncated. */
interface LiveCounts {
    shuttles: number | null;
    chauffeur: number | null;
}

/** The API returns either a bare array or a paginated envelope. */
function extractList(res: PromiseSettledResult<any>): any[] | null {
    if (res.status !== 'fulfilled' || res.value == null) return null;
    const raw = res.value;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data?.data)) return raw.data.data;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
}

const LiveMobilityCenter = ({ data }: LiveMobilityCenterProps) => {
    const t = useTranslations('company.mobility');
    const tCommon = useTranslations('common');
    const { locale } = useCompanyLocale();
    const f = useOverviewFormat();
    const { companyPath } = useCompanyBasePath();
    const { company, access } = useCompanyAccess();
    const dashboardStats = useAppSelector(selectDashboardStats);

    const [trips, setTrips] = useState<TripEntry[]>([]);
    const [liveCounts, setLiveCounts] = useState<LiveCounts | null>(null);
    const [tripsLoading, setTripsLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    /** Lead shuttle's REST position; null until a shuttle reports one. */
    const [restCenter, setRestCenter] = useState<[number, number] | null>(null);
    const [selectedShuttleTrip, setSelectedShuttleTrip] = useState<any | null>(null);
    const [tripEmployees, setTripEmployees] = useState<any[]>([]);
    const [tripEmployeesLoading, setTripEmployeesLoading] = useState(false);
    const [listOpen, setListOpen] = useState(false);

    const requestSeq = useRef(0);
    const panelHeadingRef = useRef<HTMLHeadingElement>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);

    // ── Service gates ──────────────────────────────────────────────────────────
    const hasShuttle = access.services.shuttle;
    const hasChauffeur = access.services.chauffeur;

    // ── Fetch active trips: shuttles + chauffeur, all requests in parallel ─────
    const fetchActiveTrips = useCallback(async () => {
        const companyId = company?.id;
        if (!companyId) return;

        // No synchronous setState here: callers that need the spinner set it themselves (see `refresh`).
        const seq = ++requestSeq.current;
        try {
            const chauffeurQuery = (status: string) =>
                apiClient.request<any>(`/companies/${companyId}/chauffeur-bookings?status=${status}&limit=${PAGE_LIMIT}`);

            // The dashboard's chauffeur counter uses the same three statuses: OTW, ARRIVED, IN_PROGRESS.
            const [shuttleRes, inProgressRes, otwRes, arrivedRes] = await Promise.allSettled([
                hasShuttle ? apiClient.getTodayShuttleTrips(companyId) : Promise.resolve(null),
                hasChauffeur ? apiClient.getActiveCompanyChauffeurBookings(companyId) : Promise.resolve(null),
                hasChauffeur ? chauffeurQuery('OTW') : Promise.resolve(null),
                hasChauffeur ? chauffeurQuery('ARRIVED') : Promise.resolve(null),
            ]);

            // A newer refresh started while this one was in flight; its result wins.
            if (seq !== requestSeq.current) return;

            const collected: TripEntry[] = [];
            const counts: LiveCounts = { shuttles: null, chauffeur: null };

            // ── Shuttle trips ────────────────────────────────────────────────
            const shuttleList = hasShuttle ? extractList(shuttleRes) : null;
            if (shuttleList) {
                const active = shuttleList.filter((trip: any) => ['STARTED', 'IN_PROGRESS'].includes(trip.status ?? ''));
                counts.shuttles = active.length;
                let centred = false;

                for (const trip of active) {
                    // Prefer the driver's last GPS ping (backend embeds it from Redis) over stop coordinates.
                    const stops: any[] = trip.route_stops_with_coords ?? trip.routes?.route_stops ?? [];
                    let restLat: number | null = trip.last_lat ?? null;
                    let restLng: number | null = trip.last_lng ?? null;

                    if (restLat == null || restLng == null) {
                        const current = stops.find((s: any) => s.id === trip.current_stop_id);
                        const fallback = current?.lat && current?.lng ? current : stops.find((s: any) => s.lat && s.lng);
                        restLat = fallback?.lat ?? null;
                        restLng = fallback?.lng ?? null;
                    }

                    if (!centred && restLat !== null && restLng !== null) {
                        const lat = restLat;
                        const lng = restLng;
                        setRestCenter((prev) => (prev && prev[0] === lat && prev[1] === lng ? prev : [lat, lng]));
                        centred = true;
                    }

                    collected.push({
                        id: trip.id as number,
                        type: 'shuttle',
                        name: trip.routes?.name ?? null,
                        routeId: trip.route_id,
                        direction: trip.direction === 'MORNING' ? 'MORNING' : 'EVENING',
                        status: trip.status,
                        occupancy: trip.routes?._count?.employee_route_assignments ?? null,
                        restLat,
                        restLng,
                        rawTrip: trip,
                    });
                }
            }

            // ── Chauffeur bookings ────────────────────────────────────────────
            if (hasChauffeur) {
                const lists = [inProgressRes, otwRes, arrivedRes].map(extractList);
                const complete = lists.every((l) => l !== null);
                const truncated = lists.some((l) => (l?.length ?? 0) >= PAGE_LIMIT);

                const seen = new Set<number>();
                const bookings = lists.flatMap((l) => l ?? []).filter((b) => {
                    if (seen.has(b.id)) return false;
                    seen.add(b.id);
                    return true;
                });
                // Only trust the count when every status came back and none hit the page limit.
                counts.chauffeur = complete && !truncated ? bookings.length : null;

                for (const booking of bookings) {
                    // pickup_lat/lng come from PostGIS and are usually absent from this endpoint;
                    // the socket hook supplies live coordinates once the driver pings.
                    collected.push({
                        id: booking.id as number,
                        type: 'chauffeur',
                        name: booking.passenger_name ?? booking.users_chauffeur_bookings_passenger_idTousers?.full_name ?? null,
                        status: booking.status,
                        occupancy: null,
                        restLat: booking.pickup_lat ?? null,
                        restLng: booking.pickup_lng ?? null,
                    });
                }
            }

            setTrips(collected);
            setLiveCounts(counts);
            setLastRefreshed(new Date());
        } catch (err) {
            if (seq !== requestSeq.current) return;
            console.error('[LiveMobilityCenter] fetchActiveTrips error', err);
            setTrips([]);
            setLiveCounts(null);
        } finally {
            if (seq === requestSeq.current) setTripsLoading(false);
        }
    }, [company?.id, hasShuttle, hasChauffeur]);

    /** Show the syncing state, then fetch. Used by the refresh button, the poll and tab re-focus. */
    const refresh = useCallback(() => {
        if (!company?.id) return;
        setTripsLoading(true);
        fetchActiveTrips();
    }, [company?.id, fetchActiveTrips]);

    // Poll while the tab is visible; refresh immediately when it becomes visible again.
    useEffect(() => {
        const seqRef = requestSeq;
        let timer: number | undefined;
        const start = () => {
            if (timer === undefined) timer = window.setInterval(refresh, POLL_MS);
        };
        const stop = () => {
            if (timer !== undefined) window.clearInterval(timer);
            timer = undefined;
        };
        const onVisibility = () => {
            if (document.hidden) {
                stop();
            } else {
                refresh();
                start();
            }
        };

        // tripsLoading starts true, so the first load needs no setState here. fetchActiveTrips only
        // sets state after its awaits; the compiler can't see the async boundary.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchActiveTrips();
        if (!document.hidden) start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
            seqRef.current++; // drop any response that lands after unmount
        };
    }, [fetchActiveTrips, refresh]);

    // ── Counters: live where the poll can answer, page-load snapshot otherwise ──
    const snapshot = dashboardStats?.mobility ?? data;
    const shuttlesRunning = liveCounts?.shuttles ?? snapshot.shuttlesRunning;
    const chauffeurRides = liveCounts?.chauffeur ?? snapshot.chauffeurRides;
    const activeRides = (hasShuttle ? shuttlesRunning : 0) + (hasChauffeur ? chauffeurRides : 0);
    const stats = [
        { key: 'active', label: t('activeRidesLabel'), value: liveCounts ? activeRides : snapshot.activeRides, show: true },
        { key: 'traveling', label: t('employeesTravelingLabel'), value: snapshot.employeesTraveling, show: true },
        { key: 'shuttles', label: t('shuttlesRunningLabel'), value: shuttlesRunning, show: hasShuttle },
        { key: 'chauffeur', label: t('chauffeurRidesLabel'), value: chauffeurRides, show: hasChauffeur },
        { key: 'upcoming', label: t('upcomingRidesLabel'), value: snapshot.upcomingBookings, show: true },
    ].filter((s) => s.show);

    // ── Live socket tracking ───────────────────────────────────────────────────
    // Stable reference: only re-create when the set of ids/types/positions changes, not on every
    // poll. The input is rebuilt from the key itself so the memo's dependencies are complete.
    const trackingKey = trips.map((trip) => `${trip.type}|${trip.id}|${trip.restLat ?? ''}|${trip.restLng ?? ''}`).join(',');
    const trackingInput = useMemo(
        () =>
            trackingKey
                ? trackingKey.split(',').map((entry) => {
                      const [type, id, lat, lng] = entry.split('|');
                      return {
                          id: Number(id),
                          type: type as TripEntry['type'],
                          lastLat: lat === '' ? null : Number(lat),
                          lastLng: lng === '' ? null : Number(lng),
                      };
                  })
                : [],
        [trackingKey],
    );
    const { vehicleCoords, isConnected } = useLiveMobilityTracking(trackingInput);

    // ── Labels (locale-aware, no emoji) ────────────────────────────────────────
    const statusLabel = useCallback(
        (status: string) => {
            const key = `tripStatus.${status}`;
            return t.has(key as never) ? t(key as never) : status.replace(/_/g, ' ').toLowerCase();
        },
        [t],
    );

    const tripLabel = useCallback(
        (trip: TripEntry) => {
            const parts =
                trip.type === 'shuttle'
                    ? [
                          trip.name ?? t('routeLabel', { id: trip.routeId ?? trip.id }),
                          trip.direction === 'MORNING' ? t('morning') : t('evening'),
                          statusLabel(trip.status),
                          trip.occupancy !== null ? t('passengerCount', { count: trip.occupancy }) : null,
                      ]
                    : [t('chauffeur'), trip.name ?? t('passenger'), statusLabel(trip.status)];
            return parts.filter(Boolean).join(' · ');
        },
        [t, statusLabel],
    );

    // ── Positions: socket ping first, then REST; never an invented position ───
    const positionOf = useCallback(
        (trip: TripEntry): { lat: number; lng: number; live: boolean; heading?: number } | null => {
            const live = vehicleCoords[String(trip.id)];
            if (live && live.updatedAt > 0 && live.lat !== 0 && live.lng !== 0) {
                return { lat: live.lat, lng: live.lng, live: true, heading: live.heading };
            }
            if (trip.restLat !== null && trip.restLng !== null) return { lat: trip.restLat, lng: trip.restLng, live: false };
            return null;
        },
        [vehicleCoords],
    );

    const markers = useMemo((): MapMarker[] => {
        return trips.flatMap((trip) => {
            const pos = positionOf(trip);
            if (!pos) return [];
            return [{
                id: `${trip.type}-${trip.id}`,
                position: [pos.lat, pos.lng] as [number, number],
                label: tripLabel(trip),
                description: pos.live ? t('positionLive') : t('positionLastKnown'),
                type: trip.type,
                heading: pos.heading,
            }];
        });
    }, [trips, positionOf, tripLabel, t]);

    const unlocatedCount = trips.length - markers.length;

    // Camera: the lead shuttle's REST position when known; otherwise the first live ping, captured
    // once so the camera doesn't chase every socket tick; otherwise the city default.
    // (Map pans only when the centre's values change, and stops once the user drags.)
    const [liveSeed, setLiveSeed] = useState<[number, number] | null>(null);
    if (liveSeed === null) {
        const firstLive = trips.map(positionOf).find((pos) => pos?.live);
        if (firstLive) setLiveSeed([firstLive.lat, firstLive.lng]); // render-time adjustment, runs once
    }
    const mapCenter: [number, number] = restCenter ?? liveSeed ?? DEFAULT_MAP_CENTER;

    const liveCount = useMemo(
        () => Object.values(vehicleCoords).filter((c) => c.updatedAt > 0 && c.lat !== 0).length,
        [vehicleCoords],
    );
    const shuttleCount = trips.filter((trip) => trip.type === 'shuttle').length;
    const chauffeurCount = trips.filter((trip) => trip.type === 'chauffeur').length;

    // ── Shuttle detail panel ───────────────────────────────────────────────────
    const openShuttleDetail = useCallback(async (tripId: number) => {
        const entry = trips.find((trip) => trip.type === 'shuttle' && trip.id === tripId);
        if (!entry) return;
        const active = document.activeElement;
        returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
        setSelectedShuttleTrip(entry.rawTrip ?? { id: tripId, route_id: entry.routeId });
        setTripEmployees([]);
        setTripEmployeesLoading(true);

        try {
            const employees = await apiClient.request<any[]>(`/shuttle-trips/${tripId}/employees`);
            setTripEmployees(Array.isArray(employees) ? employees : []);
        } catch {
            setTripEmployees([]);
        } finally {
            setTripEmployeesLoading(false);
        }
    }, [trips]);

    const closeShuttleDetail = useCallback(() => {
        setSelectedShuttleTrip(null);
        const target = returnFocusRef.current;
        returnFocusRef.current = null;
        if (target?.isConnected) target.focus();
    }, []);

    const handleMarkerClick = useCallback((markerId: string) => {
        const firstDash = markerId.indexOf('-');
        const type = markerId.slice(0, firstDash);
        const tripId = Number(markerId.slice(firstDash + 1));
        if (type === 'shuttle' && !Number.isNaN(tripId)) openShuttleDetail(tripId);
    }, [openShuttleDetail]);

    // Move focus into the panel when it opens so keyboard and screen-reader users land on it.
    const selectedId = selectedShuttleTrip?.id ?? null;
    useEffect(() => {
        if (selectedId !== null) panelHeadingRef.current?.focus();
    }, [selectedId]);

    const routesHref = companyPath('/company/routes');
    const bookingsHref = companyPath('/company/bookings');
    const fmtTime = (d: Date | string) => formatLocaleTime(d, locale, { hour: '2-digit', minute: '2-digit' });

    const statusChip = tripsLoading && !lastRefreshed
        ? t('syncing')
        : liveCount > 0
            ? t('vehiclesLive', { count: liveCount })
            : trips.length > 0
                ? t('tripsTracked', { count: trips.length })
                : t('noActiveTrips');

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <Card className="flex flex-col overflow-hidden p-0 sm:p-0">
            {/* Header */}
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <CardTitle as="h2">{t('title')}</CardTitle>
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
                    <IconButton label={t('refreshTrips')} variant="outline" size="icon-sm" onClick={refresh}>
                        <RefreshCw className={tripsLoading ? 'animate-spin' : ''} />
                    </IconButton>
                </div>
            </div>

            {/* Counters */}
            <div className="overflow-hidden border-t border-line">
                <dl className="-mb-px -me-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                    {stats.map((stat) => (
                        <div key={stat.key} className="min-w-0 border-b border-e border-line px-4 py-3 sm:px-5">
                            <dt className="truncate text-xs text-fg-muted">{stat.label}</dt>
                            <dd className="mt-1 text-xl font-semibold tracking-tight text-fg tabular-nums">{f.num(stat.value)}</dd>
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
                        <span className={cn('size-1.5 shrink-0 rounded-full', liveCount > 0 ? 'bg-success' : trips.length > 0 ? 'bg-brand' : 'bg-fg-muted')} aria-hidden="true" />
                        <span className="truncate">
                            {statusChip}
                            {unlocatedCount > 0 && (
                                <span className="font-normal text-fg-muted"> · {t('awaitingLocation', { count: unlocatedCount })}</span>
                            )}
                        </span>
                    </div>
                </div>

                {/* Legend */}
                {(hasShuttle || hasChauffeur) && (
                    <ul className={cn('pointer-events-none absolute bottom-3 end-3 z-[500] flex flex-col gap-1.5 rounded-lg border border-line bg-card/95 px-3 py-2 text-xs text-fg shadow-sm', selectedShuttleTrip && 'hidden sm:flex')}>
                        {hasShuttle && (
                            <li className="flex items-center gap-2">
                                <img src="/bus_birdeye.png" alt="" className="size-4 object-contain" />
                                <span>{t('shuttle')}</span>
                                <span className="ms-auto ps-2 font-medium tabular-nums">{f.num(shuttleCount)}</span>
                            </li>
                        )}
                        {hasChauffeur && (
                            <li className="flex items-center gap-2">
                                <img src="/car_birdeye.png" alt="" className="size-4 object-contain" />
                                <span>{t('chauffeur')}</span>
                                <span className="ms-auto ps-2 font-medium tabular-nums">{f.num(chauffeurCount)}</span>
                            </li>
                        )}
                    </ul>
                )}

                {/* Shuttle detail panel: bottom sheet on mobile, side panel on sm+ */}
                {selectedShuttleTrip && (
                    <div
                        role="dialog"
                        aria-labelledby="live-trip-panel-title"
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.stopPropagation();
                                closeShuttleDetail();
                            }
                        }}
                        className="absolute inset-x-2 bottom-2 top-auto z-[600] flex max-h-[75%] flex-col overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-modal)] sm:inset-x-auto sm:bottom-3 sm:end-3 sm:top-3 sm:max-h-none sm:w-80"
                    >
                        <div className="flex items-start justify-between gap-2 border-b border-line p-4">
                            <div className="min-w-0">
                                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                    <Badge tone="neutral" size="sm">
                                        {selectedShuttleTrip.direction === 'MORNING' ? t('morning') : t('evening')}
                                    </Badge>
                                    {selectedShuttleTrip.status && (
                                        <StatusBadge status={selectedShuttleTrip.status} label={statusLabel(selectedShuttleTrip.status)} size="sm" />
                                    )}
                                </div>
                                <h3
                                    id="live-trip-panel-title"
                                    ref={panelHeadingRef}
                                    tabIndex={-1}
                                    className="truncate text-sm font-semibold text-fg outline-none"
                                >
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
                            <IconButton label={tCommon('actions.close')} tooltip={false} size="icon-xs" onClick={closeShuttleDetail}>
                                <X />
                            </IconButton>
                        </div>

                        {(() => {
                            const stops: any[] = selectedShuttleTrip.routes?.route_stops ?? [];
                            const currentStop = stops.find((s: any) => s.id === selectedShuttleTrip.current_stop_id);
                            const assigned = selectedShuttleTrip.routes?._count?.employee_route_assignments;
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
                                        <dd className="font-medium text-fg tabular-nums">{assigned != null ? f.num(assigned) : '—'}</dd>
                                    </div>
                                </dl>
                            );
                        })()}

                        <div className="flex-1 overflow-y-auto">
                            <p className="px-4 pb-1 pt-3 text-xs font-medium text-fg-muted">{t('assignedEmployees')}</p>
                            {tripEmployeesLoading ? (
                                <ul className="space-y-2 p-3" aria-busy="true">
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
                                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-medium text-fg-secondary" aria-hidden="true">
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

            {/* Trip list: the keyboard and screen-reader path to every trip, including ones not yet on the map */}
            {trips.length > 0 && (
                <div className="border-t border-line">
                    <button
                        type="button"
                        aria-expanded={listOpen}
                        aria-controls="live-trip-list"
                        onClick={() => setListOpen((v) => !v)}
                        className={cn('flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm font-medium text-fg transition-colors hover:bg-row-hover sm:px-5', focusRingInset)}
                    >
                        <span>{t('activeTrips', { count: f.num(trips.length) })}</span>
                        <ChevronDown className={cn('size-4 shrink-0 text-fg-muted transition-transform', listOpen && 'rotate-180')} aria-hidden="true" />
                    </button>
                    {listOpen && (
                        <ul id="live-trip-list" className="divide-y divide-line border-t border-line">
                            {trips.map((trip) => {
                                const pos = positionOf(trip);
                                const where = pos ? (pos.live ? t('positionLive') : t('positionLastKnown')) : t('positionWaiting');
                                const body = (
                                    <>
                                        <img src={trip.type === 'shuttle' ? '/bus_birdeye.png' : '/car_birdeye.png'} alt="" className="mt-0.5 size-4 shrink-0 object-contain" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm text-fg">{tripLabel(trip)}</span>
                                            <span className="block text-xs text-fg-muted">{where}</span>
                                        </span>
                                    </>
                                );
                                return (
                                    <li key={`${trip.type}-${trip.id}`}>
                                        {trip.type === 'shuttle' ? (
                                            <button
                                                type="button"
                                                onClick={() => openShuttleDetail(trip.id)}
                                                className={cn('flex w-full items-start gap-3 px-4 py-2.5 text-start transition-colors hover:bg-row-hover sm:px-5', focusRingInset)}
                                            >
                                                {body}
                                                <span className="mt-0.5 shrink-0 text-xs font-medium text-brand-ink">{t('tripDetails')}</span>
                                            </button>
                                        ) : (
                                            <div className="flex items-start gap-3 px-4 py-2.5 sm:px-5">{body}</div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </Card>
    );
};

export default LiveMobilityCenter;
