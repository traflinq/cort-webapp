/** Mirrors cort-backend src/modules/cost-optimization (reports + recommendations). */

export type Basis = "MEASURED" | "REPORTED" | "CONTRACTED" | "ESTIMATED" | "SIMULATED" | "CALCULATED";
export type Unit = "PKR" | "L" | "km" | "min" | "%" | "km/L" | "PKR/L" | "count" | "seats" | "days" | "trips" | "kgCO2e" | "kg/L" | "h" | "L/h" | "trees";

export interface FigureInput {
  label: string;
  value: number | string | null;
  unit?: Unit;
  source: string;
}

export interface Figure {
  value: number | null;
  unit: Unit;
  basis: Basis;
  formula: string;
  inputs: FigureInput[];
  saving?: boolean;
  locked?: boolean;
  missing_reason?: string;
}

export interface Window {
  from: string;
  to: string;
  days?: number;
}

export interface Locked {
  savings_locked: boolean;
}

// ─── Data health ─────────────────────────────────────────────────────────────

export interface HealthIssue {
  key: string;
  severity: "BLOCKING" | "WARNING" | "INFO";
  count: number;
  items: Array<{ id: number | string; label: string }>;
  impact: string;
  fix: string;
}

export interface DataHealth {
  issues: HealthIssue[];
  stats: {
    completed_trips: number;
    trips_with_gps_km: number;
    gps_km_coverage_pct: number | null;
    vehicles: number;
    routes: number;
    benchmarks: number;
  };
}

// ─── Overview ────────────────────────────────────────────────────────────────

export interface Overview extends Locked {
  window: Window;
  spend: {
    contracted_fixed: Figure;
    contracted_fuel: Figure;
    estimated_fuel: Figure;
    vehicles_in_service: number;
    vehicles_without_benchmark: Array<{ id: number; label: string }>;
  };
  /** Traflinq-managed vehicles are left out of this analysis (they get the before / after view instead). */
  scope: { company_vehicles: number; cort_vehicles: number; cort_trips_excluded: number };
  fuel: { vehicles: number; flagged: number; litres_difference: Figure; cost_difference: Figure };
  opportunities: {
    potential_monthly: Figure;
    /** Parts of the monthly total: fixed cost + fuel = potential_monthly. Absent on an older backend. */
    fixed_monthly?: Figure;
    fuel_monthly?: Figure;
    /** Total saving as a share of the contracted monthly spend; null with a route / vehicle / vendor filter. */
    saving_pct?: Figure;
    potential_annual: Figure;
    recommendations: number;
    last_run: { id: number; generated_at: string } | null;
  };
  utilisation: { average_occupancy: Figure; vehicle_utilisation: Figure; trips: number; service_days: number };
  data_health: DataHealth;
}

export interface SpendHistory extends Locked {
  window: Window;
  months: Array<{ month: string; contracted_fixed: number | null; estimated_fuel: number | null; trips: number; vehicles: number }>;
  method: string[];
}

// ─── Fuel ────────────────────────────────────────────────────────────────────

export type FuelStatus = "WITHIN_TOLERANCE" | "POTENTIAL_DISCREPANCY" | "INSUFFICIENT_DATA" | "NO_CONTRACT_FIGURE";

export interface FuelComparison {
  status: FuelStatus;
  direction: "OVER" | "UNDER" | null;
  contracted_litres: Figure;
  estimated_litres: Figure;
  fuel_price: Figure;
  contracted_fuel_cost: Figure;
  estimated_fuel_cost: Figure;
  litres_difference: Figure;
  cost_difference: Figure;
  variance_pct: Figure;
  km_coverage_pct: number;
  reasons: string[];
}

export interface FuelVehicleReport {
  vehicle: {
    id: number;
    plate: string;
    label: string;
    category: string;
    fuel_type: string;
    fuel_type_explicit: boolean;
    rated_kmpl: number | null;
    vendor: string | null;
  };
  routes: Array<{ id: number; name: string }>;
  trips: number;
  operating_days: number;
  km: number;
  benchmark_ids: number[];
  fuel_inclusive: boolean;
  comparison: FuelComparison;
}

export interface FuelReport extends Locked {
  window: Window;
  tolerance_pct: number;
  vehicles: FuelVehicleReport[];
  totals: {
    vehicles: number;
    flagged: number;
    insufficient: number;
    no_contract_figure: number;
    contracted_litres: Figure;
    estimated_litres: Figure;
    litres_difference: Figure;
    cost_difference: Figure;
  };
  method: string[];
}

export interface FuelTrips extends Locked {
  window: Window;
  vehicle: { id: number; plate: string; label: string; rated_kmpl: number | null; fuel_type: string } | null;
  trips: Array<{
    trip_id: number;
    date: string;
    direction: "MORNING" | "EVENING";
    route: { id: number; name: string };
    started_at: string | null;
    completed_at: string | null;
    km: number | null;
    planned_km: number | null;
    estimated_litres: number | null;
  }>;
}

// ─── Occupancy ───────────────────────────────────────────────────────────────

export type OccupancyStatus = "UNDERUTILISED" | "OK" | "FULL" | "OVER_CAPACITY" | "CAPACITY_UNKNOWN" | "NO_ROSTER";

export interface OccupancyRow {
  route: { id: number; name: string; vendor: string | null };
  direction: "MORNING" | "EVENING";
  vehicle: { id: number; plate: string; label: string; category: string } | null;
  occupancy: { assigned: number; capacity: number | null; occupancy_pct: Figure; empty_seats: Figure; status: OccupancyStatus };
  trips: number;
  avg_km: number | null;
  trip_cost: { fixed: Figure; fuel: Figure; total: Figure };
  cost_per_assigned_employee: Figure;
  cost_per_seat: Figure;
  attendance: { trips: number; avg_riders_per_trip: number | null; total_boarded: number; total_absent: number; total_unmarked: number };
}

export interface OccupancyReport extends Locked {
  window: Window;
  rows: OccupancyRow[];
  summary: {
    routes: number;
    average_occupancy: Figure;
    underutilised: number;
    underutilised_vehicles?: number;
    over_capacity: number;
    capacity_unknown: number;
    assigned: number;
    seats: number;
    bands: Record<"lt25" | "25to50" | "50to75" | "75to100" | "over100" | "unknown", number>;
  };
  trend: Array<{ date: string; assigned: number; seats: number; occupancy_pct: number | null }>;
  method: string[];
}

// ─── Recommendations ─────────────────────────────────────────────────────────

export type RecType = "FLEET_REPLAN" | "ROUTE_MERGE" | "ROUTE_REDISTRIBUTE" | "ROUTE_RESEQUENCE" | "VEHICLE_DOWNSIZE" | "ROUTE_DETOUR" | "FUEL_DISCREPANCY";
export type Feasibility = "FEASIBLE" | "REJECTED" | "ROUTING_UNAVAILABLE" | "INSUFFICIENT_DATA";

export interface Check {
  key: string;
  label: string;
  status: "PASS" | "FAIL" | "UNVERIFIED";
  detail: string;
  /** e.g. the receiving route a redistribution check is about */
  subject?: string;
}

export interface NarrativePart {
  key: string;
  params: Record<string, string | number | null>;
  text: string;
}

export interface MapGeometry {
  routes: Array<{
    role: "CURRENT" | "CURRENT_REMOVED" | "PROPOSED";
    route_id: number | null;
    direction: "MORNING" | "EVENING";
    label: string;
    points: Array<{ lat: number; lng: number }>;
  }>;
  stops: Array<{
    id: number;
    name: string;
    lat: number;
    lng: number;
    route_id: number;
    old_sequence: number | null;
    new_sequence: number | null;
    assigned: number;
    /** redistribution: the route this stop moves to */
    moves_to?: { route_id: number; route_name: string } | null;
  }>;
  markers: Array<{ kind: "START" | "END" | "OFFICE"; lat: number; lng: number; label: string }>;
}

export interface Confidence {
  level: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  factors: Array<{ key: string; label: string; state: "OK" | "PARTIAL" | "MISSING"; detail: string; weight: number }>;
}

export interface Recommendation {
  id: number;
  run_id: number;
  type: RecType;
  fingerprint: string;
  route_ids: number[];
  vehicle_ids: number[];
  feasibility: Feasibility;
  checks: Check[];
  financials: Record<string, Figure>;
  evidence: {
    window: Window;
    trips_analysed: number;
    trip_ids: number[];
    data: Record<string, unknown>;
    comparison: Record<string, Figure>;
    claims: string[];
    excluded_from_total: boolean;
  };
  assumptions: string[];
  confidence: Confidence;
  geometry?: MapGeometry | null;
  narrative_params: { identified: NarrativePart; recommendation: NarrativePart; why: NarrativePart; tradeoffs: NarrativePart[] };
  net_monthly_pkr: string | number | null;
  overlaps_with: number[];
  counted: boolean;
  calculated_at: string;
  savings_locked?: boolean;
  run?: { id: number; generated_at: string; period_start: string; period_end: string; engine_version: string };
}

export interface RecommendationList extends Locked {
  run: { id: number; generated_at: string; period_start: string; period_end: string; summary: Record<string, unknown> } | null;
  recommendations: Recommendation[];
}

export interface FilterOptions {
  routes: Array<{ id: number; name: string; is_active: boolean }>;
  vehicles: Array<{ id: number; plate: string; label: string }>;
  vendors: string[];
  /** company = its own vendors' or own cars (analysed with its vendor rates); cort = Traflinq's managed service */
  scope: { company_managed_vehicles: number; cort_managed_vehicles: number };
}

// ─── Carbon & ESG ────────────────────────────────────────────────────────────

export type AcState = "ON" | "OFF" | "UNSET";
export type FuelKind = "PETROL" | "DIESEL";

export interface CarbonVehicleRow {
  vehicle: { id: number; plate: string; label: string; category: string; fuel_type: FuelKind; fuel_type_explicit: boolean; seats: number | null; ac: AcState; vendor: string | null };
  idle_class: { key: string; label: string; seats_assumed: boolean; fuel_mismatch: boolean } | null;
  /** litres per hour; `used` is the low end of the min–max range */
  idle_rate: { used: number; min: number; max: number; source: string } | null;
  trips: number;
  trips_without_idle: number;
  km_estimated: number;
  litres: Figure;
  co2e: Figure;
  idle_hours: Figure;
  idle_litres: Figure;
  idle_co2e: Figure;
}

export interface CarbonRecRow {
  id: number;
  type: RecType;
  routes: Array<{ id: number; name: string }>;
  litres_per_month: Figure;
  co2e_per_month: Figure;
}

export interface CarbonReport extends Locked {
  window: Window & { month_equivalents: number };
  factors: Array<{ fuel_type: FuelKind; kg_per_litre: number; source: string }>;
  totals: {
    litres: Figure;
    co2e: Figure;
    employees: Figure;
    intensity_per_employee: Figure;
    idle_hours: Figure;
    idle_litres: Figure;
    idle_co2e: Figure;
    current_co2e_per_month: Figure;
    recs_litres_per_month: Figure;
    recs_co2e_per_month: Figure;
    idle_co2e_per_month: Figure;
    potential_co2e_per_month: Figure;
    potential_co2e_per_year: Figure;
    after_co2e_per_month: Figure;
    abatement_pct: Figure;
    trees: Figure;
  };
  vehicles: CarbonVehicleRow[];
  recommendations: CarbonRecRow[];
  recommendation_status: "OK" | "NO_RUN" | "OLD_ENGINE";
  last_run: { id: number; generated_at: string; engine_version: string; from: string; to: string } | null;
  data: { vehicles_without_kmpl: number; vehicles_ac_unset: number; vehicles_seats_assumed: number; vehicles_without_idle_rate: number; trips_without_idle: number };
  method: string[];
}
