"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, CircleAlert, Info } from "lucide-react";
import { SectionHeading } from "../components/ui";
import { useCostFetch, useFmt, filterQuery, type CostFilters } from "./hooks";
import { SpendHistoryChart } from "./charts";
import { ErrorNote, MethodNote, Skeleton, StatBlock, Tag } from "./ui";
import type { DataHealth, Overview, SpendHistory } from "./types";

export type CostTab = "fuel" | "occupancy" | "routes" | "recommendations";

export function OverviewPanel({ filters, onOpenTab, onManageBenchmarks }: { filters: CostFilters; onOpenTab: (t: CostTab) => void; onManageBenchmarks: () => void }) {
  const t = useTranslations("company.costOptimization.overview");
  const tc = useTranslations("company.costOptimization");
  const fmt = useFmt();
  const ov = useCostFetch<Overview>(`/company/cost-optimization/overview?${filterQuery(filters)}`);
  const hist = useCostFetch<SpendHistory>(`/company/cost-optimization/overview/history?months=6&to=${filters.to}`);

  if (ov.error) return <ErrorNote message={tc("loadFailed")} />;
  if (!ov.data) return <Skeleton className="h-72" />;
  const d = ov.data;
  const o = d.opportunities;

  return (
    <div className="flex flex-col gap-8">
      {/* Spend */}
      <section className="flex flex-col gap-3">
        <SectionHeading title={t("spendTitle")} description={t("spendDescription")} badge={`${fmt.date(d.window.from)} – ${fmt.date(d.window.to)}`} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatBlock label={t("contractedFixed")} figure={d.spend.contracted_fixed} hint={t("vehiclesInService", { count: d.spend.vehicles_in_service })} />
          <StatBlock label={t("contractedFuel")} figure={d.spend.contracted_fuel} hint={t("contractedFuelHint")} />
          <StatBlock label={t("estimatedFuel")} figure={d.spend.estimated_fuel} hint={t("estimatedFuelHint")} />
        </div>
        {d.scope.cort_vehicles > 0 && (
          <p className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-sm text-fg-muted">
            <Info className="size-4 shrink-0" />
            {t("cortExcluded", { count: d.scope.cort_vehicles })}
          </p>
        )}
        {d.spend.vehicles_without_benchmark.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-ink">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              {t("noBenchmark", { count: d.spend.vehicles_without_benchmark.length })}
            </span>
            <button type="button" onClick={onManageBenchmarks} className="rounded-lg bg-card px-3 py-1.5 text-xs font-semibold text-fg hover:bg-subtle">
              {t("manageVendorCost")}
            </button>
          </div>
        )}
      </section>

      {/* Opportunities — potential, approved and realised are never added together */}
      <section className="flex flex-col gap-3">
        <SectionHeading
          title={t("opportunitiesTitle")}
          description={t("opportunitiesDescription")}
          badge={o.last_run ? t("lastRun", { date: fmt.date(o.last_run.generated_at) }) : undefined}
          action={
            <button type="button" onClick={() => onOpenTab("recommendations")} className="flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline">
              {t("viewRecommendations")}
              <ArrowRight className="size-4 rtl-flip" />
            </button>
          }
        />
        {!o.last_run ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-card p-4 text-sm text-fg-muted">
            <Info className="size-4 shrink-0" />
            {t("noRunYet")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatBlock label={t("potentialMonthly")} figure={o.potential_monthly} hint={t("openCount", { count: o.counts.open })} />
            <StatBlock label={t("potentialAnnual")} figure={o.potential_annual} />
            <StatBlock label={t("approved")} figure={o.approved_monthly} hint={t("approvedHint", { count: o.counts.approved })} />
            <StatBlock label={t("realized")} figure={o.realized_total} hint={t("realizedHint", { count: o.counts.realized })} />
          </div>
        )}
      </section>

      {/* Fuel snapshot + utilisation */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="flex flex-col gap-3">
          <SectionHeading
            title={t("fuelTitle")}
            description={t("fuelDescription")}
            action={
              <button type="button" onClick={() => onOpenTab("fuel")} className="flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline">
                {t("open")}
                <ArrowRight className="size-4 rtl-flip" />
              </button>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatBlock label={t("fuelLitresDiff")} figure={d.fuel.litres_difference} hint={t("flaggedVehicles", { flagged: d.fuel.flagged, total: d.fuel.vehicles })} />
            <StatBlock label={t("fuelCostDiff")} figure={d.fuel.cost_difference} hint={t("requiresVerification")} />
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <SectionHeading
            title={t("utilisationTitle")}
            description={t("utilisationDescription")}
            action={
              <button type="button" onClick={() => onOpenTab("occupancy")} className="flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline">
                {t("open")}
                <ArrowRight className="size-4 rtl-flip" />
              </button>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatBlock label={t("avgOccupancy")} figure={d.utilisation.average_occupancy} hint={t("avgOccupancyHint")} />
            <StatBlock label={t("vehicleUtilisation")} figure={d.utilisation.vehicle_utilisation} hint={t("tripsDays", { trips: d.utilisation.trips, days: d.utilisation.service_days })} />
          </div>
        </section>
      </div>

      {/* Spend history */}
      {hist.data && hist.data.months.some((m) => m.contracted_fixed !== null || m.estimated_fuel !== null) && (
        <section className="flex flex-col gap-3">
          <SectionHeading title={t("historyTitle")} description={t("historyDescription")} />
          <div className="rounded-2xl border border-line bg-card p-4">
            <SpendHistoryChart data={hist.data} />
          </div>
          <MethodNote lines={hist.data.method} />
        </section>
      )}

      <DataHealthCard health={d.data_health} onManageBenchmarks={onManageBenchmarks} />
    </div>
  );
}

export function DataHealthCard({ health, onManageBenchmarks }: { health: DataHealth; onManageBenchmarks: () => void }) {
  const t = useTranslations("company.costOptimization.health");
  const fmt = useFmt();
  const s = health.stats;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading title={t("title")} description={t("description")} />
      <div className="rounded-2xl border border-line bg-card">
        <div className="grid grid-cols-2 gap-3 border-b border-line p-4 text-sm sm:grid-cols-4">
          <Stat label={t("trips")} value={fmt.n(s.completed_trips)} />
          <Stat label={t("gpsCoverage")} value={s.gps_km_coverage_pct === null ? "—" : `${fmt.n(s.gps_km_coverage_pct, 1)}%`} />
          <Stat label={t("vehicles")} value={fmt.n(s.vehicles)} />
          <Stat label={t("benchmarks")} value={fmt.n(s.benchmarks)} />
        </div>
        {health.issues.length === 0 ? (
          <p className="p-4 text-sm text-success-ink">{t("allGood")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {health.issues.map((i) => (
              <li key={i.key} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:gap-4">
                <span className="flex shrink-0 items-center gap-2 sm:w-64">
                  <CircleAlert className={`size-4 ${i.severity === "BLOCKING" ? "text-danger-ink" : i.severity === "WARNING" ? "text-warning-ink" : "text-fg-muted"}`} />
                  <span className="text-sm font-medium text-fg">{t(`issues.${i.key}` as never)}</span>
                  <Tag tone={i.severity === "BLOCKING" ? "danger" : i.severity === "WARNING" ? "warning" : "neutral"}>{i.count}</Tag>
                </span>
                <span className="min-w-0 flex-1 text-sm text-fg-muted">
                  <span className="block">{t(`impact.${i.key}` as never)}</span>
                  {i.items.length > 0 && <span className="mt-1 block truncate text-xs" title={i.items.map((x) => x.label).join(", ")}>{i.items.slice(0, 6).map((x) => x.label).join(", ")}{i.items.length > 6 ? ` +${i.count - 6}` : ""}</span>}
                </span>
                {(i.key === "benchmark_missing" || i.key === "benchmark_fuel_missing") && (
                  <button type="button" onClick={onManageBenchmarks} className="shrink-0 self-start rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-fg hover:bg-subtle">
                    {t("fixBenchmark")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-fg">{value}</p>
    </div>
  );
}
