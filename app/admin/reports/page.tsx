"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { apiClient, type ChauffeurReport, type ShuttleReport } from "../../lib/services/api-client";
import { PermissionGate } from "../components/PermissionGate";
import { AdminCan } from "../../lib/abilities/AdminAbilityProvider";
import {
  Badge,
  Card,
  CardContent,
  DataTable,
  DateRangePicker,
  FilterBar,
  FilterField,
  PageHeader,
  Select,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type DataTableColumn,
  type DateRange,
  type StatusEntry,
} from "../ui";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatTime, humanize } from "../lib/format";

const PAGE_SIZE = 15;

type PaginationState = { page: number; totalPages: number; total: number };

type ListState<T> = {
  key: string;
  rows: T[];
  pagination: PaginationState;
  error: string | null;
};

type PaginatedLike<T> = { data?: { data?: T[]; pagination?: Record<string, number> } | T[]; pagination?: Record<string, number> };

/** Both report endpoints wrap results slightly differently; normalise once. */
function unwrap<T>(res: unknown, page: number): { rows: T[]; pagination: PaginationState } {
  const raw = res as PaginatedLike<T>;
  const inner = raw?.data;
  const rows: T[] = Array.isArray(inner) ? inner : (inner?.data ?? []);
  const meta = (Array.isArray(inner) ? raw?.pagination : inner?.pagination) ?? raw?.pagination ?? {};
  return {
    rows,
    pagination: {
      page: meta.page ?? page,
      totalPages: meta.pages ?? meta.totalPages ?? 1,
      total: meta.total ?? rows.length,
    },
  };
}

const PASSENGER_STATUS: Record<string, StatusEntry> = {
  BOARDED: { tone: "success" },
  DROPPED_OFF: { tone: "info", label: "Dropped off" },
  ABSENT: { tone: "danger" },
  PENDING: { tone: "neutral" },
};

export default function AdminReportsPage() {
  return (
    <PermissionGate permission="reports">
      <AdminCan I="read" a="Reports">
        <AdminReportsContent />
      </AdminCan>
    </PermissionGate>
  );
}

function AdminReportsContent() {
  const [range, setRange] = React.useState<DateRange | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Completed chauffeur trips and shuttle logs across every company."
        actions={<DateRangePicker value={range} onChange={setRange} allowClear label="Report period" />}
      />

      <Tabs defaultValue="chauffeur">
        <TabsList>
          <TabsTrigger value="chauffeur">Chauffeur reports</TabsTrigger>
          <TabsTrigger value="shuttle">Shuttle logs</TabsTrigger>
        </TabsList>
        <TabsContent value="chauffeur">
          <ChauffeurReportsTab range={range} />
        </TabsContent>
        <TabsContent value="shuttle">
          <ShuttleLogsTab range={range} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Fetches one page of a report. `loading` is derived from the request key so no state is set
 * synchronously inside the effect, and stale responses are ignored.
 */
function usePagedReport<T>(fetcher: (page: number, start?: string, end?: string) => Promise<unknown>, range: DateRange | null) {
  const [page, setPage] = React.useState(1);
  const start = range?.start || undefined;
  const end = range?.end || undefined;
  const key = `${page}|${start ?? ""}|${end ?? ""}`;
  const [state, setState] = React.useState<ListState<T>>({ key: "", rows: [], pagination: { page: 1, totalPages: 1, total: 0 }, error: null });
  const [retryTick, setRetryTick] = React.useState(0);

  // Changing the period goes back to page 1 (render-time adjustment).
  const [prevRange, setPrevRange] = React.useState(range);
  if (prevRange !== range) {
    setPrevRange(range);
    setPage(1);
  }

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetcher(page, start, end);
        if (cancelled) return;
        const { rows, pagination } = unwrap<T>(res, page);
        setState({ key, rows, pagination, error: null });
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({ key, rows: [], pagination: s.pagination, error: e instanceof Error ? e.message : "Failed to load reports" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetcher, page, start, end, key, retryTick]);

  const loading = state.key !== key;
  return { ...state, loading, page, setPage, retry: () => setRetryTick((t) => t + 1) };
}

/* ── Chauffeur ─────────────────────────────────────────────────────────── */

const fetchChauffeur = (page: number, startDate?: string, endDate?: string) => apiClient.getAllChauffeurReports({ page, limit: PAGE_SIZE, startDate, endDate });

const chauffeurColumns: DataTableColumn<ChauffeurReport>[] = [
  { key: "completed_at", header: "Completed", width: "11rem", cell: (r) => <span className="whitespace-nowrap text-fg-secondary">{formatDateTime(r.completed_at)}</span> },
  { key: "company", header: "Company", cell: (r) => <span className="font-medium text-fg">{r.company?.name || "Unknown"}</span> },
  {
    key: "passenger",
    header: "Passenger",
    cell: (r) => (
      <div className="min-w-0">
        <div className="font-medium text-fg">{r.passenger?.full_name || "Guest"}</div>
        <div className="truncate text-xs text-fg-muted">{r.passenger?.email || "—"}</div>
      </div>
    ),
  },
  {
    key: "vehicle",
    header: "Vehicle",
    hideBelow: "md",
    cell: (r) =>
      r.vehicle ? (
        <div className="min-w-0">
          <div className="text-fg">
            {r.vehicle.make} {r.vehicle.model}
          </div>
          <div className="font-mono text-xs text-fg-muted">{r.vehicle.plate_number}</div>
        </div>
      ) : (
        <span className="text-fg-muted">—</span>
      ),
  },
  {
    key: "route",
    header: "Route",
    hideBelow: "lg",
    cell: (r) => (
      <div className="max-w-xs min-w-0">
        <div className="truncate text-fg" title={r.route.pickup}>
          {r.route.pickup || "—"}
        </div>
        <div className="truncate text-xs text-fg-muted" title={r.route.dropoff}>
          → {r.route.dropoff || "—"}
        </div>
      </div>
    ),
  },
  { key: "city", header: "City", hideBelow: "xl", cell: (r) => r.city || <span className="text-fg-muted">—</span> },
  { key: "total_duration_minutes", header: "Duration", align: "right", mono: true, hideBelow: "sm", cell: (r) => `${formatNumber(r.total_duration_minutes)} min` },
  { key: "total_distance_km", header: "Distance", align: "right", mono: true, hideBelow: "sm", cell: (r) => `${formatNumber(r.total_distance_km, { digits: 1 })} km` },
  { key: "total_cost", header: "Total", align: "right", mono: true, cell: (r) => <span className="font-medium">{formatCurrency(r.total_cost)}</span> },
];

function ChauffeurReportsTab({ range }: { range: DateRange | null }) {
  const { rows, pagination, loading, error, page, setPage, retry } = usePagedReport<ChauffeurReport>(fetchChauffeur, range);
  return (
    <Card>
      <DataTable<ChauffeurReport>
        caption="Chauffeur reports"
        rows={rows}
        rowKey={(r) => r.id}
        columns={chauffeurColumns}
        loading={loading}
        error={error}
        onRetry={retry}
        empty={{ title: "No chauffeur reports", description: range ? "No completed trips in the selected period." : "Completed chauffeur trips will appear here." }}
        pagination={{ page, totalPages: pagination.totalPages, total: pagination.total, pageSize: PAGE_SIZE, onPageChange: setPage }}
      />
    </Card>
  );
}

/* ── Shuttle ───────────────────────────────────────────────────────────── */

const fetchShuttle = (page: number, startDate?: string, endDate?: string) => apiClient.getAllShuttleReports({ page, limit: PAGE_SIZE, startDate, endDate });

function DirectionBadge({ direction }: { direction: string }) {
  const evening = direction === "EVENING";
  return (
    <Badge tone={evening ? "purple" : "warning"} icon={evening ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}>
      {humanize(direction)}
    </Badge>
  );
}

function ShuttleLogsTab({ range }: { range: DateRange | null }) {
  const { rows, pagination, loading, error, page, setPage, retry } = usePagedReport<ShuttleReport>(fetchShuttle, range);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [directionFilter, setDirectionFilter] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());

  // The endpoint has no status/direction parameters, so these filters apply to the loaded page only.
  const filtered = rows.filter((l) => (!statusFilter || l.status === statusFilter) && (!directionFilter || l.direction === directionFilter));
  const activeFilters = (statusFilter ? 1 : 0) + (directionFilter ? 1 : 0);

  const columns: DataTableColumn<ShuttleReport>[] = [
    { key: "trip_date", header: "Trip date", width: "8rem", cell: (l) => <span className="whitespace-nowrap font-medium text-fg">{formatDate(l.trip_date)}</span> },
    { key: "direction", header: "Direction", cell: (l) => <DirectionBadge direction={l.direction} /> },
    { key: "status", header: "Status", cell: (l) => <StatusBadge status={l.status} /> },
    { key: "company", header: "Company", hideBelow: "md", cell: (l) => <span className="font-medium text-fg">{l.company?.name || "—"}</span> },
    {
      key: "route",
      header: "Route",
      cell: (l) => (
        <div className="min-w-0">
          <div className="font-medium text-fg">{l.route?.name || "—"}</div>
          {l.route?.stops && l.route.stops.length > 0 && <div className="text-xs text-fg-muted">{l.route.stops.length} stops</div>}
        </div>
      ),
    },
    { key: "driver", header: "Driver", hideBelow: "lg", cell: (l) => l.driver?.full_name || <span className="text-fg-muted">—</span> },
    {
      key: "vehicle",
      header: "Vehicle",
      hideBelow: "lg",
      cell: (l) =>
        l.vehicle ? (
          <div className="min-w-0">
            <div className="text-fg">
              {l.vehicle.make} {l.vehicle.model}
            </div>
            <div className="font-mono text-xs text-fg-muted">{l.vehicle.plate_number}</div>
          </div>
        ) : (
          <span className="text-fg-muted">—</span>
        ),
    },
    {
      key: "passengers",
      header: "Boarded / absent",
      align: "right",
      mono: true,
      cell: (l) => (
        <span className="whitespace-nowrap">
          <span className="text-success-ink">{l.passengers.boarded}</span>
          <span className="text-fg-muted"> / </span>
          <span className="text-danger-ink">{l.passengers.absent}</span>
          <span className="text-fg-muted"> of {l.passengers.total}</span>
        </span>
      ),
    },
    { key: "started_at", header: "Started", hideBelow: "xl", cell: (l) => <span className="whitespace-nowrap text-xs text-fg-secondary">{l.started_at ? formatDateTime(l.started_at) : "—"}</span> },
    { key: "completed_at", header: "Completed", hideBelow: "xl", cell: (l) => <span className="whitespace-nowrap text-xs text-fg-secondary">{l.completed_at ? formatDateTime(l.completed_at) : "—"}</span> },
  ];

  return (
    <Card>
      <CardContent className="border-b border-line py-3">
        <FilterBar
          activeCount={activeFilters}
          onClear={() => {
            setStatusFilter("");
            setDirectionFilter("");
          }}
          actions={
            <span className="text-xs text-fg-muted">
              {activeFilters > 0 ? `${filtered.length} of ${rows.length} on this page · ` : ""}
              {formatNumber(pagination.total)} total
            </span>
          }
        >
          <FilterField label="Direction">
            <Select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)} placeholder="All" className="h-8 text-xs">
              <option value="MORNING">Morning</option>
              <option value="EVENING">Evening</option>
            </Select>
          </FilterField>
          <FilterField label="Status">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="All" className="h-8 text-xs">
              <option value="COMPLETED">Completed</option>
              <option value="STARTED">Started</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </FilterField>
          {activeFilters > 0 && <span className="text-xs text-fg-muted">Filters apply to the current page</span>}
        </FilterBar>
      </CardContent>
      <DataTable<ShuttleReport>
        caption="Shuttle logs"
        rows={filtered}
        rowKey={(l) => l.id}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={retry}
        empty={{ title: activeFilters > 0 ? "No logs match these filters on this page" : "No shuttle logs", description: range ? "No shuttle trips in the selected period." : "Shuttle trips will appear here." }}
        expandable={{
          isExpanded: (l) => expanded.has(l.id),
          onToggle: (l) =>
            setExpanded((s) => {
              const n = new Set(s);
              if (n.has(l.id)) n.delete(l.id);
              else n.add(l.id);
              return n;
            }),
          render: (l) => <ShuttleLogDetails log={l} />,
        }}
        pagination={{ page, totalPages: pagination.totalPages, total: pagination.total, pageSize: PAGE_SIZE, onPageChange: setPage }}
      />
    </Card>
  );
}

function ShuttleLogDetails({ log }: { log: ShuttleReport }) {
  const isEvening = log.direction === "EVENING";
  const stops = (log.stop_logs ?? [])
    .slice()
    .sort((a, b) => {
      const seq = (s: NonNullable<ShuttleReport["stop_logs"]>[number]) =>
        isEvening ? (s.evening_sequence ?? s.morning_sequence ?? 0) : (s.morning_sequence ?? s.evening_sequence ?? 0);
      return seq(a) - seq(b);
    });
  const passengers = log.passengers.details ?? [];

  if (passengers.length === 0 && stops.length === 0) {
    return <p className="px-6 py-3 text-xs text-fg-muted">No passenger or stop details recorded for this trip.</p>;
  }

  return (
    <div className="grid gap-6 px-6 py-4 lg:grid-cols-2">
      {passengers.length > 0 && (
        <section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Passenger manifest</h4>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
            {passengers.map((p, idx) => {
              // scanned_at is also set on ABSENT logs (it doubles as "marked at"), so only treat it as boarding time for boarded passengers.
              const boardedAt = (p.status === "BOARDED" || p.status === "DROPPED_OFF") && p.scanned_at ? formatTime(p.scanned_at) : null;
              const dropOffAt = p.drop_off_at ? formatTime(p.drop_off_at) : null;
              return (
                <li key={idx} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-fg">{p.employee?.full_name || "Unknown"}</div>
                    <div className="truncate text-fg-muted">{p.employee?.department || p.employee?.email || "—"}</div>
                    {(boardedAt || dropOffAt) && (
                      <div className="mt-0.5 font-mono text-[11px] text-fg-secondary">
                        {boardedAt && <span>Boarded {boardedAt}</span>}
                        {boardedAt && dropOffAt && <span> · </span>}
                        {dropOffAt && <span>Drop-off {dropOffAt}</span>}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={p.status} size="sm" overrides={PASSENGER_STATUS} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {stops.length > 0 && (
        <section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Stop timeline</h4>
          <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card text-xs">
            <li className="flex items-center justify-between gap-4 bg-success-soft px-3 py-2">
              <span className="flex items-center gap-2 font-medium text-success-ink">
                <span aria-hidden="true" className="size-2 rounded-full bg-success" />
                Trip started
              </span>
              <span className="font-mono text-success-ink">{log.started_at ? formatTime(log.started_at) : "—"}</span>
            </li>
            {stops.map((s, idx) => (
              <li key={idx} className="flex items-start justify-between gap-4 px-3 py-2">
                <div>
                  <div className="font-medium text-fg">{s.stop_name || `Stop ${s.stop_id}`}</div>
                  <div className="text-fg-muted">{isEvening ? "Evening drop-off stop" : "Morning pickup stop"}</div>
                </div>
                <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right font-mono text-fg">
                  {isEvening ? (
                    <>
                      <dt className="font-sans text-[10px] text-fg-muted">Drop-off</dt>
                      <dd>{s.drop_off_at ? formatTime(s.drop_off_at) : "—"}</dd>
                    </>
                  ) : (
                    <>
                      <dt className="font-sans text-[10px] text-fg-muted">Arrived</dt>
                      <dd>{s.arrived_at ? formatTime(s.arrived_at) : "—"}</dd>
                      <dt className="font-sans text-[10px] text-fg-muted">Boarded</dt>
                      <dd>{s.boarded_at ? formatTime(s.boarded_at) : "—"}</dd>
                    </>
                  )}
                </dl>
              </li>
            ))}
            <li className="flex items-center justify-between gap-4 bg-subtle px-3 py-2">
              <span className="flex items-center gap-2 font-medium text-fg-secondary">
                <span aria-hidden="true" className="size-2 rounded-full bg-fg-muted" />
                Trip completed
              </span>
              <span className="font-mono text-fg-secondary">{log.completed_at ? formatTime(log.completed_at) : "—"}</span>
            </li>
          </ol>
        </section>
      )}
    </div>
  );
}
