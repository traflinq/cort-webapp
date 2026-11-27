"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, Info, TrendingDown } from "lucide-react";
import { Badge, Button } from "@/app/admin/ui";
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
      {/* Opportunities — one amount the company can save */}
      <section className="flex flex-col gap-3">
        <SectionHeading
          title={t("opportunitiesTitle")}
          description={t("opportunitiesDescription")}
          badge={o.last_run ? t("lastRun", { date: fmt.date(o.last_run.generated_at) }) : undefined}
          action={
            <Button variant="ghost" size="sm" onClick={() => onOpenTab("recommendations")} rightIcon={<ArrowRight className="rtl-flip" aria-hidden="true" />}>
              {t("viewRecommendations")}
            </Button>
          }
        />
        {!o.last_run ? (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-card p-4 text-sm text-fg-muted">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            {t("noRunYet")}
          </div>
        ) : (
          <>
            {/* Headline: the total and its share of the monthly spend. */}
            <div className="rounded-xl border border-line bg-card p-5 sm:p-6">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-fg-muted">{t("potentialAnnual")}</p>
                {o.potential_monthly.locked ? (
                  <FigureValue figure={o.potential_annual} size="lg" />
                ) : (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-3xl font-semibold tracking-tight text-success-ink tabular-nums">{fmt.fig(o.potential_annual)}</span>
                    {o.saving_pct && o.saving_pct.value !== null && (
                      <Badge tone="success" icon={<TrendingDown aria-hidden="true" />} className="tabular-nums">
                        {t("savingPct", { pct: fmt.n(o.saving_pct.value, 1) })}
                      </Badge>
                    )}
                    <HowCalculated figure={o.saving_pct && o.saving_pct.value !== null ? o.saving_pct : o.potential_monthly} />
                  </div>
                )}
                <p className="text-sm text-fg-muted">
                  {!o.potential_monthly.locked && <span className="font-medium text-fg tabular-nums">{t("perMonth", { amount: fmt.fig(o.potential_monthly) })} · </span>}
                  {t("openCount", { count: o.recommendations })}
                </p>
              </div>
            </div>
            {o.fixed_monthly && o.fuel_monthly && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatBlock label={t("fixedMonthly")} figure={o.fixed_monthly} hint={t("fixedMonthlyHint")} showBasis={false} />
                <StatBlock label={t("fuelMonthly")} figure={o.fuel_monthly} hint={t("fuelMonthlyHint")} showBasis={false} />
              </div>
            )}
          </>
        )}
      </section>

      {/* Spend */}
      <section className="flex flex-col gap-3">
        <SectionHeading title={t("spendTitle")} description={t("spendDescription")} badge={`${fmt.date(d.window.from)} – ${fmt.date(d.window.to)}`} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatBlock label={t("contractedFixed")} figure={d.spend.contracted_fixed} hint={t("vehiclesInService", { count: d.spend.vehicles_in_service })} />
          <StatBlock label={t("contractedFuel")} figure={d.spend.contracted_fuel} hint={t("contractedFuelHint")} />
          <StatBlock label={t("estimatedFuel")} figure={d.spend.estimated_fuel} hint={t("estimatedFuelHint")} />
        </div>
        {d.scope.cort_vehicles > 0 && (
          <p className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3 text-sm text-fg-muted">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            {t("cortExcluded", { count: d.scope.cort_vehicles })}
          </p>
        )}
        {d.spend.vehicles_without_benchmark.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-ink">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {t("noBenchmark", { count: d.spend.vehicles_without_benchmark.length })}
            </span>
            <Button variant="outline" size="sm" onClick={onManageBenchmarks}>
              {t("manageVendorCost")}
            </Button>
          </div>
        )}
      </section>

      {/* Fuel snapshot + utilisation */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2 xl:gap-6">
        <section className="flex flex-col gap-3">
          <SectionHeading
            title={t("fuelTitle")}
            description={t("fuelDescription")}
            action={
              <Button variant="ghost" size="sm" onClick={() => onOpenTab("fuel")} rightIcon={<ArrowRight className="rtl-flip" aria-hidden="true" />}>
                {t("open")}
              </Button>
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
              <Button variant="ghost" size="sm" onClick={() => onOpenTab("occupancy")} rightIcon={<ArrowRight className="rtl-flip" aria-hidden="true" />}>
                {t("open")}
              </Button>
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
      <div className="rounded-xl border border-line bg-card">
        <div className="grid grid-cols-2 gap-4 border-b border-line p-4 text-sm sm:grid-cols-4">
          <Stat label={t("trips")} value={fmt.n(s.completed_trips)} />
          <Stat label={t("gpsCoverage")} value={s.gps_km_coverage_pct === null ? "—" : `${fmt.n(s.gps_km_coverage_pct, 1)}%`} />
          <Stat label={t("vehicles")} value={fmt.n(s.vehicles)} />
          <Stat label={t("benchmarks")} value={fmt.n(s.benchmarks)} />
        </div>
        {health.issues.length === 0 ? (
          <p className="flex items-center gap-2 p-4 text-sm text-success-ink">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            {t("allGood")}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {health.issues.map((i) => (
              <li key={i.key} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:gap-4">
                <span className="flex shrink-0 items-center gap-2 sm:w-64">
                  <CircleAlert aria-hidden="true" className={`size-4 shrink-0 ${i.severity === "BLOCKING" ? "text-danger-ink" : i.severity === "WARNING" ? "text-warning-ink" : "text-fg-muted"}`} />
                  <span className="text-sm font-medium text-fg">{t(`issues.${i.key}` as never)}</span>
                  <Tag tone={i.severity === "BLOCKING" ? "danger" : i.severity === "WARNING" ? "warning" : "neutral"}>{i.count}</Tag>
                </span>
                <span className="min-w-0 flex-1 text-sm text-fg-muted">
                  <span className="block">{t(`impact.${i.key}` as never)}</span>
                  {i.items.length > 0 && <span className="mt-1 block truncate text-xs" title={i.items.map((x) => x.label).join(", ")}>{i.items.slice(0, 6).map((x) => x.label).join(", ")}{i.items.length > 6 ? ` +${i.count - 6}` : ""}</span>}
                </span>
                {(i.key === "benchmark_missing" || i.key === "benchmark_fuel_missing") && (
                  <Button variant="outline" size="sm" onClick={onManageBenchmarks} className="self-start">
                    {t("fixBenchmark")}
                  </Button>
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
      <p className="mt-1 text-lg font-semibold tabular-nums text-fg">{value}</p>
    </div>
  );
}
