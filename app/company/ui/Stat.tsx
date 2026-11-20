"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./Feedback";
import { focusRing } from "./styles";
import type { Tone } from "./Badge";

const VALUE_TONE: Partial<Record<Tone, string>> = {
  success: "text-success-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
};

export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Secondary line under the value. */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** Colours the value (use for "needs attention" numbers only). */
  tone?: Tone;
  /** % change vs the previous period; `invert` when a decrease is good. */
  delta?: { value: number | null; label?: React.ReactNode; invert?: boolean };
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}

/** One number with its label. The only KPI tile in the portal. */
export function StatCard({ label, value, hint, icon, tone, delta, href, onClick, loading, className }: StatCardProps) {
  const interactive = !!(href || onClick);
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-fg-muted">{label}</p>
        {icon && (
          <span className="shrink-0 text-fg-muted [&_svg]:size-[18px]" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", (tone && VALUE_TONE[tone]) || "text-fg")}>{value}</p>
      )}
      {(delta || hint) && !loading && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
          {delta && <Delta {...delta} />}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </>
  );
  const cls = cn(
    "block rounded-lg border border-line bg-card p-4 text-start",
    interactive && cn("cursor-pointer transition-colors hover:border-line-strong hover:bg-[var(--bg-card-hover)]", focusRing),
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
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

export function Delta({ value, label, invert }: { value: number | null; label?: React.ReactNode; invert?: boolean }) {
  if (value == null) return label ? <span>{label}</span> : null;
  const good = invert ? value < 0 : value > 0;
  const bad = invert ? value > 0 : value < 0;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", good ? "text-success-ink" : bad ? "text-danger-ink" : "text-fg-muted")}>
      <Icon className="size-3.5" aria-hidden="true" />
      {Math.abs(value).toFixed(1)}%{label && <span className="ms-1 font-normal text-fg-muted">{label}</span>}
    </span>
  );
}

export function StatGrid({ cols = 4, className, children }: { cols?: 2 | 3 | 4 | 5; className?: string; children: React.ReactNode }) {
  const grid = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
  }[cols];
  return <div className={cn("grid grid-cols-1 gap-3", grid, className)}>{children}</div>;
}

/** Thin horizontal meter (utilisation, budget used). */
export function Meter({
  value,
  tone,
  label,
  className,
}: {
  /** 0–100 */
  value: number;
  tone?: "action" | "success" | "warning" | "danger";
  /** Accessible name. */
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const bar = { action: "bg-action", success: "bg-success-ink", warning: "bg-warning-ink", danger: "bg-danger-ink" }[tone ?? "action"];
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-subtle", className)}>
      <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}
