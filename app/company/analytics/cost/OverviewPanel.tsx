"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, CircleAlert, Info, PiggyBank, TrendingDown } from "lucide-react";
import { SectionHeading } from "../components/ui";
import { useCostFetch, useFmt, filterQuery, type CostFilters } from "./hooks";
import { ErrorNote, FigureValue, HowCalculated, Skeleton, StatBlock, Tag } from "./ui";
import type { DataHealth, Overview } from "./types";

export type CostTab = "fuel" | "occupancy" | "routes" | "recommendations";

export function OverviewPanel({ filters, onOpenTab, onManageBenchmarks }: { filters: CostFilters; onOpenTab: (t: CostTab) => void; onManageBenchmarks: () => void }) {
  const t = useTranslations("company.costOptimization.overview");
  const tc = useTranslations("company.costOptimization");
  const fmt = useFmt();
  const ov = useCostFetch<Overview>(`/company/cost-optimization/overview?${filterQuery(filters)}`);

  if (ov.error) return <ErrorNote message={tc("loadFailed")} detail={ov.error} onRetry={ov.reload} />;
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

      {/* Opportunities — one amount the company can save */}
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
          <>
            {/* Headline: the total and its share of the monthly spend. */}
            <div className="relative overflow-hidden rounded-3xl border border-success-line bg-gradient-to-br from-success-soft via-card to-card p-6 sm:p-8">
              <PiggyBank aria-hidden className="pointer-events-none absolute -end-8 -top-8 size-48 rotate-12 text-success-ink opacity-[0.06]" />
              <div className="relative flex flex-col gap-3">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-success-ink">
                  <PiggyBank className="size-4" aria-hidden />
                  {t("potentialMonthly")}
                </p>
                {o.potential_monthly.locked ? (
                  <FigureValue figure={o.potential_monthly} size="lg" />
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-4xl font-semibold tracking-tight text-fg tabular-nums sm:text-5xl">{fmt.fig(o.potential_monthly)}</span>
                    {o.saving_pct && o.saving_pct.value !== null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-ink px-3 py-1.5 text-sm font-semibold text-card">
                        <TrendingDown className="size-4" aria-hidden />
                        {t("savingPct", { pct: fmt.n(o.saving_pct.value, 1) })}
                      </span>
                    )}
                    <HowCalculated figure={o.saving_pct && o.saving_pct.value !== null ? o.saving_pct : o.potential_monthly} />
                  </div>
                )}
                <p className="text-sm text-fg-muted">
                  {!o.potential_annual.locked && <span className="font-medium text-fg">{t("perYear", { amount: fmt.fig(o.potential_annual) })} · </span>}
                  {t("openCount", { count: o.recommendations })}
                </p>
              </div>
            </div>
            {o.fixed_monthly && o.fuel_monthly && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatBlock label={t("fixedMonthly")} figure={o.fixed_monthly} hint={t("fixedMonthlyHint")} showBasis={false} />
                <StatBlock label={t("fuelMonthly")} figure={o.fuel_monthly} hint={t("fuelMonthlyHint")} showBasis={false} />
              </div>
            )}
          </>
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
            <StatBlock label={t("fuelCostDiff")} figure={d.fuel.cost_difference} hint={t("fuelClaimHint")} />
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
