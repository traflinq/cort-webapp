'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/app/lib/services/api-client';
import { TrendingDown, TrendingUp, Sparkles, Clock } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

const ANALYSIS_MIN_DAYS = 20;

type SavingsResult = {
  period: { from: string; to: string; days: number };
  analysed_days: number;
  analysis_ready: boolean;
  fuel_price_pkr: number | null;
  total_fuel_saving_pkr: number;
  has_benchmarks: boolean;
  narrative: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pkr(n: number) {
  return `PKR ${Math.abs(n).toLocaleString('en-PK')}`;
}

function defaultPeriod(): { from: string; to: string } {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: firstOfMonth.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SavingsCard() {
  const [result, setResult] = useState<SavingsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [period] = useState(defaultPeriod);

  const fetchSavings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.request<SavingsResult>(
        `/company/savings-realisation?from=${period.from}&to=${period.to}`,
      );
      setResult(data);
    } catch {
      // If the endpoint fails or returns no data, silently suppress — card stays hidden
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchSavings();
  }, [fetchSavings]);

  // Don't render anything until we know there are benchmarks
  if (loading || !result || !result.has_benchmarks) {
    return null;
  }

  const isSaving = result.total_fuel_saving_pkr >= 0;

  return (
    <div
      className={`relative rounded-[1.5rem] overflow-hidden border p-6 shadow-sm transition-all ${
        isSaving
          ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200'
          : 'bg-gradient-to-br from-red-50 to-white border-red-200'
      }`}
    >
      {/* Decorative background blob */}
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full opacity-10 ${
          isSaving ? 'bg-emerald-400' : 'bg-red-400'
        }`}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className={`rounded-xl p-2 ${isSaving ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {isSaving ? (
              <TrendingDown className="h-5 w-5 text-emerald-600" />
            ) : (
              <TrendingUp className="h-5 w-5 text-red-600" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-[#0c225e]">Fuel Cost Savings</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {result.period.from} → {result.period.to}
            </p>
          </div>
        </div>
        {!result.analysis_ready && (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
            <Clock className="h-3 w-3" /> {result.analysed_days}/{ANALYSIS_MIN_DAYS} days
          </span>
        )}
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl bg-white/80 border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400 mb-1">Fuel price used</p>
          <p className="text-sm font-bold text-gray-700">
            {result.fuel_price_pkr != null ? pkr(result.fuel_price_pkr) : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">per litre</p>
        </div>
        <div
          className={`rounded-xl px-4 py-3 border ${
            isSaving ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}
        >
          <p className={`text-xs mb-1 ${isSaving ? 'text-emerald-600' : 'text-red-600'}`}>
            {isSaving ? 'Fuel saved' : 'Fuel overspend'}
          </p>
          <p className={`text-sm font-extrabold ${isSaving ? 'text-emerald-700' : 'text-red-700'}`}>
            {isSaving ? '−' : '+'}{pkr(result.total_fuel_saving_pkr)}
          </p>
          <p className={`text-xs mt-0.5 ${isSaving ? 'text-emerald-500' : 'text-red-500'}`}>
            vs claimed baseline
          </p>
        </div>
      </div>

      {/* AI Narrative */}
      {result.narrative && (
        <div className="rounded-xl bg-white/70 border border-gray-100 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
              AI Analysis
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{result.narrative}</p>
        </div>
      )}
    </div>
  );
}
