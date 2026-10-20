'use client';

import { Car, Save, Sun, Sunset, Users } from 'lucide-react';
import type { Company } from '@/app/lib/services/api-client';
import {
    Button,
    Field,
    FilterBar,
    FilterField,
    Input,
    PageHeader,
    Select,
    Switch,
    Tabs,
    TabsList,
    TabsTrigger,
} from '@/app/admin/ui';
import { formatPlanDate, type Direction, type OpsTab } from './plan-types';

export function PlanCommandBar({
    companies,
    companyId,
    date,
    direction,
    opsTab,
    canMutate,
    saving,
    hasUnsavedChanges,
    passengerCount,
    routeCount,
    unsavedSummary,
    mapOpen,
    showMapToggle,
    onCompanyChange,
    onDateChange,
    onDirectionChange,
    onTabChange,
    onSave,
    onDiscard,
    onToggleMap,
}: {
    companies: Company[];
    companyId: number | '';
    date: string;
    direction: Direction;
    opsTab: OpsTab;
    canMutate: boolean;
    saving: boolean;
    hasUnsavedChanges: boolean;
    passengerCount: number;
    routeCount: number;
    unsavedSummary: string;
    mapOpen: boolean;
    showMapToggle: boolean;
    onCompanyChange: (id: number | '') => void;
    onDateChange: (date: string) => void;
    onDirectionChange: (d: Direction) => void;
    onTabChange: (tab: OpsTab) => void;
    onSave: () => void;
    onDiscard: () => void;
    onToggleMap: () => void;
}) {
    const description =
        companyId !== '' && opsTab === 'passengers' && routeCount > 0
            ? `${formatPlanDate(date)} · ${passengerCount} ${passengerCount === 1 ? 'passenger' : 'passengers'} on ${routeCount} ${routeCount === 1 ? 'route' : 'routes'}`
            : formatPlanDate(date);

    return (
        <PageHeader
            title="Today's plan"
            description={description}
            actions={
                canMutate ? (
                    <>
                        {hasUnsavedChanges && (
                            <span className="hidden text-xs font-medium text-brand-ink lg:inline" aria-live="polite">
                                Unsaved · {unsavedSummary}
                            </span>
                        )}
                        <Button variant="outline" onClick={onDiscard} disabled={saving || !hasUnsavedChanges}>
                            Discard
                        </Button>
                        <Button onClick={onSave} disabled={!hasUnsavedChanges} loading={saving} leftIcon={<Save />}>
                            Save changes
                        </Button>
                    </>
                ) : (
                    <span className="text-xs italic text-fg-muted">View only</span>
                )
            }
            tabs={
                <div className="flex flex-col gap-3">
                    <FilterBar>
                        <FilterField label="Date">
                            <Input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} className="h-8 text-xs" />
                        </FilterField>
                        <Tabs value={direction} onValueChange={(v) => onDirectionChange(v as Direction)}>
                            <TabsList variant="pills" aria-label="Direction">
                                <TabsTrigger value="MORNING" icon={<Sun />}>Morning</TabsTrigger>
                                <TabsTrigger value="EVENING" icon={<Sunset />}>Evening</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Field inline label="Company">
                            <Select
                                width="auto"
                                className="h-8 min-w-[12rem] text-xs"
                                value={companyId === '' ? '' : String(companyId)}
                                onChange={(e) => onCompanyChange(e.target.value ? Number(e.target.value) : '')}
                                placeholder="Select a company"
                            >
                                {companies.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </Select>
                        </Field>
                    </FilterBar>

                    {companyId !== '' && (
                        <div className="flex flex-wrap items-center gap-3">
                            <Tabs value={opsTab} onValueChange={(v) => onTabChange(v as OpsTab)}>
                                <TabsList variant="pills" aria-label="What to plan">
                                    <TabsTrigger value="passengers" icon={<Users />} count={routeCount > 0 ? passengerCount : undefined}>
                                        Passengers
                                    </TabsTrigger>
                                    <TabsTrigger value="crew" icon={<Car />}>Drivers &amp; vehicles</TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <p className="hidden text-xs text-fg-muted sm:block">
                                {opsTab === 'passengers' ? 'Passenger moves save when you press Save.' : 'Driver and vehicle changes save when you press Save.'}
                            </p>
                            {showMapToggle && (
                                <div className="ml-auto">
                                    <Switch size="sm" label="Show map" checked={mapOpen} onCheckedChange={onToggleMap} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            }
        />
    );
}

/** Sticky bottom bar shown while there are unsaved changes. */
export function PlanSaveBar({
    summary,
    saving,
    onDiscard,
    onSave,
}: {
    summary: string;
    saving: boolean;
    onDiscard: () => void;
    onSave: () => void;
}) {
    return (
        <div
            role="region"
            aria-label="Unsaved changes"
            className="sticky bottom-4 z-30 mx-auto flex w-fit max-w-full items-center gap-3 rounded-xl border border-brand-line bg-elevated px-3 py-2 shadow-[var(--shadow-modal)]"
        >
            <span className="hidden pl-1 text-xs font-medium text-fg-secondary sm:inline">{summary}</span>
            <Button size="sm" variant="outline" onClick={onDiscard} disabled={saving}>
                Discard
            </Button>
            <Button size="sm" onClick={onSave} loading={saving} leftIcon={<Save />}>
                Save changes
            </Button>
        </div>
    );
}
