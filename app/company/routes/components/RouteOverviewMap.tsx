"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Building2, Sunrise, Sunset } from "lucide-react";
import { UnderlineTabs } from "../../ui";
import { Card } from "../../components/DashboardComponents";
import { apiClient } from "../../../lib/services/api-client";
import type { MapMarker, MapPolyline } from "@/app/admin/ui/Map";
import type { CompanyRouteStop } from "./RouteStopsEditor";
import { getOfficeStops } from "../../../lib/utils/routeStops";

const Map = dynamic(() => import("@/app/admin/ui/Map"), { ssr: false });

type RouteOverviewMapProps = {
  routeId: number;
  stops: CompanyRouteStop[];
  refreshKey?: number;
};

export function RouteOverviewMap({ routeId, stops, refreshKey = 0 }: RouteOverviewMapProps) {
  const t = useTranslations("company.routes");
  const [mapDirection, setMapDirection] = useState<"MORNING" | "EVENING">("MORNING");
  const [savedPolyline, setSavedPolyline] = useState<[number, number][]>([]);
  const officeStopIds = useMemo(() => new Set(getOfficeStops(stops).map((s) => s.id)), [stops]);

  const fetchPolyline = useCallback(async () => {
    try {
      const data = await apiClient.request<{ points: { lat: number; lng: number }[] }>(
        `/routes/${routeId}/polyline?direction=${mapDirection}`,
      );
      setSavedPolyline(data.points.map((p) => [p.lat, p.lng] as [number, number]));
    } catch {
      setSavedPolyline([]);
    }
  }, [routeId, mapDirection]);

  useEffect(() => {
    setSavedPolyline([]);
    fetchPolyline();
  }, [fetchPolyline, refreshKey]);

  const dirStops = useMemo(
    () =>
      [...stops]
        .filter((s) => {
          if (s.lat == null || s.lng == null || isNaN(Number(s.lat)) || isNaN(Number(s.lng))) return false;
          return mapDirection === "MORNING" ? s.morning_sequence != null : s.evening_sequence != null;
        })
        .sort((a, b) =>
          mapDirection === "MORNING"
            ? (a.morning_sequence ?? 0) - (b.morning_sequence ?? 0)
            : (a.evening_sequence ?? 0) - (b.evening_sequence ?? 0),
        ),
    [stops, mapDirection],
  );

  const mapMarkers: MapMarker[] = useMemo(
    () =>
      dirStops.map((s, idx) => {
        const isOffice = officeStopIds.has(s.id);
        return {
          id: s.id.toString(),
          position: [Number(s.lat), Number(s.lng)] as [number, number],
          label: isOffice ? `Office · ${s.name}` : `${idx + 1}. ${s.name}`,
          color: isOffice ? "#ef4444" : "#6366f1",
        };
      }),
    [dirStops, officeStopIds],
  );

  const mapPolylines: MapPolyline[] = useMemo(() => {
    if (savedPolyline.length >= 2) {
      return [{ positions: savedPolyline, color: "#1c1b4d" }];
    }
    if (dirStops.length > 1) {
      return [{
        positions: dirStops.map((s) => [Number(s.lat), Number(s.lng)] as [number, number]),
        color: "#6366f1",
      }];
    }
    return [];
  }, [savedPolyline, dirStops]);

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 px-6 pt-5 border-b border-[var(--divider)]">
        <div>
          <div className="text-xl font-medium text-[var(--text-primary)]">{t("routeMap")}</div>
          <div className="text-sm text-[var(--text-muted)] mt-1 mb-4">{t("routeMapDescription")}</div>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-flex mb-3 items-center gap-1 text-xs text-[var(--tone-danger-ink)] bg-[var(--tone-danger-soft)] px-3 py-1 rounded-full">
            <Building2 className="w-3 h-3" /> Office = {mapDirection === "MORNING" ? "AM last" : "PM first"}
          </span>
          <UnderlineTabs
            size="md"
            value={mapDirection}
            onChange={setMapDirection}
            items={[
              { value: "MORNING", label: t("morningRoute"), icon: Sunrise },
              { value: "EVENING", label: t("eveningRoute"), icon: Sunset },
            ]}
          />
        </div>
      </div>

      <div className="relative" style={{ height: 420 }}>
        {dirStops.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-muted)]">
            {t("noStopsForDirection")}
          </div>
        ) : (
          <Map height="100%" markers={mapMarkers} polylines={mapPolylines} />
        )}
      </div>
    </Card>
  );
}
