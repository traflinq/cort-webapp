"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, DataTable, FilterBar, PageHeader, RefreshButton, StatusBadge, type DataTableColumn } from "../../admin/ui";
import { humanize } from "../../admin/lib/format";
import { apiClient } from "../../lib/services/api-client";
import type { CortVendorVehicleRow } from "../../lib/services/types/cort-vendor";
import { useLoad } from "../components/useLoad";

export default function CortVendorVehiclesPage() {
  const { data, loading, error, reload } = useLoad(() => apiClient.getCortVendorVehicles());
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((v) => [v.plate_number, v.make, v.model, v.color].some((f) => f?.toLowerCase().includes(q)));
  }, [data, search]);

  const columns: DataTableColumn<CortVendorVehicleRow>[] = [
    { key: "plate", header: "Plate", mono: true, cell: (v) => <span className="font-medium text-fg">{v.plate_number}</span> },
    { key: "vehicle", header: "Vehicle", cell: (v) => `${v.make} ${v.model}${v.year ? ` (${v.year})` : ""}` },
    { key: "category", header: "Type", hideBelow: "md", cell: (v) => humanize(v.category) },
    { key: "seats", header: "Seats", align: "right", hideBelow: "md", cell: (v) => v.seat_capacity || "—" },
    { key: "color", header: "Colour", hideBelow: "lg", cell: (v) => v.color ?? "—" },
    {
      key: "routes",
      header: "Routes",
      cell: (v) => {
        const names = [...new Set([...v.routes, ...v.evening_assigned_routes].map((r) => r.name))];
        return names.length ? names.join(", ") : <span className="text-fg-muted">Not assigned</span>;
      },
    },
    {
      key: "client",
      header: "Client",
      hideBelow: "lg",
      cell: (v) => [...new Set(v.routes.map((r) => r.companies?.name).filter(Boolean))].join(", ") || "—",
    },
    { key: "status", header: "Status", cell: (v) => <StatusBadge status={v.status} size="sm" /> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vehicles"
        description="Your vehicles that Cort runs on client routes."
        actions={<RefreshButton label="Refresh vehicles" onClick={reload} loading={loading} />}
      />
      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar search={{ value: search, onChange: setSearch, placeholder: "Search plate, make or model…" }} />
        </CardContent>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(v) => v.id}
          loading={loading}
          error={error}
          onRetry={reload}
          empty={{ title: "No vehicles", description: "Contact Cort if one of your vehicles is missing." }}
        />
      </Card>
    </div>
  );
}
