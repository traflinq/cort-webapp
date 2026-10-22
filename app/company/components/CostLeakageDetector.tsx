"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bus, Car, ChevronDown, Clock, Fuel, Lock, Navigation, Package, Sparkles, Zap } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, StatusBadge, useFormatters } from "@/app/ui";
import { cn } from "@/lib/utils";

type SavingsInsight = {
  id: number;
  insight_type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  estimated_saving_pkr: number;
  label: string;
  is_preview: boolean;
  data: { summary: string; recommendation: string; metric_value?: number };
  generated_at: string | null;
};

interface CostLeakageDetectorProps {
  data: { aiInsightsEnabled: boolean; totalPotentialSavingPkr: number; insights: SavingsInsight[] };
}

function insightIcon(type: string) {
  const cls = "size-5";
  if (type === "FUEL_LEAKAGE") return <Fuel className={cls} aria-hidden="true" />;
  if (type === "OCCUPANCY") return <Bus className={cls} aria-hidden="true" />;
  if (type === "ROUTE_DETOUR" || type === "CHAUFFEUR_DETOUR") return <Navigation className={cls} aria-hidden="true" />;
  if (type === "IDLE_TIME") return <Clock className={cls} aria-hidden="true" />;
  if (type === "CHAUFFEUR_CONCURRENT" || type === "POOL_UTILIZATION") return <Car className={cls} aria-hidden="true" />;
  if (type === "CHAUFFEUR_PACKAGE_UNDERUTILIZATION") return <Package className={cls} aria-hidden="true" />;
  return <Zap className={cls} aria-hidden="true" />;
}

/** AI cost-saving insights from the dashboard stats (values come from the API; previews are blurred until the feature is enabled). */
export default function CostLeakageDetector({ data }: CostLeakageDetectorProps) {
  const t = useTranslations("company.costLeakage");
  const { formatCurrency } = useFormatters();
  const [expanded, setExpanded] = useState<number | null>(null);

  const insights = data?.insights ?? [];
  const aiEnabled = data?.aiInsightsEnabled ?? false;
  const totalSaving = data?.totalPotentialSavingPkr ?? 0;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-ink" aria-hidden="true" />
            {t("powerInsights")}
            {!aiEnabled && insights.length > 0 && (
              <Badge tone="purple" size="sm">
                {t("preview")}
              </Badge>
            )}
          </span>
        }
        description={
          insights.length > 0 && totalSaving > 0 ? (
            <>
              {t("couldSaveUpTo")} <span className="font-semibold text-brand-ink">{formatCurrency(totalSaving)}</span>
              {t("perMonth")}
            </>
          ) : aiEnabled ? (
            t("aiFleetInsights")
          ) : (
            t("costLeakageAnalysis")
          )
        }
      />
      <CardContent>
        {insights.length === 0 ? (
          <EmptyState compact icon={<Zap aria-hidden="true" />} title={t("notEnoughData")} description={t("insightsAppearHint")} />
        ) : (
          <>
            <ul className="grid gap-4 md:grid-cols-2">
              {insights.map((insight) => {
                const isOpen = expanded === insight.id;
                return (
                  <li key={insight.id} className="flex flex-col rounded-xl border border-line bg-subtle p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">{insightIcon(insight.insight_type)}</span>
                      <StatusBadge status={insight.severity} size="sm" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-fg">{insight.label}</h3>
                    <div className="relative mt-1.5">
                      {!aiEnabled && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-fg">
                            <Lock className="size-3" aria-hidden="true" />
                            {t("enableCostSaving")}
                          </span>
                        </div>
                      )}
                      <div className={cn("text-sm text-fg-secondary", !aiEnabled && "select-none opacity-50 blur-[3px]")} aria-hidden={!aiEnabled}>
                        <p>{aiEnabled ? insight.data.summary : t("lockedSummary")}</p>
                        {aiEnabled && isOpen && insight.data.recommendation && <p className="mt-2 border-t border-line pt-2 text-xs">{insight.data.recommendation}</p>}
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{aiEnabled ? t("estMonthlySaving") : t("potentialMonthlySavings")}</p>
                        <p className="text-xl font-semibold tabular-nums text-fg">{insight.estimated_saving_pkr > 0 ? formatCurrency(insight.estimated_saving_pkr) : "—"}</p>
                      </div>
                      {aiEnabled && insight.data.recommendation && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={isOpen}
                          rightIcon={<ChevronDown className={cn("transition-transform", isOpen && "rotate-180")} />}
                          onClick={() => setExpanded(isOpen ? null : insight.id)}
                        >
                          {isOpen ? t("less") : t("details")}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {!aiEnabled && <p className="mt-4 text-center text-xs text-fg-muted">{t("footerHint")}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
