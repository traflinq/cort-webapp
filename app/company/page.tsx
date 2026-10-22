"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Car, CheckCircle2, CreditCard, Plus, Route, Users, Wallet } from "lucide-react";
import { Button, CardSkeleton, Drawer, DrawerContent, Dialog, DialogContent, ErrorState, KpiCard, KpiGrid, KpiSkeleton, PageHeader, RefreshButton, useFormatters } from "@/app/ui";
import { useAppDispatch, useAppSelector } from "../lib/store/hooks";
import { clearDashboardCache, fetchDashboardStats, selectDashboardStats, selectDashboardStatus } from "../lib/store/slices/dashboardSlice";
import { selectCompany } from "../lib/store/slices/companySlice";
import { useAuth } from "../lib/contexts/auth-context";
import { apiClient } from "../lib/services/api-client";
import { useCompanyBasePath } from "./lib/use-company-base-path";
import CreateBookingForm from "./bookings/components/CreateBookingForm";
import EditBudgetForm from "./components/EditBudgetForm";
import LiveMobilityCenter from "./components/LiveMobilityCenter";
import CostLeakageDetector from "./components/CostLeakageDetector";
import { CostVisibilityCard } from "./components/dashboard/CostVisibilityCard";
import { EmployeeUsageCard } from "./components/dashboard/EmployeeUsageCard";
import { InsightsCard } from "./components/dashboard/InsightsCard";
import { ServiceSplitCard } from "./components/dashboard/ServiceSplitCard";
import { OutstandingInvoicesDialog } from "./components/dashboard/OutstandingInvoicesDialog";
import { parseTrend } from "./components/dashboard/helpers";

type RosterChanges = {
  added_count: number;
  removed_count: number;
  top_route: { route_id: number; route_name: string; added_count: number } | null;
};
const EMPTY_ROSTER: RosterChanges = { added_count: 0, removed_count: 0, top_route: null };

export default function CompanyDashboardPage() {
  const dispatch = useAppDispatch();
  const company = useAppSelector(selectCompany);
  const stats = useAppSelector(selectDashboardStats);
  const status = useAppSelector(selectDashboardStatus);
  const t = useTranslations("company.dashboard");
  const tErrors = useTranslations("common.errors");
  const tCommon = useTranslations("common");
  const { formatCurrency, formatDate } = useFormatters();
  const { companyPath } = useCompanyBasePath();
  const { user } = useAuth();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [fetchedRoster, setRosterChanges] = useState<RosterChanges>(EMPTY_ROSTER);
  const companyId = user?.company_id?.toString();

  useEffect(() => {
    if (companyId) dispatch(fetchDashboardStats(companyId));
  }, [dispatch, companyId]);

  // Prefer servicesEnabled from dashboard stats (authoritative), fall back to the company profile while loading.
  const hasChauffeur = stats?.servicesEnabled?.chauffeur_enabled ?? company?.services_enabled?.chauffeur_enabled ?? false;
  const hasShuttle = stats?.servicesEnabled?.shuttle_enabled ?? company?.services_enabled?.shuttle_enabled ?? false;
  const rosterChanges = hasShuttle ? fetchedRoster : EMPTY_ROSTER;

  useEffect(() => {
    if (!hasShuttle) return;
    let cancelled = false;
    apiClient
      .request<RosterChanges>("/company/roster-changes")
      .then((data) => {
        if (!cancelled) setRosterChanges(data);
      })
      .catch(() => {
        if (!cancelled) setRosterChanges(EMPTY_ROSTER);
      });
    return () => {
      cancelled = true;
    };
  }, [hasShuttle]);

  const refresh = () => {
    if (!companyId) return;
    dispatch(clearDashboardCache());
    dispatch(fetchDashboardStats(companyId));
  };

  const insights = useMemo(() => {
    if (!stats) return [];
    const list: string[] = [];
    if (hasChauffeur) {
      const trend = parseTrend(stats.chauffeur.spendTrend);
      if (trend !== null && trend < 0) list.push(t("insightSpendingDown", { percent: `${Math.abs(trend)}%` }));
      else if (trend !== null && trend > 0) list.push(t("insightSpendingUp", { percent: `${trend}%` }));
      if (stats.chauffeur.topPassengers.length > 0) list.push(t("insightTopPassenger", { name: stats.chauffeur.topPassengers[0].name }));
    }
    if (stats.employees.departmentUsage.length > 0) {
      list.push(t("insightTopDepartment", { name: stats.employees.departmentUsage[0].name, percent: stats.employees.departmentUsage[0].percentage }));
    }
    if (hasShuttle && stats.shuttle.monthlyTrips > 0) list.push(t("insightShuttleTrips", { trips: stats.shuttle.monthlyTrips, routes: stats.shuttle.totalRoutes }));
    if (list.length === 0) list.push(t("insightStartUsing"));
    return list;
  }, [stats, hasChauffeur, hasShuttle, t]);

  const loading = status === "loading" && !stats;
  const firstName = user?.full_name?.split(" ")[0] || tCommon("misc.admin");
  const todayBookings = hasChauffeur ? (stats?.alerts.upcomingBookings ?? 0) : 0;

  const header = (
    <PageHeader
      title={`${t("welcomeBack")} ${firstName}`}
      description={`${formatDate(new Date())} · ${hasChauffeur ? t("upcomingBookings", { count: todayBookings }) : t("servicesActive")}`}
      actions={
        <>
          <RefreshButton label={tCommon("ui.refresh")} loading={status === "loading"} onClick={refresh} />
          {hasChauffeur && (
            <Button leftIcon={<Plus />} onClick={() => setBookingOpen(true)}>
              {tCommon("actions.newBooking")}
            </Button>
          )}
        </>
      }
    />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <KpiGrid cols={4}>
          {[0, 1, 2, 3].map((i) => (
            <KpiSkeleton key={i} />
          ))}
        </KpiGrid>
        <CardSkeleton lines={6} />
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    );
  }

  if (status === "failed" || !stats || !company) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState title={tErrors("failedToLoadStats")} message={!stats && status !== "failed" ? tErrors("noCompanyData") : undefined} onRetry={refresh} />
      </div>
    );
  }

  const ch = stats.chauffeur;
  const completedTrend = parseTrend(ch.completedTrend);
  const spendTrend = parseTrend(ch.spendTrend);
  const avgTripCost = hasChauffeur && ch.completedThisMonth > 0 ? Math.round(ch.totalSpend / ch.completedThisMonth) : 0;
  const costPerEmployee = hasChauffeur && stats.employees.active > 0 ? Math.round(ch.totalSpend / stats.employees.active) : 0;
  const outstanding = hasChauffeur ? (ch.outstandingAmount ?? 0) : 0;
  const outstandingInvoices = ch.outstandingInvoices ?? [];
  const budget = stats.monthlyBudget && stats.monthlyBudget > 0 ? stats.monthlyBudget : null;

  return (
    <div className="space-y-6">
      {header}

      <KpiGrid cols={4}>
        {hasChauffeur && (
          <KpiCard
            label={t("unassignedBookings")}
            value={ch.unassignedBookings ?? 0}
            icon={<AlertCircle />}
            tone={(ch.unassignedBookings ?? 0) > 0 ? "warning" : "success"}
            emphasis={(ch.unassignedBookings ?? 0) > 0 ? "brand" : "none"}
            hint={(ch.unassignedBookings ?? 0) > 0 ? t("requiresAttention") : t("allCaughtUp")}
            href={companyPath("/company/bookings")}
          />
        )}
        {hasChauffeur && (
          <KpiCard
            label={t("ridesCompleted")}
            value={ch.completedThisMonth}
            icon={<CheckCircle2 />}
            tone="success"
            delta={completedTrend !== null ? { value: completedTrend, label: t("vsLastMonth") } : undefined}
            hint={t("totalTripsLifetime") + `: ${ch.completedAllTime ?? 0}`}
          />
        )}
        {hasChauffeur && (
          <KpiCard
            label={t("totalSpendMtd")}
            value={formatCurrency(ch.totalSpend)}
            icon={<CreditCard />}
            tone="brand"
            delta={spendTrend !== null ? { value: spendTrend, label: t("vsLastMonth"), invert: true } : undefined}
            hint={`${t("avgTripCost")}: ${formatCurrency(avgTripCost)}`}
          />
        )}
        {hasChauffeur && (
          <KpiCard
            label={t("outstandingBalance")}
            value={formatCurrency(outstanding)}
            icon={<Wallet />}
            tone={outstanding > 0 ? "danger" : "success"}
            emphasis={outstanding > 0 ? "danger" : "none"}
            hint={outstanding > 0 ? t("invoicesCount", { count: outstandingInvoices.length }) : t("noPendingActions")}
            onClick={outstanding > 0 && outstandingInvoices.length > 0 ? () => setInvoicesOpen(true) : undefined}
          />
        )}
        {hasChauffeur && <KpiCard label={t("activeChauffeurRides")} value={ch.activeRides ?? 0} icon={<Car />} tone="brand" hint={t("inProgress")} />}
        {hasShuttle && (
          <KpiCard label={t("shuttleTrips")} value={stats.shuttle.monthlyTrips} icon={<Route />} tone="info" hint={`${t("totalRunsMtd")} · ${t("totalTripsLifetime")}: ${stats.shuttle.totalTripsAllTime ?? 0}`} href={companyPath("/company/routes")} />
        )}
        {hasShuttle && (
          <KpiCard
            label={t("peopleAddedToRoutes")}
            value={rosterChanges.added_count}
            icon={<Users />}
            tone="purple"
            hint={rosterChanges.top_route ? t("topRouteAdded", { id: rosterChanges.top_route.route_id, name: rosterChanges.top_route.route_name, count: rosterChanges.top_route.added_count }) : t("peopleRemovedThisMonth", { count: rosterChanges.removed_count })}
          />
        )}
        <KpiCard
          label={t("activePassengers")}
          value={
            <>
              {stats.employees.active}
              <span className="text-sm font-normal text-fg-muted"> / {stats.employees.total}</span>
            </>
          }
          icon={<Users />}
          tone="neutral"
          href={companyPath("/company/employees")}
        />
      </KpiGrid>

      <LiveMobilityCenter data={stats.mobility ?? { activeRides: 0, employeesTraveling: 0, shuttlesRunning: 0, chauffeurRides: 0, upcomingBookings: 0 }} />

      <div className="grid gap-4 lg:grid-cols-2">
        {hasChauffeur && <CostVisibilityCard data={{ totalSpendMTD: ch.totalSpend, spendTrend: ch.spendTrend, costPerEmployee, budget }} onEditBudget={() => setBudgetOpen(true)} />}
        <EmployeeUsageCard
          data={{
            activeEmployees: stats.employees.active,
            totalEmployees: stats.employees.total,
            avgRidesPerEmployee: hasChauffeur && stats.employees.active > 0 ? Number((ch.totalBookings / stats.employees.active).toFixed(1)) : 0,
            topPassenger: hasChauffeur && ch.topPassengers[0] ? { name: ch.topPassengers[0].name, rides: ch.topPassengers[0].trips } : null,
            departmentUsage: stats.employees.departmentUsage ?? [],
          }}
          hasChauffeur={hasChauffeur}
        />
        <InsightsCard insights={insights} seasonality={{ highDemandDay: stats.seasonality?.highDemandDay ?? null, lowDemandDay: stats.seasonality?.lowDemandDay ?? null }} hasChauffeur={hasChauffeur} />
        {hasChauffeur && hasShuttle && (
          <ServiceSplitCard
            data={[
              { key: "chauffeur", label: t("chauffeur"), value: ch.totalBookings || 0 },
              { key: "shuttle", label: t("shuttle"), value: stats.shuttle.monthlyTrips || 0 },
            ]}
          />
        )}
      </div>

      {(hasChauffeur || hasShuttle) && <CostLeakageDetector data={stats.costLeakage ?? { aiInsightsEnabled: false, totalPotentialSavingPkr: 0, insights: [] }} />}

      <Drawer open={bookingOpen} onOpenChange={setBookingOpen}>
        <DrawerContent side="end" size="xl" title={t("createNewBooking")}>
          <CreateBookingForm onSuccess={() => setBookingOpen(false)} onCancel={() => setBookingOpen(false)} />
        </DrawerContent>
      </Drawer>

      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent title={t("editMonthlyBudget")} size="sm">
          {companyId && <EditBudgetForm companyId={companyId} currentBudget={budget} onSuccess={() => setBudgetOpen(false)} onCancel={() => setBudgetOpen(false)} />}
        </DialogContent>
      </Dialog>

      <OutstandingInvoicesDialog open={invoicesOpen} onOpenChange={setInvoicesOpen} invoices={outstandingInvoices} total={outstanding} />
    </div>
  );
}
