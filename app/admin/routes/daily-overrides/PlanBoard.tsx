'use client';

import { ArrowDown, ArrowLeftRight, ArrowUp, Clock, GripVertical, RotateCcw, X } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Badge, Button, IconButton, Input, Skeleton, focusRing } from '@/app/admin/ui';
import { format12h, initials } from './plan-types';
import type { OverrideRow, PendingMove, RosterEntry, RouteOption } from './plan-types';

function PassengerCard({
    entry,
    routeId,
    color,
    canMutate,
    pending,
    editing,
    onStartEditTime,
    onSaveTime,
    onCancelEditTime,
    editValue,
    onEditValueChange,
    onUndo,
    onCancelPendingMove,
    onNudge,
    busy,
}: {
    entry: RosterEntry;
    routeId: number;
    color: string;
    canMutate: boolean;
    pending: boolean;
    editing: boolean;
    onStartEditTime: () => void;
    onSaveTime: () => void;
    onCancelEditTime: () => void;
    editValue: string;
    onEditValueChange: (v: string) => void;
    onUndo: () => void;
    onCancelPendingMove: () => void;
    onNudge: (dir: -1 | 1) => void;
    busy: boolean;
}) {
    const dragId = `${routeId}::${entry.user_id}`;
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: dragId,
        disabled: !canMutate || busy,
        data: { routeId, entry },
    });

    const displayTime = format12h(entry.override?.scheduled_time ?? entry.pickup_time);
    const name = entry.user?.full_name ?? entry.user_id;
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
    const canDrag = canMutate && !busy;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'group relative flex items-start gap-2.5 rounded-xl border bg-card p-3 text-sm shadow-[var(--shadow-card)] transition-shadow',
                isDragging && 'opacity-40',
                pending && 'border-dashed border-info-line bg-info-soft',
                !pending && entry.is_override && 'border-brand-line',
                !pending && !entry.is_override && 'border-line',
            )}
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={canDrag ? `Move ${name} to another route` : `${name} cannot be moved`}
                aria-disabled={!canDrag || undefined}
                className={cn(
                    'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-fg-muted',
                    canDrag ? 'cursor-grab hover:bg-subtle hover:text-fg active:cursor-grabbing' : 'cursor-not-allowed opacity-30',
                    focusRing,
                )}
            >
                <GripVertical className="size-4" aria-hidden="true" />
            </button>

            <div
                aria-hidden="true"
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: color }}
            >
                {initials(name)}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium text-fg">{name}</span>
                    {pending && <Badge tone="info" size="sm" dot>Pending</Badge>}
                    {!pending && entry.is_override && (
                        <Badge tone="brand" size="sm" dot>
                            Temporary{entry.override?.from_route_name ? ` from ${entry.override.from_route_name}` : ''}
                        </Badge>
                    )}
                </div>
                <div className="mt-0.5 truncate text-xs text-fg-muted">{entry.stop_name ?? 'No stop'}</div>
                {!editing && displayTime && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-fg-secondary">
                        <Clock className="size-3" aria-hidden="true" />
                        {displayTime}
                    </span>
                )}
                {editing ? (
                    <div className="mt-2 flex items-center gap-1.5">
                        <Input
                            type="time"
                            aria-label={`Pickup time for ${name}`}
                            value={editValue}
                            onChange={(e) => onEditValueChange(e.target.value)}
                            className="h-8 w-[8.5rem] text-xs"
                            autoFocus
                        />
                        <Button size="sm" onClick={onSaveTime} disabled={busy}>Set</Button>
                        <Button size="sm" variant="outline" onClick={onCancelEditTime}>Cancel</Button>
                    </div>
                ) : (
                    (pending || (entry.override && entry.override.id !== 0)) && (
                        <Button
                            variant="link"
                            size="sm"
                            onClick={onStartEditTime}
                            disabled={!canMutate || busy}
                            className="mt-1 h-auto text-[11px] text-fg-muted hover:text-brand-ink"
                        >
                            {entry.override?.scheduled_time ? 'Change time' : 'Set time'}
                        </Button>
                    )
                )}
            </div>

            {canMutate && (pending || entry.is_override) && (
                <div className="flex shrink-0 flex-col items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <IconButton label={`Move ${name} earlier`} size="icon-xs" onClick={() => onNudge(-1)} disabled={busy} tooltipSide="left">
                        <ArrowUp />
                    </IconButton>
                    <IconButton label={`Move ${name} later`} size="icon-xs" onClick={() => onNudge(1)} disabled={busy} tooltipSide="left">
                        <ArrowDown />
                    </IconButton>
                    {pending ? (
                        <IconButton label={`Cancel moving ${name}`} size="icon-xs" onClick={onCancelPendingMove} tooltipSide="left" className="hover:bg-danger-soft hover:text-danger-ink">
                            <X />
                        </IconButton>
                    ) : (
                        <IconButton label={`Send ${name} back to their usual route`} size="icon-xs" onClick={onUndo} disabled={busy} tooltipSide="left" className="hover:bg-danger-soft hover:text-danger-ink">
                            <RotateCcw />
                        </IconButton>
                    )}
                </div>
            )}
        </div>
    );
}

function RouteColumn({
    route,
    color,
    entries,
    pendingUserIds,
    ghostOut,
    pendingGhostOut,
    canMutate,
    editingOverrideId,
    editValue,
    onEditValueChange,
    onStartEditTime,
    onSaveTime,
    onCancelEditTime,
    onUndo,
    onUndoGhost,
    onCancelPendingMove,
    onNudge,
    busy,
}: {
    route: RouteOption;
    color: string;
    entries: RosterEntry[];
    pendingUserIds: Set<string>;
    ghostOut: OverrideRow[];
    pendingGhostOut: PendingMove[];
    canMutate: boolean;
    editingOverrideId: string | null;
    editValue: string;
    onEditValueChange: (v: string) => void;
    onStartEditTime: (userId: string, current: string | null) => void;
    onSaveTime: (userId: string) => void;
    onCancelEditTime: () => void;
    onUndo: (entry: RosterEntry, routeId: number) => void;
    onUndoGhost: (row: OverrideRow) => void;
    onCancelPendingMove: (userId: string) => void;
    onNudge: (entry: RosterEntry, dir: -1 | 1) => void;
    busy: boolean;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `panel::${route.id}`,
        data: { routeId: route.id },
        disabled: busy || !canMutate,
    });

    return (
        <section
            ref={setNodeRef}
            aria-label={`${route.name}, ${entries.length} ${entries.length === 1 ? 'person' : 'people'}`}
            className={cn(
                'flex w-full min-w-[300px] max-w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-subtle',
                isOver && 'ring-2 ring-ring ring-offset-2 ring-offset-page',
            )}
        >
            <div className="flex items-start gap-3 px-4 pb-3 pt-4">
                <span aria-hidden="true" className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-fg">{route.name}</h3>
                    <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-fg">
                        {entries.length}
                        <span className="ml-1 text-xs font-medium text-fg-muted">{entries.length === 1 ? 'person' : 'people'}</span>
                    </div>
                </div>
            </div>

            <div className={cn('flex flex-1 flex-col gap-2 px-3 pb-3', isOver && 'bg-brand-soft')}>
                {isOver && <p className="rounded-lg py-2 text-center text-xs font-semibold text-brand-ink">Drop on this route</p>}
                {entries.length === 0 && ghostOut.length === 0 && pendingGhostOut.length === 0 && !isOver && (
                    <p className="py-10 text-center text-xs text-fg-muted">Empty — drop a passenger here</p>
                )}
                {entries.map((entry) => (
                    <PassengerCard
                        key={entry.user_id}
                        entry={entry}
                        routeId={route.id}
                        color={color}
                        canMutate={canMutate}
                        pending={pendingUserIds.has(entry.user_id)}
                        editing={editingOverrideId === entry.user_id}
                        editValue={editValue}
                        onEditValueChange={onEditValueChange}
                        onStartEditTime={() => onStartEditTime(entry.user_id, entry.override?.scheduled_time ?? null)}
                        onSaveTime={() => onSaveTime(entry.user_id)}
                        onCancelEditTime={onCancelEditTime}
                        onUndo={() => onUndo(entry, route.id)}
                        onCancelPendingMove={() => onCancelPendingMove(entry.user_id)}
                        onNudge={(dir) => onNudge(entry, dir)}
                        busy={busy}
                    />
                ))}
                {pendingGhostOut.map((p) => {
                    const name = p.entry.user?.full_name ?? p.entry.user_id;
                    return (
                        <div key={p.entry.user_id} className="flex items-center gap-2 rounded-xl border border-dashed border-info-line bg-info-soft px-3 py-2.5 text-sm">
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-fg-secondary line-through">{name}</div>
                                <div className="text-xs text-fg-muted">Moving to {p.toRouteName} — not saved</div>
                            </div>
                            {canMutate && (
                                <IconButton label={`Cancel moving ${name}`} size="icon-xs" onClick={() => onCancelPendingMove(p.entry.user_id)} className="hover:bg-danger-soft hover:text-danger-ink">
                                    <X />
                                </IconButton>
                            )}
                        </div>
                    );
                })}
                {ghostOut.map((o) => {
                    const name = o.users_shuttle_daily_stop_overrides_user_idTousers.full_name;
                    return (
                        <div key={o.id} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm opacity-70">
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-fg-muted line-through">{name}</div>
                                <div className="text-xs text-fg-muted">Moved to {o.routes.name} today</div>
                            </div>
                            {canMutate && (
                                <IconButton label={`Undo moving ${name}`} size="icon-xs" onClick={() => onUndoGhost(o)} className="hover:bg-danger-soft hover:text-danger-ink">
                                    <RotateCcw />
                                </IconButton>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export function PlanLegend() {
    return (
        <div className="flex flex-wrap items-center gap-2" aria-label="Legend">
            <Badge tone="neutral" variant="outline">Usual rider</Badge>
            <Badge tone="brand" dot>Temporary — this day only</Badge>
            <Badge tone="info" variant="outline" dot className="border-dashed">Pending — not saved</Badge>
        </div>
    );
}

export function PlanBoard({
    routes,
    routeColor,
    getDisplayEntries,
    pendingUserIds,
    filteredGhostOutByRoute,
    getPendingGhostOut,
    canMutate,
    editingUserId,
    editValue,
    onEditValueChange,
    onStartEditTime,
    onSaveTime,
    onCancelEditTime,
    onUndo,
    onUndoGhost,
    onCancelPendingMove,
    onNudge,
    busy,
}: {
    routes: RouteOption[];
    routeColor: Map<number, string>;
    getDisplayEntries: (routeId: number) => RosterEntry[];
    pendingUserIds: Set<string>;
    filteredGhostOutByRoute: Map<number, OverrideRow[]>;
    getPendingGhostOut: (routeId: number) => PendingMove[];
    canMutate: boolean;
    editingUserId: string | null;
    editValue: string;
    onEditValueChange: (v: string) => void;
    onStartEditTime: (userId: string, current: string | null) => void;
    onSaveTime: (userId: string) => void;
    onCancelEditTime: () => void;
    onUndo: (entry: RosterEntry, routeId: number) => void;
    onUndoGhost: (row: OverrideRow) => void;
    onCancelPendingMove: (userId: string) => void;
    onNudge: (routeId: number, entry: RosterEntry, dir: -1 | 1) => void;
    busy: boolean;
}) {
    return (
        <div className="flex min-h-[480px] gap-4 overflow-x-auto pb-2">
            {routes.map((route) => (
                <RouteColumn
                    key={route.id}
                    route={route}
                    color={routeColor.get(route.id) ?? 'var(--cort-navy)'}
                    entries={getDisplayEntries(route.id)}
                    pendingUserIds={pendingUserIds}
                    ghostOut={filteredGhostOutByRoute.get(route.id) ?? []}
                    pendingGhostOut={getPendingGhostOut(route.id)}
                    canMutate={canMutate}
                    editingOverrideId={editingUserId}
                    editValue={editValue}
                    onEditValueChange={onEditValueChange}
                    onStartEditTime={onStartEditTime}
                    onSaveTime={onSaveTime}
                    onCancelEditTime={onCancelEditTime}
                    onUndo={onUndo}
                    onUndoGhost={onUndoGhost}
                    onCancelPendingMove={onCancelPendingMove}
                    onNudge={(entry, dir) => onNudge(route.id, entry, dir)}
                    busy={busy}
                />
            ))}
        </div>
    );
}

export function PlanDragPreview({ name }: { name: string }) {
    return (
        <div className="flex items-center gap-2 rounded-xl border border-brand-line bg-card px-3 py-2.5 text-sm shadow-[var(--shadow-modal)]">
            <ArrowLeftRight className="size-4 text-brand" aria-hidden="true" />
            <span className="font-semibold text-fg">{name}</span>
        </div>
    );
}

export function PlanBoardSkeleton() {
    return (
        <div className="flex gap-4" aria-busy="true" aria-label="Loading routes">
            {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[420px] min-w-[300px] rounded-xl" />
            ))}
        </div>
    );
}
