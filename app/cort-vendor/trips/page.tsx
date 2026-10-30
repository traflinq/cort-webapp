"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  DataTable,
  DateRangePicker,
  FilterBar,
  FilterField,
  PageHeader,
  RefreshButton,
  Select,
  StatusBadge,
  type DataTableColumn,
} from "../../admin/ui";
import { formatDate, formatTime, humanize } from "../../admin/lib/format";
import { apiClient } from "../../lib/services/api-client";
import type { CortVendorRouteRow, CortVendorTripRow, CortVendorVehicleRow, ShuttleDirection, ShuttleTripStatus } from "../../lib/services/types/cort-vendor";
import { useLoad } from "../components/useLoad";
import { todayISO } from "../lib";

const STATUSES: ShuttleTripStatus[] = ["SCHEDULED", "STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

type Filters = {
  from: string;
  to: string;
  company_id: string;
  route_id: string;
  vehicle_id: string;
  status: string;
  direction: string;
};

const defaultFilters = (): Filters => ({
  from: todayISO(-29),
  to: todayISO(),
  company_id: "",
  route_id: "",
  vehicle_id: "",
  status: "",
  direction: "",
});

const num = (v: string) => (v ? Number(v) : undefined);

export default function CortVendorTripsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [routes, setRoutes] = useState<CortVendorRouteRow[]>([]);
  const [vehicles, setVehicles] = useState<CortVendorVehicleRow[]>([]);

  useEffect(() => {
    Promise.all([apiClient.getCortVendorRoutes(), apiClient.getCortVendorVehicles()])
      .then(([r, v]) => {
        setRoutes(r);
        setVehicles(v);
      })
      .catch(() => undefined);
  }, []);

  const { data, loading, error, reload } = useLoad(
    () =>
      apiClient.getCortVendorTrips({
        from: filters.from || undefined,
        to: filters.to || undefined,
        company_id: num(filters.company_id),
        route_id: num(filters.route_id),
        vehicle_id: num(filters.vehicle_id),
        status: (filters.status || undefined) as ShuttleTripStatus | undefined,
        direction: (filters.direction || undefined) as ShuttleDirection | undefined,
        page,
        limit: pageSize,
      }),
    [filters, page, pageSize],
  );

  const companies = useMemo(() => {
    const byId = new Map<number, string>();
    routes.forEach((r) => r.companies && byId.set(r.companies.id, r.companies.name));
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [routes]);

  const routeOptions = useMemo(
    () => routes.filter((r) => !filters.company_id || r.companies?.id === Number(filters.company_id)),
    [routes, filters.company_id],
  );

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const defaults = defaultFilters();
  const activeCount = (Object.keys(filters) as (keyof Filters)[]).filter((k) => filters[k] !== defaults[k]).length;

  const columns: DataTableColumn<CortVendorTripRow>[] = [
    { key: "date", header: "Date", cell: (t) => formatDate(t.trip_date) },
    { key: "direction", header: "Shift", cell: (t) => <StatusBadge status={t.direction} dot={false} size="sm" /> },
    {
      key: "route",
      header: "Route",
      cell: (t) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">{t.routes?.name ?? "—"}</div>
          <div className="truncate text-xs text-fg-muted">{t.routes?.companies?.name}</div>
        </div>
      ),
    },
    { key: "vehicle", header: "Vehicle", mono: true, cell: (t) => t.vehicles?.plate_number ?? "—" },
    { key: "driver", header: "Driver", hideBelow: "md", cell: (t) => t.users?.full_name ?? "—" },
    {
      key: "time",
      header: "Start – End",
      hideBelow: "lg",
      cell: (t) => (t.started_at ? `${formatTime(t.started_at)} – ${t.completed_at ? formatTime(t.completed_at) : "…"}` : "—"),
    },
    {
      key: "distance",
      header: "Km",
      align: "right",
      hideBelow: "lg",
      cell: (t) => (t.total_distance_km != null ? Number(t.total_distance_km).toFixed(1) : "—"),
    },
    {
      key: "boarded",
      header: "Boarded",
      align: "right",
      hideBelow: "xl",
      cell: (t) => (t.shuttle_trip_metrics ? `${t.shuttle_trip_metrics.boarded_count}/${t.shuttle_trip_metrics.seat_capacity || "—"}` : "—"),
    },
    { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} size="sm" /> },
  ];

  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trips"
        description="Every shuttle trip run with your vehicles or drivers."
        actions={<RefreshButton label="Refresh trips" onClick={reload} loading={loading} />}
      />
      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar activeCount={activeCount} onClear={() => { setFilters(defaultFilters()); setPage(1); }}>
            <FilterField label="Period">
              <DateRangePicker
                value={filters.from || filters.to ? { start: filters.from, end: filters.to } : null}
                onChange={(r) => update({ from: r?.start ?? "", to: r?.end ?? "" })}
                allowClear
                size="sm"
              />
            </FilterField>
            {companies.length > 1 && (
              <FilterField label="Client">
                <Select value={filters.company_id} onChange={(e) => update({ company_id: e.target.value, route_id: "" })} placeholder="All clients" className="h-8 text-xs">
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FilterField>
            )}
            <FilterField label="Route">
              <Select value={filters.route_id} onChange={(e) => update({ route_id: e.target.value })} placeholder="All routes" className="h-8 text-xs">
                {routeOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Vehicle">
              <Select value={filters.vehicle_id} onChange={(e) => update({ vehicle_id: e.target.value })} placeholder="All vehicles" className="h-8 text-xs">
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Shift">
              <Select value={filters.direction} onChange={(e) => update({ direction: e.target.value })} placeholder="Both" className="h-8 text-xs">
                <option value="MORNING">Morning</option>
                <option value="EVENING">Evening</option>
              </Select>
            </FilterField>
            <FilterField label="Status">
              <Select value={filters.status} onChange={(e) => update({ status: e.target.value })} placeholder="All statuses" className="h-8 text-xs">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </Select>
            </FilterField>
          </FilterBar>
        </CardContent>
        <DataTable
          caption="Vendor trips"
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(t) => t.id}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(t) => router.push(`/cort-vendor/trips/${t.id}`)}
          empty={{ title: "No trips found", description: "Try a wider date range or clear the filters." }}
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  totalPages: pagination.pages,
                  total: pagination.total,
                  pageSize,
                  onPageChange: setPage,
                  onPageSizeChange: (size) => {
                    setPageSize(size);
                    setPage(1);
                  },
                  pageSizeOptions: [25, 50, 100],
                }
              : undefined
          }
        />
      </Card>
    </div>
  );
}
