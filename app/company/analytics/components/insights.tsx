"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Bus, Car, Clock, Fuel, Lock, Navigation, Package, Users, type AppIcon } from "@/app/components/icons";
import { Badge, type BadgeTone } from "@/app/admin/ui";
import { useFmt } from "../cost/hooks";

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

const SEVERITY_TONE: Record<FleetInsight["severity"], BadgeTone> = { CRITICAL: "danger", HIGH: "warning", MEDIUM: "info", LOW: "neutral" };

const INSIGHT_ICON: Record<string, AppIcon> = {
  FUEL_LEAKAGE: Fuel,
  OCCUPANCY: Bus,
  CHAUFFEUR_DETOUR: Navigation,
  ROUTE_DETOUR: Navigation,
  IDLE_TIME: Clock,
  CHAUFFEUR_PACKAGE_UNDERUTILIZATION: Package,
  CHAUFFEUR_CONCURRENT: Users,
  POOL_UTILIZATION: Car,
};

/** "CHAUFFEUR_PACKAGE_UNDERUTILIZATION" → "Chauffeur package underutilization" (no translated label exists for these types). */
const typeLabel = (type: string) => {
  const s = type.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function InsightCard({ insight }: { insight: FleetInsight }) {
  const t = useTranslations("company.fleetAnalytics");
  const tSeverity = useTranslations("company.overview.savings.severity");
  const fmt = useFmt();
  const amount = saving(insight);
  const Icon = INSIGHT_ICON[insight.insight_type] ?? AlertTriangle;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-subtle text-fg-muted">
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="truncate text-xs font-medium text-fg-muted">{typeLabel(insight.insight_type)}</span>
        </span>
        <Badge tone={SEVERITY_TONE[insight.severity] ?? "neutral"} size="sm" dot>
          {tSeverity(insight.severity)}
        </Badge>
      </div>
      <div>
        <p className="text-sm font-medium text-fg" dir="auto">{insight.data.summary}</p>
        <p className="mt-1 text-sm text-fg-muted" dir="auto">{insight.data.recommendation}</p>
      </div>
      {amount > 0 && (
        <p className="mt-auto border-t border-line pt-3 text-sm font-semibold text-success-ink tabular-nums">
          {t("estSavingMonth", { amount: fmt.n(Math.round(amount)) })}
        </p>
      )}
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
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      {!aiEnabled ? (
        <div className="flex items-start gap-3 rounded-xl border border-line bg-card p-5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-fg-muted">
            <Lock className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-fg">{t("aiDisabledTitle")}</p>
            <p className="mt-1 text-sm text-fg-muted">{t("aiDisabledDescription")}</p>
          </div>
        </div>
      ) : insights.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-5 text-sm text-fg-muted">{t("noInsights")}</p>
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
