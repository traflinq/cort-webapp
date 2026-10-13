"use client";

import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { MetricComparison } from "../../../lib/types/admin-dashboard";
import { AnimatedNumber } from "../../components/ui/AnimatedNumber";
import { cx } from "../../components/ui/cx";

export type MetricType = "currency" | "number" | "percentage";

const currency = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("en-US");

export const formatCurrency = (v: number) => currency.format(Math.round(v));
export const formatInteger = (v: number) => integer.format(Math.round(v));
export const formatPercent = (v: number) => `${v.toFixed(2)}%`;

export function formatterFor(type: MetricType) {
  return type === "currency" ? formatCurrency : type === "percentage" ? formatPercent : formatInteger;
}

/** Trend pill. `invert` flips the colour (not the arrow) for cost-like metrics where down is good. */
export function TrendBadge({
  trend,
  change,
  invert,
}: {
  trend: string;
  change: number;
  invert?: boolean;
}) {
  const Icon = trend === "neutral" ? Minus : trend === "up" ? ArrowUpRight : ArrowDownRight;
  const good = trend === "neutral" ? null : (trend === "up") !== !!invert;
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset",
        good === null && "bg-[var(--bg-subtle)] text-[var(--text-muted)] ring-[var(--border-default)]",
        good === true && "bg-emerald-500/10 text-[var(--success-text)] ring-emerald-500/20",
        good === false && "bg-rose-500/10 text-[var(--danger-text)] ring-rose-500/20",
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

/** Two thin bars — this period vs the previous one — scaled against the larger of the two. */
export function CompareBars({ current, previous }: { current: number; previous: number }) {
  const max = Math.max(Math.abs(current), Math.abs(previous), 1);
  const rows = [
    { key: "now", w: (Math.abs(current) / max) * 100, className: "bg-[var(--cort-orange)]" },
    { key: "prev", w: (Math.abs(previous) / max) * 100, className: "bg-[var(--border-strong)]" },
  ];
  return (
    <div className="space-y-1.5" aria-hidden>
      {rows.map((r, i) => (
        <div key={r.key} className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <motion.div
            className={cx("h-full rounded-full", r.className)}
            initial={{ width: 0 }}
            whileInView={{ width: `${r.w}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      ))}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  metric: MetricComparison;
  type?: MetricType;
  icon?: LucideIcon;
  /** Colours the value for risk metrics (e.g. unassigned bookings > 0). */
  tone?: "default" | "danger";
  /** Cost-like metric: a rise is bad news. */
  invert?: boolean;
  overlayContent?: React.ReactNode;
}

export function MetricCard({
  label,
  metric,
  type = "number",
  icon: Icon,
  tone = "default",
  invert,
  overlayContent,
}: MetricCardProps) {
  const { current, previous, percentageChange, trend } = metric;
  const hasComparison = previous !== 0;
  const format = formatterFor(type);

  return (
    <div className="group relative flex flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-default)] transition-colors group-hover:text-[var(--cort-orange)]">
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </span>
          )}
          <span className="truncate text-[13px] font-medium text-[var(--text-muted)]">{label}</span>
        </div>
        {hasComparison && <TrendBadge trend={trend} change={percentageChange} invert={invert} />}
      </div>

      <AnimatedNumber
        value={current}
        format={format}
        className={cx(
          "mt-4 block text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums",
          tone === "danger" && current > 0 ? "text-[var(--danger-text)]" : "text-[var(--text-primary)]",
        )}
      />

      {hasComparison ? (
        <div className="mt-4 space-y-2">
          <CompareBars current={current} previous={previous} />
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Previous period</span>
            <span className="font-medium tabular-nums text-[var(--text-secondary)]">{format(previous)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-4 h-[2.1rem]" aria-hidden />
      )}

      {overlayContent && (
        <div className="invisible absolute left-1/2 top-1/2 z-50 w-64 -translate-x-1/2 -translate-y-1/2 scale-95 opacity-0 transition-all duration-200 group-hover:visible group-hover:scale-100 group-hover:opacity-100 md:w-80">
          {overlayContent}
        </div>
      )}
    </div>
  );
}
