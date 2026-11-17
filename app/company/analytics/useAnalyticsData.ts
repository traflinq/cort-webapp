"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/app/lib/services/api-client";
import { useAppSelector } from "@/app/lib/store/hooks";
import { selectCompany } from "@/app/lib/store/slices/companySlice";
import { useSavingsFetch } from "@/app/components/savings/useSavingsFetch";
import type { SavingsDashboardResponse } from "@/app/components/savings/types";
import type { FleetInsight } from "./components/insights";
import type { FuelVarianceFlag, ShuttleMetric, ShuttleMetricsSummary } from "./components/ShuttleTripQuality";
import type { ChauffeurUtilization } from "./components/ChauffeurPackageUse";
import type { PoolUtilization } from "./components/PoolCarUtilization";

type Features = { ai: boolean; pool: boolean };

export interface DetailData {
  shuttleSummary: ShuttleMetricsSummary | null;
  shuttleMetrics: ShuttleMetric[];
  fuelFlags: FuelVarianceFlag[];
  chauffeur: ChauffeurUtilization | null;
  pool: PoolUtilization | null;
  insights: FleetInsight[];
}

const EMPTY_DETAIL: DetailData = { shuttleSummary: null, shuttleMetrics: [], fuelFlags: [], chauffeur: null, pool: null, insights: [] };

/**
 * Everything the Analytics page shows:
 *  - the month's savings-dashboard payload (operational figures for every company; savings figures
 *    only once Traflinq has unlocked them)
 *  - last-30-days detail per service (trip quality, package use, car utilization)
 *  - AI insights (only when the ai_insights feature is on)
 * State is only set from settled requests; loading is derived from request keys.
 */
export function useAnalyticsData(month: string) {
  const company = useAppSelector(selectCompany);
  const companyId = Number(company?.id) || 0;
  const shuttleOn = !!company?.services_enabled?.shuttle_enabled;
  const chauffeurOn = !!company?.services_enabled?.chauffeur_enabled;

  const savings = useSavingsFetch<SavingsDashboardResponse>(`/company/savings-dashboard?month=${month}`);

  // Features: AI insights + pool (self-managed) fleet.
  const [features, setFeatures] = useState<{ key: number; value: Features } | null>(null);
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    apiClient
      .getCompanyFeatures(companyId)
      .then((res) => res.data ?? [])
      .catch(() => [] as { feature_key: string; is_enabled: boolean }[])
      .then((list) => {
        if (cancelled) return;
        const on = (k: string) => list.find((f) => f.feature_key === k)?.is_enabled ?? false;
        setFeatures({ key: companyId, value: { ai: on("ai_insights"), pool: on("chauffeur_self_managed") || on("shuttle_self_managed") } });
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);
  const featuresReady = features?.key === companyId;
  const ai = featuresReady ? features!.value.ai : false;

  // Pool: feature flag, or the legacy own-pool flag the savings payload reports.
  const savingsServices = savings.data && "services" in savings.data ? savings.data.services : undefined;
  const poolOn = (featuresReady && features!.value.pool) || !!savingsServices?.pool;

  // Last-30-days detail + insights.
  const [nonce, setNonce] = useState(0);
  const detailKey = featuresReady ? `${companyId}|${shuttleOn}|${chauffeurOn}|${poolOn}|${ai}|${nonce}` : "";
  const [detail, setDetail] = useState<{ key: string; data: DetailData } | null>(null);

  useEffect(() => {
    if (!detailKey) return;
    let cancelled = false;
    const get = <T,>(on: boolean, url: string) => (on ? apiClient.request<T>(url).catch(() => null) : Promise.resolve(null));
    Promise.all([
      get<{ summary: ShuttleMetricsSummary; metrics: ShuttleMetric[] }>(shuttleOn, "/company/fleet-metrics"),
      get<FuelVarianceFlag[]>(shuttleOn, "/company/fuel-variance?flagged_only=true"),
      get<ChauffeurUtilization>(chauffeurOn, "/company/chauffeur-utilization"),
      get<PoolUtilization>(poolOn, "/company/pool-utilization"),
      get<FleetInsight[]>(ai, "/company/fleet-insights"),
    ]).then(([metrics, fuel, chauffeur, pool, insights]) => {
      if (cancelled) return;
      setDetail({
        key: detailKey,
        data: {
          shuttleSummary: metrics?.summary ?? null,
          shuttleMetrics: metrics?.metrics?.slice(0, 10) ?? [],
          fuelFlags: fuel ?? [],
          chauffeur,
          pool,
          insights: insights ?? [],
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [detailKey, shuttleOn, chauffeurOn, poolOn, ai]);

  const reloadDetail = useCallback(() => setNonce((n) => n + 1), []);

  const services = useMemo(
    () => ({ shuttle: shuttleOn, chauffeur: chauffeurOn, pool: poolOn }),
    [shuttleOn, chauffeurOn, poolOn],
  );

  return {
    companyReady: !!companyId,
    services,
    ai,
    featuresReady,
    savings,
    detail: detail?.key === detailKey ? detail.data : detail?.data ?? EMPTY_DETAIL,
    detailLoading: !detailKey || detail?.key !== detailKey,
    reloadDetail,
  };
}
