'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Ban, Bus, Pencil, RefreshCw, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionGate } from '@/app/admin/components/PermissionGate';
import { AdminCan } from '@/app/lib/abilities/AdminAbilityProvider';
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    DataTable,
    Dialog,
    DialogContent,
    Field,
    FilterBar,
    FilterField,
    FormGrid,
    Input,
    PageHeader,
    Select,
    StatusBadge,
    type DataTableColumn,
    type RowKey,
} from '@/app/admin/ui';
import { apiClient } from '@/app/lib/services/api-client';
import { useAuth } from '@/app/lib/contexts/auth-context';
import { useConfirm } from '@/app/lib/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '@/app/lib/store/hooks';
import {
    fetchAdminCompanies,
    selectAdminCompanies,
    selectAdminCompaniesStatus,
} from '@/app/lib/store/slices/adminCompaniesSlice';
import { fetchAdminDrivers, selectAdminDrivers } from '@/app/lib/store/slices/adminDriversSlice';
import { fetchAdminVehicles, selectAdminVehicles } from '@/app/lib/store/slices/adminVehiclesSlice';
import { DriverType } from '@/app/lib/services/types/drivers';
import {
    businessTodayYmd,
    formatTripDate,
    tripVehicle,
    tripVehicleId,
    TRIP_STATUS_OVERRIDES,
    useLoader,
    type ScheduledTripRow,
} from '../daily-overrides/plan-types';

type GenerationRoute = {
    id: number;
    name: string;
    company_id: number | null;
    companies: { id: number; name: string } | null;
};

type Paginated<T> = {
    data: T[];
    pagination: { page: number; limit: number; total: number; pages: number; hasNext: boolean; hasPrev: boolean };
};

const PAGE_SIZE = 50;

function canEditAssignment(status: string): boolean {
    return status === 'SCHEDULED' || status === 'STARTED' || status === 'IN_PROGRESS';
}

function canChangeStatus(status: string): boolean {
    return status === 'SCHEDULED' || status === 'STARTED' || status === 'IN_PROGRESS' || status === 'CANCELLED';
}

function statusSelectOptions(status: string): Array<'SCHEDULED' | 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'> {
    if (status === 'CANCELLED') return ['CANCELLED', 'SCHEDULED'];
    if (status === 'SCHEDULED') return ['SCHEDULED', 'CANCELLED'];
    if (status === 'STARTED') return ['STARTED', 'CANCELLED'];
    if (status === 'IN_PROGRESS') return ['IN_PROGRESS', 'CANCELLED'];
    return [status as 'COMPLETED'];
}

const STATUS_LABEL: Record<string, string> = {
    SCHEDULED: 'Scheduled',
    STARTED: 'Started',
    IN_PROGRESS: 'In progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
};

export default function ShuttleTripsSchedulingPage() {
    return (
        <PermissionGate permission="ops_shuttle">
            <AdminCan I="read" a="OpsShuttle">
                <ShuttleTripsSchedulingContent />
            </AdminCan>
        </PermissionGate>
    );
}

function ShuttleTripsSchedulingContent() {
    const dispatch = useAppDispatch();
    const confirm = useConfirm();
    const { hasCrud } = useAuth();
    const canMutate = hasCrud('ops_shuttle', 'update');
    const companies = useAppSelector(selectAdminCompanies);
    const companiesStatus = useAppSelector(selectAdminCompaniesStatus);
    const drivers = useAppSelector(selectAdminDrivers);
    const vehicles = useAppSelector(selectAdminVehicles);

    const [generationRoutes, setGenerationRoutes] = useState<GenerationRoute[]>([]);
    const [fromDate, setFromDate] = useState(businessTodayYmd);
    const [filterCompanyId, setFilterCompanyId] = useState<number | ''>('');
    const [filterRouteId, setFilterRouteId] = useState<number | ''>('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [page, setPage] = useState(1);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [rows, setRows] = useState<ScheduledTripRow[]>([]);
    const [pagination, setPagination] = useState<Paginated<ScheduledTripRow>['pagination'] | null>(null);

    const [selectedRouteId, setSelectedRouteId] = useState<number | ''>('');
    const [generateDate, setGenerateDate] = useState(businessTodayYmd);
    const [generateDirection, setGenerateDirection] = useState<'BOTH' | 'MORNING' | 'EVENING'>('BOTH');
    const [generateBusy, setGenerateBusy] = useState(false);
    const [dailyAllBusy, setDailyAllBusy] = useState(false);
    const [regenerateBusy, setRegenerateBusy] = useState(false);
    const [endingTripId, setEndingTripId] = useState<number | null>(null);
    const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
    const [selectedTripIds, setSelectedTripIds] = useState<RowKey[]>([]);
    const [bulkCancelling, setBulkCancelling] = useState(false);
    const [editingTrip, setEditingTrip] = useState<ScheduledTripRow | null>(null);
    const [editDriverId, setEditDriverId] = useState('');
    const [editVehicleId, setEditVehicleId] = useState('');
    const [editError, setEditError] = useState<string | null>(null);
    const [assignmentSaving, setAssignmentSaving] = useState(false);
    const [extraVehicle, setExtraVehicle] = useState<{ id: number; plate_number: string; model?: string | null } | null>(null);

    const loadGenerationRoutes = useCallback(async (companyId?: number) => {
        const params = new URLSearchParams();
        if (companyId) params.set('company_id', String(companyId));
        const q = params.toString();
        const data = await apiClient.request<GenerationRoute[]>(
            `/shuttle-trips/generation-routes${q ? `?${q}` : ''}`,
        );
        setGenerationRoutes(Array.isArray(data) ? data : []);
    }, []);

    const loadTrips = useCallback(async () => {
        try {
            setListLoading(true);
            setListError(null);
            const params = new URLSearchParams({ from_date: fromDate, page: String(page), limit: String(PAGE_SIZE) });
            if (filterCompanyId !== '') params.set('company_id', String(filterCompanyId));
            if (filterRouteId !== '') params.set('route_id', String(filterRouteId));
            if (filterStatus) params.set('status', filterStatus);
            const res = await apiClient.request<Paginated<ScheduledTripRow>>(`/shuttle-trips/scheduled?${params.toString()}`);
            setRows(res?.data ?? []);
            setPagination(res?.pagination ?? null);
            setSelectedTripIds([]);
        } catch (e) {
            setListError(e instanceof Error ? e.message : 'Failed to load trips');
            setRows([]);
            setPagination(null);
        } finally {
            setListLoading(false);
        }
    }, [fromDate, filterCompanyId, filterRouteId, filterStatus, page]);

    useEffect(() => {
        if (companiesStatus === 'idle') {
            dispatch(fetchAdminCompanies({ limit: 200 }));
        }
    }, [dispatch, companiesStatus]);

    useEffect(() => {
        dispatch(fetchAdminDrivers({ limit: 200, driver_type: DriverType.SHUTTLE }));
        dispatch(fetchAdminVehicles({ limit: 200 }));
    }, [dispatch]);

    const loadRoutesForFilter = useCallback(
        () => loadGenerationRoutes(filterCompanyId === '' ? undefined : filterCompanyId).catch(() => setGenerationRoutes([])),
        [loadGenerationRoutes, filterCompanyId],
    );
    useLoader(loadRoutesForFilter);
    useLoader(loadTrips);

    const routeOptions = useMemo(() => {
        if (filterCompanyId === '') return generationRoutes;
        return generationRoutes.filter((r) => r.company_id === filterCompanyId);
    }, [generationRoutes, filterCompanyId]);

    const vehiclesForEdit = useMemo(() => {
        if (!extraVehicle) return vehicles;
        const exists = vehicles.some((v) => v.id === extraVehicle.id);
        return exists ? vehicles : [...vehicles, extraVehicle as (typeof vehicles)[number]];
    }, [vehicles, extraVehicle]);

    const driversForEdit = useMemo(() => {
        if (!editingTrip?.users?.id) return drivers;
        const exists = drivers.some((d) => d.id === editingTrip.users!.id);
        if (exists) return drivers;
        return [
            ...drivers,
            {
                id: editingTrip.users.id,
                full_name: editingTrip.users.full_name,
            } as (typeof drivers)[number],
        ];
    }, [drivers, editingTrip]);

    const openEditAssignment = async (trip: ScheduledTripRow) => {
        setEditingTrip(trip);
        setEditError(null);
        setEditDriverId(trip.driver_id ?? trip.users?.id ?? '');
        setEditVehicleId(String(tripVehicleId(trip) ?? ''));
        setExtraVehicle(null);
        const vehicleId = tripVehicleId(trip);
        if (vehicleId && !vehicles.some((v) => v.id === vehicleId)) {
            try {
                const res = await apiClient.getVehicle(vehicleId);
                const v = (res as { data?: typeof extraVehicle })?.data ?? res;
                if (v && typeof v === 'object' && 'id' in v) {
                    setExtraVehicle(v as typeof extraVehicle);
                }
            } catch {
                /* keep dropdown without extra vehicle */
            }
        }
    };

    const closeEditAssignment = () => {
        setEditingTrip(null);
        setEditDriverId('');
        setEditVehicleId('');
        setEditError(null);
        setExtraVehicle(null);
    };

    const handleSaveAssignment = async () => {
        if (!canMutate || !editingTrip) return;
        if (!editDriverId && !editVehicleId) {
            setEditError('Select a driver and/or vehicle.');
            return;
        }
        setAssignmentSaving(true);
        setEditError(null);
        try {
            const payload: { driver_id?: string; vehicle_id?: number } = {};
            const currentDriverId = editingTrip.driver_id ?? editingTrip.users?.id ?? '';
            const currentVehicleId = tripVehicleId(editingTrip);
            if (editDriverId && editDriverId !== currentDriverId) {
                payload.driver_id = editDriverId;
            }
            const nextVehicleId = editVehicleId ? Number(editVehicleId) : null;
            if (nextVehicleId != null && nextVehicleId !== currentVehicleId) {
                payload.vehicle_id = nextVehicleId;
            }
            if (!payload.driver_id && payload.vehicle_id == null) {
                setEditError('No changes to save.');
                return;
            }
            await apiClient.setShuttleTripResourceOverride(editingTrip.id, payload);
            toast.success('Saved for this trip only', { description: "The route's usual driver and vehicle are unchanged." });
            closeEditAssignment();
            await loadTrips();
        } catch (e) {
            setEditError(e instanceof Error ? e.message : 'Failed to update assignment');
        } finally {
            setAssignmentSaving(false);
        }
    };

    const handleGenerateForDate = async () => {
        if (!canMutate || selectedRouteId === '') {
            toast.error('Select a route and ensure you have permission to update shuttle ops.');
            return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(generateDate)) {
            toast.error('Pick a valid date.');
            return;
        }
        setGenerateBusy(true);
        try {
            const directions =
                generateDirection === 'BOTH' ? ['MORNING', 'EVENING'] : [generateDirection];
            const result = await apiClient.request<{ message: string; createdCount: number }>(
                '/shuttle-trips/generate-for-route',
                {
                    method: 'POST',
                    body: JSON.stringify({ route_id: selectedRouteId, dates: [generateDate], directions }),
                },
            );
            toast.success(result.message);
            await loadTrips();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Generation failed');
        } finally {
            setGenerateBusy(false);
        }
    };

    const handleDailyAllRoutes = async () => {
        if (!canMutate) return;
        setDailyAllBusy(true);
        try {
            const result = await apiClient.request<{ message: string; createdCount: number }>(
                '/shuttle-trips/trigger-daily-generation',
                { method: 'POST' },
            );
            toast.success(result.message);
            await loadTrips();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to generate trips for today');
        } finally {
            setDailyAllBusy(false);
        }
    };

    const handleRegenerateToday = async () => {
        if (!canMutate) return;
        const ok = await confirm({
            title: "Regenerate today's trips?",
            message: "Every SCHEDULED trip for today (UTC) is deleted and generated again from the routes' usual crews.",
            consequences: [
                'Driver or vehicle overrides set on today\'s scheduled trips are lost',
                'Trips that have already started or finished are not touched',
            ],
            destructive: true,
            confirmLabel: 'Regenerate',
        });
        if (!ok) return;
        setRegenerateBusy(true);
        try {
            const result = await apiClient.request<{ message: string; deletedCount: number; createdCount: number }>(
                '/shuttle-trips/regenerate-daily',
                { method: 'POST' },
            );
            toast.success(result.message);
            await loadTrips();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to regenerate trips');
        } finally {
            setRegenerateBusy(false);
        }
    };

    const tripLabel = (trip: ScheduledTripRow) =>
        `${trip.direction === 'MORNING' ? 'morning' : 'evening'} trip #${trip.id} (${trip.routes?.name ?? 'route'}) on ${formatTripDate(trip.trip_date)}`;

    const handleStatusChange = async (trip: ScheduledTripRow, nextStatus: string) => {
        if (!canMutate || nextStatus === trip.status) return;
        if (nextStatus !== 'SCHEDULED' && nextStatus !== 'CANCELLED') return;
        const cancelling = nextStatus === 'CANCELLED';
        const ok = await confirm({
            title: cancelling ? 'Cancel this trip?' : 'Restore this trip?',
            message: `${cancelling ? 'Cancel' : 'Restore'} the ${tripLabel(trip)}.`,
            consequences: cancelling
                ? ['The driver no longer sees it as scheduled', 'Passengers on this trip are not notified automatically']
                : ['The trip becomes SCHEDULED again and the driver will see it'],
            destructive: cancelling,
            confirmLabel: cancelling ? 'Cancel trip' : 'Restore trip',
            cancelLabel: 'Keep as is',
        });
        if (!ok) return;
        try {
            setStatusUpdatingId(trip.id);
            await apiClient.updateShuttleTripStatus(trip.id, nextStatus);
            toast.success(cancelling ? `Trip #${trip.id} cancelled` : `Trip #${trip.id} restored to scheduled`);
            await loadTrips();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update status');
        } finally {
            setStatusUpdatingId(null);
        }
    };

    const cancellableSelected = useMemo(
        () => rows.filter((t) => selectedTripIds.includes(t.id) && canEditAssignment(t.status)),
        [rows, selectedTripIds],
    );

    const handleBulkCancel = async () => {
        if (!canMutate || cancellableSelected.length === 0) return;
        const n = cancellableSelected.length;
        const ok = await confirm({
            title: `Cancel ${n} trip${n === 1 ? '' : 's'}?`,
            message: 'Each selected trip is cancelled one by one.',
            consequences: ['Drivers no longer see them as scheduled', 'Trips that already finished are skipped'],
            destructive: true,
            confirmLabel: `Cancel ${n} trip${n === 1 ? '' : 's'}`,
            cancelLabel: 'Keep them',
        });
        if (!ok) return;
        setBulkCancelling(true);
        let okCount = 0;
        const errors: string[] = [];
        try {
            for (const trip of cancellableSelected) {
                try {
                    await apiClient.updateShuttleTripStatus(trip.id, 'CANCELLED');
                    okCount += 1;
                } catch (e) {
                    errors.push(`#${trip.id}: ${e instanceof Error ? e.message : 'failed'}`);
                }
            }
            if (errors.length) {
                toast.error(`Cancelled ${okCount} trip(s); ${errors.length} failed`, { description: errors.join('; ') });
            } else {
                toast.success(`Cancelled ${okCount} trip${okCount === 1 ? '' : 's'}`);
            }
            await loadTrips();
        } finally {
            setBulkCancelling(false);
        }
    };

    const handleDelete = async (trip: ScheduledTripRow) => {
        if (!canMutate || trip.status !== 'SCHEDULED') return;
        const ok = await confirm({
            title: 'Delete this trip?',
            message: `Delete the ${tripLabel(trip)}.`,
            consequences: ['The trip disappears for the driver and from reports', 'This cannot be undone; generate it again if needed'],
            destructive: true,
            confirmLabel: 'Delete trip',
        });
        if (!ok) return;
        try {
            await apiClient.request(`/shuttle-trips/${trip.id}`, { method: 'DELETE' });
            toast.success('Trip deleted');
            await loadTrips();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Delete failed');
        }
    };

    const handleForceEnd = async (trip: ScheduledTripRow) => {
        if (!canMutate || (trip.status !== 'STARTED' && trip.status !== 'IN_PROGRESS')) return;
        const ok = await confirm({
            title: 'Force end this trip?',
            message: `End the ${tripLabel(trip)} on the driver's behalf. Use this when the driver forgot to end the ride.`,
            consequences: ['The trip is marked COMPLETED now', 'Remaining stops are closed without attendance'],
            destructive: true,
            confirmLabel: 'Force end',
        });
        if (!ok) return;
        try {
            setEndingTripId(trip.id);
            await apiClient.completeShuttleTrip(trip.id);
            toast.success(`Trip #${trip.id} marked as completed`);
            await loadTrips();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to end trip');
        } finally {
            setEndingTripId(null);
        }
    };

    const activeFilters = (filterCompanyId !== '' ? 1 : 0) + (filterRouteId !== '' ? 1 : 0) + (filterStatus ? 1 : 0);

    const columns: DataTableColumn<ScheduledTripRow>[] = [
        { key: 'date', header: 'Date', cell: (t) => <span className="whitespace-nowrap">{formatTripDate(t.trip_date)}</span> },
        { key: 'company', header: 'Company', hideBelow: 'lg', cell: (t) => t.routes?.companies?.name ?? '—' },
        { key: 'route', header: 'Route', cell: (t) => <span className="font-medium text-fg">{t.routes?.name ?? '—'}</span> },
        { key: 'direction', header: 'Direction', hideBelow: 'sm', cell: (t) => <StatusBadge status={t.direction} dot={false} size="sm" /> },
        {
            key: 'status',
            header: 'Status',
            cell: (t) => {
                const locked = !canMutate || !canChangeStatus(t.status);
                if (locked) return <StatusBadge status={t.status} overrides={TRIP_STATUS_OVERRIDES} />;
                return (
                    <Select
                        width="auto"
                        aria-label={`Status for trip #${t.id}`}
                        className="h-8 text-xs"
                        value={t.status}
                        disabled={statusUpdatingId === t.id}
                        onChange={(e) => void handleStatusChange(t, e.target.value)}
                    >
                        {statusSelectOptions(t.status).map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
                        ))}
                    </Select>
                );
            },
        },
        { key: 'driver', header: 'Driver', hideBelow: 'md', cell: (t) => t.users?.full_name ?? '—' },
        {
            key: 'vehicle',
            header: 'Vehicle',
            hideBelow: 'md',
            mono: true,
            cell: (t) => {
                const v = tripVehicle(t);
                return v ? `${v.plate_number}${v.model ? ` · ${v.model}` : ''}` : '—';
            },
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Trip scheduling"
                description="View upcoming trips, cancel or restore them, remove mistaken scheduled trips, and generate trips for one route and one day at a time."
                back={{ href: '/admin/routes', label: 'Back to routes' }}
                actions={
                    <Button variant="outline" asChild>
                        <Link href="/admin/routes/daily-overrides">
                            <ArrowLeftRight />
                            Today&apos;s plan
                        </Link>
                    </Button>
                }
            />

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Quick actions" description="Morning and evening trips for today (UTC) on every eligible route: driver + vehicle + shuttle-enabled company." />
                    <CardContent className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={handleDailyAllRoutes} disabled={!canMutate} loading={dailyAllBusy} leftIcon={<Bus />}>
                            Generate today&apos;s trips
                        </Button>
                        <Button variant="danger-outline" onClick={handleRegenerateToday} disabled={!canMutate} loading={regenerateBusy} leftIcon={<RefreshCw />}>
                            Regenerate today&apos;s trips
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader title="Generate by route and date" description="Creates SCHEDULED trips for one calendar day. A direction that already exists for that day is skipped." />
                    <CardContent>
                        <FormGrid cols={3}>
                            <Field label="Route" className="sm:col-span-2 lg:col-span-1">
                                <Select
                                    value={selectedRouteId === '' ? '' : String(selectedRouteId)}
                                    placeholder="Select route…"
                                    onChange={(e) => setSelectedRouteId(e.target.value ? Number(e.target.value) : '')}
                                >
                                    {routeOptions.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            {r.companies?.name ? `${r.companies.name} · ` : ''}{r.name}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Date">
                                <Input type="date" value={generateDate} onChange={(e) => setGenerateDate(e.target.value)} />
                            </Field>
                            <Field label="Direction">
                                <Select value={generateDirection} onChange={(e) => setGenerateDirection(e.target.value as 'BOTH' | 'MORNING' | 'EVENING')}>
                                    <option value="BOTH">Both</option>
                                    <option value="MORNING">Morning</option>
                                    <option value="EVENING">Evening</option>
                                </Select>
                            </Field>
                        </FormGrid>
                        <div className="mt-4 flex justify-end">
                            <Button onClick={handleGenerateForDate} disabled={!canMutate || selectedRouteId === ''} loading={generateBusy}>
                                Generate trips
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader
                    title="Scheduled trips"
                    description="Change status in the table to cancel a trip or restore a cancelled one. Select rows to cancel several at once."
                    actions={
                        <Button variant="outline" size="sm" onClick={() => void loadTrips()} loading={listLoading} leftIcon={<RefreshCw />}>
                            Refresh
                        </Button>
                    }
                />
                <CardContent className="border-b border-line py-3">
                    <FilterBar
                        activeCount={activeFilters}
                        onClear={() => {
                            setFilterCompanyId('');
                            setFilterRouteId('');
                            setFilterStatus('');
                            setPage(1);
                        }}
                    >
                        <FilterField label="From">
                            <Input
                                type="date"
                                className="h-8 text-xs"
                                value={fromDate}
                                onChange={(e) => {
                                    setFromDate(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </FilterField>
                        <FilterField label="Company">
                            <Select
                                width="auto"
                                className="h-8 text-xs"
                                value={filterCompanyId === '' ? '' : String(filterCompanyId)}
                                placeholder="All companies"
                                onChange={(e) => {
                                    setFilterCompanyId(e.target.value ? Number(e.target.value) : '');
                                    setFilterRouteId('');
                                    setPage(1);
                                }}
                            >
                                {companies.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </Select>
                        </FilterField>
                        <FilterField label="Route">
                            <Select
                                width="auto"
                                className="h-8 text-xs"
                                value={filterRouteId === '' ? '' : String(filterRouteId)}
                                placeholder="All routes"
                                onChange={(e) => {
                                    setFilterRouteId(e.target.value ? Number(e.target.value) : '');
                                    setPage(1);
                                }}
                            >
                                {routeOptions.map((r) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </Select>
                        </FilterField>
                        <FilterField label="Status">
                            <Select
                                width="auto"
                                className="h-8 text-xs"
                                value={filterStatus}
                                placeholder="All statuses"
                                onChange={(e) => {
                                    setFilterStatus(e.target.value);
                                    setPage(1);
                                }}
                            >
                                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </Select>
                        </FilterField>
                    </FilterBar>
                </CardContent>

                <DataTable<ScheduledTripRow>
                    caption="Scheduled shuttle trips"
                    columns={columns}
                    rows={rows}
                    rowKey={(t) => t.id}
                    loading={listLoading}
                    error={listError}
                    onRetry={() => void loadTrips()}
                    empty={{ title: 'No trips in this range', description: 'Try an earlier from-date or clear the filters.' }}
                    selectable={canMutate}
                    selectedKeys={selectedTripIds}
                    onSelectedKeysChange={setSelectedTripIds}
                    isRowSelectable={(t) => canEditAssignment(t.status)}
                    bulkActions={() => (
                        <Button variant="danger-outline" size="sm" onClick={handleBulkCancel} loading={bulkCancelling} disabled={cancellableSelected.length === 0} leftIcon={<Ban />}>
                            Cancel selected ({cancellableSelected.length})
                        </Button>
                    )}
                    rowActions={(t) => [
                        { label: 'Driver / vehicle', icon: <Pencil />, hidden: !canMutate || !canEditAssignment(t.status), onSelect: () => void openEditAssignment(t) },
                        { label: 'Delete trip', icon: <Trash2 />, destructive: true, hidden: !canMutate || t.status !== 'SCHEDULED', onSelect: () => void handleDelete(t) },
                        {
                            label: endingTripId === t.id ? 'Ending…' : 'Force end',
                            icon: <Square />,
                            destructive: true,
                            hidden: !canMutate || (t.status !== 'STARTED' && t.status !== 'IN_PROGRESS'),
                            disabled: endingTripId === t.id,
                            onSelect: () => void handleForceEnd(t),
                        },
                    ]}
                    pagination={
                        pagination
                            ? { page: pagination.page, totalPages: pagination.pages, total: pagination.total, pageSize: PAGE_SIZE, onPageChange: setPage }
                            : undefined
                    }
                />
            </Card>

            <Dialog open={!!editingTrip} onOpenChange={(open) => !open && !assignmentSaving && closeEditAssignment()}>
                {editingTrip && (
                    <DialogContent
                        title="Change driver or vehicle for this trip"
                        description={`${editingTrip.direction === 'MORNING' ? 'Morning' : 'Evening'} · ${formatTripDate(editingTrip.trip_date)} — this trip only`}
                        footer={
                            <>
                                <Button variant="outline" onClick={closeEditAssignment} disabled={assignmentSaving}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveAssignment} loading={assignmentSaving}>
                                    Save changes
                                </Button>
                            </>
                        }
                    >
                        <div className="space-y-4">
                            <p className="text-sm text-fg-secondary">
                                <span className="font-medium text-fg">{editingTrip.routes?.name ?? 'Route'}</span>
                                {editingTrip.routes?.companies?.name ? ` · ${editingTrip.routes.companies.name}` : ''}
                            </p>
                            <Field label="Driver">
                                <Select value={editDriverId} placeholder="Select driver…" onChange={(e) => setEditDriverId(e.target.value)}>
                                    {driversForEdit.map((d) => (
                                        <option key={d.id} value={d.id}>{d.full_name}</option>
                                    ))}
                                </Select>
                            </Field>
                            <Field
                                label="Vehicle"
                                hint="Everyday swaps belong on Today's plan. This applies to this trip only, not the route default."
                                error={editError}
                            >
                                <Select value={editVehicleId} placeholder="Select vehicle…" onChange={(e) => setEditVehicleId(e.target.value)}>
                                    {vehiclesForEdit.map((v) => (
                                        <option key={v.id} value={v.id}>{[v.model, v.plate_number].filter(Boolean).join(' · ')}</option>
                                    ))}
                                </Select>
                            </Field>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
