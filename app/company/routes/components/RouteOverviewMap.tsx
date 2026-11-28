"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Building2, Sunrise, Sunset } from "@/app/components/icons";
import { Badge, focusRing } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { Card } from "../../components/Card";
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
          color: isOffice ? "#ef4444" : "#6e7ff0",
        };
      }),
    [dirStops, officeStopIds],
  );

  const mapPolylines: MapPolyline[] = useMemo(() => {
    if (savedPolyline.length >= 2) {
      return [{ positions: savedPolyline, color: "#0C225E" }];
    }
    if (dirStops.length > 1) {
      return [{
        positions: dirStops.map((s) => [Number(s.lat), Number(s.lng)] as [number, number]),
        color: "#6e7ff0",
      }];
    }
    return [];
  }, [savedPolyline, dirStops]);

  const directionBtn = (dir: "MORNING" | "EVENING", icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setMapDirection(dir)}
      aria-pressed={mapDirection === dir}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors [&_svg]:size-3.5",
        focusRing,
        mapDirection === dir ? "bg-card text-fg shadow-xs" : "text-fg-muted hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">{t("routeMap")}</h3>
          <p className="text-xs text-fg-muted">{t("routeMapDescription")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral" icon={<Building2 />} className="hidden sm:inline-flex">
            Office = {mapDirection === "MORNING" ? "AM last" : "PM first"}
          </Badge>
          <div className="flex items-center gap-1 rounded-lg bg-subtle p-0.5">
            {directionBtn("MORNING", <Sunrise aria-hidden="true" />, t("morningRoute"))}
            {directionBtn("EVENING", <Sunset aria-hidden="true" />, t("eveningRoute"))}
          </div>
        </div>
      </div>

      <div className="relative" style={{ height: 420 }}>
        {dirStops.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-fg-muted">
            {t("noStopsForDirection")}
          </div>
        ) : (
          <Map height="100%" markers={mapMarkers} polylines={mapPolylines} className="!rounded-none !border-0 !shadow-none" />
        )}
      </div>
    </Card>
  );
}
