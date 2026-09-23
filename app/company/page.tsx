"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAppDispatch, useAppSelector } from "../lib/store/hooks";
import { fetchDashboardStats, selectDashboardStats, selectDashboardStatus } from "../lib/store/slices/dashboardSlice";
import { selectCompany } from "../lib/store/slices/companySlice";
import { useAuth } from "../lib/contexts/auth-context";
import { useState, useEffect } from "react";
import { useCompanyLocale } from "./lib/locale-context";
import { formatLocaleDate } from "../lib/i18n/format";
import Modal, { ModalTrigger } from "./bookings/components/Modal";
import { StaggeredTitle } from "./components/motion";
import CreateBookingForm from "./bookings/components/CreateBookingForm";
import EditBudgetForm from "./components/EditBudgetForm";
import {
  TakingCareSection,
  NothingToDoSection,
  ValueDeliveredSection,
  CostVisibilitySection,
  EmployeeUsageSection,
  SmartInsightsSection,
  AdoptionHealthSection,
  ServiceUsageSection,

  PremiumTeaser,
  OutstandingAmountRow
} from "./components/DashboardComponents";
import DashboardSkeleton from "./components/DashboardSkeleton";
import LiveMobilityCenter from "./components/LiveMobilityCenter";
import CostLeakageDetector from "./components/CostLeakageDetector";

export default function CompanyDashboardPage() {
  const dispatch = useAppDispatch();
  const company = useAppSelector(selectCompany);
  const dashboardStats = useAppSelector(selectDashboardStats);
  const status = useAppSelector(selectDashboardStatus);
  const t = useTranslations('company.dashboard');
  const tErrors = useTranslations('common.errors');
  const tCommon = useTranslations('common');
  const { locale } = useCompanyLocale();
  const loading = status === 'loading';
  const error = status === 'failed' ? tErrors('failedToLoadStats') : null;
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const companyId = user?.company_id?.toString();

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
  const isTravelEnabled =
    dashboardStats?.servicesEnabled?.travel_enabled ??
    company?.services_enabled?.travel_enabled ??
    false;

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

  const analyticsGridClass =
    "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 auto-rows-[minmax(180px,auto)] sm:auto-rows-[minmax(220px,auto)] grid-flow-dense min-w-0";

  const smartInsightsClass = hasShuttle && !hasChauffeur
    ? "lg:col-span-1 xl:col-span-2 dashboard-section dashboard-section-delay-5"
    : "lg:col-span-2 dashboard-section dashboard-section-delay-5";

  const costVisibilityClass = hasChauffeur && !hasShuttle
    ? "lg:col-span-2 xl:col-span-2 dashboard-section dashboard-section-delay-4"
    : "lg:col-span-2 dashboard-section dashboard-section-delay-4";

  const adoptionHealthClass = hasChauffeur && !hasShuttle
    ? "xl:col-span-2 dashboard-section dashboard-section-delay-3"
    : "xl:col-span-1 dashboard-section dashboard-section-delay-3";

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-12 relative max-w-[1600px] mx-auto w-full min-w-0">

      {/* Welcome Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 dashboard-section dashboard-section-delay-1 relative z-10 has-[.invoice-tooltip-trigger:hover]:z-[200]">
        {/* Welcome Banner - Premium Background Image (Dark Theme - No Fade) */}
        <div className="lg:col-span-2 relative rounded-[1.5rem] sm:rounded-[2rem] bg-[#0c1a3d] p-5 sm:p-6 md:p-8 shadow-[0_1px_4px_rgba(0,0,0,0.18)] border border-[var(--border-default)] overflow-hidden flex flex-col justify-center min-h-[180px] sm:min-h-[200px] md:min-h-[220px] hover:shadow-[0_2px_10px_rgba(0,0,0,0.24)] transition-all duration-200 group">

          {/* Background Image Layer */}
          <div
            className="absolute inset-0 bg-no-repeat"
            style={{
              backgroundImage: "url('/image.png')",
              backgroundSize: "cover",
              backgroundPosition: "center", // Resetting to center to ensure it covers everything smoothly
            }}
          ></div>

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between h-full">
            <div className="flex flex-col justify-center mt-auto sm:mt-0">
              <div className="flex items-center gap-2 text-white text-opacity-70 mb-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider backdrop-blur-sm bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                  {formatLocaleDate(today, locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2 leading-tight">
                <StaggeredTitle text={t('welcomeBack')} />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                  {user?.full_name?.split(' ')[0] || tCommon('misc.admin')}
                </span>
              </h1>
              <p className="text-white text-opacity-80 max-w-xl text-sm sm:text-base md:text-lg">
                {hasChauffeur
                  ? t('upcomingBookings', { count: todayBookingsCount })
                  : t('servicesActive')
                }
              </p>
            </div>

            {hasChauffeur && (
              isModalOpen ? (
                <span className="invisible pointer-events-none flex items-center justify-center gap-2 rounded-xl bg-[var(--cort-orange)] px-5 py-2.5 text-sm font-bold whitespace-nowrap w-full sm:w-auto">
                  {tCommon('actions.newBooking')}
                </span>
              ) : (
                <ModalTrigger
                  layoutId="company-new-booking"
                  onClick={() => setIsModalOpen(true)}
                  className="group relative flex items-center justify-center gap-2 rounded-xl bg-[var(--cort-orange)] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[var(--cort-orange-hover)] hover:-translate-y-0.5 shadow-lg active:translate-y-0 active:shadow-md whitespace-nowrap w-full sm:w-auto"
                >
                  <svg className="w-4 h-4 text-white transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>{tCommon('actions.newBooking')}</span>
                </ModalTrigger>
              )
            )}
          </div>
        </div>

        {/* Quick Status - "Nothing specific for you to do" */}
        <div className="lg:col-span-1 h-full relative overflow-visible">
          <NothingToDoSection 
            data={data.nothingToDo} 
            outstandingAmount={dashboardStats?.chauffeur.outstandingAmount}
            invoices={dashboardStats?.chauffeur.outstandingInvoices}
          />
        </div>
      </div>

      {/* Value Delivered - Hero Row */}
      {(hasChauffeur || hasShuttle) && (
        <div className="w-full dashboard-section dashboard-section-delay-3">
          <ValueDeliveredSection data={data.valueDelivered} hasChauffeur={hasChauffeur} hasShuttle={hasShuttle} />
        </div>
      )}

      {/* Live Mobility Command Center - NEW */}
      <div className="w-full dashboard-section dashboard-section-delay-3">
        <LiveMobilityCenter data={data.mobility} />
      </div>

      {isTravelEnabled && dashboardStats?.travel && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <p className="text-xs uppercase text-[var(--text-muted)]">Company wallet</p>
            <p className="text-2xl font-bold">PKR {Number(dashboardStats.travel.company_balance).toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <p className="text-xs uppercase text-[var(--text-muted)]">Assigned</p>
            <p className="text-2xl font-bold">PKR {Number(dashboardStats.travel.assigned_total).toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <p className="text-xs uppercase text-[var(--text-muted)]">Travel spend</p>
            <p className="text-2xl font-bold">PKR {Number(dashboardStats.travel.spend_total).toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <p className="text-xs uppercase text-[var(--text-muted)]">Employee adoption</p>
            <p className="text-2xl font-bold">{dashboardStats.travel.adoption}%</p>
            <p className="text-xs text-[var(--text-muted)]">{dashboardStats.travel.travelers} / {dashboardStats.travel.active_employees} employees</p>
          </div>
        </div>
      )}

      {/* 2. Main Analytics Grid */}
      <div className={analyticsGridClass}>

        {/* We're Taking Care of This */}
        {hasChauffeur && (
          <div className="xl:col-span-1 dashboard-section dashboard-section-delay-2">
            <TakingCareSection data={data.takingCare} />
          </div>
        )}

        {/* Employee Usage - Wider card */}
        <div className="xl:col-span-1 dashboard-section dashboard-section-delay-3">
          <EmployeeUsageSection data={data.employeeUsage} />
        </div>

        {/* Cost Visibility */}
        {hasChauffeur && (
          <div className={costVisibilityClass}>
            <CostVisibilitySection
              data={data.cost}
              onEditBudget={() => setIsBudgetModalOpen(true)}
            />
          </div>
        )}

        {/* Smart Insights */}
        {(hasChauffeur || hasShuttle) && (
          <div className={smartInsightsClass}>
            <SmartInsightsSection insights={data.smartInsights} seasonality={data.seasonality} />
          </div>
        )}

        {isDualService && (
          <div className="xl:col-span-1 dashboard-section dashboard-section-delay-4">
            <ServiceUsageSection data={data.services} hasChauffeur={hasChauffeur} hasShuttle={hasShuttle} />
          </div>
        )}

        <div className={adoptionHealthClass}>
          <AdoptionHealthSection data={data.adminHealth} />
        </div>
      </div>

      {/* Power Insights (Optimization) - Enhanced with Cost Leakage Detector */}
      {(hasChauffeur || hasShuttle) && (
        <div className="dashboard-section dashboard-section-delay-5">
          <CostLeakageDetector data={data.costLeakage} />
        </div>
      )}

      {/* Premium Teaser */}
      <PremiumTeaser />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('createNewBooking')}
        layoutId="company-new-booking"
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
