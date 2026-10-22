"use client";

import { useMemo } from "react";
import { usePortalTheme } from "./lib/theme-context";

/**
 * Chart colours, validated with the dataviz palette validator for each surface
 * (lightness band, chroma floor, CVD separation ≥ 8, normal-vision ≥ 15).
 * Assign series in fixed order; never cycle past 6 — fold extra series into "Other".
 */
export const CHART_COLORS_LIGHT = ["#e5700a", "#2a78d6", "#1baf7a", "#6250d6", "#e87ba4", "#eda100"] as const;
export const CHART_COLORS_DARK = ["#d97316", "#3987e5", "#199e70", "#9085e9", "#d55181", "#c98500"] as const;

export type ChartTheme = {
  colors: readonly string[];
  grid: string;
  axis: string;
  text: string;
  mutedText: string;
  surface: string;
  tooltipBg: string;
  tooltipBorder: string;
  /** Status colours — reserved, never used as series. */
  status: { good: string; warning: string; bad: string; info: string };
};

export function useChartTheme(): ChartTheme {
  const { theme } = usePortalTheme();
  return useMemo<ChartTheme>(
    () =>
      theme === "dark"
        ? {
            colors: CHART_COLORS_DARK,
            grid: "rgba(255,255,255,0.06)",
            axis: "rgba(237,237,239,0.42)",
            text: "#ededef",
            mutedText: "rgba(237,237,239,0.58)",
            surface: "#121214",
            tooltipBg: "#1a1a1e",
            tooltipBorder: "rgba(255,255,255,0.14)",
            status: { good: "#10b981", warning: "#f59e0b", bad: "#ef4444", info: "#3b82f6" },
          }
        : {
            colors: CHART_COLORS_LIGHT,
            grid: "rgba(15,23,42,0.07)",
            axis: "rgba(15,23,42,0.45)",
            text: "#0f172a",
            mutedText: "rgba(15,23,42,0.55)",
            surface: "#ffffff",
            tooltipBg: "#ffffff",
            tooltipBorder: "rgba(15,23,42,0.12)",
            status: { good: "#059669", warning: "#d97706", bad: "#dc2626", info: "#2563eb" },
          },
    [theme],
  );
}

/** Recharts axis defaults: recessive, no tick/axis lines. */
export function axisProps(t: ChartTheme) {
  return {
    tickLine: false,
    axisLine: false,
    tick: { fill: t.mutedText, fontSize: 11 },
    stroke: t.axis,
  } as const;
}

export function gridProps(t: ChartTheme) {
  return { stroke: t.grid, strokeDasharray: "0", vertical: false } as const;
}
