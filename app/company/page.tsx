"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button, ErrorState, PageHeader } from "@/app/admin/ui";
import { useAppDispatch, useAppSelector } from "../lib/store/hooks";
import {
  clearDashboardCache,
  fetchDashboardStats,
  selectDashboardStats,
  selectDashboardStatus,
} from "../lib/store/slices/dashboardSlice";
import { useAuth } from "../lib/contexts/auth-context";
import { apiClient } from "../lib/services/api-client";
import { formatLocaleDate } from "../lib/i18n/format";
import { useCompanyAccess } from "./lib/access-context";
import { useCompanyBasePath } from "./lib/use-company-base-path";
import Modal from "./bookings/components/Modal";
import CreateBookingForm from "./bookings/components/CreateBookingForm";
import EditBudgetForm from "./components/EditBudgetForm";
import DashboardSkeleton from "./components/DashboardSkeleton";
import LiveMobilityCenter from "./components/LiveMobilityCenter";
import { KpiTile } from "./components/overview/KpiTile";
import { Delta } from "./components/overview/Delta";
import { SpendBudgetCard } from "./components/overview/SpendBudgetCard";
import { AttentionList, type AttentionItem } from "./components/overview/AttentionList";
import { SavingsOpportunities } from "./components/overview/SavingsOpportunities";
import { AdoptionCard, DepartmentsCard, ShuttleSummaryCard } from "./components/overview/UsageCards";
import { ChauffeurActivityCard } from "./components/overview/ChauffeurActivityCard";
import { parseTrend, projectMonthEnd, resolveWeekday, useOverviewFormat } from "./components/overview/format";

type RosterChanges = {
  added_count: number;
  removed_count: number;
  top_route: { route_id: number; route_name: string; added_count: number } | null;
};

const EMPTY_ROSTER: RosterChanges = { added_count: 0, removed_count: 0, top_route: null };

/** Subset of GET /company/cost-optimization/overview/history used here. */
type ShuttleSpendHistory = {
  months?: { month: string; contracted_fixed: number | null; estimated_fuel: number | null }[];
};

/** This month's estimated shuttle cost (contracted fixed + estimated fuel), or null when there's no cost data. */
function currentShuttleCost(history: ShuttleSpendHistory | null): number | null {
  const month = history?.months?.at(-1);
  if (!month || (month.contracted_fixed == null && month.estimated_fuel == null)) return null;
  const total = (month.contracted_fixed ?? 0) + (month.estimated_fuel ?? 0);
  return total > 0 ? total : null;
}

export default function CompanyDashboardPage() {
  const dispatch = useAppDispatch();
  const { access } = useCompanyAccess();
  const { user } = useAuth();
  const { companyPath } = useCompanyBasePath();
  const stats = useAppSelector(selectDashboardStats);
  const status = useAppSelector(selectDashboardStatus);
  const t = useTranslations("company.overview");
  const tErrors = useTranslations("common.errors");
  const tCommon = useTranslations("common");
  const f = useOverviewFormat();

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [rosterState, setRoster] = useState<RosterChanges>(EMPTY_ROSTER);
  /** undefined while loading, null when there's no cost data for this month. */
  const [shuttleCostState, setShuttleCost] = useState<number | null | undefined>(undefined);

  const companyId = user?.company_id?.toString();
  const hasChauffeur = access.services.chauffeur;
  const hasShuttle = access.services.shuttle;
  const roster = hasShuttle ? rosterState : EMPTY_ROSTER;
  const shuttleCost = hasShuttle ? shuttleCostState : null;

  useEffect(() => {
    if (!hasShuttle) return;
    let cancelled = false;
    apiClient
      .request<ShuttleSpendHistory>("/company/cost-optimization/overview/history?months=1")
      .then((data) => !cancelled && setShuttleCost(currentShuttleCost(data)))
      .catch(() => !cancelled && setShuttleCost(null));
    return () => {
      cancelled = true;
    };
  }, [hasShuttle]);

  useEffect(() => {
    if (companyId) dispatch(fetchDashboardStats(companyId));
  }, [dispatch, companyId]);

  useEffect(() => {
    if (!hasShuttle) return;
    let cancelled = false;
    apiClient
      .request<RosterChanges>("/company/roster-changes")
      .then((data) => !cancelled && setRoster(data ?? EMPTY_ROSTER))
      .catch(() => !cancelled && setRoster(EMPTY_ROSTER));
    return () => {
      cancelled = true;
    };
  }, [hasShuttle]);

  if (status === "loading" || (status === "idle" && !stats)) return <DashboardSkeleton />;

  if (status === "failed" || !stats) {
    return (
      <ErrorState
        title={status === "failed" ? tErrors("failedToLoadStats") : tErrors("noCompanyData")}
        onRetry={
          companyId
            ? () => {
                dispatch(clearDashboardCache());
                dispatch(fetchDashboardStats(companyId));
              }
            : undefined
        }
        retryLabel={t("retry")}
      />
    );
  }

  // ── Derived figures (only from real data; anything missing shows as missing) ──
  const c = stats.chauffeur;
  // Spend, budget and the vendor-rate saving come from Cort invoices. Rides run by the company's own
  // drivers are never billed and vendor trips are excluded from spend, so for those companies these
  // figures would always read zero. Billed spend on record also counts, for companies set up before
  // fulfilment flags existed.
  const billedChauffeur = hasChauffeur && (access.has("chauffeur_cort_managed") || c.totalSpendAllTime > 0);
  const spendMtd = billedChauffeur ? c.totalSpend : 0;
  const budget = stats.monthlyBudget && stats.monthlyBudget > 0 ? stats.monthlyBudget : null;
  const projected = billedChauffeur ? projectMonthEnd(spendMtd) : null;
  const spendDelta = parseTrend(c.spendTrend);
  const completedDelta = parseTrend(c.completedTrend);
  const budgetUsed = budget ? (spendMtd / budget) * 100 : null;
  const vendorSavings = billedChauffeur ? c.totalSavings ?? 0 : 0;

  const leakage = stats.costLeakage ?? { aiInsightsEnabled: false, totalPotentialSavingPkr: 0, insights: [] };
  const highPriority = leakage.insights.filter((i) => i.severity === "HIGH" || i.severity === "CRITICAL").length;

  const invoices = c.outstandingInvoices ?? [];
  const overdue = invoices.filter((i) => i.status === "OVERDUE").length;
  const upcoming = hasChauffeur ? stats.alerts?.upcomingBookings ?? 0 : 0;

  const activeEmployees = stats.employees.active;
  const topPassenger = hasChauffeur && c.topPassengers?.[0] ? { name: c.topPassengers[0].name, rides: c.topPassengers[0].trips } : null;
  const peakDayIndex = resolveWeekday(stats.seasonality?.highDemandDayOfWeek, stats.seasonality?.highDemandDay);
  const quietDayIndex = resolveWeekday(stats.seasonality?.lowDemandDayOfWeek, stats.seasonality?.lowDemandDay);

  // ── Needs attention ──
  const attention: AttentionItem[] = [];
  if (hasChauffeur && c.unassignedBookings > 0) {
    attention.push({
      key: "unassigned",
      tone: "warning",
      icon: "unassigned",
      title: t("attention.unassigned", { count: c.unassignedBookings }),
      detail: t("attention.unassignedDetail"),
      href: companyPath("/company/bookings"),
    });
  }
  // Only for companies that can open Invoices; otherwise the row would lead to a blocked page.
  if (access.can.invoicing && c.outstandingAmount > 0) {
    attention.push({
      key: "invoices",
      tone: overdue > 0 ? "danger" : "warning",
      icon: "invoice",
      title: t("attention.outstanding", { amount: f.money(c.outstandingAmount) }),
      detail: t("attention.outstandingDetail", { overdue, pending: invoices.length - overdue }),
      href: companyPath("/company/invoicing"),
    });
  }
  if ((hasChauffeur || hasShuttle) && highPriority > 0) {
    attention.push({
      key: "leakage",
      tone: "warning",
      icon: "leakage",
      title: t("attention.leakage", { count: highPriority }),
      detail: leakage.totalPotentialSavingPkr > 0 ? t("attention.leakageDetail", { amount: f.money(leakage.totalPotentialSavingPkr) }) : undefined,
      href: "#savings",
    });
  }
  if (upcoming > 0) {
    attention.push({
      key: "upcoming",
      tone: "neutral",
      icon: "upcoming",
      title: t("attention.upcoming", { count: upcoming }),
      href: companyPath("/company/bookings"),
    });
  }

  // ── Headline tiles, chosen by what this company actually runs ──
  const savingsKpi = (
    <KpiTile
      key="identified"
      label={t("kpi.identified")}
      value={leakage.insights.length > 0 && leakage.totalPotentialSavingPkr > 0 ? f.money(leakage.totalPotentialSavingPkr) : "—"}
      valueTone={leakage.insights.length > 0 ? "default" : "muted"}
      href={leakage.insights.length > 0 ? "#savings" : undefined}
      sub={
        leakage.insights.length > 0
          ? t("kpi.identifiedSub", { count: leakage.insights.length, high: highPriority })
          : t("kpi.identifiedEmpty")
      }
    />
  );

  const ridesKpi = (
    <KpiTile
      key="rides"
      label={t("kpi.rides")}
      value={f.num(c.completedThisMonth)}
      sub={completedDelta !== undefined ? <Delta value={completedDelta} label={t("vsLastMonth")} /> : t("kpi.spendSub")}
    />
  );

  const shuttleCostKpi = (
    <KpiTile
      key="shuttleCost"
      label={t("kpi.shuttleCost")}
      value={
        shuttleCost === undefined ? (
          // Inline placeholder: the tile's value sits in a <p>, which can't hold a <div> skeleton.
          <span className="inline-block h-8 w-36 animate-pulse rounded-md bg-line align-middle">
            <span className="sr-only">{tCommon("status.loading")}</span>
          </span>
        ) : shuttleCost === null ? (
          "—"
        ) : (
          f.money(shuttleCost)
        )
      }
      valueTone={shuttleCost === null ? "muted" : "default"}
      sub={shuttleCost === null ? t("kpi.shuttleCostEmpty") : t("kpi.shuttleCostSub")}
    />
  );

  const shuttleTripsKpi = (
    <KpiTile
      key="shuttleTrips"
      label={t("kpi.shuttleTrips")}
      value={f.num(stats.shuttle.monthlyTrips)}
      sub={t("kpi.lifetime", { count: f.num(stats.shuttle.totalTripsAllTime) })}
    />
  );

  const upcomingKpi = <KpiTile key="upcoming" label={t("kpi.upcoming")} value={f.num(upcoming)} sub={t("kpi.upcomingSub")} />;

  const employeesKpi = (
    <KpiTile
      key="employees"
      label={t("kpi.activeEmployees")}
      value={f.num(activeEmployees)}
      sub={t("kpi.ofRegistered", { total: f.num(stats.employees.total) })}
    />
  );

  // Billed chauffeur: money first. Otherwise the activity each running service produces.
  const headline = billedChauffeur
    ? [
        <KpiTile
          key="spend"
          label={t("kpi.spend")}
          value={f.money(spendMtd)}
          sub={spendDelta !== undefined ? <Delta value={spendDelta} invert label={t("vsLastMonth")} /> : t("kpi.spendSub")}
        />,
        <KpiTile
          key="budget"
          label={t("kpi.budgetUsed")}
          value={budgetUsed !== null ? f.pct(budgetUsed) : t("kpi.notSet")}
          valueTone={budgetUsed === null ? "muted" : budgetUsed > 100 ? "danger" : "default"}
          sub={
            budget ? (
              t("kpi.budgetUsedSub", { budget: f.money(budget) })
            ) : (
              <button type="button" onClick={() => setIsBudgetOpen(true)} className="font-medium text-brand-ink hover:underline">
                {t("kpi.setBudget")}
              </button>
            )
          }
        />,
        <KpiTile
          key="vendorSavings"
          label={t("kpi.vendorSavings")}
          value={f.money(Math.abs(vendorSavings))}
          valueTone={vendorSavings > 0 ? "success" : vendorSavings < 0 ? "danger" : "default"}
          sub={vendorSavings < 0 ? t("kpi.vendorOver") : t("kpi.vendorSavingsSub")}
        />,
        savingsKpi,
      ]
    : [
        ...(hasChauffeur ? [ridesKpi] : []),
        ...(hasShuttle ? [shuttleCostKpi] : []),
        ...(hasShuttle && !hasChauffeur ? [shuttleTripsKpi] : []),
        ...(hasChauffeur && !hasShuttle ? [upcomingKpi] : []),
        employeesKpi,
        savingsKpi,
      ];

  const shuttleSummary = {
    tripsMtd: stats.shuttle.monthlyTrips,
    tripsLifetime: stats.shuttle.totalTripsAllTime,
    routes: stats.shuttle.totalRoutes,
    added: roster.added_count,
    removed: roster.removed_count,
    topRoute: roster.top_route,
    // Shown in the card only when the headline row is about chauffeur spend; otherwise the row has it.
    costMtd: billedChauffeur ? shuttleCost ?? null : null,
  };

  const today = new Date();

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-6 pb-12">
      <PageHeader
        title={t("title")}
        description={formatLocaleDate(today, f.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={
          hasChauffeur ? (
            <Button leftIcon={<Plus />} onClick={() => setIsBookingOpen(true)}>
              {tCommon("actions.newBooking")}
            </Button>
          ) : undefined
        }
      />

      {/* Headline figures */}
      <section aria-label={t("kpi.sectionLabel")} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {headline}
      </section>

      {/* This month (money where it's billed, activity where it isn't) + what needs action */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          {billedChauffeur ? (
            <SpendBudgetCard
              onEditBudget={() => setIsBudgetOpen(true)}
              data={{
                spendMtd,
                budget,
                projected,
                spendDelta,
                completedRides: c.completedThisMonth,
                completedDelta,
                avgTripCost: c.completedThisMonth > 0 ? spendMtd / c.completedThisMonth : null,
                costPerActiveEmployee: activeEmployees > 0 ? spendMtd / activeEmployees : null,
                spendLifetime: c.totalSpendAllTime,
              }}
            />
          ) : hasChauffeur ? (
            <ChauffeurActivityCard
              data={{
                completedRides: c.completedThisMonth,
                completedDelta,
                upcoming,
                unassigned: c.unassignedBookings,
                completedAllTime: c.completedAllTime,
              }}
            />
          ) : (
            <ShuttleSummaryCard data={shuttleSummary} />
          )}
        </div>
        <AttentionList items={attention} />
      </div>

      {/* Right now: sits between this month's money and the longer-term savings and usage */}
      {(hasChauffeur || hasShuttle) && (
        <LiveMobilityCenter
          data={stats.mobility ?? { activeRides: 0, employeesTraveling: 0, shuttlesRunning: 0, chauffeurRides: 0, upcomingBookings: 0 }}
        />
      )}

      {(hasChauffeur || hasShuttle) && (
        <SavingsOpportunities data={leakage} analyticsHref={companyPath("/company/analytics")} />
      )}

      {/* People and usage */}
      <div className={`grid grid-cols-1 gap-4 ${hasChauffeur && hasShuttle ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <AdoptionCard
          data={{
            active: activeEmployees,
            total: stats.employees.total,
            avgRidesPerActive: hasChauffeur && activeEmployees > 0 ? c.completedThisMonth / activeEmployees : null,
            topPassenger,
            peakDay: hasChauffeur && peakDayIndex !== null ? f.weekday(peakDayIndex) : null,
            quietDay: hasChauffeur && quietDayIndex !== null ? f.weekday(quietDayIndex) : null,
            serviceMix: hasChauffeur && hasShuttle ? { chauffeur: c.completedThisMonth, shuttle: stats.shuttle.monthlyTrips } : null,
          }}
        />
        <DepartmentsCard departments={stats.employees.departmentUsage ?? []} />
        {hasChauffeur && hasShuttle && <ShuttleSummaryCard data={shuttleSummary} />}
      </div>

      <Modal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} title={t("createBooking")}>
        <CreateBookingForm onSuccess={() => setIsBookingOpen(false)} onCancel={() => setIsBookingOpen(false)} />
      </Modal>

      {companyId && (
        <Modal isOpen={isBudgetOpen} onClose={() => setIsBudgetOpen(false)} title={t("editBudget")}>
          <EditBudgetForm
            companyId={companyId}
            currentBudget={budget ?? 0}
            onSuccess={() => setIsBudgetOpen(false)}
            onCancel={() => setIsBudgetOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
