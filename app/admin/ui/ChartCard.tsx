"use client";

import * as React from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "./Card";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { useChartTheme } from "./chart-theme";

export interface ChartCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Time-range control, segmented toggle, menu… */
  actions?: React.ReactNode;
  /** Legend rendered under the header (use <ChartLegend>). */
  legend?: React.ReactNode;
  height?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Set true to show the empty state instead of children. */
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Hidden-until-requested data table for accessibility. */
  table?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** Card wrapper for Recharts charts with consistent header, legend, and states. */
export function ChartCard({
  title,
  description,
  actions,
  legend,
  height = 260,
  loading,
  error,
  onRetry,
  empty,
  emptyTitle = "No data for this period",
  emptyDescription,
  table,
  className,
  children,
}: ChartCardProps) {
  const [showTable, setShowTable] = React.useState(false);
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader title={title} description={description} actions={actions} flush />
      {legend && <div className="px-5 pb-1">{legend}</div>}
      <div className="px-3 pb-4" style={{ minHeight: height }}>
        {loading ? (
          <div className="flex h-full flex-col justify-end gap-2 px-2 pt-6" style={{ height }} aria-busy="true">
            <div className="flex h-full items-end gap-2">
              {[40, 65, 50, 80, 60, 90, 70, 55].map((h, i) => (
                <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        ) : error ? (
          <ErrorState compact message={error} onRetry={onRetry} />
        ) : empty ? (
          <EmptyState compact icon={<BarChart3 aria-hidden="true" />} title={emptyTitle} description={emptyDescription} />
        ) : showTable && table ? (
          <div className="overflow-x-auto px-2">{table}</div>
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </div>
      {table && !loading && !error && !empty && (
        <div className="border-t border-line px-5 py-2">
          <button
            type="button"
            onClick={() => setShowTable((s) => !s)}
            aria-pressed={showTable}
            className="cursor-pointer text-xs font-medium text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {showTable ? "Show chart" : "Show as table"}
          </button>
        </div>
      )}
    </Card>
  );
}

export interface ChartLegendItem {
  label: React.ReactNode;
  color: string;
  /** "dashed" for secondary series to add a non-colour cue. */
  style?: "solid" | "dashed";
  value?: React.ReactNode;
}

export function ChartLegend({ items, className }: { items: ChartLegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-secondary", className)}>
      {items.map((it, i) => (
        <li key={i} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-3.5 rounded-full"
            style={{ backgroundColor: it.style === "dashed" ? "transparent" : it.color, borderTop: it.style === "dashed" ? `2px dashed ${it.color}` : undefined }}
          />
          <span>{it.label}</span>
          {it.value !== undefined && <span className="font-medium tabular-nums text-fg">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Recharts custom tooltip content. Pass as <Tooltip content={<ChartTooltip formatter={…} />} /> */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }>;
  label?: string | number;
  formatter?: (value: number | string, name: string) => React.ReactNode;
  labelFormatter?: (label: string | number) => React.ReactNode;
}) {
  const t = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="min-w-[8rem] rounded-lg border px-3 py-2 text-xs shadow-[var(--shadow-modal)]"
      style={{ background: t.tooltipBg, borderColor: t.tooltipBorder, color: t.text }}
    >
      {label !== undefined && <div className="mb-1 font-medium">{labelFormatter ? labelFormatter(label) : label}</div>}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5" style={{ color: t.mutedText }}>
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium tabular-nums">{formatter && p.value !== undefined ? formatter(p.value, String(p.name ?? "")) : p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
