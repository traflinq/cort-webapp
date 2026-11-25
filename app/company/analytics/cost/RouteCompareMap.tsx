"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useChartColors } from "./charts";
import type { MapGeometry } from "./types";
import type { MapMarker, MapPolyline } from "@/app/admin/ui/Map";

// Google Maps is loaded only when a recommendation with geometry is opened (Maps API cost).
const Map = dynamic(() => import("@/app/admin/ui/Map"), { ssr: false });

type View = "current" | "proposed" | "both";

/**
 * Current route(s) vs the proposed route on one map.
 * Current kept route: solid. Route being removed: grey. Proposed (simulation): dashed.
 * Stop pins show the visiting order of the selected view.
 */
export function RouteCompareMap({ geometry }: { geometry: MapGeometry }) {
  const t = useTranslations("company.costOptimization.map");
  const c = useChartColors();
  const [view, setView] = useState<View>("both");
  const routeColor = useMemo(() => {
    const ids = [...new Set([...geometry.stops.map((s) => s.route_id), ...geometry.routes.map((r) => r.route_id).filter((x): x is number => x !== null)])];
    const palette = [c.series[1], c.series[0], c.series[3], c.series[4], c.series[5], c.series[2]];
    return new globalThis.Map(ids.map((id, i) => [id, palette[i % palette.length]]));
  }, [geometry, c]);

  const polylines: MapPolyline[] = geometry.routes
    .filter((r) => (view === "both" ? true : view === "current" ? r.role !== "PROPOSED" : r.role === "PROPOSED"))
    .map((r) => ({
      positions: r.points.map((p) => [p.lat, p.lng] as [number, number]),
      color: r.role === "PROPOSED" ? (r.route_id !== null ? (routeColor.get(r.route_id) ?? c.series[2]) : c.series[2]) : r.role === "CURRENT_REMOVED" ? c.muted : (routeColor.get(r.route_id ?? -1) ?? c.series[1]),
      weight: r.role === "PROPOSED" ? 5 : 4,
      opacity: r.role === "PROPOSED" ? 0.95 : 0.75,
      dashArray: r.role === "PROPOSED" ? "8 8" : undefined,
    }));

  const markers: MapMarker[] = [
    ...geometry.stops.map((s) => {
      const seq = view === "current" ? s.old_sequence : (s.new_sequence ?? s.old_sequence);
      const colourRoute = view !== "current" && s.moves_to ? s.moves_to.route_id : s.route_id;
      return {
        id: `stop-${s.route_id}-${s.id}`,
        position: [s.lat, s.lng] as [number, number],
        label: seq == null ? "" : String(seq),
        color: routeColor.get(colourRoute) ?? c.series[1],
        description:
          t("stopDescription", { name: s.name, old: s.old_sequence ?? "—", new: s.new_sequence ?? "—", assigned: s.assigned }) +
          (s.moves_to ? ` · ${t("movesTo", { route: s.moves_to.route_name })}` : ""),
      };
    }),
    ...geometry.markers.map((m, i) => ({
      id: `m-${i}`,
      position: [m.lat, m.lng] as [number, number],
      label: m.kind === "OFFICE" ? "O" : m.kind === "START" ? "S" : "E",
      color: m.kind === "OFFICE" ? "#dc2626" : "#334155",
      description: m.label,
    })),
  ];

  const views: View[] = ["both", "current", "proposed"];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={t("view")} className="flex gap-1 rounded-xl border border-line bg-card p-1">
          {views.map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1 text-xs font-medium", view === v ? "bg-brand text-white" : "text-fg-muted hover:bg-subtle")}>
              {t(v)}
            </button>
          ))}
        </div>
        <ul className="flex flex-wrap gap-3 text-xs text-fg-muted">
          {geometry.routes.map((r, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-5"
                style={{
                  background:
                    r.role === "PROPOSED"
                      ? `repeating-linear-gradient(90deg, ${r.route_id !== null ? (routeColor.get(r.route_id) ?? c.series[2]) : c.series[2]} 0 4px, transparent 4px 7px)`
                      : r.role === "CURRENT_REMOVED"
                        ? c.muted
                        : (routeColor.get(r.route_id ?? -1) ?? c.series[1]),
                  height: 3,
                }}
              />
              {r.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line">
        <Map markers={markers} polylines={polylines} height="380px" autoFit />
      </div>
      <p className="text-xs text-fg-muted">{t("legend")}</p>
    </div>
  );
}
