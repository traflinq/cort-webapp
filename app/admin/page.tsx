"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../lib/store/hooks";
import { fetchDashboardStats, setDateRange } from "../lib/store/slices/superAdminDashboardSlice";
import { MetricCard } from "./ui/dashboard/MetricCard";
import { CashCard, RevenueHero } from "./ui/dashboard/HeroCards";
import { SegmentedTabs } from "./components/ui/SegmentedTabs";
import { DashboardCharts } from "./ui/dashboard/DashboardCharts";
import { DashboardTables } from "./ui/dashboard/DashboardTables";
import { SuperAdminAiBriefing } from "./ui/dashboard/SuperAdminAiBriefing";
import { FuelPriceAlert } from "./components/FuelPriceAlert";
import { RootState } from "../lib/store/store";
import { PermissionGate } from "./components/PermissionGate";
import { AdminCan } from "../lib/abilities/AdminAbilityProvider";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Bus,
  Calendar,
  Car,
  CircleDollarSign,
  Gauge,
  Receipt,
  RefreshCcw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AdminPageHeader } from "./components/AdminPageHeader";
import { AdminSkeleton } from "./components/ui/AdminSkeleton";
import { adminBtnPrimary, adminBtnOutline } from "./components/ui/admin-styles";
import { cx } from "./components/ui/cx";

export default function AdminDashboardPage() {
  return (
    <PermissionGate permission="dashboard">
      <AdminCan I="read" a="Dashboard">
        <AdminDashboardContent />
      </AdminCan>
    </PermissionGate>
  );
}

function AdminDashboardContent() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { stats, loading, error, dateRange } = useAppSelector((state: RootState) => state.superAdminDashboard);

  // Local state for date inputs to allow typing before dispatch
  const getDefaultDateRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    // Default to full calendar month so shuttle revenue (recognized by billing period end)
    // appears immediately without requiring the user to set endDate manually.
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const toLocalDateInputValue = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    return { start: toLocalDateInputValue(firstDay), end: toLocalDateInputValue(lastDay) };
  };
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState<string>(defaults.start);
  const [endDate, setEndDate] = useState<string>(defaults.end);
  const hasDateFilter = Boolean(startDate && endDate);

  // Track which button triggered the load
  const [service, setService] = useState("chauffeur");
  const [loadingAction, setLoadingAction] = useState<'filter' | 'refresh' | null>(null);

  useEffect(() => {
    // Initial fetch with current month range
    if (!stats && !loading && !error) {
      dispatch(fetchDashboardStats({ startDate, endDate }));
    }
  }, [dispatch, stats, loading, error]);

  useEffect(() => {
    // Sync local state with redux state
    if (dateRange) {
      setStartDate(dateRange.startDate);
      setEndDate(dateRange.endDate);
    }
  }, [dateRange]);

  // Reset loading action when loading finishes
  useEffect(() => {
    if (!loading) {
      setLoadingAction(null);
    }
  }, [loading]);

  const handleRefreshData = (action: 'filter' | 'refresh') => {
    setLoadingAction(action);
    const params = (startDate && endDate) ? { startDate, endDate } : undefined;
    dispatch(setDateRange({ startDate: startDate || '', endDate: endDate || '' }));
    dispatch(fetchDashboardStats(params));
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') setStartDate(value);
    else setEndDate(value);
  };

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 shadow-[var(--shadow-card)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-[var(--danger-text)]">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Couldn&apos;t load the dashboard</h2>
          <p className="mb-6 mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{error}</p>
          <button onClick={() => handleRefreshData("refresh")} className={cx(adminBtnPrimary, "w-full")}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="space-y-8" role="status" aria-label="Loading dashboard">
        <div className="space-y-2">
          <AdminSkeleton className="h-7 w-56" />
          <AdminSkeleton className="h-4 w-80" />
        </div>
        {[4, 5].map((n) => (
          <div key={n} className="space-y-3">
            <AdminSkeleton className="h-4 w-32" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <AdminSkeleton key={i} className="h-[7.5rem] rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const neutral = (value: number) => ({ current: value, previous: 0, percentageChange: 0, trend: "neutral" as const });

  return (
    <div className="space-y-8">
      <FuelPriceAlert />

      <AdminPageHeader
        eyebrow="System overview"
        title="Dashboard"
        description="Financial performance and fleet metrics for the selected period."
        action={
          <>
            <div className="flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] focus-within:border-[var(--cort-orange)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
              <Calendar className="ml-3 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <input
                type="date"
                aria-label="Start date"
                value={startDate}
                onChange={(e) => handleDateChange("start", e.target.value)}
                className="input-bare h-9 w-[8.75rem] px-2 text-xs font-medium"
              />
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-light)]" />
              <input
                type="date"
                aria-label="End date"
                value={endDate}
                onChange={(e) => handleDateChange("end", e.target.value)}
                className="input-bare h-9 w-[8.75rem] px-2 text-xs font-medium"
              />
            </div>
            <button
              onClick={() => handleRefreshData("filter")}
              disabled={loading}
              className={cx(adminBtnPrimary, "h-9")}
            >
              {loading && loadingAction === "filter" && <RefreshCcw className="h-3.5 w-3.5 animate-spin" />}
              Apply
            </button>
            <button
              onClick={() => handleRefreshData("refresh")}
              disabled={loading}
              className={cx(adminBtnOutline, "h-9 w-9 !px-0")}
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshCcw
                className={cx("h-4 w-4", loading && loadingAction === "refresh" && "animate-spin")}
              />
            </button>
          </>
        }
      />

      {stats && stats.totalUnassignedBookings > 0 && (
        <div className="admin-pop-in flex flex-col items-start justify-between gap-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-[var(--danger-text)]">
              <AlertCircle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {stats.totalUnassignedBookings} unassigned {stats.totalUnassignedBookings === 1 ? "booking" : "bookings"}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">These need a driver allocated as soon as possible.</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/admin/bookings/pending")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-rose-700 active:scale-[0.98]"
          >
            Assign now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {stats && (
        <div className="space-y-8">
          <section className="grid gap-4 lg:grid-cols-3">
            <RevenueHero stats={stats} />
            <CashCard stats={stats} />
          </section>

          <section className="space-y-3">
            <SectionHeading title="Service performance" />
            <SegmentedTabs
              value={service}
              onValueChange={setService}
              tabs={[
                {
                  value: "chauffeur",
                  label: "Chauffeur",
                  icon: <Car className="h-3.5 w-3.5" />,
                  content: (
                    <CardGrid>
                      <MetricCard label="Revenue" icon={CircleDollarSign} metric={stats.chauffeurRevenue} type="currency" />
                      <MetricCard label="COGS" icon={Receipt} metric={stats.chauffeurCOGS} type="currency" invert />
                      <MetricCard label="Profit" icon={TrendingUp} metric={stats.chauffeurProfit} type="currency" />
                      <MetricCard label="Avg profit per ride" icon={Gauge} metric={stats.avgChauffeurProfit} type="currency" />
                      <MetricCard label="Rides" icon={Car} metric={stats.chauffeurRides} type="number" />
                      <MetricCard label="Cost per ride" icon={Receipt} metric={neutral(stats.costPerRide)} type="currency" />
                    </CardGrid>
                  ),
                },
                {
                  value: "shuttle",
                  label: "Shuttle",
                  icon: <Bus className="h-3.5 w-3.5" />,
                  content: (
                    <CardGrid>
                      <MetricCard label="Revenue" icon={CircleDollarSign} metric={stats.shuttleRevenue} type="currency" />
                      <MetricCard label="COGS" icon={Receipt} metric={stats.shuttleCOGS} type="currency" invert />
                      <MetricCard label="Profit" icon={TrendingUp} metric={stats.shuttleProfit} type="currency" />
                      <MetricCard label="Avg profit per trip" icon={Gauge} metric={stats.avgShuttleProfit} type="currency" />
                    </CardGrid>
                  ),
                },
              ]}
            />
          </section>

          <section className="space-y-3">
            <SectionHeading title="Open items" icon={Wallet} />
            <CardGrid>
              {hasDateFilter && (
                <>
                  <MetricCard
                    label="Receivable in period"
                    icon={Banknote}
                    metric={neutral(stats.currentPeriodReceivables ?? 0)}
                    type="currency"
                  />
                  <MetricCard
                    label="Payable in period"
                    icon={Wallet}
                    metric={neutral(stats.currentPeriodPayables ?? 0)}
                    type="currency"
                  />
                </>
              )}
              <MetricCard
                label="Unassigned bookings"
                icon={AlertCircle}
                metric={neutral(stats.totalUnassignedBookings)}
                type="number"
                tone="danger"
              />
            </CardGrid>
          </section>

          <section className="space-y-3">
            <SectionHeading title="Performance analytics" />
            <DashboardCharts
              ridesBreakdown={stats.ridesBreakdown}
              expensesBreakdown={stats.expensesBreakdown}
              revenueBreakdown={stats.revenueBreakdown}
            />
          </section>

          <section className="space-y-3">
            <SectionHeading title="Operational details" />
            <DashboardTables
              revenueByClient={stats.revenueByClient}
              fuelExpenses={stats.fuelExpenses}
              repairExpenses={stats.repairExpenses}
              overdueInvoices={stats.overdueInvoices}
              problemReports={stats.problemReports}
            />
          </section>
        </div>
      )}

      <SuperAdminAiBriefing startDate={startDate} endDate={endDate} />
    </div>
  );
}

function SectionHeading({ title, icon: Icon }: { title: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-2.5">
      {Icon && <Icon className="h-4 w-4 text-[var(--text-muted)]" />}
      <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      <div className="h-px flex-1 bg-[var(--border-default)]" />
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}
