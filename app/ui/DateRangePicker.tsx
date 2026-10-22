"use client";

import * as React from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "./styles";
import { Button, type ButtonProps } from "./Button";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Field } from "./Field";
import { Input } from "./Input";
import { useUiLabels, type UiLabels } from "./lib/labels";
import {
  type DateRange,
  currentMonthRange,
  formatRangeLabel,
  isSameRange,
  lastMonthRange,
  lastNDaysRange,
  todayYmd,
} from "./lib/dates";

export type { DateRange };

export type DateRangePreset = { key: string; label: string; range: () => DateRange };

export function buildDefaultPresets(l: UiLabels["presetLabels"]): DateRangePreset[] {
  return [
    { key: "today", label: l.today, range: () => ({ start: todayYmd(), end: todayYmd() }) },
    { key: "7d", label: l.last7Days, range: () => lastNDaysRange(7) },
    { key: "30d", label: l.last30Days, range: () => lastNDaysRange(30) },
    { key: "month", label: l.thisMonth, range: currentMonthRange },
    { key: "last-month", label: l.lastMonth, range: lastMonthRange },
    { key: "90d", label: l.last90Days, range: () => lastNDaysRange(90) },
  ];
}

/** English presets (admin). Portals with translations get them from the picker via useUiLabels. */
export const defaultPresets: DateRangePreset[] = buildDefaultPresets({
  today: "Today", last7Days: "Last 7 days", last30Days: "Last 30 days", thisMonth: "This month", lastMonth: "Last month", last90Days: "Last 90 days",
});

/** Presets labelled in the current portal's language. */
export function useDefaultPresets(): DateRangePreset[] {
  const L = useUiLabels();
  return React.useMemo(() => buildDefaultPresets(L.presetLabels), [L]);
}

export interface DateRangePickerProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  presets?: DateRangePreset[];
  /** Show a Clear option that emits null ("All time"). */
  allowClear?: boolean;
  align?: "start" | "center" | "end";
  size?: ButtonProps["size"];
  className?: string;
  /** Accessible prefix, e.g. "Report period". */
  label?: string;
}

/**
 * Preset + custom date range. Emits YYYY-MM-DD strings (what the APIs already accept).
 * Uses native date inputs, so keyboard, mobile pickers and localisation come free.
 */
export function DateRangePicker({ value, onChange, presets, allowClear = false, align = "start", size = "md", className, label }: DateRangePickerProps) {
  const L = useUiLabels();
  const localised = useDefaultPresets();
  const list = presets ?? localised;
  const name = label ?? L.dateRange;
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange>(value ?? { start: "", end: "" });

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(value ?? { start: "", end: "" });
    setOpen(next);
  };

  const activePreset = list.find((p) => isSameRange(p.range(), value));
  const text = activePreset ? activePreset.label : formatRangeLabel(value, L.allTime);
  const draftValid = !!draft.start && !!draft.end && draft.start <= draft.end;

  const apply = (range: DateRange | null) => {
    onChange(range);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={size}
          leftIcon={<CalendarDays />}
          rightIcon={<ChevronDown className="opacity-60" />}
          aria-label={`${name}: ${text}`}
          className={cn("font-normal", className)}
        >
          <span className="truncate">{text}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[calc(100vw-2rem)] max-w-[26rem] p-0">
        <div className="flex flex-col sm:flex-row">
          <div
            role="group"
            aria-label={L.presets}
            className="flex flex-row flex-wrap gap-1 border-b border-line p-2 sm:w-36 sm:flex-col sm:border-b-0 sm:border-e"
          >
            {list.map((p) => {
              const active = activePreset?.key === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => apply(p.range())}
                  aria-pressed={active}
                  className={cn(
                    "cursor-pointer rounded-md px-2.5 py-1.5 text-start text-sm text-fg-secondary transition-colors hover:bg-subtle hover:text-fg",
                    active && "bg-brand-soft font-medium text-brand-ink",
                    focusRing,
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-1 flex-col gap-3 p-3">
            <Field label={L.from}>
              <Input type="date" value={draft.start} max={draft.end || undefined} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} />
            </Field>
            <Field label={L.to}>
              <Input type="date" value={draft.end} min={draft.start || undefined} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} />
            </Field>
            <div className="flex items-center justify-end gap-2 pt-1">
              {allowClear && (
                <Button variant="ghost" size="sm" onClick={() => apply(null)} className="me-auto">
                  {L.allTime}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                {L.cancel}
              </Button>
              <Button size="sm" onClick={() => draftValid && apply(draft)} disabled={!draftValid}>
                {L.apply}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
