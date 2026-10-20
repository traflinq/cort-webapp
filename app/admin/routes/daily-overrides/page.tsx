'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type Announcements,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import Link from 'next/link';
import { toast } from 'sonner';
import { PermissionGate } from '@/app/admin/components/PermissionGate';
import { AdminCan } from '@/app/lib/abilities/AdminAbilityProvider';
import { apiClient, Company } from '@/app/lib/services/api-client';
import { useAuth } from '@/app/lib/contexts/auth-context';
import { useConfirm } from '@/app/lib/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '@/app/lib/store/hooks';
import { fetchAdminCompanies, selectAdminCompanies, selectAdminCompaniesStatus } from '@/app/lib/store/slices/adminCompaniesSlice';
import type { MapPolyline } from '@/app/admin/ui/Map';
import { Button, Card, CardHeader, ErrorState, Select, useChartTheme } from '@/app/admin/ui';
import { CrewAssignmentsPanel } from './CrewAssignmentsPanel';
import { PlanBoard, PlanBoardSkeleton, PlanDragPreview, PlanLegend } from './PlanBoard';
import { PlanCommandBar, PlanSaveBar } from './PlanCommandBar';
import { PlanEmptyState } from './PlanEmptyState';
import {
    businessTodayYmd,
    columnKeyboardCoordinates,
    useLoader,
    type Direction,
    type OpsTab,
    type OverrideRow,
    type PendingCrewChange,
    type PendingMove,
    type PendingUndo,
    type RosterEntry,
    type RouteOption,
} from './plan-types';

const Map = dynamic(() => import('@/app/admin/ui/Map'), { ssr: false });

export default function DailyOverridesPage() {
    return (
        <PermissionGate permission="ops_shuttle">
            <AdminCan I="read" a="OpsShuttle">
                <DailyOverridesContent />
            </AdminCan>
        </PermissionGate>
    );
}

function DailyOverridesContent() {
    const { hasCrud } = useAuth();
    const canMutate = hasCrud('ops_shuttle', 'update');
    const confirm = useConfirm();
    const dispatch = useAppDispatch();
    const companies = useAppSelector(selectAdminCompanies);
    const companiesStatus = useAppSelector(selectAdminCompaniesStatus);
    const chart = useChartTheme();

    const [companyId, setCompanyId] = useState<number | ''>('');
    const [date, setDate] = useState(businessTodayYmd);
    const [direction, setDirection] = useState<Direction>('MORNING');
    const [opsTab, setOpsTab] = useState<OpsTab>('passengers');
    const [mapOpen, setMapOpen] = useState(false);

    const [routes, setRoutes] = useState<RouteOption[]>([]);
    const [rosterByRoute, setRosterByRoute] = useState<Record<number, RosterEntry[]>>({});
    const [overrides, setOverrides] = useState<OverrideRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [routesLoading, setRoutesLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [activeDrag, setActiveDrag] = useState<{ routeId: number; entry: RosterEntry } | null>(null);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [pendingMoves, setPendingMoves] = useState<globalThis.Map<string, PendingMove>>(new globalThis.Map());
    const [pendingUndos, setPendingUndos] = useState<globalThis.Map<number, PendingUndo>>(new globalThis.Map());
    const [pendingTimes, setPendingTimes] = useState<globalThis.Map<string, string | null>>(new globalThis.Map());
    const [pendingCrew, setPendingCrew] = useState<globalThis.Map<number, PendingCrewChange>>(new globalThis.Map());
    const [crewReloadKey, setCrewReloadKey] = useState(0);
    const [orderByRoute, setOrderByRoute] = useState<Record<number, string[]>>({});
    const [saving, setSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
    );

    useEffect(() => {
        if (companiesStatus === 'idle') dispatch(fetchAdminCompanies({ limit: 200 }));
    }, [dispatch, companiesStatus]);

    const loadRoutes = useCallback(async () => {
        if (companyId === '') {
            setRoutes([]);
            setRoutesLoading(false);
            return;
        }
        setRoutes([]);
        setRoutesLoading(true);
        setLoadError(null);
        const params = new URLSearchParams({ company_id: String(companyId) });
        try {
            const data = await apiClient.request<RouteOption[]>(`/shuttle-trips/generation-routes?${params.toString()}`);
            setRoutes(Array.isArray(data) ? data : []);
        } catch (e) {
            setRoutes([]);
            setLoadError(e instanceof Error ? e.message : 'Could not load routes');
        } finally {
            setRoutesLoading(false);
        }
    }, [companyId]);

    useLoader(loadRoutes);

    const loadOverrides = useCallback(async () => {
        if (companyId === '') {
            setOverrides([]);
            return;
        }
        try {
            const data = await apiClient.request<OverrideRow[]>(
                `/shuttle-daily-overrides?date=${date}&direction=${direction}&company_id=${companyId}`,
            );
            setOverrides(Array.isArray(data) ? data : []);
        } catch (e) {
            setOverrides([]);
            setLoadError(e instanceof Error ? e.message : "Could not load today's moves");
        }
    }, [companyId, date, direction]);

    const refreshRoute = useCallback(async (routeId: number) => {
        try {
            const data = await apiClient.request<RosterEntry[]>(
                `/shuttle-daily-overrides/effective-roster?route_id=${routeId}&date=${date}&direction=${direction}`,
            );
            setRosterByRoute((prev) => ({ ...prev, [routeId]: Array.isArray(data) ? data : [] }));
        } catch {
            /* keep stale data on transient failure */
        }
    }, [date, direction]);

    const loadGen = useRef(0);

    const loadAll = useCallback(async () => {
        if (companyId === '' || routes.length === 0) {
            setRosterByRoute({});
            return;
        }
        const gen = ++loadGen.current;
        setLoading(true);
        try {
            const entries = await Promise.all(
                routes.map((r) =>
                    apiClient
                        .request<RosterEntry[]>(`/shuttle-daily-overrides/effective-roster?route_id=${r.id}&date=${date}&direction=${direction}`)
                        .then((data) => [r.id, Array.isArray(data) ? data : []] as const)
                        .catch(() => [r.id, []] as const),
                ),
            );
            if (gen !== loadGen.current) return;
            setRosterByRoute(Object.fromEntries(entries));
        } finally {
            if (gen === loadGen.current) setLoading(false);
        }
    }, [companyId, routes, date, direction]);

    const loadPlan = useCallback(() => {
        void loadAll();
        void loadOverrides();
    }, [loadAll, loadOverrides]);
    useLoader(loadPlan);

    const routeColor = useMemo(() => {
        const map = new globalThis.Map<number, string>();
        routes.forEach((r, i) => map.set(r.id, chart.colors[i % chart.colors.length]));
        return map;
    }, [routes, chart.colors]);

    const ghostOutByRoute = useMemo(() => {
        const map = new globalThis.Map<number, OverrideRow[]>();
        for (const o of overrides) {
            if (o.from_route_id == null) continue;
            const list = map.get(o.from_route_id) ?? [];
            list.push(o);
            map.set(o.from_route_id, list);
        }
        return map;
    }, [overrides]);

    const originalRouteByUserId = useMemo(() => {
        const map = new globalThis.Map<string, number>();
        for (const [routeId, entries] of Object.entries(rosterByRoute)) {
            for (const e of entries) map.set(e.user_id, Number(routeId));
        }
        return map;
    }, [rosterByRoute]);

    const routeNameById = useMemo(() => {
        const map = new globalThis.Map<number, string>();
        routes.forEach((r) => map.set(r.id, r.name));
        return map;
    }, [routes]);

    const pendingUserIds = useMemo(() => new Set(pendingMoves.keys()), [pendingMoves]);
    const pendingUndoOverrideIds = useMemo(() => new Set(pendingUndos.keys()), [pendingUndos]);

    const applyTime = useCallback((entry: RosterEntry, routeId: number): RosterEntry => {
        const time = pendingTimes.get(entry.user_id);
        if (time === undefined) return entry;
        return {
            ...entry,
            pickup_time: time ?? entry.pickup_time,
            override: {
                id: entry.override?.id ?? 0,
                from_route_id: entry.override?.from_route_id ?? null,
                from_route_name: entry.override?.from_route_name ?? null,
                to_route_id: entry.override?.to_route_id ?? routeId,
                scheduled_time: time,
            },
        };
    }, [pendingTimes]);

    const getDisplayEntries = useCallback((routeId: number): RosterEntry[] => {
        const server = (rosterByRoute[routeId] ?? []).filter((e) => {
            if (pendingUserIds.has(e.user_id)) return false;
            if (e.override && pendingUndoOverrideIds.has(e.override.id)) return false;
            return true;
        });
        const incoming = [...pendingMoves.values()]
            .filter((m) => m.toRouteId === routeId)
            .map((m) => m.entry);
        const restored = [...pendingUndos.values()]
            .filter((u) => u.fromRouteId === routeId)
            .map((u) => ({
                ...u.entry,
                is_override: false,
                override: null,
                stop_name: 'Reverting to base assignment',
            }));
        const merged = [...server, ...incoming, ...restored].map((e) => applyTime(e, routeId));
        const order = orderByRoute[routeId];
        if (!order || order.length === 0) {
            return merged;
        }
        const byId = new globalThis.Map(merged.map((e) => [e.user_id, e]));
        const ordered: RosterEntry[] = [];
        for (const id of order) {
            const row = byId.get(id);
            if (row) {
                ordered.push(row);
                byId.delete(id);
            }
        }
        return [...ordered, ...byId.values()];
    }, [rosterByRoute, pendingMoves, pendingUserIds, pendingUndos, pendingUndoOverrideIds, orderByRoute, applyTime]);

    const getPendingGhostOut = useCallback((routeId: number): PendingMove[] => {
        return [...pendingMoves.values()].filter((m) => m.fromRouteId === routeId);
    }, [pendingMoves]);

    const hasPassengerUnsaved =
        pendingMoves.size > 0 ||
        pendingUndos.size > 0 ||
        pendingTimes.size > 0 ||
        Object.keys(orderByRoute).length > 0 ||
        editingUserId != null;
    const hasUnsavedChanges = hasPassengerUnsaved || pendingCrew.size > 0;

    const unsavedSummary = [
        pendingMoves.size > 0 ? `${pendingMoves.size} ${pendingMoves.size === 1 ? 'move' : 'moves'}` : null,
        pendingUndos.size > 0 ? `${pendingUndos.size} undo${pendingUndos.size === 1 ? '' : 's'}` : null,
        pendingTimes.size > 0 ? `${pendingTimes.size} time ${pendingTimes.size === 1 ? 'edit' : 'edits'}` : null,
        pendingCrew.size > 0 ? `${pendingCrew.size} crew ${pendingCrew.size === 1 ? 'change' : 'changes'}` : null,
    ].filter(Boolean).join(' · ') || 'Unsaved changes';

    const clearDraft = useCallback(() => {
        setPendingMoves(new globalThis.Map());
        setPendingUndos(new globalThis.Map());
        setPendingTimes(new globalThis.Map());
        setOrderByRoute({});
        setEditingUserId(null);
        setPendingCrew(new globalThis.Map());
    }, []);

    // Drafts belong to one (company, date, direction); reset when that key changes.
    const draftScope = `${companyId}|${date}|${direction}`;
    const [prevDraftScope, setPrevDraftScope] = useState(draftScope);
    if (prevDraftScope !== draftScope) {
        setPrevDraftScope(draftScope);
        clearDraft();
    }

    // Warn before the tab closes or reloads with an unsaved draft.
    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [hasUnsavedChanges]);

    const confirmDiscardUnsaved = async (title: string, message: string) => {
        if (!hasUnsavedChanges) return true;
        return confirm({
            title,
            message,
            consequences: [`${unsavedSummary} will be lost`, 'Nothing has been sent to drivers yet'],
            destructive: true,
            confirmLabel: 'Discard changes',
            cancelLabel: 'Keep editing',
        });
    };

    const switchOpsTab = (tab: OpsTab) => {
        if (tab === opsTab) return;
        setOpsTab(tab);
    };

    const handleDragStart = (event: DragStartEvent) => {
        if (saving) return;
        const data = event.active.data.current as { routeId: number; entry: RosterEntry } | undefined;
        if (data) setActiveDrag(data);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDrag(null);
        if (saving || !over || !canMutate) return;

        const dragData = active.data.current as { routeId: number; entry: RosterEntry } | undefined;
        if (!dragData) return;
        const { routeId: fromRouteId, entry } = dragData;
        const overData = over.data.current as { routeId: number } | undefined;
        const toRouteId = overData?.routeId;
        if (!toRouteId || toRouteId === fromRouteId) return;

        const originalRouteId = originalRouteByUserId.get(entry.user_id) ?? fromRouteId;

        if (entry.override && entry.override.id !== 0 && entry.override.from_route_id === toRouteId) {
            handleUndo(entry, fromRouteId);
            return;
        }
        const fromIds = getDisplayEntries(fromRouteId).map((e) => e.user_id).filter((id) => id !== entry.user_id);
        const toIds = [...getDisplayEntries(toRouteId).map((e) => e.user_id).filter((id) => id !== entry.user_id), entry.user_id];
        setOrderByRoute((prev) => ({ ...prev, [fromRouteId]: fromIds, [toRouteId]: toIds }));

        setPendingMoves((prev) => {
            const next = new globalThis.Map(prev);
            if (toRouteId === originalRouteId) {
                next.delete(entry.user_id);
            } else {
                next.set(entry.user_id, {
                    entry,
                    fromRouteId: originalRouteId,
                    toRouteId,
                    toRouteName: routeNameById.get(toRouteId) ?? `Route ${toRouteId}`,
                });
            }
            return next;
        });
        if (entry.override) {
            setPendingUndos((prev) => {
                if (!prev.has(entry.override!.id)) return prev;
                const next = new globalThis.Map(prev);
                next.delete(entry.override!.id);
                return next;
            });
        }
    };

    const handleCancelPendingMove = (userId: string) => {
        const move = pendingMoves.get(userId);
        setPendingMoves((prev) => {
            const next = new globalThis.Map(prev);
            next.delete(userId);
            return next;
        });
        setPendingTimes((prev) => {
            if (!prev.has(userId)) return prev;
            const next = new globalThis.Map(prev);
            next.delete(userId);
            return next;
        });
        if (move) {
            const destIds = getDisplayEntries(move.toRouteId).map((e) => e.user_id).filter((id) => id !== userId);
            const sourceIds = [...getDisplayEntries(move.fromRouteId).map((e) => e.user_id).filter((id) => id !== userId), userId];
            setOrderByRoute((prev) => ({
                ...prev,
                [move.toRouteId]: destIds,
                [move.fromRouteId]: sourceIds,
            }));
        }
        if (editingUserId === userId) setEditingUserId(null);
    };

    const handleDiscardChanges = async () => {
        const ok = await confirmDiscardUnsaved('Discard unsaved changes?', 'Your draft for this day will be thrown away.');
        if (ok) clearDraft();
    };

    const handleSaveChanges = async () => {
        if (!hasUnsavedChanges || !canMutate) return;
        const times = new globalThis.Map(pendingTimes);
        if (editingUserId != null) {
            const trimmed = editValue.trim();
            times.set(editingUserId, trimmed ? trimmed : null);
            setPendingTimes(times);
            setEditingUserId(null);
        }
        setSaving(true);
        const failedMoves: PendingMove[] = [];
        const failedUndos: PendingUndo[] = [];
        const failedPatchUserIds = new Set<string>();
        const failedCrew: PendingCrewChange[] = [];
        const touchedRouteIds = new Set<number>();
        const shouldSavePassengers = hasPassengerUnsaved;
        const shouldSaveCrew = pendingCrew.size > 0;

        try {
            if (shouldSavePassengers) {
            for (const undo of pendingUndos.values()) {
                try {
                    await apiClient.request(`/shuttle-daily-overrides/${undo.overrideId}`, { method: 'DELETE' });
                    touchedRouteIds.add(undo.toRouteId);
                    if (undo.fromRouteId) touchedRouteIds.add(undo.fromRouteId);
                } catch (e) {
                    failedUndos.push(undo);
                    toast.error(`Failed to undo ${undo.entry.user?.full_name ?? 'employee'}: ${e instanceof Error ? e.message : 'unknown error'}`);
                }
            }

            const undoneUsers = new Set(failedUndos.length === pendingUndos.size
                ? []
                : [...pendingUndos.values()].filter((u) => !failedUndos.some((f) => f.overrideId === u.overrideId)).map((u) => u.entry.user_id));

            for (const route of routes) {
                const list = getDisplayEntries(route.id);
                for (let i = 0; i < list.length; i++) {
                    const entry = list[i];
                    const toSequence = i + 1;
                    const time = times.get(entry.user_id);
                    const move = pendingMoves.get(entry.user_id);

                    if (move) {
                        try {
                            await apiClient.request('/shuttle-daily-overrides', {
                                method: 'POST',
                                body: JSON.stringify({
                                    user_id: entry.user_id,
                                    override_date: date,
                                    direction,
                                    to_route_id: route.id,
                                    to_sequence: toSequence,
                                    ...(time ? { scheduled_time: time } : {}),
                                }),
                            });
                            touchedRouteIds.add(move.fromRouteId);
                            touchedRouteIds.add(move.toRouteId);
                        } catch (e) {
                            failedMoves.push(move);
                            toast.error(`Failed to move ${entry.user?.full_name ?? 'employee'}: ${e instanceof Error ? e.message : 'unknown error'}`);
                        }
                        continue;
                    }

                    if (undoneUsers.has(entry.user_id)) continue;
                    if (!entry.override || entry.override.id === 0) continue;

                    const sequenceChanged = Boolean(orderByRoute[route.id]?.length);
                    if (!sequenceChanged && time === undefined) continue;

                    try {
                        await apiClient.request(`/shuttle-daily-overrides/${entry.override.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                                ...(sequenceChanged ? { to_sequence: toSequence } : {}),
                                ...(time !== undefined ? { scheduled_time: time } : {}),
                            }),
                        });
                        touchedRouteIds.add(route.id);
                    } catch (e) {
                        failedPatchUserIds.add(entry.user_id);
                        toast.error(`Failed to update ${entry.user?.full_name ?? 'employee'}: ${e instanceof Error ? e.message : 'unknown error'}`);
                    }
                }
            }
            }

            if (shouldSavePassengers) {
                setPendingMoves(new globalThis.Map(failedMoves.map((m) => [m.entry.user_id, m])));
                setPendingUndos(new globalThis.Map(failedUndos.map((u) => [u.overrideId, u])));
                if (failedMoves.length === 0 && failedUndos.length === 0 && failedPatchUserIds.size === 0) {
                    setPendingTimes(new globalThis.Map());
                    setOrderByRoute({});
                }
            }

            if (shouldSaveCrew) {
                for (const change of pendingCrew.values()) {
                    try {
                        if (change.restore) {
                            await apiClient.clearShuttleTripResourceOverride(change.tripId);
                        } else {
                            const payload: { driver_id?: string; vehicle_id?: number } = {};
                            if (change.driver_id) payload.driver_id = change.driver_id;
                            if (change.vehicle_id != null) payload.vehicle_id = change.vehicle_id;
                            if (payload.driver_id || payload.vehicle_id != null) {
                                await apiClient.setShuttleTripResourceOverride(change.tripId, payload);
                            }
                        }
                    } catch (e) {
                        failedCrew.push(change);
                        toast.error(`Failed to update trip crew: ${e instanceof Error ? e.message : 'unknown error'}`);
                    }
                }
                setPendingCrew(new globalThis.Map(failedCrew.map((c) => [c.tripId, c])));
                if (failedCrew.length < pendingCrew.size) {
                    setCrewReloadKey((n) => n + 1);
                }
            }

            const passengersOk = !shouldSavePassengers || (failedMoves.length === 0 && failedUndos.length === 0 && failedPatchUserIds.size === 0);
            const crewOk = !shouldSaveCrew || failedCrew.length === 0;
            if (passengersOk && crewOk) {
                toast.success('Changes saved');
            }
            if (touchedRouteIds.size > 0) {
                await Promise.all([...touchedRouteIds].map((id) => refreshRoute(id)));
                await loadOverrides();
            }
        } finally {
            setSaving(false);
        }
    };

    const handleUndo = (entry: RosterEntry, routeId: number) => {
        if (!canMutate || saving) return;
        if (pendingMoves.has(entry.user_id)) {
            handleCancelPendingMove(entry.user_id);
            return;
        }
        if (!entry.override || entry.override.id === 0) return;
        const overrideId = entry.override.id;
        const fromRouteId = entry.override.from_route_id;
        setPendingUndos((prev) => {
            const next = new globalThis.Map(prev);
            next.set(overrideId, { overrideId, entry, toRouteId: routeId, fromRouteId });
            return next;
        });
        setOrderByRoute((prev) => {
            const next = { ...prev };
            next[routeId] = getDisplayEntries(routeId).map((e) => e.user_id).filter((id) => id !== entry.user_id);
            if (fromRouteId) {
                next[fromRouteId] = [...getDisplayEntries(fromRouteId).map((e) => e.user_id).filter((id) => id !== entry.user_id), entry.user_id];
            }
            return next;
        });
    };

    const handleUndoGhost = (row: OverrideRow) => {
        if (saving) return;
        const destEntry = (rosterByRoute[row.to_route_id] ?? []).find((e) => e.override?.id === row.id);
        if (destEntry) {
            handleUndo(destEntry, row.to_route_id);
            return;
        }
        handleUndo({
            user_id: row.user_id,
            pickup_stop_id: null,
            stop_name: row.stop_name,
            lat: null,
            lng: null,
            sequence: row.to_sequence,
            pickup_time: row.scheduled_time,
            is_override: true,
            override: {
                id: row.id,
                from_route_id: row.from_route_id,
                from_route_name: null,
                to_route_id: row.to_route_id,
                scheduled_time: row.scheduled_time,
            },
            user: { ...row.users_shuttle_daily_stop_overrides_user_idTousers, department: null },
        }, row.to_route_id);
    };

    const handleStartEditTime = (userId: string, current: string | null) => {
        if (!canMutate || saving) return;
        setEditingUserId(userId);
        setEditValue(pendingTimes.has(userId) ? (pendingTimes.get(userId) ?? '') : (current ?? ''));
    };

    const handleSaveTime = (userId: string) => {
        const trimmed = editValue.trim();
        setPendingTimes((prev) => {
            const next = new globalThis.Map(prev);
            next.set(userId, trimmed ? trimmed : null);
            return next;
        });
        setEditingUserId(null);
    };

    const handleNudge = (routeId: number, entry: RosterEntry, dir: -1 | 1) => {
        if (!canMutate || saving) return;
        const currentList = getDisplayEntries(routeId);
        const idx = currentList.findIndex((e) => e.user_id === entry.user_id);
        const neighborIdx = idx + dir;
        if (idx < 0 || neighborIdx < 0 || neighborIdx >= currentList.length) return;
        const ids = currentList.map((e) => e.user_id);
        [ids[idx], ids[neighborIdx]] = [ids[neighborIdx], ids[idx]];
        setOrderByRoute((prev) => ({ ...prev, [routeId]: ids }));
    };

    const filteredGhostOutByRoute = useMemo(() => {
        const map = new globalThis.Map<number, OverrideRow[]>();
        for (const [routeId, rows] of ghostOutByRoute) {
            map.set(routeId, rows.filter((o) => !pendingUndoOverrideIds.has(o.id)));
        }
        return map;
    }, [ghostOutByRoute, pendingUndoOverrideIds]);

    const polylines: MapPolyline[] = useMemo(() => {
        return routes
            .map((r) => {
                const entries = getDisplayEntries(r.id)
                    .filter((e) => e.lat != null && e.lng != null);
                if (entries.length < 2) return null;
                const hasOverrideToday = entries.some((e) => e.is_override) || ghostOutByRoute.has(r.id) || getPendingGhostOut(r.id).length > 0;
                return {
                    positions: entries.map((e) => [e.lat as number, e.lng as number] as [number, number]),
                    color: routeColor.get(r.id) ?? chart.colors[0],
                    weight: hasOverrideToday ? 4 : 3,
                    dashArray: hasOverrideToday ? '8 6' : undefined,
                } as MapPolyline;
            })
            .filter((p): p is MapPolyline => p != null);
    }, [routes, getDisplayEntries, routeColor, ghostOutByRoute, getPendingGhostOut, chart.colors]);

    const passengerCount = useMemo(
        () => routes.reduce((n, r) => n + getDisplayEntries(r.id).length, 0),
        [routes, getDisplayEntries],
    );

    const changeCompany = async (next: number | '') => {
        if (next === companyId) return;
        if (!(await confirmDiscardUnsaved('Change company?', 'Switching company discards the unsaved changes for this plan.'))) return;
        setCompanyId(next);
    };

    const changeDate = async (next: string) => {
        if (!next || next === date) return;
        if (!(await confirmDiscardUnsaved('Change date?', 'Switching date discards the unsaved changes for this plan.'))) return;
        setDate(next);
    };

    const changeDirection = async (next: Direction) => {
        if (next === direction) return;
        if (!(await confirmDiscardUnsaved('Switch direction?', 'Switching direction discards the unsaved changes for this plan.'))) return;
        setDirection(next);
    };

    const nameOfActive = (id: string | number) => {
        const [, userId] = String(id).split('::');
        for (const entries of Object.values(rosterByRoute)) {
            const hit = entries.find((e) => e.user_id === userId);
            if (hit) return hit.user?.full_name ?? userId;
        }
        return [...pendingMoves.values()].find((m) => m.entry.user_id === userId)?.entry.user?.full_name ?? userId ?? 'passenger';
    };
    const nameOfOver = (id: string | number) => {
        const routeId = Number(String(id).replace('panel::', ''));
        return routeNameById.get(routeId) ?? 'a route';
    };

    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            `Picked up ${nameOfActive(active.id)}. Press left or right arrow to choose a route, space to drop, escape to cancel.`,
        onDragOver: ({ active, over }) =>
            over ? `${nameOfActive(active.id)} is over ${nameOfOver(over.id)}.` : `${nameOfActive(active.id)} is not over a route.`,
        onDragEnd: ({ active, over }) =>
            over ? `Moved ${nameOfActive(active.id)} to ${nameOfOver(over.id)}. Not saved yet.` : `${nameOfActive(active.id)} was dropped outside a route. Nothing changed.`,
        onDragCancel: ({ active }) => `Moving ${nameOfActive(active.id)} was cancelled.`,
    };

    const retryLoad = () => {
        setLoadError(null);
        void loadRoutes();
        void loadOverrides();
    };

    return (
        <div className="space-y-5">
            <PlanCommandBar
                companies={companies}
                companyId={companyId}
                date={date}
                direction={direction}
                opsTab={opsTab}
                canMutate={canMutate}
                saving={saving}
                hasUnsavedChanges={hasUnsavedChanges}
                passengerCount={passengerCount}
                routeCount={routes.length}
                unsavedSummary={unsavedSummary}
                mapOpen={mapOpen}
                showMapToggle={opsTab === 'passengers' && routes.length > 0 && polylines.length > 0}
                onCompanyChange={(id) => void changeCompany(id)}
                onDateChange={(d) => void changeDate(d)}
                onDirectionChange={(d) => void changeDirection(d)}
                onTabChange={switchOpsTab}
                onSave={() => void handleSaveChanges()}
                onDiscard={() => void handleDiscardChanges()}
                onToggleMap={() => setMapOpen((v) => !v)}
            />

            {companyId === '' ? (
                <PlanEmptyState
                    title="Pick a company to start the day"
                    description="Choose who you're operating for, then morning or evening."
                    action={
                        <Select
                            aria-label="Company"
                            width="auto"
                            className="min-w-[14rem]"
                            value={companyId === '' ? '' : String(companyId)}
                            placeholder="Select a company"
                            onChange={(e) => void changeCompany(e.target.value ? Number(e.target.value) : '')}
                        >
                            {companies.map((c: Company) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </Select>
                    }
                />
            ) : loadError ? (
                <Card>
                    <ErrorState title="Could not load the plan" message={loadError} onRetry={retryLoad} />
                </Card>
            ) : opsTab === 'crew' ? (
                <CrewAssignmentsPanel
                    companyId={companyId}
                    date={date}
                    direction={direction}
                    canMutate={canMutate}
                    pendingCrew={pendingCrew}
                    saving={saving}
                    reloadKey={crewReloadKey}
                    onQueueChange={(tripId, change) => {
                        setPendingCrew((prev) => {
                            const next = new globalThis.Map(prev);
                            next.set(tripId, change);
                            return next;
                        });
                    }}
                    onClearTrip={(tripId) => {
                        setPendingCrew((prev) => {
                            if (!prev.has(tripId)) return prev;
                            const next = new globalThis.Map(prev);
                            next.delete(tripId);
                            return next;
                        });
                    }}
                />
            ) : routesLoading ? (
                <PlanBoardSkeleton />
            ) : routes.length === 0 ? (
                <PlanEmptyState
                    title="No ready shuttle routes"
                    description="This company has no shuttle routes with a usual driver and vehicle assigned. Set those on the routes page first."
                    action={
                        <Button variant="outline" asChild>
                            <Link href="/admin/routes">Open routes</Link>
                        </Button>
                    }
                />
            ) : (
                <div className="space-y-3">
                    <PlanLegend />
                    {loading && (
                        <p className="text-sm text-fg-muted" role="status">Loading who&apos;s on each route…</p>
                    )}
                    <DndContext sensors={sensors} accessibility={{ announcements }} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                        <PlanBoard
                            routes={routes}
                            routeColor={routeColor}
                            getDisplayEntries={getDisplayEntries}
                            pendingUserIds={pendingUserIds}
                            filteredGhostOutByRoute={filteredGhostOutByRoute}
                            getPendingGhostOut={getPendingGhostOut}
                            canMutate={canMutate}
                            editingUserId={editingUserId}
                            editValue={editValue}
                            onEditValueChange={setEditValue}
                            onStartEditTime={handleStartEditTime}
                            onSaveTime={handleSaveTime}
                            onCancelEditTime={() => setEditingUserId(null)}
                            onUndo={handleUndo}
                            onUndoGhost={handleUndoGhost}
                            onCancelPendingMove={handleCancelPendingMove}
                            onNudge={handleNudge}
                            busy={saving}
                        />
                        <DragOverlay>
                            {activeDrag ? (
                                <PlanDragPreview name={activeDrag.entry.user?.full_name ?? activeDrag.entry.user_id} />
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </div>
            )}

            {opsTab === 'passengers' && mapOpen && routes.length > 0 && polylines.length > 0 && (
                <Card className="overflow-hidden">
                    <CardHeader title="Route map" description="Dashed lines are routes with a passenger move today" />
                    <Map height="420px" polylines={polylines} />
                </Card>
            )}

            {hasUnsavedChanges && canMutate && (
                <PlanSaveBar
                    summary={unsavedSummary}
                    saving={saving}
                    onDiscard={() => void handleDiscardChanges()}
                    onSave={() => void handleSaveChanges()}
                />
            )}
        </div>
    );
}
