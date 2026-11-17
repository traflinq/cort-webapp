"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Bus, Car, Fuel, Lock, Navigation, Package, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type FleetInsight = {
  id: number;
  insight_type: string;
  vehicle_id: number | null;
  route_id: number | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  estimated_saving_pkr: string | number | null;
  data: { summary: string; recommendation: string; metric_value?: number | string | null };
  generated_at: string;
};

export type AnalyticsService = "shuttle" | "chauffeur" | "pool";

const SERVICE_TYPES: Record<AnalyticsService, Set<string>> = {
  shuttle: new Set(["FUEL_LEAKAGE", "OCCUPANCY", "ROUTE_DETOUR", "IDLE_TIME"]),
  chauffeur: new Set(["CHAUFFEUR_DETOUR", "CHAUFFEUR_PACKAGE_UNDERUTILIZATION", "CHAUFFEUR_CONCURRENT"]),
  pool: new Set(["POOL_UTILIZATION"]),
};

export const insightsFor = (insights: FleetInsight[], service: AnalyticsService) =>
  insights.filter((i) => SERVICE_TYPES[service].has(i.insight_type));

const saving = (i: FleetInsight) => Math.max(0, Number(i.estimated_saving_pkr) || 0);

export const bySaving = (a: FleetInsight, b: FleetInsight) => saving(b) - saving(a);

/**
 * Total monthly potential across insights. FUEL_LEAKAGE and ROUTE_DETOUR price the same extra
 * kilometres, so only the larger of the two counts (mirrors the backend's dedupedSavingTotal).
 */
export function potentialSaving(insights: FleetInsight[]): number {
  let leakage = 0;
  let detour = 0;
  let other = 0;
  for (const i of insights) {
    if (i.insight_type === "FUEL_LEAKAGE") leakage += saving(i);
    else if (i.insight_type === "ROUTE_DETOUR") detour += saving(i);
    else other += saving(i);
  }
  return Math.round(Math.max(leakage, detour) + other);
}

function severityColor(s: string) {
  if (s === "CRITICAL") return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  if (s === "HIGH") return "bg-[var(--cort-orange)]/10 text-[var(--cort-orange)] border-[var(--cort-orange)]/20";
  if (s === "MEDIUM") return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  return "bg-blue-500/10 text-blue-400 border-blue-500/20";
}

function insightIcon(type: string) {
  if (type === "FUEL_LEAKAGE") return <Fuel className="size-5 text-orange-500" />;
  if (type === "OCCUPANCY") return <Bus className="size-5 text-blue-500" />;
  if (type === "CHAUFFEUR_DETOUR" || type === "ROUTE_DETOUR") return <Navigation className="size-5 text-purple-500" />;
  if (type === "IDLE_TIME") return <Zap className="size-5 text-yellow-500" />;
  if (type === "CHAUFFEUR_PACKAGE_UNDERUTILIZATION") return <Package className="size-5 text-teal-400" />;
  if (type === "CHAUFFEUR_CONCURRENT") return <Users className="size-5 text-indigo-400" />;
  if (type === "POOL_UTILIZATION") return <Car className="size-5 text-violet-400" />;
  return <AlertTriangle className="size-5 text-fg-muted" />;
}

export function InsightCard({ insight }: { insight: FleetInsight }) {
  const t = useTranslations("company.fleetAnalytics");
  const amount = saving(insight);
  return (
    <div className={cn("rounded-2xl border p-4", severityColor(insight.severity))}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{insightIcon(insight.insight_type)}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide">{insight.insight_type.replace(/_/g, " ")}</span>
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-xs font-medium">{insight.severity}</span>
          </div>
          <p className="text-sm font-medium">{insight.data.summary}</p>
          <p className="mt-1 text-xs opacity-80">{insight.data.recommendation}</p>
          {amount > 0 && (
            <p className="mt-2 text-xs font-semibold">{t("estSavingMonth", { amount: Math.round(amount).toLocaleString() })}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Insight list for one service tab (or the overview). */
export function InsightsSection({
  title,
  description,
  insights,
  aiEnabled,
  action,
}: {
  title: string;
  description?: string;
  insights: FleetInsight[];
  aiEnabled: boolean;
  action?: React.ReactNode;
}) {
  const t = useTranslations("company.analytics");
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-fg">
            <Zap className="size-4 text-[var(--cort-orange)]" /> {title}
          </h3>
          {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      {!aiEnabled ? (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line bg-subtle/40 p-5">
          <Lock className="mt-0.5 size-5 shrink-0 text-fg-muted" />
          <div>
            <p className="text-sm font-semibold text-fg">{t("aiDisabledTitle")}</p>
            <p className="mt-1 text-sm text-fg-muted">{t("aiDisabledDescription")}</p>
          </div>
        </div>
      ) : insights.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-5 text-sm text-fg-muted">{t("noInsights")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      )}
    </section>
  );
}
