"use client";

import { Bus } from "lucide-react";
import type { ShuttleDailyEfficiency as Row } from "../../../lib/types/admin-dashboard";
import { Badge, Card, CardHeader, DataTable, type BadgeTone, type DataTableColumn } from "..";
import { formatDate, formatNumber } from "../../lib/format";

// Fuel: positive variance = burned more than planned. Occupancy: low = empty seats being paid for.
const fuelTone = (v: number | null): BadgeTone => (v == null ? "neutral" : v > 10 ? "danger" : v > 5 ? "warning" : "success");
const seatTone = (v: number | null): BadgeTone => (v == null ? "neutral" : v < 50 ? "danger" : v < 70 ? "warning" : "success");

/** Daily seat occupancy and fuel variance for the selected reporting period. */
export function ShuttleDailyEfficiency({ rows }: { rows: Row[] }) {
  const columns: DataTableColumn<Row>[] = [
    { key: "date", header: "Date", cell: (r) => <span className="font-medium text-fg">{formatDate(r.date)}</span> },
    { key: "trips", header: "Trips", align: "right", mono: true, width: "5rem", cell: (r) => formatNumber(r.trips) },
    {
      key: "seats",
      header: "Seats used",
      align: "right",
      mono: true,
      cell: (r) => `${formatNumber(r.boarded)} / ${formatNumber(r.seatCapacity)}`,
    },
    {
      key: "occ",
      header: "Occupancy",
      align: "right",
      width: "7rem",
      cell: (r) => <Badge tone={seatTone(r.occupancyPct)}>{r.occupancyPct == null ? "—" : `${r.occupancyPct.toFixed(0)}%`}</Badge>,
    },
    {
      key: "fuel",
      header: "Fuel actual / expected (L)",
      align: "right",
      mono: true,
      cell: (r) => `${r.fuelActualLitres.toFixed(1)} / ${r.fuelExpectedLitres.toFixed(1)}`,
    },
    {
      key: "var",
      header: "Fuel variance",
      align: "right",
      width: "7rem",
      cell: (r) => (
        <Badge tone={fuelTone(r.fuelVariancePct)}>
          {r.fuelVariancePct == null ? "—" : `${r.fuelVariancePct > 0 ? "+" : ""}${r.fuelVariancePct.toFixed(1)}%`}
        </Badge>
      ),
    },
  ];
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Bus className="size-4 text-fg-muted" />
            Daily shuttle efficiency
          </span>
        }
        description="Seat occupancy and fuel variance per day. Red: fuel over +10% or occupancy under 50%."
      />
      <div className="max-h-96 overflow-y-auto">
        <DataTable<Row>
          rows={rows}
          rowKey={(r) => r.date}
          columns={columns}
          density="compact"
          stickyHeader
          empty={{ title: "No completed shuttle trips in this period" }}
          caption="Daily shuttle efficiency"
        />
      </div>
    </Card>
  );
}
