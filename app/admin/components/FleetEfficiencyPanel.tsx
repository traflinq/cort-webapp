'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { apiClient } from '@/app/lib/services/api-client';
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
  if (s === 'CRITICAL') return 'bg-red-100 text-red-800 border-red-200';
  if (s === 'HIGH') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (s === 'MEDIUM') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-blue-100 text-blue-800 border-blue-200';
}

function insightIcon(type: string) {
  if (type === 'FUEL_LEAKAGE') return <Fuel className="h-5 w-5 text-orange-500" />;
  if (type === 'OCCUPANCY') return <Bus className="h-5 w-5 text-blue-500" />;
  if (type === 'CHAUFFEUR_DETOUR' || type === 'ROUTE_DETOUR') return <Navigation className="h-5 w-5 text-purple-500" />;
  if (type === 'IDLE_TIME') return <Zap className="h-5 w-5 text-yellow-500" />;
  if (type === 'CHAUFFEUR_PACKAGE_UNDERUTILIZATION') return <Package className="h-5 w-5 text-teal-500" />;
  if (type === 'CHAUFFEUR_CONCURRENT') return <Users className="h-5 w-5 text-indigo-500" />;
  if (type === 'POOL_UTILIZATION') return <Car className="h-5 w-5 text-violet-500" />;
  return <AlertTriangle className="h-5 w-5 text-[var(--text-muted)]" />;
}

function InsightCard({ insight }: { insight: FleetInsight }) {
  return (
    <div className={`rounded-xl border p-4 ${severityColor(insight.severity)}`}>
      <div className="flex items-start gap-3">
        {insightIcon(insight.insight_type)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide">
              {insight.insight_type.replace(/_/g, ' ')}
            </span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-[var(--bg-card)]/60">
              {insight.severity}
            </span>
          </div>
          <p className="text-sm font-medium">{insight.data.summary}</p>
          <p className="text-xs mt-1 opacity-80">{insight.data.recommendation}</p>
          {insight.estimated_saving_pkr && parseFloat(insight.estimated_saving_pkr) > 0 && (
            <p className="text-xs mt-2 font-semibold">
              Est. saving: PKR {parseFloat(insight.estimated_saving_pkr).toLocaleString()} / month
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DisabledSection({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-6 py-8 text-center">
      <Lock className="h-6 w-6 text-fg-muted mx-auto mb-2" />
      <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">Enable the service and AI Insights for this company to unlock.</p>
    </div>
  );
}

// ── SHUTTLE_INSIGHTS_TYPES ────────────────────────────────────────────────────

const SHUTTLE_INSIGHT_TYPES = new Set(['FUEL_LEAKAGE', 'OCCUPANCY', 'ROUTE_DETOUR', 'IDLE_TIME']);
const CHAUFFEUR_INSIGHT_TYPES = new Set(['CHAUFFEUR_DETOUR', 'CHAUFFEUR_PACKAGE_UNDERUTILIZATION', 'CHAUFFEUR_CONCURRENT']);
const POOL_INSIGHT_TYPES = new Set(['POOL_UTILIZATION']);

// ── Component ─────────────────────────────────────────────────────────────────

export function FleetEfficiencyPanel({ companyId }: { companyId: number }) {
  // Feature flags
  const [shuttleEnabled, setShuttleEnabled] = useState(false);
  const [chauffeurEnabled, setChauffeurEnabled] = useState(false);
  const [poolEnabled, setPoolEnabled] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  // Shuttle state
  const [summary, setSummary] = useState<ShuttleMetricsSummary | null>(null);
  const [allMetrics, setAllMetrics] = useState<ShuttleMetric[]>([]);
  const [fuelFlags, setFuelFlags] = useState<FuelFlag[]>([]);

  // Recent shuttle trips date filter (yyyy-mm-dd). Draft values are edited freely;
  // fromDate/toDate (applied) only change — and trigger a refetch — on "Apply".
  const [fromDateDraft, setFromDateDraft] = useState('');
  const [toDateDraft, setToDateDraft] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Recent shuttle trips vehicle filter — applied client-side against the
  // already-fetched (date-filtered) metrics, so it updates instantly.
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  // Chauffeur state
  const [chauffeurUtil, setChauffeurUtil] = useState<{ summary: ChauffeurUtilizationSummary; bookings: ChauffeurUtilizationRow[] } | null>(null);

  // Pool state
  const [poolUtil, setPoolUtil] = useState<{ summary: PoolUtilizationSummary; vehicles: PoolVehicleRow[] } | null>(null);

  // Shared
  const [insights, setInsights] = useState<FleetInsight[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Map state (shuttle)
  const [selectedTripForMap, setSelectedTripForMap] = useState<number | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [routeComparison, setRouteComparison] = useState<RouteComparison | null>(null);
  const [mapLoading, setMapLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Always fetch company flags + features first
      const [companyRes, featuresRes] = await Promise.allSettled([
        apiClient.getCompany(companyId),
        apiClient.getCompanyFeatures(companyId),
      ]);

      const company = companyRes.status === 'fulfilled' ? companyRes.value.data : null;
      const features = featuresRes.status === 'fulfilled' ? featuresRes.value.data : [];

      const isShuttle = company?.is_shuttle_enabled ?? false;
      const isChauffeur = company?.is_chauffeur_enabled ?? false;
      const isPool = company?.is_own_pooled_cars_managed ?? false;
      const isAi = features.find(f => f.feature_key === 'ai_insights')?.is_enabled ?? false;

      setShuttleEnabled(isShuttle);
      setChauffeurEnabled(isChauffeur);
      setPoolEnabled(isPool);
      setAiEnabled(isAi);

      // 2. Fetch only what's enabled
      const dateParams = new URLSearchParams();
      if (fromDate) dateParams.set('from', fromDate);
      if (toDate) dateParams.set('to', toDate);
      const dateQuery = dateParams.toString() ? `?${dateParams.toString()}` : '';

      const fetches = await Promise.allSettled([
        isShuttle
          ? apiClient.request<{ summary: ShuttleMetricsSummary; metrics: ShuttleMetric[] }>(`/admin/companies/${companyId}/shuttle-metrics${dateQuery}`)
          : Promise.resolve(null),
        isShuttle && isAi
          ? apiClient.request<FuelFlag[]>(`/admin/companies/${companyId}/fuel-variance?flagged_only=true`)
          : Promise.resolve(null),
        isAi
          ? apiClient.request<FleetInsight[]>(`/admin/companies/${companyId}/fleet-insights`)
          : Promise.resolve([] as FleetInsight[]),
        isChauffeur
          ? apiClient.request<{ summary: ChauffeurUtilizationSummary; bookings: ChauffeurUtilizationRow[] }>(`/admin/companies/${companyId}/chauffeur-utilization`)
          : Promise.resolve(null),
        isPool
          ? apiClient.request<{ summary: PoolUtilizationSummary; vehicles: PoolVehicleRow[] }>(`/admin/companies/${companyId}/pool-utilization`)
          : Promise.resolve(null),
      ]);

      const [metricsRes, fuelRes, insightsRes, chauffeurRes, poolRes] = fetches;

      if (metricsRes.status === 'fulfilled' && metricsRes.value) {
        setSummary(metricsRes.value.summary);
        setAllMetrics(metricsRes.value.metrics);
      }
      if (fuelRes.status === 'fulfilled' && fuelRes.value) setFuelFlags(fuelRes.value);
      if (insightsRes.status === 'fulfilled') setInsights(insightsRes.value);
      if (chauffeurRes.status === 'fulfilled' && chauffeurRes.value) setChauffeurUtil(chauffeurRes.value);
      if (poolRes.status === 'fulfilled' && poolRes.value) setPoolUtil(poolRes.value);
    } finally {
      setLoading(false);
    }
  }, [companyId, fromDate, toDate]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(id);
  }, [load]);

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
      const data = await apiClient.request<RouteComparison>(`/admin/shuttle-trips/${shuttleTripId}/route-comparison`);
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
      await apiClient.request<{ generated: number }>(`/admin/companies/${companyId}/fleet-insights/generate`, { method: 'POST' });
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const applyDateFilter = () => {
    setFromDate(fromDateDraft);
    setToDate(toDateDraft);
  };

  const clearDateFilter = () => {
    setFromDateDraft('');
    setToDateDraft('');
    setFromDate('');
    setToDate('');
  };

  const dateFilterDirty = fromDateDraft !== fromDate || toDateDraft !== toDate;
  const dateFilterActive = fromDate !== '' || toDate !== '';
  const vehicleFilterActive = selectedVehicleId !== '';

  const vehicleOptions = useMemo(() => {
    const byId: Record<number, string> = {};
    for (const m of allMetrics) {
      if (m.vehicle_id != null) {
        byId[m.vehicle_id] = m.vehicles?.plate_number ?? `#${m.vehicle_id}`;
      }
    }
    return Object.entries(byId)
      .map(([id, plate]) => [Number(id), plate] as [number, string])
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [allMetrics]);

  const recentMetrics = useMemo(() => {
    const filtered = selectedVehicleId
      ? allMetrics.filter(m => String(m.vehicle_id) === selectedVehicleId)
      : allMetrics;
    return filtered.slice(0, 25);
  }, [allMetrics, selectedVehicleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading fleet metrics…
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
            <Bus className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Shuttle Analytics</h2>
            {shuttleEnabled && (
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${aiEnabled ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                {aiEnabled ? 'Active' : 'Metrics Only'}
              </span>
            )}
          </div>
          {showGenerate && (
            <button
              onClick={triggerGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating…' : 'Run AI Analysis'}
            </button>
          )}
        </div>

        {!shuttleEnabled ? (
          <DisabledSection label="Shuttle service must be enabled" />
        ) : (
          <div className="space-y-6">
            {/* KPI strip */}
            {summary && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiCard label="Trips analysed" value={summary.count.toString()} icon={<Bus className="h-5 w-5 text-blue-500" />} />
                <KpiCard
                  label="Avg occupancy"
                  value={`${summary.avgOccupancy.toFixed(1)}%`}
                  icon={summary.avgOccupancy >= 70 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-orange-500" />}
                  good={summary.avgOccupancy >= 70}
                />
                <KpiCard
                  label="Avg detour ratio"
                  value={summary.avgDetour ? `${summary.avgDetour.toFixed(2)}×` : '—'}
                  icon={<Navigation className="h-5 w-5 text-purple-500" />}
                  good={!summary.avgDetour || summary.avgDetour < 1.1}
                />
                <KpiCard
                  label="Total idle (min)"
                  value={Math.round(summary.totalIdleMin).toLocaleString()}
                  icon={<Zap className="h-5 w-5 text-yellow-500" />}
                  good={summary.totalIdleMin < 300}
                />
              </div>
            )}

            {/* AI insights — shuttle types only */}
            {aiEnabled && (
            <section>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">AI Insights — Shuttle</h3>
              {shuttleInsights.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No active shuttle insights. Click &quot;Run AI Analysis&quot; to generate.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {shuttleInsights.map(i => <InsightCard key={i.id} insight={i} />)}
                </div>
              )}
            </section>
            )}

            {/* Fuel leakage flags */}
            {fuelFlags.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Flagged Fuel Variance</h3>
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {fuelFlags.length} flagged
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  Flagged when (actual − expected) / expected &gt; 15% for 3+ consecutive days.
                </p>
                <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                  <table className="min-w-full text-sm divide-y divide-gray-100">
                    <thead className="bg-[var(--bg-subtle)] text-xs text-[var(--text-muted)] uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Vehicle</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-right">Variance</th>
                        <th className="px-4 py-3 text-right">Actual (L)</th>
                        <th className="px-4 py-3 text-right">Expected (L)</th>
                        <th className="px-4 py-3 text-right">Streak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {fuelFlags.slice(0, 8).map(f => (
                        <tr key={f.id} className="hover:bg-[var(--bg-subtle)]/50">
                          <td className="px-4 py-2.5 font-medium">{f.vehicles?.plate_number ?? f.vehicle_id}</td>
                          <td className="px-4 py-2.5 text-[var(--text-muted)]">{new Date(f.flag_date).toLocaleDateString()}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${parseFloat(f.variance_pct) > 20 ? 'text-red-600' : 'text-orange-600'}`}>
                            {pct(f.variance_pct)}
                          </td>
                          <td className="px-4 py-2.5 text-right">{fmt(f.actual_litres)}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(f.expected_litres)}</td>
                          <td className="px-4 py-2.5 text-right text-[var(--text-muted)]">{f.consecutive_days}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Recent shuttle trips + map */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Recent Shuttle Trips</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    Vehicle
                    <select
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      className="rounded-md border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)]"
                    >
                      <option value="">All vehicles</option>
                      {vehicleOptions.map(([id, plate]) => (
                        <option key={id} value={id}>{plate}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    From
                    <input
                      type="date"
                      value={fromDateDraft}
                      max={toDateDraft || undefined}
                      onChange={(e) => setFromDateDraft(e.target.value)}
                      className="rounded-md border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    To
                    <input
                      type="date"
                      value={toDateDraft}
                      min={fromDateDraft || undefined}
                      onChange={(e) => setToDateDraft(e.target.value)}
                      className="rounded-md border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)]"
                    />
                  </label>
                  <button
                    onClick={applyDateFilter}
                    disabled={!dateFilterDirty}
                    className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                  {(dateFilterActive || dateFilterDirty) && (
                    <button
                      onClick={clearDateFilter}
                      className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {recentMetrics.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  {vehicleFilterActive
                    ? 'No shuttle trips found for the selected vehicle in this date range.'
                    : dateFilterActive
                      ? 'No shuttle trips found in the selected date range.'
                      : 'No shuttle trips recorded yet.'}
                </p>
              ) : (
              <>
                <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                  <table className="min-w-full text-sm divide-y divide-gray-100">
                    <thead className="bg-[var(--bg-subtle)] text-xs text-[var(--text-muted)] uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Dir</th>
                        <th className="px-4 py-3 text-left">Vehicle</th>
                        <th className="px-4 py-3 text-left">Driver</th>
                        <th className="px-4 py-3 text-right">Occupancy</th>
                        <th className="px-4 py-3 text-right">Detour</th>
                        <th className="px-4 py-3 text-right">Idle (min)</th>
                        <th className="px-4 py-3 text-right">Fuel Var.</th>
                        <th className="px-4 py-3 text-right">Route</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentMetrics.map(m => (
                        <tr key={m.id} className={`hover:bg-[var(--bg-subtle)]/50 ${selectedTripForMap === m.shuttle_trip_id ? 'bg-blue-50/40' : ''}`}>
                          <td className="px-4 py-2.5">{new Date(m.trip_date).toLocaleDateString()}</td>
                          <td className="px-4 py-2.5 text-[var(--text-muted)]">{m.direction}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-[var(--text-primary)]">{m.vehicles?.plate_number ?? '—'}</div>
                            {(m.vehicles?.make || m.vehicles?.model) && (
                              <div className="text-xs text-[var(--text-muted)]">{[m.vehicles?.make, m.vehicles?.model].filter(Boolean).join(' ')}</div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[var(--text-secondary)]">{m.shuttle_trips?.users?.full_name ?? '—'}</td>
                          <td className={`px-4 py-2.5 text-right ${m.occupancy_pct && parseFloat(m.occupancy_pct) < 50 ? 'text-orange-500' : 'text-[var(--text-primary)]'}`}>
                            {pct(m.occupancy_pct)}
                          </td>
                          <td className={`px-4 py-2.5 text-right ${m.detour_ratio && parseFloat(m.detour_ratio) > 1.2 ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>
                            {m.detour_ratio ? `${fmt(m.detour_ratio, 2)}×` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[var(--text-muted)]">{fmt(m.idle_minutes, 0)}</td>
                          <td className={`px-4 py-2.5 text-right ${m.fuel_variance_pct && Math.abs(parseFloat(m.fuel_variance_pct)) > 15 ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>
                            {pct(m.fuel_variance_pct)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => loadRouteComparison(m.shuttle_trip_id, m.route_id)}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${selectedTripForMap === m.shuttle_trip_id ? 'bg-info-soft text-info-ink' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-line'}`}
                            >
                              <MapIcon className="h-3 w-3" />
                              {selectedTripForMap === m.shuttle_trip_id ? 'Close' : 'View'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedTripForMap !== null && (
                  <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
                      <div className="flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-[var(--text-muted)]" />
                        <span className="text-sm font-semibold text-[var(--text-primary)]">Route Map Overlay</span>
                        <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
                          <span className="inline-block h-2.5 w-6 rounded-sm bg-blue-600" /> Planned
                          <span className="inline-block h-2.5 w-6 rounded-sm bg-orange-500 ml-1" /> Actual
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500 ml-2" /> Departed
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#c2410c] ml-1" /> Arrived
                        </span>
                      </div>
                      <button onClick={() => { setSelectedTripForMap(null); setRouteComparison(null); setSelectedRouteId(null); }} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {mapLoading ? (
                      <div className="flex items-center justify-center h-64 text-[var(--text-muted)] text-sm">
                        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading route data…
                      </div>
                    ) : routeComparison ? (
                      <RouteMapOverlay
                        comparison={routeComparison}
                        routeInsight={shuttleInsights.find(i => i.insight_type === 'ROUTE_DETOUR' && i.route_id === selectedRouteId) ?? null}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-32 text-[var(--text-muted)] text-sm">
                        No route data available for this trip.
                      </div>
                    )}
                  </div>
                )}
              </>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <hr className="border-[var(--border-default)]" />

      {/* ══════════════════════════════════════════════════════════
          CHAUFFEUR SECTION
      ═══════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <CarFront className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Chauffeur Analytics</h2>
          {chauffeurEnabled && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${aiEnabled ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
              {aiEnabled ? 'Active' : 'Metrics Only'}
            </span>
          )}
        </div>

        {!chauffeurEnabled ? (
          <DisabledSection label="Chauffeur service must be enabled" />
        ) : (
          <div className="space-y-6">
            {/* AI insights — chauffeur types only */}
            {aiEnabled && (
            <section>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">AI Insights — Chauffeur</h3>
              {chauffeurInsights.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No active chauffeur insights. Click &quot;Run AI Analysis&quot; to generate.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {chauffeurInsights.map(i => <InsightCard key={i.id} insight={i} />)}
                </div>
              )}
            </section>
            )}

            {/* Package utilization KPIs */}
            {chauffeurUtil && (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <KpiCard label="Total bookings" value={chauffeurUtil.summary.total_bookings.toString()} icon={<CarFront className="h-5 w-5 text-teal-500" />} />
                  <KpiCard
                    label="Avg utilization"
                    value={chauffeurUtil.summary.avg_utilization_pct != null ? `${chauffeurUtil.summary.avg_utilization_pct}%` : '—'}
                    icon={<Clock className="h-5 w-5 text-blue-500" />}
                    good={chauffeurUtil.summary.avg_utilization_pct != null && chauffeurUtil.summary.avg_utilization_pct >= 70}
                  />
                  <KpiCard
                    label="Underutilized (<70%)"
                    value={chauffeurUtil.summary.underutilized_count.toString()}
                    icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
                    good={chauffeurUtil.summary.underutilized_count === 0}
                  />
                  <KpiCard
                    label="Est. billing saving"
                    value={chauffeurUtil.summary.total_estimated_saving_pkr > 0
                      ? `PKR ${chauffeurUtil.summary.total_estimated_saving_pkr.toLocaleString()}`
                      : '—'}
                    icon={<TrendingDown className="h-5 w-5 text-green-500" />}
                  />
                </div>

                {/* Underutilized bookings table */}
                {chauffeurUtil.bookings.filter(b => (b.utilization_pct ?? 100) < 70).length > 0 && (
                  <section>
                    <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center gap-2">
                        <Package className="h-4 w-4 text-teal-500" />
                        <span className="text-sm font-semibold text-[var(--text-primary)]">Underutilised Bookings</span>
                        <span className="text-xs text-[var(--text-muted)]">(used &lt;70% of package hours — consider a smaller package)</span>
                      </div>
                      <table className="min-w-full text-sm divide-y divide-gray-100">
                        <thead className="bg-[var(--bg-subtle)] text-xs text-[var(--text-muted)] uppercase">
                          <tr>
                            <th className="px-4 py-3 text-left">Booking</th>
                            <th className="px-4 py-3 text-left">Package</th>
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-right">Used</th>
                            <th className="px-4 py-3 text-right min-w-[140px]">Utilization</th>
                            <th className="px-4 py-3 text-right">Est. Saving</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {chauffeurUtil.bookings
                            .filter(b => (b.utilization_pct ?? 100) < 70)
                            .slice(0, 10)
                            .map(b => (
                              <tr key={b.booking_id} className="hover:bg-[var(--bg-subtle)]/50">
                                <td className="px-4 py-2.5 font-medium text-[var(--text-secondary)]">#{b.booking_id}</td>
                                <td className="px-4 py-2.5">
                                  <span className="inline-flex items-center rounded-full bg-teal-50 text-teal-700 text-xs font-medium px-2 py-0.5">
                                    {b.package_selected?.replace('HOURS_', '') ?? '—'}h
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-[var(--text-muted)] text-xs">
                                  {b.scheduled_for ? new Date(b.scheduled_for).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right text-[var(--text-secondary)]">
                                  {b.used_minutes != null ? `${(b.used_minutes / 60).toFixed(1)}h` : '—'}
                                </td>
                                <td className="px-4 py-2.5 min-w-[140px]">
                                  {b.utilization_pct != null ? <UtilizationBar pct={b.utilization_pct} /> : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right text-green-700 font-medium">
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

      {/* ── Divider ── */}
      <hr className="border-[var(--border-default)]" />

      {/* ══════════════════════════════════════════════════════════
          POOL FLEET SECTION
      ═══════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Car className="h-5 w-5 text-violet-600" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pool Fleet Analytics</h2>
          {poolEnabled && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${aiEnabled ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
              {aiEnabled ? 'Active' : 'Metrics Only'}
            </span>
          )}
        </div>

        {!poolEnabled ? (
          <DisabledSection label="Pool Fleet service must be enabled" />
        ) : (
          <div className="space-y-6">
            {/* AI insights — pool types */}
            {aiEnabled && (
            <section>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">AI Insights — Pool Fleet</h3>
              {poolInsights.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No active pool fleet insights. Click &quot;Run AI Analysis&quot; to generate.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {poolInsights.map(i => <InsightCard key={i.id} insight={i} />)}
                </div>
              )}
            </section>
            )}

            {/* Pool utilization KPIs */}
            {poolUtil && (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <KpiCard label="Pool vehicles" value={poolUtil.summary.total_pool_vehicles.toString()} icon={<Car className="h-5 w-5 text-violet-500" />} />
                  <KpiCard
                    label="Avg utilization"
                    value={`${poolUtil.summary.avg_utilization_pct}%`}
                    icon={<Clock className="h-5 w-5 text-blue-500" />}
                    good={poolUtil.summary.avg_utilization_pct >= 30}
                  />
                  <KpiCard
                    label="Idle vehicles"
                    value={poolUtil.summary.idle_vehicle_count.toString()}
                    icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
                    good={poolUtil.summary.idle_vehicle_count === 0}
                  />
                  <KpiCard
                    label="Underutilized (<30%)"
                    value={poolUtil.summary.underutilized_count.toString()}
                    icon={<TrendingDown className="h-5 w-5 text-red-500" />}
                    good={poolUtil.summary.underutilized_count === 0}
                  />
                </div>

                {/* Per-vehicle utilization table */}
                {poolUtil.vehicles.length > 0 && (
                  <section>
                    <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center gap-2">
                        <Car className="h-4 w-4 text-violet-500" />
                        <span className="text-sm font-semibold text-[var(--text-primary)]">Pool Vehicle Utilization</span>
                        <span className="text-xs text-[var(--text-muted)]">(last 30 days — 300 available hours per vehicle)</span>
                      </div>
                      <table className="min-w-full text-sm divide-y divide-gray-100">
                        <thead className="bg-[var(--bg-subtle)] text-xs text-[var(--text-muted)] uppercase">
                          <tr>
                            <th className="px-4 py-3 text-left">Vehicle</th>
                            <th className="px-4 py-3 text-left">Category</th>
                            <th className="px-4 py-3 text-right">Trips</th>
                            <th className="px-4 py-3 text-right">Hours Used</th>
                            <th className="px-4 py-3 text-right min-w-[140px]">Utilization</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {poolUtil.vehicles.map(v => (
                            <tr key={v.vehicle_id} className="hover:bg-[var(--bg-subtle)]/50">
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-[var(--text-primary)]">{v.plate_number}</div>
                                {(v.make || v.model) && (
                                  <div className="text-xs text-[var(--text-muted)]">{[v.make, v.model].filter(Boolean).join(' ')}</div>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                {v.category ? (
                                  <span className="inline-flex items-center rounded-full bg-violet-50 text-violet-700 text-xs font-medium px-2 py-0.5">
                                    {v.category}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right text-[var(--text-secondary)]">{v.trips_count}</td>
                              <td className="px-4 py-2.5 text-right text-[var(--text-secondary)]">{v.total_hours_booked}h</td>
                              <td className="px-4 py-2.5 min-w-[140px]">
                                <UtilizationBar pct={v.utilization_pct} />
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
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs font-semibold w-10 text-right ${pct < 60 ? 'text-red-600' : 'text-[var(--text-secondary)]'}`}>{pct}%</span>
    </div>
  );
}

function RouteMapOverlay({ comparison, routeInsight }: { comparison: RouteComparison; routeInsight: FleetInsight | null }) {
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
    markers.push({
      id: 'planned-start',
      position: [first.lat, first.lng],
      label: 'First Stop',
      description: 'First stop on the planned office route.',
      color: '#22c55e',
      type: 'pickup',
    });
    markers.push({
      id: 'planned-end',
      position: [last.lat, last.lng],
      label: 'Last Stop',
      description: 'Last stop on the planned office route.',
      color: '#ef4444',
      type: 'dropoff',
    });
  }
  // Driver's real GPS trail start/end — usually differs from the planned
  // first/last stop, since the driver starts from (and returns to) their
  // own location, not the office route itself.
  if (comparison.actual_points.length > 0) {
    const departed = comparison.actual_points[0];
    const arrived = comparison.actual_points[comparison.actual_points.length - 1];
    markers.push({
      id: 'actual-start',
      position: [departed.lat, departed.lng],
      label: 'Departed',
      description: 'Where the driver actually started this trip (GPS).',
      color: '#f97316',
      type: 'actual-start',
    });
    markers.push({
      id: 'actual-end',
      position: [arrived.lat, arrived.lng],
      label: 'Arrived',
      description: 'Where the driver actually ended this trip (GPS).',
      color: '#c2410c',
      type: 'actual-end',
    });
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
          <div className="flex items-center justify-center h-full bg-[var(--bg-subtle)] text-sm text-[var(--text-muted)]">
            No polyline data recorded for this trip.
          </div>
        )}
      </div>
      <div className="w-full lg:w-64 p-4 border-t lg:border-t-0 lg:border-l border-[var(--border-default)] flex flex-col gap-4">
        {detour !== null && (
          <div className={`rounded-lg px-3 py-2.5 text-center ${detour > 1.15 ? 'bg-red-50 border border-red-200' : detour > 1.05 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
            <p className="text-xs text-[var(--text-muted)] mb-0.5">Detour Ratio</p>
            <p className={`text-2xl font-bold ${detour > 1.15 ? 'text-red-600' : detour > 1.05 ? 'text-orange-600' : 'text-green-600'}`}>
              {detour.toFixed(2)}×
            </p>
            {detourPct && <p className="text-xs text-[var(--text-muted)]">+{detourPct}% extra distance</p>}
          </div>
        )}
        <div className="space-y-2 text-sm">
          {m?.planned_distance_km != null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--text-muted)]"><span className="inline-block h-2 w-4 rounded-sm bg-blue-600" /> Planned</span>
              <span className="font-medium">{m.planned_distance_km.toFixed(2)} km</span>
            </div>
          )}
          {m?.actual_distance_km != null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--text-muted)]"><span className="inline-block h-2 w-4 rounded-sm bg-orange-500" /> Actual</span>
              <span className="font-medium">{m.actual_distance_km.toFixed(2)} km</span>
            </div>
          )}
          {comparison.idle_minutes != null && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Idle time</span>
              <span className="font-medium">{comparison.idle_minutes.toFixed(0)} min</span>
            </div>
          )}
          {m?.fuel_variance_pct != null && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Fuel variance</span>
              <span className={`font-medium ${Math.abs(m.fuel_variance_pct) > 15 ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>
                {m.fuel_variance_pct > 0 ? '+' : ''}{m.fuel_variance_pct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        {routeInsight && (
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Navigation className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-xs font-semibold text-purple-800">AI Note</span>
            </div>
            <p className="text-xs text-purple-700">{routeInsight.data.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, good }: { label: string; value: string; icon: React.ReactNode; good?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-[var(--text-muted)]">{label}</span></div>
      <p className={`text-2xl font-bold ${good === false ? 'text-orange-600' : 'text-[var(--text-primary)]'}`}>{value}</p>
    </div>
  );
}


