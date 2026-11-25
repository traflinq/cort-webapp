"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCompanyTheme } from "../../lib/theme-context";
import { useFmt } from "./hooks";
import type { OccupancyReport, SpendHistory } from "./types";

/** Same validated palette as the admin charts (fixed series order). Map/chart layers need literal colours. */
const LIGHT = ["#e5700a", "#2a78d6", "#1baf7a", "#6250d6", "#e87ba4", "#eda100"];
const DARK = ["#d97316", "#3987e5", "#199e70", "#9085e9", "#d55181", "#c98500"];

export function useChartColors() {
  const { theme } = useCompanyTheme();
  return useMemo(
    () =>
      theme === "dark"
        ? { series: DARK, grid: "rgba(255,255,255,0.06)", axis: "rgba(237,237,239,0.5)", tooltipBg: "#1a1a1e", tooltipBorder: "rgba(255,255,255,0.14)", text: "#ededef", muted: "#6b7280" }
        : { series: LIGHT, grid: "rgba(15,23,42,0.07)", axis: "rgba(15,23,42,0.5)", tooltipBg: "#ffffff", tooltipBorder: "rgba(15,23,42,0.12)", text: "#0f172a", muted: "#94a3b8" },
    [theme],
  );
}

function useTooltipStyle() {
  const c = useChartColors();
  return {
    contentStyle: { background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 12, fontSize: 12, color: c.text },
    labelStyle: { color: c.text, fontWeight: 600 },
    itemStyle: { color: c.text },
  };
}

const axis = (color: string) => ({ tick: { fill: color, fontSize: 11 }, axisLine: false, tickLine: false });

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
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="month" {...axis(c.axis)} />
          <YAxis {...axis(c.axis)} width={64} tickFormatter={(v: number) => fmt.n(v / 1000) + "k"} />
          <Tooltip {...tip} formatter={(v) => fmt.pkr(Number(v))} cursor={{ fill: c.grid }} />
          <Legend wrapperStyle={{ fontSize: 12, color: c.axis }} />
          <Bar dataKey="fixed" name={t("fixedSeries")} stackId="s" fill={c.series[1]} radius={[0, 0, 0, 0]} />
          <Bar dataKey="fuel" name={t("fuelSeries")} stackId="s" fill={c.series[0]} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
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
          <CartesianGrid vertical={false} stroke={c.grid} />
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
    </div>
  );
}

/** How many route-directions fall in each occupancy band. */
export function OccupancyBandsChart({ bands }: { bands: OccupancyReport["summary"]["bands"] }) {
  const t = useTranslations("company.costOptimization.occupancy.bands");
  const c = useChartColors();
  const tip = useTooltipStyle();
  const order = ["lt25", "25to50", "50to75", "75to100", "over100", "unknown"] as const;
  const colors = [c.series[0], c.series[5], c.series[1], c.series[2], c.series[3], c.muted];
  const data = order.map((k, i) => ({ key: k, name: t(k), value: bands[k], color: colors[i] })).filter((d) => d.value > 0);
  if (!data.length) return null;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="h-44 w-44 shrink-0" dir="ltr">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-1">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 text-fg-muted">{d.name}</span>
            <span className="font-semibold tabular-nums text-fg">{d.value}</span>
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
        <div key={r.label} className="rounded-xl border border-line p-3">
          <p className="mb-1 text-xs font-medium text-fg-muted">{r.label}</p>
          <div className="h-36" dir="ltr">
            <ResponsiveContainer>
              <BarChart data={[{ name: t("current"), v: r.current }, { name: t("proposed"), v: r.proposed }]} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="name" {...axis(c.axis)} />
                <YAxis hide />
                <Tooltip {...tip} formatter={(v) => r.format(Number(v))} cursor={{ fill: c.grid }} />
                <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                  <Cell fill={c.series[1]} />
                  <Cell fill={c.series[2]} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
