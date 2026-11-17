"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared building blocks for the Analytics page (same look as the savings dashboard). */

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-2xl border border-line bg-card", className)}>{children}</div>;
}

export function SectionHeading({
  title,
  description,
  badge,
  action,
}: {
  title: string;
  description?: string;
  /** e.g. the period the figures cover */
  badge?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-fg">
          {title}
          {badge && <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-medium text-fg-muted">{badge}</span>}
        </h3>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "warning" | "success";
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-fg-muted">{label}</p>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-subtle text-fg-muted [&_svg]:size-[18px]">{icon}</span>
      </div>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
          tone === "warning" ? "text-[var(--cort-orange)]" : tone === "success" ? "text-success-ink" : "text-fg",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function UtilizationBar({ pct, lowBelow = 60 }: { pct: number; lowBelow?: number }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= lowBelow ? "bg-yellow-400" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={cn("w-10 text-end text-xs font-semibold", pct < lowBelow ? "text-rose-400" : "text-fg-muted")}>{pct}%</span>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; icon?: ReactNode }[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-card p-1 sm:w-fit">
      {tabs.map((x) => (
        <button
          key={x.id}
          role="tab"
          type="button"
          id={`tab-${x.id}`}
          aria-selected={active === x.id}
          aria-controls={`panel-${x.id}`}
          onClick={() => onChange(x.id)}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors sm:flex-none [&_svg]:size-4",
            active === x.id ? "bg-brand text-white" : "text-fg-muted hover:bg-subtle hover:text-fg",
          )}
        >
          {x.icon}
          {x.label}
        </button>
      ))}
    </div>
  );
}
