"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "@/app/components/icons";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Signed % change with an arrow, so direction never relies on colour alone.
 * `invert` when a decrease is good (spend, overdue).
 */
export function Delta({ value, label, invert = false, className }: { value: number; label?: string; invert?: boolean; className?: string }) {
  const t = useTranslations("company.overview.delta");
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const good = invert ? value < 0 : value > 0;
  const bad = invert ? value > 0 : value < 0;
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const abs = Math.abs(value);
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", good ? "text-success-ink" : bad ? "text-danger-ink" : "text-fg-muted", className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t(dir)} </span>
      {abs >= 1000 ? ">999%" : `${abs.toFixed(abs < 10 && abs % 1 !== 0 ? 1 : 0)}%`}
      {label && <span className="ms-1 font-normal text-fg-muted">{label}</span>}
    </span>
  );
}

/** A row of related figures split by hairlines (logical borders, RTL-safe). */
export function FigureRow({ items, className }: { items: { key: string; label: string; value: string; sub?: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 border-t border-line sm:grid-cols-3", className)}>
      {items.map((it, i) => (
        <div key={it.key} className={cn("min-w-0 px-4 py-3 sm:px-5", i > 0 && "border-t border-line sm:border-t-0 sm:border-s")}>
          <dt className="truncate text-xs text-fg-muted">{it.label}</dt>
          <dd className="mt-1 text-base font-semibold text-fg tabular-nums">{it.value}</dd>
          {it.sub && <dd className="mt-0.5 text-xs text-fg-muted">{it.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}
