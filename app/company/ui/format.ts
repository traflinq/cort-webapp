"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

const TIME_ZONE = "Asia/Karachi";

/**
 * Locale-aware formatting for the company portal. Amounts are always PKR; the locale only
 * changes digits, month names and direction. Dates use the Gregorian calendar in both locales.
 */
export function useFormatters() {
  const locale = useLocale();
  const tCurrency = useTranslations("common.currency");
  const currencyLabel = tCurrency("pkr");

  return useMemo(() => {
    const tag = locale === "ar" ? "ar-SA-u-ca-gregory" : "en-PK";
    const toDate = (v: Date | string | number) => (v instanceof Date ? v : new Date(v));
    const valid = (v: Date | string | number | null | undefined): v is Date | string | number =>
      v !== null && v !== undefined && v !== "" && !Number.isNaN(toDate(v).getTime());

    const number = (v: number | string | null | undefined, maxFractionDigits = 0) => {
      const n = typeof v === "string" ? Number(v) : v;
      if (n === null || n === undefined || Number.isNaN(n)) return "—";
      return n.toLocaleString(tag, { maximumFractionDigits: maxFractionDigits });
    };
    const fmt = (v: Date | string | number | null | undefined, options: Intl.DateTimeFormatOptions) =>
      valid(v) ? new Intl.DateTimeFormat(tag, { timeZone: TIME_ZONE, ...options }).format(toDate(v)) : "—";

    return {
      locale,
      number,
      /** "PKR 12,345" */
      currency: (v: number | string | null | undefined) => (number(v) === "—" ? "—" : `${currencyLabel} ${number(v)}`),
      /** "PKR 1.2M" — for stat cards only. */
      currencyCompact: (v: number | string | null | undefined) => {
        const n = typeof v === "string" ? Number(v) : v;
        if (n === null || n === undefined || Number.isNaN(n)) return "—";
        return `${currencyLabel} ${n.toLocaleString(tag, { notation: "compact", maximumFractionDigits: 1 })}`;
      },
      percent: (v: number | string | null | undefined, maxFractionDigits = 0) => (number(v) === "—" ? "—" : `${number(v, maxFractionDigits)}%`),
      /** "17 Nov 2026" */
      date: (v: Date | string | number | null | undefined) => fmt(v, { day: "numeric", month: "short", year: "numeric" }),
      /** "17 Nov" */
      dateShort: (v: Date | string | number | null | undefined) => fmt(v, { day: "numeric", month: "short" }),
      /** "17 Nov 2026, 3:45 pm" */
      dateTime: (v: Date | string | number | null | undefined) =>
        fmt(v, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }),
      /** "3:45 pm" */
      time: (v: Date | string | number | null | undefined) => fmt(v, { hour: "numeric", minute: "2-digit" }),
      /** "November 2026" */
      month: (v: Date | string | number | null | undefined) => fmt(v, { month: "long", year: "numeric" }),
      /** "Tuesday, 17 November" */
      longDate: (v: Date | string | number | null | undefined) => fmt(v, { weekday: "long", day: "numeric", month: "long" }),
    };
  }, [locale, currencyLabel]);
}

export type Formatters = ReturnType<typeof useFormatters>;
