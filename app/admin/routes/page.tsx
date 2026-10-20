'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, Bus, Car, MapPin, Plus } from 'lucide-react';
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
    focusRing,
} from '@/app/admin/ui';
import { PermissionGate } from '@/app/admin/components/PermissionGate';
import { AdminCan, useAdminAbility } from '@/app/lib/abilities/AdminAbilityProvider';
import { ADMIN_SUBJECTS } from '@/app/lib/abilities/admin-subjects';
import { useAuth } from '@/app/lib/contexts/auth-context';
import { useAppDispatch, useAppSelector } from '@/app/lib/store/hooks';
import { fetchAdminRoutes, selectAdminRoutes, selectAdminRoutesStatus, type Route } from '@/app/lib/store/slices/adminRoutesSlice';
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

    useEffect(() => {
        dispatch(fetchAdminRoutes({}));
    }, [dispatch]);

    useEffect(() => {
        if (companiesStatus === 'idle') dispatch(fetchAdminCompanies({ limit: 200 }));
    }, [dispatch, companiesStatus]);

    const filteredRoutes = useMemo(() => {
        if (selectedCompanyId === '') return [];
        const q = search.trim().toLowerCase();
        return routes.filter((route) => {
            if (routeCompanyId(route) !== selectedCompanyId) return false;
            if (!q) return true;
            const driver = route.users?.full_name ?? '';
            const vehicle = `${route.vehicles?.model ?? ''} ${route.vehicles?.plate_number ?? ''}`;
            return [route.name, driver, vehicle].join(' ').toLowerCase().includes(q);
        });
    }, [routes, selectedCompanyId, search]);

    const companyRouteCount = useMemo(() => {
        if (selectedCompanyId === '') return 0;
        return routes.filter((r) => routeCompanyId(r) === selectedCompanyId).length;
    }, [routes, selectedCompanyId]);

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
                        activeCount={search ? 1 : 0}
                        onClear={() => setSearch('')}
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
                        title={search ? 'No routes match that search' : 'No routes for this company yet'}
                        description={search ? 'Try a different name, driver, or plate.' : 'Create a route, then assign usual driver, vehicle, stops, and people.'}
                        action={
                            search ? (
                                <Button variant="outline" size="sm" onClick={() => setSearch('')}>Clear search</Button>
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

function RouteTile({ route }: { route: Route }) {
    const driver = route.users?.full_name;
    const vehicle = route.vehicles?.plate_number
        ? [route.vehicles.model, route.vehicles.plate_number].filter(Boolean).join(' · ')
        : null;
    const missingCrew = !driver || !vehicle;
    const stopCount = route.route_stops?.length || 0;
    const vendor = route.company_vendor_link_id
        ? (route.company_vendor_links?.external_vendors?.name ?? 'External vendor')
        : 'CORT';

    return (
        <Link href={`/admin/routes/${route.id}`} className={cn('block h-full rounded-xl', focusRing)}>
            <Card interactive className={cn('h-full overflow-hidden border-l-4', missingCrew ? 'border-l-warning' : 'border-l-brand')}>
                <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                        <h2 className="truncate font-semibold text-fg">{route.name}</h2>
                        <StatusBadge status={route.status} size="sm" />
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink" aria-hidden="true">
                            {initials(driver)}
                        </span>
                        <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Usual driver</div>
                            <div className="truncate text-sm text-fg">{driver ?? 'Not set'}</div>
                        </div>
                    </div>

                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Usual vehicle</div>
                        <div className="mt-0.5 flex items-center gap-2 text-sm text-fg">
                            <Car className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                            <span className={cn('truncate', vehicle && 'font-mono text-[13px]')}>{vehicle ?? 'Not set'}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral" icon={<MapPin aria-hidden="true" />}>
                            {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
                        </Badge>
                        <Badge tone={route.company_vendor_link_id ? 'purple' : 'info'}>{vendor}</Badge>
                    </div>

                    {missingCrew && (
                        <p className="rounded-lg border border-warning-line bg-warning-soft px-2.5 py-1.5 text-xs text-warning-ink">
                            {!driver && !vehicle
                                ? 'Set a usual driver and vehicle — needed for trips'
                                : !driver
                                    ? 'Set a usual driver — needed for trips'
                                    : 'Set a usual vehicle — needed for trips'}
                        </p>
                    )}
                </div>
            </Card>
        </Link>
    );
}
