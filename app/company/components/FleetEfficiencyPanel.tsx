'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { apiClient } from '@/app/lib/services/api-client';
import { useAppSelector } from '@/app/lib/store/hooks';
import { selectCompany } from '@/app/lib/store/slices/companySlice';
import { AlertTriangle, Fuel, Bus, Navigation, TrendingDown, TrendingUp, Zap, RefreshCw, Map as MapIcon, X, Clock, Users, Package, CarFront, Lock, Car } from 'lucide-react';
import type { MapMarker, MapPolyline } from '@/app/admin/ui/Map';

const Map = dynamic(() => import('@/app/admin/ui/Map'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

type ShuttleMetricsSummary = {
  count: number;
  avgOccupancy: number;
  avgDetour: number;
  totalIdleMin: number;
};

type ShuttleMetric = {
  id: number;
  shuttle_trip_id: number;
  route_id: number | null;
  vehicle_id: number | null;
  trip_date: string;
  direction: string;
  occupancy_pct: string | null;
  detour_ratio: string | null;
  idle_minutes: string | null;
  fuel_variance_pct: string | null;
  actual_distance_km: string | null;
  planned_distance_km: string | null;
  vehicles: { plate_number: string; make: string | null; model: string | null } | null;
  shuttle_trips: { users: { full_name: string } | null } | null;
};

type RouteComparison = {
  id: number;
  planned_points: { lat: number; lng: number }[];
  actual_points: { lat: number; lng: number }[];
  total_distance_km: number | null;
  idle_minutes: number | null;
  metrics: {
    planned_distance_km: number | null;
    actual_distance_km: number | null;
    detour_ratio: number | null;
    occupancy_pct: number | null;
    fuel_variance_pct: number | null;
  } | null;
};

type FuelFlag = {
  id: number;
  vehicle_id: number;
  flag_date: string;
  variance_pct: string;
  actual_litres: string;
  expected_litres: string;
  consecutive_days: number;
  is_flagged: boolean;
  vehicles: { plate_number: string; fuel_avg_city: string } | null;
};

type FleetInsight = {
  id: number;
  insight_type: string;
  vehicle_id: number | null;
  route_id: number | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimated_saving_pkr: string;
  data: {
    summary: string;
    recommendation: string;
    metric_value?: number;
  };
  generated_at: string;
};

type ChauffeurUtilizationRow = {
  booking_id: number;
  package_selected: string;
  package_hours: number | null;
  used_minutes: number | null;
  utilization_pct: number | null;
  scheduled_for: string | null;
  trip_type: string;
  base_package_cost: number | null;
  estimated_saving_pkr: number | null;
};

type ChauffeurUtilizationSummary = {
  total_bookings: number;
  avg_utilization_pct: number | null;
  underutilized_count: number;
  total_estimated_saving_pkr: number;
};

type PoolVehicleRow = {
  vehicle_id: number;
  plate_number: string;
  make: string | null;
  model: string | null;
  category: string | null;
  trips_count: number;
  total_hours_booked: number;
  utilization_pct: number;
};

type PoolUtilizationSummary = {
  total_pool_vehicles: number;
  avg_utilization_pct: number;
  idle_vehicle_count: number;
  underutilized_count: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SHUTTLE_INSIGHT_TYPES = new Set(['FUEL_LEAKAGE', 'OCCUPANCY', 'ROUTE_DETOUR', 'IDLE_TIME']);
const CHAUFFEUR_INSIGHT_TYPES = new Set(['CHAUFFEUR_DETOUR', 'CHAUFFEUR_PACKAGE_UNDERUTILIZATION', 'CHAUFFEUR_CONCURRENT']);
const POOL_INSIGHT_TYPES = new Set(['POOL_UTILIZATION']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: string | null | undefined, decimals = 1) {
  if (v == null) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toFixed(decimals);
}

function pct(v: string | null | undefined) {
  return v == null ? '—' : `${fmt(v, 1)}%`;
}

function severityColor(s: string) {
  if (s === 'CRITICAL') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  if (s === 'HIGH') return 'bg-[var(--cort-orange)]/10 text-[var(--cort-orange)] border-[var(--cort-orange)]/20';
  if (s === 'MEDIUM') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
}

function insightIcon(type: string) {
  if (type === 'FUEL_LEAKAGE') return <Fuel className="h-5 w-5 text-orange-500" />;
  if (type === 'OCCUPANCY') return <Bus className="h-5 w-5 text-blue-500" />;
  if (type === 'CHAUFFEUR_DETOUR' || type === 'ROUTE_DETOUR') return <Navigation className="h-5 w-5 text-purple-500" />;
  if (type === 'IDLE_TIME') return <Zap className="h-5 w-5 text-yellow-500" />;
  if (type === 'CHAUFFEUR_PACKAGE_UNDERUTILIZATION') return <Package className="h-5 w-5 text-teal-400" />;
  if (type === 'CHAUFFEUR_CONCURRENT') return <Users className="h-5 w-5 text-indigo-400" />;
  if (type === 'POOL_UTILIZATION') return <Car className="h-5 w-5 text-violet-400" />;
  return <AlertTriangle className="h-5 w-5 text-[var(--text-muted)]" />;
}

function InsightCard({ insight }: { insight: FleetInsight }) {
  const t = useTranslations('company.fleetAnalytics');
  return (
    <div className={`rounded-xl border p-4 ${severityColor(insight.severity)}`}>
      <div className="flex items-start gap-3">
        {insightIcon(insight.insight_type)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide">
              {insight.insight_type.replace(/_/g, ' ')}
            </span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/10">
              {insight.severity}
            </span>
          </div>
          <p className="text-sm font-medium">{insight.data.summary}</p>
          <p className="text-xs mt-1 opacity-80">{insight.data.recommendation}</p>
          {insight.estimated_saving_pkr && parseFloat(insight.estimated_saving_pkr) > 0 && (
            <p className="text-xs mt-2 font-semibold">
              {t('estSavingMonth', { amount: parseFloat(insight.estimated_saving_pkr).toLocaleString() })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DisabledSection({ label }: { label: string }) {
  const t = useTranslations('company.fleetAnalytics');
  return (
    <div className="rounded-[2rem] border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)]/30 px-6 py-10 text-center">
      <Lock className="h-6 w-6 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
      <p className="text-sm font-bold text-[var(--text-muted)]">{label}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">{t('contactAdminEnable')}</p>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FleetEfficiencyPanel() {
  const t = useTranslations('company.fleetAnalytics');
  const company = useAppSelector(selectCompany);
  const companyId = Number(company?.id);

  // Feature flags
  const [shuttleEnabled, setShuttleEnabled] = useState(false);
  const [chauffeurEnabled, setChauffeurEnabled] = useState(false);
  const [poolEnabled, setPoolEnabled] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  // Shuttle state
  const [summary, setSummary] = useState<ShuttleMetricsSummary | null>(null);
  const [recentMetrics, setRecentMetrics] = useState<ShuttleMetric[]>([]);
  const [fuelFlags, setFuelFlags] = useState<FuelFlag[]>([]);

  // Chauffeur state
  const [chauffeurUtil, setChauffeurUtil] = useState<{ summary: ChauffeurUtilizationSummary; bookings: ChauffeurUtilizationRow[] } | null>(null);

  // Pool state
  const [poolUtil, setPoolUtil] = useState<{ summary: PoolUtilizationSummary; vehicles: PoolVehicleRow[] } | null>(null);

  // Shared
  const [insights, setInsights] = useState<FleetInsight[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Map state
  const [selectedTripForMap, setSelectedTripForMap] = useState<number | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [routeComparison, setRouteComparison] = useState<RouteComparison | null>(null);
  const [mapLoading, setMapLoading] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // 1. Read service flags from Redux + AI feature from API
      const isShuttle = company?.services_enabled?.shuttle_enabled ?? false;
      const isChauffeur = company?.services_enabled?.chauffeur_enabled ?? false;

      // pool enabled = company has own pool cars managed
      const companyRes = await apiClient.getCompany(companyId).catch(() => ({ data: null }));
      const isPool = companyRes.data?.is_own_pooled_cars_managed ?? false;

      const featuresRes = await apiClient.getCompanyFeatures(companyId).catch(() => ({ data: [] }));
      const isAi = featuresRes.data.find(
        (f: { feature_key: string; is_enabled: boolean }) => f.feature_key === 'ai_insights'
      )?.is_enabled ?? false;

      setShuttleEnabled(isShuttle);
      setChauffeurEnabled(isChauffeur);
      setPoolEnabled(isPool);
      setAiEnabled(isAi);

      if (!isAi) return;

      // 2. Fetch only what's enabled
      const [metricsRes, fuelRes, insightsRes, chauffeurRes, poolRes] = await Promise.allSettled([
        isShuttle
          ? apiClient.request<{ summary: ShuttleMetricsSummary; metrics: ShuttleMetric[] }>('/company/fleet-metrics')
          : Promise.resolve(null),
        isShuttle
          ? apiClient.request<FuelFlag[]>('/company/fuel-variance?flagged_only=true')
          : Promise.resolve(null),
        apiClient.request<FleetInsight[]>('/company/fleet-insights'),
        isChauffeur
          ? apiClient.request<{ summary: ChauffeurUtilizationSummary; bookings: ChauffeurUtilizationRow[] }>('/company/chauffeur-utilization')
          : Promise.resolve(null),
        isPool
          ? apiClient.request<{ summary: PoolUtilizationSummary; vehicles: PoolVehicleRow[] }>('/company/pool-utilization')
          : Promise.resolve(null),
      ]);

      if (metricsRes.status === 'fulfilled' && metricsRes.value) {
        setSummary(metricsRes.value.summary);
        setRecentMetrics(metricsRes.value.metrics.slice(0, 10));
      }
      if (fuelRes.status === 'fulfilled' && fuelRes.value) setFuelFlags(fuelRes.value);
      if (insightsRes.status === 'fulfilled') setInsights(insightsRes.value);
      if (chauffeurRes.status === 'fulfilled' && chauffeurRes.value) setChauffeurUtil(chauffeurRes.value);
      if (poolRes.status === 'fulfilled' && poolRes.value) setPoolUtil(poolRes.value);
    } finally {
      setLoading(false);
    }
  }, [companyId, company]);

  useEffect(() => { void load(); }, [load]);

  const loadRouteComparison = useCallback(async (shuttleTripId: number, routeId: number | null) => {
    if (selectedTripForMap === shuttleTripId) {
      setSelectedTripForMap(null);
      setRouteComparison(null);
      setSelectedRouteId(null);
      return;
    }
    setSelectedTripForMap(shuttleTripId);
    setSelectedRouteId(routeId);
    setRouteComparison(null);
    setMapLoading(true);
    try {
      const data = await apiClient.request<RouteComparison>(`/company/shuttle-trips/${shuttleTripId}/route-comparison`);
      setRouteComparison(data);
    } catch {
      setRouteComparison(null);
    } finally {
      setMapLoading(false);
    }
  }, [selectedTripForMap]);

  const triggerGenerate = async () => {
    setGenerating(true);
    try {
      await apiClient.request<{ generated: number }>('/company/fleet-insights/generate', { method: 'POST' });
      await load();
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
        <RefreshCw className="h-6 w-6 animate-spin me-2" /> {t('loadingMetrics')}
      </div>
    );
  }

  const shuttleInsights = insights.filter(i => SHUTTLE_INSIGHT_TYPES.has(i.insight_type));
  const chauffeurInsights = insights.filter(i => CHAUFFEUR_INSIGHT_TYPES.has(i.insight_type));
  const poolInsights = insights.filter(i => POOL_INSIGHT_TYPES.has(i.insight_type));
  const showGenerate = aiEnabled && (shuttleEnabled || chauffeurEnabled || poolEnabled);

  return (
    <div className="space-y-10">

      {/* ══════════════════════════════════════════════════════════
          SHUTTLE SECTION
      ═══════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Bus className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t('shuttleAnalytics')}</h2>
            {shuttleEnabled && aiEnabled && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400">{t('active')}</span>
            )}
          </div>
          {showGenerate && (
            <button
              onClick={triggerGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--cort-orange)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--cort-orange-hover)] disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
              {generating ? t('generating') : t('runAiAnalysis')}
            </button>
          )}
        </div>

        {!(shuttleEnabled && aiEnabled) ? (
          <DisabledSection label={t('shuttleAiDisabled')} />
        ) : (
          <div className="space-y-6">
            {summary && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiCard label={t('tripsAnalysed')} value={summary.count.toString()} icon={<Bus className="h-5 w-5 text-blue-500" />} />
                <KpiCard label={t('avgOccupancy')} value={`${summary.avgOccupancy.toFixed(1)}%`} icon={summary.avgOccupancy >= 70 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-orange-500" />} good={summary.avgOccupancy >= 70} />
                <KpiCard label={t('avgDetourRatio')} value={summary.avgDetour ? `${summary.avgDetour.toFixed(2)}×` : '—'} icon={<Navigation className="h-5 w-5 text-purple-500" />} good={!summary.avgDetour || summary.avgDetour < 1.1} />
                <KpiCard label={t('totalIdleMin')} value={Math.round(summary.totalIdleMin).toLocaleString()} icon={<Zap className="h-5 w-5 text-yellow-500" />} good={summary.totalIdleMin < 300} />
              </div>
            )}

            <section className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.4)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-[var(--cort-orange)]" /> {t('aiInsightsShuttle')}
              </h3>
              {shuttleInsights.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t('noShuttleInsights')}</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {shuttleInsights.map(i => <InsightCard key={i.id} insight={i} />)}
                </div>
              )}
            </section>

            {fuelFlags.length > 0 && (
              <section className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.4)]">
                <div className="p-6 border-b border-[var(--border-light)]">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Fuel className="h-4 w-4 text-rose-400" /> {t('flaggedFuelVariance')}
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-400">
                      {t('flagged', { count: fuelFlags.length })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{t('fuelVarianceNote')}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-light)]">
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-start">{t('vehicle')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-start">{t('date')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-end">{t('variance')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-end">{t('actualL')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-end">{t('expectedL')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-end">{t('streak')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)]/50">
                      {fuelFlags.slice(0, 8).map((f) => (
                        <tr key={f.id} className="group transition-colors hover:bg-[var(--surface-subtle)]/80">
                          <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{f.vehicles?.plate_number ?? f.vehicle_id}</td>
                          <td className="px-6 py-4 text-[var(--text-muted)]">{new Date(f.flag_date).toLocaleDateString()}</td>
                          <td className={`px-6 py-4 text-end font-bold ${parseFloat(f.variance_pct) > 20 ? 'text-rose-400' : 'text-[var(--cort-orange)]'}`}>
                            {pct(f.variance_pct)}
                          </td>
                          <td className="px-6 py-4 text-end text-[var(--text-secondary)]">{fmt(f.actual_litres)}</td>
                          <td className="px-6 py-4 text-end text-[var(--text-secondary)]">{fmt(f.expected_litres)}</td>
                          <td className="px-6 py-4 text-end text-[var(--text-muted)]">{f.consecutive_days}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {recentMetrics.length > 0 && (
              <section className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.4)]">
                <div className="p-6 border-b border-[var(--border-light)]">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Bus className="h-4 w-4 text-blue-400" /> {t('recentShuttleTrips')}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-light)]">
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-start">{t('date')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-start">{t('dir')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-start">{t('vehicle')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-start">{t('driver')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-end">{t('occupancy')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-end">{t('detour')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-end">{t('idleMin')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-end">{t('fuelVar')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-end">{t('route')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)]/50">
                      {recentMetrics.map((m) => (
                        <tr key={m.id} className={`group transition-colors ${selectedTripForMap === m.shuttle_trip_id ? 'bg-[var(--cort-orange)]/5' : 'hover:bg-[var(--surface-subtle)]/80'}`}>
                          <td className="px-6 py-4 text-[var(--text-secondary)]">{new Date(m.trip_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-[var(--text-muted)]">{m.direction}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-[var(--text-primary)]">{m.vehicles?.plate_number ?? '—'}</div>
                            {(m.vehicles?.make || m.vehicles?.model) && (
                              <div className="text-xs text-[var(--text-muted)]">{[m.vehicles?.make, m.vehicles?.model].filter(Boolean).join(' ')}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-[var(--text-secondary)]">{m.shuttle_trips?.users?.full_name ?? '—'}</td>
                          <td className={`px-6 py-4 text-right font-medium ${m.occupancy_pct && parseFloat(m.occupancy_pct) < 50 ? 'text-[var(--cort-orange)]' : 'text-[var(--text-primary)]'}`}>
                            {pct(m.occupancy_pct)}
                          </td>
                          <td className={`px-6 py-4 text-right font-medium ${m.detour_ratio && parseFloat(m.detour_ratio) > 1.2 ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}>
                            {m.detour_ratio ? `${fmt(m.detour_ratio, 2)}×` : '—'}
                          </td>
                          <td className="px-6 py-4 text-right text-[var(--text-muted)]">{fmt(m.idle_minutes, 0)}</td>
                          <td className={`px-6 py-4 text-right font-medium ${m.fuel_variance_pct && Math.abs(parseFloat(m.fuel_variance_pct)) > 15 ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}>
                            {pct(m.fuel_variance_pct)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => loadRouteComparison(m.shuttle_trip_id, m.route_id)}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                                selectedTripForMap === m.shuttle_trip_id
                                  ? 'bg-[var(--cort-orange)]/10 text-[var(--cort-orange)] border border-[var(--cort-orange)]/20'
                                  : 'bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-light)]'
                              }`}
                            >
                              <MapIcon className="h-3 w-3" />
                              {selectedTripForMap === m.shuttle_trip_id ? t('close') : t('view')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedTripForMap !== null && (
                  <div className="border-t border-[var(--border-light)] overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] bg-[var(--surface-subtle)]/50">
                      <div className="flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-[var(--text-muted)]" />
                        <span className="text-sm font-bold text-[var(--text-primary)]">{t('routeMapOverlay')}</span>
                        <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                          <span className="inline-block h-2.5 w-6 rounded-sm bg-blue-500" /> {t('planned')}
                          <span className="inline-block h-2.5 w-6 rounded-sm bg-[var(--cort-orange)] ms-1" /> {t('actual')}
                        </span>
                      </div>
                      <button onClick={() => { setSelectedTripForMap(null); setRouteComparison(null); setSelectedRouteId(null); }} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {mapLoading ? (
                      <div className="flex items-center justify-center h-64 text-[var(--text-muted)] text-sm">
                        <RefreshCw className="h-5 w-5 animate-spin me-2" /> {t('loadingRouteData')}
                      </div>
                    ) : routeComparison ? (
                      <RouteMapOverlay
                        comparison={routeComparison}
                        routeInsight={shuttleInsights.find(i => i.insight_type === 'ROUTE_DETOUR' && i.route_id === selectedRouteId) ?? null}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-32 text-[var(--text-muted)] text-sm">
                        {t('noRouteData')}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-[var(--border-default)]" />

      {/* ══════════════════════════════════════════════════════════
          CHAUFFEUR SECTION
      ═══════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <CarFront className="h-5 w-5 text-teal-400" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">{t('chauffeurAnalytics')}</h2>
          {chauffeurEnabled && aiEnabled && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400">{t('active')}</span>
          )}
        </div>

        {!(chauffeurEnabled && aiEnabled) ? (
          <DisabledSection label={t('chauffeurAiDisabled')} />
        ) : (
          <div className="space-y-6">
            <section className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.4)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-[var(--cort-orange)]" /> {t('aiInsightsChauffeur')}
              </h3>
              {chauffeurInsights.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t('noChauffeurInsights')}</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {chauffeurInsights.map(i => <InsightCard key={i.id} insight={i} />)}
                </div>
              )}
            </section>

            {chauffeurUtil && (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <KpiCard label={t('totalBookings')} value={chauffeurUtil.summary.total_bookings.toString()} icon={<CarFront className="h-5 w-5 text-teal-500" />} />
                  <KpiCard label={t('avgOccupancy')} value={chauffeurUtil.summary.avg_utilization_pct != null ? `${chauffeurUtil.summary.avg_utilization_pct}%` : '—'} icon={<Clock className="h-5 w-5 text-blue-500" />} good={chauffeurUtil.summary.avg_utilization_pct != null && chauffeurUtil.summary.avg_utilization_pct >= 70} />
                  <KpiCard label={t('underutilizedBookings')} value={chauffeurUtil.summary.underutilized_count.toString()} icon={<AlertTriangle className="h-5 w-5 text-orange-500" />} good={chauffeurUtil.summary.underutilized_count === 0} />
                  <KpiCard label={t('estBillingSaving')} value={chauffeurUtil.summary.total_estimated_saving_pkr > 0 ? `PKR ${chauffeurUtil.summary.total_estimated_saving_pkr.toLocaleString()}` : '—'} icon={<TrendingDown className="h-5 w-5 text-green-500" />} />
                </div>

                {chauffeurUtil.bookings.filter(b => (b.utilization_pct ?? 100) < 70).length > 0 && (
                  <section className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.4)]">
                    <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center gap-2">
                      <Package className="h-4 w-4 text-teal-400" />
                      <span className="text-sm font-bold text-[var(--text-primary)]">{t('underutilizedBookings')}</span>
                      <span className="text-xs text-[var(--text-muted)]">{t('underutilizedHint')}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border-light)]">
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-left">Booking</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-left">Package</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-left">Date</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-right">Used</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-right min-w-[160px]">Utilization</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-right">Est. Saving</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)]/50">
                          {chauffeurUtil.bookings
                            .filter(b => (b.utilization_pct ?? 100) < 70)
                            .slice(0, 10)
                            .map(b => (
                              <tr key={b.booking_id} className="group transition-colors hover:bg-[var(--surface-subtle)]/80">
                                <td className="px-6 py-4 font-bold text-[var(--text-primary)]">#{b.booking_id}</td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold px-2 py-0.5 border border-teal-500/20">
                                    {b.package_selected?.replace('HOURS_', '') ?? '—'}h
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-[var(--text-muted)] text-xs">
                                  {b.scheduled_for ? new Date(b.scheduled_for).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-6 py-4 text-right text-[var(--text-secondary)]">
                                  {b.used_minutes != null ? `${(b.used_minutes / 60).toFixed(1)}h` : '—'}
                                </td>
                                <td className="px-6 py-4 min-w-[160px]">
                                  {b.utilization_pct != null ? <UtilizationBar pct={b.utilization_pct} /> : '—'}
                                </td>
                                <td className="px-6 py-4 text-right text-emerald-400 font-bold">
                                  {b.estimated_saving_pkr != null && b.estimated_saving_pkr > 0
                                    ? `PKR ${b.estimated_saving_pkr.toLocaleString()}`
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UtilizationBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-[var(--surface-subtle)] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs font-bold w-10 text-end ${pct < 60 ? 'text-rose-400' : 'text-[var(--text-secondary)]'}`}>{pct}%</span>
    </div>
  );
}

function RouteMapOverlay({ comparison, routeInsight }: { comparison: RouteComparison; routeInsight: FleetInsight | null }) {
  const t = useTranslations('company.fleetAnalytics');
  const plannedPolyline: MapPolyline | null = comparison.planned_points.length > 1
    ? { positions: comparison.planned_points.map(p => [p.lat, p.lng] as [number, number]), color: '#2563eb', weight: 4, opacity: 0.85 }
    : null;
  const actualPolyline: MapPolyline | null = comparison.actual_points.length > 1
    ? { positions: comparison.actual_points.map(p => [p.lat, p.lng] as [number, number]), color: '#f97316', weight: 3, opacity: 0.9, dashArray: '6 4' }
    : null;
  const polylines = [plannedPolyline, actualPolyline].filter(Boolean) as MapPolyline[];

  const markers: MapMarker[] = [];
  if (comparison.planned_points.length > 0) {
    const first = comparison.planned_points[0];
    const last = comparison.planned_points[comparison.planned_points.length - 1];
    markers.push({ id: 'start', position: [first.lat, first.lng], label: t('start'), color: '#22c55e', type: 'pickup' });
    markers.push({ id: 'end', position: [last.lat, last.lng], label: t('end'), color: '#ef4444', type: 'dropoff' });
  }

  const m = comparison.metrics;
  const detour = m?.detour_ratio ?? null;
  const detourPct = detour !== null ? ((detour - 1) * 100).toFixed(1) : null;

  return (
    <div className="flex flex-col lg:flex-row">
      <div className="flex-1 min-h-0" style={{ height: 360 }}>
        {polylines.length > 0 || markers.length > 0 ? (
          <Map markers={markers} polylines={polylines} height="360px" />
        ) : (
          <div className="flex items-center justify-center h-full bg-[var(--surface-subtle)] text-sm text-[var(--text-muted)]">
            {t('noPolylineData')}
          </div>
        )}
      </div>
      <div className="w-full lg:w-64 p-5 border-t lg:border-t-0 lg:border-s border-[var(--border-light)] flex flex-col gap-4 bg-[var(--surface-subtle)]/30">
        {detour !== null && (
          <div className={`rounded-xl px-4 py-3 text-center border ${
            detour > 1.15
              ? 'bg-rose-500/10 border-rose-500/20'
              : detour > 1.05
              ? 'bg-[var(--cort-orange)]/10 border-[var(--cort-orange)]/20'
              : 'bg-emerald-500/10 border-emerald-500/20'
          }`}>
            <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('detourRatio')}</p>
            <p className={`text-2xl font-bold ${
              detour > 1.15 ? 'text-rose-400' : detour > 1.05 ? 'text-[var(--cort-orange)]' : 'text-emerald-400'
            }`}>
              {detour.toFixed(2)}×
            </p>
            {detourPct && <p className="text-xs text-[var(--text-muted)]">{t('extraDistance', { percent: detourPct })}</p>}
          </div>
        )}
        <div className="space-y-2 text-sm">
          {m?.planned_distance_km != null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className="inline-block h-2 w-4 rounded-sm bg-blue-500" /> {t('planned')}
              </span>
              <span className="font-medium text-[var(--text-primary)]">{m.planned_distance_km.toFixed(2)} km</span>
            </div>
          )}
          {m?.actual_distance_km != null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className="inline-block h-2 w-4 rounded-sm bg-[var(--cort-orange)]" /> {t('actual')}
              </span>
              <span className="font-medium text-[var(--text-primary)]">{m.actual_distance_km.toFixed(2)} km</span>
            </div>
          )}
          {comparison.idle_minutes != null && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">{t('idleTime')}</span>
              <span className="font-medium text-[var(--text-primary)]">{comparison.idle_minutes.toFixed(0)} min</span>
            </div>
          )}
          {m?.fuel_variance_pct != null && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">{t('fuelVariance')}</span>
              <span className={`font-medium ${Math.abs(m.fuel_variance_pct) > 15 ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}>
                {m.fuel_variance_pct > 0 ? '+' : ''}{m.fuel_variance_pct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        {routeInsight && (
          <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Navigation className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs font-bold text-purple-400">{t('aiNote')}</span>
            </div>
            <p className="text-xs text-purple-300">{routeInsight.data.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  good,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  good?: boolean;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-5 shadow-[0_2px_16px_rgba(0,0,0,0.4)] transition-all duration-200 hover:shadow-[0_4px_24px_rgba(0,0,0,0.5)] hover:-translate-y-0.5">
      <div className="flex items-center gap-2 mb-3">{icon}<span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{label}</span></div>
      <p className={`text-2xl font-extrabold tracking-tight ${
        good === false ? 'text-[var(--cort-orange)]' : 'text-[var(--text-primary)]'
      }`}>{value}</p>
    </div>
  );

}
