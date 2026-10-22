"use client";

import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, useFormatters, type BadgeTone } from "@/app/ui";
import { cn } from "@/lib/utils";
import { parseTrend } from "./helpers";

export interface CostVisibilityData {
  totalSpendMTD: number;
  spendTrend: string;
  costPerEmployee: number;
  /** null when the company has not set a monthly budget. */
  budget: number | null;
}

export function CostVisibilityCard({ data, onEditBudget }: { data: CostVisibilityData; onEditBudget: () => void }) {
  const t = useTranslations("company.dashboard");
  const { formatCurrency } = useFormatters();
  const trend = parseTrend(data.spendTrend);
  const pct = data.budget && data.budget > 0 ? (data.totalSpendMTD / data.budget) * 100 : null;
  const status: { tone: BadgeTone; label: string } | null =
    pct === null ? null : pct > 100 ? { tone: "danger", label: t("overBudget") } : pct >= 80 ? { tone: "warning", label: t("nearBudget") } : { tone: "success", label: t("withinBudget") };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("costVisibility")}
        actions={
          <Button variant="outline" size="sm" leftIcon={<Pencil />} onClick={onEditBudget}>
            {data.budget ? t("editBudget") : t("setBudget")}
          </Button>
        }
      />
      <CardContent className="grid flex-1 gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="text-[13px] font-medium text-fg-muted">{t("totalSpendMtd")}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{formatCurrency(data.totalSpendMTD)}</p>
            {trend !== null && (
              <p className={cn("mt-1 text-xs font-medium tabular-nums", trend > 0 ? "text-danger-ink" : trend < 0 ? "text-success-ink" : "text-fg-muted")}>
                {trend > 0 ? "+" : ""}
                {trend}% {t("vsLastMonth")}
              </p>
            )}
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-fg-muted">{t("budgetUsage")}</span>
              {pct !== null ? <span className="font-semibold tabular-nums text-fg">{Math.round(pct)}%</span> : <span className="text-fg-muted">{t("noBudgetSet")}</span>}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct === null ? undefined : Math.min(100, Math.round(pct))} aria-label={t("budgetUsage")}>
              {pct !== null && (
                <div className={cn("h-full rounded-full transition-[width]", pct > 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-brand")} style={{ width: `${Math.min(100, pct)}%` }} />
              )}
            </div>
            {data.budget ? (
              <div className="mt-1.5 flex items-center justify-between text-xs text-fg-muted">
                <span>{formatCurrency(data.budget)} {t("goal")}</span>
                {status && <Badge tone={status.tone} size="sm">{status.label}</Badge>}
              </div>
            ) : null}
          </div>
        </div>
        <div className="border-t border-line pt-4 sm:border-s sm:border-t-0 sm:ps-6 sm:pt-0">
          <p className="text-[13px] font-medium text-fg-muted">{t("costPerTraveler")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{formatCurrency(data.costPerEmployee)}</p>
          <p className="mt-1 text-xs text-fg-muted">{t("avgSpendEmployees", { type: t("activeEmployees") })}</p>
        </div>
      </CardContent>
    </Card>
  );
}
