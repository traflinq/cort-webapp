'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Car, RotateCcw, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, CardSkeleton, ErrorState, Field, Select, StatusBadge } from '@/app/admin/ui';
import { apiClient } from '@/app/lib/services/api-client';
import { useAppDispatch, useAppSelector } from '@/app/lib/store/hooks';
import { fetchAdminDrivers, selectAdminDrivers } from '@/app/lib/store/slices/adminDriversSlice';
import { fetchAdminVehicles, selectAdminVehicles } from '@/app/lib/store/slices/adminVehiclesSlice';
import { DriverType } from '@/app/lib/services/types/drivers';
import { PlanEmptyState } from './PlanEmptyState';
import {
    initials,
    tripVehicle,
    tripVehicleId,
    vehicleLabel,
    TRIP_STATUS_OVERRIDES,
    useLoader,
    type PendingCrewChange,
    type ScheduledTripRow,
} from './plan-types';

export function CrewAssignmentsPanel({
    companyId,
    date,
    direction,
    canMutate,
    pendingCrew,
    saving,
    reloadKey,
    onQueueChange,
    onClearTrip,
}: {
    companyId: number;
    date: string;
    direction: 'MORNING' | 'EVENING';
    canMutate: boolean;
    pendingCrew: globalThis.Map<number, PendingCrewChange>;
    saving: boolean;
    reloadKey: number;
    onQueueChange: (tripId: number, change: PendingCrewChange) => void;
    onClearTrip: (tripId: number) => void;
}) {
    const dispatch = useAppDispatch();
    const drivers = useAppSelector(selectAdminDrivers);
    const vehicles = useAppSelector(selectAdminVehicles);

    const [trips, setTrips] = useState<ScheduledTripRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchAdminDrivers({ limit: 200, driver_type: DriverType.SHUTTLE }));
        dispatch(fetchAdminVehicles({ limit: 200 }));
    }, [dispatch]);

    const loadTrips = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                on_date: date,
                direction,
                company_id: String(companyId),
                limit: '200',
            });
            const res = await apiClient.request<{ data?: ScheduledTripRow[] }>(`/shuttle-trips/scheduled?${params.toString()}`);
            setTrips(Array.isArray(res) ? res : res?.data ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load today's trips");
            setTrips([]);
        } finally {
            setLoading(false);
        }
        // reloadKey intentionally re-runs the load after a crew save
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId, date, direction, reloadKey]);

    useLoader(loadTrips);

    const companyDrivers = useMemo(() => {
        const forCompany = drivers.filter((d) => d.company_id == null || d.company_id === companyId);
        return forCompany.length > 0 ? forCompany : drivers;
    }, [drivers, companyId]);

    const companyVehicles = useMemo(() => {
        const forCompany = vehicles.filter((v) => v.owner_company_id == null || v.owner_company_id === companyId);
        return forCompany.length > 0 ? forCompany : vehicles;
    }, [vehicles, companyId]);

    const driverName = (id: string | null | undefined) => {
        if (!id) return null;
        return companyDrivers.find((d) => d.id === id)?.full_name
            ?? trips.find((t) => t.users?.id === id)?.users?.full_name
            ?? trips.find((t) => t.routes?.users?.id === id)?.routes?.users?.full_name
            ?? null;
    };

    const vehicleName = (id: number | null | undefined) => {
        if (id == null) return null;
        const fromList = companyVehicles.find((v) => v.id === id);
        if (fromList) return vehicleLabel(fromList);
        const fromTrip = trips.map((t) => t.vehicles ?? t.routes?.vehicles).find((v) => v?.id === id);
        return fromTrip ? vehicleLabel(fromTrip) : null;
    };

    const applyDraft = (trip: ScheduledTripRow, patch: { driver_id?: string; vehicle_id?: number }) => {
        if (!canMutate || saving) return;
        const savedDriver = trip.driver_id ?? trip.users?.id ?? '';
        const savedVehicle = tripVehicleId(trip);
        const prev = pendingCrew.get(trip.id);
        const nextDriver = patch.driver_id !== undefined
            ? patch.driver_id
            : (prev?.restore ? savedDriver : (prev?.driver_id ?? savedDriver));
        const nextVehicle = patch.vehicle_id !== undefined
            ? patch.vehicle_id
            : (prev?.restore ? savedVehicle : (prev?.vehicle_id ?? savedVehicle));
        if (nextDriver === savedDriver && nextVehicle === savedVehicle) {
            onClearTrip(trip.id);
            return;
        }
        onQueueChange(trip.id, {
            tripId: trip.id,
            ...(nextDriver !== savedDriver ? { driver_id: nextDriver } : {}),
            ...(nextVehicle !== savedVehicle && nextVehicle != null ? { vehicle_id: nextVehicle } : {}),
        });
    };

    const queueRestore = (trip: ScheduledTripRow) => {
        if (!canMutate || saving) return;
        const pending = pendingCrew.get(trip.id);
        if (pending) {
            onClearTrip(trip.id);
            return;
        }
        if (!trip.shuttle_trip_resource_overrides) return;
        onQueueChange(trip.id, { tripId: trip.id, restore: true });
    };

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading trips">
                {[0, 1, 2].map((i) => (
                    <CardSkeleton key={i} lines={4} className="h-64" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <Card>
                <ErrorState title="Could not load today's trips" message={error} onRetry={() => void loadTrips()} />
            </Card>
        );
    }

    if (trips.length === 0) {
        return (
            <PlanEmptyState
                title="No trips generated for this day yet"
                description={`Generate the ${direction === 'MORNING' ? 'morning' : 'evening'} trips first, then come back to swap the driver or vehicle. Passenger moves on the other tab still work without this.`}
                action={
                    <Button asChild>
                        <Link href="/admin/routes/shuttle-trips">Open trip scheduling</Link>
                    </Button>
                }
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-fg-muted">
                    {trips.length} {trips.length === 1 ? 'trip' : 'trips'} · changes save when you press Save — this {direction === 'MORNING' ? 'morning' : 'evening'} only
                </span>
                <Badge tone="brand" dot>Temporary — different from the usual crew</Badge>
                <Badge tone="info" variant="outline" dot className="border-dashed">Pending — not saved</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {trips.map((trip) => {
                    const savedDriverId = trip.driver_id ?? trip.users?.id ?? '';
                    const savedVehicleId = tripVehicleId(trip);
                    const pending = pendingCrew.get(trip.id);
                    const isTemp = trip.shuttle_trip_resource_overrides != null;
                    const locked = trip.status === 'COMPLETED' || trip.status === 'CANCELLED';
                    const usualDriverId = trip.shuttle_trip_resource_overrides?.from_driver_id
                        ?? trip.routes?.assigned_driver_id
                        ?? trip.routes?.users?.id
                        ?? null;
                    const usualVehicleId = trip.shuttle_trip_resource_overrides?.from_vehicle_id
                        ?? trip.routes?.assigned_vehicle_id
                        ?? trip.routes?.vehicles?.id
                        ?? null;
                    const currentDriverId = pending?.restore ? (usualDriverId ?? '') : (pending?.driver_id ?? savedDriverId);
                    const currentVehicleId = pending?.restore ? (usualVehicleId ?? null) : (pending?.vehicle_id ?? savedVehicleId);
                    const vehicle = currentVehicleId != null
                        ? (companyVehicles.find((v) => v.id === currentVehicleId) ?? tripVehicle(trip) ?? trip.routes?.vehicles ?? null)
                        : tripVehicle(trip);
                    const usualDriverLabel = driverName(usualDriverId) ?? 'Usual driver';
                    const usualVehicleLabel = vehicleName(usualVehicleId) ?? 'Usual vehicle';
                    const currentDriverLabel = driverName(currentDriverId) ?? trip.users?.full_name ?? 'Select driver';
                    const driverOptions = currentDriverId && !companyDrivers.some((d) => d.id === currentDriverId)
                        ? [{ id: currentDriverId, full_name: currentDriverLabel }, ...companyDrivers]
                        : companyDrivers;
                    const vehicleOptions = currentVehicleId && !companyVehicles.some((v) => v.id === currentVehicleId)
                        ? [{ id: currentVehicleId, plate_number: vehicle?.plate_number ?? `#${currentVehicleId}`, make: vehicle?.make, model: vehicle?.model }, ...companyVehicles]
                        : companyVehicles;
                    const routeName = trip.routes?.name ?? `Route ${trip.id}`;

                    return (
                        <Card
                            key={trip.id}
                            className={cn(
                                'flex overflow-hidden',
                                pending ? 'border-dashed border-info-line' : isTemp ? 'border-brand-line' : undefined,
                            )}
                        >
                            <div aria-hidden="true" className={cn('w-1.5 shrink-0', pending ? 'bg-info' : isTemp ? 'bg-brand' : 'bg-line-strong')} />
                            <div className="flex-1 space-y-4 p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="font-semibold text-fg">{routeName}</h3>
                                        <div className="mt-1.5">
                                            <StatusBadge status={trip.status} overrides={TRIP_STATUS_OVERRIDES} size="sm" />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-1">
                                        {pending && <Badge tone="info" size="sm" dot>Pending</Badge>}
                                        {isTemp && !pending?.restore && <Badge tone="brand" size="sm" dot>Temporary</Badge>}
                                    </div>
                                </div>

                                {(isTemp || pending) && (
                                    <p
                                        role="status"
                                        className={cn(
                                            'rounded-lg border px-3 py-2 text-xs',
                                            pending ? 'border-info-line bg-info-soft text-info-ink' : 'border-brand-line bg-brand-soft text-brand-ink',
                                        )}
                                    >
                                        {pending?.restore
                                            ? `Will restore ${usualDriverLabel} · ${usualVehicleLabel}`
                                            : pending
                                                ? 'Not saved yet — press Save changes'
                                                : `Usually ${usualDriverLabel} · ${usualVehicleLabel}`}
                                    </p>
                                )}

                                <div className="space-y-3">
                                    <Field label={<span className="inline-flex items-center gap-1.5"><User className="size-3.5" aria-hidden="true" /> Driver today</span>}>
                                        <div className="flex items-center gap-2">
                                            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold text-fg">
                                                {initials(currentDriverLabel)}
                                            </span>
                                            <Select
                                                disabled={!canMutate || locked || saving}
                                                value={currentDriverId}
                                                placeholder="Select driver"
                                                onChange={(e) => {
                                                    const next = e.target.value;
                                                    if (!next) return;
                                                    applyDraft(trip, { driver_id: next });
                                                }}
                                            >
                                                {driverOptions.map((d) => (
                                                    <option key={d.id} value={d.id}>{d.full_name}</option>
                                                ))}
                                            </Select>
                                        </div>
                                    </Field>

                                    <Field label={<span className="inline-flex items-center gap-1.5"><Car className="size-3.5" aria-hidden="true" /> Vehicle today</span>}>
                                        <Select
                                            disabled={!canMutate || locked || saving}
                                            value={currentVehicleId != null ? String(currentVehicleId) : ''}
                                            placeholder="Select vehicle"
                                            onChange={(e) => {
                                                const next = e.target.value ? Number(e.target.value) : null;
                                                if (next == null) return;
                                                applyDraft(trip, { vehicle_id: next });
                                            }}
                                        >
                                            {vehicleOptions.map((v) => (
                                                <option key={v.id} value={v.id}>{vehicleLabel(v)}</option>
                                            ))}
                                        </Select>
                                    </Field>
                                </div>

                                {canMutate && !locked && pending && (
                                    <Button variant="outline" size="sm" className="w-full" disabled={saving} onClick={() => onClearTrip(trip.id)} leftIcon={<RotateCcw />}>
                                        Undo this trip
                                    </Button>
                                )}
                                {canMutate && !locked && isTemp && !pending && (
                                    <Button variant="outline" size="sm" className="w-full" disabled={saving} onClick={() => queueRestore(trip)} leftIcon={<RotateCcw />}>
                                        Restore usual driver &amp; vehicle
                                    </Button>
                                )}
                                {locked && <p className="text-xs text-fg-muted">This trip is finished — assignments can&apos;t be changed.</p>}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
