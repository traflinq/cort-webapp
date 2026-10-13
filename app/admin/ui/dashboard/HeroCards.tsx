"use client";

import Link from "next/link";
import { ArrowRight, Banknote, Wallet } from "lucide-react";
import { motion } from "motion/react";
import type { SuperAdminDashboardStats } from "../../../lib/types/admin-dashboard";
import { AnimatedNumber } from "../../components/ui/AnimatedNumber";
import { cx } from "../../components/ui/cx";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatCurrency, formatPercent, TrendBadge } from "./MetricCard";

const card =
  "rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]";

function Bar({ pct, className, delay = 0 }: { pct: number; className: string; delay?: number }) {
  return (
    <motion.div
      className={cx("h-full", className)}
      initial={{ width: 0 }}
      whileInView={{ width: `${pct}%` }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}

function MiniStat({
  label,
  value,
  trend,
  change,
  invert,
}: {
  label: string;
  value: string;
  trend: string;
  change: number;
  invert?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1.5 px-5 first:pl-0 last:pr-0">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">{value}</span>
        <TrendBadge trend={trend} change={change} invert={invert} />
      </div>
    </div>
  );
}

/** The one number the page is about: total revenue, how it splits, and what's left after costs. */
export function RevenueHero({ stats }: { stats: SuperAdminDashboardStats }) {
  const chauffeur = stats.chauffeurRevenue.current;
  const shuttle = stats.shuttleRevenue.current;
  const split = chauffeur + shuttle;
  const chauffeurPct = split > 0 ? (chauffeur / split) * 100 : 0;

  return (
    <div className={cx(card, "relative overflow-hidden p-6 lg:col-span-2")}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--cort-orange)] opacity-[0.07] blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[var(--text-muted)]">Total revenue</span>
          {stats.totalRevenue.previous !== 0 && (
            <TrendBadge trend={stats.totalRevenue.trend} change={stats.totalRevenue.percentageChange} />
          )}
        </div>
        <AnimatedNumber
          value={stats.totalRevenue.current}
          format={formatCurrency}
          className="mt-3 block text-4xl font-semibold leading-none tracking-tight tabular-nums text-[var(--text-primary)] sm:text-[2.75rem]"
        />
        {stats.totalRevenue.previous !== 0 && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            vs {formatCurrency(stats.totalRevenue.previous)} in the previous period
          </p>
        )}

        <div className="mt-6">
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]" aria-hidden>
            <Bar pct={chauffeurPct} className="rounded-full bg-[var(--cort-orange)]" />
            <Bar pct={split > 0 ? 100 - chauffeurPct : 0} className="rounded-full bg-[#3b5bdb]" delay={0.1} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
              <span className="h-2 w-2 rounded-full bg-[var(--cort-orange)]" />
              Chauffeur
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">{formatCurrency(chauffeur)}</span>
            </span>
            <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
              <span className="h-2 w-2 rounded-full bg-[#3b5bdb]" />
              Shuttle
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">{formatCurrency(shuttle)}</span>
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-[var(--divider)] pt-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[var(--divider)]">
          <MiniStat
            label="Total COGS"
            value={formatCurrency(stats.totalCOGS.current)}
            trend={stats.totalCOGS.trend}
            change={stats.totalCOGS.percentageChange}
            invert
          />
          <MiniStat
            label="Gross profit"
            value={formatCurrency(stats.grossProfit.current)}
            trend={stats.grossProfit.trend}
            change={stats.grossProfit.percentageChange}
          />
          <MiniStat
            label="Net margin"
            value={formatPercent(stats.netMargin.current)}
            trend={stats.netMargin.trend}
            change={stats.netMargin.percentageChange}
          />
        </div>
      </div>
    </div>
  );
}

/** Receivables vs payables, plus who owes the most. */
export function CashCard({ stats }: { stats: SuperAdminDashboardStats }) {
  const receivables = stats.totalReceivables;
  const payables = stats.totalPayables;
  const net = receivables - payables;
  const max = Math.max(receivables, payables, 1);
  const clients = (stats.receivablesByClient ?? []).slice(0, 4);
  const topClient = Math.max(0, ...clients.map((c) => c.value));

  return (
    <div className={cx(card, "flex flex-col p-6")}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-muted)]">Cash position</span>
        <span
          className={cx(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset",
            net >= 0
              ? "bg-emerald-500/10 text-[var(--success-text)] ring-emerald-500/20"
              : "bg-rose-500/10 text-[var(--danger-text)] ring-rose-500/20",
          )}
        >
          Net {net >= 0 ? "+" : "−"}
          {formatCurrency(Math.abs(net))}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {[
          { label: "Receivables", value: receivables, icon: Banknote, bar: "bg-emerald-500" },
          { label: "Payables", value: payables, icon: Wallet, bar: "bg-rose-500" },
        ].map((row, i) => (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between text-[13px]">
              <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                <row.icon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                {row.label}
              </span>
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">{formatCurrency(row.value)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
              <Bar pct={(row.value / max) * 100} className={cx("rounded-full", row.bar)} delay={i * 0.1} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex-1 border-t border-[var(--divider)] pt-4">
        <div className="mb-3 text-xs font-medium text-[var(--text-muted)]">Largest balances</div>
        {clients.length === 0 ? (
          <EmptyState title="No pending receivables" className="py-4" />
        ) : (
          <ul className="space-y-3">
            {clients.map((c) => (
              <li key={c.name}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-[var(--text-secondary)]">{c.name}</span>
                  <span className="shrink-0 font-medium tabular-nums text-[var(--text-primary)]">
                    {formatCurrency(c.value)}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <Bar
                    pct={topClient > 0 ? (c.value / topClient) * 100 : 0}
                    className="rounded-full bg-[var(--cort-orange)]"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/admin/invoicing"
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        Open invoicing <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
