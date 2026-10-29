import { BUSINESS_TZ, formatTime } from "@/app/admin/lib/format";

// ---- Types ----------------------------------------------------------------

export type FleetStop = {
  id: number;
  name: string;
  sequence_order: number;
  morning_eta: string | null;
  evening_eta: string | null;
  lat: number | null;
  lng: number | null;
  stop_type?: "PICKUP" | "OFFICE";
};

export type ShuttleTrip = {
  id: number;
  direction: "MORNING" | "EVENING";
  status: string;
  started_at: string | null;
  completed_at: string | null;
  current_stop_id: number | null;
  current_stop_status?: string | null;
  /** Last-known driver GPS fix (Redis), present for STARTED/IN_PROGRESS trips. ts is Unix ms. */
  last_lat?: number | null;
  last_lng?: number | null;
  last_location_ts?: number | null;
  /** Driver (staff-only field on /shuttle-trips/today). */
  users?: { id: string; full_name: string | null; phone: string | null } | null;
  routes?: {
    id: number;
    name: string;
    company_id?: number | null;
    vehicles?: { id: number; plate_number: string; model: string | null } | null;
    /** Direction-filtered and ordered server-side. Evening excludes the starting office stop. */
    route_stops?: FleetStop[];
    office_stop?: { id: number; name: string; morning_eta: string | null; evening_eta: string | null } | null;
    _count?: { employee_route_assignments?: number };
  } | null;
};

/** Row of /shuttle-trips/live-positions — the cheap fleet poll. */
export type LivePosition = Pick<
  ShuttleTrip,
  "id" | "status" | "current_stop_id" | "current_stop_status" | "started_at" | "completed_at" | "last_lat" | "last_lng" | "last_location_ts"
>;

// ---- Status helpers ------------------------------------------------------

export const isLive = (status: string) => status === "STARTED" || status === "IN_PROGRESS";
export const isDone = (status: string) => status === "COMPLETED";
export const isScheduled = (status: string) => status === "SCHEDULED";

/** No GPS fix for this long on a live trip counts as "signal lost". */
export const STALE_GPS_MS = 2 * 60_000;
/** Minutes past a stop's scheduled time before a trip is flagged as behind. */
const LATE_AFTER_MIN = 10;
/** Minutes past the first scheduled time before an unstarted trip is flagged. */
const NOT_STARTED_AFTER_MIN = 5;

const pktClock = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Minutes since midnight in business time (stop ETAs are stored as PKT "HH:MM"). */
export function pktMinutesNow(now: number): number {
  const [h, m] = pktClock.format(now).split(":").map(Number);
  return h * 60 + m;
}

function etaMinutes(eta: string | null | undefined): number | null {
  const m = eta ? /^(\d{1,2}):(\d{2})/.exec(eta) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export const stopEta = (trip: ShuttleTrip, stop: Pick<FleetStop, "morning_eta" | "evening_eta">) =>
  trip.direction === "MORNING" ? stop.morning_eta : stop.evening_eta;

/** Scheduled departure: first pickup (morning) or the office (evening). */
function firstEta(trip: ShuttleTrip): string | null {
  if (trip.direction === "EVENING" && trip.routes?.office_stop) return trip.routes.office_stop.evening_eta;
  const first = trip.routes?.route_stops?.[0];
  return first ? stopEta(trip, first) : null;
}

/** Index of the current stop in the trip's ordered stops, or -1 before the first arrival. */
export function currentStopIndex(trip: ShuttleTrip): number {
  const stops = trip.routes?.route_stops ?? [];
  return trip.current_stop_id == null ? -1 : stops.findIndex((s) => s.id === trip.current_stop_id);
}

/** The stop the driver is heading to (or standing at), with its scheduled time. */
export function nextStop(trip: ShuttleTrip): FleetStop | null {
  const stops = trip.routes?.route_stops ?? [];
  const idx = currentStopIndex(trip);
  if (idx < 0) return trip.current_stop_id == null ? stops[0] ?? null : null;
  return trip.current_stop_status === "EN_ROUTE" ? stops[idx + 1] ?? null : stops[idx] ?? null;
}

// ---- Health ---------------------------------------------------------------

export type IssueKind = "gps" | "not_started" | "late";
export type TripIssue = { kind: IssueKind; label: string };

export type TripHealth = {
  issues: TripIssue[];
  /** Minutes behind schedule at the next stop (live trips only). */
  lateMin: number | null;
  /** Age of the last GPS fix in ms (live trips only). */
  gpsAgeMs: number | null;
};

const ISSUE_RANK: Record<IssueKind, number> = { gps: 0, not_started: 1, late: 2 };

export function tripHealth(trip: ShuttleTrip, now: number, nowMin: number): TripHealth {
  const issues: TripIssue[] = [];
  let lateMin: number | null = null;
  let gpsAgeMs: number | null = null;

  if (isLive(trip.status)) {
    gpsAgeMs = trip.last_location_ts ? now - trip.last_location_ts : null;
    if (gpsAgeMs == null) issues.push({ kind: "gps", label: "No GPS yet" });
    else if (gpsAgeMs > STALE_GPS_MS) issues.push({ kind: "gps", label: `No GPS for ${Math.round(gpsAgeMs / 60_000)} min` });

    const target = nextStop(trip);
    const eta = etaMinutes(target ? stopEta(trip, target) : null);
    if (eta != null && nowMin - eta > LATE_AFTER_MIN) {
      lateMin = nowMin - eta;
      issues.push({ kind: "late", label: `${lateMin} min behind` });
    }
  } else if (isScheduled(trip.status)) {
    const dueEta = firstEta(trip);
    const due = etaMinutes(dueEta);
    if (due != null && nowMin - due > NOT_STARTED_AFTER_MIN) {
      issues.push({ kind: "not_started", label: `Not started · due ${formatTime(dueEta!)}` });
    }
  }

  issues.sort((a, b) => ISSUE_RANK[a.kind] - ISSUE_RANK[b.kind]);
  return { issues, lateMin, gpsAgeMs };
}

/** Sort key: problems first, then live, then upcoming by departure time, then finished. */
export function urgencyRank(trip: ShuttleTrip, health: TripHealth): [number, number] {
  if (health.issues.length) return [0, ISSUE_RANK[health.issues[0].kind] * 1000 - (health.lateMin ?? 0)];
  if (isLive(trip.status)) return [1, 0];
  if (isScheduled(trip.status)) return [2, etaMinutes(firstEta(trip)) ?? 9999];
  return [3, 0];
}

// ---- Merging the cheap poll into full trips --------------------------------

/**
 * Applies a live-positions poll to the loaded trips. Unchanged trips keep their object identity
 * (so memoised rows don't re-render). `needsFullReload` is true when the set of trips changed
 * (a trip was generated or cancelled) and only the full endpoint can supply the new rows.
 */
export function mergePositions(trips: ShuttleTrip[], positions: LivePosition[]): { trips: ShuttleTrip[]; needsFullReload: boolean } {
  const byId = new Map(positions.map((p) => [p.id, p]));
  let changed = false;
  const next = trips.map((t) => {
    const p = byId.get(t.id);
    if (!p) return t;
    if (
      p.status === t.status &&
      p.current_stop_id === t.current_stop_id &&
      p.current_stop_status === (t.current_stop_status ?? null) &&
      p.last_location_ts === (t.last_location_ts ?? null) &&
      p.completed_at === t.completed_at
    ) {
      return t;
    }
    changed = true;
    return { ...t, ...p };
  });
  const known = new Set(trips.map((t) => t.id));
  const needsFullReload = positions.length !== trips.length || positions.some((p) => !known.has(p.id));
  return { trips: changed ? next : trips, needsFullReload };
}
