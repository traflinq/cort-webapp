"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChauffeurContractRate } from "../../../lib/services/api-client";
import type { RateRow } from "../../../lib/store/slices/adminPricingSlice";
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, IconButton, Input } from "../../ui";
import { formatNumber } from "../../lib/format";
import { tableCellCls, tableHeadCls } from "./constants";

type RateField = keyof ChauffeurContractRate;

type RateColumn = {
  field: RateField;
  marketField?: RateField;
  label: string;
  width?: string;
};

const RATE_COLUMNS: RateColumn[] = [
  { field: "cost_per_km", marketField: "market_cost_per_km", label: "Cost / km" },
  { field: "rate_spot_5hr", marketField: "market_rate_spot_5hr", label: "5 hr spot" },
  { field: "rate_spot_10hr", marketField: "market_rate_spot_10hr", label: "10 hr spot" },
  { field: "rate_spot_24hr", marketField: "market_rate_spot_24hr", label: "24 hr spot" },
  { field: "rate_monthly_10hr", marketField: "market_rate_monthly_10hr", label: "Monthly 10 hr" },
  { field: "rate_monthly_24hr", marketField: "market_rate_monthly_24hr", label: "Monthly 24 hr" },
  { field: "rate_overtime_per_hr", marketField: "market_rate_overtime_per_hr", label: "Overtime / hr" },
];

export interface ChauffeurRatesTableProps {
  rows: RateRow[];
  canUpdate: boolean;
  canDelete: boolean;
  canAddRows: boolean;
  showMarketRates: boolean;
  onToggleMarketRates: (checked: boolean) => void;
  onAdd: () => void;
  onChange: (index: number, field: RateField, value: string) => void;
  onDelete: (index: number) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  defaultOutstation: string;
  defaultAccommodation: string;
}

function Savings({ contract, market }: { contract: string | number | undefined; market: string | number | undefined }) {
  const c = Number(contract || 0);
  const m = Number(market || 0);
  if (!m || !c || m <= c) return null;
  const diff = m - c;
  const pct = (diff / m) * 100;
  return (
    <Badge tone="success" size="sm">
      Saves {pct.toFixed(0)}% ({formatNumber(diff)})
    </Badge>
  );
}

export function ChauffeurRatesTable({
  rows,
  canUpdate,
  canDelete,
  canAddRows,
  showMarketRates,
  onToggleMarketRates,
  onAdd,
  onChange,
  onDelete,
  onSave,
  saving,
  dirty,
  defaultOutstation,
  defaultAccommodation,
}: ChauffeurRatesTableProps) {
  const rowLabel = (row: RateRow, idx: number) => row.vehicle_model?.trim() || `row ${idx + 1}`;

  return (
    <Card>
      <CardHeader
        title="Vehicle rates"
        description="Base contract rates. Billing rates are adjusted dynamically against the fuel price."
        actions={
          <>
            <Checkbox label="Show market rates" checked={showMarketRates} onCheckedChange={(c) => onToggleMarketRates(c === true)} />
            <Button variant="outline" size="sm" leftIcon={<Plus />} onClick={onAdd} disabled={!canAddRows}>
              Add vehicle
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
          title="No vehicle rates yet"
          description="Add a vehicle to start the rate card for this company."
          action={
            <Button size="sm" leftIcon={<Plus />} onClick={onAdd} disabled={!canAddRows}>
              Add vehicle
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <caption className="sr-only">Chauffeur vehicle rates</caption>
            <thead className={tableHeadCls}>
              <tr>
                <th scope="col" className={cn(tableCellCls, "min-w-[180px] py-2.5")}>Vehicle model</th>
                {RATE_COLUMNS.map((c) => (
                  <th key={c.field} scope="col" className={cn(tableCellCls, "min-w-[110px] py-2.5")}>
                    {c.label}
                  </th>
                ))}
                <th scope="col" className={cn(tableCellCls, "min-w-[130px] py-2.5")}>Outstation / day</th>
                <th scope="col" className={cn(tableCellCls, "min-w-[130px] py-2.5")}>Accommodation / night</th>
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
                        aria-label={`Vehicle model for ${label}`}
                        value={row.vehicle_model ?? ""}
                        onChange={(e) => onChange(idx, "vehicle_model", e.target.value)}
                        placeholder="e.g. Honda City"
                        disabled={!canUpdate}
                        className="h-8"
                      />
                      {row.isNew && (
                        <Badge tone="info" size="sm" className="mt-1">
                          Unsaved
                        </Badge>
                      )}
                    </td>
                    {RATE_COLUMNS.map((c) => (
                      <td key={c.field} className={tableCellCls}>
                        <div className="flex flex-col gap-1">
                          <Input
                            mono
                            inputMode="decimal"
                            aria-label={`${c.label} contract rate for ${label}`}
                            value={(row[c.field] as string | undefined) ?? ""}
                            onChange={(e) => onChange(idx, c.field, e.target.value)}
                            placeholder="Contract"
                            disabled={!canUpdate}
                            className="h-8"
                          />
                          {showMarketRates && c.marketField && (
                            <>
                              <Input
                                mono
                                inputMode="decimal"
                                aria-label={`${c.label} market rate for ${label}`}
                                value={(row[c.marketField] as string | undefined) ?? ""}
                                onChange={(e) => onChange(idx, c.marketField as RateField, e.target.value)}
                                placeholder="Market"
                                disabled={!canUpdate}
                                className="h-8 border-brand-line bg-brand-soft"
                              />
                              <Savings contract={row[c.field] as string | undefined} market={row[c.marketField] as string | undefined} />
                            </>
                          )}
                        </div>
                      </td>
                    ))}
                    <td className={tableCellCls}>
                      <Input
                        type="number"
                        min={0}
                        mono
                        aria-label={`Outstation allowance per day for ${label}`}
                        value={row.allowance_outstation ?? ""}
                        onChange={(e) => onChange(idx, "allowance_outstation", e.target.value)}
                        placeholder={defaultOutstation ? `Default (${defaultOutstation})` : "Default"}
                        disabled={!canUpdate}
                        className="h-8"
                      />
                    </td>
                    <td className={tableCellCls}>
                      <Input
                        type="number"
                        min={0}
                        mono
                        aria-label={`Accommodation allowance per night for ${label}`}
                        value={row.allowance_accommodation ?? ""}
                        onChange={(e) => onChange(idx, "allowance_accommodation", e.target.value)}
                        placeholder={defaultAccommodation ? `Default (${defaultAccommodation})` : "Default"}
                        disabled={!canUpdate}
                        className="h-8"
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
