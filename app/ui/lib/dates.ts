/**
 * YYYY-MM-DD helpers used by date inputs, filters and the DateRangePicker.
 * All functions work in the browser's local calendar (what <input type="date"> uses).
 */

export type DateRange = { start: string; end: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "YYYY-MM-DD" using local calendar fields (no UTC shift at midnight). */
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" → local Date at 00:00, or null if invalid. */
export function parseYmd(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function todayYmd(): string {
  return toYmd(new Date());
}

export function addDays(ymdOrDate: string | Date, days: number): string {
  const d = typeof ymdOrDate === "string" ? parseYmd(ymdOrDate) ?? new Date() : new Date(ymdOrDate);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

export function startOfMonth(d = new Date()): string {
  return toYmd(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(d = new Date()): string {
  return toYmd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function currentMonthRange(): DateRange {
  return { start: startOfMonth(), end: endOfMonth() };
}

export function lastMonthRange(): DateRange {
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return { start: startOfMonth(prev), end: endOfMonth(prev) };
}

export function lastNDaysRange(n: number): DateRange {
  const end = todayYmd();
  return { start: addDays(end, -(n - 1)), end };
}

export function isSameRange(a: DateRange | null | undefined, b: DateRange | null | undefined): boolean {
  return !!a && !!b && a.start === b.start && a.end === b.end;
}

/** "1 – 31 Oct 2026" / "28 Sep – 4 Oct 2026" / "12 Oct 2026" */
export function formatRangeLabel(range: DateRange | null | undefined, allTimeLabel = "All time"): string {
  if (!range?.start || !range?.end) return allTimeLabel;
  const s = parseYmd(range.start);
  const e = parseYmd(range.end);
  if (!s || !e) return `${range.start} – ${range.end}`;
  const dm = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
  const dmy = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
  if (range.start === range.end) return dmy(s);
  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) return `${s.getDate()} – ${dmy(e)}`;
    return `${dm(s)} – ${dmy(e)}`;
  }
  return `${dmy(s)} – ${dmy(e)}`;
}
