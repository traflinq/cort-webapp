"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, Bus, Car, LayoutGrid, RefreshCw, UserRound } from "lucide-react";
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
  SavingsMonthPicker,
  ShuttleTab,
  usePeriodLabel,
} from "@/app/components/savings/SavingsDashboard";
import { monthKey, type SavingsDashboardFull, type SavingsDashboardResponse } from "@/app/components/savings/types";
import { getSaudiBasePath, withSaudiBase } from "@/app/lib/i18n/saudi-route";
import { useAnalyticsData } from "./useAnalyticsData";
import { bySaving, insightsFor, InsightsSection, potentialSaving, type AnalyticsService } from "./components/insights";
import { ShuttleTripQuality } from "./components/ShuttleTripQuality";
import { ChauffeurPackageUse } from "./components/ChauffeurPackageUse";
import { PoolCarUtilization } from "./components/PoolCarUtilization";
import { Panel, Tabs } from "./components/ui";

type TabId = "overview" | AnalyticsService;
const TAB_IDS: TabId[] = ["overview", "shuttle", "chauffeur", "pool"];

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

  const [month, setMonth] = useState(() => monthKey());
  const { services, ai, savings, detail, detailLoading, reloadDetail, companyReady } = useAnalyticsData(month);
  const [benchmarksOpen, setBenchmarksOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Don't show last month's figures under the new month's heading.
  const data: SavingsDashboardResponse | null = savings.loading || savings.error ? null : savings.data;
  const savingsFailed = !savings.loading && !!savings.error;

  const tabs = useMemo(
    () =>
      (
        [
          { id: "overview", label: t("tabOverview"), icon: <LayoutGrid />, show: true },
          { id: "shuttle", label: t("tabShuttle"), icon: <Bus />, show: services.shuttle },
          { id: "chauffeur", label: t("tabChauffeur"), icon: <UserRound />, show: services.chauffeur },
          { id: "pool", label: t("tabPool"), icon: <Car />, show: services.pool },
        ] as const
      )
        .filter((x) => x.show)
        .map(({ id, label, icon }) => ({ id: id as TabId, label, icon })),
    [services, t],
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

  const runAnalysis = async () => {
    setGenerating(true);
    try {
      await apiClient.request<{ generated: number }>("/company/fleet-insights/generate", { method: "POST" });
      reloadDetail();
    } catch (e) {
      // e.g. the 15-minute cooldown
      toast.error(e instanceof Error && e.message ? e.message : t("generateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  const anyService = services.shuttle || services.chauffeur || services.pool;
  const allInsights = [...detail.insights].sort(bySaving);

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
            <SavingsMonthPicker month={month} onChange={setMonth} />
          </>
        }
      />

      {companyReady && !anyService ? (
        <Panel className="p-6 text-sm text-fg-muted">{t("noServices")}</Panel>
      ) : (
        <>
          <Tabs tabs={tabs} active={active} onChange={setTab} label={t("tabsLabel")} />

          {savingsFailed && (
            <div className="flex items-center gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-ink">
              <AlertCircle className="size-5 shrink-0" />
              {t("loadFailed")}
            </div>
          )}

          <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="flex flex-col gap-8">
            {active === "overview" && (
              <>
                <OverviewSavings data={data} loading={savings.loading} />

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
                          onOpen={() => setTab("shuttle")}
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
                {data?.shuttle && <ShuttleTab s={data.shuttle} onManageBenchmarks={() => setBenchmarksOpen(true)} />}
                <InsightsSection title={t("serviceInsightsTitle")} insights={insightsFor(allInsights, "shuttle")} aiEnabled={ai} />
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

            {active === "chauffeur" && (
              <>
                {data?.chauffeur && <ChauffeurTab c={data.chauffeur} auditHref={withSaudiBase("/company/reports/chauffeur", basePath)} />}
                <InsightsSection title={t("serviceInsightsTitle")} insights={insightsFor(allInsights, "chauffeur")} aiEnabled={ai} />
                {!detailLoading && detail.chauffeur && <ChauffeurPackageUse data={detail.chauffeur} />}
              </>
            )}

            {active === "pool" && (
              <>
                {data?.pool && <PoolTab p={data.pool} range={"current" in data.period ? data.period.current : undefined} />}
                <InsightsSection title={t("serviceInsightsTitle")} insights={insightsFor(allInsights, "pool")} aiEnabled={ai} />
                {!detailLoading && detail.pool && <PoolCarUtilization data={detail.pool} />}
              </>
            )}

            {(savings.loading || (active !== "overview" && detailLoading)) && (
              <div className="flex items-center justify-center py-10 text-sm text-fg-muted" aria-busy="true">
                <RefreshCw className="me-2 size-5 animate-spin" /> {t("loading")}
              </div>
            )}
          </div>
        </>
      )}

      <CompanyBenchmarksModal isOpen={benchmarksOpen} onClose={() => setBenchmarksOpen(false)} onChanged={savings.reload} />
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
