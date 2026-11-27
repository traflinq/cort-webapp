"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/app/lib/services/api-client";
import { useCompanyAccess } from "../lib/access-context";
import { useSavingsFetch } from "@/app/components/savings/useSavingsFetch";
import type { SavingsDashboardResponse } from "@/app/components/savings/types";
import type { FleetInsight } from "./components/insights";
import type { FuelVarianceFlag, ShuttleMetric, ShuttleMetricsSummary } from "./components/ShuttleTripQuality";
import type { ChauffeurUtilization } from "./components/ChauffeurPackageUse";
import type { PoolUtilization } from "./components/PoolCarUtilization";

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
 * Which services and features apply comes from the company's access (known before the page renders).
 * State is only set from settled requests; loading is derived from request keys.
 */
export function useAnalyticsData(month: string) {
  const { company, access } = useCompanyAccess();
  const companyId = company.id;
  const shuttleOn = access.services.shuttle;
  const chauffeurOn = access.services.chauffeur;
  const ai = access.can.aiInsights;

  const savings = useSavingsFetch<SavingsDashboardResponse>(`/company/savings-dashboard?month=${month}`);

  // Pool: the company runs its own cars, or the savings payload reports the legacy own-pool flag.
  const savingsServices = savings.data && "services" in savings.data ? savings.data.services : undefined;
  const poolOn = access.can.poolFleet || !!savingsServices?.pool;

  // Last-30-days detail + insights.
  const [nonce, setNonce] = useState(0);
  const detailKey = `${companyId}|${shuttleOn}|${chauffeurOn}|${poolOn}|${ai}|${nonce}`;
  const [detail, setDetail] = useState<{ key: string; data: DetailData } | null>(null);

  useEffect(() => {
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
    services,
    ai,
    savings,
    detail: detail?.key === detailKey ? detail.data : detail?.data ?? EMPTY_DETAIL,
    detailLoading: detail?.key !== detailKey,
    reloadDetail,
  };
}
