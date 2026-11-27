"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/app/admin/ui";

/** Shared building blocks for the Analytics page (same surfaces as the company Overview). */

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-xl border border-line bg-card", className)}>{children}</div>;
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
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-fg">
          {title}
          {badge && <span className="rounded-md bg-subtle px-2 py-0.5 text-xs font-medium text-fg-muted tabular-nums">{badge}</span>}
        </h3>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** One headline figure: label and value. `tone` marks a value that needs attention. */
export function KpiTile({ label, value, tone }: { label: string; value: string; tone?: "warning" | "success" }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-card p-4">
      <p className="truncate text-xs font-medium text-fg-muted">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
          tone === "warning" ? "text-warning-ink" : tone === "success" ? "text-success-ink" : "text-fg",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Horizontal share bar; the percentage is always printed next to it, so colour is not the only cue. */
export function UtilizationBar({ pct, lowBelow = 60 }: { pct: number; lowBelow?: number }) {
  const color = pct >= 80 ? "bg-success" : pct >= lowBelow ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <span className={cn("w-10 text-end text-xs font-medium tabular-nums", pct < lowBelow ? "text-danger-ink" : "text-fg-muted")}>{pct}%</span>
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
    <div
      role="tablist"
      aria-label={label}
      className="flex w-full items-center gap-1 overflow-x-auto border-b border-line"
      onKeyDown={(e) => {
        const i = tabs.findIndex((x) => x.id === active);
        const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
        const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 } as Record<string, number>;
        let next = -1;
        if (e.key in step) next = (i + step[e.key] + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next < 0) return;
        e.preventDefault();
        onChange(tabs[next].id);
        e.currentTarget.querySelector<HTMLButtonElement>(`#tab-${tabs[next].id}`)?.focus();
      }}
    >
      {tabs.map((x) => (
        <button
          key={x.id}
          role="tab"
          type="button"
          id={`tab-${x.id}`}
          aria-selected={active === x.id}
          aria-controls={`panel-${x.id}`}
          tabIndex={active === x.id ? 0 : -1}
          onClick={() => onChange(x.id)}
          className={cn(
            "-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2.5 text-sm font-medium transition-colors [&_svg]:size-4",
            focusRing,
            active === x.id ? "border-brand text-fg" : "border-transparent text-fg-muted hover:text-fg",
          )}
        >
          {x.icon}
          {x.label}
        </button>
      ))}
    </div>
  );
}
