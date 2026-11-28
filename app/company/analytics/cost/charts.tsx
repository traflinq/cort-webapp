"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCompanyTheme } from "../../lib/theme-context";
import { useFmt } from "./hooks";
import type { OccupancyReport, SpendHistory } from "./types";

/** Company palette, validated with the dataviz validator (fixed series order). Mirrors --chart-1…6 in globals.css. Map/chart layers need literal colours. */
const LIGHT = ["#e2622a", "#6e7ff0", "#2a9f59", "#9b4fc4", "#c08400", "#de5c97"];
const DARK = ["#e8692e", "#7d8cf5", "#38b56a", "#b072e0", "#c08e12", "#e26a9f"];

export function useChartColors() {
  const { theme } = useCompanyTheme();
  return useMemo(
    () =>
      theme === "dark"
        ? { series: DARK, grid: "rgba(255,255,255,0.06)", axis: "rgba(237,237,237,0.5)", tooltipBg: "#f4f4f5", tooltipBorder: "rgba(24,24,27,0.10)", tooltipText: "#18181b", text: "#ededed", muted: "#71717a", tooltipMuted: "rgba(24,24,27,0.62)", neutral: "rgba(255,255,255,0.14)", surface: "#141414" }
        : { series: LIGHT, grid: "rgba(24,24,27,0.07)", axis: "rgba(24,24,27,0.5)", tooltipBg: "#18181b", tooltipBorder: "rgba(255,255,255,0.08)", tooltipText: "#fafafa", text: "#18181b", muted: "#a1a1aa", tooltipMuted: "rgba(250,250,250,0.62)", neutral: "rgba(24,24,27,0.12)", surface: "#ffffff" },
    [theme],
  );
}

function useTooltipStyle() {
  const c = useChartColors();
  return {
    contentStyle: { background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 10, fontSize: 12, color: c.tooltipText, fontVariantNumeric: "tabular-nums" },
    labelStyle: { color: c.tooltipText, fontWeight: 600 },
    itemStyle: { color: c.tooltipText },
  };
}

/**
 * The chart's numbers as a table for screen readers (the visual chart only reveals values on hover).
 * Recharts' accessibilityLayer keeps the chart itself keyboard-navigable.
 */
export function ChartDataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  // Visually hidden on a wrapper, not the table: a table ignores the 1px width of `sr-only` and its
  // full width would still widen the page on phones.
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} scope="col">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Recessive axes: muted 12px ticks, no axis or tick lines. */
const axis = (color: string) => ({ tick: { fill: color, fontSize: 12 }, axisLine: false, tickLine: false });

/** Monthly fixed (contracted) vs variable (estimated fuel) — stacked. */
export function SpendHistoryChart({ data }: { data: SpendHistory }) {
  const t = useTranslations("company.costOptimization.overview");
  const c = useChartColors();
  const fmt = useFmt();
  const tip = useTooltipStyle();
  const rows = data.months.map((m) => ({ month: m.month, fixed: m.contracted_fixed, fuel: m.estimated_fuel }));
  if (!rows.some((r) => r.fixed !== null || r.fuel !== null)) return null;
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 4" />
          <XAxis dataKey="month" {...axis(c.axis)} />
          <YAxis {...axis(c.axis)} width={64} tickFormatter={(v: number) => fmt.n(v / 1000) + "k"} />
          <Tooltip {...tip} formatter={(v) => fmt.pkr(Number(v))} cursor={{ fill: c.grid }} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: c.text }}>{value}</span>} />
          <Bar dataKey="fixed" name={t("fixedSeries")} stackId="s" fill={c.series[1]} radius={[0, 0, 0, 0]} />
          <Bar dataKey="fuel" name={t("fuelSeries")} stackId="s" fill={c.series[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <ChartDataTable
        caption={`${t("fixedSeries")} / ${t("fuelSeries")}`}
        columns={["", t("fixedSeries"), t("fuelSeries")]}
        rows={rows.map((r) => [r.month, r.fixed == null ? "—" : fmt.pkr(r.fixed), r.fuel == null ? "—" : fmt.pkr(r.fuel)])}
      />
    </div>
  );
}

/** Weekly assigned ÷ seats, from the roster history. */
export function OccupancyTrendChart({ trend }: { trend: OccupancyReport["trend"] }) {
  const t = useTranslations("company.costOptimization.occupancy");
  const c = useChartColors();
  const fmt = useFmt();
  const tip = useTooltipStyle();
  if (!trend.some((p) => p.occupancy_pct !== null)) return null;
  return (
    <div className="h-56 w-full" dir="ltr">
      <ResponsiveContainer>
        <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 4" />
          <XAxis dataKey="date" {...axis(c.axis)} tickFormatter={(d: string) => d.slice(5)} />
          <YAxis {...axis(c.axis)} width={40} domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip
            {...tip}
            formatter={(v, _n, item) => {
              const p = item?.payload as OccupancyReport["trend"][number] | undefined;
              return [`${fmt.n(Number(v), 1)}% (${fmt.n(p?.assigned)} / ${fmt.n(p?.seats)})`, t("trendSeries")];
            }}
          />
          <Line type="monotone" dataKey="occupancy_pct" name={t("trendSeries")} stroke={c.series[1]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <ChartDataTable
        caption={t("trendSeries")}
        columns={["", t("trendSeries")]}
        rows={trend.map((p) => [p.date, p.occupancy_pct == null ? "—" : `${fmt.n(p.occupancy_pct, 1)}% (${fmt.n(p.assigned)} / ${fmt.n(p.seats)})`])}
      />
    </div>
  );
}

/** How many route-directions fall in each occupancy band. */
export function OccupancyBandsChart({ bands }: { bands: OccupancyReport["summary"]["bands"] }) {
  const t = useTranslations("company.costOptimization.occupancy.bands");
  const c = useChartColors();
  const fmt = useFmt();
  const tip = useTooltipStyle();
  const order = ["lt25", "25to50", "50to75", "75to100", "over100", "unknown"] as const;
  const colors = [c.series[0], c.series[5], c.series[1], c.series[2], c.series[3], c.muted];
  const data = order.map((k, i) => ({ key: k, name: t(k), value: bands[k], color: colors[i] })).filter((d) => d.value > 0);
  if (!data.length) return null;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="h-44 w-44 shrink-0" dir="ltr" aria-hidden="true">
        <ResponsiveContainer>
          <PieChart accessibilityLayer={false}>
            <Pie rootTabIndex={-1} data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tip} formatter={(v) => fmt.n(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-1">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.color }} aria-hidden="true" />
            <span className="flex-1 text-fg-muted">{d.name}</span>
            <span className="font-medium tabular-nums text-fg">{fmt.n(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Current vs proposed for one or two metrics (e.g. monthly cost, km per day). */
export function CompareBarChart({ rows }: { rows: Array<{ label: string; current: number | null; proposed: number | null; format: (v: number) => string }> }) {
  const t = useTranslations("company.costOptimization.recs");
  const c = useChartColors();
  const tip = useTooltipStyle();
  const data = rows.filter((r) => r.current !== null && r.proposed !== null);
  if (!data.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {data.map((r) => (
        <div key={r.label} className="rounded-lg border border-line p-3">
          <p className="mb-1 text-xs font-medium text-fg-muted">{r.label}</p>
          <div className="h-36" dir="ltr">
            <ResponsiveContainer>
              <BarChart data={[{ name: t("current"), v: r.current }, { name: t("proposed"), v: r.proposed }]} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="name" {...axis(c.axis)} />
                <YAxis hide />
                <Tooltip {...tip} formatter={(v) => r.format(Number(v))} cursor={{ fill: c.grid }} />
                <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                  <Cell fill={c.series[1]} />
                  <Cell fill={c.series[2]} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: c.series[1] }} aria-hidden="true" />
              <dt className="text-fg-muted">{t("current")}</dt>
              <dd className="font-medium text-fg tabular-nums">{r.format(r.current as number)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: c.series[2] }} aria-hidden="true" />
              <dt className="text-fg-muted">{t("proposed")}</dt>
              <dd className="font-medium text-fg tabular-nums">{r.format(r.proposed as number)}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}
