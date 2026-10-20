'use client';

import { useState, useCallback, useMemo } from 'react';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type Announcements,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/app/lib/store/hooks';
import {
    updateRouteStop,
    deleteRouteStop,
    reorderAdminRouteStops,
    Route,
    RouteStop,
} from '@/app/lib/store/slices/adminRoutesSlice';
import { Save, X, Sun, Sunset, Building2, GripVertical, ArrowLeftRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    Field,
    FormGrid,
    Input,
    SectionHeader,
    focusRing,
} from '@/app/admin/ui';
import { useConfirm } from '@/app/lib/hooks/useConfirm';
import { format12h, toClockHHmm } from '../../RouteCommandBar';
import { isOfficeStop, getOfficeStops } from '@/app/lib/utils/routeStops';

type StopDirection = 'MORNING' | 'EVENING' | 'BOTH';
type Column = 'MORNING' | 'EVENING';

interface ManageStopsTabProps {
    route: Route;
    canEdit: boolean;
    onStopMutated?: () => void;
}

function displayTime(timeStr: string | null | undefined): string {
    return format12h(timeStr) || '—';
}

function deriveDirection(stop: RouteStop): StopDirection {
    if (stop.morning_sequence != null && stop.evening_sequence != null) return 'BOTH';
    if (stop.morning_sequence != null) return 'MORNING';
    if (stop.evening_sequence != null) return 'EVENING';
    return 'BOTH';
}

function mergeOrder(prev: number[], server: number[]): number[] {
    const allowed = new Set(server);
    const kept = prev.filter((id) => allowed.has(id));
    const missing = server.filter((id) => !kept.includes(id));
    return [...kept, ...missing];
}

function moveColumnIds(ids: number[], activeId: number, overId: number): number[] {
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return ids;
    return arrayMove(ids, oldIndex, newIndex);
}

function sequenceIds(
    stops: RouteStop[] | undefined,
    key: 'morning_sequence' | 'evening_sequence',
): number[] {
    return (stops ?? [])
        .filter((s) => s[key] != null)
        .sort((a, b) => (a[key] ?? 0) - (b[key] ?? 0))
        .map((s) => s.id);
}

function sameIds(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((id, i) => id === b[i]);
}

function orderStops(stops: RouteStop[], ids: number[] | null): RouteStop[] {
    if (!ids || ids.length === 0) return stops;
    const byId = new Map(stops.map((s) => [s.id, s]));
    const ordered = ids.map((id) => byId.get(id)).filter((s): s is RouteStop => !!s);
    const seen = new Set(ordered.map((s) => s.id));
    for (const s of stops) {
        if (!seen.has(s.id)) ordered.push(s);
    }
    return ordered;
}

function stopActionKey(id: number, column: Column) {
    return `${id}-${column}`;
}

/** Screen-reader announcements that use stop names instead of numeric ids. */
function buildAnnouncements(stops: RouteStop[], column: Column): Announcements {
    const label = column === 'MORNING' ? 'morning' : 'evening';
    const nameOf = (id: string | number) => stops.find((s) => s.id === Number(id))?.name ?? `stop ${id}`;
    const positionOf = (id: string | number) => stops.findIndex((s) => s.id === Number(id)) + 1;
    return {
        onDragStart: ({ active }) =>
            `Picked up ${nameOf(active.id)}, position ${positionOf(active.id)} of ${stops.length} in the ${label} order.`,
        onDragOver: ({ active, over }) =>
            over ? `${nameOf(active.id)} is over position ${positionOf(over.id)}.` : `${nameOf(active.id)} is no longer over a position.`,
        onDragEnd: ({ active, over }) =>
            over
                ? `${nameOf(active.id)} dropped at position ${positionOf(over.id)}. Press Save order to keep this change.`
                : `${nameOf(active.id)} dropped. Order unchanged.`,
        onDragCancel: ({ active }) => `Reordering cancelled. ${nameOf(active.id)} returned to position ${positionOf(active.id)}.`,
    };
}

const SR_INSTRUCTIONS = {
    draggable:
        'To pick up a stop, press space or enter. While dragging, use the up and down arrow keys to move it, space or enter to drop, and escape to cancel.',
};

function SortableStopCard({
    stop,
    column,
    index,
    isOffice,
    dragDisabled,
    canEdit,
    isRemoving,
    onEdit,
    onRemove,
}: {
    stop: RouteStop;
    column: Column;
    index: number;
    isOffice: boolean;
    dragDisabled: boolean;
    canEdit: boolean;
    isRemoving: boolean;
    onEdit: () => void;
    onRemove: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: stop.id,
        disabled: dragDisabled,
    });
    const time = column === 'MORNING' ? displayTime(stop.morning_eta) : displayTime(stop.evening_eta);
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={cn(
                'group rounded-lg border bg-card p-3 shadow-[var(--shadow-card)]',
                isOffice ? 'border-brand-line bg-brand-soft/30' : 'border-line',
                isDragging && 'opacity-40',
            )}
        >
            <div className="flex items-start gap-2">
                <button
                    type="button"
                    className={cn(
                        'mt-0.5 shrink-0 rounded-md p-1 text-fg-muted',
                        dragDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-grab hover:bg-subtle active:cursor-grabbing',
                        focusRing,
                    )}
                    aria-label={`Reorder ${stop.name}`}
                    disabled={dragDisabled}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-fg">
                                <span
                                    className={cn(
                                        'flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white',
                                        isOffice ? 'bg-brand' : 'bg-info',
                                    )}
                                    aria-hidden="true"
                                >
                                    {isOffice ? <Building2 className="size-3" /> : index + 1}
                                </span>
                                <span className="truncate">{stop.name}</span>
                                {isOffice && <Badge tone="brand" size="sm">Office</Badge>}
                            </div>
                            <div className="mt-1.5 pl-8 text-xs text-fg-muted">
                                {column === 'MORNING' ? 'Morning' : 'Evening'} {time}
                                {isOffice ? ' · People board at pickups only' : ''}
                            </div>
                        </div>
                        {canEdit && (
                            <div className="flex shrink-0 gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                <Button variant="ghost" size="sm" onClick={onEdit} leftIcon={<Pencil />}>
                                    Edit
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onRemove}
                                    disabled={isOffice}
                                    loading={isRemoving}
                                    leftIcon={<Trash2 />}
                                    className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink"
                                    title={isOffice ? 'Office stops cannot be removed' : undefined}
                                >
                                    Remove
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </li>
    );
}

function AbsentStopCard({
    stop,
    column,
    isOffice,
    disabled,
    canEdit,
    isAdding,
    onAdd,
}: {
    stop: RouteStop;
    column: Column;
    isOffice: boolean;
    disabled: boolean;
    canEdit: boolean;
    isAdding: boolean;
    onAdd: () => void;
}) {
    const routeLabel = column === 'MORNING' ? 'morning' : 'evening';
    const activeDirLabel = column === 'MORNING' ? 'evening' : 'morning';
    const activeTime = column === 'MORNING' ? displayTime(stop.evening_eta) : displayTime(stop.morning_eta);

    return (
        <li className="rounded-lg border border-dashed border-line bg-subtle p-3">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-fg-secondary">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-card text-fg-muted" aria-hidden="true">
                            {isOffice ? <Building2 className="size-3" /> : <span className="text-[10px]">—</span>}
                        </span>
                        <span className="truncate">{stop.name}</span>
                        {isOffice && <Badge tone="brand" size="sm">Office</Badge>}
                    </div>
                    <p className="mt-1.5 pl-8 text-xs text-fg-muted">
                        Not on {routeLabel} route
                        {activeTime !== '—' ? ` · on ${activeDirLabel} ${activeTime}` : ''}
                    </p>
                </div>
                {canEdit && (
                    <Button variant="outline" size="sm" onClick={onAdd} disabled={disabled} loading={isAdding} leftIcon={<Plus />}>
                        Add to {routeLabel}
                    </Button>
                )}
            </div>
        </li>
    );
}

export default function ManageStopsTab({ route, canEdit, onStopMutated }: ManageStopsTabProps) {
    const dispatch = useAppDispatch();
    const confirm = useConfirm();
    const [isSaving, setIsSaving] = useState(false);
    const [editingStopId, setEditingStopId] = useState<number | null>(null);
    const officeStops = getOfficeStops(route.route_stops ?? []);
    const officeStopIds = new Set(officeStops.map((s) => s.id));
    const isMultiOffice = officeStops.length > 1;
    const normalizeOfficeOrder = (ids: number[], column: Column) => {
        // Multi-office: admin owns the full order, including offices and interleaving.
        if (isMultiOffice) return ids;
        const offices = ids.filter((id) => officeStopIds.has(id));
        const pickups = ids.filter((id) => !officeStopIds.has(id));
        // Single office is pinned:
        // - Morning: always last
        // - Evening: always first
        return column === 'MORNING' ? [...pickups, ...offices] : [...offices, ...pickups];
    };
    const [morningIds, setMorningIds] = useState<number[]>(() =>
        normalizeOfficeOrder(sequenceIds(route.route_stops, 'morning_sequence'), 'MORNING'),
    );
    const [eveningIds, setEveningIds] = useState<number[]>(() =>
        normalizeOfficeOrder(sequenceIds(route.route_stops, 'evening_sequence'), 'EVENING'),
    );
    const [isSavingOrder, setIsSavingOrder] = useState(false);
    const [addingToColumnId, setAddingToColumnId] = useState<number | null>(null);
    const [removingStopKey, setRemovingStopKey] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        lat: '',
        lng: '',
        morning_eta: '',
        evening_eta: '',
        direction: 'BOTH' as StopDirection,
    });
    const editingStop = editingStopId != null
        ? (route.route_stops ?? []).find((s) => s.id === editingStopId) ?? null
        : null;
    const isEditingOffice = editingStop != null && isOfficeStop(editingStop);

    const resetForm = useCallback(() => {
        setFormData({
            name: '',
            lat: '',
            lng: '',
            morning_eta: '',
            evening_eta: '',
            direction: 'BOTH',
        });
        setEditingStopId(null);
    }, []);

    // Reset the editor and local order when the route changes (render-time adjustment).
    const [prevRouteId, setPrevRouteId] = useState(route.id);
    if (prevRouteId !== route.id) {
        setPrevRouteId(route.id);
        resetForm();
        setMorningIds(normalizeOfficeOrder(sequenceIds(route.route_stops, 'morning_sequence'), 'MORNING'));
        setEveningIds(normalizeOfficeOrder(sequenceIds(route.route_stops, 'evening_sequence'), 'EVENING'));
    }

    const handleEditClick = (stop: RouteStop) => {
        if (!canEdit) return;
        const dir = deriveDirection(stop);
        setFormData({
            name: stop.name,
            lat: stop.lat?.toString() || '',
            lng: stop.lng?.toString() || '',
            morning_eta: stop.morning_eta ? toClockHHmm(stop.morning_eta) : '',
            evening_eta: stop.evening_eta ? toClockHHmm(stop.evening_eta) : '',
            direction: dir,
        });
        setEditingStopId(stop.id);
    };

    const handleSubmit = async () => {
        if (!canEdit) return;
        if (!editingStopId || !editingStop) return;
        if (!formData.name) {
            toast.error('Stop name is required');
            return;
        }
        const data: Record<string, unknown> = {
            name: formData.name,
            lat: parseFloat(formData.lat),
            lng: parseFloat(formData.lng),
            morning_eta: formData.morning_eta || null,
            evening_eta: formData.evening_eta || null,
            direction: isEditingOffice ? 'BOTH' : formData.direction,
            sequence_order: editingStop.sequence_order ?? 0,
            morning_sequence: editingStop.morning_sequence,
            evening_sequence: editingStop.evening_sequence,
        };
        try {
            setIsSaving(true);
            await dispatch(updateRouteStop({ stopId: editingStopId, routeId: route.id, data })).unwrap();
            toast.success('Stop updated successfully');
            onStopMutated?.();
            resetForm();
        } catch {
            toast.error('Failed to save stop');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number, column: Column) => {
        if (!canEdit) return;
        if (officeStopIds.has(id)) {
            toast.error('Cannot delete an office stop. Change the office location by editing it instead.');
            return;
        }
        const stop = (route.route_stops ?? []).find((s) => s.id === id);
        if (!stop) return;
        const dir = deriveDirection(stop);
        const thisLabel = column === 'EVENING' ? 'evening' : 'morning';
        const otherLabel = column === 'EVENING' ? 'morning' : 'evening';

        // BOTH-direction stop: removing from one column drops that direction only.
        if (dir === 'BOTH') {
            const ok = await confirm({
                title: `Remove "${stop.name}" from the ${thisLabel} route?`,
                message: `It stays on the ${otherLabel} route.`,
                consequences: [
                    `The stop disappears from the ${thisLabel} order`,
                    `Its ${otherLabel} pickup time is unchanged`,
                ],
                confirmLabel: 'Remove',
            });
            if (!ok) return;
            const key = stopActionKey(id, column);
            try {
                setRemovingStopKey(key);
                await dispatch(updateRouteStop({
                    stopId: id,
                    routeId: route.id,
                    data: { direction: column === 'EVENING' ? 'MORNING' : 'EVENING' },
                })).unwrap();
                toast.success(
                    column === 'EVENING' ? 'Removed from evening route' : 'Removed from morning route',
                );
                onStopMutated?.();
            } catch {
                toast.error('Failed to update stop');
            } finally {
                setRemovingStopKey(null);
            }
            return;
        }

        const ok = await confirm({
            title: `Delete "${stop.name}"?`,
            message: 'This removes the stop from the route entirely.',
            consequences: [
                `It is only on the ${thisLabel} route, so it is deleted rather than hidden`,
                'Anyone rostered at this pickup must be reassigned',
                'This cannot be undone',
            ],
            destructive: true,
            confirmLabel: 'Delete stop',
        });
        if (!ok) return;
        const key = stopActionKey(id, column);
        try {
            setRemovingStopKey(key);
            await dispatch(deleteRouteStop({ stopId: id, routeId: route.id })).unwrap();
            toast.success('Stop deleted successfully');
            onStopMutated?.();
        } catch {
            toast.error('Failed to delete stop');
        } finally {
            setRemovingStopKey(null);
        }
    };

    const handleAddToColumn = async (id: number, column: Column) => {
        if (!canEdit) return;
        const stop = (route.route_stops ?? []).find((s) => s.id === id);
        if (!stop) return;
        const dir = deriveDirection(stop);
        const targetDir: StopDirection | null =
            column === 'EVENING' && dir === 'MORNING'
                ? 'BOTH'
                : column === 'MORNING' && dir === 'EVENING'
                    ? 'BOTH'
                    : null;
        if (!targetDir) return;

        try {
            setAddingToColumnId(id);
            await dispatch(updateRouteStop({
                stopId: id,
                routeId: route.id,
                data: { direction: targetDir },
            })).unwrap();
            toast.success(`Added "${stop.name}" to the ${column === 'EVENING' ? 'evening' : 'morning'} route`);
            onStopMutated?.();
        } catch {
            toast.error('Failed to add stop to route');
        } finally {
            setAddingToColumnId(null);
        }
    };

    const serverMorningIds = useMemo(() => sequenceIds(route.route_stops, 'morning_sequence'), [route.route_stops]);
    const serverEveningIds = useMemo(() => sequenceIds(route.route_stops, 'evening_sequence'), [route.route_stops]);
    // Merge the server order into the local (possibly reordered) one whenever the server
    // list changes, keeping any unsaved moves (render-time adjustment).
    const [prevServerMorningIds, setPrevServerMorningIds] = useState(serverMorningIds);
    if (prevServerMorningIds !== serverMorningIds) {
        setPrevServerMorningIds(serverMorningIds);
        setMorningIds((prev) => normalizeOfficeOrder(mergeOrder(prev, serverMorningIds), 'MORNING'));
    }
    const [prevServerEveningIds, setPrevServerEveningIds] = useState(serverEveningIds);
    if (prevServerEveningIds !== serverEveningIds) {
        setPrevServerEveningIds(serverEveningIds);
        setEveningIds((prev) => normalizeOfficeOrder(mergeOrder(prev, serverEveningIds), 'EVENING'));
    }

    const morningStops = useMemo(() => {
        const sorted = (route.route_stops ?? []).filter((s) => s.morning_sequence != null);
        return orderStops(sorted, morningIds);
    }, [route.route_stops, morningIds]);

    const eveningStops = useMemo(() => {
        const sorted = (route.route_stops ?? []).filter((s) => s.evening_sequence != null);
        return orderStops(sorted, eveningIds);
    }, [route.route_stops, eveningIds]);

    // Pickup stops on the other direction only — show as inactive in this column so ops can re-add.
    const absentFromMorning = useMemo(
        () => (route.route_stops ?? []).filter(
            (s) => s.evening_sequence != null && s.morning_sequence == null && !isOfficeStop(s),
        ),
        [route.route_stops],
    );
    const absentFromEvening = useMemo(
        () => (route.route_stops ?? []).filter(
            (s) => s.morning_sequence != null && s.evening_sequence == null && !isOfficeStop(s),
        ),
        [route.route_stops],
    );

    const morningDirty = !sameIds(morningIds, serverMorningIds);
    const eveningDirty = !sameIds(eveningIds, serverEveningIds);
    const orderDirty = morningDirty || eveningDirty;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const dragLocked = !canEdit || isSavingOrder || editingStopId != null;

    const morningAnnouncements = useMemo(() => buildAnnouncements(morningStops, 'MORNING'), [morningStops]);
    const eveningAnnouncements = useMemo(() => buildAnnouncements(eveningStops, 'EVENING'), [eveningStops]);

    const applyColumnMove = (
        column: Column,
        activeId: number,
        overId: number,
    ) => {
        const setter = column === 'MORNING' ? setMorningIds : setEveningIds;
        setter((ids) => normalizeOfficeOrder(moveColumnIds(ids, activeId, overId), column));
    };

    const handleColumnDragEnd = (column: Column, event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;
        applyColumnMove(column, Number(active.id), Number(over.id));
    };

    const handleDiscardOrder = () => {
        setMorningIds(normalizeOfficeOrder(serverMorningIds, 'MORNING'));
        setEveningIds(normalizeOfficeOrder(serverEveningIds, 'EVENING'));
    };

    const handleSaveOrder = async () => {
        if (!canEdit || !orderDirty) return;
        setIsSavingOrder(true);
        try {
            if (morningDirty) {
                const normalizedMorningIds = normalizeOfficeOrder(morningIds, 'MORNING');
                await dispatch(reorderAdminRouteStops({
                    routeId: route.id,
                    direction: 'MORNING',
                    stop_ids: normalizedMorningIds,
                })).unwrap();
            }
            if (eveningDirty) {
                const normalizedEveningIds = normalizeOfficeOrder(eveningIds, 'EVENING');
                await dispatch(reorderAdminRouteStops({
                    routeId: route.id,
                    direction: 'EVENING',
                    stop_ids: normalizedEveningIds,
                })).unwrap();
            }
            toast.success('Stop order saved');
            onStopMutated?.();
        } catch {
            toast.error('Could not save the new stop order');
        } finally {
            setIsSavingOrder(false);
        }
    };

    const columns = [
        { column: 'MORNING' as const, stops: morningStops, absent: absentFromMorning, title: 'Morning order', Icon: Sun, announcements: morningAnnouncements },
        { column: 'EVENING' as const, stops: eveningStops, absent: absentFromEvening, title: 'Evening order', Icon: Sunset, announcements: eveningAnnouncements },
    ];

    return (
        <div className="space-y-5">
            <SectionHeader
                title="Stops"
                description={
                    !canEdit
                        ? 'You have read-only access to this route.'
                        : isMultiOffice
                            ? 'Drag stops to reorder — pickups and offices. You set the full order. Press Save to keep it.'
                            : 'Drag stops to reorder — pickups only. Office is pinned (morning last, evening first). Press Save to keep it.'
                }
                actions={
                    orderDirty ? (
                        <>
                            <Badge tone="warning" dot>Pending — not saved</Badge>
                            <Button variant="outline" onClick={handleDiscardOrder} disabled={isSavingOrder}>
                                Discard
                            </Button>
                            <Button onClick={() => void handleSaveOrder()} loading={isSavingOrder} leftIcon={<Save />}>
                                Save order
                            </Button>
                        </>
                    ) : undefined
                }
            />

            {editingStopId && (
                <Card>
                    <CardHeader
                        title={isEditingOffice ? `Edit office: ${formData.name}` : `Edit: ${formData.name}`}
                        actions={
                            <Button variant="ghost" size="sm" onClick={resetForm} leftIcon={<X />}>
                                Cancel
                            </Button>
                        }
                    />
                    <CardContent className="space-y-4">
                        <Field label="Stop name" required>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Central Station"
                            />
                        </Field>
                        <FormGrid cols={2}>
                            {(formData.direction === 'MORNING' || formData.direction === 'BOTH' || isEditingOffice) && (
                                <Field
                                    label={isEditingOffice ? 'Morning arrival' : 'Morning time'}
                                    hint={formData.morning_eta ? format12h(formData.morning_eta) ?? undefined : undefined}
                                >
                                    <Input
                                        type="time"
                                        value={formData.morning_eta}
                                        onChange={(e) => setFormData({ ...formData, morning_eta: e.target.value })}
                                    />
                                </Field>
                            )}
                            {(formData.direction === 'EVENING' || formData.direction === 'BOTH' || isEditingOffice) && (
                                <Field
                                    label={isEditingOffice ? 'Evening departure' : 'Evening time'}
                                    hint={formData.evening_eta ? format12h(formData.evening_eta) ?? undefined : undefined}
                                >
                                    <Input
                                        type="time"
                                        value={formData.evening_eta}
                                        onChange={(e) => setFormData({ ...formData, evening_eta: e.target.value })}
                                    />
                                </Field>
                            )}
                        </FormGrid>
                        <p className="text-xs text-fg-muted">
                            Add stops from the Overview tab. Location and stop type are edited there too. Drag stops above to change order.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={resetForm}>Cancel</Button>
                            <Button onClick={() => void handleSubmit()} loading={isSaving} leftIcon={<Save />}>
                                Update stop
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {columns.map(({ column, stops, absent, title, Icon, announcements }) => (
                    <Card key={column} className="overflow-hidden bg-subtle">
                        <div className="flex items-center gap-2 border-b border-line bg-card px-4 py-3">
                            <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-brand-ink" aria-hidden="true">
                                <Icon className="size-4" />
                            </span>
                            <div>
                                <h4 className="text-sm font-semibold text-fg">{title}</h4>
                                <p className="text-xs text-fg-muted">
                                    {stops.length} stop{stops.length !== 1 ? 's' : ''}
                                    {absent.length > 0 && ` · ${absent.length} not on route`}
                                </p>
                            </div>
                        </div>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            accessibility={{ announcements, screenReaderInstructions: SR_INSTRUCTIONS }}
                            onDragEnd={(event) => handleColumnDragEnd(column, event)}
                        >
                            <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-3 p-3">
                                    {stops.length === 0 && absent.length === 0 ? (
                                        <p className="py-8 text-center text-sm text-fg-muted">
                                            No {column === 'MORNING' ? 'morning' : 'evening'} stops
                                        </p>
                                    ) : (
                                        <ol className="space-y-2" aria-label={title}>
                                            {stops.map((s, i) => (
                                                <SortableStopCard
                                                    key={`${column}-${s.id}`}
                                                    stop={s}
                                                    column={column}
                                                    index={i}
                                                    isOffice={officeStopIds.has(s.id)}
                                                    dragDisabled={dragLocked || removingStopKey != null || (!isMultiOffice && officeStopIds.has(s.id))}
                                                    canEdit={canEdit}
                                                    isRemoving={removingStopKey === stopActionKey(s.id, column)}
                                                    onEdit={() => handleEditClick(s)}
                                                    onRemove={() => void handleDelete(s.id, column)}
                                                />
                                            ))}
                                        </ol>
                                    )}
                                    {absent.length > 0 && (
                                        <div className="space-y-2 border-t border-dashed border-line pt-3">
                                            <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                                                <ArrowLeftRight className="size-3" aria-hidden="true" />
                                                Not on {column === 'MORNING' ? 'morning' : 'evening'} route
                                            </p>
                                            <ul className="space-y-2">
                                                {absent.map((s) => (
                                                    <AbsentStopCard
                                                        key={`${column}-absent-${s.id}`}
                                                        stop={s}
                                                        column={column}
                                                        isOffice={officeStopIds.has(s.id)}
                                                        disabled={dragLocked || addingToColumnId != null || removingStopKey != null}
                                                        canEdit={canEdit}
                                                        isAdding={addingToColumnId === s.id}
                                                        onAdd={() => void handleAddToColumn(s.id, column)}
                                                    />
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </Card>
                ))}
            </div>
        </div>
    );
}
