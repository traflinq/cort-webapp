'use client';

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, ScrollText } from 'lucide-react';
import { PermissionGate } from '@/app/admin/components/PermissionGate';
import { AdminCan } from '@/app/lib/abilities/AdminAbilityProvider';
import { adminBtnOutline, adminCard, adminInput, adminPageTitle, adminSelect, adminTableHead, adminTableRow } from '@/app/admin/components/ui/admin-styles';
import { apiClient } from '@/app/lib/services/api-client';
import { useAuth } from '@/app/lib/contexts/auth-context';
import { useAppDispatch, useAppSelector } from '@/app/lib/store/hooks';
import {
    fetchAdminCompanies,
    selectAdminCompanies,
    selectAdminCompaniesStatus,
} from '@/app/lib/store/slices/adminCompaniesSlice';
import { fetchAdminRoutes, selectAdminRoutes } from '@/app/lib/store/slices/adminRoutesSlice';
import Pagination from '@/app/components/ui/Pagination';

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

// TODO: remove this email allowlist; shuttle_audit permission is the real gate
const SHUTTLE_AUDIT_ALLOWED_EMAIL = 'hashir.ahmed@cort.com.pk';

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

function utcTodayYmd(): string {
    const n = new Date();
    return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
}

function daysAgoYmd(days: number): string {
    const n = new Date();
    n.setUTCDate(n.getUTCDate() - days);
    return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
}

function formatWhen(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatValue(value: unknown): string {
    if (value == null || value === '') return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export default function ShuttleAuditPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const emailAllowed = user?.email?.trim().toLowerCase() === SHUTTLE_AUDIT_ALLOWED_EMAIL;

    useEffect(() => {
        if (!loading && user && !emailAllowed) {
            router.replace('/admin');
        }
    }, [loading, user, emailAllowed, router]);

    if (loading || !emailAllowed) {
        return null;
    }

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

    const [from, setFrom] = useState(() => daysAgoYmd(7));
    const [to, setTo] = useState(utcTodayYmd);
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
                from,
                to,
                page,
                limit: 50,
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
    }, [from, to, page, companyId, routeId, action]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-medium text-[var(--text-muted)]">Shuttle</div>
                    <h1 className={`${adminPageTitle} mt-1 flex items-center gap-2`}>
                        <ScrollText className="h-6 w-6" />
                        Shuttle audit logs
                    </h1>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Who changed drivers, vehicles, daily plan moves, routes, stops, and roster assignments.
                    </p>
                </div>
                <Link href="/admin/routes/shuttle-trips" className={adminBtnOutline}>
                    Shuttle trip scheduling
                </Link>
            </div>

            <div className={`${adminCard} p-4`}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-[var(--text-secondary)]">From</span>
                        <input
                            type="date"
                            className={adminInput}
                            value={from}
                            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-[var(--text-secondary)]">To</span>
                        <input
                            type="date"
                            className={adminInput}
                            value={to}
                            onChange={(e) => { setTo(e.target.value); setPage(1); }}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-[var(--text-secondary)]">Company</span>
                        <select
                            className={adminSelect}
                            value={companyId}
                            onChange={(e) => {
                                setCompanyId(e.target.value ? Number(e.target.value) : '');
                                setRouteId('');
                                setPage(1);
                            }}
                        >
                            <option value="">All companies</option>
                            {companies.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-[var(--text-secondary)]">Route</span>
                        <select
                            className={adminSelect}
                            value={routeId}
                            onChange={(e) => {
                                setRouteId(e.target.value ? Number(e.target.value) : '');
                                setPage(1);
                            }}
                        >
                            <option value="">All routes</option>
                            {routeOptions.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-[var(--text-secondary)]">Action</span>
                        <select
                            className={adminSelect}
                            value={action}
                            onChange={(e) => { setAction(e.target.value); setPage(1); }}
                        >
                            <option value="">All actions</option>
                            {ACTION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            <div className={`${adminCard} overflow-hidden`}>
                {error && (
                    <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
                )}
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className={adminTableHead}>
                            <tr>
                                <th className="px-4 py-3 text-left">When</th>
                                <th className="px-4 py-3 text-left">Actor</th>
                                <th className="px-4 py-3 text-left">Action</th>
                                <th className="px-4 py-3 text-left">Entity</th>
                                <th className="px-4 py-3 text-left">Notes</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-[var(--text-muted)]">
                                        Loading audit logs...
                                    </td>
                                </tr>
                            )}
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-[var(--text-muted)]">
                                        No shuttle changes in this range.
                                    </td>
                                </tr>
                            )}
                            {!loading && rows.map((row) => {
                                const open = expandedId === row.id;
                                const entityLabel = row.trip_id
                                    ? `Trip #${row.trip_id}`
                                    : row.route_id
                                        ? (routeNameById.get(row.route_id) ?? `Route #${row.route_id}`)
                                        : (row.entity_type ?? '-');
                                return (
                                    <Fragment key={row.id}>
                                        <tr className={adminTableRow}>
                                            <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">
                                                {formatWhen(row.created_at)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-[var(--text-primary)]">{row.actor_name ?? row.actor_id}</div>
                                                {row.actor_role && (
                                                    <div className="text-xs text-[var(--text-muted)]">{row.actor_role}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-[var(--text-primary)]">
                                                {ACTION_LABELS[row.action] ?? row.action}
                                            </td>
                                            <td className="px-4 py-3 text-[var(--text-secondary)]">{entityLabel}</td>
                                            <td className="max-w-md px-4 py-3 text-[var(--text-primary)]">{row.notes || '-'}</td>
                                            <td className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                                    onClick={() => setExpandedId(open ? null : row.id)}
                                                >
                                                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                        {open && (
                                            <tr>
                                                <td colSpan={6} className="p-0">
                                                    <ChangeDetails row={row} />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--border-default)] px-4 py-3">
                    <div className="text-xs text-[var(--text-muted)]">{total} change{total === 1 ? '' : 's'}</div>
                    <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
                </div>
            </div>
        </div>
    );
}

function ChangeDetails({ row }: { row: AuditRow }) {
    const keys = [...new Set([
        ...Object.keys(row.before ?? {}),
        ...Object.keys(row.after ?? {}),
    ])];
    return (
        <div className="border-t border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Previous vs new values
            </div>
            {keys.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No field-level values stored for this event.</p>
            ) : (
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-[var(--text-muted)]">
                            <th className="py-1 pr-4">Field</th>
                            <th className="py-1 pr-4">Previous</th>
                            <th className="py-1">New</th>
                        </tr>
                    </thead>
                    <tbody>
                        {keys.map((key) => (
                            <tr key={key}>
                                <td className="py-1 pr-4 font-medium text-[var(--text-secondary)]">{key}</td>
                                <td className="py-1 pr-4 text-[var(--text-primary)]">{formatValue(row.before?.[key])}</td>
                                <td className="py-1 text-[var(--text-primary)]">{formatValue(row.after?.[key])}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
