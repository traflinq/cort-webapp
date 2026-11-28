"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Car, Clock3, Fuel, GitMerge, Leaf, ListOrdered, Minimize2, Split, TreeDeciduous, Workflow } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import { focusRing } from "@/app/admin/ui";
import { SectionHeading } from "../components/ui";
import { useCostFetch, useFmt, filterQuery, type CostFilters } from "./hooks";
import { useChartColors } from "./charts";
import { BasisBadge, EmptyNote, ErrorNote, FigureValue, HowCalculated, MethodNote, Skeleton, StatBlock, Tag } from "./ui";
import type { AcState, CarbonReport, Figure, RecType } from "./types";

const AC_TONE: Record<AcState, "neutral" | "info" | "warning"> = { ON: "info", OFF: "neutral", UNSET: "warning" };
const REC_ICON: Partial<Record<RecType, ReactNode>> = {
  FLEET_REPLAN: <Workflow />,
  ROUTE_MERGE: <GitMerge />,
  ROUTE_REDISTRIBUTE: <Split />,
  ROUTE_RESEQUENCE: <ListOrdered />,
  VEHICLE_DOWNSIZE: <Minimize2 />,
};

/** Carbon & ESG impact of the company's own shuttle operation, and what the recommendations would avoid. */
export function CarbonPanel({ filters, onOpenRecommendation }: { filters: CostFilters; onOpenRecommendation: (id: number) => void }) {
  const t = useTranslations("company.costOptimization.carbon");
  const tc = useTranslations("company.costOptimization");
  const fmt = useFmt();
  const report = useCostFetch<CarbonReport>(`/company/cost-optimization/carbon?${filterQuery(filters)}`);

  if (report.error) return <ErrorNote message={tc("loadFailed")} detail={report.error} onRetry={report.reload} />;
  if (!report.data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  const r = report.data;
  const x = r.totals;
  const noRecs = r.recommendation_status !== "OK";

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading title={t("title")} description={t("description")} badge={`${fmt.date(r.window.from)} – ${fmt.date(r.window.to)}`} />

      <Hero report={r} />

      {noRecs && <p className="rounded-xl border border-warning-line bg-warning-soft p-4 text-sm text-warning-ink">{t(r.recommendation_status === "NO_RUN" ? "noRun" : "oldRun")}</p>}

      {/* Footprint in the selected range */}
      <section className="flex flex-col gap-4">
        <h3 className="text-base font-semibold text-fg">{t("footprintTitle")}</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <FootprintDonut driving={x.co2e} idling={x.idle_co2e} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatBlock label={t("emitted")} figure={x.co2e} hint={t("emittedHint", { litres: fmt.fig(x.litres) })} />
            <StatBlock label={t("idling")} figure={x.idle_co2e} hint={t("idlingHint", { hours: fmt.fig(x.idle_hours), litres: fmt.fig(x.idle_litres) })} />
            <StatBlock label={t("perEmployee")} figure={x.intensity_per_employee} hint={t("perEmployeeHint", { employees: fmt.fig(x.employees) })} />
            <StatBlock label={t("perMonth")} figure={x.current_co2e_per_month} hint={t("perMonthHint")} />
          </div>
        </div>
      </section>

      {/* Now vs after, and where the saving comes from */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <NowVsAfter current={x.current_co2e_per_month} after={x.after_co2e_per_month} saved={x.potential_co2e_per_month} />
        <SavingSources report={r} onOpenRecommendation={onOpenRecommendation} />
      </section>

      <VehicleTable report={r} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1.5 font-medium text-fg">
          <Leaf className="size-3.5 text-success-ink" aria-hidden />
          {t("factorsTitle")}
        </span>
        {r.factors.map((f) => (
          <span key={f.fuel_type} title={f.source}>
            {t("factor", { fuel: t(`fuel.${f.fuel_type}` as never), value: fmt.n(f.kg_per_litre, 2) })}
          </span>
        ))}
      </div>

      <MethodNote lines={r.method} />
    </div>
  );
}

// ─── Hero: potential saving, abatement ring, trees ───────────────────────────

function Hero({ report: r }: { report: CarbonReport }) {
  const t = useTranslations("company.costOptimization.carbon");
  const fmt = useFmt();
  const x = r.totals;
  const trees = Math.max(0, Math.round(x.trees.value ?? 0));
  return (
    <section className="rounded-xl border border-line bg-card p-5 sm:p-6">
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm font-medium text-fg-muted">{t("heroEyebrow")}</p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-3xl font-semibold tracking-tight text-success-ink tabular-nums">{fmt.n(x.potential_co2e_per_month.value, 0)}</span>
            <span className="text-sm font-medium text-fg-muted">{t("heroUnit")}</span>
            <HowCalculated figure={x.potential_co2e_per_month} />
          </div>
          <p className="text-sm text-fg-muted tabular-nums">{t("heroYear", { year: fmt.fig(x.potential_co2e_per_year) })}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <SourceChip icon={<Workflow className="size-3.5" />} label={t("fromRecs")} value={x.recs_co2e_per_month.value === null ? "—" : fmt.fig(x.recs_co2e_per_month)} />
            <SourceChip icon={<Clock3 className="size-3.5" />} label={t("fromIdling")} value={fmt.fig(x.idle_co2e_per_month)} />
            {x.recs_litres_per_month.value !== null && <SourceChip icon={<Fuel className="size-3.5" />} label={t("fuelSaved")} value={fmt.fig(x.recs_litres_per_month)} />}
          </div>
        </div>
        <AbatementRing figure={x.abatement_pct} current={x.current_co2e_per_month} />
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-sm text-fg">
        <TreeDeciduous className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
        <span className="tabular-nums">{t("treesLine", { trees: fmt.n(trees) })}</span>
        <HowCalculated figure={x.trees} />
      </div>
    </section>
  );
}

function SourceChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-2 py-1 text-xs">
      <span className="text-fg-muted" aria-hidden="true">{icon}</span>
      <span className="text-fg-muted">{label}</span>
      <span className="font-semibold text-fg tabular-nums">{value}</span>
    </span>
  );
}

function AbatementRing({ figure, current }: { figure: Figure; current: Figure }) {
  const t = useTranslations("company.costOptimization.carbon");
  const fmt = useFmt();
  const c = useChartColors();
  const pct = Math.max(0, Math.min(100, figure.value ?? 0));
  const R = 54;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-40">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90" aria-hidden>
          <circle cx="70" cy="70" r={R} fill="none" strokeWidth="12" className="stroke-line" />
          <circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            stroke={c.series[2]}
            strokeDasharray={`${(pct / 100) * C} ${C}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-fg tabular-nums">{figure.value === null ? "—" : `${fmt.n(figure.value, 1)}%`}</span>
          <span className="text-xs text-fg-muted">{t("ringCaption")}</span>
        </div>
      </div>
      <p className="flex items-center gap-1 text-center text-xs text-fg-muted tabular-nums">
        {t("ringLabel", { current: fmt.fig(current) })}
        <HowCalculated figure={figure} />
      </p>
    </div>
  );
}

// ─── Footprint split ─────────────────────────────────────────────────────────

function FootprintDonut({ driving, idling }: { driving: Figure; idling: Figure }) {
  const t = useTranslations("company.costOptimization.carbon");
  const fmt = useFmt();
  const c = useChartColors();
  const d = driving.value ?? 0;
  const i = idling.value ?? 0;
  const total = d + i;
  const parts = [
    { key: "driving", label: t("driving"), value: d, color: c.series[1], icon: <Car className="size-4" /> },
    { key: "idling", label: t("idlingShort"), value: i, color: c.series[5], icon: <Clock3 className="size-4" /> },
  ];
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto size-44 shrink-0" dir="ltr">
        {total > 0 ? (
          <div className="size-full" aria-hidden="true">
          <ResponsiveContainer>
            <PieChart accessibilityLayer={false}>
              <Pie rootTabIndex={-1} data={parts} dataKey="value" nameKey="label" innerRadius="68%" outerRadius="100%" paddingAngle={total > 0 && d > 0 && i > 0 ? 3 : 0} stroke="none" isAnimationActive>
                {parts.map((p) => (
                  <Cell key={p.key} fill={p.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          </div>
        ) : (
          <div className="size-full rounded-full border-[14px] border-subtle" />
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-fg tabular-nums">{fmt.n(total, 0)}</span>
          <span className="text-xs text-fg-muted">{fmt.unit("kgCO2e")}</span>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-3">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-3">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
            <span className="shrink-0 text-fg-muted" aria-hidden="true">
              {p.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-fg">{p.label}</span>
              <span className="block text-xs text-fg-muted tabular-nums">{total > 0 ? `${fmt.n((p.value / total) * 100, 0)}%` : "—"}</span>
            </span>
            <span className="text-sm font-semibold text-fg tabular-nums">{fmt.value(p.value, "kgCO2e")}</span>
          </li>
        ))}
        <li className="border-t border-line pt-3 text-xs text-fg-muted">{t("footprintNote")}</li>
      </ul>
    </div>
  );
}

// ─── Now vs after ────────────────────────────────────────────────────────────

function NowVsAfter({ current, after, saved }: { current: Figure; after: Figure; saved: Figure }) {
  const t = useTranslations("company.costOptimization.carbon");
  const fmt = useFmt();
  const c = useChartColors();
  const cur = current.value ?? 0;
  const aft = after.value ?? 0;
  const afterPct = cur > 0 ? Math.max(0, Math.min(100, (aft / cur) * 100)) : 0;
  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">{t("nowVsAfter")}</h3>
          <p className="mt-0.5 text-xs text-fg-muted">{t("nowVsAfterHint")}</p>
        </div>
        <BasisBadge basis={after.basis} />
      </div>
      <Bar label={t("now")} value={fmt.fig(current)} figure={current}>
        <div className="h-full rounded-full" style={{ width: cur > 0 ? "100%" : "0%", background: c.series[1] }} />
      </Bar>
      <Bar label={t("after")} value={fmt.fig(after)} figure={after}>
        <div className="flex h-full w-full">
          <div className="h-full rounded-s-full" style={{ width: `${afterPct}%`, background: c.series[2] }} />
          {cur > 0 && afterPct < 100 && (
            <div
              className="h-full rounded-e-full border border-dashed border-success-line"
              style={{ width: `${100 - afterPct}%`, background: `repeating-linear-gradient(45deg, transparent 0 6px, ${c.series[2]}22 6px 12px)` }}
            />
          )}
        </div>
      </Bar>
      <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success-ink tabular-nums">
        <Leaf className="size-4 shrink-0" aria-hidden />
        {t("savedLine", { kg: fmt.fig(saved) })}
      </p>
    </div>
  );
}

function Bar({ label, value, figure, children }: { label: string; value: string; figure: Figure; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-fg">{label}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-fg tabular-nums">
          {value}
          <HowCalculated figure={figure} />
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-subtle">{children}</div>
    </div>
  );
}

// ─── Where the saving comes from ─────────────────────────────────────────────

function SavingSources({ report: r, onOpenRecommendation }: { report: CarbonReport; onOpenRecommendation: (id: number) => void }) {
  const t = useTranslations("company.costOptimization.carbon");
  const tr = useTranslations("company.costOptimization.recs");
  const fmt = useFmt();
  const c = useChartColors();
  const idle = r.totals.idle_co2e_per_month;
  const rows = [
    ...r.recommendations.map((rec) => ({
      key: `rec-${rec.id}`,
      icon: REC_ICON[rec.type] ?? <Workflow />,
      title: tr(`type.${rec.type}` as never),
      sub: rec.routes.map((x) => x.name).join(", "),
      kg: rec.co2e_per_month,
      litres: rec.litres_per_month as Figure | null,
      color: c.series[2],
      onClick: () => onOpenRecommendation(rec.id),
    })),
    { key: "idle", icon: <Clock3 />, title: t("idlingSource"), sub: t("idlingSourceSub", { hours: fmt.fig(r.totals.idle_hours) }), kg: idle, litres: null, color: c.series[5], onClick: undefined },
  ].sort((a, b) => (b.kg.value ?? 0) - (a.kg.value ?? 0));
  const max = Math.max(...rows.map((x) => x.kg.value ?? 0), 0);
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5">
      <div>
        <h3 className="text-sm font-semibold text-fg">{t("sourcesTitle")}</h3>
        <p className="mt-0.5 text-xs text-fg-muted">{t("sourcesHint")}</p>
      </div>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => {
          const v = row.kg.value ?? 0;
          const content = (
            <>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-subtle text-fg-muted [&>svg]:size-4" aria-hidden="true">{row.icon}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-fg">{row.title}</span>
                  <span className="shrink-0 text-sm font-semibold text-fg tabular-nums">{fmt.fig(row.kg)}</span>
                </span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                  <span className="block h-full rounded-full" style={{ width: `${max > 0 ? Math.max(2, (v / max) * 100) : 0}%`, background: row.color }} />
                </span>
                <span className="flex justify-between gap-3 text-xs text-fg-muted">
                  <span className="truncate" title={row.sub}>
                    {row.sub}
                  </span>
                  {row.litres && <span className="shrink-0 tabular-nums">{fmt.fig(row.litres)}</span>}
                </span>
              </span>
            </>
          );
          return (
            <li key={row.key}>
              {row.onClick ? (
                <button type="button" onClick={row.onClick} className={cn("flex w-full items-center gap-3 rounded-lg p-2 text-start transition-colors hover:bg-row-hover", focusRing)}>
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-3 p-2">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {r.recommendations.length === 0 && r.recommendation_status === "OK" && <p className="text-xs text-fg-muted">{t("recsEmpty")}</p>}
    </div>
  );
}

// ─── Per vehicle ─────────────────────────────────────────────────────────────

function VehicleTable({ report: r }: { report: CarbonReport }) {
  const t = useTranslations("company.costOptimization.carbon");
  const fmt = useFmt();
  const c = useChartColors();
  const max = Math.max(...r.vehicles.map((v) => (v.co2e.value ?? 0) + (v.idle_co2e.value ?? 0)), 0);
  const notes = [
    r.data.vehicles_ac_unset > 0 && t("acUnsetNote", { count: r.data.vehicles_ac_unset }),
    r.data.vehicles_seats_assumed > 0 && t("seatsNote", { count: r.data.vehicles_seats_assumed }),
    r.data.vehicles_without_kmpl > 0 && t("kmplNote", { count: r.data.vehicles_without_kmpl }),
  ].filter(Boolean) as string[];
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-base font-semibold text-fg">{t("vehiclesTitle")}</h3>
        <span className="flex items-center gap-3 text-xs text-fg-muted">
          <Legend color={c.series[1]} label={t("driving")} />
          <Legend color={c.series[5]} label={t("idlingShort")} />
        </span>
      </div>
      {notes.length > 0 && (
        <ul className="list-disc space-y-1 rounded-xl border border-warning-line bg-warning-soft py-3 pe-4 ps-8 text-sm text-warning-ink">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {r.vehicles.length === 0 ? (
        <EmptyNote>{t("empty")}</EmptyNote>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-fg-muted">
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("colVehicle")}</th>
                <th scope="col" className="px-3 py-3 text-start font-medium">{t("colClass")}</th>
                <th scope="col" className="px-3 py-3 text-start font-medium">{t("colAc")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("colRate")}</th>
                <th scope="col" className="w-56 px-3 py-3 text-start font-medium">{t("colFootprint")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("colCo2")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("colIdleHours")}</th>
                <th scope="col" className="px-4 py-3 text-end font-medium">{t("colIdleCo2")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.vehicles.map((v) => {
                const dv = v.co2e.value ?? 0;
                const iv = v.idle_co2e.value ?? 0;
                return (
                  <tr key={v.vehicle.id} className="align-middle hover:bg-row-hover">
                    <td className="px-4 py-3">
                      <p className="font-medium text-fg">{v.vehicle.plate}</p>
                      <p className="text-xs text-fg-muted">
                        {v.vehicle.category} · {t(`fuel.${v.vehicle.fuel_type}` as never)}
                        {v.vehicle.vendor ? ` · ${v.vehicle.vendor}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {v.idle_class ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="text-fg">{v.idle_class.label}</span>
                          {v.idle_class.seats_assumed && <span className="text-xs text-warning-ink">{t("seatsAssumed")}</span>}
                          {v.idle_class.fuel_mismatch && <span className="text-xs text-fg-muted">{t("fuelMismatch")}</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-fg-muted">{t("noClass")}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Tag tone={AC_TONE[v.vehicle.ac]}>{t(`ac.${v.vehicle.ac}` as never)}</Tag>
                    </td>
                    <td className="px-3 py-3 text-end tabular-nums">
                      {v.idle_rate ? (
                        <span className="flex flex-col items-end gap-0.5">
                          <span className="font-medium text-fg">{fmt.value(v.idle_rate.used, "L/h")}</span>
                          <span className="text-xs text-fg-muted">{t("range", { min: fmt.n(v.idle_rate.min, 2), max: fmt.n(v.idle_rate.max, 2) })}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-subtle" title={`${fmt.value(dv, "kgCO2e")} + ${fmt.value(iv, "kgCO2e")}`}>
                        <div className="h-full" style={{ width: `${max > 0 ? (dv / max) * 100 : 0}%`, background: c.series[1] }} />
                        <div className="h-full" style={{ width: `${max > 0 ? (iv / max) * 100 : 0}%`, background: c.series[5] }} />
                      </div>
                      <p className="mt-1 text-xs text-fg-muted tabular-nums">
                        {fmt.n(v.km_estimated, 0)} {fmt.unit("km")} · {fmt.fig(v.litres)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-end">
                      <FigureValue figure={v.co2e} className="justify-end" />
                    </td>
                    <td className="px-3 py-3 text-end">
                      <FigureValue figure={v.idle_hours} className="justify-end" />
                    </td>
                    <td className="px-4 py-3 text-end">
                      <FigureValue figure={v.idle_co2e} className="justify-end" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

