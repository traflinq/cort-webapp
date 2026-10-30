"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, DataTable, FilterBar, PageHeader, RefreshButton, StatusBadge, type DataTableColumn } from "../../admin/ui";
import { apiClient } from "../../lib/services/api-client";
import type { CortVendorRouteRow } from "../../lib/services/types/cort-vendor";
import { useLoad } from "../components/useLoad";

export default function CortVendorRoutesPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useLoad(() => apiClient.getCortVendorRoutes());
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((r) =>
      [r.name, r.companies?.name, r.vehicles?.plate_number, r.users?.full_name].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const columns: DataTableColumn<CortVendorRouteRow>[] = [
    {
      key: "name",
      header: "Route",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">{r.name}</div>
          <div className="truncate text-xs text-fg-muted">{r.companies?.name}</div>
        </div>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      mono: true,
      cell: (r) =>
        r.evening_vehicle && r.evening_vehicle.id !== r.vehicles?.id
          ? `${r.vehicles?.plate_number ?? "—"} / ${r.evening_vehicle.plate_number}`
          : r.vehicles?.plate_number ?? "—",
    },
    {
      key: "driver",
      header: "Driver",
      cell: (r) =>
        r.evening_driver && r.evening_driver.id !== r.users?.id
          ? `${r.users?.full_name ?? "—"} / ${r.evening_driver.full_name}`
          : r.users?.full_name ?? "—",
    },
    { key: "stops", header: "Stops", align: "right", hideBelow: "md", cell: (r) => r._count.route_stops },
    { key: "riders", header: "Employees", align: "right", hideBelow: "md", cell: (r) => r._count.employee_route_assignments },
    {
      key: "km",
      header: "Planned km",
      align: "right",
      hideBelow: "lg",
      cell: (r) => (r.expected_km != null ? Number(r.expected_km).toFixed(1) : "—"),
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "ACTIVE" : "INACTIVE"} size="sm" /> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Routes"
        description="Cort routes your vehicles and drivers run. Routes are planned and managed by Cort."
        actions={<RefreshButton label="Refresh routes" onClick={reload} loading={loading} />}
      />
      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar search={{ value: search, onChange: setSearch, placeholder: "Search route, client, vehicle or driver…" }} />
        </CardContent>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(r) => router.push(`/cort-vendor/routes/${r.id}`)}
          empty={{ title: "No routes", description: "Routes appear here once Cort assigns your vehicles or drivers to them." }}
        />
      </Card>
    </div>
  );
}
