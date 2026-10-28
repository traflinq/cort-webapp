"use client";

import * as React from "react";
import { Bus } from "lucide-react";
import { apiClient } from "../../../lib/services/api-client";
import type { ShuttleVehicleEfficiency as Row } from "../../../lib/types/admin-dashboard";
import { Badge, Card, CardHeader, DataTable, DateRangePicker, type BadgeTone, type DataTableColumn, type DateRange } from "..";
import { currentMonthRange } from "../../lib/dates";
import { formatNumber } from "../../lib/format";

// Fuel: positive variance = burned more than planned. Occupancy: low = empty seats being paid for.
const fuelTone = (v: number | null): BadgeTone => (v == null ? "neutral" : v > 10 ? "danger" : v > 5 ? "warning" : "success");
const seatTone = (v: number | null): BadgeTone => (v == null ? "neutral" : v < 50 ? "danger" : v < 70 ? "warning" : "success");

const occBadge = (pct: number | null) => <Badge tone={seatTone(pct)}>{pct == null ? "—" : `${pct.toFixed(0)}%`}</Badge>;
const varBadge = (pct: number | null) => (
  <Badge tone={fuelTone(pct)}>{pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}</Badge>
);

const columns: DataTableColumn<Row>[] = [
  {
    key: "vehicle",
    header: "Vehicle",
    cell: (r) => (
      <div className="min-w-0">
        <span className="font-medium text-fg">{r.plateNumber ?? "No vehicle recorded"}</span>
        {r.vehicleName && <span className="ml-2 text-xs text-fg-muted">{r.vehicleName}</span>}
      </div>
    ),
  },
  {
    key: "trips",
    header: "Trips (AM / PM)",
    align: "right",
    mono: true,
    cell: (r) => (
      <span title={`${r.morning.trips} morning, ${r.evening.trips} evening`}>
        {formatNumber(r.trips)} <span className="text-xs text-fg-muted">({r.morning.trips} / {r.evening.trips})</span>
      </span>
    ),
  },
  { key: "occ-am", header: "Occupancy AM", align: "right", cell: (r) => occBadge(r.morning.occupancyPct) },
  { key: "occ-pm", header: "Occupancy PM", align: "right", cell: (r) => occBadge(r.evening.occupancyPct) },
  { key: "occ", header: "Occupancy overall", align: "right", cell: (r) => occBadge(r.occupancyPct) },
  { key: "var-am", header: "Fuel var. AM", align: "right", hideBelow: "md", cell: (r) => varBadge(r.morning.fuelVariancePct) },
  { key: "var-pm", header: "Fuel var. PM", align: "right", hideBelow: "md", cell: (r) => varBadge(r.evening.fuelVariancePct) },
  { key: "var", header: "Fuel var. overall", align: "right", cell: (r) => varBadge(r.fuelVariancePct) },
  {
    key: "fuel",
    header: "Fuel actual / expected (L)",
    align: "right",
    mono: true,
    hideBelow: "lg",
    cell: (r) => `${r.fuelActualLitres.toFixed(1)} / ${r.fuelExpectedLitres.toFixed(1)}`,
  },
];

/**
 * Per-vehicle seat occupancy and fuel variance. Has its own date filter (default: current month),
 * independent of the dashboard's reporting period.
 */
export function ShuttleVehicleEfficiency() {
  const [range, setRange] = React.useState<DateRange>(currentMonthRange);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const requestId = React.useRef(0);

  const load = React.useCallback(async (r: DateRange) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getShuttleEfficiency(r.start, r.end);
      if (id === requestId.current) setRows(data.vehicles);
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "Failed to load shuttle efficiency");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(range);
  }, [load, range]);

  return (
    <Card className="flex flex-col">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Bus className="size-4 text-fg-muted" />
            Shuttle efficiency by vehicle
          </span>
        }
        description="Seat occupancy and fuel variance per car, split into morning (AM) and evening (PM) trips. Red: fuel over +10% or occupancy under 50%."
        actions={<DateRangePicker label="Efficiency period" size="sm" align="end" value={range} onChange={(next) => next && setRange(next)} />}
      />
      <div className="max-h-96 overflow-y-auto">
        <DataTable<Row>
          rows={rows}
          rowKey={(r) => r.vehicleId ?? "none"}
          columns={columns}
          density="compact"
          stickyHeader
          loading={loading}
          error={error}
          onRetry={() => void load(range)}
          empty={{ title: "No completed shuttle trips in this period" }}
          caption="Shuttle efficiency by vehicle"
        />
      </div>
    </Card>
  );
}
