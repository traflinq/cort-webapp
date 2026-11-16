/** Mirrors cort-backend `savings-dashboard.service.ts`. */

export interface Comparison {
  current: number | null;
  previous: number | null;
  delta_pct: number | null;
}

export interface PeriodWindow {
  from: string;
  to: string;
  days: number;
  days_in_month: number;
}

export interface SavingsPeriods {
  month: string;
  is_mtd: boolean;
  current: PeriodWindow;
  previous: PeriodWindow;
}

export interface ShuttleSection {
  kpis: {
    occupancy_pct: Comparison;
    seats_offered: Comparison;
    seats_used: Comparison;
    trips: Comparison;
    total_km: Comparison;
    avg_trip_duration_min: Comparison;
    km_per_vehicle: Comparison;
  };
  vehicles: {
    vehicle_id: number;
    plate_number: string;
    category: string;
    trips: number;
    km: number;
    occupancy_pct: number | null;
    avg_duration_min: number | null;
  }[];
  savings: {
    has_benchmarks: boolean;
    analysed_days: number;
    analysis_ready: boolean;
    fuel_price_pkr: number | null;
    vehicles_reduced: number;
    vehicles_reduced_pkr: number;
    km_reduced: number;
    km_reduced_pkr: number;
    total_pkr: number;
    rows: {
      vehicle_category: string;
      cost_type: "FIXED" | "VARIABLE";
      vendor_name: string | null;
      benchmark_vehicles: number;
      active_vehicles: number;
      vehicles_reduced: number;
      vehicles_reduced_pkr: number;
      benchmark_km: number;
      actual_km: number;
      km_reduced: number;
      km_reduced_pkr: number;
      status: "OK" | "NO_FUEL_DATA";
    }[];
  };
  /** GPS km vs planned route km on the same trips (a distance check, not a fuel-receipt check). */
  route_variance?: {
    actual_km: number;
    planned_km: number;
    ratio_pct: number | null;
    flagged_vehicles: number;
  };
}

export interface PoolSection {
  kpis: {
    pool_vehicles: number;
    trips: Comparison;
    trips_per_vehicle: Comparison;
    idle_vehicles: Comparison;
    total_km: Comparison;
    avg_trip_duration_min: Comparison;
  };
  fueling: { status: "FUEL_CARD_NOT_CONNECTED" };
  vehicles: {
    vehicle_id: number;
    plate_number: string;
    make: string;
    model: string;
    trips: number;
    km: number;
    avg_duration_min: number | null;
  }[];
}

export interface ChauffeurSection {
  kpis: {
    rides: Comparison;
    total_km: Comparison;
    avg_trip_duration_min: Comparison;
    avg_cost_per_ride: Comparison;
  };
  external_vendor_rides: number;
  /** Where the money went (Cort-managed rides). Chauffeur has no savings figure. */
  cost_breakdown: { rental: number; fuel: number; overtime: number; parking: number; toll: number };
  audit: {
    external_vendor_trips: number;
    audited_trips: number;
    unaudited_trips: number;
    vendor_charged_pkr: number;
    expected_pkr: number;
    overcharge_caught_pkr: number;
    overcharged_trips: number;
  };
}

export interface SavingsDashboardFull {
  locked: false;
  company: { id: number; name: string; savings_unlocked: boolean };
  period: SavingsPeriods;
  total_savings_pkr: number;
  /** Only shuttle produces a savings figure (vs the pre-Traflinq benchmark). */
  total_by_service: { shuttle: number | null };
  analysis_ready: boolean;
  services: { shuttle: boolean; chauffeur: boolean; pool: boolean };
  shuttle: ShuttleSection | null;
  pool: PoolSection | null;
  chauffeur: ChauffeurSection | null;
}

export interface SavingsDashboardLocked {
  locked: true;
  period: { month: string; is_mtd: boolean; from: string; to: string };
  total_savings_pkr: number;
  analysis_ready: boolean;
}

export type SavingsDashboardResponse = SavingsDashboardFull | SavingsDashboardLocked;

export interface SavingsOverviewRow {
  company_id: number;
  company_name: string;
  savings_unlocked: boolean;
  services: SavingsDashboardFull["services"];
  total_savings_pkr: number;
  shuttle_savings_pkr: number | null;
  analysis_ready: boolean;
  error?: string;
}

export interface SavingsOverview {
  period: SavingsPeriods;
  total_savings_pkr: number;
  unlocked_count: number;
  companies: SavingsOverviewRow[];
}

/** "YYYY-MM" for the given date (local calendar). */
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}
