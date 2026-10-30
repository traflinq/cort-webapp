import { BUSINESS_TZ } from "../admin/lib/format";

/** Today's date (YYYY-MM-DD) in the business timezone. */
export function todayISO(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(d);
}

/** Decodes a Google encoded polyline into [lat, lng] pairs. */
export function decodePolyline(encoded: string | null | undefined): [number, number][] {
  if (!encoded) return [];
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export const isLiveStatus = (status: string | null | undefined) => status === "STARTED" || status === "IN_PROGRESS";

export const vehicleLabel = (v: { plate_number: string; make?: string | null; model?: string | null } | null | undefined) =>
  v ? `${v.plate_number}${v.make || v.model ? ` · ${[v.make, v.model].filter(Boolean).join(" ")}` : ""}` : "—";

export const errorMessage = (err: unknown, fallback = "Something went wrong") =>
  err instanceof Error ? err.message : fallback;
