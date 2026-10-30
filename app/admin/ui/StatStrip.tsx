import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRingInset, surface } from "./styles";
import type { KpiDelta } from "./KpiCard";

export interface StatItem {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small text under the value. */
  hint?: React.ReactNode;
  delta?: KpiDelta;
  /** Colours the value and adds a status dot; "none" stays neutral. */
  status?: "none" | "danger" | "warning";
  href?: string;
}

const dotCls = { danger: "bg-danger", warning: "bg-warning" } as const;
const valueCls = { none: "text-fg", danger: "text-danger-ink", warning: "text-warning-ink" } as const;

/** Percent changes past ±999% (tiny or negative bases) carry no meaning, so they're capped. */
function formatDelta(v: number) {
  const abs = Math.abs(v);
  return abs >= 1000 ? ">999%" : `${abs.toFixed(1)}%`;
}

function Delta({ delta }: { delta: KpiDelta }) {
  const dir = delta.value > 0 ? "up" : delta.value < 0 ? "down" : "flat";
  const good = delta.invert ? delta.value < 0 : delta.value > 0;
  const bad = delta.invert ? delta.value > 0 : delta.value < 0;
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", good ? "text-success-ink" : bad ? "text-danger-ink" : "text-fg-muted")}>
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{dir === "up" ? "Up" : dir === "down" ? "Down" : "Unchanged"} </span>
      {formatDelta(delta.value)}
      {delta.label && <span className="ml-1 font-normal text-fg-muted">{delta.label}</span>}
    </span>
  );
}

/**
 * Four related figures in one panel, split by hairlines: two columns on small screens, one row from lg.
 * Use instead of a KpiGrid when the numbers belong together and don't each need a card.
 */
export function StatStrip({ items, className, "aria-label": ariaLabel }: { items: StatItem[]; className?: string; "aria-label"?: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn(surface, "grid grid-cols-2 overflow-hidden lg:grid-cols-4", className)}>
      {items.map((item, i) => {
        const status = item.status ?? "none";
        const cellCls = cn(
          "group relative flex min-w-0 flex-col px-5 py-4 border-line",
          i % 2 === 1 && "border-l",
          i >= 2 && "border-t lg:border-t-0",
          i === 2 && "lg:border-l",
          item.href && cn("transition-colors hover:bg-subtle", focusRingInset),
        );
        const body = (
          <>
            <p className="flex items-center gap-2 text-[13px] font-medium text-fg-muted">
              {status !== "none" && <span className={cn("size-1.5 shrink-0 rounded-full", dotCls[status])} aria-hidden="true" />}
              <span className="truncate">{item.label}</span>
              {item.href && (
                <ChevronRight className="ml-auto size-4 shrink-0 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
              )}
            </p>
            <p className={cn("mt-1.5 text-2xl font-semibold tracking-tight tabular-nums", valueCls[status])}>{item.value}</p>
            {(item.delta || item.hint) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                {item.delta && <Delta delta={item.delta} />}
                {item.hint && <span className="truncate">{item.hint}</span>}
              </div>
            )}
          </>
        );
        return item.href ? (
          <Link key={item.key} href={item.href} className={cellCls}>
            {body}
          </Link>
        ) : (
          <div key={item.key} className={cellCls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
