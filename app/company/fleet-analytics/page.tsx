"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/app/ui";
import { useAppSelector } from "@/app/lib/store/hooks";
import { selectCompany, selectCompanyFeatures } from "@/app/lib/store/slices/companySlice";
import { FleetEfficiencyPanel, type FleetEndpoints, type FleetLabels } from "@/app/components/fleet/FleetEfficiencyPanel";

const COMPANY_ENDPOINTS: FleetEndpoints = {
  metrics: (query) => `/company/fleet-metrics${query}`,
  fuelVariance: "/company/fuel-variance?flagged_only=true",
  insights: "/company/fleet-insights",
  generateInsights: "/company/fleet-insights/generate",
  chauffeurUtilization: "/company/chauffeur-utilization",
  poolUtilization: "/company/pool-utilization",
  routeComparison: (tripId) => `/company/shuttle-trips/${tripId}/route-comparison`,
};

export default function FleetAnalyticsPage() {
  const t = useTranslations("company.fleetAnalytics");
  const company = useAppSelector(selectCompany);
  const features = useAppSelector(selectCompanyFeatures);

  const hasFeature = (key: string) => features.find((f) => f.feature_key === key)?.is_enabled ?? false;
  const services = {
    shuttle: company?.services_enabled?.shuttle_enabled ?? false,
    chauffeur: company?.services_enabled?.chauffeur_enabled ?? false,
    pool: hasFeature("chauffeur_self_managed") || hasFeature("shuttle_self_managed"),
  };
  const aiEnabled = hasFeature("ai_insights");

  const labels = useMemo<FleetLabels>(
    () => ({
      loading: t("loadingMetrics"),
      loadFailed: t("loadFailed"),
      shuttleAnalytics: t("shuttleAnalytics"),
      chauffeurAnalytics: t("chauffeurAnalytics"),
      poolAnalytics: t("poolAnalytics"),
      active: t("active"),
      metricsOnly: t("metricsOnly"),
      runAiAnalysis: t("runAiAnalysis"),
      generating: t("generating"),
      shuttleDisabled: t("shuttleAiDisabled"),
      chauffeurDisabled: t("chauffeurAiDisabled"),
      poolDisabled: t("poolDisabled"),
      disabledHint: t("contactAdminEnable"),
      tripsAnalysed: t("tripsAnalysed"),
      avgOccupancy: t("avgOccupancy"),
      avgDetourRatio: t("avgDetourRatio"),
      totalIdleMin: t("totalIdleMin"),
      aiInsightsShuttle: t("aiInsightsShuttle"),
      aiInsightsChauffeur: t("aiInsightsChauffeur"),
      aiInsightsPool: t("aiInsightsPool"),
      noShuttleInsights: t("noShuttleInsights"),
      noChauffeurInsights: t("noChauffeurInsights"),
      noPoolInsights: t("noPoolInsights"),
      flaggedFuelVariance: t("flaggedFuelVariance"),
      flagged: (count) => t("flagged", { count }),
      fuelVarianceNote: t("fuelVarianceNote"),
      vehicle: t("vehicle"),
      date: t("date"),
      variance: t("variance"),
      actualL: t("actualL"),
      expectedL: t("expectedL"),
      streak: t("streak"),
      recentShuttleTrips: t("recentShuttleTrips"),
      allVehicles: t("allVehicles"),
      dir: t("dir"),
      driver: t("driver"),
      occupancy: t("occupancy"),
      detour: t("detour"),
      idleMin: t("idleMin"),
      fuelVar: t("fuelVar"),
      route: t("route"),
      view: t("view"),
      close: t("close"),
      noTripsForVehicle: t("noTripsForVehicle"),
      noTripsForDates: t("noTripsForDates"),
      noTrips: t("noTrips"),
      routeMapOverlay: t("routeMapOverlay"),
      planned: t("planned"),
      actual: t("actual"),
      departed: t("departed"),
      arrived: t("arrived"),
      loadingRouteData: t("loadingRouteData"),
      noRouteData: t("noRouteData"),
      noPolylineData: t("noPolylineData"),
      detourRatio: t("detourRatio"),
      extraDistance: (percent) => t("extraDistance", { percent }),
      idleTime: t("idleTime"),
      fuelVariance: t("fuelVariance"),
      aiNote: t("aiNote"),
      totalBookings: t("totalBookings"),
      avgUtilization: t("avgUtilization"),
      underutilizedBookings: t("underutilizedBookings"),
      underutilizedHint: t("underutilizedHint"),
      underutilized70: t("underutilized70"),
      estBillingSaving: t("estBillingSaving"),
      booking: t("booking"),
      package: t("package"),
      used: t("used"),
      utilization: t("utilization"),
      estSaving: t("estSaving"),
      estSavingMonth: (amount) => t("estSavingMonthFormatted", { amount }),
      poolVehicles: t("poolVehicles"),
      idleVehicles: t("idleVehicles"),
      underutilized30: t("underutilized30"),
      poolVehicleUtilization: t("poolVehicleUtilization"),
      poolUtilizationHint: t("poolUtilizationHint"),
      category: t("category"),
      trips: t("trips"),
      hoursUsed: t("hoursUsed"),
      firstStop: t("firstStop"),
      lastStop: t("lastStop"),
      firstStopDescription: t("firstStopDescription"),
      lastStopDescription: t("lastStopDescription"),
      departedDescription: t("departedDescription"),
      arrivedDescription: t("arrivedDescription"),
    }),
    [t],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <FleetEfficiencyPanel endpoints={COMPANY_ENDPOINTS} services={services} aiEnabled={aiEnabled} labels={labels} />
    </div>
  );
}
