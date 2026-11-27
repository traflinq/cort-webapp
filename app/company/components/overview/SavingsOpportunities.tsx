"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowLeftRight, Bus, Car, ChevronDown, Clock, Fuel, GitMerge, Lock, Navigation, Package, Shrink, Split, TrendingDown, Waypoints,
  type LucideIcon,
} from "lucide-react";
import { Badge, CardDescription, CardTitle, focusRing, type BadgeTone } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { Card } from "../Card";
import { useOverviewFormat } from "./format";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SavingsInsight = {
  id: number;
  insight_type: string;
  severity: Severity;
  estimated_saving_pkr: number;
  label: string;
  is_preview: boolean;
  data: { summary: string; recommendation: string; metric_value?: number };
  generated_at: string | null;
};

export interface SavingsOpportunitiesData {
  aiInsightsEnabled: boolean;
  totalPotentialSavingPkr: number;
  insights: SavingsInsight[];
}

const ICON: Record<string, LucideIcon> = {
  FUEL_LEAKAGE: Fuel,
  OCCUPANCY: Bus,
  ROUTE_DETOUR: Navigation,
  CHAUFFEUR_DETOUR: Navigation,
  IDLE_TIME: Clock,
  CHAUFFEUR_CONCURRENT: Car,
  CHAUFFEUR_PACKAGE_UNDERUTILIZATION: Package,
  POOL_UTILIZATION: Car,
  ROUTE_MERGE: GitMerge,
  FLEET_REPLAN: Waypoints,
  ROUTE_REDISTRIBUTE: Split,
  ROUTE_RESEQUENCE: ArrowLeftRight,
  VEHICLE_DOWNSIZE: Shrink,
};

const SEVERITY_TONE: Record<Severity, BadgeTone> = { CRITICAL: "danger", HIGH: "warning", MEDIUM: "info", LOW: "neutral" };
const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Cost leakage found in the company's own trip data, ranked by estimated monthly saving.
 * Without the Cost Saving feature, the amounts stay visible and only the "how" is locked.
 */
export function SavingsOpportunities({ data, analyticsHref }: { data: SavingsOpportunitiesData; analyticsHref: string }) {
  const t = useTranslations("company.overview.savings");
  const f = useOverviewFormat();
  const [open, setOpen] = useState<number | null>(null);

  const enabled = data.aiInsightsEnabled;
  const rows = [...data.insights].sort(
    (a, b) => (b.estimated_saving_pkr || 0) - (a.estimated_saving_pkr || 0) || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
  const total = data.totalPotentialSavingPkr;

  return (
    <Card id="savings" className="scroll-mt-6 p-0 sm:p-0">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{t("title")}</CardTitle>
            {!enabled && rows.length > 0 && <Badge tone="neutral" size="sm">{t("preview")}</Badge>}
          </div>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        {rows.length > 0 && total > 0 && (
          <div className="sm:text-end">
            <p className="text-xs text-fg-muted">{t("totalLabel")}</p>
            <p className="text-xl font-semibold tracking-tight text-success-ink tabular-nums">
              {f.money(total)}
              <span className="ms-1 text-sm font-normal text-fg-muted">{t("perMonth")}</span>
            </p>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-line px-5 py-10 text-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-subtle text-fg-muted">
            <TrendingDown className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-fg">{t("emptyTitle")}</p>
          <p className="max-w-sm text-xs text-fg-muted">{t("emptyBody")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-start text-xs text-fg-muted">
                <th scope="col" className="px-4 py-2.5 text-start font-medium sm:px-5">{t("colOpportunity")}</th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">{t("colSeverity")}</th>
                <th scope="col" className="px-4 py-2.5 text-end font-medium">{t("colSaving")}</th>
                <th scope="col" className="w-px px-4 py-2.5 sm:pe-5"><span className="sr-only">{t("colAction")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                const Icon = ICON[row.insight_type] ?? TrendingDown;
                const isOpen = open === row.id;
                const canExpand = enabled && !!row.data?.recommendation;
                return (
                  <Fragment key={row.id}>
                    <tr className="align-top">
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-subtle text-fg-muted">
                            <Icon className="size-3.5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-fg">{row.label}</p>
                            {enabled ? (
                              row.data?.summary && <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{row.data.summary}</p>
                            ) : (
                              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-fg-muted">
                                <Lock className="size-3" aria-hidden="true" />
                                {t("lockedHow")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={SEVERITY_TONE[row.severity] ?? "neutral"} size="sm" dot>
                          {t(`severity.${row.severity}` as never)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-end font-semibold text-fg tabular-nums whitespace-nowrap">
                        {row.estimated_saving_pkr > 0 ? f.money(row.estimated_saving_pkr) : "—"}
                      </td>
                      <td className="px-4 py-3 sm:pe-5">
                        {canExpand && (
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : row.id)}
                            aria-expanded={isOpen}
                            aria-controls={`rec-${row.id}`}
                            className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-fg-secondary hover:bg-subtle hover:text-fg whitespace-nowrap", focusRing)}
                          >
                            {isOpen ? t("hide") : t("howToSave")}
                            <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {canExpand && isOpen && (
                      <tr id={`rec-${row.id}`}>
                        <td colSpan={4} className="bg-subtle px-4 py-3 sm:px-5">
                          <p className="text-xs font-medium text-fg">{t("recommendation")}</p>
                          <p className="mt-1 max-w-3xl text-sm text-fg-secondary">{row.data.recommendation}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 text-xs text-fg-muted sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span>{enabled ? t("footerEnabled") : t("footerLocked")}</span>
          {enabled && (
            <Link href={analyticsHref} className={cn("shrink-0 rounded font-medium text-brand-ink hover:underline", focusRing)}>
              {t("seeAll")}
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
