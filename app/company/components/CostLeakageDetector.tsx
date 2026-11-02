'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    Zap,
    Bus,
    Navigation,
    Fuel,
    Clock,
    Crown,
    ArrowRight,
    Lock,
    Car,
    Package,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type SavingsInsight = {
    id: number;
    insight_type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    estimated_saving_pkr: number;
    label: string;
    is_preview: boolean;
    data: { summary: string; recommendation: string; metric_value?: number };
    generated_at: string | null;
};

interface CostLeakageDetectorProps {
    data: {
        aiInsightsEnabled: boolean;
        totalPotentialSavingPkr: number;
        insights: SavingsInsight[];
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function insightIcon(type: string) {
    if (type === 'FUEL_LEAKAGE') return <Fuel className="w-7 h-7" />;
    if (type === 'OCCUPANCY') return <Bus className="w-7 h-7" />;
    if (type === 'ROUTE_DETOUR' || type === 'CHAUFFEUR_DETOUR') return <Navigation className="w-7 h-7" />;
    if (type === 'IDLE_TIME') return <Clock className="w-7 h-7" />;
    if (type === 'CHAUFFEUR_CONCURRENT') return <Car className="w-7 h-7" />;
    if (type === 'CHAUFFEUR_PACKAGE_UNDERUTILIZATION') return <Package className="w-7 h-7" />;
    if (type === 'POOL_UTILIZATION') return <Car className="w-7 h-7" />;
    return <Zap className="w-7 h-7" />;
}

function insightColors(type: string, severity: string, index: number) {
    if (severity === 'CRITICAL' || severity === 'HIGH') {
        return { card: 'bg-[var(--cort-navy)] text-white', badge: 'bg-[var(--accent-danger)] text-white' };
    }
    if (type === 'FUEL_LEAKAGE' || index % 2 === 0) {
        return { card: 'bg-[linear-gradient(135deg,#f58c4a_0%,#f06a22_50%,#e2551b_100%)] text-white', badge: 'bg-white/20 text-white' };
    }
    return { card: 'bg-[var(--cort-navy)] text-white', badge: 'bg-white/20 text-white' };
}

// ── Component ─────────────────────────────────────────────────────────────────

const CostLeakageDetector = ({ data }: CostLeakageDetectorProps) => {
    const t = useTranslations('company.costLeakage');
    const [expanded, setExpanded] = useState<number | null>(null);

    const insights = data?.insights ?? [];
    const aiEnabled = data?.aiInsightsEnabled ?? false;
    const hasCards = insights.length > 0;
    const totalSaving = data?.totalPotentialSavingPkr ?? 0;

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <div className="flex items-start gap-4">
                    <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--cort-orange)] shadow-[var(--shadow-card)]">
                        <Zap size={20} strokeWidth={1.8} />
                    </div>
                    <div className="flex min-w-0 flex-col">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <h2 className="text-2xl font-medium text-[var(--text-primary)]">{t('powerInsights')}</h2>
                            {!aiEnabled && hasCards && (
                                <span className="flex items-center gap-1 bg-[var(--cort-navy)] text-white text-xs px-2.5 py-1 rounded-full shrink-0">
                                    <Crown size={10} className="fill-current" />
                                    {t('preview')}
                                </span>
                            )}
                        </div>
                        <p className="text-[var(--text-muted)] text-sm mt-1">
                            {aiEnabled ? t('aiFleetInsights') : t('costLeakageAnalysis')}
                        </p>
                        {hasCards && totalSaving > 0 && (
                            <p className="text-[var(--text-primary)] text-sm mt-2">
                                {t('couldSaveUpTo')}{' '}
                                <span className="text-[var(--cort-orange)]">Rs {Math.round(totalSaving).toLocaleString()}</span>
                                {t('perMonth')}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Cards */}
            {hasCards ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {insights.map((insight, index) => {
                        const { card, badge } = insightColors(insight.insight_type, insight.severity, index);
                        const isOpen = expanded === insight.id;

                        return (
                            <div
                                key={insight.id}
                                className={`${card} rounded-[var(--radius-card)] p-6 sm:p-7 shadow-[var(--shadow-card)] flex flex-col justify-between relative overflow-hidden min-w-0`}
                            >
                                {/* Category — always visible */}
                                <div className="flex justify-between items-start mb-4 gap-2">
                                    <div className="inline-flex size-12 items-center justify-center rounded-full bg-white/20 shrink-0 [&_svg]:size-5">
                                        {insightIcon(insight.insight_type)}
                                    </div>
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${badge}`}>
                                        {insight.severity}
                                    </span>
                                </div>
                                <h3 className="text-xl font-medium mb-3">{insight.label}</h3>

                                {/* How to save — blurred when feature disabled */}
                                <div className="relative">
                                    {!aiEnabled && (
                                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/10 backdrop-blur-[2px] rounded-2xl min-h-[72px] p-2">
                                            <div className="bg-white px-4 py-2.5 rounded-full shadow-[var(--shadow-card)] flex items-center gap-2 sm:gap-2.5 max-w-full">
                                                <Lock size={14} className="text-[#1c1b4d] shrink-0" />
                                                <span className="text-[11px] sm:text-xs font-medium text-[#1c1b4d] leading-tight text-center">
                                                    {t('enableCostSaving')}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    <div className={!aiEnabled ? 'filter blur-[3px] opacity-60 pointer-events-none select-none' : ''}>
                                        <p className="text-sm opacity-80 leading-relaxed">
                                            {aiEnabled ? insight.data.summary : t('lockedSummary')}
                                        </p>
                                        {aiEnabled && isOpen && insight.data.recommendation && (
                                            <p className="text-xs opacity-70 leading-relaxed mt-3 border-t border-white/20 pt-3">
                                                {insight.data.recommendation}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom row — savings always visible */}
                                <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-white/20 flex flex-wrap items-end justify-between gap-3 relative z-10">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm opacity-75 mb-1">
                                            {aiEnabled ? t('estMonthlySaving') : t('potentialMonthlySavings')}
                                        </span>
                                        <div className="text-3xl sm:text-4xl font-medium tabular-nums flex items-baseline flex-wrap">
                                            <span className="text-lg sm:text-xl font-normal opacity-60 me-1.5">Rs</span>
                                            {insight.estimated_saving_pkr > 0
                                                ? Math.round(insight.estimated_saving_pkr).toLocaleString()
                                                : '—'}
                                        </div>
                                    </div>
                                    {aiEnabled && insight.data.recommendation && (
                                        <button
                                            type="button"
                                            onClick={() => setExpanded(isOpen ? null : insight.id)}
                                            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-[#1c1b4d] transition-colors hover:bg-white/90 shrink-0"
                                        >
                                            {isOpen ? t('less') : t('details')}
                                            <ArrowRight size={14} className={`rtl-flip transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8 px-4 rounded-[var(--radius-card)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
                    <p className="text-sm text-[var(--text-muted)]">
                        {t('notEnoughData')}
                        <br />
                        <span className="text-xs opacity-70">{t('insightsAppearHint')}</span>
                    </p>
                </div>
            )}

            {/* Footer CTA when feature disabled */}
            {!aiEnabled && hasCards && (
                <div className="flex flex-col gap-2 px-1">
                    <p className="text-xs text-[var(--text-muted)] max-w-md">
                        {t('footerHint')}
                    </p>
                </div>
            )}
        </div>
    );
};

export default CostLeakageDetector;
