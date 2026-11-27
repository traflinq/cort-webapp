"use client";

import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button, CardDescription, CardTitle } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { Card } from "../Card";
import { useOverviewFormat } from "./format";
import { Delta, FigureRow } from "./Delta";

export interface SpendBudgetData {
  spendMtd: number;
  budget: number | null;
  projected: number | null;
  spendDelta?: number;
  completedRides: number;
  completedDelta?: number;
  avgTripCost: number | null;
  costPerActiveEmployee: number | null;
  spendLifetime: number;
}

/**
 * Chauffeur spend against the monthly budget, as a bullet chart:
 * solid bar = spent so far, lighter bar = projected month end at the current pace, line = budget.
 */
export function SpendBudgetCard({ data, onEditBudget }: { data: SpendBudgetData; onEditBudget?: () => void }) {
  const t = useTranslations("company.overview.spend");
  const f = useOverviewFormat();
  const { spendMtd, budget, projected } = data;

  const scaleMax = Math.max(budget ?? 0, projected ?? 0, spendMtd, 1) * 1.08;
  const pos = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  const overBy = budget && projected ? projected - budget : null;
  const usedPct = budget ? (spendMtd / budget) * 100 : null;

  const figures = [
    {
      key: "rides",
      label: t("ridesCompleted"),
      value: f.num(data.completedRides),
      sub: data.completedDelta !== undefined ? <Delta value={data.completedDelta} label={t("vsLastMonth")} /> : undefined,
    },
    { key: "avg", label: t("avgTripCost"), value: f.money(data.avgTripCost), sub: t("perCompletedRide") },
    { key: "perEmp", label: t("costPerEmployee"), value: f.money(data.costPerActiveEmployee), sub: t("perActiveEmployee") },
  ];

  return (
    <Card className="flex flex-col gap-5 p-0 sm:p-0">
      <div className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        {onEditBudget && (
          <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={onEditBudget}>
            {budget ? t("editBudget") : t("setBudget")}
          </Button>
        )}
      </div>

      <div className="px-4 sm:px-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-fg-muted">{t("spent")}</dt>
            <dd className="mt-1 text-xl font-semibold tracking-tight text-fg tabular-nums">{f.money(spendMtd)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-fg-muted">{t("projected")}</dt>
            <dd className="mt-1 text-xl font-semibold tracking-tight text-fg-secondary tabular-nums">{f.money(projected)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-fg-muted">{t("budget")}</dt>
            <dd className="mt-1 text-xl font-semibold tracking-tight text-fg-secondary tabular-nums">{budget ? f.money(budget) : "—"}</dd>
          </div>
        </dl>

        {/* Bullet chart */}
        <div className="mt-4" role="img" aria-label={t("chartLabel", { spent: f.money(spendMtd), projected: f.money(projected), budget: budget ? f.money(budget) : "—" })}>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-subtle">
            {projected !== null && (
              <div className="absolute inset-y-0 start-0 rounded-full bg-brand/25" style={{ width: pos(projected) }} />
            )}
            <div className="absolute inset-y-0 start-0 rounded-full bg-brand" style={{ width: pos(spendMtd) }} />
          </div>
          <div className="relative h-4">
            {budget !== null && (
              <div className="absolute -top-[1.125rem] h-[1.375rem] w-0.5 rounded-full bg-fg" style={{ insetInlineStart: pos(budget) }} aria-hidden="true" />
            )}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" aria-hidden="true" />{t("legendSpent")}</li>
            {projected !== null && <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand/25" aria-hidden="true" />{t("legendProjected")}</li>}
            {budget !== null && <li className="flex items-center gap-1.5"><span className="h-2.5 w-0.5 rounded-full bg-fg" aria-hidden="true" />{t("legendBudget")}</li>}
          </ul>
        </div>

        <p
          className={cn(
            "mt-4 rounded-lg px-3 py-2 text-sm",
            budget === null
              ? "bg-subtle text-fg-secondary"
              : overBy !== null && overBy > 0
                ? "bg-warning-soft text-warning-ink"
                : "bg-success-soft text-success-ink",
          )}
        >
          {budget === null
            ? t("noBudget")
            : projected === null
              ? t("usedSoFar", { percent: f.pct(usedPct ?? 0) })
              : overBy !== null && overBy > 0
                ? t("projectedOver", { amount: f.money(overBy), percent: f.pct((overBy / budget) * 100) })
                : t("projectedUnder", { amount: f.money(Math.abs(overBy ?? 0)) })}
        </p>
      </div>

      <FigureRow items={figures} />
    </Card>
  );
}
