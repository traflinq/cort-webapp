"use client";

import { useMemo } from "react";
import { useAdminTheme } from "../lib/theme-context";

/**
 * Chart colours, validated with the dataviz palette validator for each surface
 * (lightness band, chroma floor, CVD separation ≥ 8, normal-vision ≥ 15).
 * Assign series in fixed order; never cycle past 6 — fold extra series into "Other".
 */
// Same series as the company portal (app/company/analytics/cost/charts.tsx and --chart-* in globals.css).
export const CHART_COLORS_LIGHT = ["#e2622a", "#6e7ff0", "#2a9f59", "#9b4fc4", "#c08400", "#de5c97"] as const;
export const CHART_COLORS_DARK = ["#e8692e", "#7d8cf5", "#38b56a", "#b072e0", "#c08e12", "#e26a9f"] as const;

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
  const { theme } = useAdminTheme();
  return useMemo<ChartTheme>(
    () =>
      theme === "dark"
        ? {
            colors: CHART_COLORS_DARK,
            grid: "rgba(255,255,255,0.06)",
            axis: "rgba(237,237,237,0.50)",
            text: "#ededed",
            mutedText: "rgba(237,237,237,0.55)",
            surface: "#141414",
            tooltipBg: "#1c1c1c",
            tooltipBorder: "rgba(255,255,255,0.14)",
            status: { good: "#38b56a", warning: "#c08e12", bad: "#e5484d", info: "#7d8cf5" },
          }
        : {
            colors: CHART_COLORS_LIGHT,
            grid: "rgba(24,24,27,0.07)",
            axis: "rgba(24,24,27,0.50)",
            text: "#18181b",
            mutedText: "#63636b",
            surface: "#ffffff",
            tooltipBg: "#ffffff",
            tooltipBorder: "rgba(24,24,27,0.15)",
            status: { good: "#2a9f59", warning: "#c08400", bad: "#e5484d", info: "#6e7ff0" },
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
