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
import { parseTrend, projectMonthEnd, useOverviewFormat } from "./components/overview/format";

type RosterChanges = {
  added_count: number;
  removed_count: number;
  top_route: { route_id: number; route_name: string; added_count: number } | null;
};

const EMPTY_ROSTER: RosterChanges = { added_count: 0, removed_count: 0, top_route: null };

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

  const companyId = user?.company_id?.toString();
  const hasChauffeur = access.services.chauffeur;
  const hasShuttle = access.services.shuttle;
  const roster = hasShuttle ? rosterState : EMPTY_ROSTER;

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
  const spendMtd = hasChauffeur ? c.totalSpend : 0;
  const budget = stats.monthlyBudget && stats.monthlyBudget > 0 ? stats.monthlyBudget : null;
  const projected = hasChauffeur ? projectMonthEnd(spendMtd) : null;
  const spendDelta = parseTrend(c.spendTrend);
  const budgetUsed = budget ? (spendMtd / budget) * 100 : null;
  const vendorSavings = hasChauffeur ? c.totalSavings ?? 0 : 0;

  const leakage = stats.costLeakage ?? { aiInsightsEnabled: false, totalPotentialSavingPkr: 0, insights: [] };
  const highPriority = leakage.insights.filter((i) => i.severity === "HIGH" || i.severity === "CRITICAL").length;

  const invoices = c.outstandingInvoices ?? [];
  const overdue = invoices.filter((i) => i.status === "OVERDUE").length;
  const upcoming = hasChauffeur ? stats.alerts?.upcomingBookings ?? 0 : 0;

  const activeEmployees = stats.employees.active;
  const topPassenger = hasChauffeur && c.topPassengers?.[0] ? { name: c.topPassengers[0].name, rides: c.topPassengers[0].trips } : null;

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
  if (c.outstandingAmount > 0) {
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

  const savingsKpi = (
    <KpiTile
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

  const shuttleSummary = {
    tripsMtd: stats.shuttle.monthlyTrips,
    tripsLifetime: stats.shuttle.totalTripsAllTime,
    routes: stats.shuttle.totalRoutes,
    added: roster.added_count,
    removed: roster.removed_count,
    topRoute: roster.top_route,
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
        {hasChauffeur ? (
          <>
            <KpiTile
              label={t("kpi.spend")}
              value={f.money(spendMtd)}
              sub={spendDelta !== undefined ? <Delta value={spendDelta} invert label={t("vsLastMonth")} /> : t("kpi.spendSub")}
            />
            <KpiTile
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
            />
            <KpiTile
              label={t("kpi.vendorSavings")}
              value={f.money(Math.abs(vendorSavings))}
              valueTone={vendorSavings > 0 ? "success" : vendorSavings < 0 ? "danger" : "default"}
              sub={vendorSavings < 0 ? t("kpi.vendorOver") : t("kpi.vendorSavingsSub")}
            />
            {savingsKpi}
          </>
        ) : (
          <>
            <KpiTile label={t("kpi.shuttleTrips")} value={f.num(stats.shuttle.monthlyTrips)} sub={t("kpi.lifetime", { count: f.num(stats.shuttle.totalTripsAllTime) })} />
            <KpiTile label={t("kpi.routes")} value={f.num(stats.shuttle.totalRoutes)} sub={t("kpi.rosterSub", { added: roster.added_count, removed: roster.removed_count })} />
            <KpiTile
              label={t("kpi.activeEmployees")}
              value={f.num(activeEmployees)}
              sub={t("kpi.ofRegistered", { total: f.num(stats.employees.total) })}
            />
            {savingsKpi}
          </>
        )}
      </section>

      {/* Spend + what needs action */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          {hasChauffeur ? (
            <SpendBudgetCard
              onEditBudget={() => setIsBudgetOpen(true)}
              data={{
                spendMtd,
                budget,
                projected,
                spendDelta,
                completedRides: c.completedThisMonth,
                completedDelta: parseTrend(c.completedTrend),
                avgTripCost: c.completedThisMonth > 0 ? spendMtd / c.completedThisMonth : null,
                costPerActiveEmployee: activeEmployees > 0 ? spendMtd / activeEmployees : null,
                spendLifetime: c.totalSpendAllTime,
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
            peakDay: hasChauffeur ? stats.seasonality?.highDemandDay || null : null,
            quietDay: hasChauffeur ? stats.seasonality?.lowDemandDay || null : null,
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
