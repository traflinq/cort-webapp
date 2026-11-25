"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, Bus, Car, Fuel, GitMerge, LayoutGrid, Lightbulb, RefreshCw, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/app/lib/services/api-client";
import { formatLocaleNumber } from "@/app/lib/i18n/format";
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
import { Panel, SectionHeading, Tabs } from "./components/ui";
import { useCostFetch, useCostFilters } from "./cost/hooks";
import { CostFilterBar } from "./cost/CostFilterBar";
import { ErrorNote } from "./cost/ui";
import { OverviewPanel } from "./cost/OverviewPanel";
import { FuelPanel } from "./cost/FuelPanel";
import { OccupancyPanel } from "./cost/OccupancyPanel";
import { RecommendationDrawer, RecommendationsPanel } from "./cost/Recommendations";
import { BeforeAfter } from "./cost/BeforeAfter";
import type { FilterOptions, RecommendationList } from "./cost/types";

type TabId = "overview" | "shuttle" | "fuel" | "occupancy" | "routes" | "recommendations" | "chauffeur" | "pool";
const TAB_IDS: TabId[] = ["overview", "shuttle", "fuel", "occupancy", "routes", "recommendations", "chauffeur", "pool"];

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
  const { services, ai, savings, detail, detailLoading, reloadDetail, companyReady } = useAnalyticsData(month);
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
  const recs = useCostFetch<RecommendationList>(ownOps ? "/company/cost-optimization/recommendations" : null);

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
          { id: "shuttle", label: t("tabShuttle"), icon: <Bus />, show: services.shuttle && (cortOps || !ownOps) },
          { id: "fuel", label: t("tabFuel"), icon: <Fuel />, show: ownOps },
          { id: "occupancy", label: t("tabOccupancy"), icon: <Users />, show: ownOps },
          { id: "routes", label: t("tabRoutes"), icon: <GitMerge />, show: ownOps },
          { id: "recommendations", label: t("tabRecommendations"), icon: <Lightbulb />, show: ownOps },
          { id: "chauffeur", label: t("tabChauffeur"), icon: <UserRound />, show: services.chauffeur },
          { id: "pool", label: t("tabPool"), icon: <Car />, show: services.pool },
        ] as const
      )
        .filter((x) => x.show)
        .map(({ id, label, icon }) => ({ id: id as TabId, label, icon })),
    [services, ownOps, cortOps, t],
  );

  const requested = searchParams.get("tab") as TabId | null;
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

  const anyService = services.shuttle || services.chauffeur || services.pool;
  // Shuttle insights now come from the optimization engine (Recommendations); keep chauffeur / pool ones.
  const allInsights = [...insightsFor(detail.insights, "chauffeur"), ...insightsFor(detail.insights, "pool")].sort(bySaving);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 pb-12">
      <PageHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
        action={
          <>
            {ai && anyService && (
              <button
                type="button"
                onClick={runAnalysis}
                disabled={generating}
                className="flex items-center gap-2 whitespace-nowrap rounded-2xl bg-[var(--cort-orange)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--cort-orange-hover)] disabled:opacity-60"
              >
                <RefreshCw className={`size-4 ${generating ? "animate-spin" : ""}`} />
                {generating ? t("generating") : t("runAiAnalysis")}
              </button>
            )}
          </>
        }
      />

      {companyReady && !anyService ? (
        <Panel className="p-6 text-sm text-fg-muted">{t("noServices")}</Panel>
      ) : (
        <>
          <Tabs tabs={tabs} active={active} onChange={setTab} label={t("tabsLabel")} />

          {filterOptions.error && <ErrorNote message={tCost("filtersFailed")} detail={filterOptions.error} onRetry={filterOptions.reload} />}

          <CostFilterBar
            filters={filters}
            onChange={setFilters}
            options={filterOptions.data}
            showScope={ownOps && ["overview", "fuel", "occupancy"].includes(active)}
          />

          {savingsFailed && (
            <div className="flex items-center gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-ink">
              <AlertCircle className="size-5 shrink-0" />
              {t("loadFailed")}
            </div>
          )}

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
                  <section className="flex flex-col gap-4">
                    <h3 className="text-base font-semibold text-fg">{t("servicesTitle")}</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                    </div>
                  </section>
                )}

                <InsightsSection
                  title={t("insightsTitle")}
                  description={t("insightsDescription")}
                  insights={allInsights}
                  aiEnabled={ai}
                  action={
                    ai && potentialSaving(allInsights) > 0 ? (
                      <span className="rounded-full bg-success-soft px-3 py-1 text-sm font-semibold text-success-ink">
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
                  {!data && savings.loading && <div className="h-44 animate-pulse rounded-3xl border border-line bg-card" />}
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

            {active === "routes" && (
              <>
                <RecommendationsPanel
                  list={recs}
                  onOpen={setOpenRec}
                  types={["FLEET_REPLAN", "ROUTE_REDISTRIBUTE", "ROUTE_MERGE", "ROUTE_RESEQUENCE"]}
                  title={t("routesTitle")}
                  description={t("routesDescription")}
                  aiEnabled={ai}
                />
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

            {active === "recommendations" && (
              <RecommendationsPanel list={recs} onOpen={setOpenRec} title={t("recsTitle")} description={t("recsDescription")} aiEnabled={ai} />
            )}

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

            {(active === "shuttle" || active === "chauffeur" || active === "pool") && (savings.loading || detailLoading) && (
              <div className="flex items-center justify-center py-10 text-sm text-fg-muted" aria-busy="true">
                <RefreshCw className="me-2 size-5 animate-spin" /> {t("loading")}
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
  if (loading || !data) return loading ? <div className="h-44 animate-pulse rounded-3xl border border-line bg-card" /> : null;
  if (data.locked) return <SavingsLockedView data={data} />;
  return <UnlockedHero data={data} />;
}

function UnlockedHero({ data }: { data: SavingsDashboardFull }) {
  const periodLabel = usePeriodLabel(data.period);
  return <SavingsHero total={data.total_savings_pkr} periodLabel={periodLabel} analysisReady={data.analysis_ready} />;
}

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
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 text-start transition-colors hover:border-brand-line hover:bg-subtle/40"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink [&_svg]:size-[18px]">{icon}</span>
          <span className="text-sm font-semibold text-fg">{title}</span>
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-fg-muted group-hover:text-fg">
          {t("viewDetails")}
          <ArrowRight className="size-3.5 rtl-flip" />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-fg-muted">{s.label}</p>
            <p className="mt-0.5 text-xl font-semibold tracking-tight text-fg tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
    </button>
  );
}
