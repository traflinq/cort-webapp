"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShuttleContractRoute } from "../../../lib/services/api-client";
import type { ShuttleRouteRow } from "../../../lib/store/slices/adminPricingSlice";
import { Badge, Button, Card, CardHeader, EmptyState, IconButton, Input, Select } from "../../ui";
import { tableCellCls, tableHeadCls } from "./constants";

export type ShuttleRouteField = keyof ShuttleContractRoute | "quantity";

export interface ShuttleRatesTableProps {
  rows: ShuttleRouteRow[];
  canUpdate: boolean;
  canDelete: boolean;
  canAddRows: boolean;
  onAdd: () => void;
  onChange: (index: number, field: ShuttleRouteField, value: string) => void;
  onDelete: (index: number) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

export function ShuttleRatesTable({ rows, canUpdate, canDelete, canAddRows, onAdd, onChange, onDelete, onSave, saving, dirty }: ShuttleRatesTableProps) {
  const rowLabel = (row: ShuttleRouteRow, idx: number) => row.particulars?.trim() || `route ${idx + 1}`;

  return (
    <Card>
      <CardHeader
        title="Shuttle route rates"
        description="Fixed monthly service and fuel cost per vehicle for each shuttle leg."
        actions={
          <>
            <Button variant="outline" size="sm" leftIcon={<Plus />} onClick={onAdd} disabled={!canAddRows}>
              Add route
            </Button>
            <Button size="sm" onClick={onSave} disabled={!canUpdate} loading={saving}>
              {dirty ? "Save changes" : "Save"}
            </Button>
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          compact
          title="No shuttle routes yet"
          description="Add a route to define its monthly service and fuel cost."
          action={
            <Button size="sm" leftIcon={<Plus />} onClick={onAdd} disabled={!canAddRows}>
              Add route
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <caption className="sr-only">Shuttle route rates</caption>
            <thead className={tableHeadCls}>
              <tr>
                <th scope="col" className={cn(tableCellCls, "min-w-[220px] py-2.5")}>Particulars</th>
                <th scope="col" className={cn(tableCellCls, "min-w-[120px] py-2.5")}>Vehicle type</th>
                <th scope="col" className={cn(tableCellCls, "min-w-[120px] py-2.5")}>Fuel type</th>
                <th scope="col" className={cn(tableCellCls, "min-w-[140px] py-2.5")}>Fixed cost / vehicle</th>
                <th scope="col" className={cn(tableCellCls, "min-w-[140px] py-2.5")}>Fuel cost / vehicle</th>
                <th scope="col" className={cn(tableCellCls, "min-w-[130px] py-2.5")}>Billing type</th>
                <th scope="col" className={cn(tableCellCls, "min-w-[130px] py-2.5")}>Scheduled days</th>
                <th scope="col" className={cn(tableCellCls, "w-24 py-2.5")}>Qty</th>
                <th scope="col" className={cn(tableCellCls, "w-12 py-2.5")}>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, idx) => {
                const label = rowLabel(row, idx);
                return (
                  <tr key={row.id || row.tempId} className="hover:bg-row-hover">
                    <td className={tableCellCls}>
                      <Input
                        aria-label={`Particulars for ${label}`}
                        value={row.particulars ?? ""}
                        onChange={(e) => onChange(idx, "particulars", e.target.value)}
                        placeholder="e.g. Karachi to DFML - BUS"
                        disabled={!canUpdate}
                        className="h-8"
                      />
                      {row.isNew && (
                        <Badge tone="info" size="sm" className="mt-1">
                          Unsaved
                        </Badge>
                      )}
                    </td>
                    <td className={tableCellCls}>
                      <Input
                        aria-label={`Vehicle type for ${label}`}
                        value={row.vehicle_type ?? ""}
                        onChange={(e) => onChange(idx, "vehicle_type", e.target.value)}
                        placeholder="e.g. BUS, COASTER"
                        disabled={!canUpdate}
                        className="h-8"
                      />
                    </td>
                    <td className={tableCellCls}>
                      <Select aria-label={`Fuel type for ${label}`} value={row.fuel_type || "PETROL"} onChange={(e) => onChange(idx, "fuel_type", e.target.value)} disabled={!canUpdate} className="h-8">
                        <option value="PETROL">Petrol</option>
                        <option value="DIESEL">Diesel</option>
                      </Select>
                      {row.fuel_type === "DIESEL" && <p className="mt-1 text-[11px] text-warning-ink">Uses the global diesel rate</p>}
                    </td>
                    <td className={tableCellCls}>
                      <Input
                        mono
                        inputMode="decimal"
                        aria-label={`Fixed cost per vehicle for ${label}`}
                        value={row.fixed_cost_per_vehicle ?? ""}
                        onChange={(e) => onChange(idx, "fixed_cost_per_vehicle", e.target.value)}
                        placeholder="30000"
                        disabled={!canUpdate}
                        className="h-8"
                      />
                    </td>
                    <td className={tableCellCls}>
                      <Input
                        mono
                        inputMode="decimal"
                        aria-label={`Fuel cost per vehicle for ${label}`}
                        value={row.fuel_cost_per_vehicle ?? ""}
                        onChange={(e) => onChange(idx, "fuel_cost_per_vehicle", e.target.value)}
                        placeholder="20000"
                        disabled={!canUpdate}
                        className="h-8"
                      />
                    </td>
                    <td className={tableCellCls}>
                      <Select aria-label={`Billing type for ${label}`} value={row.billing_type || "MONTHLY"} onChange={(e) => onChange(idx, "billing_type", e.target.value)} disabled={!canUpdate} className="h-8">
                        <option value="MONTHLY">Monthly</option>
                        <option value="PER_TRIP">Per trip</option>
                      </Select>
                      {row.billing_type === "PER_TRIP" && <p className="mt-1 text-[11px] text-warning-ink">Cost × trips run at invoice time</p>}
                    </td>
                    <td className={tableCellCls}>
                      <Input
                        aria-label={`Scheduled days for ${label}`}
                        value={row.scheduled_days ?? ""}
                        onChange={(e) => onChange(idx, "scheduled_days", e.target.value)}
                        placeholder="e.g. MON, FRI/SAT"
                        disabled={!canUpdate}
                        className="h-8"
                      />
                    </td>
                    <td className={tableCellCls}>
                      <Input
                        type="number"
                        min={0}
                        mono
                        aria-label={`Quantity for ${label}`}
                        value={row.quantity ?? 0}
                        onChange={(e) => onChange(idx, "quantity", e.target.value)}
                        disabled={!canUpdate}
                        className="h-8 text-center"
                      />
                    </td>
                    <td className={cn(tableCellCls, "text-center")}>
                      <IconButton label={`Remove ${label}`} size="icon-sm" variant="ghost" className="text-danger-ink hover:bg-danger-soft" onClick={() => onDelete(idx)} disabled={!canDelete}>
                        <Trash2 />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
