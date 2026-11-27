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
    return { num, money, pct, locale };
  }, [locale, tCurrency]);
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
