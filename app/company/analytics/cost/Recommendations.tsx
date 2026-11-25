"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, CheckCircle2, CircleDashed, CircleX, Fuel, GitMerge, Info, Route, Shrink, Split, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "../components/ui";
import { useCostFetch, useFmt } from "./hooks";
import { CompareBarChart } from "./charts";
import { RouteCompareMap } from "./RouteCompareMap";
import { BasisBadge, Drawer, EmptyNote, ErrorNote, FigureValue, Skeleton, Tag } from "./ui";
import type { Check, Figure, NarrativePart, Recommendation, RecommendationList, RecType } from "./types";

const TYPE_ICON: Record<RecType, ReactNode> = {
  ROUTE_MERGE: <GitMerge />,
  ROUTE_REDISTRIBUTE: <Split />,
  ROUTE_RESEQUENCE: <ArrowLeftRight />,
  VEHICLE_DOWNSIZE: <Shrink />,
  ROUTE_DETOUR: <Route />,
  FUEL_DISCREPANCY: <Fuel />,
};

const MONEY_PARAMS = new Set(["net", "fixed", "added", "amount"]);

/** Renders a narrative part from its template key in the current language; falls back to the English text. */
export function useNarrative() {
  const t = useTranslations("company.costOptimization.narrative");
  const tRecs = useTranslations("company.costOptimization.recs");
  const fmt = useFmt();
  return (p: NarrativePart | undefined, locked = false) => {
    if (!p) return "";
    const key = p.key as never;
    if (!t.has(key)) return p.text;
    const money = Object.entries(p.params).filter(([k]) => MONEY_PARAMS.has(k));
    // No figures at all (e.g. routing unavailable) and not because of the lock: the server text explains why.
    if (!locked && money.length > 0 && money.every(([, v]) => v === null)) return p.text;
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.params)) {
      if (MONEY_PARAMS.has(k)) values[k] = v === null ? (locked ? fmt.locked : "—") : fmt.pkr(Number(v));
      else if (k === "direction" && (v === "morning" || v === "evening")) values[k] = tRecs(v);
      else if (typeof v === "number") values[k] = fmt.n(v, 1);
      else values[k] = v ?? "—";
    }
    try {
      // Keys come from the server, so they cannot be checked against the message types.
      return (t as unknown as (k: string, v: Record<string, string>) => string)(p.key, values);
    } catch {
      return p.text;
    }
  };
}

const netOf = (r: Recommendation) => (r.net_monthly_pkr === null ? null : Number(r.net_monthly_pkr));

function FeasibilityTag({ rec }: { rec: Recommendation }) {
  const t = useTranslations("company.costOptimization.recs");
  if (rec.feasibility === "FEASIBLE")
    return rec.counted ? <Tag tone="success">{t("counted")}</Tag> : rec.evidence.excluded_from_total ? <Tag tone="warning">{t("reviewOnly")}</Tag> : rec.overlaps_with.length ? <Tag>{t("overlaps")}</Tag> : <Tag tone="success">{t("feasible")}</Tag>;
  return <Tag tone={rec.feasibility === "REJECTED" ? "danger" : "neutral"}>{t(`feasibility.${rec.feasibility}` as never)}</Tag>;
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function RecommendationCard({ rec, onOpen, locked }: { rec: Recommendation; onOpen: () => void; locked: boolean }) {
  const t = useTranslations("company.costOptimization.recs");
  const fmt = useFmt();
  const narrate = useNarrative();
  const net = netOf(rec);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 text-start transition-colors hover:bg-subtle/40",
        rec.feasibility === "FEASIBLE" ? "border-line hover:border-brand-line" : "border-dashed border-line opacity-90",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand-soft text-brand-ink [&_svg]:size-4">{TYPE_ICON[rec.type]}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t(`type.${rec.type}` as never)}</span>
        </span>
        <span className="flex flex-wrap justify-end gap-1">
          <FeasibilityTag rec={rec} />
        </span>
      </div>
      <p className="text-sm font-semibold text-fg" dir="auto">
        {narrate(rec.narrative_params.recommendation, locked)}
      </p>
      <p className="line-clamp-2 text-sm text-fg-muted" dir="auto">
        {narrate(rec.narrative_params.identified, locked)}
      </p>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-1">
        <div>
          <p className="text-[11px] text-fg-muted">{rec.type === "FUEL_DISCREPANCY" ? t("potentialDifference") : t("netMonthly")}</p>
          <p className={cn("text-lg font-semibold tabular-nums", net !== null && net > 0 ? "text-success-ink" : "text-fg")}>{locked ? fmt.locked : net === null ? "—" : fmt.pkr(net)}</p>
        </div>
        <span className="text-xs text-fg-muted">
          {t("confidence")}: <span className="font-semibold text-fg">{t(`level.${rec.confidence.level}` as never)}</span>
        </span>
      </div>
    </button>
  );
}

// ─── Detail drawer (the 8-part explanation + decisions) ─────────────────────

const FINANCIAL_ORDER = [
  "current_total",
  "proposed_total",
  "fixed_eliminated",
  "additional_variable",
  "gross_saving",
  "net_saving",
  "saving_pct",
  "net_saving_annual",
  "current_fixed",
  "proposed_fixed",
  "current_fuel",
  "proposed_fuel",
  "current_fuel_per_trip",
  "optimized_fuel_per_trip",
  "contracted_litres",
  "estimated_litres",
  "litres_difference",
  "variance_pct",
  "fuel_price",
  "contracted_fuel_cost",
  "estimated_fuel_cost",
  "cost_difference",
];

function useLabel() {
  const t = useTranslations("company.costOptimization.labels");
  return (key: string) => (t.has(key as never) ? t(key as never) : key.replace(/_/g, " "));
}

export function RecommendationDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const t = useTranslations("company.costOptimization.recs");
  const tc = useTranslations("company.costOptimization");
  const fmt = useFmt();
  const narrate = useNarrative();
  const label = useLabel();
  const res = useCostFetch<Recommendation>(id ? `/company/cost-optimization/recommendations/${id}` : null);
  if (!id) return null;
  const rec = res.data;
  const locked = !!rec?.savings_locked;

  return (
    <Drawer
      open
      onClose={onClose}
      title={rec ? t(`type.${rec.type}` as never) : t("loading")}
      subtitle={rec ? <FeasibilityTag rec={rec} /> : undefined}
    >
      {res.error ? (
        <ErrorNote message={tc("loadFailed")} detail={res.error} onRetry={res.reload} />
      ) : !rec ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="flex flex-col gap-6">
          {rec.geometry && <RouteCompareMap geometry={rec.geometry} />}

          <Part n={1} title={t("partIdentified")}>
            <p dir="auto">{narrate(rec.narrative_params.identified, locked)}</p>
          </Part>

          <Part n={2} title={t("partEvidence")}>
            <p className="text-sm text-fg-muted">{t("evidenceWindow", { from: fmt.date(rec.evidence.window.from), to: fmt.date(rec.evidence.window.to), trips: rec.evidence.trips_analysed })}</p>
            {Object.keys(rec.evidence.comparison ?? {}).length > 0 && <FigureTable figures={rec.evidence.comparison} label={label} />}
            <EvidenceData data={rec.evidence.data} label={label} />
          </Part>

          <Part n={3} title={t("partRecommendation")}>
            <p className="font-medium" dir="auto">{narrate(rec.narrative_params.recommendation, locked)}</p>
          </Part>

          <Part n={4} title={t("partWhy")}>
            <p dir="auto">{narrate(rec.narrative_params.why, locked)}</p>
          </Part>

          <Part n={5} title={t("partFinancial")}>
            {Object.keys(rec.financials).length === 0 ? (
              <p className="text-sm text-fg-muted">{t("noFinancials")}</p>
            ) : (
              <>
                <FigureTable figures={rec.financials} order={FINANCIAL_ORDER} label={label} highlight="net_saving" />
                {!locked && (rec.type === "ROUTE_MERGE" || rec.type === "ROUTE_REDISTRIBUTE") && rec.financials.current_total && (
                  <CompareBarChart
                    rows={[
                      { label: t("monthlyCost"), current: rec.financials.current_total?.value ?? null, proposed: rec.financials.proposed_total?.value ?? null, format: fmt.pkr },
                      rec.type === "ROUTE_MERGE"
                        ? { label: t("kmPerDay"), current: rec.evidence.comparison?.current_km_per_day?.value ?? null, proposed: rec.evidence.comparison?.merged_km_per_day?.value ?? null, format: (v) => fmt.value(v, "km") }
                        : { label: t("kmPerDay"), current: rec.evidence.comparison?.removed_route_km_per_day?.value ?? null, proposed: rec.evidence.comparison?.added_km_receivers_per_day?.value ?? null, format: (v) => fmt.value(v, "km") },
                    ]}
                  />
                )}
              </>
            )}
          </Part>

          <Part n={6} title={t("partTradeoffs")}>
            {rec.narrative_params.tradeoffs.length > 0 && (
              <ul className="list-disc space-y-1 ps-5 text-sm" dir="auto">
                {rec.narrative_params.tradeoffs.map((p, i) => (
                  <li key={i}>{narrate(p, locked)}</li>
                ))}
              </ul>
            )}
            {rec.checks.length > 0 && <Checks checks={rec.checks} />}
            {rec.overlaps_with.length > 0 && <p className="text-sm text-fg-muted">{t("overlapNote", { ids: rec.overlaps_with.join(", ") })}</p>}
          </Part>

          <Part n={7} title={t("partConfidence")}>
            <p className="text-sm">
              <span className="font-semibold">{t(`level.${rec.confidence.level}` as never)}</span>
              <span className="text-fg-muted"> · {t("confidenceBasis")}</span>
            </p>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {rec.confidence.factors.map((f) => (
                <li key={f.key} className="flex items-start gap-3 px-3 py-2 text-sm">
                  {f.state === "OK" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-ink" /> : f.state === "PARTIAL" ? <CircleDashed className="mt-0.5 size-4 shrink-0 text-warning-ink" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-danger-ink" />}
                  <span>
                    <span className="block font-medium">{t.has(`factor.${f.key}` as never) ? t(`factor.${f.key}` as never) : f.label}</span>
                    <span className="block text-xs text-fg-muted" dir="auto">{f.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Part>

          {rec.assumptions.length > 0 && (
            <details className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium">{t("assumptions")}</summary>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-fg-muted" dir="auto">
                {rec.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
          )}

          <p className="text-xs text-fg-muted">{t("audit", { id: rec.id, run: rec.run_id, at: `${fmt.date(rec.calculated_at)} ${fmt.time(rec.calculated_at)}`, version: rec.run?.engine_version ?? "—" })}</p>
        </div>
      )}
    </Drawer>
  );
}

function Part({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <span className="flex size-5 items-center justify-center rounded-full bg-brand-soft text-[11px] text-brand-ink">{n}</span>
        {title}
      </h3>
      <div className="flex flex-col gap-3 text-sm text-fg">{children}</div>
    </section>
  );
}

function FigureTable({ figures, order, label, highlight }: { figures: Record<string, Figure>; order?: string[]; label: (k: string) => string; highlight?: string }) {
  const keys = Object.keys(figures).sort((a, b) => {
    const ia = order ? order.indexOf(a) : -1;
    const ib = order ? order.indexOf(b) : -1;
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  return (
    <div className="divide-y divide-line rounded-xl border border-line bg-card">
      {keys.map((k) => {
        const f = figures[k];
        return (
          <div key={k} className={cn("flex items-center justify-between gap-3 px-3 py-2", k === highlight && "bg-success-soft/50")}>
            <span className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              {label(k)}
              {!f.locked && <BasisBadge basis={f.basis} />}
            </span>
            <FigureValue figure={f} />
          </div>
        );
      })}
    </div>
  );
}

/** Raw evidence values (route, roster, seats, rates…), shown as a compact list. */
function EvidenceData({ data, label }: { data: Record<string, unknown>; label: (k: string) => string }) {
  const render = (v: unknown): string => {
    if (v === null || v === undefined) return "—";
    if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? Object.values(x as object).join(" · ") : String(x))).join("; ");
    if (typeof v === "object") return Object.entries(v as object).map(([k, x]) => `${label(k)}: ${typeof x === "object" && x !== null ? Object.values(x).join("/") : x ?? "—"}`).join(" · ");
    return String(v);
  };
  const entries = Object.entries(data ?? {});
  if (!entries.length) return null;
  return (
    <details className="rounded-xl border border-line bg-card px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">{label("source_records")}</summary>
      <dl className="mt-2 grid gap-2 text-xs">
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-fg-muted">{label(k)}</dt>
            <dd className="break-words" dir="auto">{render(v)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Checks({ checks }: { checks: Check[] }) {
  const t = useTranslations("company.costOptimization.recs");
  const tChecks = useTranslations("company.costOptimization.checks");
  const dirOf = (label: string) => (/\(morning\)/.test(label) ? ` (${t("morning")})` : /\(evening\)/.test(label) ? ` (${t("evening")})` : "");
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t("checksTitle")}</p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {checks.map((c, i) => (
          <li key={i} className="flex items-start gap-3 px-3 py-2">
            {c.status === "PASS" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-ink" /> : c.status === "FAIL" ? <CircleX className="mt-0.5 size-4 shrink-0 text-danger-ink" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" />}
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {(tChecks.has(c.key as never) ? tChecks(c.key as never) : c.label) + dirOf(c.label) + (c.subject ? ` · ${c.subject}` : "")}
                <span className="ms-2 text-xs font-normal text-fg-muted">{t(`checkStatus.${c.status}` as never)}</span>
              </span>
              <span className="block text-xs text-fg-muted" dir="auto">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Recommendations tab ─────────────────────────────────────────────────────

const TYPE_FILTERS: Array<RecType | "ALL"> = ["ALL", "ROUTE_REDISTRIBUTE", "ROUTE_MERGE", "ROUTE_RESEQUENCE", "VEHICLE_DOWNSIZE", "ROUTE_DETOUR", "FUEL_DISCREPANCY"];

export function RecommendationsPanel({
  list,
  onOpen,
  types,
  title,
  description,
  aiEnabled,
}: {
  list: ReturnType<typeof useCostFetch<RecommendationList>>;
  onOpen: (id: number) => void;
  types?: RecType[];
  title: string;
  description: string;
  aiEnabled: boolean;
}) {
  const t = useTranslations("company.costOptimization.recs");
  const tc = useTranslations("company.costOptimization");
  const fmt = useFmt();
  const [type, setType] = useState<RecType | "ALL">("ALL");
  const [showRejected, setShowRejected] = useState(false);

  if (list.error) return <ErrorNote message={tc("loadFailed")} detail={list.error} onRetry={list.reload} />;
  if (!list.data) return <Skeleton className="h-60" />;
  const { run, recommendations, savings_locked } = list.data;
  const pool = recommendations.filter((r) => !types || types.includes(r.type));
  const shown = pool.filter((r) => (type === "ALL" || r.type === type) && (showRejected || r.feasibility === "FEASIBLE"));
  const hiddenRejected = pool.filter((r) => (type === "ALL" || r.type === type) && r.feasibility !== "FEASIBLE").length;
  const filters = TYPE_FILTERS.filter((f) => f === "ALL" || (!types || types.includes(f)) && pool.some((r) => r.type === f));

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title={title} description={description} badge={run ? t("runOn", { date: `${fmt.date(run.generated_at)} ${fmt.time(run.generated_at)}`, from: fmt.date(run.period_start), to: fmt.date(run.period_end) }) : undefined} />
      {!run ? (
        <EmptyNote>
          <Info className="mx-auto mb-2 size-5" />
          {aiEnabled ? t("noRun") : t("noRunNoAi")}
        </EmptyNote>
      ) : (
        <>
          {run.summary && (run.summary as { routing_available?: boolean }).routing_available === false && <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning-ink">{t("routingUnavailable")}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {filters.length > 2 &&
              filters.map((f) => (
                <button key={f} type="button" aria-pressed={type === f} onClick={() => setType(f)} className={cn("rounded-full px-3 py-1 text-xs font-medium", type === f ? "bg-brand text-white" : "bg-subtle text-fg-muted hover:text-fg")}>
                  {f === "ALL" ? t("all") : t(`type.${f}` as never)}
                </button>
              ))}
            {hiddenRejected > 0 && (
              <button type="button" onClick={() => setShowRejected((x) => !x)} className="ms-auto text-xs font-medium text-fg-muted hover:text-fg">
                {showRejected ? t("hideRejected") : t("showRejected", { count: hiddenRejected })}
              </button>
            )}
          </div>
          {shown.length === 0 ? (
            <EmptyNote>{t("noneFeasible")}</EmptyNote>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {shown.map((r) => (
                <RecommendationCard key={r.id} rec={r} onOpen={() => onOpen(r.id)} locked={savings_locked} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
