import { useEffect } from 'react';
import type { KeyboardCoordinateGetter } from '@dnd-kit/core';
import type { StatusEntry } from '@/app/admin/ui';
import { BUSINESS_TZ, formatTime, initials as initialsOf } from '@/app/admin/lib/format';

export type Direction = 'MORNING' | 'EVENING';
export type OpsTab = 'passengers' | 'crew';

export interface RouteOption {
    id: number;
    name: string;
    company_id: number | null;
    companies: { id: number; name: string } | null;
}

export interface RosterUser {
    id: string;
    full_name: string;
    phone: string | null;
    department: string | null;
}

export interface RosterEntry {
    user_id: string;
    pickup_stop_id: number | null;
    stop_name: string | null;
    lat: number | null;
    lng: number | null;
    sequence: number | null;
    pickup_time: string | null;
    is_override: boolean;
    override: {
        id: number;
        from_route_id: number | null;
        from_route_name: string | null;
        to_route_id: number;
        scheduled_time: string | null;
    } | null;
    user: RosterUser | null;
}

export interface PendingMove {
    entry: RosterEntry;
    fromRouteId: number;
    toRouteId: number;
    toRouteName: string;
}

export interface PendingUndo {
    overrideId: number;
    entry: RosterEntry;
    toRouteId: number;
    fromRouteId: number | null;
}

export interface PendingCrewChange {
    tripId: number;
    driver_id?: string;
    vehicle_id?: number;
    restore?: boolean;
}

export interface OverrideRow {
    id: number;
    user_id: string;
    from_route_id: number | null;
    to_route_id: number;
    to_sequence: number;
    stop_name: string;
    scheduled_time: string | null;
    routes: { id: number; name: string };
    users_shuttle_daily_stop_overrides_user_idTousers: { id: string; full_name: string; phone: string | null };
}

/* ── Scheduled trips (shared by the daily plan crew panel and trip scheduling) ── */

export type TripVehicle = { id: number; plate_number: string; make?: string | null; model: string | null };

export type ScheduledTripRow = {
    id: number;
    driver_id: string | null;
    vehicle_id: number | null;
    trip_date: string | null;
    direction: string;
    status: string;
    vehicles: TripVehicle | null;
    routes: {
        id: number;
        name: string;
        company_id: number | null;
        assigned_vehicle_id: number | null;
        assigned_driver_id: string | null;
        companies?: { id: number; name: string } | null;
        users?: { id: string; full_name: string } | null;
        vehicles: TripVehicle | null;
    } | null;
    users: { id: string; full_name: string } | null;
    shuttle_trip_resource_overrides?: { id: number; from_driver_id: string | null; from_vehicle_id: number | null } | null;
};

export function tripVehicle(trip: ScheduledTripRow): TripVehicle | null {
    return trip.vehicles ?? trip.routes?.vehicles ?? null;
}

export function tripVehicleId(trip: ScheduledTripRow): number | null {
    return trip.vehicle_id ?? trip.vehicles?.id ?? trip.routes?.assigned_vehicle_id ?? trip.routes?.vehicles?.id ?? null;
}

export function vehicleLabel(v: { plate_number?: string | null; make?: string | null; model?: string | null }): string {
    const plate = v.plate_number ?? 'No plate';
    const name = [v.make, v.model].filter(Boolean).join(' ');
    return name ? `${plate} · ${name}` : plate;
}

/** Friendlier labels for trip statuses on ops screens; tones come from the shared registry. */
export const TRIP_STATUS_OVERRIDES: Record<string, StatusEntry> = {
    SCHEDULED: { tone: 'info', label: 'Scheduled' },
    STARTED: { tone: 'brand', label: 'On the road' },
    IN_PROGRESS: { tone: 'brand', label: 'On the road' },
    COMPLETED: { tone: 'success', label: 'Finished' },
    CANCELLED: { tone: 'danger', label: 'Cancelled' },
};

/* ── Dates ─────────────────────────────────────────────────────────────── */

/**
 * The API treats every YYYY-MM-DD it receives (trip_date, override_date, from/to) as a
 * calendar day stored at UTC midnight. "Today" for operations is therefore the calendar
 * date in the business timezone (Asia/Karachi), not the browser's or the server's clock.
 */
export function businessTodayYmd(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** trip_date (UTC midnight ISO or YYYY-MM-DD) → "Tue, 21 Oct 2026" without timezone drift. */
export function formatTripDate(isoOrDate: string | null): string {
    if (!isoOrDate) return '—';
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return isoOrDate.slice(0, 10);
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** "Tuesday, 21 Oct 2026" for the plan header. */
export function formatPlanDate(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) return ymd;
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
}

/** HH:mm → 12-hour clock, or null when empty. */
export function format12h(hhmm: string | null | undefined): string | null {
    if (!hhmm) return null;
    return formatTime(hhmm);
}

export const initials = initialsOf;

/**
 * Runs an async loader whenever it changes. Deferred by one tick so that rapid dependency
 * changes (and StrictMode's double invoke) cancel the stale call instead of double-fetching.
 */
export function useLoader(load: () => void | Promise<unknown>) {
    useEffect(() => {
        const t = setTimeout(() => {
            void load();
        }, 0);
        return () => clearTimeout(t);
    }, [load]);
}

/* ── Keyboard drag between route columns ───────────────────────────────── */

/**
 * Arrow-left/right jump the dragged passenger to the centre of the previous/next route
 * column; up/down nudge by 25px like the default sensor. Lets keyboard users move people
 * between routes without a pointer.
 */
export const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
    const { droppableRects, droppableContainers, collisionRect } = context;
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault();
        return { x: currentCoordinates.x, y: currentCoordinates.y + (event.code === 'ArrowDown' ? 25 : -25) };
    }
    if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return undefined;
    event.preventDefault();
    if (!collisionRect) return currentCoordinates;

    const columns = droppableContainers
        .getEnabled()
        .map((c) => ({ id: c.id, rect: droppableRects.get(c.id) }))
        .filter((c): c is { id: typeof c.id; rect: NonNullable<typeof c.rect> } => !!c.rect)
        .sort((a, b) => a.rect.left - b.rect.left);
    if (columns.length === 0) return currentCoordinates;

    const currentX = collisionRect.left + collisionRect.width / 2;
    let idx = columns.findIndex((c) => currentX >= c.rect.left && currentX <= c.rect.right);
    if (idx < 0) {
        idx = columns.reduce((best, c, i) => {
            const dist = Math.abs(c.rect.left + c.rect.width / 2 - currentX);
            const bestDist = Math.abs(columns[best].rect.left + columns[best].rect.width / 2 - currentX);
            return dist < bestDist ? i : best;
        }, 0);
    }
    const next = idx + (event.code === 'ArrowRight' ? 1 : -1);
    if (next < 0 || next >= columns.length) return currentCoordinates;
    const target = columns[next].rect;
    return { x: currentCoordinates.x + (target.left + target.width / 2 - currentX), y: currentCoordinates.y };
};
