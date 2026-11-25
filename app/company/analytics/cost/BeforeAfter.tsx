"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import type { ShuttleSection } from "@/app/components/savings/types";
import { useFmt } from "./hooks";

/**
 * Cort-managed service: what the company paid its vendor before Traflinq for the same period,
 * and what switching saved (fewer vehicles, fewer km). Figures come from the savings report.
 */
export function BeforeAfter({ savings, periodLabel, onManageBenchmarks }: { savings: NonNullable<ShuttleSection["savings"]>; periodLabel: string; onManageBenchmarks: () => void }) {
  const t = useTranslations("company.costOptimization.beforeAfter");
  const fmt = useFmt();
  if (!savings.has_benchmarks) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 text-sm text-fg-muted">
        {t("noBenchmark")}
        <button type="button" onClick={onManageBenchmarks} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-fg hover:bg-subtle">
          {t("addBenchmark")}
        </button>
      </div>
    );
  }
  const before = savings.benchmark_cost_pkr ?? null;
  const saved = savings.total_pkr;
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-[13px] font-medium text-fg-muted">{t("before")}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{before == null ? "—" : fmt.pkr(before)}</p>
        <p className="mt-1 text-xs text-fg-muted">{t("beforeHint", { period: periodLabel })}</p>
      </div>
      <div className="hidden items-center justify-center md:flex">
        <ArrowRight className="size-5 text-fg-muted rtl-flip" />
      </div>
      <div className="rounded-2xl border border-success-line bg-success-soft p-5">
        <p className="text-[13px] font-medium text-success-ink">{t("saved")}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-success-ink">{fmt.pkr(saved)}</p>
        <p className="mt-1 text-xs text-success-ink">
          {t("savedBreakdown", {
            vehicles: fmt.n(savings.vehicles_reduced, 1),
            vehiclesPkr: fmt.pkr(savings.vehicles_reduced_pkr),
            km: fmt.n(savings.km_reduced),
            kmPkr: fmt.pkr(savings.km_reduced_pkr),
          })}
        </p>
      </div>
    </div>
  );
}
