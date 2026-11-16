'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { apiClient } from '@/app/lib/services/api-client';
import { getCalendarMonthRange } from '@/app/lib/date-utils';
import { formatLocaleNumber } from '@/app/lib/i18n/format';
import type { Locale } from '@/i18n/config';
import { CompanyBenchmarksModal } from '../components/CompanyBenchmarksModal';
import {
  TrendingDown,
  Sparkles,
  Car,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  PiggyBank,
  Clock,
  Settings2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type VehicleBreakdownStatus = 'OK' | 'ANALYSIS_IN_PROGRESS' | 'ANALYSIS_PENDING' | 'NO_FUEL_DATA';

interface VehicleBreakdownRow {
  vehicle_category: string;
  service_type: string;
  cost_type: 'FIXED' | 'VARIABLE';
  quantity: number;
  vendor_name: string | null;
  fuel_mode: 'LITRES' | 'AVERAGE' | null;
  status: VehicleBreakdownStatus;
  monthly_rental_pkr?: number;
  previous_lump_sum_pkr?: number;
  calculated_actual_pkr?: number;
  benchmark_litres_per_vehicle?: number;
  calculated_litres_per_vehicle?: number;
  fuel_saving_pkr?: number;
}

interface SavingsResult {
  period: { from: string; to: string; days: number };
  analysed_days: number;
  analysis_ready: boolean;
  fuel_price_pkr: number | null;
  total_fuel_saving_pkr: number;
  vehicle_breakdown: VehicleBreakdownRow[];
  narrative: string;
  has_benchmarks: boolean;
}

const ANALYSIS_MIN_DAYS = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_KEYS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
] as const;

function formatVehicleLabel(category: string): string {
  return category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: 'green' | 'red' | 'neutral';
}) {
  const valueColor =
    accent === 'green'
      ? 'text-[var(--accent-success)]'
      : accent === 'red'
      ? 'text-[var(--accent-danger)]'
      : 'text-[var(--text-primary)]';

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[1.5rem] p-5 flex flex-col gap-2 shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className={`text-2xl sm:text-3xl font-black tracking-tight ${valueColor}`}>{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{sub}</p>
    </div>
  );
}

function StatusBadge({ status, t }: { status: VehicleBreakdownStatus; t: (k: string) => string }) {
  if (status === 'OK') return null;
  const label =
    status === 'ANALYSIS_IN_PROGRESS'
      ? t('statusAnalysisInProgress')
      : status === 'ANALYSIS_PENDING'
      ? t('statusAnalysisPending')
      : t('statusNoFuelData');
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent-warning)]/10 text-[var(--accent-warning)]">
      <Clock className="h-3 w-3" /> {label}
    </span>
  );
}

function VehicleTable({
  rows,
  formatPkr,
}: {
  rows: VehicleBreakdownRow[];
  formatPkr: (n: number) => string;
}) {
  const t = useTranslations('company.savings');

  if (rows.length === 0) return null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[1.5rem] overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
      <div className="px-6 pt-5 pb-3 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-[var(--cort-orange)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
            {t('perVehicleBreakdown')}
          </h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {t('perVehicleDescription')}
        </p>
      </div>

      <div className="divide-y divide-[var(--border-default)]">
        {rows.map((row, i) => {
          const savedPkr = row.fuel_saving_pkr ?? 0;
          const isSaving = savedPkr >= 0;
          return (
            <div key={i} className="p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[var(--cort-orange)]/10 flex items-center justify-center flex-shrink-0">
                    <Car className="h-4 w-4 text-[var(--cort-orange)]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">
                      {formatVehicleLabel(row.vehicle_category)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {row.service_type} · ×{row.quantity}
                      {row.vendor_name ? ` · ${t('previousVendorColon', { name: row.vendor_name })}` : ''}
                    </p>
                  </div>
                </div>
                <StatusBadge status={row.status} t={t} />
                {row.status === 'OK' && (
                  <span
                    className={`inline-flex items-center gap-1 font-bold text-sm ${
                      isSaving ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'
                    }`}
                  >
                    <TrendingDown className="h-3.5 w-3.5" />
                    {isSaving ? '−' : '+'}
                    {formatPkr(Math.abs(savedPkr))}
                  </span>
                )}
              </div>

              {row.status === 'OK' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {row.cost_type === 'FIXED' ? (
                    <>
                      <div className="bg-[var(--surface-subtle)] rounded-xl px-3 py-2">
                        <p className="text-[var(--text-muted)]">{t('previousLumpSum')}</p>
                        <p className="font-semibold text-[var(--text-primary)]">{formatPkr(row.previous_lump_sum_pkr ?? 0)}</p>
                      </div>
                      <div className="bg-[var(--surface-subtle)] rounded-xl px-3 py-2">
                        <p className="text-[var(--text-muted)]">{t('calculatedActual')}</p>
                        <p className="font-semibold text-[var(--text-primary)]">{formatPkr(row.calculated_actual_pkr ?? 0)}</p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-[var(--surface-subtle)] rounded-xl px-3 py-2">
                      <p className="text-[var(--text-muted)]">{t('monthlyRental')}</p>
                      <p className="font-semibold text-[var(--text-primary)]">{formatPkr(row.monthly_rental_pkr ?? 0)}</p>
                    </div>
                  )}
                  <div className="bg-[var(--surface-subtle)] rounded-xl px-3 py-2">
                    <p className="text-[var(--text-muted)]">{t('claimedLitres')}</p>
                    <p className="font-semibold text-[var(--text-primary)]">{row.benchmark_litres_per_vehicle?.toFixed(1)} L</p>
                  </div>
                  <div className="bg-[var(--surface-subtle)] rounded-xl px-3 py-2">
                    <p className="text-[var(--text-muted)]">{t('calculatedLitres')}</p>
                    <p className="font-semibold text-[var(--text-primary)]">{row.calculated_litres_per_vehicle?.toFixed(1)} L</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SavingsPage() {
  const t = useTranslations('company.savings');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;

  const formatPkr = useCallback(
    (n: number) => `${tCommon('currency.pkr')} ${formatLocaleNumber(Math.abs(n), locale)}`,
    [tCommon, locale],
  );

  const getMonthName = useCallback(
    (monthIndex: number) => t(`months.${MONTH_KEYS[monthIndex]}`),
    [t],
  );

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [result, setResult] = useState<SavingsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBenchmarksModalOpen, setIsBenchmarksModalOpen] = useState(false);

  const fetchSavings = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setResult(null);
    try {
      const { from, to } = getCalendarMonthRange(year, month);
      const data = await apiClient.request<SavingsResult>(
        `/company/savings-realisation?from=${from}&to=${to}`,
      );
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavings(selectedYear, selectedMonth);
  }, [fetchSavings, selectedYear, selectedMonth]);

  function prevMonth() {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    const isCurrentMonth =
      selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
    if (isCurrentMonth) return;
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const selectedMonthName = getMonthName(selectedMonth);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 pb-12 max-w-[1400px] mx-auto">

      {/* Header */}
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
  <div>
    <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
      {t('title')}
    </h1>
    <p className="text-sm text-[var(--text-muted)] mt-1">
      {t('description')}
    </p>
  </div>

  <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
    <button
      type="button"
      onClick={() => setIsBenchmarksModalOpen(true)}
      className="flex items-center gap-2 text-sm font-bold text-white bg-[var(--cort-orange)] hover:bg-[var(--cort-orange-hover)] rounded-2xl px-3 sm:px-4 py-2.5 shadow-sm transition-colors whitespace-nowrap"
    >
      <Settings2 className="h-4 w-4 flex-shrink-0" />
      <span className="hidden sm:inline">{t('manageVendorCost')}</span>
    </button>

    {/* Period picker */}
    <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl px-3 sm:px-4 py-2.5 shadow-sm whitespace-nowrap">
      <button
        onClick={prevMonth}
        className="p-1 rounded-lg hover:bg-[var(--surface-subtle)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-bold text-[var(--text-primary)] min-w-[100px] sm:min-w-[130px] text-center">
        {selectedMonthName} {selectedYear}
      </span>
      <button
        onClick={nextMonth}
        disabled={isCurrentMonth}
        className="p-1 rounded-lg hover:bg-[var(--surface-subtle)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  </div>
</div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[1.5rem] p-5 h-28 animate-pulse"
              />
            ))}
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[1.5rem] h-64 animate-pulse" />
        </div>
      )}

      {/* No benchmarks configured */}
      {!loading && result && !result.has_benchmarks && (
        <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center">
            <PiggyBank className="h-8 w-8 text-[var(--text-muted)]" />
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--text-primary)]">{t('noBenchmarks')}</p>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-md">
              {t('noBenchmarksDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsBenchmarksModalOpen(true)}
            className="flex items-center gap-2 text-sm font-bold text-white bg-[var(--cort-orange)] hover:bg-[var(--cort-orange-hover)] rounded-2xl px-5 py-2.5 transition-colors"
          >
            <Settings2 className="h-4 w-4" />
            {t('manageVendorCost')}
          </button>
        </div>
      )}

      {/* Error / no data */}
      {!loading && !result && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/20 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-[var(--accent-danger)]" />
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--text-primary)]">{tCommon('errors.couldNotLoadSavings')}</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">{tCommon('errors.tryAgainOrContact')}</p>
          </div>
        </div>
      )}

      {/* Main content */}
      {!loading && result && result.has_benchmarks && (
        <>
          {!result.analysis_ready && (
            <p className="text-xs alert-banner-warning -mt-2">
              {t('analysisInProgressBanner', { month: selectedMonthName, year: selectedYear })}
            </p>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <SummaryCard
              label={t('totalFuelSaving')}
              value={(result.total_fuel_saving_pkr >= 0 ? '−' : '+') + formatPkr(Math.abs(result.total_fuel_saving_pkr))}
              sub={t('fuelSavingThisMonth')}
              accent={result.total_fuel_saving_pkr >= 0 ? 'green' : 'red'}
            />
            <SummaryCard
              label={t('fuelPriceUsed')}
              value={result.fuel_price_pkr != null ? formatPkr(result.fuel_price_pkr) : '—'}
              sub={t('perLitre')}
              accent="neutral"
            />
            <SummaryCard
              label={t('analysisProgress')}
              value={result.analysis_ready ? t('analysisFinal') : `${result.analysed_days}/${ANALYSIS_MIN_DAYS}`}
              sub={t('daysAnalysed', { days: result.analysed_days, required: ANALYSIS_MIN_DAYS })}
              accent="neutral"
            />
          </div>

          {/* Per-vehicle table */}
          {result.vehicle_breakdown.length > 0 ? (
            <VehicleTable rows={result.vehicle_breakdown} formatPkr={formatPkr} />
          ) : (
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[1.5rem] p-6 text-sm text-[var(--text-muted)]">
              {t('noVehicleBenchmarks')}
            </div>
          )}

          {/* AI Narrative */}
          {result.narrative && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[1.5rem] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-[var(--accent-success)]/10 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--accent-success)]" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--accent-success)]">
                  {t('aiAnalysis')}
                </span>
              </div>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{result.narrative}</p>
            </div>
          )}
        </>
      )}

      <CompanyBenchmarksModal
        isOpen={isBenchmarksModalOpen}
        onClose={() => setIsBenchmarksModalOpen(false)}
        onChanged={() => fetchSavings(selectedYear, selectedMonth)}
      />
    </div>
  );
}
