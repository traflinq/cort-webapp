'use client';

import { useCallback, useEffect, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/app/lib/store/hooks';
import {
    fetchAdminRoute,
    updateAdminRoute,
    optimizeAdminRoute,
    deleteAdminRoute,
    createRouteStop,
    updateRouteStop,
    deleteRouteStop,
    selectCurrentRoute,
    selectAdminRoutesStatus,
    selectAdminRoutesActionStatus,
    clearCurrentRoute,
    routeStatus,
} from '@/app/lib/store/slices/adminRoutesSlice';
import { fetchAdminDrivers, selectAdminDrivers } from '@/app/lib/store/slices/adminDriversSlice';
import { fetchAdminVehicles, selectAdminVehicles } from '@/app/lib/store/slices/adminVehiclesSlice';
import StopAddressSearch from '@/app/admin/ui/StopAddressSearch';
import RosteringTab from './components/RosteringTab';
import ManageStopsTab from './components/ManageStopsTab';
import { Info, Plus, Save, Trash2, Users, X, ListOrdered, Sparkles, Building2, Sun, Sunset, Pencil, MapPin, Route as RouteIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiClient } from '@/app/lib/services/api-client';
import { DriverType } from '@/app/lib/services/types/drivers';
import type { MapMarker, MapPolyline, MapPolygon } from '@/app/admin/ui/Map';
import { useAuth } from '@/app/lib/contexts/auth-context';
import { useConfirm } from '@/app/lib/hooks/useConfirm';
import { PermissionGate } from '@/app/admin/components/PermissionGate';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardSkeleton,
    EmptyState,
    Field,
    FormGrid,
    IconButton,
    Input,
    Label,
    PageHeader,
    Select,
    StatusBadge,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Tooltip,
    usePageBreadcrumbs,
} from '@/app/admin/ui';
import { MAP_COLORS, format12h, toClockHHmm } from '../RouteCommandBar';
import { getOfficeStops } from '@/app/lib/utils/routeStops';
import {
    hasValidOfficeGeofence,
    latLngRingToCompletionCoords,
    parseOfficeGeofenceRing,
    type LatLngCoord,
} from '@/app/lib/utils/officeGeofence';

const Map = dynamic(() => import('@/app/admin/ui/Map'), { ssr: false });

type PolylineResponse = { points: { lat: number; lng: number }[] };
type DetailTab = 'overview' | 'stops' | 'rostering';
type VehicleOption = { id: number; plate_number?: string; model?: string };

function DetailField({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
    return (
        <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-fg">{value}</dd>
            {hint && <dd className="mt-0.5 text-xs text-fg-muted">{hint}</dd>}
        </div>
    );
}

export default function RouteDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const dispatch = useAppDispatch();
    const confirm = useConfirm();
    const route = useAppSelector(selectCurrentRoute);
    const officeStopIds = new Set(getOfficeStops(route?.route_stops ?? []).map((s) => s.id));
    const hasMultipleOffices = officeStopIds.size > 1;
    const status = useAppSelector(selectAdminRoutesStatus);
    const drivers = useAppSelector(selectAdminDrivers);
    const vehicles = useAppSelector(selectAdminVehicles);
    const actionStatus = useAppSelector(selectAdminRoutesActionStatus);

    const { hasCrud } = useAuth();
    const canEditRoutes =
        hasCrud('routes', 'create') ||
        hasCrud('routes', 'update') ||
        hasCrud('routes', 'delete');

    usePageBreadcrumbs(route ? [{ label: route.name }] : null);

    const [isOptimizing, setIsOptimizing] = useState(false);
    const [activeTab, setActiveTab] = useState<DetailTab>('overview');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        assigned_vehicle_id: '',
        assigned_driver_id: '',
        evening_vehicle_id: '',
        evening_driver_id: '',
        evening_lock_time: '',
        is_active: true,
    });
    const [currentAssignedVehicle, setCurrentAssignedVehicle] = useState<VehicleOption | null>(null);
    const [currentEveningVehicle, setCurrentEveningVehicle] = useState<VehicleOption | null>(null);

    // Direction toggle for the overview map
    const [mapDirection, setMapDirection] = useState<'MORNING' | 'EVENING'>('MORNING');
    const [highlightedStopId, setHighlightedStopId] = useState<number | null>(null);

    // Stop form
    const [editingStopId, setEditingStopId] = useState<number | null>(null);
    const [isAddingStop, setIsAddingStop] = useState(false);
    const [isSavingStop, setIsSavingStop] = useState(false);
    const [stopForm, setStopForm] = useState({
        name: '',
        lat: '',
        lng: '',
        sequence_order: '',
        stopType: 'PICKUP' as 'PICKUP' | 'OFFICE',
    });
    const [geofenceMode, setGeofenceMode] = useState(false);
    const [geofenceCoords, setGeofenceCoords] = useState<LatLngCoord[]>([]);

    // Road-following polyline for the saved route stops
    const [savedPolyline, setSavedPolyline] = useState<[number, number][]>([]);
    const polylineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (id) dispatch(fetchAdminRoute(parseInt(id)));
        return () => { dispatch(clearCurrentRoute()); };
    }, [dispatch, id]);

    // Reset overview stop editor when the route id changes (render-time state adjustment).
    const [prevId, setPrevId] = useState(id);
    if (prevId !== id) {
        setPrevId(id);
        setEditingStopId(null);
        setIsAddingStop(false);
        setIsEditing(false);
        setStopForm({ name: '', lat: '', lng: '', sequence_order: '', stopType: 'PICKUP' });
        setGeofenceMode(false);
        setGeofenceCoords([]);
        setActiveTab('overview');
    }

    const fetchSavedPolyline = async () => {
        if (!id) return;
        try {
            const data = await apiClient.request<PolylineResponse>(`/routes/${id}/polyline?direction=${mapDirection}`);
            setSavedPolyline(data.points.map((p) => [p.lat, p.lng] as [number, number]));
        } catch {
            setSavedPolyline([]);
        }
    };

    // Load drivers and vehicles for assignment editing
    useEffect(() => {
        // Only show shuttle drivers for shuttle routes
        dispatch(fetchAdminDrivers({ limit: 100, driver_type: DriverType.SHUTTLE }));
        dispatch(fetchAdminVehicles({ limit: 100 }));
    }, [dispatch]);

    // Hydrate the edit form whenever the route's editable fields change.
    const routeFieldsKey = route
        ? [route.id, route.assigned_vehicle_id, route.assigned_driver_id, route.evening_vehicle_id, route.evening_driver_id, route.name, route.evening_lock_time, route.is_active].join('|')
        : '';
    const [prevRouteFieldsKey, setPrevRouteFieldsKey] = useState(routeFieldsKey);
    if (prevRouteFieldsKey !== routeFieldsKey) {
        setPrevRouteFieldsKey(routeFieldsKey);
        if (route) {
            setEditForm({
                name: route.name,
                assigned_vehicle_id: route.assigned_vehicle_id?.toString() || '',
                assigned_driver_id: route.assigned_driver_id?.toString() || '',
                evening_vehicle_id: route.evening_vehicle_id?.toString() || '',
                evening_driver_id: route.evening_driver_id?.toString() || '',
                evening_lock_time: toClockHHmm(route.evening_lock_time) || '',
                is_active: route.is_active !== false,
            });
        }
    }

    // Load the road-following polyline for the saved stops whenever the route or the
    // direction toggle changes. State is set only in the promise callbacks.
    useEffect(() => {
        if (!routeFieldsKey || !id) return;
        let cancelled = false;
        apiClient
            .request<PolylineResponse>(`/routes/${id}/polyline?direction=${mapDirection}`)
            .then((data) => {
                if (!cancelled) setSavedPolyline(data.points.map((p) => [p.lat, p.lng] as [number, number]));
            })
            .catch(() => {
                if (!cancelled) setSavedPolyline([]);
            });
        return () => {
            cancelled = true;
        };
    }, [routeFieldsKey, mapDirection, id]);

    // If the currently-assigned vehicle is excluded from the "available vehicles" list,
    // we still want it to remain selectable/visible in the edit dropdown.
    useEffect(() => {
        let cancelled = false;
        const ids = [route?.assigned_vehicle_id, route?.evening_vehicle_id].filter(
            (id, i, arr): id is number => id != null && arr.indexOf(id) === i,
        );
        if (ids.length === 0) return;
        (async () => {
            const results = await Promise.all(
                ids.map(async (vehicleId) => {
                    try {
                        const res = (await apiClient.getVehicle(vehicleId)) as { data?: VehicleOption } | VehicleOption;
                        const v = (res as { data?: VehicleOption })?.data ?? (res as VehicleOption);
                        return { vehicleId, v: v ?? null };
                    } catch {
                        return { vehicleId, v: null };
                    }
                }),
            );
            if (cancelled) return;
            setCurrentAssignedVehicle(results.find((r) => r.vehicleId === route?.assigned_vehicle_id)?.v ?? null);
            setCurrentEveningVehicle(results.find((r) => r.vehicleId === route?.evening_vehicle_id)?.v ?? null);
        })();
        return () => {
            cancelled = true;
        };
    }, [route?.assigned_vehicle_id, route?.evening_vehicle_id]);

    // Only trust the fetched extras while the route still references them.
    const effectiveAssignedVehicle = route?.assigned_vehicle_id ? currentAssignedVehicle : null;
    const effectiveEveningVehicle = route?.evening_vehicle_id ? currentEveningVehicle : null;

    const vehiclesForSelect: VehicleOption[] = (() => {
        const extra = [effectiveAssignedVehicle, effectiveEveningVehicle].filter(
            (v): v is VehicleOption => Boolean(v?.id),
        );
        const ids = new Set(vehicles.map((v: { id?: number }) => v?.id));
        const merged: VehicleOption[] = [...vehicles];
        for (const v of extra) {
            if (!ids.has(v.id)) {
                ids.add(v.id);
                merged.push(v);
            }
        }
        return merged;
    })();

    // Keep currently-assigned drivers visible even if filtered out of the shuttle list
    const driversForSelect = (() => {
        const extras: Array<{ id: string; full_name?: string; phone?: string }> = [];
        const morningId = route?.assigned_driver_id;
        const eveningId = route?.evening_driver_id;
        if (morningId && !drivers.some((d) => d.id === morningId) && route?.users) {
            extras.push({ id: morningId, full_name: route.users.full_name, phone: route.users.phone });
        }
        if (eveningId && !drivers.some((d) => d.id === eveningId) && !extras.some((e) => e.id === eveningId) && route?.evening_driver) {
            extras.push({ id: eveningId, full_name: route.evening_driver.full_name, phone: route.evening_driver.phone });
        }
        return extras.length ? [...drivers, ...(extras as (typeof drivers)[number][])] : drivers;
    })();

    const hydrateEditFormFromRoute = () => {
        if (!route) return;
        setEditForm({
            name: route.name,
            assigned_vehicle_id: route.assigned_vehicle_id?.toString() || '',
            assigned_driver_id: route.assigned_driver_id?.toString() || '',
            evening_vehicle_id: route.evening_vehicle_id?.toString() || '',
            evening_driver_id: route.evening_driver_id?.toString() || '',
            evening_lock_time: toClockHHmm(route.evening_lock_time) || '',
            is_active: route.is_active !== false,
        });
    };

    const handleCancelEdit = () => {
        hydrateEditFormFromRoute();
        setIsEditing(false);
    };

    // Direction toggle: clear the stale polyline immediately so the fallback renders the
    // correct direction (the effect above re-fetches the road-following one).
    const [prevMapDirection, setPrevMapDirection] = useState(mapDirection);
    if (prevMapDirection !== mapDirection) {
        setPrevMapDirection(mapDirection);
        setSavedPolyline([]);
    }

    const schedulePolylineRefresh = () => {
        setSavedPolyline([]); // clear stale polyline immediately
        if (polylineDebounceRef.current) clearTimeout(polylineDebounceRef.current);
        polylineDebounceRef.current = setTimeout(() => void fetchSavedPolyline(), 3000);
    };

    // ---- Stop form helpers -----------------------------------------------

    const resetStopForm = () => {
        setStopForm({ name: '', lat: '', lng: '', sequence_order: '', stopType: 'PICKUP' });
        setGeofenceMode(false);
        setGeofenceCoords([]);
        setEditingStopId(null);
        setIsAddingStop(false);
    };

    const isOfficeStopForm =
        stopForm.stopType === 'OFFICE' ||
        (editingStopId != null && officeStopIds.has(editingStopId));

    const handleStopEditClick = (stop: { id: number; name: string; lat?: number | null; lng?: number | null; sequence_order?: number | null; completion_geofence_geojson?: unknown }) => {
        setStopForm({
            name: stop.name,
            lat: stop.lat?.toString() || '',
            lng: stop.lng?.toString() || '',
            sequence_order: stop.sequence_order?.toString() || '0',
            stopType: officeStopIds.has(stop.id) ? 'OFFICE' : 'PICKUP',
        });
        setGeofenceCoords(parseOfficeGeofenceRing(stop.completion_geofence_geojson as Parameters<typeof parseOfficeGeofenceRing>[0]));
        setGeofenceMode(false);
        setEditingStopId(stop.id);
        setIsAddingStop(false);
    };

    const handleStopAddClick = () => {
        resetStopForm();
        const maxOrder = route?.route_stops?.reduce((max, s) => Math.max(max, s.sequence_order), 0) || 0;
        setStopForm((prev) => ({ ...prev, sequence_order: (maxOrder + 1).toString() }));
        setIsAddingStop(true);
    };

    const handleStopFormTypeChange = (stopType: 'PICKUP' | 'OFFICE') => {
        setStopForm((prev) => ({ ...prev, stopType }));
        if (stopType !== 'OFFICE') {
            setGeofenceMode(false);
            setGeofenceCoords([]);
        }
    };

    // Fill form from address search selection
    const handleAddressSelect = useCallback(({ name, lat, lng }: { name: string; lat: number; lng: number }) => {
        setStopForm((prev) => ({
            ...prev,
            name,
            lat: lat.toFixed(6),
            lng: lng.toFixed(6),
        }));
    }, []);

    const handleStopSubmit = async () => {
        if (!canEditRoutes) return;
        if (!route) return;
        if (!stopForm.name || !stopForm.lat || !stopForm.lng) {
            toast.error('Name and location are required');
            return;
        }
        const lat = parseFloat(stopForm.lat);
        const lng = parseFloat(stopForm.lng);
        // Timing (morning/evening ETA), direction, and ordering are intentionally not set
        // here — this page only pins the stop and its type. Operations sets timing and
        // rearranges order from the Stops tab, where a new stop defaults to both directions.
        const data: Record<string, unknown> = {
            name: stopForm.name,
            lat,
            lng,
            sequence_order: parseInt(stopForm.sequence_order) || 0,
        };
        // Only sent when adding — editing an existing stop never changes its type here
        // (converting an existing pickup/office is done from the Stops tab instead).
        if (isAddingStop) {
            data.stop_type = stopForm.stopType;
        }
        if (isOfficeStopForm) {
            data.completion_geofence_coords = hasValidOfficeGeofence(geofenceCoords)
                ? latLngRingToCompletionCoords(geofenceCoords)
                : [];
        }
        // Duplicate guard: prevent adding a stop at the exact same lat/lng as an existing one
        if (isAddingStop) {
            const duplicate = route.route_stops?.find(
                (s) =>
                    Math.abs((s.lat ?? 0) - lat) < 0.0001 &&
                    Math.abs((s.lng ?? 0) - lng) < 0.0001
            );
            if (duplicate) {
                toast.error(`A stop at this location already exists: "${duplicate.name}"`);
                return;
            }
        }
        try {
            setIsSavingStop(true);
            if (isAddingStop) {
                await dispatch(createRouteStop({ routeId: route.id, data })).unwrap();
                toast.success('Stop added');
            } else if (editingStopId) {
                await dispatch(updateRouteStop({ stopId: editingStopId, routeId: route.id, data })).unwrap();
                toast.success('Stop updated');
            }
            resetStopForm();
            schedulePolylineRefresh();
        } catch {
            toast.error('Failed to save stop');
        } finally {
            setIsSavingStop(false);
        }
    };

    const handleDeleteRoute = async () => {
        if (!route) return;
        const ok = await confirm({
            title: `Delete route "${route.name}"?`,
            message: 'This permanently deletes the route.',
            consequences: [
                `All ${route.route_stops?.length ?? 0} stops on this route are deleted`,
                'The standing roster for this route is removed',
                "It disappears from trip scheduling and today's plan",
                'This cannot be undone',
            ],
            destructive: true,
            confirmLabel: 'Delete route',
            typeToConfirm: 'DELETE',
        });
        if (!ok) return;
        try {
            await dispatch(deleteAdminRoute(route.id)).unwrap();
            toast.success('Route deleted');
            router.replace('/admin/routes');
        } catch {
            toast.error('Failed to delete route');
        }
    };

    const handleStopDelete = async (stopId: number) => {
        if (!canEditRoutes) return;
        if (officeStopIds.has(stopId)) {
            toast.error('Cannot delete the company office stop. Edit its location instead.');
            return;
        }
        if (!route) return;
        const stop = route.route_stops?.find((s) => s.id === stopId);
        const ok = await confirm({
            title: `Delete stop "${stop?.name ?? ''}"?`,
            message: 'The stop is removed from this route.',
            consequences: [
                'It is removed from both the morning and evening order',
                'Anyone rostered at this pickup must be reassigned',
                'This cannot be undone',
            ],
            destructive: true,
            confirmLabel: 'Delete stop',
        });
        if (!ok) return;
        try {
            await dispatch(deleteRouteStop({ stopId, routeId: route.id })).unwrap();
            toast.success('Stop deleted');
            if (editingStopId === stopId) resetStopForm();
            schedulePolylineRefresh();
        } catch {
            toast.error('Failed to delete stop');
        }
    };

    const handleClearGeofence = async () => {
        const ok = await confirm({
            title: 'Clear the office geofence?',
            message: 'All points in this draft polygon are removed.',
            consequences: [
                'Takes effect when you save the stop',
                'Until a new polygon is saved, drivers can complete the morning trip without being inside an office area',
            ],
            destructive: true,
            confirmLabel: 'Clear geofence',
        });
        if (!ok) return;
        setGeofenceCoords([]);
        setGeofenceMode(false);
    };

    const handleMarkerClick = (markerId: string) => {
        if (markerId === 'new-temp') return;
        const id = parseInt(markerId, 10);
        if (!Number.isFinite(id)) return;
        const stop = route?.route_stops?.find((s) => s.id === id);
        if (!stop) return;
        setHighlightedStopId(id);
    };

    useEffect(() => {
        if (highlightedStopId == null) return;
        const el = document.getElementById(`overview-stop-${highlightedStopId}`);
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [highlightedStopId]);

    const handleMapClick = (lat: number, lng: number) => {
        if (geofenceMode && isOfficeStopForm) {
            setGeofenceCoords((prev) => [...prev, [lat, lng]]);
            toast.info(`Geofence point ${geofenceCoords.length + 1} added`);
            return;
        }

        if (isAddingStop || editingStopId) {
            setStopForm((prev) => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
            toast.info('Coordinates updated from map click');
        }
    };

    const handleOptimizeRoute = async () => {
        if (!canEditRoutes || !route) return;
        setIsOptimizing(true);
        try {
            await dispatch(optimizeAdminRoute(route.id)).unwrap();
            toast.success('Route optimized — morning pickups reordered, evening reversed');
            schedulePolylineRefresh();
        } catch (err: unknown) {
            toast.error(typeof err === 'string' ? err : 'Failed to optimize route');
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleSaveDetails = async () => {
        if (!canEditRoutes) return;
        if (!route) return;
        try {
            await dispatch(updateAdminRoute({
                id: route.id,
                data: {
                    name: editForm.name,
                    // null clears the FK; undefined would omit the key and leave the old assignment
                    assigned_vehicle_id: editForm.assigned_vehicle_id
                        ? parseInt(editForm.assigned_vehicle_id, 10)
                        : null,
                    assigned_driver_id: editForm.assigned_driver_id || null,
                    evening_vehicle_id: editForm.evening_vehicle_id
                        ? parseInt(editForm.evening_vehicle_id, 10)
                        : null,
                    evening_driver_id: editForm.evening_driver_id || null,
                    evening_lock_time: editForm.evening_lock_time.trim() || null,
                    is_active: editForm.is_active,
                },
            })).unwrap();

            setIsEditing(false);
            toast.success('Route details updated');
        } catch {
            toast.error('Failed to update route');
        }
    };

    // ---- Map data ------------------------------------------------------------

    const mapMarkers: MapMarker[] = (() => {
        const base: MapMarker[] = (route?.route_stops ?? [])
            .filter((s) => {
                if (s.lat == null || s.lng == null || isNaN(Number(s.lat)) || isNaN(Number(s.lng))) return false;
                // Only show stops that belong to the active direction
                return mapDirection === 'MORNING'
                    ? s.morning_sequence != null
                    : s.evening_sequence != null;
            })
            .sort((a, b) =>
                mapDirection === 'MORNING'
                    ? (a.morning_sequence ?? 0) - (b.morning_sequence ?? 0)
                    : (a.evening_sequence ?? 0) - (b.evening_sequence ?? 0)
            )
            .map((s) => {
                const isOffice = officeStopIds.has(s.id);
                if (editingStopId === s.id && stopForm.lat && stopForm.lng) {
                    return {
                        id: s.id.toString(),
                        position: [parseFloat(stopForm.lat), parseFloat(stopForm.lng)] as [number, number],
                        label: isOffice ? `Office · ${stopForm.name || s.name}` : (stopForm.name || s.name),
                        color: MAP_COLORS.editing,
                    };
                }
                return {
                    id: s.id.toString(),
                    position: [s.lat, s.lng] as [number, number],
                    label: isOffice
                        ? `Office · ${s.name}`
                        : `${mapDirection === 'MORNING' ? (s.morning_sequence ?? s.sequence_order) : (s.evening_sequence ?? s.sequence_order)}. ${s.name}`,
                    color: highlightedStopId === s.id
                        ? MAP_COLORS.highlighted
                        : isOffice ? MAP_COLORS.office : MAP_COLORS.pickup,
                };
            });

        if (isAddingStop && stopForm.lat && stopForm.lng) {
            base.push({
                id: 'new-temp',
                position: [parseFloat(stopForm.lat), parseFloat(stopForm.lng)],
                label: stopForm.name || 'New Stop',
                color: MAP_COLORS.draft,
            });
        }
        return base;
    })();

    // Use road-following polyline; fall back to straight-line for the active direction while it loads
    const mapPolylines: MapPolyline[] = savedPolyline.length >= 2
        ? [{ positions: savedPolyline, color: MAP_COLORS.route }]
        : (() => {
            const dirStops = (route?.route_stops ?? []).filter(
                (s) => s.lat != null && s.lng != null &&
                    (mapDirection === 'MORNING' ? s.morning_sequence != null : s.evening_sequence != null),
            ).sort((a, b) =>
                mapDirection === 'MORNING'
                    ? (a.morning_sequence ?? 0) - (b.morning_sequence ?? 0)
                    : (a.evening_sequence ?? 0) - (b.evening_sequence ?? 0)
            );
            return dirStops.length > 1
                ? [{ positions: dirStops.map((s) => [s.lat, s.lng] as [number, number]), color: MAP_COLORS.fallback, dashArray: '6 6' }]
                : [];
        })();

    const mapPolygons: MapPolygon[] = (() => {
        const polygons: MapPolygon[] = [];

        for (const stop of route?.route_stops ?? []) {
            if (!officeStopIds.has(stop.id)) continue;
            if (editingStopId === stop.id && isOfficeStopForm) continue;

            const ring = parseOfficeGeofenceRing(stop.completion_geofence_geojson);
            if (!hasValidOfficeGeofence(ring)) continue;

            polygons.push({
                id: `office-geofence-${stop.id}`,
                positions: ring,
                fillColor: MAP_COLORS.geofenceSaved,
                strokeColor: MAP_COLORS.geofenceSaved,
                fillOpacity: 0.12,
            });
        }

        if (isOfficeStopForm && hasValidOfficeGeofence(geofenceCoords)) {
            polygons.push({
                id: 'office-geofence-editing',
                positions: geofenceCoords,
                fillColor: MAP_COLORS.geofence,
                strokeColor: MAP_COLORS.geofence,
                fillOpacity: 0.2,
            });
        } else if (isOfficeStopForm && geofenceCoords.length >= 2) {
            polygons.push({
                id: 'office-geofence-editing-draft',
                positions: geofenceCoords,
                fillColor: MAP_COLORS.geofence,
                strokeColor: MAP_COLORS.geofence,
                fillOpacity: 0.08,
            });
        }

        return polygons;
    })();

    const geofenceVertexMarkers: MapMarker[] =
        isOfficeStopForm && geofenceCoords.length > 0
            ? geofenceCoords.map(([lat, lng], index) => ({
                id: `geofence-vertex-${index}`,
                position: [lat, lng] as [number, number],
                label: String(index + 1),
                color: MAP_COLORS.geofence,
            }))
            : [];

    const overviewMapMarkers = [...mapMarkers, ...geofenceVertexMarkers];

    // ---- Render --------------------------------------------------------------

    if (status === 'loading' || (!route && status === 'idle')) {
        return (
            <div className="space-y-6" aria-busy="true">
                <CardSkeleton lines={1} />
                <CardSkeleton lines={4} />
                <div className="grid gap-4 lg:grid-cols-3">
                    <CardSkeleton lines={6} className="lg:col-span-2" />
                    <CardSkeleton lines={6} />
                </div>
            </div>
        );
    }
    if (!route) {
        return (
            <Card>
                <EmptyState
                    icon={<RouteIcon aria-hidden="true" />}
                    title="Route not found"
                    description="It may have been deleted, or you may not have access to it."
                    action={<Button variant="outline" onClick={() => router.push('/admin/routes')}>Back to routes</Button>}
                />
            </Card>
        );
    }

    const companyName = route.company?.name ?? route.companies?.name ?? 'Company';
    const formatVehicle = (v?: { plate_number?: string; model?: string } | null) =>
        v?.plate_number ? [v.model, v.plate_number].filter(Boolean).join(' · ') : null;
    const morningDriver = route.users?.full_name ?? 'Not set';
    const morningVehicle = formatVehicle(route.vehicles) ?? 'Not set';
    const eveningDriver = route.evening_driver?.full_name
        ?? (route.evening_driver_id ? 'Not set' : 'Same as morning');
    const eveningVehicle = formatVehicle(route.evening_vehicle)
        ?? (route.evening_vehicle_id ? 'Not set' : 'Same as morning');
    const stopCount = route.route_stops?.length || 0;
    const stopFormOpen = isAddingStop || editingStopId != null;

    const directionStops = (route.route_stops ?? [])
        .filter((stop) => (mapDirection === 'MORNING' ? stop.morning_sequence != null : stop.evening_sequence != null))
        .sort((a, b) =>
            mapDirection === 'MORNING'
                ? (a.morning_sequence ?? 0) - (b.morning_sequence ?? 0)
                : (a.evening_sequence ?? 0) - (b.evening_sequence ?? 0),
        );

    const driverOptions = driversForSelect.map((d) => (
        <option key={d.id} value={d.id}>{d.full_name}</option>
    ));
    const vehicleOptions = vehiclesForSelect.map((v) => (
        <option key={v.id} value={v.id}>
            {v.plate_number}{v.model ? ` · ${v.model}` : ''}
        </option>
    ));

    return (
        <PermissionGate permission="routes">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DetailTab)} className="space-y-6">
                <PageHeader
                    back={{ href: '/admin/routes', label: 'Back to routes' }}
                    title={route.name}
                    description={`${companyName} · ${stopCount} ${stopCount === 1 ? 'stop' : 'stops'}`}
                    meta={<StatusBadge status={routeStatus(route)} />}
                    actions={
                        canEditRoutes && !isEditing ? (
                            <>
                                <Tooltip content="Reorders morning pickups from the office outward. Evening is reversed automatically.">
                                    <Button
                                        variant="outline"
                                        onClick={() => void handleOptimizeRoute()}
                                        disabled={stopCount < 3}
                                        loading={isOptimizing}
                                        leftIcon={<Sparkles />}
                                    >
                                        Optimize order
                                    </Button>
                                </Tooltip>
                                <Button variant="danger-outline" onClick={() => void handleDeleteRoute()} disabled={actionStatus === 'loading'} leftIcon={<Trash2 />}>
                                    Delete
                                </Button>
                            </>
                        ) : undefined
                    }
                    tabs={
                        <TabsList aria-label="Route sections">
                            <TabsTrigger value="overview" icon={<Info />}>Overview</TabsTrigger>
                            <TabsTrigger value="stops" icon={<ListOrdered />} count={stopCount}>Stops</TabsTrigger>
                            <TabsTrigger value="rostering" icon={<Users />}>People</TabsTrigger>
                        </TabsList>
                    }
                />

                <TabsContent value="overview" className="mt-0 space-y-4">
                    <Card>
                        <CardHeader
                            title="Route details"
                            description={isEditing ? 'Edit the name and usual crew.' : undefined}
                            actions={
                                canEditRoutes ? (
                                    isEditing ? (
                                        <>
                                            <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={actionStatus === 'loading'}>
                                                Cancel
                                            </Button>
                                            <Button size="sm" onClick={() => void handleSaveDetails()} loading={actionStatus === 'loading'} leftIcon={<Save />}>
                                                Save
                                            </Button>
                                        </>
                                    ) : (
                                        <Button variant="outline" size="sm" onClick={() => { hydrateEditFormFromRoute(); setIsEditing(true); }} leftIcon={<Pencil />}>
                                            Edit route
                                        </Button>
                                    )
                                ) : undefined
                            }
                        />
                        <CardContent>
                            {!isEditing ? (
                                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                                    <DetailField label="Company" value={companyName} />
                                    <DetailField
                                        label="Daily rides"
                                        value={route.is_active === false ? 'Paused' : 'Created daily'}
                                        hint={route.is_active === false ? 'Inactive: no trips are generated for this route' : undefined}
                                    />
                                    <DetailField label="Morning driver" value={morningDriver} />
                                    <DetailField label="Morning vehicle" value={morningVehicle} />
                                    <DetailField label="Evening driver" value={eveningDriver} />
                                    <DetailField label="Evening vehicle" value={eveningVehicle} />
                                    <DetailField
                                        label="Evening lock time"
                                        value={format12h(route.evening_lock_time) || 'Not set'}
                                        hint="Evening return cannot start before this"
                                    />
                                </dl>
                            ) : (
                                <FormGrid cols={3}>
                                    <Field label="Route name" required className="sm:col-span-2 lg:col-span-3">
                                        <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="max-w-xl" />
                                    </Field>
                                    <Field label="Company">
                                        <Input value={companyName} readOnly disabled />
                                    </Field>
                                    <div className="sm:col-span-2 lg:col-span-2">
                                        <Switch
                                            checked={editForm.is_active}
                                            onCheckedChange={(v) => setEditForm({ ...editForm, is_active: v })}
                                            label="Active"
                                            description="Only active routes get shuttle trips created each day. Deactivating also cancels today's and upcoming scheduled trips."
                                        />
                                    </div>
                                    <Field label="Morning driver">
                                        <Select placeholder="None" value={editForm.assigned_driver_id} onChange={(e) => setEditForm({ ...editForm, assigned_driver_id: e.target.value })}>
                                            {driverOptions}
                                        </Select>
                                    </Field>
                                    <Field label="Morning vehicle">
                                        <Select placeholder="None" value={editForm.assigned_vehicle_id} onChange={(e) => setEditForm({ ...editForm, assigned_vehicle_id: e.target.value })}>
                                            {vehicleOptions}
                                        </Select>
                                    </Field>
                                    <Field label="Evening driver">
                                        <Select placeholder="Same as morning" value={editForm.evening_driver_id} onChange={(e) => setEditForm({ ...editForm, evening_driver_id: e.target.value })}>
                                            {driverOptions}
                                        </Select>
                                    </Field>
                                    <Field label="Evening vehicle">
                                        <Select placeholder="Same as morning" value={editForm.evening_vehicle_id} onChange={(e) => setEditForm({ ...editForm, evening_vehicle_id: e.target.value })}>
                                            {vehicleOptions}
                                        </Select>
                                    </Field>
                                    <Field label="Evening lock time" hint="Drivers cannot start evening trips before this time.">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="time"
                                                value={editForm.evening_lock_time}
                                                onChange={(e) => setEditForm({ ...editForm, evening_lock_time: e.target.value })}
                                            />
                                            {editForm.evening_lock_time && (
                                                <Button variant="ghost" size="sm" onClick={() => setEditForm({ ...editForm, evening_lock_time: '' })}>
                                                    Clear
                                                </Button>
                                            )}
                                        </div>
                                    </Field>
                                </FormGrid>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {/* Map */}
                        <div className="flex flex-col gap-2 lg:col-span-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Tabs value={mapDirection} onValueChange={(v) => setMapDirection(v as 'MORNING' | 'EVENING')}>
                                    <TabsList variant="pills" aria-label="Map direction">
                                        <TabsTrigger value="MORNING" icon={<Sun />}>Morning</TabsTrigger>
                                        <TabsTrigger value="EVENING" icon={<Sunset />}>Evening</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <ul className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-fg-secondary" aria-label="Map legend">
                                    <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: MAP_COLORS.office }} aria-hidden="true" /> Office</li>
                                    <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: MAP_COLORS.pickup }} aria-hidden="true" /> Pickup</li>
                                    <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: MAP_COLORS.highlighted }} aria-hidden="true" /> Selected</li>
                                    {stopFormOpen && (
                                        <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: isAddingStop ? MAP_COLORS.draft : MAP_COLORS.editing }} aria-hidden="true" /> {isAddingStop ? 'New stop' : 'Editing'}</li>
                                    )}
                                </ul>
                            </div>
                            <div className="h-[360px] overflow-hidden rounded-xl border border-line sm:h-[460px] lg:h-[520px]">
                                <Map
                                    height="100%"
                                    markers={overviewMapMarkers}
                                    polylines={mapPolylines}
                                    polygons={mapPolygons}
                                    onMarkerClick={handleMarkerClick}
                                    onMapClick={handleMapClick}
                                />
                            </div>
                        </div>

                        {/* Stops panel */}
                        <Card className="flex flex-col lg:max-h-[568px]">
                            <CardHeader
                                title={`${mapDirection === 'MORNING' ? 'Morning' : 'Evening'} stops`}
                                description={`${directionStops.length} on this direction`}
                                actions={
                                    !stopFormOpen && canEditRoutes ? (
                                        <Button size="sm" onClick={handleStopAddClick} leftIcon={<Plus />}>
                                            Add stop
                                        </Button>
                                    ) : undefined
                                }
                            />
                            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                                {stopFormOpen && (
                                    <div className="flex max-h-[340px] shrink-0 flex-col rounded-lg border border-line bg-subtle">
                                        <div className="space-y-3 overflow-y-auto p-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-semibold text-fg">{isAddingStop ? 'New stop' : 'Edit stop'}</h4>
                                                <IconButton label="Close stop form" size="icon-xs" onClick={resetStopForm}>
                                                    <X />
                                                </IconButton>
                                            </div>
                                            {isAddingStop && (
                                                <div className="flex flex-col gap-1.5">
                                                    <Label>Stop type</Label>
                                                    <Tabs value={stopForm.stopType} onValueChange={(v) => handleStopFormTypeChange(v as 'PICKUP' | 'OFFICE')}>
                                                        <TabsList variant="pills" className="bg-card" aria-label="Stop type">
                                                            <TabsTrigger value="PICKUP" icon={<MapPin />}>Pickup</TabsTrigger>
                                                            <TabsTrigger value="OFFICE" icon={<Building2 />}>Office</TabsTrigger>
                                                        </TabsList>
                                                    </Tabs>
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-1.5">
                                                <Label>Search location</Label>
                                                <StopAddressSearch
                                                    onSelect={handleAddressSelect}
                                                    defaultValue={stopForm.name}
                                                    placeholder="Search address..."
                                                />
                                            </div>
                                            <Field label="Stop name" required>
                                                <Input
                                                    className="h-8"
                                                    value={stopForm.name}
                                                    onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                                                    placeholder="e.g. Disco Bakery"
                                                />
                                            </Field>
                                            <FormGrid cols={2} className="gap-2">
                                                <Field label="Latitude">
                                                    <Input className="h-8" mono type="number" step="any" value={stopForm.lat} onChange={(e) => setStopForm({ ...stopForm, lat: e.target.value })} />
                                                </Field>
                                                <Field label="Longitude">
                                                    <Input className="h-8" mono type="number" step="any" value={stopForm.lng} onChange={(e) => setStopForm({ ...stopForm, lng: e.target.value })} />
                                                </Field>
                                            </FormGrid>
                                            <p className="text-[11px] text-fg-muted">
                                                Click the map to set coordinates. Timing and ordering are set from the Stops tab.
                                            </p>
                                            {isOfficeStopForm && (
                                                <div className="space-y-2 rounded-lg border border-brand-line bg-brand-soft p-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <p className="text-xs font-semibold text-fg">Morning completion geofence</p>
                                                            <p className="mt-1 text-[11px] leading-relaxed text-fg-secondary">
                                                                Draw the office approach area on the map. Drivers cannot complete a morning trip until their GPS is inside this polygon.
                                                            </p>
                                                        </div>
                                                        {hasValidOfficeGeofence(geofenceCoords) && (
                                                            <Badge tone="success" size="sm" dot>Configured</Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            variant={geofenceMode ? 'secondary' : 'outline'}
                                                            size="sm"
                                                            aria-pressed={geofenceMode}
                                                            onClick={() => setGeofenceMode((prev) => !prev)}
                                                            disabled={!canEditRoutes}
                                                        >
                                                            {geofenceMode ? 'Stop drawing' : 'Draw on map'}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setGeofenceCoords((prev) => prev.slice(0, -1))}
                                                            disabled={!canEditRoutes || geofenceCoords.length === 0}
                                                        >
                                                            Undo point
                                                        </Button>
                                                        <Button
                                                            variant="danger-outline"
                                                            size="sm"
                                                            onClick={() => void handleClearGeofence()}
                                                            disabled={!canEditRoutes || geofenceCoords.length === 0}
                                                        >
                                                            Clear geofence
                                                        </Button>
                                                    </div>
                                                    <p className="text-[11px] text-fg-muted" aria-live="polite">
                                                        {geofenceMode
                                                            ? 'Click the map to add polygon corners. Add at least 3 points around the reachable office entrance.'
                                                            : `${geofenceCoords.length} point${geofenceCoords.length === 1 ? '' : 's'} in this draft.`}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="border-t border-line p-3">
                                            <Button
                                                className="w-full"
                                                size="sm"
                                                onClick={() => void handleStopSubmit()}
                                                disabled={!canEditRoutes}
                                                loading={isSavingStop}
                                                leftIcon={<Save />}
                                            >
                                                Save stop
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {directionStops.length === 0 ? (
                                    <EmptyState
                                        compact
                                        icon={<MapPin aria-hidden="true" />}
                                        title={`No ${mapDirection === 'MORNING' ? 'morning' : 'evening'} stops`}
                                        description="Add a stop, or switch direction."
                                    />
                                ) : (
                                    <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto" aria-label={`${mapDirection === 'MORNING' ? 'Morning' : 'Evening'} stops`}>
                                        {directionStops.map((stop) => {
                                            const isOffice = officeStopIds.has(stop.id);
                                            const seq = mapDirection === 'MORNING' ? (stop.morning_sequence ?? stop.sequence_order) : (stop.evening_sequence ?? stop.sequence_order);
                                            const isHighlighted = highlightedStopId === stop.id;
                                            const hasGeofence = isOffice && hasValidOfficeGeofence(parseOfficeGeofenceRing(stop.completion_geofence_geojson));
                                            return (
                                                <li
                                                    key={stop.id}
                                                    id={`overview-stop-${stop.id}`}
                                                    onClick={() => setHighlightedStopId(stop.id)}
                                                    className={cn(
                                                        'group rounded-lg border p-3 transition-colors',
                                                        isHighlighted
                                                            ? 'border-purple-line bg-purple-soft'
                                                            : 'border-line bg-subtle hover:border-line-strong',
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-fg">
                                                                <span
                                                                    className={cn(
                                                                        'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white',
                                                                        isOffice ? 'bg-brand' : 'bg-info',
                                                                    )}
                                                                    aria-hidden="true"
                                                                >
                                                                    {isOffice ? <Building2 className="size-3" /> : seq}
                                                                </span>
                                                                <span className="truncate">{stop.name}</span>
                                                                {isOffice && (
                                                                    <Badge tone="brand" size="sm">
                                                                        {hasMultipleOffices ? 'Office' : 'Office — last AM / first PM'}
                                                                    </Badge>
                                                                )}
                                                                {hasGeofence && <Badge tone="info" size="sm">Geofence set</Badge>}
                                                            </div>
                                                            <div className="mt-1 text-xs text-fg-muted">
                                                                Morning {format12h(stop.morning_eta) || '—'} · Evening {format12h(stop.evening_eta) || '—'}
                                                                {isOffice ? ' · People board at pickups only' : ''}
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                                            <IconButton
                                                                label={`Show ${stop.name} on map`}
                                                                size="icon-xs"
                                                                onClick={(e) => { e.stopPropagation(); setHighlightedStopId(stop.id); }}
                                                            >
                                                                <MapPin />
                                                            </IconButton>
                                                            {canEditRoutes && (
                                                                <>
                                                                    <IconButton
                                                                        label={`Edit ${stop.name}`}
                                                                        size="icon-xs"
                                                                        onClick={(e) => { e.stopPropagation(); handleStopEditClick(stop); }}
                                                                    >
                                                                        <Pencil />
                                                                    </IconButton>
                                                                    <IconButton
                                                                        label={isOffice ? 'Office stops cannot be removed' : `Remove ${stop.name}`}
                                                                        size="icon-xs"
                                                                        disabled={isOffice}
                                                                        className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink"
                                                                        onClick={(e) => { e.stopPropagation(); void handleStopDelete(stop.id); }}
                                                                    >
                                                                        <Trash2 />
                                                                    </IconButton>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                )}
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="stops" className="mt-0">
                    <ManageStopsTab route={route} canEdit={canEditRoutes} onStopMutated={schedulePolylineRefresh} />
                </TabsContent>

                <TabsContent value="rostering" className="mt-0">
                    <RosteringTab route={route} canEdit={canEditRoutes} />
                </TabsContent>
            </Tabs>
        </PermissionGate>
    );
}
