'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { PermissionGate } from '@/app/admin/components/PermissionGate';
import { AdminCan } from '@/app/lib/abilities/AdminAbilityProvider';
import {
    Button,
    Card,
    CardContent,
    DataTable,
    DateRangePicker,
    FilterBar,
    FilterField,
    PageHeader,
    Select,
    type DataTableColumn,
    type DateRange,
} from '@/app/admin/ui';
import { formatDateTime } from '@/app/admin/lib/format';
import { lastNDaysRange } from '@/app/admin/lib/dates';
import { apiClient } from '@/app/lib/services/api-client';
import { useAppDispatch, useAppSelector } from '@/app/lib/store/hooks';
import {
    fetchAdminCompanies,
    selectAdminCompanies,
    selectAdminCompaniesStatus,
} from '@/app/lib/store/slices/adminCompaniesSlice';
import { fetchAdminRoutes, selectAdminRoutes } from '@/app/lib/store/slices/adminRoutesSlice';
import { useLoader } from '../daily-overrides/plan-types';

const ACTION_OPTIONS: { value: string; label: string }[] = [
    { value: 'shuttle.trip.assignment_changed', label: 'Trip driver/vehicle changed' },
    { value: 'shuttle.trip.resource_override_set', label: 'Trip crew override set' },
    { value: 'shuttle.trip.resource_override_cleared', label: 'Trip crew override cleared' },
    { value: 'shuttle.trip.status_changed', label: 'Trip status changed' },
    { value: 'shuttle.trip.force_ended', label: 'Trip force-ended' },
    { value: 'shuttle.trip.completed', label: 'Trip completed' },
    { value: 'shuttle.trip.deleted', label: 'Trip deleted' },
    { value: 'shuttle.trip.daily_generated', label: 'Daily trips generated' },
    { value: 'shuttle.trip.daily_regenerated', label: 'Daily trips regenerated' },
    { value: 'shuttle.trip.generated_for_route', label: 'Trips generated for route' },
    { value: 'shuttle.trip.nightly_generated', label: 'Nightly trips generated (cron)' },
    { value: 'shuttle.trip.force_completed_batch', label: 'Force-completed started trips (cron)' },
    { value: 'shuttle.trip.attendance_reminder_sent', label: 'Attendance reminder push sent' },
    { value: 'shuttle.daily_override.created', label: 'Daily plan move created' },
    { value: 'shuttle.daily_override.updated', label: 'Daily plan move updated' },
    { value: 'shuttle.daily_override.cancelled', label: 'Daily plan move cancelled' },
    { value: 'shuttle.route.created', label: 'Route created' },
    { value: 'shuttle.route.updated', label: 'Route updated' },
    { value: 'shuttle.route.deleted', label: 'Route deleted' },
    { value: 'shuttle.route.optimized', label: 'Route optimized' },
    { value: 'shuttle.stop.created', label: 'Stop added' },
    { value: 'shuttle.stop.updated', label: 'Stop updated' },
    { value: 'shuttle.stop.deleted', label: 'Stop deleted' },
    { value: 'shuttle.stop.reordered', label: 'Stops reordered' },
    { value: 'shuttle.roster.assigned', label: 'Employee assigned to route' },
    { value: 'shuttle.roster.removed', label: 'Employee removed from route' },
];

const ACTION_LABELS = Object.fromEntries(ACTION_OPTIONS.map((o) => [o.value, o.label]));

// FLAGGED (kept as-is, decision 2026-10-20): hard-coded email allowlist; shuttle_audit permission is the real gate.

const PAGE_SIZE = 50;

type AuditRow = {
    id: number;
    actor_id: string;
    actor_name: string | null;
    actor_role: string | null;
    action: string;
    created_at: string;
    notes: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    entity_type: string | null;
    entity_id: string | null;
    route_id: number | null;
    trip_id: number | null;
    impersonated_by: string | null;
};

function formatValue(value: unknown): string {
    if (value == null || value === '') return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export default function ShuttleAuditPage() {
    return (
        <PermissionGate permission="shuttle_audit">
            <AdminCan I="read" a="ShuttleAudit">
                <ShuttleAuditContent />
            </AdminCan>
        </PermissionGate>
    );
}

function ShuttleAuditContent() {
    const dispatch = useAppDispatch();
    const companies = useAppSelector(selectAdminCompanies);
    const companiesStatus = useAppSelector(selectAdminCompaniesStatus);
    const routes = useAppSelector(selectAdminRoutes);

    const [range, setRange] = useState<DateRange>(() => lastNDaysRange(7));
    const [companyId, setCompanyId] = useState<number | ''>('');
    const [routeId, setRouteId] = useState<number | ''>('');
    const [action, setAction] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<AuditRow[]>([]);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        if (companiesStatus === 'idle') {
            dispatch(fetchAdminCompanies({ limit: 200 }));
        }
        dispatch(fetchAdminRoutes({}));
    }, [dispatch, companiesStatus]);

    const routeOptions = useMemo(() => {
        if (companyId === '') return routes;
        return routes.filter((r) => (r.company_id ?? r.companies?.id ?? r.company?.id) === companyId);
    }, [routes, companyId]);

    const routeNameById = useMemo(() => {
        const map = new Map<number, string>();
        for (const r of routes) map.set(r.id, r.name);
        return map;
    }, [routes]);

    const loadLogs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await apiClient.getShuttleAuditLogs({
                from: range.start,
                to: range.end,
                page,
                limit: PAGE_SIZE,
                company_id: companyId === '' ? undefined : companyId,
                route_id: routeId === '' ? undefined : routeId,
                action: action || undefined,
            });
            setRows(res?.data ?? []);
            setPages(res?.pagination?.pages ?? 1);
            setTotal(res?.pagination?.total ?? 0);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load audit logs');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [range.start, range.end, page, companyId, routeId, action]);

    useLoader(loadLogs);

    const activeFilters = (companyId !== '' ? 1 : 0) + (routeId !== '' ? 1 : 0) + (action ? 1 : 0);

    const columns: DataTableColumn<AuditRow>[] = [
        { key: 'when', header: 'When', cell: (r) => <span className="whitespace-nowrap text-fg-secondary">{formatDateTime(r.created_at)}</span> },
        {
            key: 'actor',
            header: 'Actor',
            cell: (r) => (
                <div className="min-w-0">
                    <div className="font-medium text-fg">{r.actor_name ?? r.actor_id}</div>
                    {r.actor_role && <div className="text-xs text-fg-muted">{r.actor_role}</div>}
                </div>
            ),
        },
        { key: 'action', header: 'Action', cell: (r) => ACTION_LABELS[r.action] ?? r.action },
        {
            key: 'entity',
            header: 'Entity',
            hideBelow: 'md',
            cell: (r) => (
                <span className="text-fg-secondary">
                    {r.trip_id
                        ? `Trip #${r.trip_id}`
                        : r.route_id
                            ? (routeNameById.get(r.route_id) ?? `Route #${r.route_id}`)
                            : (r.entity_type ?? '—')}
                </span>
            ),
        },
        { key: 'notes', header: 'Notes', hideBelow: 'lg', className: 'max-w-md', cell: (r) => r.notes || '—' },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Shuttle audit"
                description="Who changed drivers, vehicles, daily plan moves, routes, stops, and roster assignments."
                actions={
                    <Button variant="outline" asChild>
                        <Link href="/admin/routes/shuttle-trips">
                            <CalendarDays />
                            Trip scheduling
                        </Link>
                    </Button>
                }
            />

            <Card>
                <CardContent className="border-b border-line py-3">
                    <FilterBar
                        activeCount={activeFilters}
                        onClear={() => {
                            setCompanyId('');
                            setRouteId('');
                            setAction('');
                            setPage(1);
                        }}
                    >
                        <DateRangePicker
                            size="sm"
                            label="Period"
                            value={range}
                            onChange={(next) => {
                                if (!next) return;
                                setRange(next);
                                setPage(1);
                            }}
                        />
                        <FilterField label="Company">
                            <Select
                                width="auto"
                                className="h-8 text-xs"
                                value={companyId === '' ? '' : String(companyId)}
                                placeholder="All companies"
                                onChange={(e) => {
                                    setCompanyId(e.target.value ? Number(e.target.value) : '');
                                    setRouteId('');
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
                                value={routeId === '' ? '' : String(routeId)}
                                placeholder="All routes"
                                onChange={(e) => {
                                    setRouteId(e.target.value ? Number(e.target.value) : '');
                                    setPage(1);
                                }}
                            >
                                {routeOptions.map((r) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </Select>
                        </FilterField>
                        <FilterField label="Action">
                            <Select
                                width="auto"
                                className="h-8 max-w-[16rem] text-xs"
                                value={action}
                                placeholder="All actions"
                                onChange={(e) => {
                                    setAction(e.target.value);
                                    setPage(1);
                                }}
                            >
                                {ACTION_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </Select>
                        </FilterField>
                    </FilterBar>
                </CardContent>

                <DataTable<AuditRow>
                    caption="Shuttle audit log"
                    columns={columns}
                    rows={rows}
                    rowKey={(r) => r.id}
                    loading={loading}
                    error={error}
                    onRetry={() => void loadLogs()}
                    empty={{ title: 'No shuttle changes in this range', description: 'Widen the period or clear the filters.' }}
                    expandable={{
                        isExpanded: (r) => expandedId === r.id,
                        onToggle: (r) => setExpandedId((cur) => (cur === r.id ? null : r.id)),
                        render: (r) => <ChangeDetails row={r} />,
                    }}
                    onRowClick={(r) => setExpandedId((cur) => (cur === r.id ? null : r.id))}
                    pagination={{ page, totalPages: pages, total, pageSize: PAGE_SIZE, onPageChange: setPage }}
                />
            </Card>
        </div>
    );
}

function ChangeDetails({ row }: { row: AuditRow }) {
    const keys = [...new Set([
        ...Object.keys(row.before ?? {}),
        ...Object.keys(row.after ?? {}),
    ])];
    return (
        <div className="border-t border-line px-4 py-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Previous vs new values</div>
            {keys.length === 0 ? (
                <p className="text-sm text-fg-muted">No field-level values stored for this event.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-fg-muted">
                                <th scope="col" className="py-1 pr-4 font-medium">Field</th>
                                <th scope="col" className="py-1 pr-4 font-medium">Previous</th>
                                <th scope="col" className="py-1 font-medium">New</th>
                            </tr>
                        </thead>
                        <tbody>
                            {keys.map((key) => (
                                <tr key={key}>
                                    <td className="py-1 pr-4 font-mono text-[13px] text-fg-secondary">{key}</td>
                                    <td className="py-1 pr-4 text-fg">{formatValue(row.before?.[key])}</td>
                                    <td className="py-1 text-fg">{formatValue(row.after?.[key])}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {row.impersonated_by && <p className="mt-2 text-xs text-fg-muted">Performed while impersonating (by {row.impersonated_by}).</p>}
        </div>
    );
}
