"use client";

import { Card, DataTable, type DataTableColumn } from "..";
import type { SuperAdminDashboardStats } from "../../../lib/types/admin-dashboard";
import { formatCurrency } from "../../lib/format";

type Row = {
  key: string;
  service: string;
  revenue: number;
  cogs: number;
  profit: number;
  avgProfit: number | null;
  total?: boolean;
};

const columns: DataTableColumn<Row>[] = [
  { key: "service", header: "Service", cell: (r) => <span className={r.total ? "font-semibold text-fg" : "font-medium text-fg"}>{r.service}</span> },
  { key: "revenue", header: "Revenue", align: "right", mono: true, cell: (r) => formatCurrency(r.revenue) },
  { key: "cogs", header: "COGS", align: "right", mono: true, cell: (r) => formatCurrency(r.cogs) },
  {
    key: "profit",
    header: "Profit",
    align: "right",
    mono: true,
    cell: (r) => <span className={r.profit < 0 ? "text-danger-ink" : "text-success-ink"}>{formatCurrency(r.profit)}</span>,
  },
  { key: "avgProfit", header: "Avg profit / trip", align: "right", mono: true, hideBelow: "sm", cell: (r) => (r.avgProfit == null ? "—" : formatCurrency(r.avgProfit)) },
];

/** Chauffeur vs shuttle economics in one scannable table (replaces eight metric cards). */
export function ServiceComparison({ stats }: { stats: SuperAdminDashboardStats }) {
  const rows: Row[] = [
    {
      key: "chauffeur",
      service: "Chauffeur",
      revenue: stats.chauffeurRevenue.current,
      cogs: stats.chauffeurCOGS.current,
      profit: stats.chauffeurProfit.current,
      avgProfit: stats.avgChauffeurProfit.current,
    },
    {
      key: "shuttle",
      service: "Shuttle",
      revenue: stats.shuttleRevenue.current,
      cogs: stats.shuttleCOGS.current,
      profit: stats.shuttleProfit.current,
      avgProfit: stats.avgShuttleProfit.current,
    },
    {
      key: "total",
      service: "Total",
      revenue: stats.totalRevenue.current,
      cogs: stats.totalCOGS.current,
      profit: stats.grossProfit.current,
      avgProfit: null,
      total: true,
    },
  ];
  return (
    <Card>
      <DataTable<Row>
        caption="Revenue, cost and profit by service"
        rows={rows}
        rowKey={(r) => r.key}
        columns={columns}
        density="compact"
        rowClassName={(r) => (r.total ? "bg-subtle font-semibold" : undefined)}
      />
    </Card>
  );
}
