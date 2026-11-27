'use client';

import { useTranslations, useLocale } from 'next-intl';
import { formatLocaleNumber } from '@/app/lib/i18n/format';
import type { Locale } from '@/i18n/config';
import { useOutstationEstimate, LegDistance, ContractRateForEstimate } from '../../../hooks/useOutstationEstimate';
import { AlertTriangle, ArrowRight, Calculator } from 'lucide-react';
import { Badge, Spinner } from '@/app/admin/ui';
import { cn } from '@/lib/utils';

interface OutstationEstimatePanelProps {
    originCity: string;
    destinationCities: string[];
    noOfDays: number;
    packageType: '5hr' | '10hr' | '24hr' | 'monthly_10hr' | 'monthly_24hr';
    contractRate: ContractRateForEstimate | null;
    outstationAllowancePerDay: number;
    accommodationAllowancePerNight: number;
}

export default function OutstationEstimatePanel(props: OutstationEstimatePanelProps) {
    const t = useTranslations('company.bookings');
    const tCommon = useTranslations('common');
    const locale = useLocale() as Locale;
    const { estimate, isLoading, error } = useOutstationEstimate(props);

    const fmt = (n: number) => formatLocaleNumber(n, locale);

    if (!props.destinationCities.length) return null;

    const nights = Math.max(0, props.noOfDays - 1);
    const daysLabel = String(props.noOfDays);

    return (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-card">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-4 py-3">
                <Calculator className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                <span className="text-sm font-semibold text-fg">{t('estimatedCost')}</span>
                <span className="text-xs text-fg-muted">{t('roundTripLabel')}</span>
                <span className="ms-auto text-xs text-fg-muted">{t('viaGoogleMaps')}</span>
            </div>

            <div className="px-4 py-4">
                {/* Loading */}
                {isLoading && (
                    <div className="flex items-center gap-2 py-2 text-xs text-fg-muted" aria-live="polite">
                        <Spinner size="sm" label={t('calculatingDistances')} />
                        <span aria-hidden="true">{t('calculatingDistances')}</span>
                    </div>
                )}

                {/* Error */}
                {!isLoading && error && (
                    <div role="alert" className="flex items-center gap-2 py-2 text-xs text-danger-ink">
                        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                        {t('distanceError')}
                    </div>
                )}

                {/* No contract rate */}
                {!isLoading && !error && !props.contractRate && (
                    <p className="py-2 text-xs text-fg-muted">{t('selectVehicleForEstimate')}</p>
                )}

                {/* No origin city */}
                {!isLoading && !error && props.contractRate && !props.originCity.trim() && (
                    <p className="py-2 text-xs text-fg-muted">{t('enterBookingCity')}</p>
                )}

                {/* Result */}
                {!isLoading && !error && estimate && (
                    <div className="flex flex-col gap-4">
                        {/* Route legs */}
                        <div className="flex flex-col">
                            <ol className="flex flex-col">
                                {estimate.legs.map((leg: LegDistance, i: number) => (
                                    <li key={i} className="relative flex items-start gap-3 pb-3 last:pb-0">
                                        {/* Timeline line */}
                                        {i < estimate.legs.length - 1 && (
                                            <span aria-hidden="true" className="absolute start-[5px] top-4 bottom-0 w-px bg-line" />
                                        )}
                                        {/* Dot */}
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                'relative mt-1.5 size-[11px] shrink-0 rounded-full border-2',
                                                i === 0 ? 'border-fg bg-fg' : leg.isReturn ? 'border-fg-muted bg-card' : 'border-line-strong bg-card',
                                            )}
                                        />

                                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-1.5 text-sm text-fg">
                                                <span className="truncate">{leg.from}</span>
                                                <ArrowRight className="size-3.5 shrink-0 text-fg-muted rtl:rotate-180" aria-hidden="true" />
                                                <span className="truncate">{leg.to}</span>
                                                {leg.isReturn && (
                                                    <Badge tone="neutral" className="shrink-0">{t('returnLeg')}</Badge>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-end text-sm tabular-nums">
                                                <span className="font-medium text-fg">
                                                    {leg.distanceKm > 0 ? t('kmUnit', { distance: leg.distanceKm }) : '—'}
                                                </span>
                                                {leg.durationText && leg.durationText !== 'N/A' && (
                                                    <span className="ms-1.5 text-xs text-fg-muted">({leg.durationText})</span>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ol>

                            {/* Total distance */}
                            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                                <span className="text-xs font-medium text-fg-muted">{t('totalRoundTripDistance')}</span>
                                <span className="text-sm font-semibold tabular-nums text-fg">{t('kmUnit', { distance: estimate.totalKm })}</span>
                            </div>
                        </div>

                        {/* Cost breakdown */}
                        <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-subtle/40 p-4">
                            {/* Service charges */}
                            <CostRow
                                label={t('basePackageCost')}
                                value={estimate.basePackageCost}
                                sub={t('daysRate', { days: daysLabel })}
                                fmt={fmt}
                                currency={tCommon('currency.pkr')}
                            />
                            {estimate.outstationAllowance > 0 && (
                                <CostRow
                                    label={t('outstationAllowance')}
                                    value={estimate.outstationAllowance}
                                    sub={daysLabel}
                                    fmt={fmt}
                                    currency={tCommon('currency.pkr')}
                                />
                            )}
                            {estimate.accommodationAllowance > 0 && (
                                <CostRow
                                    label={t('accommodation')}
                                    value={estimate.accommodationAllowance}
                                    sub={t('nightsCount', { nights: String(nights) })}
                                    fmt={fmt}
                                    currency={tCommon('currency.pkr')}
                                />
                            )}

                            {/* SST on service */}
                            <div className="border-t border-dashed border-line pt-2.5">
                                <CostRow label={t('sstOnService')} value={estimate.sst} muted fmt={fmt} currency={tCommon('currency.pkr')} />
                            </div>

                            {/* Fuel — separate, not taxed */}
                            <div className="border-t border-dashed border-line pt-2.5">
                                <CostRow
                                    label={t('fuelCost')}
                                    value={estimate.fuelCost}
                                    sub={t('fuelCostSub', {
                                        km: String(estimate.totalKm),
                                        rate: String(Number(props.contractRate?.cost_per_km || 0)),
                                    })}
                                    fmt={fmt}
                                    currency={tCommon('currency.pkr')}
                                />
                                <p className="mt-1 text-xs text-fg-muted">{t('tollParkingNote')}</p>
                            </div>

                            {/* Grand total */}
                            <div className="mt-0.5 flex items-center justify-between gap-3 border-t border-line-strong pt-3">
                                <span className="text-sm font-semibold text-fg">{t('estimatedTotal')}</span>
                                <span className="text-base font-semibold tabular-nums text-fg">
                                    {tCommon('currency.pkr')} {fmt(estimate.total)}
                                </span>
                            </div>
                        </div>

                        <p className="text-xs leading-relaxed text-fg-muted">{t('estimateDisclaimer')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function CostRow({ label, value, sub, muted, fmt, currency }: {
    label: string;
    value: number;
    sub?: string;
    muted?: boolean;
    fmt: (n: number) => string;
    currency: string;
}) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                <span className={cn('text-sm', muted ? 'text-fg-muted' : 'text-fg-secondary')}>{label}</span>
                {sub && <span className="text-xs tabular-nums text-fg-muted">{sub}</span>}
            </div>
            <span className={cn('shrink-0 text-end text-sm font-medium tabular-nums', muted ? 'text-fg-muted' : 'text-fg')}>
                {currency} {fmt(value)}
            </span>
        </div>
    );
}
