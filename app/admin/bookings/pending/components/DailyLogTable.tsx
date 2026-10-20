"use client";

import { Plus, Trash2 } from "lucide-react";
import { TripType } from "../../../../lib/services/api-client";
import { Button, Checkbox, IconButton, Input, Select } from "../../../ui";
import { formatDate } from "../../../lib/format";

export type DailyLogRow = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  trip_type: TripType;
  is_full_day: boolean;
  hours_used: string;
  apply_accommodation: boolean;
};

type Props = {
  rows: DailyLogRow[];
  onChange: (rows: DailyLogRow[]) => void;
  /** Full-day checkbox is only meaningful for 10h / 24h packages. */
  allowFullDay: boolean;
  /** Date column editable + add/remove rows (recalculate overrides). */
  editableDates?: boolean;
  emptyText?: string;
};

/** Shared editable daily-log grid for End trip, Daily logs and Recalculate dialogs. */
export function DailyLogTable({ rows, onChange, allowFullDay, editableDates = false, emptyText = "No days to show." }: Props) {
  const update = (idx: number, patch: Partial<DailyLogRow>) => {
    const next = [...rows];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const addRow = () => {
    const last = rows.length > 0 ? new Date(rows[rows.length - 1].date) : new Date();
    const nextDate = new Date(last);
    if (rows.length > 0) nextDate.setDate(nextDate.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}`;
    onChange([
      ...rows,
      { id: `${dateStr}-${Date.now()}`, date: dateStr, trip_type: TripType.IN_CITY, is_full_day: false, hours_used: "", apply_accommodation: false },
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-xs">
          <thead className="bg-subtle text-left text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            <tr>
              <th scope="col" className="px-3 py-2">
                Date
              </th>
              <th scope="col" className="px-3 py-2">
                Type
              </th>
              <th scope="col" className="w-24 px-3 py-2">
                Hours
              </th>
              <th scope="col" className="w-20 px-3 py-2 text-center">
                Full day
              </th>
              <th scope="col" className="w-20 px-3 py-2 text-center">
                Accom.
              </th>
              {editableDates && (
                <th scope="col" className="w-10 px-2 py-2">
                  <span className="sr-only">Remove</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((log, idx) => (
              <tr key={log.id}>
                <td className="px-3 py-1.5 text-fg">
                  {editableDates ? (
                    <Input type="date" aria-label={`Date for day ${idx + 1}`} value={log.date} onChange={(e) => update(idx, { date: e.target.value })} className="h-7 w-36 text-xs" />
                  ) : (
                    <span className="whitespace-nowrap font-medium">{formatDate(log.date)}</span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  <Select
                    width="auto"
                    aria-label={`Trip type for day ${idx + 1}`}
                    value={log.trip_type}
                    onChange={(e) => update(idx, { trip_type: e.target.value as TripType })}
                    className="h-7 py-0 pr-7 text-xs"
                  >
                    <option value={TripType.IN_CITY}>In city</option>
                    <option value={TripType.OUT_STATION}>Outstation</option>
                  </Select>
                </td>
                <td className="px-3 py-1.5">
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    aria-label={`Hours used on day ${idx + 1}`}
                    placeholder="Hrs"
                    value={log.hours_used}
                    disabled={log.is_full_day}
                    onChange={(e) => update(idx, { hours_used: e.target.value })}
                    className="h-7 text-xs"
                    mono
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <Checkbox
                    aria-label={`Full day on day ${idx + 1}`}
                    checked={log.is_full_day}
                    disabled={!allowFullDay}
                    onCheckedChange={(c) => update(idx, { is_full_day: c === true, hours_used: c === true ? "0" : log.hours_used })}
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <Checkbox
                    aria-label={`Accommodation on day ${idx + 1}`}
                    checked={log.apply_accommodation}
                    onCheckedChange={(c) => update(idx, { apply_accommodation: c === true })}
                  />
                </td>
                {editableDates && (
                  <td className="px-2 py-1.5 text-center">
                    <IconButton label={`Remove day ${idx + 1}`} size="icon-xs" variant="ghost" tooltip={false} onClick={() => onChange(rows.filter((_, i) => i !== idx))}>
                      <Trash2 className="text-danger-ink" />
                    </IconButton>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={editableDates ? 6 : 5} className="px-3 py-6 text-center text-fg-muted">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editableDates && (
        <Button variant="ghost" size="sm" leftIcon={<Plus />} onClick={addRow}>
          Add day
        </Button>
      )}
    </div>
  );
}

/** Local-calendar YYYY-MM-DD from a Date (no UTC shift). */
export function ymdLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
