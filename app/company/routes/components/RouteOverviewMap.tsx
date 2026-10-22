"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Building2, Sunrise, Sunset } from "lucide-react";
import { apiClient } from "@/app/lib/services/api-client";
import type { MapMarker, MapPolyline } from "@/app/ui/Map";
import { Badge, Card, CardHeader, EmptyState, Tabs, TabsList, TabsTrigger } from "@/app/ui";
import { getOfficeStops } from "@/app/lib/utils/routeStops";
import { stopsForDirection, type CompanyRouteStop, type RouteDirection } from "../lib/route-types";
import { MAP_COLORS } from "../lib/map-colors";

const Map = dynamic(() => import("@/app/ui/Map"), { ssr: false });

type RouteOverviewMapProps = {
  routeId: number;
  stops: CompanyRouteStop[];
  refreshKey?: number;
};

export function RouteOverviewMap({ routeId, stops, refreshKey = 0 }: RouteOverviewMapProps) {
  const t = useTranslations("company.routes");
  const [mapDirection, setMapDirection] = useState<RouteDirection>("MORNING");
  const [polylineState, setPolylineState] = useState<{ direction: RouteDirection; points: [number, number][] } | null>(null);
  // Only draw the saved polyline for the direction currently shown (no stale line while the other one loads).
  const savedPolyline = useMemo(() => (polylineState?.direction === mapDirection ? polylineState.points : []), [polylineState, mapDirection]);
  const officeStopIds = useMemo(() => new Set(getOfficeStops(stops).map((s) => s.id)), [stops]);

  useEffect(() => {
    const direction = mapDirection;
    let cancelled = false;
    apiClient
      .request<{ points: { lat: number; lng: number }[] }>(`/routes/${routeId}/polyline?direction=${direction}`)
      .then((data) => !cancelled && setPolylineState({ direction, points: data.points.map((p) => [p.lat, p.lng] as [number, number]) }))
      .catch(() => !cancelled && setPolylineState({ direction, points: [] }));
    return () => {
      cancelled = true;
    };
  }, [routeId, mapDirection, refreshKey]);

  const dirStops = useMemo(
    () => stopsForDirection(stops, mapDirection).filter((s) => s.lat != null && s.lng != null && !isNaN(Number(s.lat)) && !isNaN(Number(s.lng))),
    [stops, mapDirection],
  );

  const mapMarkers: MapMarker[] = useMemo(
    () =>
      dirStops.map((s, idx) => {
        const isOffice = officeStopIds.has(s.id);
        return {
          id: s.id.toString(),
          position: [Number(s.lat), Number(s.lng)] as [number, number],
          label: isOffice ? `${t("office")} · ${s.name}` : `${idx + 1}. ${s.name}`,
          color: isOffice ? MAP_COLORS.office : MAP_COLORS.pickup,
        };
      }),
    [dirStops, officeStopIds, t],
  );

  const mapPolylines: MapPolyline[] = useMemo(() => {
    if (savedPolyline.length >= 2) return [{ positions: savedPolyline, color: MAP_COLORS.route }];
    if (dirStops.length > 1) {
      return [{ positions: dirStops.map((s) => [Number(s.lat), Number(s.lng)] as [number, number]), color: MAP_COLORS.fallback, dashArray: "6 6" }];
    }
    return [];
  }, [savedPolyline, dirStops]);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={t("routeMap")}
        description={t("routeMapDescription")}
        actions={
          <>
            <Badge tone="brand" size="sm" icon={<Building2 aria-hidden="true" />} className="hidden sm:inline-flex">
              {mapDirection === "MORNING" ? t("officeAmLast") : t("officePmFirst")}
            </Badge>
            <Tabs value={mapDirection} onValueChange={(v) => setMapDirection(v as RouteDirection)}>
              <TabsList variant="pills" aria-label={t("direction")}>
                <TabsTrigger value="MORNING" icon={<Sunrise />}>
                  {t("morning")}
                </TabsTrigger>
                <TabsTrigger value="EVENING" icon={<Sunset />}>
                  {t("evening")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        }
      />
      <div className="relative h-[420px]">
        {dirStops.length === 0 ? (
          <EmptyState compact title={t("noStopsForDirection")} className="h-full" />
        ) : (
          <Map height="100%" markers={mapMarkers} polylines={mapPolylines} />
        )}
      </div>
    </Card>
  );
}
