"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Car, CreditCard, Percent, Receipt, TrendingUp, Wallet } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../lib/store/hooks";
import { fetchDashboardStats, setDateRange } from "../lib/store/slices/superAdminDashboardSlice";
import type { RootState } from "../lib/store/store";
import type { BreakdownItem, MetricComparison } from "../lib/types/admin-dashboard";
import { PermissionGate } from "./components/PermissionGate";
import { AdminCan } from "../lib/abilities/AdminAbilityProvider";
import { FuelPriceAlert } from "./components/FuelPriceAlert";
import { BreakdownCharts } from "./ui/dashboard/DashboardCharts";
import { DashboardTables } from "./ui/dashboard/DashboardTables";
import { ServiceComparison } from "./ui/dashboard/ServiceComparison";
import { SuperAdminAiBriefing } from "./ui/dashboard/SuperAdminAiBriefing";
import {
  Button,
  CardSkeleton,
  DateRangePicker,
  Drawer,
  DrawerContent,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiGrid,
  KpiSkeleton,
  PageHeader,
  SectionHeader,
  type DateRange, RefreshButton } from "./ui";
import { formatCurrency, formatNumber, formatPercent } from "./lib/format";
import { currentMonthRange } from "./lib/dates";

export default function AdminDashboardPage() {
  return (
    <PermissionGate permission="dashboard">
      <AdminCan I="read" a="Dashboard">
        <AdminDashboardContent />
      </AdminCan>
    </PermissionGate>
  );
}

/** Delta chip only when the API supplied a comparison period (previous ≠ 0), as before. */
function deltaOf(metric: MetricComparison | undefined, invert = false) {
  if (!metric || !metric.previous) return undefined;
  return { value: metric.percentageChange, label: "vs previous period", invert };
}

function AdminDashboardContent() {
  const dispatch = useAppDispatch();
  const { stats, loading, error, dateRange } = useAppSelector((state: RootState) => state.superAdminDashboard);

  // Default to the full calendar month so shuttle revenue (recognised at billing-period end) shows immediately.
  const [range, setRange] = React.useState<DateRange>(() =>
    dateRange ? { start: dateRange.startDate, end: dateRange.endDate } : currentMonthRange(),
  );
  const [receivablesOpen, setReceivablesOpen] = React.useState(false);

  const load = React.useCallback(
    (r: DateRange) => {
      dispatch(setDateRange({ startDate: r.start, endDate: r.end }));
      dispatch(fetchDashboardStats({ startDate: r.start, endDate: r.end }));
    },
    [dispatch],
  );

  React.useEffect(() => {
    if (!stats && !loading && !error) {
      dispatch(fetchDashboardStats({ startDate: range.start, endDate: range.end }));
    }
  }, [dispatch, stats, loading, error, range.start, range.end]);

  const onRangeChange = (next: DateRange | null) => {
    if (!next) return;
    setRange(next);
    load(next);
  };

  const header = (
    <PageHeader
      title="Dashboard"
      actions={
        <>
          <DateRangePicker value={range} onChange={onRangeChange} label="Reporting period" />
          <RefreshButton label="Refresh data" onClick={() => load(range)} loading={loading} />
        </>
      }
    />
  );

  if (error && !stats) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState title="Couldn't load the dashboard" message={error} onRetry={() => load(range)} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6" aria-busy="true">
        {header}
        <KpiGrid cols={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </KpiGrid>
        <CardSkeleton lines={4} />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} lines={5} />
          ))}
        </div>
      </div>
    );
  }

  const unassigned = stats.totalUnassignedBookings ?? 0;

  return (
    <div className="space-y-6">
      {header}
      <FuelPriceAlert />

      {unassigned > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger-ink" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-fg">
                {unassigned} {unassigned === 1 ? "booking has" : "bookings have"} no driver assigned
              </p>
              <p className="text-sm text-fg-secondary">They need allocation before their pickup time.</p>
            </div>
          </div>
          <Button variant="danger" size="sm" asChild>
            <Link href="/admin/bookings/pending">
              Assign drivers
              <ArrowRight />
            </Link>
          </Button>
        </div>
      )}

      <section className="space-y-4">
        <SectionHeader title="Financial performance" description="Revenue, cost of goods sold and margin for the period." />
        <KpiGrid cols={4}>
          <KpiCard label="Total revenue" value={formatCurrency(stats.totalRevenue.current)} delta={deltaOf(stats.totalRevenue)} icon={<CreditCard />} tone="brand" />
          <KpiCard label="Total COGS" value={formatCurrency(stats.totalCOGS.current)} delta={deltaOf(stats.totalCOGS, true)} icon={<Receipt />} tone="neutral" />
          <KpiCard label="Gross profit" value={formatCurrency(stats.grossProfit.current)} delta={deltaOf(stats.grossProfit)} icon={<TrendingUp />} tone="success" />
          <KpiCard label="Net margin" value={formatPercent(stats.netMargin.current, 2)} delta={deltaOf(stats.netMargin)} icon={<Percent />} tone="info" />
        </KpiGrid>
      </section>

      <section className="space-y-4">
        <SectionHeader title="By service" description="Chauffeur and shuttle side by side." />
        <ServiceComparison stats={stats} />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Working capital & volume" />
        <KpiGrid cols={4}>
          <KpiCard
            label="Receivables"
            value={formatCurrency(stats.totalReceivables)}
            hint={stats.currentPeriodReceivables != null ? `This period: ${formatCurrency(stats.currentPeriodReceivables)}` : "Open client balances · tap for breakdown"}
            icon={<Wallet />}
            tone="warning"
            onClick={() => setReceivablesOpen(true)}
          />
          <KpiCard
            label="Payables"
            value={formatCurrency(stats.totalPayables)}
            hint={stats.currentPeriodPayables != null ? `This period: ${formatCurrency(stats.currentPeriodPayables)}` : "Owed to vendors and drivers"}
            icon={<Receipt />}
            tone="neutral"
          />
          <KpiCard label="Chauffeur rides" value={formatNumber(stats.chauffeurRides.current)} delta={deltaOf(stats.chauffeurRides)} icon={<Activity />} tone="purple" />
          <KpiCard label="Cost per ride" value={formatCurrency(stats.costPerRide)} hint="Chauffeur, average" icon={<Car />} tone="neutral" />
        </KpiGrid>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Breakdowns" description="Where rides, expenses and revenue came from." />
        <BreakdownCharts ridesBreakdown={stats.ridesBreakdown} expensesBreakdown={stats.expensesBreakdown} revenueBreakdown={stats.revenueBreakdown} />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Operations" />
        <DashboardTables
          revenueByClient={stats.revenueByClient}
          fuelExpenses={stats.fuelExpenses}
          repairExpenses={stats.repairExpenses}
          overdueInvoices={stats.overdueInvoices}
          problemReports={stats.problemReports}
        />
      </section>

      <SuperAdminAiBriefing startDate={range.start} endDate={range.end} />

      <Drawer open={receivablesOpen} onOpenChange={setReceivablesOpen}>
        <DrawerContent title="Receivables by client" description={`Total outstanding ${formatCurrency(stats.totalReceivables)}`} size="md">
          <ReceivablesList items={stats.receivablesByClient ?? []} />
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function ReceivablesList({ items }: { items: BreakdownItem[] }) {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length === 0) return <EmptyState compact title="No pending receivables" description="Every client balance is settled." />;
  const max = Math.max(...sorted.map((i) => i.value));
  return (
    <ul className="divide-y divide-line">
      {sorted.map((item) => (
        <li key={item.name} className="py-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="min-w-0 truncate font-medium text-fg">{item.name}</span>
            <span className="shrink-0 font-mono tabular-nums text-fg">{formatCurrency(item.value)}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-subtle" aria-hidden="true">
            <div className="h-full rounded-full bg-warning" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
