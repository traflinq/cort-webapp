'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { apiClient } from '@/app/lib/services/api-client';
import { useAppSelector } from '@/app/lib/store/hooks';
import { selectCompany } from '@/app/lib/store/slices/companySlice';
import { AlertTriangle, Fuel, Bus, Navigation, TrendingDown, TrendingUp, Zap, RefreshCw, Map as MapIcon, X, Clock, Users, Package, CarFront, Car } from 'lucide-react';
import type { MapMarker, MapPolyline } from '@/app/admin/ui/Map';
import { EmptyState, IconCircleButton, Illustration, PillButton } from '../ui';

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
  if (s === 'CRITICAL') return 'bg-[var(--tone-danger-soft)] text-[var(--tone-danger-ink)] border-[var(--tone-danger-line)]';
  if (s === 'HIGH') return 'bg-[var(--tone-brand-soft)] text-[var(--tone-brand-ink)] border-[var(--tone-brand-line)]';
  if (s === 'MEDIUM') return 'bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)] border-[var(--tone-warning-line)]';
  return 'bg-[var(--tone-info-soft)] text-[var(--tone-info-ink)] border-[var(--tone-info-line)]';
}

function insightIcon(type: string) {
  if (type === 'FUEL_LEAKAGE') return <Fuel className="h-5 w-5 text-[var(--tone-warning-ink)]" />;
  if (type === 'OCCUPANCY') return <Bus className="h-5 w-5 text-[var(--tone-info-ink)]" />;
  if (type === 'CHAUFFEUR_DETOUR' || type === 'ROUTE_DETOUR') return <Navigation className="h-5 w-5 text-[var(--tone-purple-ink)]" />;
  if (type === 'IDLE_TIME') return <Zap className="h-5 w-5 text-[var(--tone-warning-ink)]" />;
  if (type === 'CHAUFFEUR_PACKAGE_UNDERUTILIZATION') return <Package className="h-5 w-5 text-[var(--tone-success-ink)]" />;
  if (type === 'CHAUFFEUR_CONCURRENT') return <Users className="h-5 w-5 text-[var(--tone-info-ink)]" />;
  if (type === 'POOL_UTILIZATION') return <Car className="h-5 w-5 text-[var(--tone-purple-ink)]" />;
  return <AlertTriangle className="h-5 w-5 text-[var(--text-muted)]" />;
}

function InsightCard({ insight }: { insight: FleetInsight }) {
  const t = useTranslations('company.fleetAnalytics');
  return (
    <div className={`rounded-[var(--radius-tile)] border p-4 ${severityColor(insight.severity)}`}>
      <div className="flex items-start gap-3">
        {insightIcon(insight.insight_type)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold">
              {insight.insight_type.replace(/_/g, ' ')}
            </span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-[var(--tile-bg)]">
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
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--pill-line)] bg-[var(--tile-bg)] px-6">
      <EmptyState compact illustration="key" title={label} description={t('contactAdminEnable')} />
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
            <Bus className="h-5 w-5 text-[var(--tone-info-ink)]" />
            <h2 className="text-xl font-medium text-[var(--text-primary)]">{t('shuttleAnalytics')}</h2>
            {shuttleEnabled && aiEnabled && (
              <span className="inline-flex items-center rounded-full bg-[var(--tone-success-soft)] border border-[var(--tone-success-line)] px-2 py-0.5 text-xs font-medium text-[var(--tone-success-ink)]">{t('active')}</span>
            )}
          </div>
          {showGenerate && (
            <PillButton
              variant="primary"
              size="sm"
              icon={<RefreshCw className={generating ? 'animate-spin' : ''} strokeWidth={2} />}
              onClick={triggerGenerate}
              disabled={generating}
            >
              {generating ? t('generating') : t('runAiAnalysis')}
            </PillButton>
          )}
        </div>

        {!(shuttleEnabled && aiEnabled) ? (
          <DisabledSection label={t('shuttleAiDisabled')} />
        ) : (
          <div className="space-y-6">
            {summary && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiCard label={t('tripsAnalysed')} value={summary.count.toString()} icon={<Bus className="h-5 w-5 text-[var(--tone-info-ink)]" />} />
                <KpiCard label={t('avgOccupancy')} value={`${summary.avgOccupancy.toFixed(1)}%`} icon={summary.avgOccupancy >= 70 ? <TrendingUp className="h-5 w-5 text-[var(--tone-success-ink)]" /> : <TrendingDown className="h-5 w-5 text-[var(--tone-warning-ink)]" />} good={summary.avgOccupancy >= 70} />
                <KpiCard label={t('avgDetourRatio')} value={summary.avgDetour ? `${summary.avgDetour.toFixed(2)}×` : '—'} icon={<Navigation className="h-5 w-5 text-[var(--tone-purple-ink)]" />} good={!summary.avgDetour || summary.avgDetour < 1.1} />
                <KpiCard label={t('totalIdleMin')} value={Math.round(summary.totalIdleMin).toLocaleString()} icon={<Zap className="h-5 w-5 text-[var(--tone-warning-ink)]" />} good={summary.totalIdleMin < 300} />
              </div>
            )}

            <section className="bg-[var(--bg-card)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-card)]">
              <h3 className="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-[var(--cort-orange)]" /> {t('aiInsightsShuttle')}
              </h3>
              {shuttleInsights.length === 0 ? (
                <div className="flex items-center gap-3 rounded-[var(--radius-tile)] bg-[var(--tile-bg)] px-4 py-3">
                  <Illustration name="fuel" size={36} />
                  <p className="text-sm text-[var(--text-muted)]">{t('noShuttleInsights')}</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {shuttleInsights.map(i => <InsightCard key={i.id} insight={i} />)}
                </div>
              )}
            </section>

            {fuelFlags.length > 0 && (
              <section className="bg-[var(--bg-card)] rounded-[var(--radius-card)] overflow-hidden shadow-[var(--shadow-card)]">
                <div className="p-6 border-b border-[var(--divider)]">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
                      <Fuel className="h-4 w-4 text-[var(--tone-danger-ink)]" /> {t('flaggedFuelVariance')}
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-[var(--tone-danger-soft)] border border-[var(--tone-danger-line)] px-2 py-0.5 text-xs font-medium text-[var(--tone-danger-ink)]">
                      {t('flagged', { count: fuelFlags.length })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{t('fuelVarianceNote')}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--divider)]">
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-start">{t('vehicle')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-start">{t('date')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end">{t('variance')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end">{t('actualL')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end">{t('expectedL')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end">{t('streak')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--divider)]">
                      {fuelFlags.slice(0, 8).map((f) => (
                        <tr key={f.id} className="group transition-colors hover:bg-[var(--row-hover)]">
                          <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{f.vehicles?.plate_number ?? f.vehicle_id}</td>
                          <td className="px-6 py-4 text-[var(--text-muted)]">{new Date(f.flag_date).toLocaleDateString()}</td>
                          <td className={`px-6 py-4 text-end font-medium ${parseFloat(f.variance_pct) > 20 ? 'text-[var(--tone-danger-ink)]' : 'text-[var(--cort-orange)]'}`}>
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
              <section className="bg-[var(--bg-card)] rounded-[var(--radius-card)] overflow-hidden shadow-[var(--shadow-card)]">
                <div className="p-6 border-b border-[var(--divider)]">
                  <h3 className="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
                    <Bus className="h-4 w-4 text-[var(--tone-info-ink)]" /> {t('recentShuttleTrips')}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--divider)]">
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-start">{t('date')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-start">{t('dir')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-start">{t('vehicle')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-start">{t('driver')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end">{t('occupancy')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end">{t('detour')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end">{t('idleMin')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end">{t('fuelVar')}</th>
                        <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end">{t('route')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--divider)]">
                      {recentMetrics.map((m) => (
                        <tr key={m.id} className={`group transition-colors ${selectedTripForMap === m.shuttle_trip_id ? 'bg-[var(--cort-orange)]/5' : 'hover:bg-[var(--row-hover)]'}`}>
                          <td className="px-6 py-4 text-[var(--text-secondary)]">{new Date(m.trip_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-[var(--text-muted)]">{m.direction}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-[var(--text-primary)]">{m.vehicles?.plate_number ?? '—'}</div>
                            {(m.vehicles?.make || m.vehicles?.model) && (
                              <div className="text-xs text-[var(--text-muted)]">{[m.vehicles?.make, m.vehicles?.model].filter(Boolean).join(' ')}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-[var(--text-secondary)]">{m.shuttle_trips?.users?.full_name ?? '—'}</td>
                          <td className={`px-6 py-4 text-end font-medium ${m.occupancy_pct && parseFloat(m.occupancy_pct) < 50 ? 'text-[var(--cort-orange)]' : 'text-[var(--text-primary)]'}`}>
                            {pct(m.occupancy_pct)}
                          </td>
                          <td className={`px-6 py-4 text-end font-medium ${m.detour_ratio && parseFloat(m.detour_ratio) > 1.2 ? 'text-[var(--tone-danger-ink)]' : 'text-[var(--text-primary)]'}`}>
                            {m.detour_ratio ? `${fmt(m.detour_ratio, 2)}×` : '—'}
                          </td>
                          <td className="px-6 py-4 text-end text-[var(--text-muted)]">{fmt(m.idle_minutes, 0)}</td>
                          <td className={`px-6 py-4 text-end font-medium ${m.fuel_variance_pct && Math.abs(parseFloat(m.fuel_variance_pct)) > 15 ? 'text-[var(--tone-danger-ink)]' : 'text-[var(--text-primary)]'}`}>
                            {pct(m.fuel_variance_pct)}
                          </td>
                          <td className="px-6 py-4 text-end">
                            <button
                              onClick={() => loadRouteComparison(m.shuttle_trip_id, m.route_id)}
                              className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors ${
 selectedTripForMap === m.shuttle_trip_id
 ? 'bg-[var(--tone-brand-soft)] text-[var(--cort-orange)] border border-[var(--tone-brand-line)]'
 : 'border border-[var(--pill-line)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
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
                  <div className="border-t border-[var(--divider)] overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--divider)] bg-[var(--tile-bg)]">
                      <div className="flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-[var(--text-muted)]" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">{t('routeMapOverlay')}</span>
                        <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                          <span className="inline-block h-2.5 w-6 rounded-full bg-[var(--cort-navy-ring,var(--cort-navy))]" /> {t('planned')}
                          <span className="inline-block h-2.5 w-6 rounded-full bg-[var(--cort-orange)] ms-1" /> {t('actual')}
                        </span>
                      </div>
                      <IconCircleButton label={t('close')} variant="outline" size="xs" onClick={() => { setSelectedTripForMap(null); setRouteComparison(null); setSelectedRouteId(null); }}>
                        <X strokeWidth={1.8} />
                      </IconCircleButton>
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
      <div className="border-t border-[var(--divider)]" />

      {/* ══════════════════════════════════════════════════════════
          CHAUFFEUR SECTION
      ═══════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <CarFront className="h-5 w-5 text-[var(--tone-success-ink)]" />
          <h2 className="text-xl font-medium text-[var(--text-primary)]">{t('chauffeurAnalytics')}</h2>
          {chauffeurEnabled && aiEnabled && (
            <span className="inline-flex items-center rounded-full bg-[var(--tone-success-soft)] border border-[var(--tone-success-line)] px-2 py-0.5 text-xs font-medium text-[var(--tone-success-ink)]">{t('active')}</span>
          )}
        </div>

        {!(chauffeurEnabled && aiEnabled) ? (
          <DisabledSection label={t('chauffeurAiDisabled')} />
        ) : (
          <div className="space-y-6">
            <section className="bg-[var(--bg-card)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-card)]">
              <h3 className="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-[var(--cort-orange)]" /> {t('aiInsightsChauffeur')}
              </h3>
              {chauffeurInsights.length === 0 ? (
                <div className="flex items-center gap-3 rounded-[var(--radius-tile)] bg-[var(--tile-bg)] px-4 py-3">
                  <Illustration name="chart" size={36} />
                  <p className="text-sm text-[var(--text-muted)]">{t('noChauffeurInsights')}</p>
                </div>
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
                  <KpiCard label={t('avgOccupancy')} value={chauffeurUtil.summary.avg_utilization_pct != null ? `${chauffeurUtil.summary.avg_utilization_pct}%` : '—'} icon={<Clock className="h-5 w-5 text-[var(--tone-info-ink)]" />} good={chauffeurUtil.summary.avg_utilization_pct != null && chauffeurUtil.summary.avg_utilization_pct >= 70} />
                  <KpiCard label={t('underutilizedBookings')} value={chauffeurUtil.summary.underutilized_count.toString()} icon={<AlertTriangle className="h-5 w-5 text-[var(--tone-warning-ink)]" />} good={chauffeurUtil.summary.underutilized_count === 0} />
                  <KpiCard label={t('estBillingSaving')} value={chauffeurUtil.summary.total_estimated_saving_pkr > 0 ? `PKR ${chauffeurUtil.summary.total_estimated_saving_pkr.toLocaleString()}` : '—'} icon={<TrendingDown className="h-5 w-5 text-[var(--tone-success-ink)]" />} />
                </div>

                {chauffeurUtil.bookings.filter(b => (b.utilization_pct ?? 100) < 70).length > 0 && (
                  <section className="bg-[var(--bg-card)] rounded-[var(--radius-card)] overflow-hidden shadow-[var(--shadow-card)]">
                    <div className="px-6 py-4 border-b border-[var(--divider)] flex items-center gap-2">
                      <Package className="h-4 w-4 text-[var(--tone-success-ink)]" />
                      <span className="text-sm font-medium text-[var(--text-primary)]">{t('underutilizedBookings')}</span>
                      <span className="text-xs text-[var(--text-muted)]">{t('underutilizedHint')}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--divider)]">
                            <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-start">Booking</th>
                            <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-start">Package</th>
                            <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-start">Date</th>
                            <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end">Used</th>
                            <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end min-w-[160px]">Utilization</th>
                            <th className="px-6 py-4 text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap text-end">Est. Saving</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--divider)]">
                          {chauffeurUtil.bookings
                            .filter(b => (b.utilization_pct ?? 100) < 70)
                            .slice(0, 10)
                            .map(b => (
                              <tr key={b.booking_id} className="group transition-colors hover:bg-[var(--row-hover)]">
                                <td className="px-6 py-4 font-medium text-[var(--text-primary)]">#{b.booking_id}</td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center rounded-full bg-teal-500/10 text-[var(--tone-success-ink)] text-xs font-medium px-2 py-0.5 border border-teal-500/20">
                                    {b.package_selected?.replace('HOURS_', '') ?? '—'}h
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-[var(--text-muted)] text-xs">
                                  {b.scheduled_for ? new Date(b.scheduled_for).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-6 py-4 text-end text-[var(--text-secondary)]">
                                  {b.used_minutes != null ? `${(b.used_minutes / 60).toFixed(1)}h` : '—'}
                                </td>
                                <td className="px-6 py-4 min-w-[160px]">
                                  {b.utilization_pct != null ? <UtilizationBar pct={b.utilization_pct} /> : '—'}
                                </td>
                                <td className="px-6 py-4 text-end text-[var(--tone-success-ink)] font-medium">
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
  const color = pct >= 80 ? 'bg-[var(--tone-success-ink)]' : pct >= 60 ? 'bg-[var(--tone-warning-ink)]' : 'bg-[var(--tone-danger-ink)]';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-[var(--tile-bg)] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs font-medium w-10 text-end ${pct < 60 ? 'text-[var(--tone-danger-ink)]' : 'text-[var(--text-secondary)]'}`}>{pct}%</span>
    </div>
  );
}

function RouteMapOverlay({ comparison, routeInsight }: { comparison: RouteComparison; routeInsight: FleetInsight | null }) {
  const t = useTranslations('company.fleetAnalytics');
  const plannedPolyline: MapPolyline | null = comparison.planned_points.length > 1
    ? { positions: comparison.planned_points.map(p => [p.lat, p.lng] as [number, number]), color: '#1c1b4d', weight: 4, opacity: 0.85 }
    : null;
  const actualPolyline: MapPolyline | null = comparison.actual_points.length > 1
    ? { positions: comparison.actual_points.map(p => [p.lat, p.lng] as [number, number]), color: '#f06a22', weight: 3, opacity: 0.9, dashArray: '6 4' }
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
          <div className="flex items-center justify-center h-full bg-[var(--tile-bg)] text-sm text-[var(--text-muted)]">
            {t('noPolylineData')}
          </div>
        )}
      </div>
      <div className="w-full lg:w-64 p-5 border-t lg:border-t-0 lg:border-s border-[var(--divider)] flex flex-col gap-4 bg-[var(--tile-bg)]">
        {detour !== null && (
          <div className={`rounded-[var(--radius-tile)] px-4 py-3 text-center border ${
 detour > 1.15
 ? 'bg-[var(--tone-danger-soft)] border-[var(--tone-danger-line)]'
 : detour > 1.05
 ? 'bg-[var(--tone-brand-soft)] border-[var(--tone-brand-line)]'
 : 'bg-[var(--tone-success-soft)] border-[var(--tone-success-line)]'
 }`}>
            <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('detourRatio')}</p>
            <p className={`text-2xl font-medium ${
 detour > 1.15 ? 'text-[var(--tone-danger-ink)]' : detour > 1.05 ? 'text-[var(--cort-orange)]' : 'text-[var(--tone-success-ink)]'
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
                <span className="inline-block h-2 w-4 rounded-full bg-[var(--cort-navy-ring,var(--cort-navy))]" /> {t('planned')}
              </span>
              <span className="font-medium text-[var(--text-primary)]">{m.planned_distance_km.toFixed(2)} km</span>
            </div>
          )}
          {m?.actual_distance_km != null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className="inline-block h-2 w-4 rounded-full bg-[var(--cort-orange)]" /> {t('actual')}
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
              <span className={`font-medium ${Math.abs(m.fuel_variance_pct) > 15 ? 'text-[var(--tone-danger-ink)]' : 'text-[var(--text-primary)]'}`}>
                {m.fuel_variance_pct > 0 ? '+' : ''}{m.fuel_variance_pct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        {routeInsight && (
          <div className="rounded-[var(--radius-tile)] bg-[var(--tone-purple-soft)] border border-[var(--tone-purple-line)] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Navigation className="h-3.5 w-3.5 text-[var(--tone-purple-ink)]" />
              <span className="text-xs font-medium text-[var(--tone-purple-ink)]">{t('aiNote')}</span>
            </div>
            <p className="text-xs text-[var(--tone-purple-ink)]">{routeInsight.data.recommendation}</p>
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
    <div className="bg-[var(--bg-card)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 mb-3"><span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--tile-bg)]">{icon}</span><span className="text-sm text-[var(--text-muted)]">{label}</span></div>
      <p className={`text-2xl font-medium tracking-tight ${
 good === false ? 'text-[var(--cort-orange)]' : 'text-[var(--text-primary)]'
 }`}>{value}</p>
    </div>
  );

}
