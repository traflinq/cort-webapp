'use client';

import { Building2, Clock, MapPin, Users } from 'lucide-react';
import { Card } from '@/app/admin/ui/Card';
import { getOfficeStops, isOfficeStop } from '@/app/lib/utils/routeStops';
import { formatEtaTime12h, formatPktTime12h } from '@/app/lib/utils';

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
  stop_type?: 'PICKUP' | 'OFFICE';
};

export type TripDetailTrip = {
  id: number;
  direction: 'MORNING' | 'EVENING';
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

function formatTime(iso: string | null | undefined) {
  return formatPktTime12h(iso);
}

function boardingLabel(emp: TripEmployee) {
  const boarding = emp.boarding;
  if (boarding?.status === 'ABSENT') {
    return { text: 'Absent', className: 'text-red-600' };
  }
  const dropOffAt = formatTime(boarding?.drop_off_at);
  if (dropOffAt) {
    return { text: `Dropped off ${dropOffAt}`, className: 'text-sky-600' };
  }
  const boardedAt = formatTime(boarding?.scanned_at);
  if (boardedAt) {
    return { text: `Boarded ${boardedAt}`, className: 'text-emerald-600' };
  }
  return { text: 'Not yet boarded', className: 'text-gray-400' };
}

export function occupancyCounts(employees: TripEmployee[]) {
  let boarded = 0;
  let absent = 0;
  let droppedOff = 0;
  let pending = 0;
  for (const emp of employees) {
    const b = emp.boarding;
    if (b?.status === 'ABSENT') {
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
  trip: TripDetailTrip;
  employees: TripEmployee[];
  loading: boolean;
  liveStopName?: string | null;
  liveNextStopName?: string | null;
};

export function TripDetailPanel({
  trip,
  employees,
  loading,
  liveStopName,
  liveNextStopName,
}: TripDetailPanelProps) {
  const stops = trip.routes?.route_stops ?? [];
  const currentStop =
    stops.find((s) => s.id === trip.current_stop_id) ?? null;
  const currentStopName = liveStopName || currentStop?.name || null;
  const stopStatus = trip.current_stop_status ?? null;
  const counts = occupancyCounts(employees);
  const vehicle = trip.routes?.vehicles;
  const vehicleLabel = [vehicle?.model, vehicle?.plate_number].filter(Boolean).join(' · ') || '—';
  const officeStops = getOfficeStops(stops);
  const hasMultipleOffices = officeStops.length > 1;

  // Group employees by their assigned office when the route serves more than one.
  const employeeGroups: { officeName: string | null; employees: TripEmployee[] }[] = hasMultipleOffices
    ? (() => {
        const byOffice = new Map<string, TripEmployee[]>();
        for (const emp of employees) {
          const officeName = emp.office_route_stops?.name ?? 'Unassigned office';
          if (!byOffice.has(officeName)) byOffice.set(officeName, []);
          byOffice.get(officeName)!.push(emp);
        }
        return Array.from(byOffice.entries()).map(([officeName, emps]) => ({ officeName, employees: emps }));
      })()
    : [{ officeName: null, employees }];

  return (
    <Card className="flex flex-col h-full min-h-0 overflow-y-auto overscroll-contain p-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              trip.direction === 'MORNING'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}
          >
            {trip.direction === 'MORNING' ? 'Morning' : 'Evening'}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            {trip.status}
          </span>
          {stopStatus && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200">
              {stopStatus === 'AT_STOP' ? 'At stop' : stopStatus === 'EN_ROUTE' ? 'En route' : stopStatus}
            </span>
          )}
        </div>
        <h3 className="text-sm font-bold text-gray-900 leading-tight">
          {trip.routes?.name ?? `Trip #${trip.id}`}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">{vehicleLabel}</p>
        {trip.started_at && (
          <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1 font-medium">
            <Clock className="w-3 h-3" />
            Started {formatTime(trip.started_at)}
          </p>
        )}
      </div>

      {/* Current stop */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
          <MapPin className="w-3.5 h-3.5 text-orange-600" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Current stop
          </div>
          <div className="text-sm font-semibold text-gray-900 truncate">
            {currentStopName ?? (isActiveStatus(trip.status) ? 'Not arrived yet' : '—')}
          </div>
          {liveNextStopName && stopStatus === 'EN_ROUTE' && (
            <div className="text-[11px] text-gray-500 mt-0.5">
              Next: {liveNextStopName}
            </div>
          )}
        </div>
      </div>

      {/* Occupancy */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Passengers
            </span>
          </div>
          <span className="text-sm font-bold text-gray-900">
            {loading ? '…' : counts.total}
          </span>
        </div>
        {!loading && counts.total > 0 && (
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <span className="text-emerald-600 font-semibold">Boarded {counts.boarded}</span>
            <span className="text-red-600 font-semibold">Absent {counts.absent}</span>
            <span className="text-sky-600 font-semibold">Dropped {counts.droppedOff}</span>
            <span className="text-gray-500 font-semibold">Pending {counts.pending}</span>
          </div>
        )}
      </div>

      {/* Stop progress */}
      {stops.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
            Stop progress
          </div>
          <div className="space-y-1.5">
            {stops.map((stop, idx) => {
              const isCurrent = stop.id === trip.current_stop_id;
              const isOffice = isOfficeStop(stop);
              const etaRaw =
                trip.direction === 'MORNING' ? stop.morning_eta : stop.evening_eta;
              const eta = formatEtaTime12h(etaRaw);
              return (
                <div
                  key={stop.id}
                  className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 ${
                    isCurrent
                      ? 'bg-orange-50 text-orange-800 font-semibold'
                      : isOffice
                        ? 'bg-red-50/60 text-gray-700'
                        : 'text-gray-600'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isCurrent
                        ? 'bg-orange-500 text-white'
                        : isOffice
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isOffice ? <Building2 className="w-3 h-3" /> : idx + 1}
                  </span>
                  <span className="truncate flex-1">{stop.name}</span>
                  {isOffice && (
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-red-100 text-red-700 px-1.5 py-0.5 rounded shrink-0">
                      Office
                    </span>
                  )}
                  {eta && <span className="text-[10px] text-gray-400 shrink-0">{eta}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Employee list */}
      <div className="shrink-0">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Assigned employees
          </span>
        </div>
        <div className="p-3 space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 animate-pulse"
              >
                <div className="w-7 h-7 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))
          ) : employees.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2">
              <Users className="w-5 h-5 text-gray-300" />
              <p className="text-xs text-gray-400 font-medium">No employees assigned</p>
            </div>
          ) : (
            employeeGroups.map((group) => (
              <div key={group.officeName ?? 'all'} className="space-y-2">
                {group.officeName && (
                  <div className="flex items-center gap-1.5 px-0.5 pt-1 first:pt-0">
                    <Building2 className="w-3 h-3 text-red-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                      {group.officeName}
                    </span>
                    <span className="text-[10px] text-gray-400">({group.employees.length})</span>
                  </div>
                )}
                {group.employees.map((emp) => {
                  const label = boardingLabel(emp);
                  const name = emp.users?.full_name ?? 'Unknown';
                  return (
                    <div
                      key={emp.user_id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#0C225E]/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-[#0C225E]">
                          {name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-900 truncate">{name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {emp.route_stops?.name && (
                            <span className="text-[10px] text-gray-500 font-medium flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />
                              {emp.route_stops.name}
                            </span>
                          )}
                          {emp.users?.department && (
                            <span className="text-[10px] text-gray-400 truncate">
                              {emp.users.department}
                            </span>
                          )}
                        </div>
                        <div className={`mt-0.5 text-[10px] font-bold ${label.className}`}>
                          {label.text}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function isActiveStatus(status: string) {
  return status === 'STARTED' || status === 'IN_PROGRESS';
}
