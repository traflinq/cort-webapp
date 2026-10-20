'use client';

/**
 * Shared helpers for the Routes area (list, create, detail, stops, roster).
 * The old command-bar/pill/empty-state components are kept as thin wrappers over
 * the design-system primitives so nothing outside this folder has to change.
 */
import type { ReactNode } from 'react';
import { Bus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, EmptyState, PageHeader, focusRing } from '@/app/admin/ui';
import { formatTime, initials as initialsFmt } from '@/app/admin/lib/format';

/**
 * Google Maps needs raw hex. These mirror the light chart palette (chart-1 orange,
 * chart-2 blue, chart-3 green, chart-4 violet, chart-6 amber) and brand navy, so
 * map legends and badges stay consistent with the rest of the portal.
 */
export const MAP_COLORS = {
    office: '#e5700a',
    pickup: '#2a78d6',
    highlighted: '#6250d6',
    editing: '#eda100',
    draft: '#1baf7a',
    route: '#0c225e',
    fallback: '#2a78d6',
    geofence: '#2a78d6',
    geofenceSaved: '#e5700a',
} as const;

/**
 * Extract "HH:mm" from "HH:mm", "HH:mm:ss" or a time-only ISO value
 * ("1970-01-01T08:00:00.000Z"). Time-only values are read as-is (UTC), never shifted.
 */
export function toClockHHmm(timeStr: string | null | undefined): string {
    if (!timeStr) return '';
    const trimmed = String(timeStr).trim();
    const hhmm = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (hhmm) {
        const hour = Number.parseInt(hhmm[1], 10);
        if (!Number.isNaN(hour) && hour >= 0 && hour <= 23) {
            return `${String(hour).padStart(2, '0')}:${hhmm[2]}`;
        }
    }
    try {
        const date = new Date(trimmed.includes('T') ? trimmed : `1970-01-01T${trimmed}Z`);
        if (Number.isNaN(date.getTime())) return trimmed;
        return date.toISOString().substring(11, 16);
    } catch {
        return trimmed;
    }
}

/** Any time value → "8:00 AM"; null when empty/unparseable. */
export function format12h(time: string | null | undefined): string | null {
    const hhmm = toClockHHmm(time);
    if (!hhmm) return null;
    const out = formatTime(hhmm);
    return out === '—' ? null : out;
}

export const initials = initialsFmt;

/** @deprecated Use PageHeader directly. Kept for API compatibility. */
export function RouteCommandBar({
    title,
    subtitle,
    filters,
    actions,
    tabs,
}: {
    title: string;
    subtitle?: ReactNode;
    filters?: ReactNode;
    actions?: ReactNode;
    tabs?: ReactNode;
}) {
    return (
        <PageHeader
            title={title}
            description={subtitle}
            actions={actions}
            meta={filters}
            tabs={tabs}
        />
    );
}

/** Empty state inside a card, used by the routes list. */
export function RouteEmptyState({
    title,
    description,
    action,
    icon,
}: {
    title: string;
    description: string;
    action?: ReactNode;
    icon?: ReactNode;
}) {
    return (
        <Card>
            <EmptyState icon={icon ?? <Bus aria-hidden="true" />} title={title} description={description} action={action} />
        </Card>
    );
}

/** Small toggle pill with pressed state. Prefer <Tabs variant="pills"> for tab sets. */
export function RoutePill({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors [&_svg]:size-4',
                active ? 'bg-card text-fg shadow-xs' : 'text-fg-muted hover:text-fg',
                focusRing,
            )}
        >
            {children}
        </button>
    );
}
