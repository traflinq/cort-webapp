"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, ChevronDown, X } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/admin/ui/Popover";
import { Button } from "@/app/admin/ui";
import { MAX_RANGE_DAYS, presetRange, rangeProblem, todayPkt, useFmt, type CostFilters, type Preset } from "./hooks";
import type { FilterOptions } from "./types";

const PRESETS: Preset[] = ["thisMonth", "lastMonth", "last30", "last90"];

const field =
  "h-9 rounded-lg border border-line bg-card px-3 text-sm text-fg transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/30";

/**
 * Date range behind one button (calendar icon + the current range), like the super-admin picker:
 * presets apply at once; a custom range applies on "Apply" and only when it is a usable range.
 */
function DateRangeButton({ from, to, onApply }: { from: string; to: string; onApply: (patch: Partial<CostFilters>) => void }) {
  const t = useTranslations("company.costOptimization.filters");
  const fmt = useFmt();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const activePreset = PRESETS.find((p) => {
    const r = presetRange(p);
    return r.from === from && r.to === to;
  });
  const text = activePreset ? t(activePreset) : `${fmt.date(from)} – ${fmt.date(to)}`;
  const problem = draft.from && draft.to ? rangeProblem(draft.from, draft.to) : "invalid";
  const touched = draft.from !== from || draft.to !== to;
  const apply = (range: { from: string; to: string }) => {
    onApply(range);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft({ from, to });
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${t("period")}: ${text}`} className={cn(field, "flex items-center gap-2 hover:bg-subtle")}>
          <CalendarDays className="size-4 text-fg-muted" aria-hidden />
          <span className="truncate tabular-nums">{text}</span>
          <ChevronDown className="size-4 text-fg-muted" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[calc(100vw-2rem)] max-w-[26rem] p-0">
        <div className="flex flex-col sm:flex-row">
          <div role="group" aria-label={t("period")} className="flex flex-row flex-wrap gap-1 border-b border-line p-2 sm:w-36 sm:flex-col sm:border-b-0 sm:border-e">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={activePreset === p}
                onClick={() => apply(presetRange(p))}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activePreset === p ? "bg-subtle font-medium text-fg" : "text-fg-muted",
                )}
              >
                {t(p)}
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-3 p-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
              {t("from")}
              <input type="date" className={field} value={draft.from} max={draft.to || todayPkt()} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
              {t("to")}
              <input type="date" className={field} value={draft.to} min={draft.from} max={todayPkt()} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
            </label>
            {touched && problem && (
              <span role="alert" className="text-xs text-danger-ink">
                {problem === "order" ? t("rangeOrder") : problem === "tooLong" ? t("rangeTooLong", { days: MAX_RANGE_DAYS }) : t("rangeInvalid")}
              </span>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button size="sm" disabled={!!problem} onClick={() => apply(draft)}>
                {t("apply")}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Date range (one button) plus route / vehicle / vendor on the same row, all kept in the URL. */
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
  const scoped = !!(filters.routeId || filters.vehicleId || filters.vendor);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangeButton from={filters.from} to={filters.to} onApply={onChange} />

      {showScope && options && (
        <>
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
            <Button variant="ghost" size="sm" onClick={() => onChange({ routeId: "", vehicleId: "", vendor: "" })} leftIcon={<X aria-hidden="true" />}>
              {t("clear")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
