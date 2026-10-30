"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "../lib/store/hooks";
import { fetchDashboardStats, setDateRange } from "../lib/store/slices/superAdminDashboardSlice";
import type { RootState } from "../lib/store/store";
import type { BreakdownItem, MetricComparison, SuperAdminDashboardStats } from "../lib/types/admin-dashboard";
import { PermissionGate } from "./components/PermissionGate";
import { AdminCan } from "../lib/abilities/AdminAbilityProvider";
import { FuelPriceAlert } from "./components/FuelPriceAlert";
import { BreakdownCharts } from "./ui/dashboard/DashboardCharts";
import { ActionTables, CostTables } from "./ui/dashboard/DashboardTables";
import { NotStartedRides } from "./ui/dashboard/NotStartedRides";
import { ShuttleVehicleEfficiency } from "./ui/dashboard/ShuttleVehicleEfficiency";
import { ServiceComparison } from "./ui/dashboard/ServiceComparison";
import { SuperAdminAiBriefing } from "./ui/dashboard/SuperAdminAiBriefing";
import { focusRingInset } from "./ui/styles";
import {
  Card,
  CardFooter,
  CardHeader,
  CardSkeleton,
  DateRangePicker,
  Drawer,
  DrawerContent,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeader,
  Skeleton,
  StatStrip,
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
      description="What needs action today, then how the business performed in the reporting period."
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
        {[0, 1].map((row) => (
          <Skeleton key={row} className="h-28 w-full rounded-2xl" />
        ))}
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton lines={4} className="lg:col-span-2" />
          <CardSkeleton lines={4} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} lines={5} />
          ))}
        </div>
      </div>
    );
  }

  const unassigned = stats.totalUnassignedBookings ?? 0;
  const lateRides = stats.notStartedShuttleRides ?? [];
  const overdue = stats.overdueInvoices ?? [];
  const overdueTotal = overdue.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const openReports = (stats.problemReports ?? []).length;

  return (
    <div className="space-y-6">
      {header}
      <FuelPriceAlert />

      <section aria-labelledby="attention-heading" className="space-y-4">
        <SectionHeader title={<span id="attention-heading">Needs attention</span>} />
        <StatStrip
          aria-label="Needs attention"
          items={[
            {
              key: "unassigned",
              label: "Unassigned bookings",
              value: formatNumber(unassigned),
              hint: unassigned > 0 ? "Assign a driver before pickup" : "Every booking has a driver",
              status: unassigned > 0 ? "danger" : "none",
              href: "/admin/bookings/pending",
            },
            {
              key: "late",
              label: "Late shuttle rides",
              value: formatNumber(lateRides.length),
              hint: lateRides.length > 0 ? "Departure passed, not started" : "Today's rides are on time",
              status: lateRides.length > 0 ? "danger" : "none",
              href: "#late-rides",
            },
            {
              key: "overdue",
              label: "Overdue invoices",
              value: formatNumber(overdue.length),
              hint: overdue.length > 0 ? `${formatCurrency(overdueTotal)} unpaid over 30 days` : "Nothing older than 30 days",
              status: overdue.length > 0 ? "danger" : "none",
              href: "#overdue-invoices",
            },
            {
              key: "reports",
              label: "Open problem reports",
              value: formatNumber(openReports),
              hint: openReports > 0 ? "From driver and employee apps" : "No open reports",
              status: openReports > 0 ? "warning" : "none",
              href: "#problem-reports",
            },
          ]}
        />
        <NotStartedRides rides={lateRides} />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Financial performance" />
        <StatStrip
          aria-label="Financial performance"
          items={[
            { key: "revenue", label: "Total revenue", value: formatCurrency(stats.totalRevenue.current), delta: deltaOf(stats.totalRevenue) },
            { key: "cogs", label: "Total COGS", value: formatCurrency(stats.totalCOGS.current), delta: deltaOf(stats.totalCOGS, true) },
            { key: "profit", label: "Gross profit", value: formatCurrency(stats.grossProfit.current), delta: deltaOf(stats.grossProfit), status: stats.grossProfit.current < 0 ? "danger" : "none" },
            { key: "margin", label: "Net margin", value: formatPercent(stats.netMargin.current, 2), delta: deltaOf(stats.netMargin) },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ServiceComparison stats={stats} />
          </div>
          <CashPosition stats={stats} onOpenReceivables={() => setReceivablesOpen(true)} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Work queues" description="Collections and issues raised from the apps." />
        <ActionTables overdueInvoices={stats.overdueInvoices} problemReports={stats.problemReports} />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Breakdowns" description="Where rides, expenses and revenue came from." />
        <BreakdownCharts ridesBreakdown={stats.ridesBreakdown} expensesBreakdown={stats.expensesBreakdown} revenueBreakdown={stats.revenueBreakdown} />
        <CostTables
          revenueByClient={stats.revenueByClient}
          fuelExpenses={stats.fuelExpenses}
          fuelMonthComparison={stats.fuelMonthComparison}
          repairExpenses={stats.repairExpenses}
        />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Fleet efficiency" />
        <ShuttleVehicleEfficiency />
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

/** Receivables vs payables with the net between them; receivables open the per-client drawer. */
function CashPosition({ stats, onOpenReceivables }: { stats: SuperAdminDashboardStats; onOpenReceivables: () => void }) {
  const net = stats.totalReceivables - stats.totalPayables;
  return (
    <Card className="flex flex-col">
      <CardHeader title="Cash position" description="Outstanding balances" />
      <div className="flex-1 divide-y divide-line">
        <button
          type="button"
          onClick={onOpenReceivables}
          className={cn("group flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-subtle", focusRingInset)}
        >
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-fg-muted">Receivables</p>
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-fg">{formatCurrency(stats.totalReceivables)}</p>
            {stats.currentPeriodReceivables != null && (
              <p className="mt-0.5 text-xs text-fg-muted">This period: {formatCurrency(stats.currentPeriodReceivables)}</p>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-fg-muted group-hover:text-fg">
            By client
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </span>
        </button>
        <div className="px-5 py-4">
          <p className="text-[13px] font-medium text-fg-muted">Payables</p>
          <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-fg">{formatCurrency(stats.totalPayables)}</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {stats.currentPeriodPayables != null ? `This period: ${formatCurrency(stats.currentPeriodPayables)}` : "Owed to vendors and drivers"}
          </p>
        </div>
      </div>
      <CardFooter className="justify-between text-sm">
        <span className="font-medium text-fg-secondary">Net position</span>
        <span className={cn("font-semibold tabular-nums", net < 0 ? "text-danger-ink" : "text-success-ink")}>{formatCurrency(net)}</span>
      </CardFooter>
    </Card>
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
            <span className="shrink-0 tabular-nums text-fg">{formatCurrency(item.value)}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-subtle" aria-hidden="true">
            <div className="h-full rounded-full bg-warning" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
