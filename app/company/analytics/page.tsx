"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bus, Car, ChevronRight, Fuel, LayoutGrid, Leaf, Lightbulb, RefreshCw, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/app/lib/services/api-client";
import { formatLocaleNumber } from "@/app/lib/i18n/format";
import { Button, Spinner, focusRingInset } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import { PageHeader } from "../components/PageLayout";
import { CompanyBenchmarksModal } from "../components/CompanyBenchmarksModal";
import {
  ChauffeurTab,
  PoolTab,
  SavingsHero,
  SavingsLockedView,
  ShuttleTab,
  usePeriodLabel,
} from "@/app/components/savings/SavingsDashboard";
import type { SavingsDashboardFull, SavingsDashboardResponse } from "@/app/components/savings/types";
import { getSaudiBasePath, withSaudiBase } from "@/app/lib/i18n/saudi-route";
import { useAnalyticsData } from "./useAnalyticsData";
import { bySaving, insightsFor, InsightsSection, potentialSaving } from "./components/insights";
import { ShuttleTripQuality } from "./components/ShuttleTripQuality";
import { ChauffeurPackageUse } from "./components/ChauffeurPackageUse";
import { PoolCarUtilization } from "./components/PoolCarUtilization";
import { SectionHeading, Tabs } from "./components/ui";
import { useCostFetch, useCostFilters } from "./cost/hooks";
import { CostFilterBar } from "./cost/CostFilterBar";
import { ErrorNote, Skeleton } from "./cost/ui";
import { OverviewPanel } from "./cost/OverviewPanel";
import { FuelPanel } from "./cost/FuelPanel";
import { OccupancyPanel } from "./cost/OccupancyPanel";
import { CarbonPanel } from "./cost/CarbonPanel";
import { RecommendationDrawer, RecommendationsPanel } from "./cost/Recommendations";
import { BeforeAfter } from "./cost/BeforeAfter";
import type { FilterOptions, RecommendationList } from "./cost/types";

type TabId = "overview" | "shuttle" | "fuel" | "occupancy" | "recommendations" | "carbon" | "chauffeur" | "pool";
const TAB_IDS: TabId[] = ["overview", "shuttle", "fuel", "occupancy", "recommendations", "carbon", "chauffeur", "pool"];
/** Old links: the Routes tab was merged into Recommendations (its type filter covers route recommendations). */
const TAB_ALIASES: Record<string, TabId> = { routes: "recommendations" };

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsContent />
    </Suspense>
  );
}

function AnalyticsContent() {
  const t = useTranslations("company.analytics");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = getSaudiBasePath(pathname);
  const locale = useLocale() as Locale;
  const n = (v: number | null | undefined, dp = 0) =>
    v == null ? "—" : formatLocaleNumber(v, locale, { maximumFractionDigits: dp, minimumFractionDigits: 0 });
  const pkr = (v: number) => `${tCommon("currency.pkr")} ${n(Math.round(v))}`;

  // One date range for the whole page; the monthly savings sections follow the month of its end date.
  const { filters, set: setFilters } = useCostFilters();
  const month = filters.to.slice(0, 7);
  const { services, ai, savings, detail, detailLoading, reloadDetail } = useAnalyticsData(month);
  const tCost = useTranslations("company.costOptimization");
  const [benchmarksOpen, setBenchmarksOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [openRec, setOpenRec] = useState<number | null>(null);
  // Bumped after a run or a rate change so the cost panels refetch.
  const [refresh, setRefresh] = useState(0);
  const filterOptions = useCostFetch<FilterOptions>(services.shuttle ? "/company/cost-optimization/filters" : null);
  // Two kinds of shuttle operation: the company's own vendors' / own cars (vendor-rate analysis and recommendations),
  // and Traflinq's managed service (savings since switching, against what they paid their vendor before).
  const scope = filterOptions.data?.scope;
  const ownOps = services.shuttle && (scope?.company_managed_vehicles ?? 0) > 0;
  const cortOps = services.shuttle && (scope?.cort_managed_vehicles ?? 0) > 0;
  // Which tabs and overview a shuttle company gets depends on whose vehicles run its shuttles, so
  // nothing is drawn until that is known; a failure is shown as such, never as the other layout.
  const scopeState: "ready" | "loading" | "error" = !services.shuttle || scope ? "ready" : filterOptions.error ? "error" : "loading";
  const recs = useCostFetch<RecommendationList>(ownOps ? "/company/cost-optimization/recommendations" : null);
  // Traflinq-managed shuttle (or scope not known yet) gets its own Shuttle tab; trip quality lives there when it exists,
  // otherwise on Recommendations, so it is never shown on two tabs.
  const showShuttleTab = services.shuttle && (cortOps || !ownOps);

  // Don't show last month's figures under the new month's heading.
  const data: SavingsDashboardResponse | null = savings.loading || savings.error ? null : savings.data;
  const savingsFailed = !savings.loading && !!savings.error;
  const beforeAfterPeriod = usePeriodLabel(data?.period ?? { month, is_mtd: false });

  const tabs = useMemo(
    () =>
      (
        [
          { id: "overview", label: t("tabOverview"), icon: <LayoutGrid />, show: true },
          // Traflinq-managed shuttle (or scope not known yet): before / after savings, KPIs, vehicles, trip quality.
          { id: "shuttle", label: t("tabShuttle"), icon: <Bus />, show: showShuttleTab },
          { id: "fuel", label: t("tabFuel"), icon: <Fuel />, show: ownOps },
          { id: "occupancy", label: t("tabOccupancy"), icon: <Users />, show: ownOps },
          { id: "recommendations", label: t("tabRecommendations"), icon: <Lightbulb />, show: ownOps },
          { id: "carbon", label: t("tabCarbon"), icon: <Leaf />, show: ownOps },
          { id: "chauffeur", label: t("tabChauffeur"), icon: <UserRound />, show: services.chauffeur },
          { id: "pool", label: t("tabPool"), icon: <Car />, show: services.pool },
        ] as const
      )
        .filter((x) => x.show)
        .map(({ id, label, icon }) => ({ id: id as TabId, label, icon })),
    [services, ownOps, showShuttleTab, t],
  );

  const rawTab = searchParams.get("tab");
  const requested = (rawTab && (TAB_ALIASES[rawTab] ?? rawTab)) as TabId | null;
  const active: TabId = requested && TAB_IDS.includes(requested) && tabs.some((x) => x.id === requested) ? requested : "overview";
  const setTab = (id: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "overview") params.delete("tab");
    else params.set("tab", id);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  // Shuttle → the evidence-based optimization engine; chauffeur / pool → the existing fleet insights.
  const runAnalysis = async () => {
    setGenerating(true);
    const jobs: Promise<unknown>[] = [];
    if (ownOps) {
      // No range: the engine analyses its default window (the last 30 days), whatever the page filter shows.
      jobs.push(apiClient.request("/company/cost-optimization/runs", { method: "POST" }));
    }
    if (!ownOps || services.chauffeur || services.pool) jobs.push(apiClient.request<{ generated: number }>("/company/fleet-insights/generate", { method: "POST" }));
    const results = await Promise.allSettled(jobs);
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    // e.g. the 15-minute cooldown
    for (const f of failed) toast.error(f.reason instanceof Error && f.reason.message ? f.reason.message : t("generateFailed"));
    if (failed.length < results.length) toast.success(t("analysisDone"));
    recs.reload();
    reloadDetail();
    setRefresh((x) => x + 1);
    setGenerating(false);
  };

  // Shuttle insights now come from the optimization engine (Recommendations); keep chauffeur / pool ones.
  const allInsights = [...insightsFor(detail.insights, "chauffeur"), ...insightsFor(detail.insights, "pool")].sort(bySaving);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12">
      <PageHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
        action={
          <>
            {ai && scopeState === "ready" && (
              <Button onClick={runAnalysis} loading={generating} leftIcon={<RefreshCw aria-hidden="true" />}>
                {generating ? t("generating") : t("runAiAnalysis")}
              </Button>
            )}
          </>
        }
      />

      {scopeState === "error" ? (
        <ErrorNote message={tCost("filtersFailed")} detail={filterOptions.error} onRetry={filterOptions.reload} />
      ) : scopeState === "loading" ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <Skeleton className="h-12" />
          <Skeleton className="h-16" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <Tabs tabs={tabs} active={active} onChange={setTab} label={t("tabsLabel")} />

          <CostFilterBar
            filters={filters}
            onChange={setFilters}
            options={filterOptions.data}
            showScope={ownOps && ["overview", "fuel", "occupancy", "carbon"].includes(active)}
          />

          {savingsFailed && <ErrorNote message={t("loadFailed")} detail={savings.error} onRetry={savings.reload} />}

          <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="flex flex-col gap-8">
            {active === "overview" && (
              <>
                {ownOps && (
                  <OverviewPanel key={refresh} filters={filters} onOpenTab={setTab} onManageBenchmarks={() => setBenchmarksOpen(true)} />
                )}

                {/* Traflinq-managed service: what they paid their vendor before vs what switching saved. */}
                {/* Headline savings (Traflinq-managed service, chauffeur audit); the shuttle detail is in its tab. */}
                {(!ownOps || cortOps) && <OverviewSavings data={data} loading={savings.loading} />}

                {data && (
                  <section className="flex flex-col gap-3">
                    <h3 className="text-base font-semibold text-fg">{t("servicesTitle")}</h3>
                    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
                      {services.shuttle && data.shuttle && (
                        <ServiceCard
                          icon={<Bus />}
                          title={t("tabShuttle")}
                          stats={[
                            { label: t("occupancy"), value: `${n(data.shuttle.kpis.occupancy_pct.current, 1)}%` },
                            { label: t("totalKm"), value: n(data.shuttle.kpis.total_km.current) },
                          ]}
                          onOpen={() => setTab(ownOps && !cortOps ? "occupancy" : "shuttle")}
                        />
                      )}
                      {services.chauffeur && data.chauffeur && (
                        <ServiceCard
                          icon={<UserRound />}
                          title={t("tabChauffeur")}
                          stats={[
                            { label: t("rides"), value: n(data.chauffeur.kpis.rides.current) },
                            {
                              label: t("avgCostPerRide"),
                              value: data.chauffeur.kpis.avg_cost_per_ride.current == null ? "—" : pkr(data.chauffeur.kpis.avg_cost_per_ride.current),
                            },
                          ]}
                          onOpen={() => setTab("chauffeur")}
                        />
                      )}
                      {services.pool && data.pool && (
                        <ServiceCard
                          icon={<Car />}
                          title={t("tabPool")}
                          stats={[
                            { label: t("tripsPerCar"), value: n(data.pool.kpis.trips_per_vehicle.current, 1) },
                            { label: t("idleCars"), value: n(data.pool.kpis.idle_vehicles.current) },
                          ]}
                          onOpen={() => setTab("pool")}
                        />
                      )}
                    </ul>
                  </section>
                )}

                <InsightsSection
                  title={t("insightsTitle")}
                  description={t("insightsDescription")}
                  insights={allInsights}
                  aiEnabled={ai}
                  action={
                    ai && potentialSaving(allInsights) > 0 ? (
                      <span className="text-sm font-semibold text-success-ink tabular-nums">
                        {t("couldSave", { amount: pkr(potentialSaving(allInsights)) })}
                      </span>
                    ) : undefined
                  }
                />
              </>
            )}

            {active === "shuttle" && (
              <>
                {/* Traflinq-managed service: what they paid their vendor before vs what switching saved. */}
                <section className="flex flex-col gap-4">
                  <SectionHeading title={t("benchmarkTitle")} description={t("benchmarkDescription")} />
                  {data?.shuttle?.savings && (
                    <BeforeAfter savings={data.shuttle.savings} periodLabel={beforeAfterPeriod} onManageBenchmarks={() => setBenchmarksOpen(true)} />
                  )}
                  {data?.shuttle && <ShuttleTab s={data.shuttle} onManageBenchmarks={() => setBenchmarksOpen(true)} />}
                  {!data && savings.loading && <Skeleton className="h-44" />}
                </section>
                {!detailLoading && (
                  <ShuttleTripQuality
                    summary={detail.shuttleSummary}
                    metrics={detail.shuttleMetrics}
                    fuelFlags={detail.fuelFlags}
                    insights={detail.insights}
                  />
                )}
              </>
            )}

            {active === "fuel" && (
              <FuelPanel key={refresh} filters={filters} recommendations={recs.data?.recommendations ?? []} onOpenRecommendation={setOpenRec} />
            )}

            {active === "occupancy" && <OccupancyPanel key={refresh} filters={filters} />}

            {active === "recommendations" && (
              <>
                <RecommendationsPanel list={recs} onOpen={setOpenRec} title={t("recsTitle")} description={t("recsDescription")} aiEnabled={ai} />
                {!showShuttleTab && !detailLoading && (
                  <ShuttleTripQuality
                    summary={detail.shuttleSummary}
                    metrics={detail.shuttleMetrics}
                    fuelFlags={detail.fuelFlags}
                    insights={detail.insights}
                  />
                )}
              </>
            )}

            {active === "carbon" && <CarbonPanel key={refresh} filters={filters} onOpenRecommendation={setOpenRec} />}

            {active === "chauffeur" && (
              <>
                {data?.chauffeur && <ChauffeurTab c={data.chauffeur} auditHref={withSaudiBase("/company/reports/chauffeur", basePath)} />}
                <InsightsSection title={t("serviceInsightsTitle")} insights={insightsFor(allInsights, "chauffeur")} aiEnabled={ai} />
                {!detailLoading && detail.chauffeur && <ChauffeurPackageUse data={detail.chauffeur} />}
              </>
            )}

            {active === "pool" && (
              <>
                {data?.pool && <PoolTab p={data.pool} />}
                <InsightsSection title={t("serviceInsightsTitle")} insights={insightsFor(allInsights, "pool")} aiEnabled={ai} />
                {!detailLoading && detail.pool && <PoolCarUtilization data={detail.pool} />}
              </>
            )}

            {/* One loading indicator per tab: the shuttle tab already shows a skeleton while savings load. */}
            {((active === "shuttle" && detailLoading && !savings.loading) ||
              ((active === "chauffeur" || active === "pool") && (savings.loading || detailLoading))) && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-fg-muted" aria-busy="true">
                <Spinner size="sm" label={t("loading")} />
                <span aria-hidden="true">{t("loading")}</span>
              </div>
            )}
          </div>
        </>
      )}

      <CompanyBenchmarksModal
        isOpen={benchmarksOpen}
        onClose={() => setBenchmarksOpen(false)}
        onChanged={() => {
          savings.reload();
          setRefresh((x) => x + 1);
        }}
        purpose={ownOps ? "vendorRates" : "preTraflinq"}
      />
      <RecommendationDrawer
        id={openRec}
        onClose={() => setOpenRec(null)}
      />
    </div>
  );
}

/** Savings hero: full total once unlocked; otherwise the teaser total and the unlock note. */
function OverviewSavings({ data, loading }: { data: SavingsDashboardResponse | null; loading: boolean }) {
  if (loading || !data) return loading ? <Skeleton className="h-44" /> : null;
  if (data.locked) return <SavingsLockedView data={data} />;
  return <UnlockedHero data={data} />;
}

function UnlockedHero({ data }: { data: SavingsDashboardFull }) {
  const periodLabel = usePeriodLabel(data.period);
  return <SavingsHero total={data.total_savings_pkr} periodLabel={periodLabel} analysisReady={data.analysis_ready} />;
}

/** One service in the overview list: name, two headline figures, and a way into its tab. */
function ServiceCard({
  icon,
  title,
  stats,
  onOpen,
}: {
  icon: React.ReactNode;
  title: string;
  stats: { label: string; value: string }[];
  onOpen: () => void;
}) {
  const t = useTranslations("company.analytics");
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${title}: ${t("viewDetails")}`}
        className={cn(
          "group flex w-full flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 text-start transition-colors hover:bg-row-hover sm:flex-nowrap sm:px-5",
          focusRingInset,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5 sm:w-48 sm:flex-none">
          <span className="shrink-0 text-fg-muted [&_svg]:size-4" aria-hidden="true">
            {icon}
          </span>
          <span className="truncate text-sm font-semibold text-fg">{title}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-fg-muted transition-colors group-hover:text-fg rtl:rotate-180 sm:order-last" aria-hidden="true" />
        <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-1 sm:flex sm:w-auto sm:flex-1 sm:gap-10">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="truncate text-xs text-fg-muted">{s.label}</dt>
              <dd className="text-sm font-semibold text-fg tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </button>
    </li>
  );
}
