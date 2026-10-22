import type { BadgeTone } from "@/app/ui";

export type CompanyRouteStop = {
  id: number;
  route_id: number;
  name: string;
  sequence_order: number;
  morning_sequence?: number | null;
  evening_sequence?: number | null;
  morning_eta?: string | null;
  evening_eta?: string | null;
  lat?: number | null;
  lng?: number | null;
  stop_type?: "PICKUP" | "OFFICE";
};

export type StopDirection = "MORNING" | "EVENING" | "BOTH";
export type RouteDirection = "MORNING" | "EVENING";

export function deriveDirection(stop: CompanyRouteStop): StopDirection {
  if (stop.morning_sequence != null && stop.evening_sequence != null) return "BOTH";
  if (stop.morning_sequence != null) return "MORNING";
  if (stop.evening_sequence != null) return "EVENING";
  return "BOTH";
}

/** Stops that run in the given direction, in sequence order. */
export function stopsForDirection<T extends CompanyRouteStop>(stops: T[], direction: RouteDirection): T[] {
  const key = direction === "MORNING" ? "morning_sequence" : "evening_sequence";
  return stops.filter((s) => s[key] != null).sort((a, b) => (a[key] ?? 0) - (b[key] ?? 0));
}

/** "08:05:00" / ISO timestamp → "08:05" for <input type="time">. */
export function toClockHHmm(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const trimmed = String(timeStr).trim();
  const hhmm = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (hhmm) {
    const hour = Number.parseInt(hhmm[1], 10);
    if (!Number.isNaN(hour) && hour >= 0 && hour <= 23) return `${String(hour).padStart(2, "0")}:${hhmm[2]}`;
  }
  try {
    const date = new Date(trimmed.includes("T") ? trimmed : `1970-01-01T${trimmed}Z`);
    if (Number.isNaN(date.getTime())) return trimmed;
    return date.toISOString().substring(11, 16);
  } catch {
    return trimmed;
  }
}

/** AI recommendation confidence → badge tone. */
export function confidenceTone(confidence: string | null | undefined): BadgeTone {
  switch (confidence) {
    case "High":
      return "success";
    case "Medium":
      return "warning";
    default:
      return "danger";
  }
}

export type AiRecommendation = {
  routeId: number | null;
  routeName: string;
  reason: string;
  confidence: "High" | "Medium" | "Low";
  alternativeRoutes: { id: number; name: string; reason: string }[];
};
