'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { apiClient } from '@/app/lib/services/api-client';
import { useAuth } from '@/app/lib/contexts/auth-context';
import {
  AlertTriangle, Fuel, Bus, Navigation, TrendingDown, TrendingUp, Zap, RefreshCw, Map as MapIcon,
  Users, Package, CarFront, Lock, Car, Sparkles,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EmptyState,
  FilterBar,
  FilterField,
  Input,
  KpiSkeleton,
  LoadingBlock,
  SectionHeader,
  Select,
  Skeleton,
  StatStrip,
  type BadgeTone,
  type DataTableColumn,
  type StatItem,
} from '@/app/admin/ui';
import { useChartTheme } from '@/app/admin/ui/chart-theme';
import { formatCurrency, formatDate, formatNumber, humanize } from '@/app/admin/lib/format';
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

const SEVERITY_TONE: Record<FleetInsight['severity'], BadgeTone> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'neutral',
};

const SEVERITY_TILE: Record<FleetInsight['severity'], string> = {
  CRITICAL: 'bg-danger-soft text-danger-ink',
  HIGH: 'bg-warning-soft text-warning-ink',
  MEDIUM: 'bg-info-soft text-info-ink',
  LOW: 'bg-subtle text-fg-muted',
};

function insightIcon(type: string) {
  if (type === 'FUEL_LEAKAGE') return <Fuel />;
  if (type === 'OCCUPANCY') return <Bus />;
  if (type === 'CHAUFFEUR_DETOUR' || type === 'ROUTE_DETOUR') return <Navigation />;
  if (type === 'IDLE_TIME') return <Zap />;
  if (type === 'CHAUFFEUR_PACKAGE_UNDERUTILIZATION') return <Package />;
  if (type === 'CHAUFFEUR_CONCURRENT') return <Users />;
  if (type === 'POOL_UTILIZATION') return <Car />;
  return <AlertTriangle />;
}

/** Colour a table figure only when it crosses its threshold. */
function toneText(level: 'danger' | 'warning' | null) {
  return level === 'danger' ? 'text-danger-ink font-medium' : level === 'warning' ? 'text-warning-ink font-medium' : 'text-fg';
}

function InsightCard({ insight }: { insight: FleetInsight }) {
  const saving = insight.estimated_saving_pkr ? parseFloat(insight.estimated_saving_pkr) : 0;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-subtle/40 p-4">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4 ${SEVERITY_TILE[insight.severity]}`}>
        {insightIcon(insight.insight_type)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
            {humanize(insight.insight_type)}
          </span>
          <Badge tone={SEVERITY_TONE[insight.severity]} size="sm" dot>
            {humanize(insight.severity)}
          </Badge>
        </div>
        <p className="text-sm font-medium text-fg">{insight.data.summary}</p>
        <p className="mt-1 text-xs text-fg-secondary">{insight.data.recommendation}</p>
        {saving > 0 && (
          <p className="mt-2 text-xs font-medium text-success-ink tabular-nums">
            Est. saving: {formatCurrency(saving)} / month
          </p>
        )}
      </div>
    </div>
  );
}

function InsightsCard({ title, insights, emptyLabel }: { title: string; insights: FleetInsight[]; emptyLabel: string }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" aria-hidden="true" />
            {title}
          </span>
        }
        description={insights.length > 0 ? `${insights.length} active` : undefined}
      />
      {insights.length === 0 ? (
        <EmptyState compact icon={<Sparkles aria-hidden="true" />} title="No active insights" description={emptyLabel} />
      ) : (
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {insights.map(i => <InsightCard key={i.id} insight={i} />)}
        </CardContent>
      )}
    </Card>
  );
}

function ServiceTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-subtle text-fg-secondary [&_svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  );
}

function ModeBadge({ aiEnabled }: { aiEnabled: boolean }) {
  return (
    <Badge tone={aiEnabled ? 'success' : 'info'} dot>
      {aiEnabled ? 'Active' : 'Metrics only'}
    </Badge>
  );
}

function DisabledSection({ label }: { label: string }) {
  return (
    <Card>
      <EmptyState
        compact
        icon={<Lock aria-hidden="true" />}
        title={label}
        description="Enable the service and AI Insights for this company to unlock."
      />
    </Card>
  );
}

function FleetSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <LoadingBlock label="Loading fleet metrics…" className="sr-only" />
      {[0, 1].map(s => (
        <div key={s} className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map(i => <KpiSkeleton key={i} />)}
          </div>
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

// ── SHUTTLE_INSIGHTS_TYPES ────────────────────────────────────────────────────

const SHUTTLE_INSIGHT_TYPES = new Set(['FUEL_LEAKAGE', 'OCCUPANCY', 'ROUTE_DETOUR', 'IDLE_TIME']);
const CHAUFFEUR_INSIGHT_TYPES = new Set(['CHAUFFEUR_DETOUR', 'CHAUFFEUR_PACKAGE_UNDERUTILIZATION', 'CHAUFFEUR_CONCURRENT']);
const POOL_INSIGHT_TYPES = new Set(['POOL_UTILIZATION']);

// ── Component ─────────────────────────────────────────────────────────────────

export function FleetEfficiencyPanel({ companyId }: { companyId: number }) {
  const { isSuperAdmin } = useAuth();
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

  const clearFilters = () => {
    setFromDateDraft('');
    setToDateDraft('');
    setFromDate('');
    setToDate('');
    setSelectedVehicleId('');
  };

  const dateFilterDirty = fromDateDraft !== fromDate || toDateDraft !== toDate;
  const dateFilterActive = fromDate !== '' || toDate !== '';
  const vehicleFilterActive = selectedVehicleId !== '';
  const activeFilterCount = (dateFilterActive || dateFilterDirty ? 1 : 0) + (vehicleFilterActive ? 1 : 0);

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

  if (loading) return <FleetSkeleton />;

  const shuttleInsights = insights.filter(i => SHUTTLE_INSIGHT_TYPES.has(i.insight_type));
  const chauffeurInsights = insights.filter(i => CHAUFFEUR_INSIGHT_TYPES.has(i.insight_type));
  const poolInsights = insights.filter(i => POOL_INSIGHT_TYPES.has(i.insight_type));
  // Generating insights is super-admin only on the API
  const showGenerate = isSuperAdmin && aiEnabled && (shuttleEnabled || chauffeurEnabled || poolEnabled);

  // ── Shuttle ────────────────────────────────────────────────────────────────

  const shuttleStats: StatItem[] = summary
    ? [
        { key: 'trips', label: 'Trips analysed', value: formatNumber(summary.count) },
        {
          key: 'occupancy',
          label: 'Avg occupancy',
          value: `${summary.avgOccupancy.toFixed(1)}%`,
          hint: summary.avgOccupancy >= 70 ? <span className="inline-flex items-center gap-1"><TrendingUp className="size-3.5" aria-hidden="true" />On target</span> : <span className="inline-flex items-center gap-1"><TrendingDown className="size-3.5" aria-hidden="true" />Below 70% target</span>,
          status: summary.avgOccupancy >= 70 ? 'none' : 'warning',
        },
        {
          key: 'detour',
          label: 'Avg detour ratio',
          value: summary.avgDetour ? `${summary.avgDetour.toFixed(2)}×` : '—',
          status: !summary.avgDetour || summary.avgDetour < 1.1 ? 'none' : 'warning',
        },
        {
          key: 'idle',
          label: 'Total idle (min)',
          value: formatNumber(Math.round(summary.totalIdleMin)),
          status: summary.totalIdleMin < 300 ? 'none' : 'warning',
        },
      ]
    : [];

  const fuelColumns: DataTableColumn<FuelFlag>[] = [
    { key: 'vehicle', header: 'Vehicle', cell: f => <span className="font-medium">{f.vehicles?.plate_number ?? f.vehicle_id}</span> },
    { key: 'date', header: 'Date', cell: f => <span className="text-fg-secondary">{formatDate(f.flag_date)}</span> },
    {
      key: 'variance',
      header: 'Variance',
      align: 'right',
      mono: true,
      cell: f => <span className={toneText(parseFloat(f.variance_pct) > 20 ? 'danger' : 'warning')}>{pct(f.variance_pct)}</span>,
    },
    { key: 'actual', header: 'Actual (L)', align: 'right', mono: true, cell: f => fmt(f.actual_litres) },
    { key: 'expected', header: 'Expected (L)', align: 'right', mono: true, cell: f => fmt(f.expected_litres) },
    { key: 'streak', header: 'Streak', align: 'right', mono: true, cell: f => <span className="text-fg-secondary">{f.consecutive_days}d</span> },
  ];

  const tripColumns: DataTableColumn<ShuttleMetric>[] = [
    { key: 'date', header: 'Date', cell: m => formatDate(m.trip_date) },
    {
      key: 'direction',
      header: 'Direction',
      hideBelow: 'sm',
      cell: m => <Badge tone="neutral" size="sm">{humanize(m.direction)}</Badge>,
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      cell: m => (
        <>
          <div className="font-medium text-fg">{m.vehicles?.plate_number ?? '—'}</div>
          {(m.vehicles?.make || m.vehicles?.model) && (
            <div className="text-xs text-fg-muted">{[m.vehicles?.make, m.vehicles?.model].filter(Boolean).join(' ')}</div>
          )}
        </>
      ),
    },
    { key: 'driver', header: 'Driver', hideBelow: 'md', cell: m => <span className="text-fg-secondary">{m.shuttle_trips?.users?.full_name ?? '—'}</span> },
    {
      key: 'occupancy',
      header: 'Occupancy',
      align: 'right',
      mono: true,
      cell: m => <span className={toneText(m.occupancy_pct && parseFloat(m.occupancy_pct) < 50 ? 'warning' : null)}>{pct(m.occupancy_pct)}</span>,
    },
    {
      key: 'detour',
      header: 'Detour',
      align: 'right',
      mono: true,
      cell: m => (
        <span className={toneText(m.detour_ratio && parseFloat(m.detour_ratio) > 1.2 ? 'danger' : null)}>
          {m.detour_ratio ? `${fmt(m.detour_ratio, 2)}×` : '—'}
        </span>
      ),
    },
    { key: 'idle', header: 'Idle (min)', align: 'right', mono: true, hideBelow: 'lg', cell: m => <span className="text-fg-secondary">{fmt(m.idle_minutes, 0)}</span> },
    {
      key: 'fuel',
      header: 'Fuel var.',
      align: 'right',
      mono: true,
      hideBelow: 'lg',
      cell: m => <span className={toneText(m.fuel_variance_pct && Math.abs(parseFloat(m.fuel_variance_pct)) > 15 ? 'danger' : null)}>{pct(m.fuel_variance_pct)}</span>,
    },
  ];

  // ── Chauffeur ──────────────────────────────────────────────────────────────

  const underutilisedBookings = chauffeurUtil
    ? chauffeurUtil.bookings.filter(b => (b.utilization_pct ?? 100) < 70).slice(0, 10)
    : [];

  const chauffeurStats: StatItem[] = chauffeurUtil
    ? [
        { key: 'bookings', label: 'Total bookings', value: formatNumber(chauffeurUtil.summary.total_bookings) },
        {
          key: 'avg',
          label: 'Avg utilization',
          value: chauffeurUtil.summary.avg_utilization_pct != null ? `${chauffeurUtil.summary.avg_utilization_pct}%` : '—',
          status: chauffeurUtil.summary.avg_utilization_pct != null && chauffeurUtil.summary.avg_utilization_pct >= 70 ? 'none' : 'warning',
        },
        {
          key: 'under',
          label: 'Underutilized (<70%)',
          value: formatNumber(chauffeurUtil.summary.underutilized_count),
          status: chauffeurUtil.summary.underutilized_count === 0 ? 'none' : 'warning',
        },
        {
          key: 'saving',
          label: 'Est. billing saving',
          value: chauffeurUtil.summary.total_estimated_saving_pkr > 0 ? formatCurrency(chauffeurUtil.summary.total_estimated_saving_pkr) : '—',
        },
      ]
    : [];

  const chauffeurColumns: DataTableColumn<ChauffeurUtilizationRow>[] = [
    { key: 'booking', header: 'Booking', cell: b => <span className="font-medium">#{b.booking_id}</span> },
    {
      key: 'package',
      header: 'Package',
      cell: b => <Badge tone="info" size="sm">{b.package_selected?.replace('HOURS_', '') ?? '—'}h</Badge>,
    },
    { key: 'date', header: 'Date', hideBelow: 'sm', cell: b => <span className="text-fg-secondary">{formatDate(b.scheduled_for)}</span> },
    {
      key: 'used',
      header: 'Used',
      align: 'right',
      mono: true,
      cell: b => <span className="text-fg-secondary">{b.used_minutes != null ? `${(b.used_minutes / 60).toFixed(1)}h` : '—'}</span>,
    },
    {
      key: 'utilization',
      header: 'Utilization',
      width: '11rem',
      cell: b => (b.utilization_pct != null ? <UtilizationBar pct={b.utilization_pct} /> : '—'),
    },
    {
      key: 'saving',
      header: 'Est. saving',
      align: 'right',
      mono: true,
      cell: b => (
        b.estimated_saving_pkr != null && b.estimated_saving_pkr > 0
          ? <span className="font-medium text-success-ink">{formatCurrency(b.estimated_saving_pkr)}</span>
          : '—'
      ),
    },
  ];

  // ── Pool ───────────────────────────────────────────────────────────────────

  const poolStats: StatItem[] = poolUtil
    ? [
        { key: 'vehicles', label: 'Pool vehicles', value: formatNumber(poolUtil.summary.total_pool_vehicles) },
        {
          key: 'avg',
          label: 'Avg utilization',
          value: `${poolUtil.summary.avg_utilization_pct}%`,
          status: poolUtil.summary.avg_utilization_pct >= 30 ? 'none' : 'warning',
        },
        {
          key: 'idle',
          label: 'Idle vehicles',
          value: formatNumber(poolUtil.summary.idle_vehicle_count),
          status: poolUtil.summary.idle_vehicle_count === 0 ? 'none' : 'warning',
        },
        {
          key: 'under',
          label: 'Underutilized (<30%)',
          value: formatNumber(poolUtil.summary.underutilized_count),
          status: poolUtil.summary.underutilized_count === 0 ? 'none' : 'danger',
        },
      ]
    : [];

  const poolColumns: DataTableColumn<PoolVehicleRow>[] = [
    {
      key: 'vehicle',
      header: 'Vehicle',
      cell: v => (
        <>
          <div className="font-medium text-fg">{v.plate_number}</div>
          {(v.make || v.model) && <div className="text-xs text-fg-muted">{[v.make, v.model].filter(Boolean).join(' ')}</div>}
        </>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      hideBelow: 'sm',
      cell: v => (v.category ? <Badge tone="purple" size="sm">{v.category}</Badge> : '—'),
    },
    { key: 'trips', header: 'Trips', align: 'right', mono: true, cell: v => <span className="text-fg-secondary">{v.trips_count}</span> },
    { key: 'hours', header: 'Hours used', align: 'right', mono: true, cell: v => <span className="text-fg-secondary">{v.total_hours_booked}h</span> },
    { key: 'utilization', header: 'Utilization', width: '11rem', cell: v => <UtilizationBar pct={v.utilization_pct} /> },
  ];

  const emptyTripsTitle = vehicleFilterActive
    ? 'No trips for the selected vehicle'
    : dateFilterActive
      ? 'No trips in this date range'
      : 'No shuttle trips recorded yet';

  return (
    <div className="space-y-10">
      {showGenerate && (
        <div className="flex flex-col gap-3 rounded-2xl border border-brand-line bg-brand-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-fg">AI fleet analysis</p>
              <p className="text-xs text-fg-secondary">Regenerates insights for every enabled service below.</p>
            </div>
          </div>
          <Button
            onClick={triggerGenerate}
            loading={generating}
            leftIcon={<RefreshCw />}
            className="self-start sm:self-auto"
          >
            {generating ? 'Generating…' : 'Run AI analysis'}
          </Button>
        </div>
      )}

      {/* ══ Shuttle ══════════════════════════════════════════════════════════ */}
      <section className="space-y-4" aria-label="Shuttle analytics">
        <SectionHeader
          title={<ServiceTitle icon={<Bus />} label="Shuttle analytics" />}
          description="Occupancy, detour and fuel performance across shuttle trips."
          actions={shuttleEnabled ? <ModeBadge aiEnabled={aiEnabled} /> : undefined}
        />

        {!shuttleEnabled ? (
          <DisabledSection label="Shuttle service must be enabled" />
        ) : (
          <div className="space-y-4">
            {summary && <StatStrip aria-label="Shuttle summary" items={shuttleStats} />}

            {aiEnabled && (
              <InsightsCard
                title="AI insights — Shuttle"
                insights={shuttleInsights}
                emptyLabel='Click "Run AI analysis" to generate shuttle insights.'
              />
            )}

            {fuelFlags.length > 0 && (
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Fuel className="size-4 text-fg-muted" aria-hidden="true" />
                      Flagged fuel variance
                      <Badge tone="danger" size="sm">{fuelFlags.length} flagged</Badge>
                    </span>
                  }
                  description="Flagged when (actual − expected) / expected > 15% for 3+ consecutive days."
                />
                <DataTable
                  rows={fuelFlags.slice(0, 8)}
                  columns={fuelColumns}
                  rowKey={f => f.id}
                  density="compact"
                  caption="Flagged fuel variance"
                />
              </Card>
            )}

            <Card>
              <CardHeader
                title="Recent shuttle trips"
                description="Expand a trip to compare its planned and actual route."
              />
              <CardContent className="border-b border-line py-3">
                <FilterBar activeCount={activeFilterCount} onClear={clearFilters}>
                  <FilterField label="Vehicle">
                    <Select
                      width="auto"
                      value={selectedVehicleId}
                      onChange={e => setSelectedVehicleId(e.target.value)}
                      placeholder="All vehicles"
                    >
                      {vehicleOptions.map(([id, plate]) => (
                        <option key={id} value={id}>{plate}</option>
                      ))}
                    </Select>
                  </FilterField>
                  <FilterField label="From">
                    <Input
                      type="date"
                      value={fromDateDraft}
                      max={toDateDraft || undefined}
                      onChange={e => setFromDateDraft(e.target.value)}
                    />
                  </FilterField>
                  <FilterField label="To">
                    <Input
                      type="date"
                      value={toDateDraft}
                      min={fromDateDraft || undefined}
                      onChange={e => setToDateDraft(e.target.value)}
                    />
                  </FilterField>
                  <Button variant="secondary" onClick={applyDateFilter} disabled={!dateFilterDirty}>
                    Apply
                  </Button>
                </FilterBar>
              </CardContent>
              <DataTable
                rows={recentMetrics}
                columns={tripColumns}
                rowKey={m => m.id}
                caption="Recent shuttle trips"
                empty={{ icon: <Bus aria-hidden="true" />, title: emptyTripsTitle }}
                expandable={{
                  isExpanded: m => selectedTripForMap === m.shuttle_trip_id,
                  onToggle: m => void loadRouteComparison(m.shuttle_trip_id, m.route_id),
                  render: () => (
                    <RouteMapPanel
                      loading={mapLoading}
                      comparison={routeComparison}
                      routeInsight={shuttleInsights.find(i => i.insight_type === 'ROUTE_DETOUR' && i.route_id === selectedRouteId) ?? null}
                    />
                  ),
                }}
              />
            </Card>
          </div>
        )}
      </section>

      {/* ══ Chauffeur ════════════════════════════════════════════════════════ */}
      <section className="space-y-4" aria-label="Chauffeur analytics">
        <SectionHeader
          title={<ServiceTitle icon={<CarFront />} label="Chauffeur analytics" />}
          description="How much of each booked package is actually used."
          actions={chauffeurEnabled ? <ModeBadge aiEnabled={aiEnabled} /> : undefined}
        />

        {!chauffeurEnabled ? (
          <DisabledSection label="Chauffeur service must be enabled" />
        ) : (
          <div className="space-y-4">
            {chauffeurUtil && <StatStrip aria-label="Chauffeur summary" items={chauffeurStats} />}

            {aiEnabled && (
              <InsightsCard
                title="AI insights — Chauffeur"
                insights={chauffeurInsights}
                emptyLabel='Click "Run AI analysis" to generate chauffeur insights.'
              />
            )}

            {underutilisedBookings.length > 0 && (
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Package className="size-4 text-fg-muted" aria-hidden="true" />
                      Underutilised bookings
                    </span>
                  }
                  description="Used less than 70% of package hours — consider a smaller package."
                />
                <DataTable
                  rows={underutilisedBookings}
                  columns={chauffeurColumns}
                  rowKey={b => b.booking_id}
                  density="compact"
                  caption="Underutilised chauffeur bookings"
                />
              </Card>
            )}
          </div>
        )}
      </section>

      {/* ══ Pool fleet ═══════════════════════════════════════════════════════ */}
      <section className="space-y-4" aria-label="Pool fleet analytics">
        <SectionHeader
          title={<ServiceTitle icon={<Car />} label="Pool fleet analytics" />}
          description="Utilisation of the company's own pooled vehicles."
          actions={poolEnabled ? <ModeBadge aiEnabled={aiEnabled} /> : undefined}
        />

        {!poolEnabled ? (
          <DisabledSection label="Pool Fleet service must be enabled" />
        ) : (
          <div className="space-y-4">
            {poolUtil && <StatStrip aria-label="Pool fleet summary" items={poolStats} />}

            {aiEnabled && (
              <InsightsCard
                title="AI insights — Pool fleet"
                insights={poolInsights}
                emptyLabel='Click "Run AI analysis" to generate pool fleet insights.'
              />
            )}

            {poolUtil && poolUtil.vehicles.length > 0 && (
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Car className="size-4 text-fg-muted" aria-hidden="true" />
                      Pool vehicle utilization
                    </span>
                  }
                  description="Last 30 days — 300 available hours per vehicle."
                />
                <DataTable
                  rows={poolUtil.vehicles}
                  columns={poolColumns}
                  rowKey={v => v.vehicle_id}
                  density="compact"
                  caption="Pool vehicle utilization"
                />
              </Card>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UtilizationBar({ pct }: { pct: number }) {
  const bar = pct >= 80 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-valuenow={Math.min(100, pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Utilization"
      >
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`w-10 text-right text-xs font-semibold tabular-nums ${pct < 60 ? 'text-danger-ink' : 'text-fg-secondary'}`}>{pct}%</span>
    </div>
  );
}

function LegendSwatch({ color, shape = 'line', label }: { color: string; shape?: 'line' | 'dot'; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={shape === 'line' ? 'inline-block h-1 w-5 rounded-full' : 'inline-block size-2.5 rounded-full'}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function RouteMapPanel({ loading, comparison, routeInsight }: { loading: boolean; comparison: RouteComparison | null; routeInsight: FleetInsight | null }) {
  if (loading) return <LoadingBlock label="Loading route data…" className="h-64" />;
  if (!comparison) {
    return <EmptyState compact icon={<MapIcon aria-hidden="true" />} title="No route data available for this trip" />;
  }
  return <RouteMapOverlay comparison={comparison} routeInsight={routeInsight} />;
}

function RouteMapOverlay({ comparison, routeInsight }: { comparison: RouteComparison; routeInsight: FleetInsight | null }) {
  const chart = useChartTheme();
  // Map layers need literal colours (Google Maps can't read CSS variables); take them from the
  // theme-aware chart palette so they match the legend and both themes.
  const plannedColor = chart.colors[1];
  const actualColor = chart.colors[0];
  const arrivedColor = chart.status.bad;
  const startColor = chart.status.good;

  const plannedPolyline: MapPolyline | null = comparison.planned_points.length > 1
    ? { positions: comparison.planned_points.map(p => [p.lat, p.lng] as [number, number]), color: plannedColor, weight: 4, opacity: 0.85 }
    : null;
  const actualPolyline: MapPolyline | null = comparison.actual_points.length > 1
    ? { positions: comparison.actual_points.map(p => [p.lat, p.lng] as [number, number]), color: actualColor, weight: 3, opacity: 0.9, dashArray: '6 4' }
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
      color: startColor,
      type: 'pickup',
    });
    markers.push({
      id: 'planned-end',
      position: [last.lat, last.lng],
      label: 'Last Stop',
      description: 'Last stop on the planned office route.',
      color: arrivedColor,
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
      color: actualColor,
      type: 'actual-start',
    });
    markers.push({
      id: 'actual-end',
      position: [arrived.lat, arrived.lng],
      label: 'Arrived',
      description: 'Where the driver actually ended this trip (GPS).',
      color: actualColor,
      type: 'actual-end',
    });
  }

  const m = comparison.metrics;
  const detour = m?.detour_ratio ?? null;
  const detourPct = detour !== null ? ((detour - 1) * 100).toFixed(1) : null;
  const detourTone: 'danger' | 'warning' | 'success' = detour !== null && detour > 1.15 ? 'danger' : detour !== null && detour > 1.05 ? 'warning' : 'success';
  const detourCls = {
    danger: 'border-danger-line bg-danger-soft text-danger-ink',
    warning: 'border-warning-line bg-warning-soft text-warning-ink',
    success: 'border-success-line bg-success-soft text-success-ink',
  }[detourTone];

  return (
    <div className="bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-fg">
          <MapIcon className="size-4 text-fg-muted" aria-hidden="true" />
          Route overlay
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          <LegendSwatch color={plannedColor} label="Planned" />
          <LegendSwatch color={actualColor} label="Actual" />
          <LegendSwatch color={actualColor} shape="dot" label="Departed / arrived" />
        </span>
      </div>
      <div className="flex flex-col lg:flex-row">
        <div className="min-h-0 flex-1" style={{ height: 360 }}>
          {polylines.length > 0 || markers.length > 0 ? (
            <Map markers={markers} polylines={polylines} height="360px" />
          ) : (
            <EmptyState compact icon={<MapIcon aria-hidden="true" />} title="No polyline data recorded for this trip" className="h-full" />
          )}
        </div>
        <div className="flex w-full flex-col gap-4 border-t border-line p-4 lg:w-64 lg:border-l lg:border-t-0">
          {detour !== null && (
            <div className={`rounded-xl border px-3 py-2.5 text-center ${detourCls}`}>
              <p className="mb-0.5 text-xs">Detour ratio</p>
              <p className="text-2xl font-semibold tabular-nums">{detour.toFixed(2)}×</p>
              {detourPct && <p className="text-xs">+{detourPct}% extra distance</p>}
            </div>
          )}
          <dl className="space-y-2 text-sm">
            {m?.planned_distance_km != null && (
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-fg-muted"><LegendSwatch color={plannedColor} label="Planned" /></dt>
                <dd className="font-medium text-fg tabular-nums">{m.planned_distance_km.toFixed(2)} km</dd>
              </div>
            )}
            {m?.actual_distance_km != null && (
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-fg-muted"><LegendSwatch color={actualColor} label="Actual" /></dt>
                <dd className="font-medium text-fg tabular-nums">{m.actual_distance_km.toFixed(2)} km</dd>
              </div>
            )}
            {comparison.idle_minutes != null && (
              <div className="flex items-center justify-between">
                <dt className="text-fg-muted">Idle time</dt>
                <dd className="font-medium text-fg tabular-nums">{comparison.idle_minutes.toFixed(0)} min</dd>
              </div>
            )}
            {m?.fuel_variance_pct != null && (
              <div className="flex items-center justify-between">
                <dt className="text-fg-muted">Fuel variance</dt>
                <dd className={`font-medium tabular-nums ${Math.abs(m.fuel_variance_pct) > 15 ? 'text-danger-ink' : 'text-fg'}`}>
                  {m.fuel_variance_pct > 0 ? '+' : ''}{m.fuel_variance_pct.toFixed(1)}%
                </dd>
              </div>
            )}
          </dl>
          {routeInsight && (
            <div className="rounded-xl border border-purple-line bg-purple-soft p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Navigation className="size-3.5 text-purple-ink" aria-hidden="true" />
                <span className="text-xs font-semibold text-purple-ink">AI note</span>
              </div>
              <p className="text-xs text-fg-secondary">{routeInsight.data.recommendation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
