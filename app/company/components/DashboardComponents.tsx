'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useCompanyLocale } from '../lib/locale-context';
import { formatLocaleDate, formatLocaleTime } from '../../lib/i18n/format';
import {
    CheckCircle,
    AlertCircle,
    TrendingDown,
    TrendingUp,
    Users,
    Car,
    Bus,
    MapPin,
    Clock,
    CreditCard,
    Calendar,
    ShieldCheck,
    Star,
    Activity,
    FileText,
    Settings,
    Wallet
} from 'lucide-react';
import { DashboardData } from '../types';

// --- Shared Components ---

const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (absValue >= 1000) {
        return sign + Math.round(absValue / 1000) + 'k';
    }
    return sign + absValue.toLocaleString();
};

export const Card = ({ children, className = "", withLeftBorder = false }: { children: React.ReactNode; className?: string; withLeftBorder?: boolean }) => (
    <div className={`bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 h-full min-w-0 shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition-all duration-200 hover:shadow-[0_2px_10px_rgba(0,0,0,0.18)] ${withLeftBorder ? 'border-s-4 border-s-[#fe8503]' : ''} ${className}`}>
        {children}
    </div>
);

export const SectionTitle = ({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) => (
    <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-3 sm:mb-4 flex items-center gap-2 min-w-0 flex-wrap">
        {icon && <span className="text-[#fe8503] shrink-0">{icon}</span>}
        {children}
    </h3>
);

// --- Charts & Visuals ---

const Sparkline = ({ data = [40, 30, 45, 50, 42, 55, 60], color = "var(--cort-orange)" }: { data?: number[], color?: string }) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((d, i) => `${(i / (data.length - 1)) * 60},${20 - ((d - min) / range) * 20}`).join(' ');

    return (
        <svg width="60" height="20" className="opacity-70">
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

const DonutChart = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
    const t = useTranslations('company.dashboard');
    const total = data.reduce((acc, curr) => acc + (curr.value || 0), 0);
    let currentOffset = 0;

    return (
        <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center -mt-2">
            <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                {total === 0 ? (
                    <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="var(--border-light)"
                        strokeWidth="12"
                    />
                ) : (
                    data.map((item, i) => {
                        const percentage = total > 0 ? (item.value / total) * 100 : 0;
                        const circumference = 2 * Math.PI * 40; // r=40
                        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                        const strokeDashoffset = -currentOffset;
                        currentOffset += (percentage / 100) * circumference;

                        return (
                            <circle
                                key={i}
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                stroke={item.color}
                                strokeWidth="12"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-all duration-500 hover:opacity-80"
                            />
                        );
                    })
                )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-[var(--text-primary)]">{total}</span>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{t('totalRides')}</span>
            </div>
        </div>
    );
};

const HeatmapPlaceholder = () => (
    <div className="relative w-full h-24 bg-[var(--surface-muted)] rounded-[2rem] overflow-hidden border border-[var(--border-light)] mt-2">
        {/* Abstract Map Roads */}
        <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 200 100" preserveAspectRatio="none">
            <path d="M0,50 Q50,40 100,50 T200,50" stroke="var(--text-muted)" strokeWidth="2" fill="none" />
            <path d="M40,0 Q50,50 60,100" stroke="var(--text-muted)" strokeWidth="2" fill="none" />
            <path d="M140,0 Q130,50 120,100" stroke="var(--text-muted)" strokeWidth="2" fill="none" />
            <path d="M20,20 L180,80" stroke="var(--text-muted)" strokeWidth="1" fill="none" />
        </svg>
        {/* Hotspots */}
        <div className="absolute top-1/2 left-1/3 w-8 h-8 bg-[#fe8503]/20 rounded-full blur-md animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-6 h-6 bg-[var(--cort-orange)]/30 rounded-full blur-md animate-pulse delay-75"></div>
        <div className="absolute bottom-1/4 left-1/4 w-10 h-10 bg-[var(--accent-success)]/20 rounded-full blur-xl"></div>
    </div>
)

// --- Sections ---

export const TakingCareSection = ({ data }: { data: DashboardData['takingCare'] }) => {
    const t = useTranslations('company.dashboard');
    const isZero = data.unassignedBookings === 0;

    return (
        <div className="grid grid-cols-1 gap-4 h-full">
            <Card className="relative overflow-hidden group transition-all">
                <div className={`absolute top-0 end-0 p-4 transition-opacity opacity-5 text-[#fe8503]`}>
                    <AlertCircle size={80} />
                </div>
                <div className="relative z-10">
                    <div className="text-[var(--text-muted)] font-medium text-xs sm:text-sm mb-1 uppercase tracking-wider">{t('unassignedBookings')}</div>
                    <div className="text-4xl sm:text-5xl font-black text-[var(--text-primary)]">{data.unassignedBookings}</div>
                    <div className="mt-2 text-sm text-[var(--text-muted)] flex items-center gap-2 flex-wrap">
                        {isZero ? t('allCaughtUp') : <span className="bg-[#fe8503]/15 text-[#fe8503] font-bold px-2 py-0.5 rounded-full text-xs border border-[#fe8503]/30">{t('requiresAttention')}</span>}
                    </div>
                </div>
            </Card>

            <Card className="bg-[var(--bg-card)] border-[var(--border-default)] relative overflow-hidden group">
                <div className="absolute top-0 end-0 p-4 text-[var(--accent-success)] opacity-5 group-hover:opacity-10 transition-opacity">
                    <CheckCircle size={80} />
                </div>
                <div className="relative z-10">
                    <div className="text-[var(--text-muted)] font-medium text-xs sm:text-sm mb-1 uppercase tracking-wider">{t('ridesCompleted')}</div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <div className="text-4xl sm:text-5xl font-black text-[var(--text-primary)]">{data.ridesCompleted}</div>
                        <div className="text-sm font-bold text-[var(--text-primary)] bg-[var(--accent-success)] px-2 py-1 rounded-full">{data.completedTrend}</div>
                    </div>
                    <div className="mt-2 text-[var(--text-muted)] text-sm">{t('successfullyCompleted')}</div>
                </div>
            </Card>
        </div>
    );
};

export const NothingToDoSection = ({ data, outstandingAmount = 0, invoices = [] }: { 
    data: DashboardData['nothingToDo'];
    outstandingAmount?: number;
    invoices?: any[];
}) => {
    const t = useTranslations('company.dashboard');
    const tCurrency = useTranslations('common.currency');
    const tStatus = useTranslations('common.status');
    const { locale } = useCompanyLocale();
    const hasOutstanding = outstandingAmount > 0;

    return (
        <Card className={`group relative overflow-visible bg-[var(--bg-card)] p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-[var(--border-default)] h-full transition-all duration-300 flex flex-col justify-between min-w-0`}>
            {/* Background Icon matching Savings card */}
            <div className="pointer-events-none absolute inset-y-0 end-0 w-24 sm:w-32 overflow-hidden flex items-center justify-center opacity-10 group-hover:opacity-15 transition-opacity">
                {hasOutstanding ? (
                    <Wallet size={120} className="text-[var(--accent-danger)]" />
                ) : (
                    <CheckCircle size={120} className="text-[var(--accent-success)]" />
                )}
            </div>
            
            <div className="relative z-10 pt-2">
                <div className="text-[var(--text-muted)] text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-4">
                    {hasOutstanding ? t('outstandingBalance') : t('currentStatus')}
                </div>
                {hasOutstanding && (
                    <div className="flex items-baseline flex-wrap gap-x-1 -mt-1">
                        <span className="text-xl sm:text-2xl font-bold text-[var(--text-muted)] leading-none">{tCurrency('pkr')}</span>
                        <span className="text-4xl sm:text-5xl lg:text-6xl font-black text-[var(--accent-danger)] tracking-tighter leading-none">
                            {formatCurrency(outstandingAmount)}
                        </span>
                    </div>
                )}
            </div>

            <div className="relative z-10">
                {hasOutstanding ? (
                    <div className="flex flex-col">
                        <div className="group/info invoice-tooltip-trigger text-xs text-[var(--text-muted)] mt-2 flex items-center gap-2 cursor-default relative z-20" tabIndex={0}>
                            <span className="font-bold">{t('totalUnpaidOverdue')}</span>
                            <span className="w-2 h-2 rounded-full bg-[var(--accent-danger)] inline-block animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span>
                            
                            {/* Invoices Tooltip — hover on desktop, focus-within for touch */}
                            {invoices.length > 0 && (
                                <div className="invisible group-hover/info:visible group-focus-within/info:visible absolute top-full start-0 mt-3 w-[min(16rem,calc(100vw-3rem))] bg-[var(--bg-card)] border border-[var(--border-input)] rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl z-[300] overflow-hidden transform transition-all duration-200 opacity-0 group-hover/info:opacity-100 group-focus-within/info:opacity-100 -translate-y-2 group-hover/info:translate-y-0 group-focus-within/info:translate-y-0 text-start font-normal -translate-x-2">
                                    <div className="bg-[var(--bg-subtle)] px-4 py-2 border-b border-[var(--border-default)] text-[var(--text-primary)] font-bold text-[10px] uppercase">
                                        {t('recentOutstandingInvoices')}
                                    </div>
                                    <div className="divide-y divide-[var(--border-default)] max-h-48 overflow-y-auto">
                                        {invoices.map((inv, idx) => (
                                            <div key={idx} className="px-4 py-2 hover:bg-[var(--bg-subtle)] transition-colors">
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="font-mono text-[10px] text-[var(--text-primary)] font-bold truncate">{inv.invoice_number}</span>
                                                    <span className="text-[var(--accent-danger)] font-bold text-xs shrink-0">{tCurrency('pkr')} {Number(inv.total_amount).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center mt-0.5 gap-2">
                                                    <span className="text-[10px] text-[var(--text-muted)]">
                                                        {formatLocaleDate(inv.due_date, locale, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${inv.status === 'OVERDUE' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {inv.status === 'OVERDUE' ? tStatus('overdue') : tStatus('pending')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="text-2xl sm:text-3xl font-black text-[var(--accent-success)] tracking-tight mb-2">
                            {t('youAreAllCaughtUp')}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1 font-bold uppercase tracking-wider opacity-70">
                            {t('noPendingActions')}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};

export const ValueDeliveredSection = ({ data, rosterChanges, hasChauffeur = true, hasShuttle = true }: { data: DashboardData['valueDelivered']; rosterChanges?: { added_count: number; removed_count: number; top_route: { route_id: number; route_name: string; added_count: number } | null } | null; hasChauffeur?: boolean; hasShuttle?: boolean }) => {
    const t = useTranslations('company.dashboard');
    const tCurrency = useTranslations('common.currency');
    const addedCount = rosterChanges?.added_count ?? 0;
    const removedCount = rosterChanges?.removed_count ?? 0;
    const topRoute = rosterChanges?.top_route ?? null;
    const metricsCount = 2 + (hasChauffeur ? 1 : 0) + (hasShuttle ? 1 : 0);
    const valueGridClass = metricsCount >= 4
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full'
        : metricsCount === 3
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 w-full';

    return (
        <div className={valueGridClass}>
            <div className="p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border shadow-[0_1px_4px_rgba(0,0,0,0.12)] flex flex-col justify-between hover:shadow-[0_2px_10px_rgba(0,0,0,0.18)] transition-all relative overflow-hidden group min-w-0 bg-[var(--bg-card)] border-[var(--border-default)]">
                <div className="pointer-events-none absolute inset-y-0 end-0 w-24 sm:w-32 flex items-center justify-center opacity-10 group-hover:opacity-15 transition-opacity">
                    <Users size={120} className="text-[var(--cort-orange)]" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                    <div className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wide">{t('peopleAddedToRoutes')}</div>
                </div>
                <div className="relative z-10">
                    <div className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-2 text-[var(--text-primary)]">
                        {addedCount}
                    </div>
                    {topRoute ? (
                        <div className="text-sm font-bold text-[var(--text-primary)] mt-1 leading-snug">
                            {t('topRouteAdded', { id: topRoute.route_id, name: topRoute.route_name, count: topRoute.added_count })}
                        </div>
                    ) : (
                        <div className="text-xs text-[var(--text-muted)] mt-1">{t('noPeopleAdded')}</div>
                    )}
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                        {t('peopleRemovedThisMonth', { count: removedCount })}
                    </div>
                </div>
            </div>

        {/* Avg Trip Cost */}
        <div className="bg-gradient-to-br from-white/[0.04] via-white/[0.03] to-white/[0.02] p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-[var(--border-default)] shadow-[0_1px_4px_rgba(0,0,0,0.12)] flex flex-col justify-between text-[var(--text-primary)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.18)] transition-all relative overflow-hidden group min-w-0">
            <div className="pointer-events-none absolute inset-y-0 end-0 w-24 sm:w-32 flex items-center justify-center opacity-10 group-hover:opacity-15 transition-opacity">
                <Activity size={120} className="text-[var(--text-primary)]" />
            </div>
            <div className="relative z-10">
                <div className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-wide">{t('avgTripCost')}</div>
            </div>
            <div className="relative z-10">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-[var(--text-primary)] tracking-tight mb-2 flex items-baseline flex-wrap gap-x-1">
                    <span className="text-lg sm:text-xl lg:text-2xl text-[var(--text-muted)] font-normal">{tCurrency('pkr')}</span>
                    {formatCurrency(data.avgTripCost)}
                </div>
                <div className="text-xs text-[var(--text-primary)] text-opacity-60 mt-1">{t('perCompletedRide')}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                    {t('totalSpendLifetime')}: {tCurrency('pkr')} {formatCurrency(data.avgTripTotalSpendLifetime)}
                </div>
            </div>
        </div>

        {hasChauffeur && <div className="bg-[var(--bg-card)] p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-[var(--border-default)] shadow-[0_1px_4px_rgba(0,0,0,0.12)] flex flex-col justify-between hover:shadow-[0_2px_10px_rgba(0,0,0,0.18)] transition-all relative overflow-hidden group min-w-0">
                <div className="pointer-events-none absolute inset-y-0 end-0 w-24 sm:w-32 flex items-center justify-center opacity-10 group-hover:opacity-15 transition-opacity">
                    <Car size={120} className="text-[#fe8503]" />
                </div>
                <div className="relative z-10 flex items-start justify-between">
                    <div className="text-text-muted text-xs font-bold uppercase tracking-wide">{t('activeChauffeurRides')}</div>
                    {data.activeRides > 0 ? (
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-success)] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent-success)]"></span>
                        </span>
                    ) : (
                        <span className="inline-flex rounded-full h-3 w-3 bg-[var(--border-light)]"></span>
                    )}
                </div>
                <div className="relative z-10 mt-2">
                    <div className="text-4xl sm:text-5xl font-black text-[var(--text-primary)] tracking-tight mb-2">{data.activeRides}</div>
                    <div className="text-xs text-[var(--accent-success)] font-bold mt-1">{t('inProgress')}</div>
                </div>
            </div>}

        {hasShuttle && <div className="bg-[var(--bg-card)] p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-[var(--border-default)] shadow-[0_1px_4px_rgba(0,0,0,0.12)] flex flex-col justify-between hover:shadow-[0_2px_10px_rgba(0,0,0,0.18)] transition-all relative overflow-hidden group min-w-0">
                <div className="pointer-events-none absolute inset-y-0 end-0 w-24 sm:w-32 flex items-center justify-center opacity-10 group-hover:opacity-15 transition-opacity">
                    <Bus size={120} className="text-[#fe8503]" />
                </div>
                <div className="relative z-10">
                    <div className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wide">{t('shuttleTrips')}</div>
                </div>
                <div className="relative z-10">
                    <div className="text-4xl sm:text-5xl font-black text-[var(--text-primary)] tracking-tight mb-2">{data.shuttleTrips}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">{t('totalRunsMtd')}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">{t('totalTripsLifetime')}: {data.shuttleTotalTripsLifetime}</div>
                </div>
            </div>}
        </div>
    );
};

export const OutstandingAmountRow = ({ amount, invoices = [] }: { amount: number; invoices?: any[] }) => {
    const t = useTranslations('company.dashboard');
    const tCurrency = useTranslations('common.currency');
    const tStatus = useTranslations('common.status');
    const { locale } = useCompanyLocale();

    return (
        <Card className="group relative overflow-visible z-20 hover:z-[200] p-5">
            <div className="pointer-events-none hidden sm:block absolute inset-0 overflow-hidden rounded-[2rem]">
                <div className="absolute inset-y-4 end-0 w-40 flex items-center justify-center opacity-10 transform rotate-12">
                    <Wallet size={120} className="text-[var(--text-muted)]" />
                </div>
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row justify-between h-full gap-8">
                <div className="flex flex-col justify-between">
                    <div>
                        <div className="text-[var(--text-primary)] text-xs sm:text-sm font-black uppercase tracking-widest opacity-80 mb-2">{t('outstandingBalance')}</div>
                        <div className="text-5xl sm:text-6xl lg:text-7xl font-black text-[var(--accent-danger)] tracking-tighter flex items-baseline flex-wrap gap-x-3">
                            <span className="text-2xl sm:text-3xl text-[var(--text-muted)] font-normal">{tCurrency('pkr')}</span>
                            {formatCurrency(amount)}
                        </div>
                    </div>

                    <div className="mt-4 lg:mt-6">
                        <div className="group/info invoice-tooltip-trigger text-xs text-[var(--text-secondary)] flex items-center gap-2 relative z-20 cursor-default font-medium">
                            <span className="opacity-80">{t('totalUnpaidInvoices')}</span>
                            <span className="w-2 h-2 rounded-full bg-[var(--accent-danger)] inline-block animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span>

                            {invoices.length > 0 && (
                                <div className="invisible group-hover/info:visible absolute top-full start-0 mt-3 w-64 bg-[var(--bg-card)] border border-[var(--border-input)] rounded-[2rem] shadow-2xl z-[300] overflow-hidden transform transition-all duration-200 opacity-0 group-hover/info:opacity-100 -translate-y-2 group-hover/info:translate-y-0 text-start font-normal">
                                    <div className="bg-[var(--bg-subtle)] px-4 py-2 border-b border-[var(--border-default)] text-[var(--text-primary)] font-bold text-[10px] uppercase">
                                        {t('recentOutstandingInvoices')}
                                    </div>
                                    <div className="divide-y divide-[var(--border-default)] max-h-48 overflow-y-auto">
                                        {invoices.map((inv, idx) => (
                                            <div key={idx} className="px-4 py-2 hover:bg-[var(--bg-subtle)] transition-colors">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-mono text-[10px] text-[var(--text-primary)] font-bold">{inv.invoice_number}</span>
                                                    <span className="text-[var(--accent-danger)] font-bold text-xs">{tCurrency('pkr')} {Number(inv.total_amount).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center mt-0.5">
                                                    <span className="text-[10px] text-[var(--text-muted)]">
                                                        {formatLocaleDate(inv.due_date, locale, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${inv.status === 'OVERDUE' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                                                        }`}>
                                                        {inv.status === 'OVERDUE' ? tStatus('overdue') : tStatus('pending')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {invoices.length >= 10 && (
                                        <div className="bg-[var(--bg-subtle)] px-4 py-1.5 text-[9px] text-[var(--text-muted)] text-center border-t border-[var(--border-default)]">
                                            {t('showingTop10')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="hidden lg:flex items-center gap-12 px-12 border-x border-[var(--border-light)] mx-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mb-1">{t('overdue')}</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-[var(--accent-danger)]">{invoices.filter(i => i.status === 'OVERDUE').length}</span>
                            <span className="text-xs text-[var(--text-muted)] font-bold">{t('invoicesLabel')}</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mb-1">{tStatus('pending')}</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-[var(--text-primary)]">{invoices.filter(i => i.status !== 'OVERDUE').length}</span>
                            <span className="text-xs text-[var(--text-muted)] font-bold">{t('invoicesLabel')}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col justify-between items-end">
                    <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider bg-[var(--bg-subtle)] px-3 py-1 rounded-full border border-[var(--border-strong)]">
                        {t('actionRequired')}
                    </div>
                    <div className="mt-8 text-end">
                        <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mb-1">{t('lastUpdate')}</div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">{t('todayAt', { time: formatLocaleTime(new Date(), locale, { hour: '2-digit', minute: '2-digit' }) })}</div>
                    </div>
                </div>
            </div>
        </Card>
    )
}


export const CostVisibilitySection = ({
    data,
    onEditBudget
}: {
    data: DashboardData['cost'];
    onEditBudget?: () => void;
}) => {
    const t = useTranslations('company.dashboard');
    const tCurrency = useTranslations('common.currency');
    const budget = data.budget || 1500000;
    const percentageUsed = Math.min((data.totalSpendMTD / budget) * 100, 100);

    return (
        <Card>
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <SectionTitle><CreditCard className="w-5 h-5 text-[var(--cort-orange)]" /> {t('costVisibility')}</SectionTitle>
                {onEditBudget && (
                    <button
                        onClick={onEditBudget}
                        className="text-xs flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--cort-orange)] font-bold transition-colors bg-[var(--surface-muted)] hover:bg-[#fef3c7] px-2 py-1 rounded-md shrink-0"
                    >
                        <Settings className="w-3 h-3" /> {t('editBudget')}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 h-full">
                <div className="flex flex-col gap-6 min-w-0">
                    <div>
                        <div className="flex justify-between items-end mb-1 gap-2">
                            <div className="text-[var(--text-muted)] text-sm font-medium">{t('totalSpendMtd')}</div>
                            <div className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${data.spendTrend.startsWith('-') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {data.spendTrend}
                            </div>
                        </div>

                    <div className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight mb-4 break-words">
                            <span className="text-lg sm:text-xl text-[var(--text-muted)] font-medium me-1">{tCurrency('pkr')}</span>
                            {(data.totalSpendMTD / 1000).toLocaleString()}k
                        </div>
                    </div>

                    {/* Bullet Graph / Progress Bar */}
                    <div className="relative pt-1">
                        <div className="flex mb-2 items-center justify-between">
                            <div className="text-xs text-[var(--text-muted)] font-semibold uppercase">{t('budgetUsage')}</div>
                        <div className="text-end font-bold text-[var(--text-primary)]">{percentageUsed.toFixed(0)}%</div>
                        </div>
                        <div className="overflow-hidden h-3 mb-2 text-xs flex rounded-full bg-[var(--border-light)] border border-[var(--border-dark)]">
                            <div style={{ width: `${percentageUsed}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-[var(--text-primary)] justify-center ${percentageUsed > 90 ? 'bg-[var(--accent-danger)]' : 'bg-[#fe8503]'}`}></div>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] flex justify-between uppercase font-medium">
                            <span>0</span>
                            <span>{(budget / 1000).toLocaleString()}k {t('goal')}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col h-full border-t md:border-t-0 md:border-s border-[var(--border-light)] md:ps-8 pt-6 md:pt-0 min-w-0">
                    <div className="flex flex-col">
                        <div className="flex justify-between items-end mb-1">
                            <div className="text-[var(--text-muted)] text-sm font-medium">{t('costPerTraveler')}</div>
                        </div>
                    <div className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight break-words">{tCurrency('pkr')} {data.costPerEmployee.toLocaleString()}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-2">{t('avgSpendEmployees', { type: data.costPerEmployee > 5000 ? t('activeEmployees') : t('allEmployees') })}</div>
                    </div>


                    <div className="mt-4 bg-[var(--bg-subtle)] rounded-[2rem] p-4 border border-[var(--border-default)]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#fe8503]/10 text-[#fe8503] rounded-lg">
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-[var(--text-muted)] uppercase">{t('projection')}</div>
                                <div className="text-sm font-semibold text-[var(--text-primary)]">{t('onTrackBudget')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    )
}

export const SmartInsightsSection = ({ insights, seasonality }: { insights: string[], seasonality: DashboardData['seasonality'] }) => {
    const t = useTranslations('company.dashboard');

    return (
        <Card className="bg-[var(--bg-card)] border border-[var(--border-default)]">

            <div className="space-y-4">
                {insights.map((insight, idx) => (
                    <div
                        key={idx}
                        className="group flex flex-col gap-1 pb-3 border-b border-[var(--border-light)] last:border-0 last:pb-0 cursor-pointer hover:bg-[var(--surface-muted)] p-2 -mx-2 rounded-lg transition-colors"
                        title={t('clickViewDetails')}
                    >
                        <div className="flex justify-between items-start gap-2">
                            <div className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
                                <span className="text-[#fe8503] font-bold me-2">•</span>
                                {insight}
                            </div>
                        </div>
                        {/* Small Sparkline for demand trends */}
                        <div className="self-end mt-1">
                            <Sparkline color="var(--cort-orange)" data={[30 + Math.random() * 20, 40 + Math.random() * 20, 35, 50, 45, 60, 55]} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--border-light)] grid grid-cols-2 gap-3 sm:gap-4">
                <div className="min-w-0">
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-bold">{t('peakDay')}</div>
                    <div className="text-white font-bold text-base sm:text-lg truncate">{seasonality.highDemandDay}</div>
                </div>
                <div className="min-w-0">
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-bold">{t('quietDay')}</div>
                    <div className="text-white font-bold text-base sm:text-lg truncate">{seasonality.lowDemandDay}</div>
                </div>
            </div>
        </Card>
    )
}

export const EmployeeUsageSection = ({ data }: { data: DashboardData['employeeUsage'] }) => {
    const t = useTranslations('company.dashboard');

    return (
        <Card className="bg-[var(--bg-card)] border border-[var(--border-default)]">
            <SectionTitle><Users className="w-5 h-5 text-[#fe8503]" /> {t('employeeAdoption')}</SectionTitle>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
                <div className="flex-1 min-w-[100px]">
                    <div className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{data.activeEmployees}</div>
                    <div className="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase font-bold">{t('activePassengers')}</div>
                </div>
                <div className="hidden sm:block w-px h-10 bg-[var(--bg-subtle)]"></div>
                <div className="flex-1 min-w-[100px]">
                    <div className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{data.avgRidesPerEmployee}</div>
                    <div className="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase font-bold">{t('avgRidesEmp')}</div>
                </div>
            </div>

            <div className="bg-[var(--bg-subtle)] p-3 sm:p-4 rounded-2xl mb-6 border border-[var(--border-strong)] flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#fe8503]/20 rounded-full flex items-center justify-center text-[#fe8503] shrink-0">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-[#fe8503]" />
                </div>
                <div className="min-w-0">
                    <div className="text-[11px] text-[var(--text-muted)] font-bold uppercase">{t('topPassenger')}</div>
                    <div className="font-bold text-[var(--text-primary)] text-sm truncate">
                        {data.topPassenger.name}{' '}
                        <span className="font-normal text-[var(--text-muted)]">({t('ridesCount', { count: data.topPassenger.rides })})</span>
                    </div>
                </div>
            </div>

            {/* Department Breakdown: list with bar per department (better for long names) */}
            <div>
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-3">{t('departmentBreakdown')}</div>
                <div className="space-y-2.5">
                    {data.departmentUsage.map((dept, i) => {
                        const colors = ['bg-[#fe8503]', 'bg-white/40', 'bg-[var(--accent-success)]', 'bg-white/20'];
                        const color = colors[i % colors.length];
                        return (
                            <div key={i} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-[var(--text-muted)] truncate" title={dept.name}>{dept.name}</span>
                                    <span className="text-xs font-bold text-[var(--text-primary)] shrink-0">{dept.percentage}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-[var(--border-light)] overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${color}`}
                                        style={{ width: `${dept.percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    )
}

export const AdoptionHealthSection = ({ data }: { data: DashboardData['adminHealth'] }) => {
    const t = useTranslations('company.dashboard');
    const tStatus = useTranslations('common.status');

    return (
        <Card className="h-full bg-[var(--bg-card)] border border-[var(--border-default)]">
            <SectionTitle><ShieldCheck className="w-5 h-5 text-[var(--accent-success)]" /> {t('systemHealth')}</SectionTitle>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-[var(--text-muted)] font-medium">{t('activeUsers')}</div>
                    <div className="text-sm font-bold text-[var(--accent-success)]">{(data.registeredVsActiveRatio * 100).toFixed(0)}%</div>
                </div>
                <div className="w-full bg-[var(--border-light)] h-2 rounded-full overflow-hidden">
                    <div className="bg-[var(--accent-success)] h-full rounded-full" style={{ width: `${data.registeredVsActiveRatio * 100}%` }} />
                </div>

                <div className="flex items-center justify-between mt-2">
                    <div className="text-sm text-[var(--text-muted)] font-medium">{t('deptAdoption')}</div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">{data.deptAdoptionRate}%</div>
                </div>
                <div className="w-full bg-[var(--border-light)] h-2 rounded-full overflow-hidden">
                    <div className="bg-[var(--cort-orange)] h-full rounded-full" style={{ width: `${data.deptAdoptionRate}%` }} />
                </div>

                <div className="flex justify-between text-xs text-[var(--text-muted)] pt-2">
                    <span>{t('healthCheckedToday')}</span>
                    <span className="text-[var(--accent-success)] font-bold">{tStatus('good')}</span>
                </div>
            </div>
        </Card>
    )
}

export const ServiceUsageSection = ({ data, hasChauffeur = true, hasShuttle = true }: { data: DashboardData['services']; hasChauffeur?: boolean; hasShuttle?: boolean }) => {
    const t = useTranslations('company.dashboard');
    const allItems = [
        { label: t('chauffeur'), value: data.chauffeur, color: '#fe8503', dot: 'bg-[#fe8503]', show: hasChauffeur },
        { label: t('shuttle'), value: data.shuttles, color: 'rgba(255,255,255,0.5)', dot: 'bg-white/50', show: hasShuttle },
        { label: t('eventShuttle'), value: data.eventShuttle, color: 'rgba(255,255,255,0.15)', dot: 'bg-white/15', show: hasShuttle },
    ];

    const visibleItems = allItems.filter((i) => i.show);
    const chartData = visibleItems.map(({ label, value, color }) => ({ label, value, color }));

    return (
        <Card>
            <SectionTitle><Car className="w-5 h-5 text-[#f47f00]" /> {t('serviceSplit')}</SectionTitle>

            <div className="flex flex-col items-center justify-center h-full py-2">
                <DonutChart data={chartData} />

                <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-6 w-full">
                    {visibleItems.map((item) => (
                        <div key={item.label} className="flex flex-col items-center min-w-[4.5rem]">
                            <div className={`w-3 h-3 rounded-full ${item.dot} mb-1`}></div>
                            <div className="text-base sm:text-lg font-bold text-[var(--text-primary)]">{item.value}%</div>
                            <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold text-center">{item.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    )
}

export const PremiumTeaser = () => {
    const t = useTranslations('company.dashboard');

    return (
        <div className="mt-6 sm:mt-8 flex justify-center px-2">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-[#fe8503]/10 border border-[#fe8503]/20 text-[#fe8503]/80 text-[10px] sm:text-xs font-medium cursor-not-allowed hover:opacity-100 transition-all opacity-90 text-center max-w-full">
                <Star className="w-3 h-3 fill-[#fe8503] shrink-0" />
                <span className="leading-snug">{t('premiumTeaser')}</span>
            </div>
        </div>
    )
}
