'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, Bus, Car, ChevronRight, MapPin, Plus, Route as RouteIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardSkeleton,
    EmptyState,
    ErrorState,
    FilterBar,
    FilterField,
    PageHeader,
    Select,
    StatusBadge,
    Tabs,
    TabsList,
    TabsTrigger,
    focusRing,
} from '@/app/admin/ui';
import { PermissionGate } from '@/app/admin/components/PermissionGate';
import { AdminCan, useAdminAbility } from '@/app/lib/abilities/AdminAbilityProvider';
import { ADMIN_SUBJECTS } from '@/app/lib/abilities/admin-subjects';
import { useAuth } from '@/app/lib/contexts/auth-context';
import { useAppDispatch, useAppSelector } from '@/app/lib/store/hooks';
import { fetchAdminRoutes, selectAdminRoutes, selectAdminRoutesStatus, routeStatus, type Route } from '@/app/lib/store/slices/adminRoutesSlice';
import { fetchAdminCompanies, selectAdminCompanies, selectAdminCompaniesStatus } from '@/app/lib/store/slices/adminCompaniesSlice';
import { initials } from './RouteCommandBar';

export default function RoutesPage() {
    return (
        <PermissionGate permission="routes">
            <AdminCan I="read" a="Routes">
                <RoutesPageContent />
            </AdminCan>
        </PermissionGate>
    );
}

function routeCompanyId(route: Route): number | null {
    return route.company?.id ?? route.companies?.id ?? route.company_id ?? null;
}

type RouteView = 'all' | 'needs-crew' | 'inactive';

const needsCrew = (route: Route) => !route.users?.full_name || !route.vehicles?.plate_number;

function RoutesPageContent() {
    const dispatch = useAppDispatch();
    const ability = useAdminAbility();
    const { hasPermission } = useAuth();
    const canOpsShuttle = hasPermission('ops_shuttle');
    const canCreate = ability.can('create', ADMIN_SUBJECTS.routes);
    const routes = useAppSelector(selectAdminRoutes);
    const status = useAppSelector(selectAdminRoutesStatus);
    const companies = useAppSelector(selectAdminCompanies);
    const companiesStatus = useAppSelector(selectAdminCompaniesStatus);
    const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
    const [search, setSearch] = useState('');
    const [view, setView] = useState<RouteView>('all');

    useEffect(() => {
        dispatch(fetchAdminRoutes({}));
    }, [dispatch]);

    useEffect(() => {
        if (companiesStatus === 'idle') dispatch(fetchAdminCompanies({ limit: 200 }));
    }, [dispatch, companiesStatus]);

    const companyRoutes = useMemo(
        () => (selectedCompanyId === '' ? [] : routes.filter((r) => routeCompanyId(r) === selectedCompanyId)),
        [routes, selectedCompanyId],
    );
    const companyRouteCount = companyRoutes.length;

    const viewCounts = useMemo<Record<RouteView, number>>(
        () => ({
            all: companyRoutes.length,
            'needs-crew': companyRoutes.filter(needsCrew).length,
            inactive: companyRoutes.filter((r) => routeStatus(r) === 'INACTIVE').length,
        }),
        [companyRoutes],
    );

    const filteredRoutes = useMemo(() => {
        const q = search.trim().toLowerCase();
        return companyRoutes.filter((route) => {
            if (view === 'needs-crew' && !needsCrew(route)) return false;
            if (view === 'inactive' && routeStatus(route) !== 'INACTIVE') return false;
            if (!q) return true;
            const driver = route.users?.full_name ?? '';
            const vehicle = `${route.vehicles?.model ?? ''} ${route.vehicles?.plate_number ?? ''}`;
            return [route.name, driver, vehicle].join(' ').toLowerCase().includes(q);
        });
    }, [companyRoutes, view, search]);

    const companySelect = (
        <Select
            placeholder="Select a company"
            value={selectedCompanyId === '' ? '' : String(selectedCompanyId)}
            onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : '')}
            disabled={companiesStatus === 'loading'}
            className="min-w-[14rem]"
        >
            {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </Select>
    );

    const createButton = canCreate ? (
        <Button asChild leftIcon={<Plus />}>
            <Link href="/admin/routes/create">
                <Plus />
                Create route
            </Link>
        </Button>
    ) : (
        <Button disabled leftIcon={<Plus />}>
            Create route
        </Button>
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Shuttle routes"
                description={
                    selectedCompanyId !== ''
                        ? `${companyRouteCount} ${companyRouteCount === 1 ? 'route' : 'routes'} for this company`
                        : 'Pick a company, then open a route to set stops, people, and usual crew.'
                }
                actions={
                    <>
                        {canOpsShuttle && (
                            <Button variant="outline" asChild>
                                <Link href="/admin/routes/daily-overrides">
                                    <ArrowLeftRight />
                                    Today&apos;s plan
                                </Link>
                            </Button>
                        )}
                        {canOpsShuttle && (
                            <Button variant="outline" asChild>
                                <Link href="/admin/routes/shuttle-trips">
                                    <Bus />
                                    Trip scheduling
                                </Link>
                            </Button>
                        )}
                        {createButton}
                    </>
                }
            />

            <Card>
                <CardContent className="py-3">
                    <FilterBar
                        search={selectedCompanyId !== '' ? { value: search, onChange: setSearch, placeholder: 'Search route, driver, plate' } : undefined}
                        activeCount={(search ? 1 : 0) + (view !== 'all' ? 1 : 0)}
                        onClear={() => {
                            setSearch('');
                            setView('all');
                        }}
                        actions={
                            selectedCompanyId !== '' && (
                                <Tabs value={view} onValueChange={(v) => setView(v as RouteView)}>
                                    <TabsList variant="pills" aria-label="Filter routes">
                                        <TabsTrigger value="all" count={viewCounts.all}>All</TabsTrigger>
                                        <TabsTrigger value="needs-crew" count={viewCounts['needs-crew']}>Needs crew</TabsTrigger>
                                        <TabsTrigger value="inactive" count={viewCounts.inactive}>Inactive</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            )
                        }
                    >
                        <FilterField label="Company">{companySelect}</FilterField>
                    </FilterBar>
                </CardContent>
            </Card>

            {status === 'loading' && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
                    {[0, 1, 2].map((i) => (
                        <CardSkeleton key={i} lines={4} />
                    ))}
                </div>
            )}

            {status === 'failed' && (
                <Card>
                    <ErrorState title="Couldn’t load routes" message="The routes list did not load." onRetry={() => dispatch(fetchAdminRoutes({}))} />
                </Card>
            )}

            {status === 'succeeded' && selectedCompanyId === '' && (
                <Card>
                    <EmptyState
                        icon={<Bus aria-hidden="true" />}
                        title="Pick a company to start"
                        description="Choose who you are setting up routes for."
                        action={<div className="w-64">{companySelect}</div>}
                    />
                </Card>
            )}

            {status === 'succeeded' && selectedCompanyId !== '' && filteredRoutes.length === 0 && (
                <Card>
                    <EmptyState
                        icon={<Bus aria-hidden="true" />}
                        title={search || view !== 'all' ? 'No routes match these filters' : 'No routes for this company yet'}
                        description={search || view !== 'all' ? 'Try a different name, driver, or plate, or switch back to All.' : 'Create a route, then assign usual driver, vehicle, stops, and people.'}
                        action={
                            search || view !== 'all' ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearch('');
                                        setView('all');
                                    }}
                                >
                                    Clear filters
                                </Button>
                            ) : canCreate ? (
                                <Button asChild size="sm">
                                    <Link href="/admin/routes/create">
                                        <Plus />
                                        Create route
                                    </Link>
                                </Button>
                            ) : null
                        }
                    />
                </Card>
            )}

            {status === 'succeeded' && selectedCompanyId !== '' && filteredRoutes.length > 0 && (
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredRoutes.map((route) => (
                        <li key={route.id}>
                            <RouteTile route={route} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** First pickup → last office stop, in morning order, e.g. "Nagan Chowrangi → Head office". */
function routePath(route: Route): string | null {
    const stops = [...(route.route_stops ?? [])].sort(
        (a, b) => (a.morning_sequence ?? a.sequence_order) - (b.morning_sequence ?? b.sequence_order),
    );
    if (stops.length === 0) return null;
    const first = stops.find((s) => s.stop_type !== 'OFFICE') ?? stops[0];
    const office = [...stops].reverse().find((s) => s.stop_type === 'OFFICE') ?? stops[stops.length - 1];
    return first === office ? first.name : `${first.name} → ${office.name}`;
}

function RouteTile({ route }: { route: Route }) {
    const driver = route.users?.full_name;
    const missingCrew = needsCrew(route);
    const stopCount = route.route_stops?.length || 0;
    const path = routePath(route);
    const vendor = route.company_vendor_link_id
        ? (route.company_vendor_links?.external_vendors?.name ?? 'External vendor')
        : 'CORT';

    return (
        <Link href={`/admin/routes/${route.id}`} className={cn('group block h-full rounded-xl', focusRing)}>
            <Card interactive className="flex h-full flex-col">
                <div className="flex items-start gap-3 p-4 pb-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink" aria-hidden="true">
                        <RouteIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="truncate font-semibold text-fg">{route.name}</h2>
                            <StatusBadge status={routeStatus(route)} size="sm" />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-fg-muted" title={path ?? undefined}>
                            {path ?? 'No stops yet'}
                        </p>
                    </div>
                </div>

                <dl className="mx-4 divide-y divide-line rounded-lg border border-line bg-subtle">
                    <CrewRow label="Driver" missing={!driver}>
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand-ink" aria-hidden="true">
                            {initials(driver)}
                        </span>
                        <span className="truncate">{driver}</span>
                    </CrewRow>
                    <CrewRow label="Vehicle" missing={!route.vehicles?.plate_number}>
                        <Car className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                        {route.vehicles?.model && <span className="truncate">{route.vehicles.model}</span>}
                        <span className="shrink-0 rounded border border-line bg-card px-1.5 py-px font-mono text-xs">
                            {route.vehicles?.plate_number}
                        </span>
                    </CrewRow>
                </dl>

                <div className="mt-auto flex items-center gap-2 p-4 pt-3">
                    <Badge tone="neutral" size="sm" icon={<MapPin aria-hidden="true" />}>
                        {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
                    </Badge>
                    <Badge tone={route.company_vendor_link_id ? 'purple' : 'info'} size="sm">{vendor}</Badge>
                    {missingCrew && (
                        <Badge tone="warning" size="sm" dot>Needs crew</Badge>
                    )}
                    <ChevronRight
                        className="ml-auto size-4 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-fg"
                        aria-hidden="true"
                    />
                </div>
            </Card>
        </Link>
    );
}

function CrewRow({ label, missing, children }: { label: string; missing: boolean; children: React.ReactNode }) {
    return (
        <div className="flex h-11 items-center gap-3 px-3">
            <dt className="w-14 shrink-0 text-xs font-medium text-fg-muted">{label}</dt>
            <dd className="flex min-w-0 flex-1 items-center gap-2 text-sm text-fg">
                {missing ? <span className="text-warning-ink">Not assigned</span> : children}
            </dd>
        </div>
    );
}
