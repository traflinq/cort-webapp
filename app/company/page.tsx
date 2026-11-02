"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAppDispatch, useAppSelector } from "../lib/store/hooks";
import { fetchDashboardStats, selectDashboardStats, selectDashboardStatus } from "../lib/store/slices/dashboardSlice";
import { selectCompany, selectCompanyFeatures } from "../lib/store/slices/companySlice";
import { useAuth } from "../lib/contexts/auth-context";
import { useState, useEffect } from "react";
import { apiClient } from "../lib/services/api-client";
import { useCompanyLocale } from "./lib/locale-context";
import { formatLocaleDate } from "../lib/i18n/format";
import Modal from "./bookings/components/Modal";
import CreateBookingForm from "./bookings/components/CreateBookingForm";
import EditBudgetForm from "./components/EditBudgetForm";
import {
  TakingCareSection,
  ValueDeliveredSection,
  CostVisibilitySection,
  EmployeeUsageSection,
  AdoptionHealthSection,
  ServiceUsageSection,

  PremiumTeaser,
} from "./components/DashboardComponents";
import DashboardSkeleton from "./components/DashboardSkeleton";
import { BalancePromoCard, BudgetPaceCard, DemandPatternCard, InsightsPanel, LiveMobilityCard, ServiceTabsCard } from "./components/DashboardOverview";
import { DateChip, PillButton } from "./ui";
import { useCompanyBasePath } from "./lib/use-company-base-path";
import { HIDE_INVOICING_COMPANY_IDS } from "./ui/CompanyShell";
import { Plus } from "lucide-react";
import LiveMobilityCenter from "./components/LiveMobilityCenter";
import CostLeakageDetector from "./components/CostLeakageDetector";

type RosterChanges = {
  added_count: number;
  removed_count: number;
  top_route: { route_id: number; route_name: string; added_count: number } | null;
};

export default function CompanyDashboardPage() {
  const dispatch = useAppDispatch();
  const company = useAppSelector(selectCompany);
  const features = useAppSelector(selectCompanyFeatures);
  const { companyPath } = useCompanyBasePath();
  const dashboardStats = useAppSelector(selectDashboardStats);
  const status = useAppSelector(selectDashboardStatus);
  const t = useTranslations('company.dashboard');
  const tErrors = useTranslations('common.errors');
  const tCommon = useTranslations('common');
  const tOverview = useTranslations('company.overview');
  const { locale } = useCompanyLocale();
  const loading = status === 'loading';
  const error = status === 'failed' ? tErrors('failedToLoadStats') : null;
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const companyId = user?.company_id?.toString();
  const [rosterChanges, setRosterChanges] = useState<RosterChanges>({
    added_count: 0,
    removed_count: 0,
    top_route: null,
  });

  useEffect(() => {
    if (companyId) {
      dispatch(fetchDashboardStats(companyId));
    }
  }, [dispatch, companyId]);

  // Calculate services breakdown (percentages)
  // Prefer servicesEnabled from dashboard stats (authoritative, always fresh),
  // fall back to company profile while stats are loading.
  const isChauffeurEnabled =
    dashboardStats?.servicesEnabled?.chauffeur_enabled ??
    company?.services_enabled?.chauffeur_enabled ??
    false;
  const isShuttleEnabled =
    dashboardStats?.servicesEnabled?.shuttle_enabled ??
    company?.services_enabled?.shuttle_enabled ??
    false;

  useEffect(() => {
    if (!isShuttleEnabled) {
      setRosterChanges({ added_count: 0, removed_count: 0, top_route: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.request<RosterChanges>('/company/roster-changes');
        if (!cancelled) setRosterChanges(data);
      } catch {
        if (!cancelled) setRosterChanges({ added_count: 0, removed_count: 0, top_route: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isShuttleEnabled]);

  const totalServices = (isChauffeurEnabled ? (dashboardStats?.chauffeur.totalBookings || 0) : 0) + (isShuttleEnabled ? (dashboardStats?.shuttle.monthlyTrips || 0) : 0);
  const chauffeurPct = totalServices > 0 ? Math.round(((dashboardStats?.chauffeur.totalBookings || 0) / totalServices) * 100) : 0;
  const shuttlePct = totalServices > 0 ? Math.round(((dashboardStats?.shuttle.monthlyTrips || 0) / totalServices) * 100) : 0;

  // Generate real insights
  const generateInsights = () => {
    if (!dashboardStats) return [];
    const insights = [];
    if (isChauffeurEnabled) {
      if (dashboardStats.chauffeur.spendTrend.startsWith('-')) {
        insights.push(t('insightSpendingDown', { percent: dashboardStats.chauffeur.spendTrend.replace('-', '') }));
      } else if (dashboardStats.chauffeur.spendTrend !== "0%") {
        insights.push(t('insightSpendingUp', { percent: dashboardStats.chauffeur.spendTrend.replace('+', '') }));
      }

      if (dashboardStats.chauffeur.topPassengers.length > 0) {
        insights.push(t('insightTopPassenger', { name: dashboardStats.chauffeur.topPassengers[0].name }));
      }
    }

    if (dashboardStats.employees.departmentUsage.length > 0) {
      insights.push(t('insightTopDepartment', {
        name: dashboardStats.employees.departmentUsage[0].name,
        percent: dashboardStats.employees.departmentUsage[0].percentage,
      }));
    }

    if (isShuttleEnabled && dashboardStats.shuttle.monthlyTrips > 0) {
      insights.push(t('insightShuttleTrips', {
        trips: dashboardStats.shuttle.monthlyTrips,
        routes: dashboardStats.shuttle.totalRoutes,
      }));
    }

    if (insights.length === 0) {
      insights.push(t('insightStartUsing'));
    }
    return insights;
  };

  // Transform API data to DashboardData interface
  const data = dashboardStats ? {
    takingCare: {
      unassignedBookings: isChauffeurEnabled ? (dashboardStats.chauffeur.unassignedBookings || 0) : 0,
      ridesCompleted: isChauffeurEnabled ? dashboardStats.chauffeur.completedThisMonth : 0,
      completedTrend: isChauffeurEnabled ? (dashboardStats.chauffeur.completedTrend || "0%") : "0%",
    },
    nothingToDo: {
      pendingApprovals: isChauffeurEnabled ? (dashboardStats.chauffeur.unassignedBookings || 0) : 0,
      delayedRides: 0,
      unresolvedIssues: 0,
      isAllClear: !isChauffeurEnabled || (dashboardStats.chauffeur.unassignedBookings || 0) === 0,
    },
    valueDelivered: {
      estimatedSavings: isChauffeurEnabled ? (dashboardStats.chauffeur.totalSavings || 0) : 0,
      activeRides: isChauffeurEnabled ? (dashboardStats.chauffeur.activeRides || 0) : 0,
      shuttleTrips: isShuttleEnabled ? ((dashboardStats.shuttle as any)?.monthlyTrips || 0) : 0,
      avgTripCost: isChauffeurEnabled && dashboardStats.chauffeur.completedThisMonth > 0
        ? Math.round(dashboardStats.chauffeur.totalSpend / dashboardStats.chauffeur.completedThisMonth)
        : 0,
      avgTripTotalSpendLifetime: isChauffeurEnabled ? (dashboardStats.chauffeur.totalSpendAllTime || 0) : 0,
      shuttleTotalTripsLifetime: isShuttleEnabled ? (dashboardStats.shuttle.totalTripsAllTime || 0) : 0,
    },
    cost: {
      totalSpendMTD: isChauffeurEnabled ? dashboardStats.chauffeur.totalSpend : 0,
      spendTrend: isChauffeurEnabled ? (dashboardStats.chauffeur.spendTrend || "0%") : "0%",
      costPerEmployee: isChauffeurEnabled && dashboardStats.employees.active > 0
        ? Math.round(dashboardStats.chauffeur.totalSpend / dashboardStats.employees.active)
        : 0,
      budget: dashboardStats.monthlyBudget || 1500000,
    },
    employeeUsage: {
      activeEmployees: dashboardStats.employees.active,
      totalEmployees: dashboardStats.employees.total,
      avgRidesPerEmployee: isChauffeurEnabled && dashboardStats.employees.active > 0
        ? parseFloat((dashboardStats.chauffeur.totalBookings / dashboardStats.employees.active).toFixed(1))
        : 0,
      departmentUsage: dashboardStats.employees.departmentUsage || [],
      topPassenger: isChauffeurEnabled && dashboardStats.chauffeur.topPassengers[0] ? {
        name: dashboardStats.chauffeur.topPassengers[0].name,
        rides: dashboardStats.chauffeur.topPassengers[0].trips,
        department: "N/A"
      } : { name: "N/A", rides: 0, department: "N/A" },
    },
    smartInsights: generateInsights(),
    seasonality: {
      highDemandDay: isChauffeurEnabled ? (dashboardStats.seasonality?.highDemandDay || t('analysisPending')) : t('analysisPending'),
      lowDemandDay: isChauffeurEnabled ? (dashboardStats.seasonality?.lowDemandDay || t('analysisPending')) : t('analysisPending'),
    },
    adminHealth: {
      registeredVsActiveRatio: dashboardStats.employees.total > 0 ? parseFloat((dashboardStats.employees.active / dashboardStats.employees.total).toFixed(2)) : 0,
      deptAdoptionRate: dashboardStats.employees.departmentUsage.length > 0 ? 100 : 0, // Simple placeholder logic
      bookingVsActualRatio: 1,
    },
    services: {
      chauffeur: isChauffeurEnabled ? chauffeurPct : 0,
      shuttles: isShuttleEnabled ? shuttlePct : 0,
      events: 0,
      eventShuttle: 0,
    },
    mobility: dashboardStats.mobility ?? {
      activeRides: 0,
      employeesTraveling: 0,
      shuttlesRunning: 0,
      chauffeurRides: 0,
      upcomingBookings: 0
    },
    costLeakage: dashboardStats.costLeakage ?? { aiInsightsEnabled: false, totalPotentialSavingPkr: 0, insights: [] }
  } : null;

  // Real data overrides where possible (example)
  const today = new Date();

  // Use upcoming bookings from stats as proxy for today/actionable items (only relevant when chauffeur is on)
  const todayBookingsCount = isChauffeurEnabled ? (dashboardStats?.alerts.upcomingBookings || 0) : 0;

  if (loading) {
    return (
      <DashboardSkeleton />
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!company || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-[var(--text-muted)]">{tErrors('noCompanyData')}</div>
      </div>
    );
  }

  const hasShuttle = isShuttleEnabled;
  const hasChauffeur = isChauffeurEnabled;
  const isDualService = hasChauffeur && hasShuttle;

  const invoicingVisible =
    !user?.is_trial &&
    !(user?.company_id != null && HIDE_INVOICING_COMPANY_IDS.has(user.company_id)) &&
    features.some((f) => (f.feature_key === "chauffeur_cort_managed" || f.feature_key === "shuttle_cort_managed") && f.is_enabled);
  const reportsHref = user?.is_trial
    ? null
    : hasShuttle
      ? companyPath("/company/reports/shuttle")
      : hasChauffeur
        ? companyPath("/company/reports/chauffeur")
        : null;

  return (
    <div className="flex flex-col gap-6 pb-12 w-full min-w-0">
      {/* Header: title + actions ("Smart Delivery Dashboard") */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 dashboard-section dashboard-section-delay-1">
        <div className="min-w-0">
          <h1 className="text-[2rem] font-medium leading-[1.1] tracking-[-0.02em] text-[var(--text-primary)] sm:text-[2.75rem]">
            {t('title')}
          </h1>
          <p className="mt-3 text-[15px] text-[var(--text-muted)]">
            {t('welcomeBack')} {user?.full_name?.split(' ')[0] || tCommon('misc.admin')}.{' '}
            {hasChauffeur ? t('upcomingBookings', { count: todayBookingsCount }) : t('servicesActive')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasChauffeur && (
            <PillButton variant="primary" icon={<Plus strokeWidth={2.2} />} onClick={() => setIsModalOpen(true)}>
              {tCommon('actions.newBooking')}
            </PillButton>
          )}
          <DateChip label={formatLocaleDate(today, locale, { weekday: 'short', day: '2-digit', month: 'short' })} />
        </div>
      </div>

      {/* Reference grid: map + promo | live mobility + ring / service tabs | insights */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,24fr)_minmax(0,25fr)_minmax(0,17fr)_minmax(0,34fr)] dashboard-section dashboard-section-delay-2">
        <div className="min-h-[340px] xl:col-start-1 xl:row-start-1">
          <LiveMobilityCenter data={data.mobility} variant="compact" />
        </div>
        <div className="xl:col-start-1 xl:row-start-2">
          <BalancePromoCard
            outstandingAmount={hasChauffeur ? (dashboardStats?.chauffeur.outstandingAmount ?? 0) : 0}
            invoiceCount={dashboardStats?.chauffeur.outstandingInvoices?.length ?? 0}
            estimatedSavings={data.valueDelivered.estimatedSavings}
            invoicesHref={invoicingVisible ? companyPath("/company/invoicing") : null}
          />
        </div>
        <div className="xl:col-start-2 xl:row-start-1">
          <LiveMobilityCard
            mobility={data.mobility}
            hasChauffeur={hasChauffeur}
            hasShuttle={hasShuttle}
            topPassenger={data.employeeUsage.topPassenger}
            rosterChanges={rosterChanges}
            bookingsHref={companyPath("/company/bookings")}
            routeHref={(id) => companyPath(`/company/routes/${id}`)}
          />
        </div>
        <div className="xl:col-start-3 xl:row-start-1">
          <BudgetPaceCard
            spend={data.cost.totalSpendMTD}
            budget={data.cost.budget}
            activeEmployees={data.employeeUsage.activeEmployees}
            totalEmployees={data.employeeUsage.totalEmployees}
            hasChauffeur={hasChauffeur}
          />
        </div>
        <div className="md:col-span-2 xl:col-start-2 xl:col-end-4 xl:row-start-2">
          {dashboardStats && (
            <ServiceTabsCard
              data={data}
              stats={dashboardStats}
              rosterChanges={rosterChanges}
              hasChauffeur={hasChauffeur}
              hasShuttle={hasShuttle}
              onRefresh={() => companyId && dispatch(fetchDashboardStats(companyId))}
              refreshing={loading}
              hrefs={{
                bookings: companyPath("/company/bookings"),
                routes: companyPath("/company/routes"),
                employees: companyPath("/company/employees"),
              }}
            />
          )}
        </div>
        <div className="md:col-span-2 xl:col-span-1 xl:col-start-4 xl:row-start-1 xl:row-end-3">
          {dashboardStats && (
            <InsightsPanel
              stats={dashboardStats}
              insights={data.smartInsights}
              onEditBudget={hasChauffeur ? () => setIsBudgetModalOpen(true) : null}
              reportsHref={reportsHref}
            />
          )}
        </div>
      </div>

      {/* Performance: KPI strip + bento grid of the analytics sections */}
      <section aria-labelledby="dashboard-performance" className="mt-4 flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="dashboard-performance" className="text-2xl font-medium text-[var(--text-primary)]">{tOverview('performance')}</h2>
            <p className="mt-1.5 text-[15px] text-[var(--text-muted)]">{tOverview('performanceSubtitle')}</p>
          </div>
        </div>

        {(hasChauffeur || hasShuttle) && (
          <div className="w-full dashboard-section dashboard-section-delay-3">
            <ValueDeliveredSection data={data.valueDelivered} rosterChanges={rosterChanges} hasChauffeur={hasChauffeur} hasShuttle={hasShuttle} />
          </div>
        )}

        <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12 xl:grid-flow-dense">
          {hasChauffeur && (
            <div className="md:col-span-2 xl:col-span-6 dashboard-section dashboard-section-delay-3">
              <CostVisibilitySection data={data.cost} onEditBudget={() => setIsBudgetModalOpen(true)} />
            </div>
          )}

          <div className="xl:col-span-3 xl:row-span-2 dashboard-section dashboard-section-delay-3">
            <EmployeeUsageSection data={data.employeeUsage} />
          </div>

          {isDualService ? (
            <div className="xl:col-span-3 dashboard-section dashboard-section-delay-4">
              <ServiceUsageSection data={data.services} hasChauffeur={hasChauffeur} hasShuttle={hasShuttle} />
            </div>
          ) : (
            <div className="xl:col-span-3 dashboard-section dashboard-section-delay-4">
              <AdoptionHealthSection data={data.adminHealth} />
            </div>
          )}

          {hasChauffeur && (
            <div className="xl:col-span-3 dashboard-section dashboard-section-delay-4">
              <TakingCareSection data={data.takingCare} />
            </div>
          )}

          {(hasChauffeur || hasShuttle) && (
            <div className={`${hasChauffeur ? "xl:col-span-3" : "md:col-span-2 xl:col-span-6"} dashboard-section dashboard-section-delay-4`}>
              <DemandPatternCard seasonality={data.seasonality} />
            </div>
          )}

          {isDualService && (
            <div className="xl:col-span-3 dashboard-section dashboard-section-delay-4">
              <AdoptionHealthSection data={data.adminHealth} />
            </div>
          )}
        </div>
      </section>

      {(hasChauffeur || hasShuttle) && (
        <div className="dashboard-section dashboard-section-delay-5">
          <CostLeakageDetector data={data.costLeakage} />
        </div>
      )}

      <PremiumTeaser />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('createNewBooking')}
      >
        <CreateBookingForm
          onSuccess={() => setIsModalOpen(false)}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title={t('editMonthlyBudget')}
      >
        <EditBudgetForm
          companyId={companyId!}
          currentBudget={data.cost.budget}
          onSuccess={() => setIsBudgetModalOpen(false)}
          onCancel={() => setIsBudgetModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
