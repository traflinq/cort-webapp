"use client";

/**
 * Single source of truth for number/date/text formatting across the portals.
 * The module-level functions use the business defaults (Asia/Karachi, en-PK, PKR);
 * a portal that serves other locales mounts <FormatProvider> and reads useFormatters().
 */

import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";

export const BUSINESS_TZ = "Asia/Karachi";
export const LOCALE = "en-PK";

export type FormatConfig = {
  /** BCP-47 tag used for dates and currency (e.g. "en-PK", "ar-SA"). */
  locale: string;
  currency: string;
  timeZone: string;
  /** Plain-number locale; defaults to `locale`. */
  numberLocale?: string;
  /** Relative-time words; English by default. */
  relative?: { justNow: string; minutesAgo: (n: number) => string; hoursAgo: (n: number) => string };
};

export const DEFAULT_FORMAT: FormatConfig = { locale: LOCALE, currency: "PKR", timeZone: BUSINESS_TZ, numberLocale: "en-US" };

type CurrencyOptions = {
  /** Fraction digits (default 0). */
  digits?: number;
  /** Abbreviate to 1.2M / 45K. */
  compact?: boolean;
  currency?: string;
};

type DateInput = string | number | Date | null | undefined;

export type Formatters = ReturnType<typeof createFormatters>;

export function createFormatters(cfg: FormatConfig) {
  const numberLocale = cfg.numberLocale ?? cfg.locale;
  const english = cfg.locale.toLowerCase().startsWith("en");
  const relative = cfg.relative ?? { justNow: "just now", minutesAgo: (n: number) => `${n}m ago`, hoursAgo: (n: number) => `${n}h ago` };

  function formatCurrency(value: number | string | null | undefined, { digits = 0, compact = false, currency = cfg.currency }: CurrencyOptions = {}): string {
    const n = toNumber(value);
    if (n === null) return "—";
    return new Intl.NumberFormat(cfg.locale, {
      style: "currency",
      currency,
      minimumFractionDigits: compact ? 0 : digits,
      maximumFractionDigits: compact ? Math.max(1, digits) : digits,
      notation: compact ? "compact" : "standard",
    }).format(n);
  }

  function formatNumber(value: number | string | null | undefined, { digits = 0, compact = false }: { digits?: number; compact?: boolean } = {}): string {
    const n = toNumber(value);
    if (n === null) return "—";
    return new Intl.NumberFormat(numberLocale, { minimumFractionDigits: 0, maximumFractionDigits: digits, notation: compact ? "compact" : "standard" }).format(n);
  }

  function formatPercent(value: number | string | null | undefined, digits = 1): string {
    const n = toNumber(value);
    if (n === null) return "—";
    return `${n.toFixed(digits)}%`;
  }

  /** "12 Oct 2026" */
  function formatDate(value: DateInput): string {
    const d = toDate(value);
    if (!d) return "—";
    return new Intl.DateTimeFormat(english ? "en-GB" : cfg.locale, { timeZone: cfg.timeZone, day: "numeric", month: "short", year: "numeric" }).format(d);
  }

  /** "12 Oct 2026, 8:05 AM" */
  function formatDateTime(value: DateInput): string {
    const d = toDate(value);
    if (!d) return "—";
    const out = new Intl.DateTimeFormat(english ? "en-GB" : cfg.locale, {
      timeZone: cfg.timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
    return english ? out.replace(" am", " AM").replace(" pm", " PM") : out;
  }

  /** "8:05 AM" — accepts ISO timestamps or "HH:MM" strings. */
  function formatTime(value: DateInput): string {
    if (typeof value === "string" && /^\d{1,2}:\d{2}/.test(value) && !value.includes("T")) {
      const [h, m] = value.split(":");
      const hour = Number.parseInt(h, 10);
      if (Number.isNaN(hour)) return value;
      if (!english) {
        const d = new Date(2000, 0, 1, hour, Number.parseInt(m.slice(0, 2), 10) || 0);
        return new Intl.DateTimeFormat(cfg.locale, { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
      }
      const suffix = hour >= 12 ? "PM" : "AM";
      return `${hour % 12 || 12}:${m.slice(0, 2)} ${suffix}`;
    }
    const d = toDate(value);
    if (!d) return "—";
    return new Intl.DateTimeFormat(english ? "en-US" : cfg.locale, { timeZone: cfg.timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  }

  /** Relative label for recent timestamps: "just now", "4m ago", "2h ago", else formatDateTime. */
  function formatRelative(value: DateInput): string {
    const d = toDate(value);
    if (!d) return "—";
    const diff = Date.now() - d.getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return relative.justNow;
    if (min < 60) return relative.minutesAgo(min);
    const hr = Math.round(min / 60);
    if (hr < 24) return relative.hoursAgo(hr);
    return formatDateTime(d);
  }

  return { config: cfg, formatCurrency, formatNumber, formatPercent, formatDate, formatDateTime, formatTime, formatRelative };
}

const defaults = createFormatters(DEFAULT_FORMAT);

export const formatCurrency = defaults.formatCurrency;
export const formatNumber = defaults.formatNumber;
export const formatPercent = defaults.formatPercent;
export const formatDate = defaults.formatDate;
export const formatDateTime = defaults.formatDateTime;
export const formatTime = defaults.formatTime;
export const formatRelative = defaults.formatRelative;

const FormatContext = createContext<Formatters>(defaults);

/** Mount in a portal whose locale/currency differ from the business defaults. */
export function FormatProvider({ config, children }: { config: FormatConfig; children: ReactNode }) {
  const value = useMemo(() => createFormatters(config), [config]);
  return createElement(FormatContext.Provider, { value }, children);
}

/** Locale-aware formatters for the current portal (business defaults without a provider). */
export function useFormatters(): Formatters {
  return useContext(FormatContext);
}

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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

/** Shared random password generator (replaces inline copies). */
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
