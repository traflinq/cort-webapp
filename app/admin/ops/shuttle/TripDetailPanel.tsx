"use client";

import { Building2, CheckCheck, CheckCircle2, Clock, MapPin, Users, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOfficeStops, isOfficeStop } from "@/app/lib/utils/routeStops";
import { Badge, Card, EmptyState, Skeleton, StatusBadge, type BadgeTone, type StatusEntry } from "@/app/admin/ui";
import { formatTime, initials } from "@/app/admin/lib/format";

export type TripEmployee = {
  /** Assignment row id — not always present on the trip employees payload. */
  id?: number;
  user_id: string;
  users?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    department: string | null;
  } | null;
  route_stops?: {
    id: number;
    name: string;
    sequence_order: number | null;
    morning_sequence: number | null;
    evening_sequence: number | null;
  } | null;
  /** The assigned office stop — populated when the route has multiple OFFICE-type stops. */
  office_route_stops?: {
    id?: number;
    name: string;
  } | null;
  boarding?: {
    employee_id: string;
    scanned_at: string | null;
    status: string | null;
    drop_off_at: string | null;
  } | null;
};

export type TripDetailStop = {
  id: number;
  name: string;
  sequence_order: number;
  morning_eta: string | null;
  evening_eta: string | null;
  /** 'PICKUP' | 'OFFICE' — defaults to 'PICKUP' server-side. */
  stop_type?: "PICKUP" | "OFFICE";
};

export type TripDetailTrip = {
  id: number;
  direction: "MORNING" | "EVENING";
  status: string;
  started_at: string | null;
  current_stop_id: number | null;
  current_stop_status?: string | null;
  routes?: {
    id: number;
    name: string;
    vehicles?: { id: number; plate_number: string; model: string | null } | null;
    route_stops?: TripDetailStop[];
    _count?: { employee_route_assignments?: number };
  } | null;
};

/** Shuttle-trip status keys the shared registry doesn't know. */
export const SHUTTLE_STATUS_OVERRIDES: Record<string, StatusEntry> = {
  STARTED: { tone: "info", label: "Started" },
  AT_STOP: { tone: "brand", label: "At stop" },
};

type BoardingState = { text: string; tone: BadgeTone; icon: React.ReactNode };

function boardingState(emp: TripEmployee): BoardingState {
  const boarding = emp.boarding;
  const iconCls = "size-3";
  if (boarding?.status === "ABSENT") {
    return { text: "Absent", tone: "danger", icon: <XCircle className={iconCls} aria-hidden="true" /> };
  }
  if (boarding?.drop_off_at) {
    return { text: `Dropped off ${formatTime(boarding.drop_off_at)}`, tone: "info", icon: <CheckCheck className={iconCls} aria-hidden="true" /> };
  }
  if (boarding?.scanned_at) {
    return { text: `Boarded ${formatTime(boarding.scanned_at)}`, tone: "success", icon: <CheckCircle2 className={iconCls} aria-hidden="true" /> };
  }
  return { text: "Not yet boarded", tone: "neutral", icon: <Clock className={iconCls} aria-hidden="true" /> };
}

export function occupancyCounts(employees: TripEmployee[]) {
  let boarded = 0;
  let absent = 0;
  let droppedOff = 0;
  let pending = 0;
  for (const emp of employees) {
    const b = emp.boarding;
    if (b?.status === "ABSENT") {
      absent += 1;
    } else if (b?.drop_off_at) {
      droppedOff += 1;
    } else if (b?.scanned_at) {
      boarded += 1;
    } else {
      pending += 1;
    }
  }
  return { boarded, absent, droppedOff, pending, total: employees.length };
}

function isActiveStatus(status: string) {
  return status === "STARTED" || status === "IN_PROGRESS";
}

type TripDetailPanelProps = {
  trip: TripDetailTrip;
  employees: TripEmployee[];
  loading: boolean;
  liveStopName?: string | null;
  liveNextStopName?: string | null;
  /** Render without the card chrome (inside a Drawer). */
  flush?: boolean;
  className?: string;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{children}</p>;
}

export function TripDetailPanel({ trip, employees, loading, liveStopName, liveNextStopName, flush = false, className }: TripDetailPanelProps) {
  const stops = trip.routes?.route_stops ?? [];
  const currentStop = stops.find((s) => s.id === trip.current_stop_id) ?? null;
  const currentStopName = liveStopName || currentStop?.name || null;
  const stopStatus = trip.current_stop_status ?? null;
  const counts = occupancyCounts(employees);
  const vehicle = trip.routes?.vehicles;
  const vehicleLabel = [vehicle?.model, vehicle?.plate_number].filter(Boolean).join(" · ") || "—";
  const officeStops = getOfficeStops(stops);
  const hasMultipleOffices = officeStops.length > 1;

  // Group employees by their assigned office when the route serves more than one.
  const employeeGroups: { officeName: string | null; employees: TripEmployee[] }[] = hasMultipleOffices
    ? (() => {
        const byOffice = new Map<string, TripEmployee[]>();
        for (const emp of employees) {
          const officeName = emp.office_route_stops?.name ?? "Unassigned office";
          if (!byOffice.has(officeName)) byOffice.set(officeName, []);
          byOffice.get(officeName)!.push(emp);
        }
        return Array.from(byOffice.entries()).map(([officeName, emps]) => ({ officeName, employees: emps }));
      })()
    : [{ officeName: null, employees }];

  const body = (
    <>
      {/* Header */}
      <div className="shrink-0 border-b border-line p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={trip.direction === "MORNING" ? "warning" : "purple"} size="sm">
            {trip.direction === "MORNING" ? "Morning" : "Evening"}
          </Badge>
          <StatusBadge status={trip.status} size="sm" overrides={SHUTTLE_STATUS_OVERRIDES} />
          {stopStatus && <StatusBadge status={stopStatus} size="sm" overrides={SHUTTLE_STATUS_OVERRIDES} />}
        </div>
        <h3 className="text-sm font-semibold leading-tight text-fg">{trip.routes?.name ?? `Trip #${trip.id}`}</h3>
        <p className="mt-0.5 font-mono text-xs text-fg-muted">{vehicleLabel}</p>
        {trip.started_at && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-fg-muted">
            <Clock className="size-3" aria-hidden="true" />
            Started {formatTime(trip.started_at)}
          </p>
        )}
      </div>

      {/* Current stop */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <MapPin className="size-3.5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <SectionLabel>Current stop</SectionLabel>
          <div className="truncate text-sm font-semibold text-fg">{currentStopName ?? (isActiveStatus(trip.status) ? "Not arrived yet" : "—")}</div>
          {liveNextStopName && stopStatus === "EN_ROUTE" && <div className="mt-0.5 text-[11px] text-fg-muted">Next: {liveNextStopName}</div>}
        </div>
      </div>

      {/* Occupancy */}
      <div className="shrink-0 border-b border-line px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-3.5 text-fg-muted" aria-hidden="true" />
            <SectionLabel>Passengers</SectionLabel>
          </div>
          <span className="text-sm font-semibold tabular-nums text-fg">{loading ? "…" : counts.total}</span>
        </div>
        {!loading && counts.total > 0 && (
          <ul className="grid grid-cols-2 gap-1.5 text-[11px] font-medium">
            <li className="flex items-center gap-1 text-success-ink">
              <CheckCircle2 className="size-3" aria-hidden="true" /> Boarded {counts.boarded}
            </li>
            <li className="flex items-center gap-1 text-danger-ink">
              <XCircle className="size-3" aria-hidden="true" /> Absent {counts.absent}
            </li>
            <li className="flex items-center gap-1 text-info-ink">
              <CheckCheck className="size-3" aria-hidden="true" /> Dropped {counts.droppedOff}
            </li>
            <li className="flex items-center gap-1 text-fg-muted">
              <Clock className="size-3" aria-hidden="true" /> Pending {counts.pending}
            </li>
          </ul>
        )}
      </div>

      {/* Stop progress */}
      {stops.length > 0 && (
        <div className="shrink-0 border-b border-line px-4 py-3">
          <SectionLabel>Stop progress</SectionLabel>
          <ol className="mt-2 space-y-1">
            {stops.map((stop, idx) => {
              const isCurrent = stop.id === trip.current_stop_id;
              const isOffice = isOfficeStop(stop);
              const etaRaw = trip.direction === "MORNING" ? stop.morning_eta : stop.evening_eta;
              const eta = etaRaw ? formatTime(etaRaw) : null;
              return (
                <li
                  key={stop.id}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs", isCurrent ? "bg-brand-soft font-semibold text-brand-ink" : "text-fg-secondary")}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      isCurrent ? "bg-brand text-white" : isOffice ? "bg-danger-soft text-danger-ink" : "bg-subtle text-fg-muted",
                    )}
                  >
                    {isOffice ? <Building2 className="size-3" aria-hidden="true" /> : idx + 1}
                  </span>
                  <span className="flex-1 truncate">{stop.name}</span>
                  {isOffice && (
                    <Badge tone="danger" size="sm">
                      Office
                    </Badge>
                  )}
                  {eta && <span className="shrink-0 font-mono text-[10px] text-fg-muted">{eta}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Employee list */}
      <div className="shrink-0">
        <div className="border-b border-line bg-subtle px-4 py-2.5">
          <SectionLabel>Assigned employees</SectionLabel>
        </div>
        <div className="space-y-2 p-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-subtle p-2.5">
                <Skeleton className="size-7 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-2.5 w-3/4" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              </div>
            ))
          ) : employees.length === 0 ? (
            <EmptyState compact icon={<Users aria-hidden="true" />} title="No employees assigned" />
          ) : (
            employeeGroups.map((group) => (
              <div key={group.officeName ?? "all"} className="space-y-2">
                {group.officeName && (
                  <div className="flex items-center gap-1.5 px-0.5 pt-1 first:pt-0">
                    <Building2 className="size-3 text-danger-ink" aria-hidden="true" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-danger-ink">{group.officeName}</span>
                    <span className="text-[11px] text-fg-muted">({group.employees.length})</span>
                  </div>
                )}
                {group.employees.map((emp) => {
                  const state = boardingState(emp);
                  const name = emp.users?.full_name ?? "Unknown";
                  return (
                    <div key={emp.user_id} className="flex items-center gap-3 rounded-lg border border-line bg-subtle p-2.5">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                        <span className="text-[10px] font-semibold text-brand-ink">{initials(name, 1)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-fg">{name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {emp.route_stops?.name && (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-fg-secondary">
                              <MapPin className="size-2.5" aria-hidden="true" />
                              {emp.route_stops.name}
                            </span>
                          )}
                          {emp.users?.department && <span className="truncate text-[10px] text-fg-muted">{emp.users.department}</span>}
                        </div>
                        <Badge tone={state.tone} size="sm" icon={state.icon} className="mt-1">
                          {state.text}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  if (flush) return <div className={cn("flex flex-col", className)}>{body}</div>;
  return <Card className={cn("flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain", className)}>{body}</Card>;
}
