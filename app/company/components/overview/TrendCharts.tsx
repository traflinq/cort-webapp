"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CalendarDays } from "@/app/components/icons";
import { CardHeading, EmptyState, Figure, focusRing } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "../../../lib/store/slices/dashboardSlice";
import { ChartDataTable, useChartColors } from "../../analytics/cost/charts";
import { Card } from "../Card";
import { useOverviewFormat } from "./format";

type ChartColors = ReturnType<typeof useChartColors>;

const axis = (color: string) => ({ tick: { fill: color, fontSize: 12 }, axisLine: false, tickLine: false });

/** Gregorian dates in both locales (ar-SA would otherwise default to the Islamic calendar). */
function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-PK", { timeZone: "UTC", ...options });
}

/** Hovered bar keeps full strength; the rest step back so the one being read stands out. */
const dim = (active: number | null, i: number) => (active === null || active === i ? 1 : 0.35);

function hoverIndex(state: { activeTooltipIndex?: unknown } | null | undefined): number | null {
  const n = Number(state?.activeTooltipIndex);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function TooltipShell({ c, title, children }: { c: ChartColors; title: string; children: React.ReactNode }) {
  return (
    <div
      className="min-w-[9rem] rounded-[10px] border px-3 py-2.5 text-xs shadow-[var(--shadow-modal)]"
      style={{ background: c.tooltipBg, borderColor: c.tooltipBorder, color: c.tooltipText }}
    >
      <p className="mb-1.5 font-medium">{title}</p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function TooltipRow({ c, color, value, label }: { c: ChartColors; color?: string; value: string; label: string }) {
  return (
    <li className="flex items-stretch gap-2">
      <span aria-hidden="true" className="w-[3px] shrink-0 rounded-full" style={{ background: color ?? "transparent" }} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-semibold tabular-nums">{value}</span>
        <span style={{ color: c.tooltipMuted }}>{label}</span>
      </span>
    </li>
  );
}

/* ────────────────────────────── Activity over time ────────────────────────────── */

type Range = "months" | "days";

export interface ActivityTrendData {
  daily: (TrendPoint & { date: string })[];
  monthly: (TrendPoint & { month: string })[];
}

/**
 * Completed chauffeur rides and shuttle trips that ran, per month (6) or per day (30), stacked.
 * Only the services the company runs are drawn. Billed spend appears in the tooltip (one axis only:
 * rides and money never share a scale).
 */
export function ActivityTrendCard({
  data,
  showChauffeur,
  showShuttle,
  showSpend,
}: {
  data: ActivityTrendData;
  showChauffeur: boolean;
  showShuttle: boolean;
  showSpend: boolean;
}) {
  const t = useTranslations("company.overview.trend");
  const f = useOverviewFormat();
  const c = useChartColors();
  const [range, setRange] = useState<Range>("months");
  const [active, setActive] = useState<number | null>(null);

  const monthFmt = useMemo(() => dateFormatter(f.locale, { month: "short" }), [f.locale]);
  const monthLongFmt = useMemo(() => dateFormatter(f.locale, { month: "long", year: "numeric" }), [f.locale]);
  const dayFmt = useMemo(() => dateFormatter(f.locale, { day: "numeric", month: "short" }), [f.locale]);
  const dayLongFmt = useMemo(() => dateFormatter(f.locale, { weekday: "short", day: "numeric", month: "long" }), [f.locale]);

  const rows = useMemo(() => {
    const src = range === "months" ? data.monthly : data.daily;
    return src.map((p, i) => {
      const isMonth = "month" in p;
      const date = new Date(`${isMonth ? `${(p as { month: string }).month}-01` : (p as { date: string }).date}T00:00:00Z`);
      const current = i === src.length - 1;
      return {
        key: isMonth ? (p as { month: string }).month : (p as { date: string }).date,
        tick: isMonth ? monthFmt.format(date) : dayFmt.format(date),
        label: current ? (isMonth ? t("thisMonth") : t("today")) : isMonth ? monthLongFmt.format(date) : dayLongFmt.format(date),
        chauffeur: showChauffeur ? p.chauffeurRides : 0,
        shuttle: showShuttle ? p.shuttleTrips : 0,
        spend: p.chauffeurSpend,
      };
    });
  }, [range, data, showChauffeur, showShuttle, monthFmt, monthLongFmt, dayFmt, dayLongFmt, t]);

  const totals = rows.reduce((s, r) => ({ chauffeur: s.chauffeur + r.chauffeur, shuttle: s.shuttle + r.shuttle }), { chauffeur: 0, shuttle: 0 });
  const empty = totals.chauffeur + totals.shuttle === 0;
  const both = showChauffeur && showShuttle;
  const description = both ? t("descriptionBoth") : showChauffeur ? t("descriptionChauffeur") : t("descriptionShuttle");

  // Fixed series order (dataviz): chauffeur = chart 1, shuttle = chart 2, whichever are shown.
  const series = [
    showChauffeur && { key: "chauffeur" as const, name: t("chauffeur"), color: c.series[0], total: totals.chauffeur },
    showShuttle && { key: "shuttle" as const, name: t("shuttle"), color: c.series[1], total: totals.shuttle },
  ].filter(Boolean) as { key: "chauffeur" | "shuttle"; name: string; color: string; total: number }[];

  return (
    <Card className="flex flex-col gap-4 p-0 sm:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <CardHeading as="h2" icon={<BarChart3 />} title={t("title")} description={description} />
        <div role="group" aria-label={t("rangeLabel")} className="inline-flex shrink-0 rounded-lg bg-subtle p-0.5">
          {(["months", "days"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => {
                setRange(r);
                setActive(null);
              }}
              className={cn(
                "h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium transition-colors",
                range === r ? "bg-card text-fg shadow-[var(--nav-active-shadow)]" : "text-fg-muted hover:text-fg",
                focusRing,
              )}
            >
              {r === "months" ? t("range6m") : t("range30d")}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <EmptyState
          compact
          className="px-5 pb-8 pt-4"
          icon={<BarChart3 aria-hidden="true" />}
          title={range === "months" ? t("empty6m") : t("empty30d")}
          description={t("emptyHint")}
        />
      ) : (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          {/* Totals for the range double as the legend (each figure beside its series swatch). */}
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            {series.map((s) => (
              <div key={s.key} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-fg-muted">
                  {both && <span aria-hidden="true" className="size-2 rounded-[3px]" style={{ background: s.color }} />}
                  {s.name}
                </dt>
                <dd className="mt-0.5 text-2xl font-semibold tracking-tight text-fg">
                  <Figure value={f.num(s.total)} />
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 h-56 w-full" dir="ltr">
            <ResponsiveContainer>
              <BarChart
                accessibilityLayer
                data={rows}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                barCategoryGap={range === "months" ? "28%" : "18%"}
                onMouseMove={(s) => setActive(hoverIndex(s))}
                onMouseLeave={() => setActive(null)}
              >
                <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 4" />
                <XAxis dataKey="tick" {...axis(c.axis)} interval={range === "months" ? 0 : "preserveStartEnd"} minTickGap={12} />
                <YAxis {...axis(c.axis)} width={36} allowDecimals={false} tickFormatter={(v: number) => f.num(v)} />
                <Tooltip
                  cursor={false}
                  content={({ active: on, payload }) => {
                    const row = on ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined;
                    if (!row) return null;
                    return (
                      <TooltipShell c={c} title={row.label}>
                        {series.map((s) => (
                          <TooltipRow key={s.key} c={c} color={s.color} value={f.num(row[s.key])} label={s.name} />
                        ))}
                        {showSpend && row.spend > 0 && <TooltipRow c={c} value={f.money(row.spend)} label={t("spend")} />}
                      </TooltipShell>
                    );
                  }}
                />
                {series.map((s, si) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    stackId="activity"
                    fill={s.color}
                    // Rounded data end on the top segment only; a 2px surface stroke separates stacked segments.
                    radius={si === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    stroke={c.surface}
                    strokeWidth={series.length > 1 ? 2 : 0}
                    maxBarSize={range === "months" ? 44 : 16}
                    isAnimationActive={false}
                  >
                    {rows.map((r, i) => (
                      <Cell key={r.key} fillOpacity={dim(active, i)} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartDataTable
            caption={`${t("title")}: ${description}`}
            columns={[t("period"), ...series.map((s) => s.name), ...(showSpend ? [t("spend")] : [])]}
            rows={rows.map((r) => [r.label, ...series.map((s) => f.num(r[s.key])), ...(showSpend ? [f.money(r.spend)] : [])])}
          />
        </div>
      )}
    </Card>
  );
}

/* ────────────────────────────── Busiest days ────────────────────────────── */

/**
 * Chauffeur bookings per weekday. Grey bars, the busiest day in the brand colour with its count
 * labelled; the quietest day is named below. Week starts Monday (English) or Sunday (Arabic).
 */
export function WeekdayDemandCard({ counts }: { counts: number[] }) {
  const t = useTranslations("company.overview.weekday");
  const f = useOverviewFormat();
  const c = useChartColors();
  const [active, setActive] = useState<number | null>(null);
  const shortFmt = useMemo(() => dateFormatter(f.locale, { weekday: "short" }), [f.locale]);

  const order = f.locale === "ar" ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  const total = counts.reduce((s, n) => s + n, 0);
  const peak = total > 0 ? counts.indexOf(Math.max(...counts)) : -1;
  const quiet = total > 0 ? counts.indexOf(Math.min(...counts)) : -1;
  // 7 Jan 2024 was a Sunday, so day index d is 7 + d.
  const rows = order.map((d) => ({
    day: d,
    tick: shortFmt.format(new Date(Date.UTC(2024, 0, 7 + d))),
    name: f.weekday(d),
    count: counts[d] ?? 0,
  }));

  return (
    <Card className="flex flex-col gap-4 p-0 sm:p-0">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <CardHeading as="h2" icon={<CalendarDays />} title={t("title")} description={t("description")} />
      </div>
      {total === 0 ? (
        <EmptyState compact className="px-5 pb-8 pt-4" icon={<CalendarDays aria-hidden="true" />} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="flex flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="min-h-48 w-full flex-1" dir="ltr">
            <ResponsiveContainer>
              <BarChart
                accessibilityLayer
                data={rows}
                margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                barCategoryGap="22%"
                onMouseMove={(s) => setActive(hoverIndex(s))}
                onMouseLeave={() => setActive(null)}
              >
                <XAxis dataKey="tick" {...axis(c.axis)} interval={0} />
                <YAxis hide domain={[0, "dataMax"]} />
                <Tooltip
                  cursor={false}
                  content={({ active: on, payload }) => {
                    const row = on ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined;
                    if (!row) return null;
                    return (
                      <TooltipShell c={c} title={row.name}>
                        <TooltipRow
                          c={c}
                          color={row.day === peak ? c.series[0] : c.neutral}
                          value={t("bookings", { count: row.count })}
                          label={t("share", { percent: f.pct((row.count / total) * 100) })}
                        />
                      </TooltipShell>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                  {rows.map((r, i) => (
                    <Cell key={r.day} fill={r.day === peak ? c.series[0] : c.neutral} fillOpacity={dim(active, i)} />
                  ))}
                  {/* Direct label on the busiest day only. */}
                  <LabelList
                    dataKey="count"
                    position="top"
                    content={(props) => {
                      const { x, y, width, index } = props as { x?: number; y?: number; width?: number; index?: number };
                      if (index === undefined || rows[index]?.day !== peak || x === undefined || y === undefined || width === undefined) return null;
                      return (
                        <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill={c.text}>
                          {f.num(rows[index].count)}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <div className="flex gap-1">
              <dt className="text-fg-muted">{t("peak")}</dt>
              <dd className="font-medium text-fg">{f.weekday(peak)}</dd>
            </div>
            {quiet !== peak && (
              <div className="flex gap-1">
                <dt className="text-fg-muted">{t("quiet")}</dt>
                <dd className="font-medium text-fg">{f.weekday(quiet)}</dd>
              </div>
            )}
          </dl>
          <ChartDataTable
            caption={`${t("title")}: ${t("description")}`}
            columns={[t("day"), t("bookingsColumn")]}
            rows={rows.map((r) => [r.name, f.num(r.count)])}
          />
        </div>
      )}
    </Card>
  );
}
