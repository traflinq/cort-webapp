/**
 * Single source of truth for number/date/text formatting in the admin portal.
 * Business timezone is Asia/Karachi; currency is PKR.
 */

export const BUSINESS_TZ = "Asia/Karachi";
export const LOCALE = "en-PK";

type CurrencyOptions = {
  /** Fraction digits (default 0). */
  digits?: number;
  /** Abbreviate to 1.2M / 45K. */
  compact?: boolean;
  currency?: string;
};

export function formatCurrency(
  value: number | string | null | undefined,
  { digits = 0, compact = false, currency = "PKR" }: CurrencyOptions = {},
): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: compact ? 0 : digits,
    maximumFractionDigits: compact ? Math.max(1, digits) : digits,
    notation: compact ? "compact" : "standard",
  }).format(n);
}

export function formatNumber(
  value: number | string | null | undefined,
  { digits = 0, compact = false }: { digits?: number; compact?: boolean } = {},
): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
    notation: compact ? "compact" : "standard",
  }).format(n);
}

export function formatPercent(
  value: number | string | null | undefined,
  digits = 1,
): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return `${n.toFixed(digits)}%`;
}

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 Oct 2026" */
export function formatDate(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** "12 Oct 2026, 8:05 AM" */
export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .replace(" am", " AM")
    .replace(" pm", " PM");
}

/** "8:05 AM" — accepts ISO timestamps or "HH:MM" strings. */
export function formatTime(value: DateInput): string {
  if (typeof value === "string" && /^\d{1,2}:\d{2}/.test(value) && !value.includes("T")) {
    const [h, m] = value.split(":");
    let hour = Number.parseInt(h, 10);
    if (Number.isNaN(hour)) return value;
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${m.slice(0, 2)} ${suffix}`;
  }
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Relative label for recent timestamps: "just now", "4m ago", "2h ago", else formatDateTime. */
export function formatRelative(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return formatDateTime(d);
}

/** "IN_PROGRESS" → "In progress"; "pending_approval" → "Pending approval". */
export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  const s = String(value).replace(/[_-]+/g, " ").trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Hashir Ahmed" → "HA" */
export function initials(name: string | null | undefined, max = 2): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, max)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Shared random password generator (replaces 4 inline copies). */
export function generatePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from({ length: Math.max(0, length - required.length) }, () => pick(all));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
