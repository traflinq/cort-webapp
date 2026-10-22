"use client";

/**
 * Fleet efficiency analytics shared by the admin company page and the company portal.
 * The caller supplies the endpoints (admin: /admin/companies/:id/*, company: /company/*),
 * the enabled services and, optionally, translated labels. Data fetching and rendering live here.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Bus, Car, CarFront, Clock, Fuel, Lock, Map as MapIcon, Navigation, Package, TrendingDown, TrendingUp, Users, X, Zap } from "lucide-react";
import { apiClient } from "@/app/lib/services/api-client";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  DateRangePicker,
  EmptyState,
  ErrorState,
  FilterBar,
  FilterField,
  IconButton,
  KpiCard,
  KpiGrid,
  LoadingBlock,
  SectionHeader,
  Select,
  StatusBadge,
  useFormatters,
  type DataTableColumn,
  type DateRange,
} from "@/app/ui";
import type { MapMarker, MapPolyline } from "@/app/ui/Map";

const Map = dynamic(() => import("@/app/ui/Map"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

type ShuttleMetricsSummary = { count: number; avgOccupancy: number; avgDetour: number; totalIdleMin: number };

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

export type FleetInsight = {
  id: number;
  insight_type: string;
  vehicle_id: number | null;
  route_id: number | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  estimated_saving_pkr: string;
  data: { summary: string; recommendation: string; metric_value?: number | string | null };
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

type ChauffeurUtilizationSummary = { total_bookings: number; avg_utilization_pct: number | null; underutilized_count: number; total_estimated_saving_pkr: number };

export type PoolVehicleRow = {
  vehicle_id: number;
  plate_number: string;
  make: string | null;
  model: string | null;
  category: string | null;
  trips_count: number;
  total_hours_booked: number;
  utilization_pct: number;
};

export type PoolUtilizationSummary = { total_pool_vehicles: number; avg_utilization_pct: number; idle_vehicle_count: number; underutilized_count: number };

export interface FleetEndpoints {
  /** Accepts the optional `?from=&to=` query string. */
  metrics: (query: string) => string;
  fuelVariance: string;
  insights: string;
  generateInsights: string;
  chauffeurUtilization: string;
  poolUtilization: string;
  routeComparison: (shuttleTripId: number) => string;
}

export interface FleetLabels {
  loading: string;
  loadFailed: string;
  shuttleAnalytics: string;
  chauffeurAnalytics: string;
  poolAnalytics: string;
  active: string;
  metricsOnly: string;
  runAiAnalysis: string;
  generating: string;
  shuttleDisabled: string;
  chauffeurDisabled: string;
  poolDisabled: string;
  disabledHint: string;
  tripsAnalysed: string;
  avgOccupancy: string;
  avgDetourRatio: string;
  totalIdleMin: string;
  aiInsightsShuttle: string;
  aiInsightsChauffeur: string;
  aiInsightsPool: string;
  noShuttleInsights: string;
  noChauffeurInsights: string;
  noPoolInsights: string;
  flaggedFuelVariance: string;
  flagged: (count: number) => string;
  fuelVarianceNote: string;
  vehicle: string;
  date: string;
  variance: string;
  actualL: string;
  expectedL: string;
  streak: string;
  recentShuttleTrips: string;
  allVehicles: string;
  dir: string;
  driver: string;
  occupancy: string;
  detour: string;
  idleMin: string;
  fuelVar: string;
  route: string;
  view: string;
  close: string;
  noTripsForVehicle: string;
  noTripsForDates: string;
  noTrips: string;
  routeMapOverlay: string;
  planned: string;
  actual: string;
  departed: string;
  arrived: string;
  loadingRouteData: string;
  noRouteData: string;
  noPolylineData: string;
  detourRatio: string;
  extraDistance: (percent: string) => string;
  idleTime: string;
  fuelVariance: string;
  aiNote: string;
  totalBookings: string;
  avgUtilization: string;
  underutilizedBookings: string;
  underutilizedHint: string;
  underutilized70: string;
  estBillingSaving: string;
  booking: string;
  package: string;
  used: string;
  utilization: string;
  estSaving: string;
  estSavingMonth: (amount: string) => string;
  poolVehicles: string;
  idleVehicles: string;
  underutilized30: string;
  poolVehicleUtilization: string;
  poolUtilizationHint: string;
  category: string;
  trips: string;
  hoursUsed: string;
  firstStop: string;
  lastStop: string;
  firstStopDescription: string;
  lastStopDescription: string;
  departedDescription: string;
  arrivedDescription: string;
}

export const FLEET_LABELS_EN: FleetLabels = {
  loading: "Loading fleet metrics…",
  loadFailed: "Fleet metrics could not be loaded.",
  shuttleAnalytics: "Shuttle Analytics",
  chauffeurAnalytics: "Chauffeur Analytics",
  poolAnalytics: "Pool Fleet Analytics",
  active: "Active",
  metricsOnly: "Metrics Only",
  runAiAnalysis: "Run AI Analysis",
  generating: "Generating…",
  shuttleDisabled: "Shuttle service must be enabled",
  chauffeurDisabled: "Chauffeur service must be enabled",
  poolDisabled: "Pool Fleet service must be enabled",
  disabledHint: "Enable the service and AI Insights for this company to unlock.",
  tripsAnalysed: "Trips analysed",
  avgOccupancy: "Avg occupancy",
  avgDetourRatio: "Avg detour ratio",
  totalIdleMin: "Total idle (min)",
  aiInsightsShuttle: "AI Insights — Shuttle",
  aiInsightsChauffeur: "AI Insights — Chauffeur",
  aiInsightsPool: "AI Insights — Pool Fleet",
  noShuttleInsights: 'No active shuttle insights. Click "Run AI Analysis" to generate.',
  noChauffeurInsights: 'No active chauffeur insights. Click "Run AI Analysis" to generate.',
  noPoolInsights: 'No active pool fleet insights. Click "Run AI Analysis" to generate.',
  flaggedFuelVariance: "Flagged Fuel Variance",
  flagged: (n) => `${n} flagged`,
  fuelVarianceNote: "Flagged when (actual − expected) / expected > 15% for 3+ consecutive days.",
  vehicle: "Vehicle",
  date: "Date",
  variance: "Variance",
  actualL: "Actual (L)",
  expectedL: "Expected (L)",
  streak: "Streak",
  recentShuttleTrips: "Recent Shuttle Trips",
  allVehicles: "All vehicles",
  dir: "Dir",
  driver: "Driver",
  occupancy: "Occupancy",
  detour: "Detour",
  idleMin: "Idle (min)",
  fuelVar: "Fuel Var.",
  route: "Route",
  view: "View",
  close: "Close",
  noTripsForVehicle: "No shuttle trips found for the selected vehicle in this date range.",
  noTripsForDates: "No shuttle trips found in the selected date range.",
  noTrips: "No shuttle trips recorded yet.",
  routeMapOverlay: "Route Map Overlay",
  planned: "Planned",
  actual: "Actual",
  departed: "Departed",
  arrived: "Arrived",
  loadingRouteData: "Loading route data…",
  noRouteData: "No route data available for this trip.",
  noPolylineData: "No polyline data recorded for this trip.",
  detourRatio: "Detour Ratio",
  extraDistance: (p) => `+${p}% extra distance`,
  idleTime: "Idle time",
  fuelVariance: "Fuel variance",
  aiNote: "AI Note",
  totalBookings: "Total bookings",
  avgUtilization: "Avg utilization",
  underutilizedBookings: "Underutilised Bookings",
  underutilizedHint: "(used <70% of package hours — consider a smaller package)",
  underutilized70: "Underutilized (<70%)",
  estBillingSaving: "Est. billing saving",
  booking: "Booking",
  package: "Package",
  used: "Used",
  utilization: "Utilization",
  estSaving: "Est. Saving",
  estSavingMonth: (amount) => `Est. saving: ${amount} / month`,
  poolVehicles: "Pool vehicles",
  idleVehicles: "Idle vehicles",
  underutilized30: "Underutilized (<30%)",
  poolVehicleUtilization: "Pool Vehicle Utilization",
  poolUtilizationHint: "(last 30 days — 300 available hours per vehicle)",
  category: "Category",
  trips: "Trips",
  hoursUsed: "Hours Used",
  firstStop: "First Stop",
  lastStop: "Last Stop",
  firstStopDescription: "First stop on the planned office route.",
  lastStopDescription: "Last stop on the planned office route.",
  departedDescription: "Where the driver actually started this trip (GPS).",
  arrivedDescription: "Where the driver actually ended this trip (GPS).",
};

export interface FleetEfficiencyPanelProps {
  endpoints: FleetEndpoints;
  services: { shuttle: boolean; chauffeur: boolean; pool: boolean };
  aiEnabled: boolean;
  labels?: FleetLabels;
  /** Omit the pool section even when the service is on (company portal shows it on the Fleet page). */
  showPool?: boolean;
  /** Map legend / polyline colours. */
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(v: string | number | null | undefined, decimals = 1) {
  if (v == null) return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isNaN(n) ? "—" : n.toFixed(decimals);
}

function pct(v: string | null | undefined) {
  return v == null ? "—" : `${fmtNum(v, 1)}%`;
}

const PLANNED_COLOR = "#2563eb";
const ACTUAL_COLOR = "#f97316";
const ARRIVED_COLOR = "#c2410c";

const SHUTTLE_INSIGHT_TYPES = new Set(["FUEL_LEAKAGE", "OCCUPANCY", "ROUTE_DETOUR", "IDLE_TIME"]);
const CHAUFFEUR_INSIGHT_TYPES = new Set(["CHAUFFEUR_DETOUR", "CHAUFFEUR_PACKAGE_UNDERUTILIZATION", "CHAUFFEUR_CONCURRENT"]);
const POOL_INSIGHT_TYPES = new Set(["POOL_UTILIZATION"]);

function insightIcon(type: string) {
  if (type === "FUEL_LEAKAGE") return <Fuel />;
  if (type === "OCCUPANCY") return <Bus />;
  if (type === "CHAUFFEUR_DETOUR" || type === "ROUTE_DETOUR") return <Navigation />;
  if (type === "IDLE_TIME") return <Zap />;
  if (type === "CHAUFFEUR_PACKAGE_UNDERUTILIZATION") return <Package />;
  if (type === "CHAUFFEUR_CONCURRENT") return <Users />;
  if (type === "POOL_UTILIZATION") return <Car />;
  return <AlertTriangle />;
}

type Tone = "danger" | "warning" | "info" | "success" | "neutral";
const severityTone: Record<FleetInsight["severity"], Tone> = { CRITICAL: "danger", HIGH: "warning", MEDIUM: "warning", LOW: "info" };
const toneBox: Record<Tone, string> = {
  danger: "border-danger-line bg-danger-soft",
  warning: "border-warning-line bg-warning-soft",
  info: "border-info-line bg-info-soft",
  success: "border-success-line bg-success-soft",
  neutral: "border-line bg-subtle",
};
const toneInk: Record<Tone, string> = { danger: "text-danger-ink", warning: "text-warning-ink", info: "text-info-ink", success: "text-success-ink", neutral: "text-fg" };

export function InsightCard({ insight, labels = FLEET_LABELS_EN }: { insight: FleetInsight; labels?: FleetLabels }) {
  const fmt = useFormatters();
  const tone = severityTone[insight.severity] ?? "info";
  const saving = parseFloat(insight.estimated_saving_pkr);
  return (
    <div className={cn("rounded-xl border p-4", toneBox[tone])}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 shrink-0 [&_svg]:size-5", toneInk[tone])}>{insightIcon(insight.insight_type)}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg">{insight.insight_type.replace(/_/g, " ")}</span>
            <StatusBadge status={insight.severity} size="sm" />
          </div>
          <p className="text-sm font-medium text-fg">{insight.data.summary}</p>
          <p className="mt-1 text-xs text-fg-secondary">{insight.data.recommendation}</p>
          {Number.isFinite(saving) && saving > 0 && <p className="mt-2 text-xs font-semibold text-fg">{labels.estSavingMonth(fmt.formatCurrency(saving))}</p>}
        </div>
      </div>
    </div>
  );
}

function DisabledSection({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-subtle px-6 py-8 text-center">
      <Lock className="mx-auto mb-2 size-6 text-fg-muted" aria-hidden="true" />
      <p className="text-sm font-medium text-fg-secondary">{label}</p>
      <p className="mt-1 text-xs text-fg-muted">{hint}</p>
    </div>
  );
}

function SectionTitle({ icon, title, enabled, aiEnabled, labels, actions }: { icon: React.ReactNode; title: string; enabled: boolean; aiEnabled: boolean; labels: FleetLabels; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-fg-muted [&_svg]:size-5">{icon}</span>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {enabled && <Badge tone={aiEnabled ? "success" : "info"}>{aiEnabled ? labels.active : labels.metricsOnly}</Badge>}
      </div>
      {actions}
    </div>
  );
}

export function UtilizationBar({ pct: value, threshold = 60 }: { pct: number; threshold?: number }) {
  const color = value >= 80 ? "bg-success-ink" : value >= threshold ? "bg-warning-ink" : "bg-danger-ink";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className={cn("w-10 text-end text-xs font-semibold tabular-nums", value < threshold ? "text-danger-ink" : "text-fg-secondary")}>{value}%</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FleetEfficiencyPanel({ endpoints, services, aiEnabled, labels: L = FLEET_LABELS_EN, showPool = true, className }: FleetEfficiencyPanelProps) {
  const fmt = useFormatters();
  const { shuttle: shuttleEnabled, chauffeur: chauffeurEnabled, pool: poolEnabled } = services;

  const [summary, setSummary] = useState<ShuttleMetricsSummary | null>(null);
  const [allMetrics, setAllMetrics] = useState<ShuttleMetric[]>([]);
  const [fuelFlags, setFuelFlags] = useState<FuelFlag[]>([]);
  const [range, setRange] = useState<DateRange | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [chauffeurUtil, setChauffeurUtil] = useState<{ summary: ChauffeurUtilizationSummary; bookings: ChauffeurUtilizationRow[] } | null>(null);
  const [poolUtil, setPoolUtil] = useState<{ summary: PoolUtilizationSummary; vehicles: PoolVehicleRow[] } | null>(null);
  const [insights, setInsights] = useState<FleetInsight[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const [selectedTripForMap, setSelectedTripForMap] = useState<number | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [routeComparison, setRouteComparison] = useState<RouteComparison | null>(null);
  const [mapLoading, setMapLoading] = useState(false);

  const fromDate = range?.start ?? "";
  const toDate = range?.end ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateParams = new URLSearchParams();
      if (fromDate) dateParams.set("from", fromDate);
      if (toDate) dateParams.set("to", toDate);
      const dateQuery = dateParams.toString() ? `?${dateParams.toString()}` : "";

      const fetches = await Promise.allSettled([
        shuttleEnabled ? apiClient.request<{ summary: ShuttleMetricsSummary; metrics: ShuttleMetric[] }>(endpoints.metrics(dateQuery)) : Promise.resolve(null),
        shuttleEnabled && aiEnabled ? apiClient.request<FuelFlag[]>(endpoints.fuelVariance) : Promise.resolve(null),
        aiEnabled ? apiClient.request<FleetInsight[]>(endpoints.insights) : Promise.resolve([] as FleetInsight[]),
        chauffeurEnabled ? apiClient.request<{ summary: ChauffeurUtilizationSummary; bookings: ChauffeurUtilizationRow[] }>(endpoints.chauffeurUtilization) : Promise.resolve(null),
        poolEnabled && showPool ? apiClient.request<{ summary: PoolUtilizationSummary; vehicles: PoolVehicleRow[] }>(endpoints.poolUtilization) : Promise.resolve(null),
      ]);
      const [metricsRes, fuelRes, insightsRes, chauffeurRes, poolRes] = fetches;

      if (fetches.every((r) => r.status === "rejected")) {
        const first = fetches.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        throw first?.reason instanceof Error ? first.reason : new Error(L.loadFailed);
      }
      if (metricsRes.status === "fulfilled" && metricsRes.value) {
        setSummary(metricsRes.value.summary);
        setAllMetrics(metricsRes.value.metrics);
      }
      if (fuelRes.status === "fulfilled" && fuelRes.value) setFuelFlags(fuelRes.value);
      if (insightsRes.status === "fulfilled") setInsights(insightsRes.value ?? []);
      if (chauffeurRes.status === "fulfilled" && chauffeurRes.value) setChauffeurUtil(chauffeurRes.value);
      if (poolRes.status === "fulfilled" && poolRes.value) setPoolUtil(poolRes.value);
    } catch (e) {
      setError(e instanceof Error ? e.message : L.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [endpoints, shuttleEnabled, chauffeurEnabled, poolEnabled, aiEnabled, showPool, fromDate, toDate, L.loadFailed]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(id);
  }, [load, retryTick]);

  const loadRouteComparison = useCallback(
    async (shuttleTripId: number, routeId: number | null) => {
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
        setRouteComparison(await apiClient.request<RouteComparison>(endpoints.routeComparison(shuttleTripId)));
      } catch {
        setRouteComparison(null);
      } finally {
        setMapLoading(false);
      }
    },
    [selectedTripForMap, endpoints],
  );

  const triggerGenerate = async () => {
    setGenerating(true);
    try {
      await apiClient.request<{ generated: number }>(endpoints.generateInsights, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : L.loadFailed);
    } finally {
      setGenerating(false);
    }
  };

  const vehicleOptions = useMemo(() => {
    const byId: Record<number, string> = {};
    for (const m of allMetrics) if (m.vehicle_id != null) byId[m.vehicle_id] = m.vehicles?.plate_number ?? `#${m.vehicle_id}`;
    return Object.entries(byId)
      .map(([id, plate]) => [Number(id), plate] as [number, string])
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [allMetrics]);

  const recentMetrics = useMemo(() => {
    const filtered = selectedVehicleId ? allMetrics.filter((m) => String(m.vehicle_id) === selectedVehicleId) : allMetrics;
    return filtered.slice(0, 25);
  }, [allMetrics, selectedVehicleId]);

  const shuttleInsights = insights.filter((i) => SHUTTLE_INSIGHT_TYPES.has(i.insight_type));
  const chauffeurInsights = insights.filter((i) => CHAUFFEUR_INSIGHT_TYPES.has(i.insight_type));
  const poolInsights = insights.filter((i) => POOL_INSIGHT_TYPES.has(i.insight_type));
  const showGenerate = aiEnabled && (shuttleEnabled || chauffeurEnabled || (poolEnabled && showPool));
  const dateFilterActive = !!range;
  const vehicleFilterActive = selectedVehicleId !== "";

  const fuelColumns: DataTableColumn<FuelFlag>[] = [
    { key: "vehicle", header: L.vehicle, cell: (f) => <span className="font-medium text-fg">{f.vehicles?.plate_number ?? f.vehicle_id}</span> },
    { key: "date", header: L.date, cell: (f) => <span className="text-fg-muted">{fmt.formatDate(f.flag_date)}</span> },
    { key: "variance", header: L.variance, align: "right", mono: true, cell: (f) => <span className={cn("font-semibold", parseFloat(f.variance_pct) > 20 ? "text-danger-ink" : "text-warning-ink")}>{pct(f.variance_pct)}</span> },
    { key: "actual", header: L.actualL, align: "right", mono: true, cell: (f) => fmtNum(f.actual_litres) },
    { key: "expected", header: L.expectedL, align: "right", mono: true, cell: (f) => fmtNum(f.expected_litres) },
    { key: "streak", header: L.streak, align: "right", mono: true, cell: (f) => <span className="text-fg-muted">{f.consecutive_days}d</span> },
  ];

  const tripColumns: DataTableColumn<ShuttleMetric>[] = [
    { key: "date", header: L.date, cell: (m) => <span className="whitespace-nowrap">{fmt.formatDate(m.trip_date)}</span> },
    { key: "dir", header: L.dir, cell: (m) => <StatusBadge status={m.direction} size="sm" /> },
    {
      key: "vehicle",
      header: L.vehicle,
      cell: (m) => (
        <div className="min-w-0">
          <div className="font-medium text-fg">{m.vehicles?.plate_number ?? "—"}</div>
          {(m.vehicles?.make || m.vehicles?.model) && <div className="text-xs text-fg-muted">{[m.vehicles?.make, m.vehicles?.model].filter(Boolean).join(" ")}</div>}
        </div>
      ),
    },
    { key: "driver", header: L.driver, hideBelow: "md", cell: (m) => <span className="text-fg-secondary">{m.shuttle_trips?.users?.full_name ?? "—"}</span> },
    { key: "occupancy", header: L.occupancy, align: "right", mono: true, cell: (m) => <span className={m.occupancy_pct && parseFloat(m.occupancy_pct) < 50 ? "text-warning-ink" : undefined}>{pct(m.occupancy_pct)}</span> },
    { key: "detour", header: L.detour, align: "right", mono: true, hideBelow: "sm", cell: (m) => <span className={m.detour_ratio && parseFloat(m.detour_ratio) > 1.2 ? "text-danger-ink" : undefined}>{m.detour_ratio ? `${fmtNum(m.detour_ratio, 2)}×` : "—"}</span> },
    { key: "idle", header: L.idleMin, align: "right", mono: true, hideBelow: "lg", cell: (m) => <span className="text-fg-muted">{fmtNum(m.idle_minutes, 0)}</span> },
    { key: "fuel", header: L.fuelVar, align: "right", mono: true, hideBelow: "lg", cell: (m) => <span className={m.fuel_variance_pct && Math.abs(parseFloat(m.fuel_variance_pct)) > 15 ? "text-danger-ink" : undefined}>{pct(m.fuel_variance_pct)}</span> },
    {
      key: "route",
      header: L.route,
      align: "right",
      cell: (m) => (
        <Button size="sm" variant={selectedTripForMap === m.shuttle_trip_id ? "secondary" : "ghost"} leftIcon={<MapIcon />} onClick={() => void loadRouteComparison(m.shuttle_trip_id, m.route_id)} aria-pressed={selectedTripForMap === m.shuttle_trip_id}>
          {selectedTripForMap === m.shuttle_trip_id ? L.close : L.view}
        </Button>
      ),
    },
  ];

  const underutilised = chauffeurUtil?.bookings.filter((b) => (b.utilization_pct ?? 100) < 70).slice(0, 10) ?? [];
  const bookingColumns: DataTableColumn<ChauffeurUtilizationRow>[] = [
    { key: "booking", header: L.booking, mono: true, cell: (b) => <span className="font-medium text-fg">#{b.booking_id}</span> },
    { key: "package", header: L.package, cell: (b) => <Badge tone="info" size="sm">{b.package_selected?.replace("HOURS_", "") ?? "—"}h</Badge> },
    { key: "date", header: L.date, hideBelow: "sm", cell: (b) => <span className="text-xs text-fg-muted">{b.scheduled_for ? fmt.formatDate(b.scheduled_for) : "—"}</span> },
    { key: "used", header: L.used, align: "right", mono: true, cell: (b) => <span className="text-fg-secondary">{b.used_minutes != null ? `${(b.used_minutes / 60).toFixed(1)}h` : "—"}</span> },
    { key: "util", header: L.utilization, width: "11rem", cell: (b) => (b.utilization_pct != null ? <UtilizationBar pct={b.utilization_pct} threshold={70} /> : "—") },
    { key: "saving", header: L.estSaving, align: "right", mono: true, cell: (b) => <span className="font-medium text-success-ink">{b.estimated_saving_pkr != null && b.estimated_saving_pkr > 0 ? fmt.formatCurrency(b.estimated_saving_pkr) : "—"}</span> },
  ];

  const poolColumns: DataTableColumn<PoolVehicleRow>[] = [
    {
      key: "vehicle",
      header: L.vehicle,
      cell: (v) => (
        <div className="min-w-0">
          <div className="font-medium text-fg">{v.plate_number}</div>
          {(v.make || v.model) && <div className="text-xs text-fg-muted">{[v.make, v.model].filter(Boolean).join(" ")}</div>}
        </div>
      ),
    },
    { key: "category", header: L.category, cell: (v) => (v.category ? <Badge tone="purple" size="sm">{v.category}</Badge> : "—") },
    { key: "trips", header: L.trips, align: "right", mono: true, cell: (v) => <span className="text-fg-secondary">{v.trips_count}</span> },
    { key: "hours", header: L.hoursUsed, align: "right", mono: true, cell: (v) => <span className="text-fg-secondary">{v.total_hours_booked}h</span> },
    { key: "util", header: L.utilization, width: "11rem", cell: (v) => <UtilizationBar pct={v.utilization_pct} threshold={30} /> },
  ];

  if (loading && !summary && !chauffeurUtil && !poolUtil && insights.length === 0) {
    return <LoadingBlock label={L.loading} />;
  }
  if (error && !summary && !chauffeurUtil && !poolUtil && insights.length === 0) {
    return <ErrorState message={error} onRetry={() => setRetryTick((n) => n + 1)} />;
  }

  const generateButton = showGenerate ? (
    <Button size="sm" leftIcon={<Zap />} loading={generating} onClick={() => void triggerGenerate()}>
      {generating ? L.generating : L.runAiAnalysis}
    </Button>
  ) : null;

  return (
    <div className={cn("space-y-10", className)}>
      {error && <ErrorState compact message={error} onRetry={() => setRetryTick((n) => n + 1)} />}

      {/* Shuttle */}
      <section>
        <SectionTitle icon={<Bus />} title={L.shuttleAnalytics} enabled={shuttleEnabled} aiEnabled={aiEnabled} labels={L} actions={generateButton} />
        {!shuttleEnabled ? (
          <DisabledSection label={L.shuttleDisabled} hint={L.disabledHint} />
        ) : (
          <div className="space-y-6">
            {summary && (
              <KpiGrid cols={4}>
                <KpiCard label={L.tripsAnalysed} value={fmt.formatNumber(summary.count)} icon={<Bus />} tone="info" />
                <KpiCard label={L.avgOccupancy} value={`${summary.avgOccupancy.toFixed(1)}%`} icon={summary.avgOccupancy >= 70 ? <TrendingUp /> : <TrendingDown />} tone={summary.avgOccupancy >= 70 ? "success" : "warning"} />
                <KpiCard label={L.avgDetourRatio} value={summary.avgDetour ? `${summary.avgDetour.toFixed(2)}×` : "—"} icon={<Navigation />} tone={!summary.avgDetour || summary.avgDetour < 1.1 ? "success" : "warning"} />
                <KpiCard label={L.totalIdleMin} value={fmt.formatNumber(Math.round(summary.totalIdleMin))} icon={<Zap />} tone={summary.totalIdleMin < 300 ? "success" : "warning"} />
              </KpiGrid>
            )}

            {aiEnabled && (
              <div>
                <SectionHeader title={L.aiInsightsShuttle} className="mb-3" />
                {shuttleInsights.length === 0 ? (
                  <p className="text-sm text-fg-muted">{L.noShuttleInsights}</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {shuttleInsights.map((i) => (
                      <InsightCard key={i.id} insight={i} labels={L} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {fuelFlags.length > 0 && (
              <Card>
                <CardHeader title={<span className="flex items-center gap-2">{L.flaggedFuelVariance} <Badge tone="danger" size="sm">{L.flagged(fuelFlags.length)}</Badge></span>} description={L.fuelVarianceNote} />
                <DataTable<FuelFlag> rows={fuelFlags.slice(0, 8)} rowKey={(f) => f.id} columns={fuelColumns} density="compact" />
              </Card>
            )}

            <Card>
              <CardHeader title={L.recentShuttleTrips} />
              <div className="border-b border-line px-5 py-3">
                <FilterBar
                  activeCount={(dateFilterActive ? 1 : 0) + (vehicleFilterActive ? 1 : 0)}
                  onClear={() => {
                    setRange(null);
                    setSelectedVehicleId("");
                  }}
                >
                  <FilterField label={L.vehicle}>
                    <Select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)}>
                      <option value="">{L.allVehicles}</option>
                      {vehicleOptions.map(([id, plate]) => (
                        <option key={id} value={id}>
                          {plate}
                        </option>
                      ))}
                    </Select>
                  </FilterField>
                  <DateRangePicker value={range} onChange={setRange} allowClear label={L.date} />
                </FilterBar>
              </div>
              <DataTable<ShuttleMetric>
                rows={recentMetrics}
                rowKey={(m) => m.id}
                columns={tripColumns}
                loading={loading}
                density="compact"
                rowClassName={(m) => (selectedTripForMap === m.shuttle_trip_id ? "bg-info-soft" : undefined)}
                empty={{ title: vehicleFilterActive ? L.noTripsForVehicle : dateFilterActive ? L.noTripsForDates : L.noTrips }}
              />
              {selectedTripForMap !== null && (
                <div className="border-t border-line">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                        <MapIcon className="size-4 text-fg-muted" aria-hidden="true" /> {L.routeMapOverlay}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-sm" style={{ background: PLANNED_COLOR }} /> {L.planned}</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-sm" style={{ background: ACTUAL_COLOR }} /> {L.actual}</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ background: ACTUAL_COLOR }} /> {L.departed}</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ background: ARRIVED_COLOR }} /> {L.arrived}</span>
                      </span>
                    </div>
                    <IconButton
                      label={L.close}
                      size="icon-sm"
                      onClick={() => {
                        setSelectedTripForMap(null);
                        setRouteComparison(null);
                        setSelectedRouteId(null);
                      }}
                    >
                      <X />
                    </IconButton>
                  </div>
                  {mapLoading ? (
                    <LoadingBlock label={L.loadingRouteData} className="h-64" />
                  ) : routeComparison ? (
                    <RouteMapOverlay comparison={routeComparison} labels={L} routeInsight={shuttleInsights.find((i) => i.insight_type === "ROUTE_DETOUR" && i.route_id === selectedRouteId) ?? null} />
                  ) : (
                    <EmptyState compact title={L.noRouteData} />
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
      </section>

      <hr className="border-line" />

      {/* Chauffeur */}
      <section>
        <SectionTitle icon={<CarFront />} title={L.chauffeurAnalytics} enabled={chauffeurEnabled} aiEnabled={aiEnabled} labels={L} actions={!shuttleEnabled ? generateButton : undefined} />
        {!chauffeurEnabled ? (
          <DisabledSection label={L.chauffeurDisabled} hint={L.disabledHint} />
        ) : (
          <div className="space-y-6">
            {aiEnabled && (
              <div>
                <SectionHeader title={L.aiInsightsChauffeur} className="mb-3" />
                {chauffeurInsights.length === 0 ? (
                  <p className="text-sm text-fg-muted">{L.noChauffeurInsights}</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {chauffeurInsights.map((i) => (
                      <InsightCard key={i.id} insight={i} labels={L} />
                    ))}
                  </div>
                )}
              </div>
            )}
            {chauffeurUtil && (
              <>
                <KpiGrid cols={4}>
                  <KpiCard label={L.totalBookings} value={fmt.formatNumber(chauffeurUtil.summary.total_bookings)} icon={<CarFront />} tone="info" />
                  <KpiCard label={L.avgUtilization} value={chauffeurUtil.summary.avg_utilization_pct != null ? `${chauffeurUtil.summary.avg_utilization_pct}%` : "—"} icon={<Clock />} tone={chauffeurUtil.summary.avg_utilization_pct != null && chauffeurUtil.summary.avg_utilization_pct >= 70 ? "success" : "warning"} />
                  <KpiCard label={L.underutilized70} value={fmt.formatNumber(chauffeurUtil.summary.underutilized_count)} icon={<AlertTriangle />} tone={chauffeurUtil.summary.underutilized_count === 0 ? "success" : "warning"} />
                  <KpiCard label={L.estBillingSaving} value={chauffeurUtil.summary.total_estimated_saving_pkr > 0 ? fmt.formatCurrency(chauffeurUtil.summary.total_estimated_saving_pkr) : "—"} icon={<TrendingDown />} tone="success" />
                </KpiGrid>
                {underutilised.length > 0 && (
                  <Card>
                    <CardHeader title={L.underutilizedBookings} description={L.underutilizedHint} />
                    <DataTable<ChauffeurUtilizationRow> rows={underutilised} rowKey={(b) => b.booking_id} columns={bookingColumns} density="compact" />
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {showPool && (
        <>
          <hr className="border-line" />
          <section>
            <SectionTitle icon={<Car />} title={L.poolAnalytics} enabled={poolEnabled} aiEnabled={aiEnabled} labels={L} actions={!shuttleEnabled && !chauffeurEnabled ? generateButton : undefined} />
            {!poolEnabled ? (
              <DisabledSection label={L.poolDisabled} hint={L.disabledHint} />
            ) : (
              <div className="space-y-6">
                {aiEnabled && (
                  <div>
                    <SectionHeader title={L.aiInsightsPool} className="mb-3" />
                    {poolInsights.length === 0 ? (
                      <p className="text-sm text-fg-muted">{L.noPoolInsights}</p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {poolInsights.map((i) => (
                          <InsightCard key={i.id} insight={i} labels={L} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {poolUtil && (
                  <>
                    <KpiGrid cols={4}>
                      <KpiCard label={L.poolVehicles} value={fmt.formatNumber(poolUtil.summary.total_pool_vehicles)} icon={<Car />} tone="purple" />
                      <KpiCard label={L.avgUtilization} value={`${poolUtil.summary.avg_utilization_pct}%`} icon={<Clock />} tone={poolUtil.summary.avg_utilization_pct >= 30 ? "success" : "warning"} />
                      <KpiCard label={L.idleVehicles} value={fmt.formatNumber(poolUtil.summary.idle_vehicle_count)} icon={<AlertTriangle />} tone={poolUtil.summary.idle_vehicle_count === 0 ? "success" : "warning"} />
                      <KpiCard label={L.underutilized30} value={fmt.formatNumber(poolUtil.summary.underutilized_count)} icon={<TrendingDown />} tone={poolUtil.summary.underutilized_count === 0 ? "success" : "danger"} />
                    </KpiGrid>
                    {poolUtil.vehicles.length > 0 && (
                      <Card>
                        <CardHeader title={L.poolVehicleUtilization} description={L.poolUtilizationHint} />
                        <DataTable<PoolVehicleRow> rows={poolUtil.vehicles} rowKey={(v) => v.vehicle_id} columns={poolColumns} density="compact" />
                      </Card>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function RouteMapOverlay({ comparison, routeInsight, labels: L }: { comparison: RouteComparison; routeInsight: FleetInsight | null; labels: FleetLabels }) {
  const plannedPolyline: MapPolyline | null =
    comparison.planned_points.length > 1 ? { positions: comparison.planned_points.map((p) => [p.lat, p.lng] as [number, number]), color: PLANNED_COLOR, weight: 4, opacity: 0.85 } : null;
  const actualPolyline: MapPolyline | null =
    comparison.actual_points.length > 1 ? { positions: comparison.actual_points.map((p) => [p.lat, p.lng] as [number, number]), color: ACTUAL_COLOR, weight: 3, opacity: 0.9, dashArray: "6 4" } : null;
  const polylines = [plannedPolyline, actualPolyline].filter(Boolean) as MapPolyline[];

  const markers: MapMarker[] = [];
  if (comparison.planned_points.length > 0) {
    const first = comparison.planned_points[0];
    const last = comparison.planned_points[comparison.planned_points.length - 1];
    markers.push({ id: "planned-start", position: [first.lat, first.lng], label: L.firstStop, description: L.firstStopDescription, color: "#22c55e", type: "pickup" });
    markers.push({ id: "planned-end", position: [last.lat, last.lng], label: L.lastStop, description: L.lastStopDescription, color: "#ef4444", type: "dropoff" });
  }
  // The driver's GPS trail usually starts/ends away from the planned route (their own location).
  if (comparison.actual_points.length > 0) {
    const departed = comparison.actual_points[0];
    const arrived = comparison.actual_points[comparison.actual_points.length - 1];
    markers.push({ id: "actual-start", position: [departed.lat, departed.lng], label: L.departed, description: L.departedDescription, color: ACTUAL_COLOR, type: "actual-start" });
    markers.push({ id: "actual-end", position: [arrived.lat, arrived.lng], label: L.arrived, description: L.arrivedDescription, color: ARRIVED_COLOR, type: "actual-end" });
  }

  const m = comparison.metrics;
  const detour = m?.detour_ratio ?? null;
  const detourPct = detour !== null ? ((detour - 1) * 100).toFixed(1) : null;
  const detourTone: Tone = detour === null ? "neutral" : detour > 1.15 ? "danger" : detour > 1.05 ? "warning" : "success";

  return (
    <div className="flex flex-col lg:flex-row">
      <div className="min-h-0 flex-1" style={{ height: 360 }}>
        {polylines.length > 0 || markers.length > 0 ? <Map markers={markers} polylines={polylines} height="360px" /> : <EmptyState compact title={L.noPolylineData} className="h-full" />}
      </div>
      <div className="flex w-full flex-col gap-4 border-t border-line p-4 lg:w-64 lg:border-s lg:border-t-0">
        {detour !== null && (
          <div className={cn("rounded-lg border px-3 py-2.5 text-center", toneBox[detourTone])}>
            <p className="mb-0.5 text-xs text-fg-muted">{L.detourRatio}</p>
            <p className={cn("text-2xl font-bold", toneInk[detourTone])}>{detour.toFixed(2)}×</p>
            {detourPct && <p className="text-xs text-fg-muted">{L.extraDistance(detourPct)}</p>}
          </div>
        )}
        <dl className="space-y-2 text-sm">
          {m?.planned_distance_km != null && (
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-fg-muted"><span className="inline-block h-2 w-4 rounded-sm" style={{ background: PLANNED_COLOR }} /> {L.planned}</dt>
              <dd className="font-medium">{m.planned_distance_km.toFixed(2)} km</dd>
            </div>
          )}
          {m?.actual_distance_km != null && (
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-fg-muted"><span className="inline-block h-2 w-4 rounded-sm" style={{ background: ACTUAL_COLOR }} /> {L.actual}</dt>
              <dd className="font-medium">{m.actual_distance_km.toFixed(2)} km</dd>
            </div>
          )}
          {comparison.idle_minutes != null && (
            <div className="flex items-center justify-between">
              <dt className="text-fg-muted">{L.idleTime}</dt>
              <dd className="font-medium">{comparison.idle_minutes.toFixed(0)} min</dd>
            </div>
          )}
          {m?.fuel_variance_pct != null && (
            <div className="flex items-center justify-between">
              <dt className="text-fg-muted">{L.fuelVariance}</dt>
              <dd className={cn("font-medium", Math.abs(m.fuel_variance_pct) > 15 ? "text-danger-ink" : "text-fg")}>
                {m.fuel_variance_pct > 0 ? "+" : ""}
                {m.fuel_variance_pct.toFixed(1)}%
              </dd>
            </div>
          )}
        </dl>
        {routeInsight && (
          <div className="rounded-lg border border-purple-line bg-purple-soft p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-purple-ink">
              <Navigation className="size-3.5" aria-hidden="true" /> {L.aiNote}
            </p>
            <p className="text-xs text-purple-ink">{routeInsight.data.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
