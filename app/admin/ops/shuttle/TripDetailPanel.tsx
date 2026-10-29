"use client";

import { AlertTriangle, Building2, Check, CheckCheck, CheckCircle2, Clock, Gauge, Phone, Radio, Users, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOfficeStops, isOfficeStop } from "@/app/lib/utils/routeStops";
import { Badge, Button, Card, EmptyState, IconButton, Skeleton, StatusBadge, type BadgeTone, type StatusEntry } from "@/app/admin/ui";
import { formatTime, initials } from "@/app/admin/lib/format";
import { currentStopIndex, isLive, stopEta, type ShuttleTrip, type TripHealth } from "./fleet";

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
    return { text: `Dropped ${formatTime(boarding.drop_off_at)}`, tone: "info", icon: <CheckCheck className={iconCls} aria-hidden="true" /> };
  }
  if (boarding?.scanned_at) {
    return { text: `Boarded ${formatTime(boarding.scanned_at)}`, tone: "success", icon: <CheckCircle2 className={iconCls} aria-hidden="true" /> };
  }
  return { text: "Waiting", tone: "neutral", icon: <Clock className={iconCls} aria-hidden="true" /> };
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

type TripDetailPanelProps = {
  trip: ShuttleTrip;
  employees: TripEmployee[];
  loading: boolean;
  health: TripHealth;
  companyName?: string | null;
  /** Live socket state for this trip. */
  live: { connected: boolean; speedKmh: number | null; lastSeen: string | null };
  liveStopName?: string | null;
  liveNextStopName?: string | null;
  /** Actions pinned to the bottom (e.g. Force end). */
  footer?: React.ReactNode;
  onClose?: () => void;
  /** Render without the card chrome (inside a Drawer). */
  flush?: boolean;
  className?: string;
};

function SectionLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <p className="text-xs font-medium text-fg-muted">{children}</p>
      {aside}
    </div>
  );
}

export function TripDetailPanel({
  trip,
  employees,
  loading,
  health,
  companyName,
  live,
  liveStopName,
  liveNextStopName,
  footer,
  onClose,
  flush = false,
  className,
}: TripDetailPanelProps) {
  const stops = trip.routes?.route_stops ?? [];
  const currentIdx = currentStopIndex(trip);
  // A stop is passed once the driver has left it (or arrived at a later one).
  const passedBefore = currentIdx < 0 ? 0 : trip.current_stop_status === "EN_ROUTE" ? currentIdx + 1 : currentIdx;
  const counts = occupancyCounts(employees);
  const vehicle = trip.routes?.vehicles;
  const driver = trip.users;
  const hasMultipleOffices = getOfficeStops(stops).length > 1;
  const active = isLive(trip.status);
  const nowStop = liveStopName || (currentIdx >= 0 ? stops[currentIdx]?.name : null);

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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={trip.direction === "MORNING" ? "warning" : "purple"} size="sm">
                {trip.direction === "MORNING" ? "Morning" : "Evening"}
              </Badge>
              <StatusBadge status={trip.status} size="sm" overrides={SHUTTLE_STATUS_OVERRIDES} />
            </div>
            <h3 className="truncate text-base font-semibold leading-tight text-fg">{trip.routes?.name ?? `Trip #${trip.id}`}</h3>
            <p className="mt-0.5 truncate text-xs text-fg-muted">
              {companyName && <>{companyName} · </>}
              {vehicle?.model && <>{vehicle.model} · </>}
              <span className="font-mono">{vehicle?.plate_number ?? "No vehicle"}</span>
            </p>
          </div>
          {onClose && (
            <IconButton label="Close trip details" size="icon-xs" onClick={onClose}>
              <X />
            </IconButton>
          )}
        </div>

        {/* Driver */}
        <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-line bg-subtle px-3 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink" aria-hidden="true">
            {initials(driver?.full_name ?? "?")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-fg">{driver?.full_name ?? "Driver not assigned"}</div>
            {driver?.phone && <div className="truncate font-mono text-xs text-fg-muted">{driver.phone}</div>}
          </div>
          {driver?.phone && (
            <Button asChild variant="outline" size="sm" leftIcon={<Phone />}>
              <a href={`tel:${driver.phone}`}>
                <Phone />
                Call
              </a>
            </Button>
          )}
        </div>

        {health.issues.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {health.issues.map((issue) => (
              <li key={issue.kind} className="flex items-center gap-2 rounded-lg border border-warning-line bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning-ink">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                {issue.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Live strip */}
      {active && (
        <div className="grid shrink-0 grid-cols-3 divide-x divide-line border-b border-line text-center">
          <div className="px-2 py-2.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-fg-muted">
              <Radio className={cn("size-3", live.connected ? "text-success-ink" : "text-fg-muted")} aria-hidden="true" />
              Signal
            </div>
            <div className={cn("mt-0.5 text-sm font-semibold", live.connected ? "text-success-ink" : "text-fg-muted")}>
              {live.connected ? "Live" : "Connecting"}
            </div>
          </div>
          <div className="px-2 py-2.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-fg-muted">
              <Gauge className="size-3" aria-hidden="true" />
              Speed
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-fg">{live.speedKmh != null ? `${live.speedKmh} km/h` : "—"}</div>
          </div>
          <div className="px-2 py-2.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-fg-muted">
              <Clock className="size-3" aria-hidden="true" />
              Last fix
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-fg">{live.lastSeen ?? "—"}</div>
          </div>
        </div>
      )}

      {/* Passengers */}
      <div className="shrink-0 border-b border-line px-4 py-3">
        <SectionLabel aside={<span className="text-sm font-semibold tabular-nums text-fg">{loading ? "…" : counts.total}</span>}>Passengers</SectionLabel>
        <ul className="grid grid-cols-4 gap-1.5 text-center">
          {[
            { label: "Boarded", value: counts.boarded, cls: "text-success-ink" },
            { label: "Waiting", value: counts.pending, cls: "text-fg" },
            { label: "Absent", value: counts.absent, cls: "text-danger-ink" },
            { label: "Dropped", value: counts.droppedOff, cls: "text-info-ink" },
          ].map((c) => (
            <li key={c.label} className="rounded-lg bg-subtle px-1 py-1.5">
              <div className={cn("text-base font-semibold tabular-nums", c.cls)}>{loading ? "–" : c.value}</div>
              <div className="text-[11px] text-fg-muted">{c.label}</div>
            </li>
          ))}
        </ul>
      </div>

      {/* Stop progress */}
      {stops.length > 0 && (
        <div className="shrink-0 border-b border-line px-4 py-3">
          <SectionLabel
            aside={
              nowStop ? (
                <span className="truncate text-xs text-fg-secondary">
                  {trip.current_stop_status === "EN_ROUTE" && liveNextStopName ? `→ ${liveNextStopName}` : `At ${nowStop}`}
                </span>
              ) : undefined
            }
          >
            Stops · {Math.min(passedBefore, stops.length)}/{stops.length} done
          </SectionLabel>
          <ol>
            {stops.map((stop, idx) => {
              const isCurrent = idx === currentIdx && trip.current_stop_status !== "EN_ROUTE";
              const isPassed = idx < passedBefore || trip.status === "COMPLETED";
              const isOffice = isOfficeStop(stop);
              const eta = stopEta(trip, stop);
              const isLast = idx === stops.length - 1;
              return (
                <li key={stop.id} aria-current={isCurrent ? "step" : undefined} className="flex gap-2.5">
                  <div className="flex w-5 shrink-0 flex-col items-center">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                        isCurrent
                          ? "bg-brand text-white ring-4 ring-brand-soft"
                          : isPassed
                            ? "bg-success-soft text-success-ink"
                            : "border border-line bg-card text-fg-muted",
                      )}
                      aria-hidden="true"
                    >
                      {isPassed && !isCurrent ? <Check className="size-3" /> : isOffice ? <Building2 className="size-3" /> : idx + 1}
                    </span>
                    {!isLast && <span className={cn("my-0.5 w-px flex-1", isPassed ? "bg-success-line" : "bg-line")} aria-hidden="true" />}
                  </div>
                  <div className={cn("flex min-w-0 flex-1 items-start justify-between gap-2 pb-2.5 text-xs", isPassed && !isCurrent ? "text-fg-muted" : "text-fg")}>
                    <span className={cn("truncate pt-0.5", isCurrent && "font-semibold")}>{stop.name}</span>
                    {eta && <span className="shrink-0 pt-0.5 tabular-nums text-fg-muted">{formatTime(eta)}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Employee list */}
      <div className="shrink-0 px-4 py-3">
        <SectionLabel>Riders</SectionLabel>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <Skeleton className="size-7 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-2.5 w-3/4" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : employees.length === 0 ? (
          <EmptyState compact icon={<Users aria-hidden="true" />} title="No riders on this trip" />
        ) : (
          employeeGroups.map((group) => (
            <div key={group.officeName ?? "all"}>
              {group.officeName && (
                <div className="flex items-center gap-1.5 pb-1 pt-2 first:pt-0">
                  <Building2 className="size-3 text-fg-muted" aria-hidden="true" />
                  <span className="text-xs font-semibold text-fg-secondary">{group.officeName}</span>
                  <span className="text-xs text-fg-muted">({group.employees.length})</span>
                </div>
              )}
              <ul className="divide-y divide-line">
                {group.employees.map((emp) => {
                  const state = boardingState(emp);
                  const name = emp.users?.full_name ?? "Unknown";
                  return (
                    <li key={emp.user_id} className="flex items-center gap-2.5 py-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand-ink" aria-hidden="true">
                        {initials(name, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-fg">{name}</div>
                        {emp.route_stops?.name && <div className="truncate text-[11px] text-fg-muted">{emp.route_stops.name}</div>}
                      </div>
                      <Badge tone={state.tone} size="sm" icon={state.icon}>
                        {state.text}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </>
  );

  if (flush) return <div className={cn("flex flex-col", className)}>{body}</div>;
  return (
    <Card className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
      {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
    </Card>
  );
}
