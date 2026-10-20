"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import type { BreakdownItem } from "../../../lib/types/admin-dashboard";
import { ChartCard, ChartTooltip, axisProps, useChartTheme } from "..";
import { formatCurrency, formatNumber } from "../../lib/format";

type BreakdownChartProps = {
  title: string;
  description: string;
  data: BreakdownItem[] | undefined;
  format: (v: number) => string;
  /** Slot in the validated categorical palette (one hue per single-series chart). */
  colorIndex: number;
  emptyTitle: string;
};

function BreakdownChart({ title, description, data, format, colorIndex, emptyTitle }: BreakdownChartProps) {
  const t = useChartTheme();
  const items = (data ?? []).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const height = Math.max(160, items.length * 36 + 24);
  return (
    <ChartCard
      title={title}
      description={description}
      empty={items.length === 0}
      emptyTitle={emptyTitle}
      height={height}
      table={
        <table className="w-full text-xs">
          <thead className="text-left text-fg-muted">
            <tr>
              <th scope="col" className="py-1 font-medium">Category</th>
              <th scope="col" className="py-1 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.name} className="border-t border-line">
                <td className="py-1 text-fg">{i.name}</td>
                <td className="py-1 text-right font-mono tabular-nums text-fg">{format(i.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 0 }} barCategoryGap={8}>
          <CartesianGrid stroke={t.grid} horizontal={false} />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={110} {...axisProps(t)} interval={0} />
          <RTooltip content={<ChartTooltip formatter={(v) => format(Number(v))} />} cursor={{ fill: t.grid }} />
          <Bar dataKey="value" name={title} fill={t.colors[colorIndex % t.colors.length]} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" formatter={(v: unknown) => format(Number(v))} style={{ fill: t.mutedText, fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function BreakdownCharts({
  ridesBreakdown,
  expensesBreakdown,
  revenueBreakdown,
}: {
  ridesBreakdown: BreakdownItem[];
  expensesBreakdown: BreakdownItem[];
  revenueBreakdown: BreakdownItem[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <BreakdownChart title="Rides by type" description="Trips in the period" data={ridesBreakdown} format={(v) => `${formatNumber(v)} trips`} colorIndex={1} emptyTitle="No rides in this period" />
      <BreakdownChart title="Expenses by category" description="PKR, period total" data={expensesBreakdown} format={(v) => formatCurrency(v)} colorIndex={0} emptyTitle="No expenses in this period" />
      <BreakdownChart title="Revenue by stream" description="PKR, period total" data={revenueBreakdown} format={(v) => formatCurrency(v)} colorIndex={2} emptyTitle="No revenue in this period" />
    </div>
  );
}
