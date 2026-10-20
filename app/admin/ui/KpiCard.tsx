"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing, surface } from "./styles";
import { KpiSkeleton } from "./Skeleton";
import type { BadgeTone } from "./Badge";

export interface KpiDelta {
  /** Percentage change vs the comparison period (e.g. 12.5 for +12.5%). */
  value: number;
  /** "vs last month" */
  label?: string;
  /** Set when a decrease is good (costs, overdue). */
  invert?: boolean;
}

export interface KpiCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: KpiDelta;
  /** Small text under the value: "Prev: PKR 1.2M". */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: BadgeTone;
  /** Tiny trend line from a series of numbers (placeholder-safe: pass [] to hide). */
  sparkline?: number[];
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  /** Visually emphasised (danger tone border) for critical alerts. */
  emphasis?: "none" | "danger" | "brand";
  className?: string;
}

const iconTone: Record<BadgeTone, string> = {
  neutral: "bg-subtle text-fg-muted",
  brand: "bg-brand-soft text-brand-ink",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
  purple: "bg-purple-soft text-purple-ink",
};

function Sparkline({ points, className }: { points: number[]; className?: string }) {
  if (points.length < 2) return null;
  const w = 96;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / span) * (h - 4) - 2}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" className={cn("shrink-0 overflow-visible", className)}>
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function KpiCard({ label, value, delta, hint, icon, tone = "neutral", sparkline, href, onClick, loading, emphasis = "none", className }: KpiCardProps) {
  if (loading) return <KpiSkeleton className={className} />;

  const dir = delta ? (delta.value > 0 ? "up" : delta.value < 0 ? "down" : "flat") : null;
  const good = delta ? (delta.invert ? delta.value < 0 : delta.value > 0) : false;
  const bad = delta ? (delta.invert ? delta.value > 0 : delta.value < 0) : false;
  const deltaCls = good ? "text-success-ink" : bad ? "text-danger-ink" : "text-fg-muted";
  const DeltaIcon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;

  const interactive = !!href || !!onClick;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-fg-muted">{label}</p>
        {icon && <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", iconTone[tone])}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
        {sparkline && sparkline.length > 1 && <Sparkline points={sparkline} className={good ? "text-success" : bad ? "text-danger" : "text-brand"} />}
      </div>
      {(delta || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {delta && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", deltaCls)}>
              <DeltaIcon className="size-3.5" aria-hidden="true" />
              <span className="sr-only">{dir === "up" ? "Up" : dir === "down" ? "Down" : "Unchanged"} </span>
              {Math.abs(delta.value).toFixed(1)}%
              {delta.label && <span className="ml-1 font-normal text-fg-muted">{delta.label}</span>}
            </span>
          )}
          {hint && <span className="text-fg-muted">{hint}</span>}
        </div>
      )}
    </>
  );

  const cls = cn(
    surface,
    "flex flex-col p-4 text-left",
    emphasis === "danger" && "border-danger-line",
    emphasis === "brand" && "border-brand-line",
    interactive && cn("cursor-pointer transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]", focusRing),
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(cls, "w-full")}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Responsive grid for KPI cards. */
export function KpiGrid({ cols = 4, className, children }: { cols?: 2 | 3 | 4 | 5 | 6; className?: string; children: React.ReactNode }) {
  const colCls = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 xl:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
    6: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
  }[cols];
  return <div className={cn("grid grid-cols-1 gap-4", colCls, className)}>{children}</div>;
}
