"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import type { FuelPriceHistoryEntry } from "../../../lib/services/api-client";
import { Badge, Button, Card, CardContent, CardHeader, ChartCard, ChartTooltip, Field, Input, axisProps, gridProps, useChartTheme } from "../../ui";
import { formatCurrency, formatDate } from "../../lib/format";

export interface FuelPricePanelProps {
  kind: "petrol" | "diesel";
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  onUpdate: () => void;
  updating: boolean;
  canUpdate: boolean;
  history: FuelPriceHistoryEntry[];
  /** Extra controls rendered beside the Update button (e.g. Preview adjustments). */
  extraActions?: React.ReactNode;
  /** Content rendered above the input row (e.g. external price suggestion). */
  children?: React.ReactNode;
}

export function FuelPricePanel({ kind, title, description, value, onChange, onUpdate, updating, canUpdate, history, extraActions, children }: FuelPricePanelProps) {
  const chart = useChartTheme();
  const color = chart.colors[kind === "petrol" ? 0 : 5];
  const gradientId = `fuel-history-${kind}`;

  const chartData = React.useMemo(
    () =>
      history.map((entry) => ({
        date: formatDate(entry.effective_from),
        price: Number(entry.price),
        raw: entry,
      })),
    [history],
  );

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            {title}
            {kind === "diesel" && (
              <Badge tone="warning" size="sm">
                Shuttle only
              </Badge>
            )}
          </span>
        }
        description={description}
      />
      <CardContent className="space-y-4">
        {children}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label={`Current ${kind} price (PKR)`} className="sm:max-w-xs sm:flex-1">
            <Input type="number" min={0} step="0.01" mono value={value} onChange={(e) => onChange(e.target.value)} disabled={!canUpdate} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onUpdate} disabled={!canUpdate} loading={updating}>
              {updating ? "Updating…" : "Update price"}
            </Button>
            {extraActions}
          </div>
        </div>
        <ChartCard
          title="Price history"
          description="Effective price over time"
          height={180}
          empty={chartData.length < 2}
          emptyTitle="Not enough history yet"
          emptyDescription="Make another price update to see the trend."
          table={
            <table className="w-full text-xs">
              <thead className="text-left text-fg-muted">
                <tr>
                  <th scope="col" className="py-1 font-medium">Effective from</th>
                  <th scope="col" className="py-1 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((d) => (
                  <tr key={d.raw.id} className="border-t border-line">
                    <td className="py-1 text-fg">{d.date}</td>
                    <td className="py-1 text-right font-mono tabular-nums text-fg">{formatCurrency(d.price, { digits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps(chart)} />
              <XAxis dataKey="date" {...axisProps(chart)} dy={6} />
              <YAxis {...axisProps(chart)} width={48} domain={["dataMin - 5", "dataMax + 5"]} />
              <RTooltip content={<ChartTooltip formatter={(v) => formatCurrency(Number(v), { digits: 2 })} />} cursor={{ stroke: chart.axis, strokeWidth: 1 }} />
              <Area type="stepAfter" dataKey="price" name="Price" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: chart.surface }} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </CardContent>
    </Card>
  );
}
