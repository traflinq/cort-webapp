'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Building2, MapPin, Trash2 } from 'lucide-react';
import StopAddressSearch from '@/app/admin/ui/StopAddressSearch';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/app/lib/store/hooks';
import { fetchAdminCompanies, selectAdminCompanies, selectAdminCompaniesStatus } from '@/app/lib/store/slices/adminCompaniesSlice';
import { createAdminRoute, selectAdminRoutesActionStatus } from '@/app/lib/store/slices/adminRoutesSlice';
import { fetchAdminDrivers, selectAdminDrivers } from '@/app/lib/store/slices/adminDriversSlice';
import { fetchAdminVehicles, selectAdminVehicles } from '@/app/lib/store/slices/adminVehiclesSlice';
import { apiClient } from '@/app/lib/services/api-client';
import { DriverType } from '@/app/lib/services/types/drivers';
import type { MapMarker, MapPolyline } from '@/app/admin/ui/Map';
import { PermissionGate } from '@/app/admin/components/PermissionGate';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    Field,
    FormGrid,
    IconButton,
    Input,
    Label,
    PageHeader,
    Select,
    Tabs,
    TabsList,
    TabsTrigger,
    usePageBreadcrumbs,
} from '@/app/admin/ui';
import { MAP_COLORS } from '../RouteCommandBar';

const Map = dynamic(() => import('@/app/admin/ui/Map'), { ssr: false });

type StopDirection = 'MORNING' | 'EVENING' | 'BOTH';
type PinMode = 'pickup' | 'office';

interface Stop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    morningEta: string;
    eveningEta: string;
    direction: StopDirection;
}

type PolylineResponse = { points: { lat: number; lng: number }[] };

function makeStop(
    name: string,
    lat: number,
    lng: number,
    extras?: Partial<Pick<Stop, 'morningEta' | 'eveningEta' | 'direction'>>,
): Stop {
    return {
        id: crypto.randomUUID(),
        name,
        lat,
        lng,
        morningEta: extras?.morningEta ?? '09:00',
        eveningEta: extras?.eveningEta ?? '18:00',
        direction: extras?.direction ?? 'BOTH',
    };
}

export default function CreateRoutePage() {
    return (
        <PermissionGate permission="routes" action="create">
            <CreateRoutePageContent />
        </PermissionGate>
    );
}

function SectionTitle({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{children}</h2>
            {extra}
        </div>
    );
}

function CreateRoutePageContent() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const companies = useAppSelector(selectAdminCompanies);
    const companiesStatus = useAppSelector(selectAdminCompaniesStatus);
    const routeActionStatus = useAppSelector(selectAdminRoutesActionStatus);
    const drivers = useAppSelector(selectAdminDrivers);
    const vehicles = useAppSelector(selectAdminVehicles);

    usePageBreadcrumbs([{ label: 'New route' }]);

    const [name, setName] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [assignedVehicleId, setAssignedVehicleId] = useState('');
    const [assignedDriverId, setAssignedDriverId] = useState('');
    const [eveningVehicleId, setEveningVehicleId] = useState('');
    const [eveningDriverId, setEveningDriverId] = useState('');
    /** A route may have multiple company office stops (multi-office shuttle support). */
    const [officeStops, setOfficeStops] = useState<Stop[]>([]);
    const [pickupStops, setPickupStops] = useState<Stop[]>([]);
    const [pinMode, setPinMode] = useState<PinMode>('office');
    const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
    const polylineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /** Ordered for API: pickups first, offices last. */
    const orderedStops = useMemo(
        () => [...pickupStops, ...officeStops],
        [pickupStops, officeStops],
    );

    useEffect(() => {
        if (companiesStatus === 'idle') dispatch(fetchAdminCompanies({ limit: 100 }));
        dispatch(fetchAdminDrivers({ limit: 100, driver_type: DriverType.SHUTTLE }));
        dispatch(fetchAdminVehicles({ limit: 100 }));
    }, [dispatch, companiesStatus]);

    const fetchPreviewPolyline = useCallback(async (currentStops: Stop[]) => {
        if (currentStops.length < 2) {
            setRoutePolyline([]);
            return;
        }
        try {
            const data = await apiClient.request<PolylineResponse>('/routes/preview-polyline', {
                method: 'POST',
                body: JSON.stringify({ stops: currentStops.map((s) => ({ lat: s.lat, lng: s.lng })) }),
            });
            setRoutePolyline(data.points.map((p) => [p.lat, p.lng] as [number, number]));
        } catch {
            setRoutePolyline(currentStops.map((s) => [s.lat, s.lng] as [number, number]));
        }
    }, []);

    const schedulePolylineUpdate = useCallback((updatedStops: Stop[]) => {
        if (polylineDebounceRef.current) clearTimeout(polylineDebounceRef.current);
        polylineDebounceRef.current = setTimeout(() => fetchPreviewPolyline(updatedStops), 600);
    }, [fetchPreviewPolyline]);

    const applyOffice = useCallback((stop: Stop) => {
        setOfficeStops((prev) => {
            const next = [...prev, stop];
            schedulePolylineUpdate([...pickupStops, ...next]);
            return next;
        });
        toast.success('Company office added');
    }, [pickupStops, schedulePolylineUpdate]);

    const applyPickup = useCallback((stop: Stop) => {
        setPickupStops((prev) => {
            const updated = [...prev, stop];
            schedulePolylineUpdate([...updated, ...officeStops]);
            return updated;
        });
        toast.success(`Pickup "${stop.name}" added`);
    }, [officeStops, schedulePolylineUpdate]);

    const handleAddressSelect = useCallback(({ name: stopName, lat, lng }: { name: string; lat: number; lng: number }) => {
        if (pinMode === 'office') {
            applyOffice(makeStop(stopName, lat, lng, { morningEta: '09:00', eveningEta: '18:00' }));
        } else {
            applyPickup(makeStop(stopName, lat, lng, { morningEta: '08:00', eveningEta: '18:30' }));
        }
    }, [pinMode, applyOffice, applyPickup]);

    const handleMapClick = useCallback((lat: number, lng: number) => {
        if (pinMode === 'office') {
            applyOffice(makeStop(`Office ${officeStops.length + 1}`, lat, lng, { morningEta: '09:00', eveningEta: '18:00' }));
        } else {
            applyPickup(makeStop(`Pickup ${pickupStops.length + 1}`, lat, lng, { morningEta: '08:00', eveningEta: '18:30' }));
        }
    }, [pinMode, pickupStops.length, officeStops.length, applyOffice, applyPickup]);

    const handleRemovePickup = useCallback((id: string) => {
        setPickupStops((prev) => {
            const updated = prev.filter((s) => s.id !== id);
            schedulePolylineUpdate([...updated, ...officeStops]);
            return updated;
        });
    }, [officeStops, schedulePolylineUpdate]);

    const handleRemoveOffice = useCallback((id: string) => {
        setOfficeStops((prev) => {
            const updated = prev.filter((s) => s.id !== id);
            schedulePolylineUpdate([...pickupStops, ...updated]);
            return updated;
        });
    }, [pickupStops, schedulePolylineUpdate]);

    const handlePickupChange = useCallback((id: string, field: keyof Stop, value: string) => {
        setPickupStops((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    }, []);

    const handleOfficeChange = useCallback((id: string, field: keyof Stop, value: string) => {
        setOfficeStops((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    }, []);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!name || !companyId) { toast.error('Please fill in required fields'); return; }
        if (officeStops.length < 1) { toast.error('Set at least one company office stop — it is required'); return; }
        if (pickupStops.length < 1) { toast.error('Add at least one employee pickup stop'); return; }

        try {
            await dispatch(createAdminRoute({
                name,
                company_id: Number(companyId),
                assigned_vehicle_id: assignedVehicleId ? Number(assignedVehicleId) : undefined,
                assigned_driver_id: assignedDriverId || undefined,
                evening_vehicle_id: eveningVehicleId ? Number(eveningVehicleId) : undefined,
                evening_driver_id: eveningDriverId || undefined,
                stops: [
                    ...pickupStops.map((stop, index) => ({
                        name: stop.name,
                        lat: stop.lat,
                        lng: stop.lng,
                        morning_eta: stop.direction !== 'EVENING' ? stop.morningEta : undefined,
                        evening_eta: stop.direction !== 'MORNING' ? stop.eveningEta : undefined,
                        sequence_order: index + 1,
                        direction: stop.direction,
                        stop_type: 'PICKUP' as const,
                    })),
                    ...officeStops.map((stop, index) => ({
                        name: stop.name,
                        lat: stop.lat,
                        lng: stop.lng,
                        morning_eta: stop.morningEta,
                        evening_eta: stop.eveningEta,
                        sequence_order: pickupStops.length + index + 1,
                        direction: 'BOTH' as const,
                        stop_type: 'OFFICE' as const,
                    })),
                ],
            })).unwrap();
            toast.success('Route created successfully!');
            router.push('/admin/routes');
        } catch (error: unknown) {
            toast.error(typeof error === 'string' ? error : 'Failed to create route');
        }
    };

    const mapMarkers: MapMarker[] = [
        ...pickupStops.map((s, index) => ({
            id: s.id,
            position: [s.lat, s.lng] as [number, number],
            label: `${index + 1}. ${s.name}`,
            color: MAP_COLORS.pickup,
        })),
        ...officeStops.map((s) => ({
            id: s.id,
            position: [s.lat, s.lng] as [number, number],
            label: `Office · ${s.name}`,
            color: MAP_COLORS.office,
        })),
    ];

    const mapPolylines: MapPolyline[] = routePolyline.length >= 2
        ? [{ positions: routePolyline, color: MAP_COLORS.route }]
        : orderedStops.length > 1
        ? [{ positions: orderedStops.map((s) => [s.lat, s.lng] as [number, number]), color: MAP_COLORS.fallback, dashArray: '6 6' }]
        : [];

    const mapCenter: [number, number] | undefined = officeStops[0]
        ? [officeStops[0].lat, officeStops[0].lng]
        : pickupStops[0]
        ? [pickupStops[0].lat, pickupStops[0].lng]
        : undefined;

    const missing: string[] = [];
    if (!name.trim()) missing.push('Route name');
    if (!companyId) missing.push('Company');
    if (officeStops.length === 0) missing.push('At least one office');
    if (pickupStops.length < 1) missing.push('A pickup');
    const canSave = missing.length === 0;
    const isSaving = routeActionStatus === 'loading';

    const driverOptions = drivers.map((d) => (
        <option key={d.id} value={d.id}>{d.full_name}</option>
    ));
    const vehicleOptions = vehicles.map((v) => (
        <option key={v.id} value={v.id}>
            {v.plate_number}{v.model ? ` · ${v.model}` : ''}
        </option>
    ));

    return (
        <div className="space-y-6">
            <PageHeader
                back={{ href: '/admin/routes', label: 'Back to routes' }}
                title="New route"
                description="Offices are always last in the morning and first in the evening."
                actions={
                    <>
                        <Button variant="outline" onClick={() => router.back()} disabled={isSaving}>Cancel</Button>
                        <Button onClick={() => void handleSubmit()} disabled={!canSave} loading={isSaving}>
                            Save route
                        </Button>
                    </>
                }
                meta={
                    !canSave ? (
                        <>
                            <span className="text-xs text-fg-muted">Still need:</span>
                            {missing.map((item) => (
                                <Badge key={item} tone="warning" size="sm">{item}</Badge>
                            ))}
                        </>
                    ) : (
                        <Badge tone="success" size="sm" dot>Ready to save</Badge>
                    )
                }
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
                <Card className="lg:order-1">
                    <CardContent className="space-y-6">
                        <section className="space-y-3">
                            <SectionTitle>1. Company &amp; name</SectionTitle>
                            <Field label="Route name" required>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gulshan to office" />
                            </Field>
                            <Field label="Company" required>
                                <Select
                                    placeholder="Select company"
                                    value={companyId}
                                    onChange={(e) => setCompanyId(e.target.value)}
                                    disabled={companiesStatus === 'loading'}
                                >
                                    {companies.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </Select>
                            </Field>
                        </section>

                        <section className="space-y-3">
                            <SectionTitle>Add stops</SectionTitle>
                            <Tabs value={pinMode} onValueChange={(v) => setPinMode(v as PinMode)}>
                                <TabsList variant="pills" className="w-full" aria-label="What the next pin adds">
                                    <TabsTrigger value="office" icon={<Building2 />} className="flex-1 justify-center">Set office</TabsTrigger>
                                    <TabsTrigger value="pickup" icon={<MapPin />} className="flex-1 justify-center">Add pickup</TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <div className="flex flex-col gap-1.5">
                                <Label>{pinMode === 'office' ? 'Search office address' : 'Search employee pickup'}</Label>
                                <StopAddressSearch
                                    onSelect={handleAddressSelect}
                                    placeholder={pinMode === 'office' ? 'Search office / HQ…' : 'Search pickup…'}
                                    clearOnSelect
                                />
                                <p className="text-xs text-fg-muted">
                                    Or click the map to pin the {pinMode === 'office' ? 'office' : 'pickup'}.
                                </p>
                            </div>
                        </section>

                        <section className="space-y-2">
                            <SectionTitle extra={<Badge tone="warning" size="sm">At least 1 required</Badge>}>
                                2. Office{officeStops.length !== 1 ? 's' : ''}{officeStops.length > 0 ? ` (${officeStops.length})` : ''}
                            </SectionTitle>
                            {officeStops.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-line bg-subtle p-4 text-center">
                                    <p className="text-sm font-medium text-fg">No office set yet</p>
                                    <p className="mt-1 text-xs text-fg-muted">
                                        Switch to Set office, then search or click the map. Add more than one if this route serves multiple offices.
                                    </p>
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {officeStops.map((stop) => (
                                        <li key={stop.id} className="rounded-lg border border-brand-line bg-brand-soft/40 p-3">
                                            <div className="mb-2 flex items-start gap-2">
                                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden="true">
                                                    <Building2 className="size-4" />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <Field label="Office name">
                                                        <Input value={stop.name} onChange={(e) => handleOfficeChange(stop.id, 'name', e.target.value)} className="h-8 font-medium" />
                                                    </Field>
                                                    <p className="mt-1 text-[11px] text-fg-muted">People board at pickups only — no employee assignment here.</p>
                                                </div>
                                                <IconButton label={`Remove office ${stop.name}`} size="icon-sm" variant="ghost" onClick={() => handleRemoveOffice(stop.id)}>
                                                    <Trash2 />
                                                </IconButton>
                                            </div>
                                            <FormGrid cols={2} className="gap-2 pl-10">
                                                <Field label="Morning arrival">
                                                    <Input type="time" value={stop.morningEta} onChange={(e) => handleOfficeChange(stop.id, 'morningEta', e.target.value)} className="h-8" />
                                                </Field>
                                                <Field label="Evening departure">
                                                    <Input type="time" value={stop.eveningEta} onChange={(e) => handleOfficeChange(stop.id, 'eveningEta', e.target.value)} className="h-8" />
                                                </Field>
                                            </FormGrid>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="space-y-2">
                            <SectionTitle>3. Pickups ({pickupStops.length})</SectionTitle>
                            {pickupStops.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-fg-muted">
                                    No pickups yet — use Add pickup or the map.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {pickupStops.map((stop, index) => (
                                        <li key={stop.id} className="rounded-lg border border-line bg-subtle p-3">
                                            <div className="mb-2 flex items-center gap-2">
                                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-info text-xs font-semibold text-white" aria-hidden="true">
                                                    {index + 1}
                                                </span>
                                                <Input
                                                    aria-label={`Pickup ${index + 1} name`}
                                                    value={stop.name}
                                                    onChange={(e) => handlePickupChange(stop.id, 'name', e.target.value)}
                                                    className="h-8 flex-1"
                                                />
                                                <IconButton label={`Remove pickup ${stop.name}`} size="icon-sm" variant="ghost" onClick={() => handleRemovePickup(stop.id)}>
                                                    <Trash2 />
                                                </IconButton>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 pl-8 sm:grid-cols-3">
                                                <Field label="When">
                                                    <Select
                                                        value={stop.direction}
                                                        onChange={(e) => handlePickupChange(stop.id, 'direction', e.target.value)}
                                                        className="h-8"
                                                    >
                                                        <option value="BOTH">Both</option>
                                                        <option value="MORNING">Morning only</option>
                                                        <option value="EVENING">Evening only</option>
                                                    </Select>
                                                </Field>
                                                {stop.direction !== 'EVENING' && (
                                                    <Field label="Morning time">
                                                        <Input type="time" value={stop.morningEta} onChange={(e) => handlePickupChange(stop.id, 'morningEta', e.target.value)} className="h-8" />
                                                    </Field>
                                                )}
                                                {stop.direction !== 'MORNING' && (
                                                    <Field label="Evening time">
                                                        <Input type="time" value={stop.eveningEta} onChange={(e) => handlePickupChange(stop.id, 'eveningEta', e.target.value)} className="h-8" />
                                                    </Field>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="space-y-3">
                            <div>
                                <SectionTitle>4. Usual driver &amp; vehicle (optional)</SectionTitle>
                                <p className="mt-0.5 text-xs text-fg-muted">
                                    Leave evening empty to use the same driver and vehicle as morning.
                                </p>
                            </div>
                            <FormGrid cols={2} className="gap-3">
                                <Field label="Morning driver">
                                    <Select placeholder="None" value={assignedDriverId} onChange={(e) => setAssignedDriverId(e.target.value)}>
                                        {driverOptions}
                                    </Select>
                                </Field>
                                <Field label="Morning vehicle">
                                    <Select placeholder="None" value={assignedVehicleId} onChange={(e) => setAssignedVehicleId(e.target.value)}>
                                        {vehicleOptions}
                                    </Select>
                                </Field>
                                <Field label="Evening driver">
                                    <Select placeholder="Same as morning" value={eveningDriverId} onChange={(e) => setEveningDriverId(e.target.value)}>
                                        {driverOptions}
                                    </Select>
                                </Field>
                                <Field label="Evening vehicle">
                                    <Select placeholder="Same as morning" value={eveningVehicleId} onChange={(e) => setEveningVehicleId(e.target.value)}>
                                        {vehicleOptions}
                                    </Select>
                                </Field>
                            </FormGrid>
                        </section>

                        {officeStops.length > 0 && pickupStops.length > 0 && (
                            <section className="rounded-lg border border-line bg-subtle p-3 text-xs text-fg-secondary">
                                <p className="mb-2 font-semibold text-fg">Order on save</p>
                                <p>
                                    <span className="font-medium">Morning → </span>
                                    {pickupStops.map((s) => s.name).join(' → ')} → {officeStops.map((s) => s.name).join(', ')}
                                </p>
                                <p className="mt-1">
                                    <span className="font-medium">Evening → </span>
                                    {officeStops.map((s) => s.name).join(', ')} → {[...pickupStops].reverse().map((s) => s.name).join(' → ')}
                                </p>
                                <p className="mt-2 text-fg-muted">
                                    Pickup order is auto-optimized on save; evening is the reverse of morning.
                                    {officeStops.length > 1 && ' Multiple offices are placed after pickups — adjust exact positions from Manage Stops after creating the route.'}
                                </p>
                            </section>
                        )}
                    </CardContent>
                </Card>

                <Card className="overflow-hidden lg:sticky lg:top-20 lg:order-2 lg:col-span-2">
                    <CardHeader
                        title="Map"
                        description={orderedStops.length >= 2 ? 'Road-following route via Google Maps' : 'Click the map to pin a stop'}
                        actions={
                            <ul className="flex items-center gap-3 text-[11px] font-medium text-fg-secondary" aria-label="Map legend">
                                <li className="inline-flex items-center gap-1.5">
                                    <span className="size-2.5 rounded-full" style={{ backgroundColor: MAP_COLORS.office }} aria-hidden="true" /> Office
                                </li>
                                <li className="inline-flex items-center gap-1.5">
                                    <span className="size-2.5 rounded-full" style={{ backgroundColor: MAP_COLORS.pickup }} aria-hidden="true" /> Pickups
                                </li>
                            </ul>
                        }
                    />
                    <div className="h-[320px] sm:h-[420px] lg:h-[calc(100vh-16rem)] lg:min-h-[420px]">
                        <Map
                            height="100%"
                            onMapClick={handleMapClick}
                            markers={mapMarkers}
                            polylines={mapPolylines}
                            center={mapCenter}
                        />
                    </div>
                </Card>
            </div>
        </div>
    );
}
