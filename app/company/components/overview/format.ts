"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useCompanyLocale } from "../../lib/locale-context";
import { formatLocaleNumber } from "../../../lib/i18n/format";

/** Locale-aware number and PKR formatting for the overview. Full amounts, never "k" shorthand. */
export function useOverviewFormat() {
  const { locale } = useCompanyLocale();
  const tCurrency = useTranslations("common.currency");
  return useMemo(() => {
    const num = (v: number, dp = 0) => formatLocaleNumber(v, locale, { maximumFractionDigits: dp, minimumFractionDigits: 0 });
    const money = (v: number | null | undefined) =>
      v == null || !Number.isFinite(v) ? "—" : `${tCurrency("pkr")} ${num(Math.round(v))}`;
    const pct = (v: number, dp = 0) => `${num(v, dp)}%`;
    /** 0 = Sunday → localised weekday name. 7 Jan 2024 was a Sunday. */
    const weekdayFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-PK", { weekday: "long", timeZone: "UTC" });
    const weekday = (index: number) => weekdayFmt.format(new Date(Date.UTC(2024, 0, 7 + index)));
    return { num, money, pct, weekday, locale };
  }, [locale, tCurrency]);
}

const ENGLISH_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Weekday index (0 = Sunday) from the dashboard's seasonality block. Prefers the numeric field; older
 * API versions only send an English day name, or a "Data collecting..." placeholder, which maps to null.
 */
export function resolveWeekday(index: number | null | undefined, name: string | null | undefined): number | null {
  if (typeof index === "number" && index >= 0 && index <= 6) return index;
  const i = name ? ENGLISH_WEEKDAYS.indexOf(name) : -1;
  return i >= 0 ? i : null;
}

/** "+5%", "-3.2%", "0%" → number, or undefined when it can't be read. */
export function parseTrend(trend: string | null | undefined): number | undefined {
  if (!trend) return undefined;
  const n = parseFloat(trend.replace("%", ""));
  return Number.isFinite(n) ? n : undefined;
}

/** Month-to-date run rate projected to month end. Null in the first two days, when it means little. */
export function projectMonthEnd(spendMtd: number, now = new Date()): number | null {
  const day = now.getDate();
  if (day < 3) return null;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return (spendMtd / day) * daysInMonth;
}
