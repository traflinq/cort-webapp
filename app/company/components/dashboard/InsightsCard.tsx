"use client";

import { useTranslations } from "next-intl";
import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/ui";

export function InsightsCard({ insights, seasonality, hasChauffeur }: { insights: string[]; seasonality: { highDemandDay: string | null; lowDemandDay: string | null }; hasChauffeur: boolean }) {
  const t = useTranslations("company.dashboard");
  const showSeasonality = hasChauffeur && (seasonality.highDemandDay || seasonality.lowDemandDay);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title={t("insightsTitle")} />
      <CardContent className="flex flex-1 flex-col gap-4">
        <ul className="space-y-2.5">
          {insights.map((insight) => (
            <li key={insight} className="flex gap-2.5 text-sm text-fg-secondary">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden="true" />
              <span>{insight}</span>
            </li>
          ))}
        </ul>
        {showSeasonality && (
          <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-line pt-4">
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{t("peakDay")}</dt>
              <dd className="truncate text-sm font-medium text-fg">{seasonality.highDemandDay ?? t("analysisPending")}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{t("quietDay")}</dt>
              <dd className="truncate text-sm font-medium text-fg">{seasonality.lowDemandDay ?? t("analysisPending")}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
