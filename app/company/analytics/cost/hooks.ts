"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { apiClient } from "@/app/lib/services/api-client";
import { formatLocaleNumber } from "@/app/lib/i18n/format";
import type { Locale } from "@/i18n/config";
import type { Figure } from "./types";

// ─── Filters (synced to the URL) ─────────────────────────────────────────────

export interface CostFilters {
  from: string;
  to: string;
  routeId: string;
  vehicleId: string;
  vendor: string;
}

const PKT_OFFSET_MS = 5 * 3600_000;
export const todayPkt = () => new Date(Date.now() + PKT_OFFSET_MS).toISOString().slice(0, 10);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Longest range the API accepts (days, inclusive). */
export const MAX_RANGE_DAYS = 366;
const dayMs = 86_400_000;
const isRealDate = (s: string) => DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
export const rangeDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs) + 1;

/** Why a typed range cannot be used, or null when it is fine. */
export function rangeProblem(from: string, to: string): "invalid" | "order" | "tooLong" | null {
  if (!isRealDate(from) || !isRealDate(to)) return "invalid";
  if (from > to) return "order";
  if (rangeDays(from, to) > MAX_RANGE_DAYS) return "tooLong";
  return null;
}

/** A range from the URL that the API would reject is repaired instead of failing every panel. */
function saneRange(from: string, to: string): { from: string; to: string } {
  const def = presetRange("thisMonth");
  if (!isRealDate(from) || !isRealDate(to)) return def;
  if (from > to) [from, to] = [to, from];
  if (rangeDays(from, to) > MAX_RANGE_DAYS) from = new Date(Date.parse(`${to}T00:00:00Z`) - (MAX_RANGE_DAYS - 1) * dayMs).toISOString().slice(0, 10);
  return { from, to };
}

export type Preset = "thisMonth" | "lastMonth" | "last30" | "last90";

export function presetRange(p: Preset): { from: string; to: string } {
  const today = todayPkt();
  const d = new Date(`${today}T00:00:00Z`);
  const day = (offset: number) => new Date(d.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
  if (p === "thisMonth") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (p === "lastMonth") {
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
    return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
  }
  return { from: day(p === "last30" ? 29 : 89), to: today };
}

export function useCostFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const def = presetRange("thisMonth");
  const from = params.get("from");
  const to = params.get("to");
  const range = saneRange(from && DATE_RE.test(from) ? from : def.from, to && DATE_RE.test(to) ? to : def.to);
  const filters: CostFilters = {
    from: range.from,
    to: range.to,
    routeId: params.get("route") ?? "",
    vehicleId: params.get("vehicle") ?? "",
    vendor: params.get("vendor") ?? "",
  };
  const set = useCallback(
    (patch: Partial<CostFilters>) => {
      const next = new URLSearchParams(params.toString());
      const map: Record<keyof CostFilters, string> = { from: "from", to: "to", routeId: "route", vehicleId: "vehicle", vendor: "vendor" };
      for (const [k, v] of Object.entries(patch) as Array<[keyof CostFilters, string]>) {
        if (v) next.set(map[k], v);
        else next.delete(map[k]);
      }
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );
  return { filters, set };
}

export function filterQuery(f: CostFilters, opts: { withScope?: boolean } = { withScope: true }): string {
  const q = new URLSearchParams({ from: f.from, to: f.to });
  if (opts.withScope !== false) {
    if (f.routeId) q.set("route_id", f.routeId);
    if (f.vehicleId) q.set("vehicle_id", f.vehicleId);
    if (f.vendor) q.set("vendor", f.vendor);
  }
  return q.toString();
}

// ─── Fetching ────────────────────────────────────────────────────────────────

/** GET `path` whenever it changes (null = don't fetch). State only comes from settled requests. */
export function useCostFetch<T>(path: string | null) {
  const [nonce, setNonce] = useState(0);
  const key = path ? `${path}#${nonce}` : "";
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    // A superseded request (filter or tab changed) is aborted, not just ignored.
    const controller = new AbortController();
    apiClient
      .request<T>(path, { signal: controller.signal })
      .then((data) => !cancelled && setState({ key, data, error: null }))
      .catch((e: unknown) => !cancelled && setState({ key, data: null, error: e instanceof Error && e.message ? e.message : "error" }));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, path]);
  const reload = useCallback(() => setNonce((x) => x + 1), []);
  const settled = state?.key === key;
  return {
    data: settled ? state!.data : null,
    error: settled ? state!.error : null,
    loading: !!path && !settled,
    reload,
  };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function useFmt() {
  const locale = useLocale() as Locale;
  const tCommon = useTranslations("common");
  const t = useTranslations("company.costOptimization");
  return useMemo(() => {
    const n = (v: number | null | undefined, dp = 0) =>
      v == null || !Number.isFinite(v) ? "—" : formatLocaleNumber(v, locale, { maximumFractionDigits: dp, minimumFractionDigits: 0 });
    const pkr = (v: number | null | undefined) => (v == null ? "—" : `${tCommon("currency.pkr")} ${n(Math.round(v))}`);
    const unit = (u: Figure["unit"]) => t(`units.${u.replace("/", "_")}` as never);
    const value = (v: number | null | undefined, u: Figure["unit"]) => {
      if (v == null) return "—";
      if (u === "PKR") return pkr(v);
      if (u === "%") return `${n(v, 1)}%`;
      const dp =
        u === "count" || u === "seats" || u === "trips" || u === "days" || u === "trees"
          ? 0
          : u === "km/L" || u === "PKR/L" || u === "kg/L" || u === "L/h"
            ? 2
            : u === "kgCO2e" && Math.abs(v) >= 100
              ? 0
              : 1;
      return `${n(v, dp)} ${unit(u)}`;
    };
    const fig = (f: Figure | null | undefined) => (f ? value(f.value, f.unit) : "—");
    const date = (iso: string | null | undefined) =>
      iso ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "—";
    const time = (iso: string | null | undefined) =>
      iso ? new Date(iso).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-PK", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }) : "—";
    return { n, pkr, value, fig, unit, date, time, locked: t("locked") };
  }, [locale, t, tCommon]);
}
