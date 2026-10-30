"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, DataTable, FilterBar, PageHeader, RefreshButton, StatusBadge, type DataTableColumn } from "../../admin/ui";
import { formatRelative } from "../../admin/lib/format";
import { apiClient } from "../../lib/services/api-client";
import type { CortVendorDriverRow } from "../../lib/services/types/cort-vendor";
import { useLoad } from "../components/useLoad";

export default function CortVendorDriversPage() {
  const { data, loading, error, reload } = useLoad(() => apiClient.getCortVendorDrivers());
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((d) => [d.full_name, d.phone, d.email, d.profile.cnic_number].some((f) => f?.toLowerCase().includes(q)));
  }, [data, search]);

  const columns: DataTableColumn<CortVendorDriverRow>[] = [
    {
      key: "name",
      header: "Driver",
      cell: (d) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">{d.full_name}</div>
          <div className="truncate text-xs text-fg-muted">{d.email}</div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", mono: true, cell: (d) => d.phone ?? "—" },
    { key: "cnic", header: "CNIC", mono: true, hideBelow: "md", cell: (d) => d.profile.cnic_number ?? "—" },
    {
      key: "routes",
      header: "Routes",
      cell: (d) => {
        const names = [...new Set([...d.routes, ...d.evening_assigned_routes].map((r) => r.name))];
        return names.length ? names.join(", ") : <span className="text-fg-muted">Not assigned</span>;
      },
    },
    {
      key: "app",
      header: "App",
      hideBelow: "lg",
      cell: (d) => (
        <div className="flex flex-col gap-0.5">
          <StatusBadge status={d.profile.is_online ? "ONLINE" : "OFFLINE"} size="sm" />
          {d.profile.last_updated && <span className="text-xs text-fg-muted">{formatRelative(d.profile.last_updated)}</span>}
        </div>
      ),
    },
    { key: "status", header: "Account", cell: (d) => <StatusBadge status={d.status} size="sm" /> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Drivers"
        description="Your drivers working on Cort-managed routes."
        actions={<RefreshButton label="Refresh drivers" onClick={reload} loading={loading} />}
      />
      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar search={{ value: search, onChange: setSearch, placeholder: "Search name, phone or CNIC…" }} />
        </CardContent>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(d) => d.id}
          loading={loading}
          error={error}
          onRetry={reload}
          empty={{ title: "No drivers", description: "Contact Cort if one of your drivers is missing." }}
        />
      </Card>
    </div>
  );
}
