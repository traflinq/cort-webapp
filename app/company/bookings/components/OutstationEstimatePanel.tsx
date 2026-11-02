'use client';

import { useTranslations, useLocale } from 'next-intl';
import { formatLocaleNumber } from '@/app/lib/i18n/format';
import type { Locale } from '@/i18n/config';
import { useOutstationEstimate, LegDistance, ContractRateForEstimate } from '../../../hooks/useOutstationEstimate';

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
        <div className="mt-4 rounded-[20px] bg-[var(--bg-card)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-[var(--divider)]">
                <svg className="w-3.5 h-3.5 text-[var(--cort-orange)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {t('estimatedCost')}
                </span>
                <span className="ms-1 text-[11px] text-[var(--text-muted)] font-medium">{t('roundTripLabel')}</span>
                <span className="ms-auto text-[11px] font-medium text-[var(--text-muted)]">
                    {t('viaGoogleMaps')}
                </span>
            </div>

            <div className="px-5 py-4">
                {/* Loading */}
                {isLoading && (
                    <div className="flex items-center gap-3 py-3">
                        <div className="h-4 w-4 rounded-full border-2 border-[var(--cort-orange)] border-t-transparent animate-spin shrink-0" />
                        <span className="text-[11px] font-medium text-[var(--text-muted)]">
                            {t('calculatingDistances')}
                        </span>
                    </div>
                )}

                {/* Error */}
                {!isLoading && error && (
                    <div className="flex items-center gap-2 py-2 text-[11px] text-[var(--tone-danger-ink)] font-medium">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                        {t('distanceError')}
                    </div>
                )}

                {/* No contract rate */}
                {!isLoading && !error && !props.contractRate && (
                    <div className="text-[11px] text-[var(--text-muted)] font-medium py-2">
                        {t('selectVehicleForEstimate')}
                    </div>
                )}

                {/* No origin city */}
                {!isLoading && !error && props.contractRate && !props.originCity.trim() && (
                    <div className="text-[11px] text-[var(--text-muted)] font-medium py-2">
                        {t('enterBookingCity')}
                    </div>
                )}

                {/* Result */}
                {!isLoading && !error && estimate && (
                    <div className="flex flex-col gap-4">

                        {/* Route legs */}
                        <div className="flex flex-col gap-0">
                            {estimate.legs.map((leg: LegDistance, i: number) => (
                                <div key={i} className="relative flex items-start gap-3 pb-3 last:pb-0">
                                    {/* Timeline line */}
                                    {i < estimate.legs.length - 1 && (
                                        <div className="absolute start-[7px] top-5 bottom-0 w-px bg-[var(--tile-bg)]" />
                                    )}
                                    {/* Dot */}
                                    <div className={`relative mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
 leg.isReturn
 ? 'border-[var(--cort-navy)] bg-[var(--cort-navy)]'
 : i === 0
 ? 'border-[var(--cort-orange)] bg-[var(--cort-orange)]'
 : 'border-[var(--border-default)] bg-[var(--tile-bg)]'
 }`}>
                                        {leg.isReturn && (
                                            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                                            </svg>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">{leg.from}</span>
                                                <svg className="w-3 h-3 text-[var(--text-muted)] shrink-0 rtl-flip" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                </svg>
                                                <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">{leg.to}</span>
                                                {leg.isReturn && (
                                                    <span className="shrink-0 text-[11px] font-medium bg-[var(--tile-bg)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full">
                                                        {t('returnLeg')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-end">
                                                <span className="text-[11px] font-medium text-[var(--cort-orange)]">
                                                    {leg.distanceKm > 0 ? t('kmUnit', { distance: leg.distanceKm }) : '—'}
                                                </span>
                                                {leg.durationText && leg.durationText !== 'N/A' && (
                                                    <span className="ms-1.5 text-xs text-[var(--text-muted)] font-medium">({leg.durationText})</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Total distance */}
                            <div className="flex items-center justify-between pt-3 mt-1 border-t border-[var(--divider)]">
                                <span className="text-xs font-medium text-[var(--text-muted)]">{t('totalRoundTripDistance')}</span>
                                <span className="text-[13px] font-medium text-[var(--text-primary)]">{t('kmUnit', { distance: estimate.totalKm })}</span>
                            </div>
                        </div>

                        {/* Cost breakdown */}
                        <div className="rounded-2xl bg-[var(--tile-bg)] p-4 flex flex-col gap-2.5">

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
                            <div className="border-t border-dashed border-[var(--border-input)] pt-2.5">
                                <CostRow label={t('sstOnService')} value={estimate.sst} muted fmt={fmt} currency={tCommon('currency.pkr')} />
                            </div>

                            {/* Fuel — separate, not taxed */}
                            <div className="border-t border-dashed border-[var(--border-input)] pt-2.5">
                                <CostRow
                                    label={t('fuelCost')}
                                    value={estimate.fuelCost}
                                    sub={t('fuelCostSub', {
                                        km: String(estimate.totalKm),
                                        rate: String(Number(props.contractRate?.cost_per_km || 0)),
                                    })}
                                    accent
                                    fmt={fmt}
                                    currency={tCommon('currency.pkr')}
                                />
                                <p className="text-[11px] text-[var(--text-muted)] font-medium mt-1">
                                    {t('tollParkingNote')}
                                </p>
                            </div>

                            {/* Grand total */}
                            <div className="border-t-2 border-[var(--border-input)] pt-3 mt-0.5 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-[var(--text-primary)]">{t('estimatedTotal')}</span>
                                <span className="text-[16px] font-medium text-[var(--cort-orange)]">
                                    {tCommon('currency.pkr')} {fmt(estimate.total)}
                                </span>
                            </div>
                        </div>

                        <p className="text-[11px] text-[var(--text-muted)] font-medium tracking-tight leading-relaxed">
                            {t('estimateDisclaimer')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function CostRow({ label, value, sub, muted, accent, fmt, currency }: {
    label: string;
    value: number;
    sub?: string;
    muted?: boolean;
    accent?: boolean;
    fmt: (n: number) => string;
    currency: string;
}) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-medium ${muted ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>{label}</span>
                {sub && <span className="text-[11px] text-[var(--text-muted)] font-medium">{sub}</span>}
            </div>
            <span className={`text-[11px] font-medium ${
 muted ? 'text-[var(--text-muted)]' : accent ? 'text-[var(--cort-orange)]' : 'text-[var(--text-primary)]'
 }`}>
                {currency} {fmt(value)}
            </span>
        </div>
    );
}
