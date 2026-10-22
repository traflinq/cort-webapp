"use client";

/**
 * Admin wrapper around the shared fleet panel: resolves the company's service flags and the
 * ai_insights feature, then renders app/components/fleet/FleetEfficiencyPanel with admin endpoints.
 */

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/app/lib/services/api-client";
import { LoadingBlock } from "@/app/ui";
import { FleetEfficiencyPanel as SharedPanel, type FleetEndpoints } from "@/app/components/fleet/FleetEfficiencyPanel";

export function FleetEfficiencyPanel({ companyId }: { companyId: number }) {
  const [flags, setFlags] = useState<{ shuttle: boolean; chauffeur: boolean; pool: boolean; ai: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [companyRes, featuresRes] = await Promise.allSettled([apiClient.getCompany(companyId), apiClient.getCompanyFeatures(companyId)]);
      if (cancelled) return;
      const company = companyRes.status === "fulfilled" ? companyRes.value.data : null;
      const features = featuresRes.status === "fulfilled" ? featuresRes.value.data : [];
      setFlags({
        shuttle: company?.is_shuttle_enabled ?? false,
        chauffeur: company?.is_chauffeur_enabled ?? false,
        pool: company?.is_own_pooled_cars_managed ?? false,
        ai: features.find((f) => f.feature_key === "ai_insights")?.is_enabled ?? false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const endpoints = useMemo<FleetEndpoints>(
    () => ({
      metrics: (query) => `/admin/companies/${companyId}/shuttle-metrics${query}`,
      fuelVariance: `/admin/companies/${companyId}/fuel-variance?flagged_only=true`,
      insights: `/admin/companies/${companyId}/fleet-insights`,
      generateInsights: `/admin/companies/${companyId}/fleet-insights/generate`,
      chauffeurUtilization: `/admin/companies/${companyId}/chauffeur-utilization`,
      poolUtilization: `/admin/companies/${companyId}/pool-utilization`,
      routeComparison: (tripId) => `/admin/shuttle-trips/${tripId}/route-comparison`,
    }),
    [companyId],
  );

  if (!flags) return <LoadingBlock label="Loading fleet metrics…" />;
  return <SharedPanel endpoints={endpoints} services={{ shuttle: flags.shuttle, chauffeur: flags.chauffeur, pool: flags.pool }} aiEnabled={flags.ai} />;
}
