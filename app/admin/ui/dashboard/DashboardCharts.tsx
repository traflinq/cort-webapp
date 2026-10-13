"use client";

import { motion } from "motion/react";
import { PieChart } from "lucide-react";
import { BreakdownItem } from "../../../lib/types/admin-dashboard";
import { cx } from "../../components/ui/cx";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatCurrency, formatInteger } from "./MetricCard";

const PALETTE = ["#fe8503", "#3b5bdb", "#10b981", "#8b5cf6", "#f59e0b", "#64748b"];

/** Ranked horizontal bars: reads faster than pies and stays legible with many categories. */
function RankedCard({
  title,
  subtitle,
  data,
  emptyMessage,
  formatValue,
}: {
  title: string;
  subtitle: string;
  data: BreakdownItem[];
  emptyMessage: string;
  formatValue: (value: number) => string;
}) {
  const rows = [...(data ?? [])].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const total = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
        <span className="text-xs text-[var(--text-muted)]">{subtitle}</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={PieChart} title={emptyMessage} className="py-10" />
      ) : (
        <ul className="mt-5 space-y-4">
          {rows.map((r, i) => {
            const pct = total > 0 ? (r.value / total) * 100 : 0;
            return (
              <li key={r.name}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                  <span className="inline-flex min-w-0 items-center gap-2 text-[var(--text-secondary)]">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: PALETTE[i % PALETTE.length] }}
                    />
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold text-[var(--text-primary)]">{formatValue(r.value)}</span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">{pct.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <motion.div
                    className={cx("h-full rounded-full")}
                    style={{ background: PALETTE[i % PALETTE.length] }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DashboardCharts({
  ridesBreakdown,
  expensesBreakdown,
  revenueBreakdown,
}: {
  ridesBreakdown: BreakdownItem[];
  expensesBreakdown: BreakdownItem[];
  revenueBreakdown: BreakdownItem[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <RankedCard
        title="Revenue stream"
        subtitle="Share of revenue"
        data={revenueBreakdown}
        emptyMessage="No revenue data"
        formatValue={formatCurrency}
      />
      <RankedCard
        title="Expense allocation"
        subtitle="Share of spend"
        data={expensesBreakdown}
        emptyMessage="No expense data"
        formatValue={formatCurrency}
      />
      <RankedCard
        title="Rides distribution"
        subtitle="Share of trips"
        data={ridesBreakdown}
        emptyMessage="No rides data"
        formatValue={(v) => `${formatInteger(v)} trips`}
      />
    </div>
  );
}
