"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarRange, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_RANGE_DAYS, presetRange, rangeProblem, todayPkt, type CostFilters, type Preset } from "./hooks";
import type { FilterOptions } from "./types";

const PRESETS: Preset[] = ["thisMonth", "lastMonth", "last30", "last90"];

const field = "h-9 rounded-xl border border-line bg-card px-3 text-sm text-fg outline-none focus:border-brand-line";

/**
 * Custom range. What is typed stays local until it is a complete, usable range and the user has paused,
 * so a half-typed year or a start after the end never reaches the API.
 */
function DateRange({ from, to, onApply }: { from: string; to: string; onApply: (patch: Partial<CostFilters>) => void }) {
  const t = useTranslations("company.costOptimization.filters");
  const [draft, setDraft] = useState({ from, to });
  const problem = draft.from && draft.to ? rangeProblem(draft.from, draft.to) : "invalid";
  const changed = draft.from !== from || draft.to !== to;
  useEffect(() => {
    if (!changed || problem) return;
    const timer = setTimeout(() => onApply({ from: draft.from, to: draft.to }), 500);
    return () => clearTimeout(timer);
  }, [changed, problem, draft.from, draft.to, onApply]);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="sr-only" htmlFor="co-from">
        {t("from")}
      </label>
      <input id="co-from" type="date" className={cn(field, changed && problem && "border-danger-line")} value={draft.from} max={draft.to || todayPkt()} aria-invalid={changed && !!problem} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
      <span className="text-fg-muted">–</span>
      <label className="sr-only" htmlFor="co-to">
        {t("to")}
      </label>
      <input id="co-to" type="date" className={cn(field, changed && problem && "border-danger-line")} value={draft.to} min={draft.from} max={todayPkt()} aria-invalid={changed && !!problem} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
      {changed && problem && (
        <span role="alert" className="text-xs text-danger-ink">
          {problem === "order" ? t("rangeOrder") : problem === "tooLong" ? t("rangeTooLong", { days: MAX_RANGE_DAYS }) : t("rangeInvalid")}
        </span>
      )}
    </div>
  );
}

/** Date range (presets or custom) plus route / vehicle / vendor, all kept in the URL. */
export function CostFilterBar({
  filters,
  onChange,
  options,
  showScope,
}: {
  filters: CostFilters;
  onChange: (patch: Partial<CostFilters>) => void;
  options: FilterOptions | null;
  /** route / vehicle / vendor apply to shuttle analysis only */
  showScope: boolean;
}) {
  const t = useTranslations("company.costOptimization.filters");
  const activePreset = PRESETS.find((p) => {
    const r = presetRange(p);
    return r.from === filters.from && r.to === filters.to;
  });
  const scoped = !!(filters.routeId || filters.vehicleId || filters.vendor);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="size-4 text-fg-muted" aria-hidden />
        <div role="group" aria-label={t("period")} className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={activePreset === p}
              onClick={() => onChange(presetRange(p))}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                activePreset === p ? "bg-brand text-white" : "text-fg-muted hover:bg-subtle hover:text-fg",
              )}
            >
              {t(p)}
            </button>
          ))}
        </div>
        {/* Keyed by the applied range, so a preset or the back button resets what is typed. */}
        <DateRange key={`${filters.from}|${filters.to}`} from={filters.from} to={filters.to} onApply={onChange} />
      </div>

      {showScope && options && (
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label={t("route")} className={cn(field, "min-w-40 max-w-full")} value={filters.routeId} onChange={(e) => onChange({ routeId: e.target.value })}>
            <option value="">{t("allRoutes")}</option>
            {options.routes.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
                {r.is_active ? "" : ` (${t("inactive")})`}
              </option>
            ))}
          </select>
          <select aria-label={t("vehicle")} className={cn(field, "min-w-36 max-w-full")} value={filters.vehicleId} onChange={(e) => onChange({ vehicleId: e.target.value })}>
            <option value="">{t("allVehicles")}</option>
            {options.vehicles.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.label}
              </option>
            ))}
          </select>
          {options.vendors.length > 0 && (
            <select aria-label={t("vendor")} className={cn(field, "min-w-36 max-w-full")} value={filters.vendor} onChange={(e) => onChange({ vendor: e.target.value })}>
              <option value="">{t("allVendors")}</option>
              {options.vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
          {scoped && (
            <button type="button" onClick={() => onChange({ routeId: "", vehicleId: "", vendor: "" })} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-fg-muted hover:bg-subtle hover:text-fg">
              <X className="size-3.5" />
              {t("clear")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
