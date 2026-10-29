'use client';

import { MapPin, X } from 'lucide-react';
import StopAddressSearch from '@/app/admin/ui/StopAddressSearch';
import { Button, Field, FormGrid } from '@/app/admin/ui';
import type { RouteDirectionConfig, RoutePoint } from '@/app/lib/store/slices/adminRoutesSlice';

export type PointsForm = Record<'MORNING' | 'EVENING', { start: RoutePoint | null; end: RoutePoint | null }>;

export const emptyPoints = (): PointsForm => ({
    MORNING: { start: null, end: null },
    EVENING: { start: null, end: null },
});

const toPoint = (lat: unknown, lng: unknown, address: string | null): RoutePoint | null =>
    lat != null && lng != null ? { lat: Number(lat), lng: Number(lng), address: address ?? undefined } : null;

export function pointsFromConfigs(configs?: RouteDirectionConfig[]): PointsForm {
    const out = emptyPoints();
    for (const c of configs ?? []) {
        out[c.direction] = {
            start: toPoint(c.start_lat, c.start_lng, c.start_address),
            end: toPoint(c.end_lat, c.end_lng, c.end_address),
        };
    }
    return out;
}

const KM = (v: unknown) => (v == null ? null : `${Number(v).toFixed(1)} km`);

/**
 * The one driver end that can differ per direction: morning start (before the first pickup) or
 * evening end (after the last drop). Morning ends and evening starts at the office.
 * Returns null when unset; `hint` explains the km it adds to planned distance.
 */
export function driverEndPoint(configs: RouteDirectionConfig[] | undefined, dir: 'MORNING' | 'EVENING') {
    const c = configs?.find((x) => x.direction === dir);
    const has = dir === 'MORNING' ? c?.start_lat != null : c?.end_lat != null;
    if (!has) return null;
    const address = dir === 'MORNING' ? c?.start_address : c?.end_address;
    const km = KM(dir === 'MORNING' ? c?.start_leg_km : c?.end_leg_km);
    return {
        address: address || 'Pinned location',
        hint: km ? `Adds ${km} to planned distance` : 'Distance not calculated yet',
    };
}

function PointField({ label, hint, value, onChange }: { label: string; hint: string; value: RoutePoint | null; onChange: (p: RoutePoint | null) => void }) {
    return (
        <Field label={label} hint={hint}>
            <div className="space-y-1.5">
                <StopAddressSearch
                    aria-label={label}
                    defaultValue={value?.address ?? ''}
                    placeholder="Search address or place…"
                    onSelect={(p) => onChange({ lat: p.lat, lng: p.lng, address: p.fullAddress.slice(0, 255) })}
                />
                {value ? (
                    <p className="flex items-center gap-1.5 text-xs text-fg-secondary">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
                        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} leftIcon={<X />}>
                            Clear
                        </Button>
                    </p>
                ) : (
                    <p className="text-xs text-fg-muted">Not set</p>
                )}
            </div>
        </Field>
    );
}

/**
 * Morning: where the driver starts before the first pickup. Evening: where the driver ends after the last drop.
 * (Morning ends at the office and evening starts there, so those ends need no field.) Unset on both → planned distance uses a flat +10% estimate instead.
 */
export function DirectionPointsEditor({ value, onChange }: { value: PointsForm; onChange: (next: PointsForm) => void }) {
    const set = (dir: 'MORNING' | 'EVENING', side: 'start' | 'end', p: RoutePoint | null) =>
        onChange({ ...value, [dir]: { ...value[dir], [side]: p } });
    return (
        <FormGrid cols={2}>
            <PointField label="Morning: driver starts at" hint="Before the first pickup, e.g. the driver's home or depot." value={value.MORNING.start} onChange={(p) => set('MORNING', 'start', p)} />
            <PointField label="Evening: driver ends at" hint="After the last drop, e.g. back to the depot or home." value={value.EVENING.end} onChange={(p) => set('EVENING', 'end', p)} />
        </FormGrid>
    );
}
