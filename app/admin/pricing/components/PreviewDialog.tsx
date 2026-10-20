"use client";

import * as React from "react";
import { Badge, Dialog, DialogContent, EmptyState, LoadingBlock } from "../../ui";
import { formatCurrency } from "../../lib/format";

/** Loosely-typed shape of /pricing preview rows (the API returns untyped JSON). */
type PreviewCalculation = { will_adjust?: boolean; percent_change?: number | string; multiplier?: number | string; diesel_base_price?: number | string };
type PreviewRate = { vehicle_model?: string; base_cost_per_km?: number | string; adjusted_cost_per_km?: number | string };
type PreviewRoute = { particulars?: string; vehicle_type?: string; base_fuel_cost_per_vehicle?: number | string; adjusted_fuel_cost_per_vehicle?: number | string };
export type PreviewItem = {
  type?: string;
  company?: { name?: string };
  contract?: { fuel_base_price?: number | string; revision_percentage?: number | string | null };
  calculation?: PreviewCalculation;
  diesel_calculation?: PreviewCalculation | null;
  rates?: PreviewRate[];
  routes?: PreviewRoute[];
};

export interface PreviewDialogProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  fuelPrice: string;
  data: PreviewItem[] | null;
}

const pct = (v: number | string | undefined, digits = 2) => `${(Number(v ?? 0) * 100).toFixed(digits)}%`;
const money = (v: number | string | undefined, digits = 0) => formatCurrency(Number(v ?? 0), { digits });

function CalcGrid({ label, calc, basePrice, threshold }: { label: string; calc: PreviewCalculation; basePrice: number | string | undefined; threshold: number | string | null | undefined }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-line bg-subtle p-3 text-sm sm:grid-cols-4">
      <div className="col-span-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted sm:col-span-4">{label}</div>
      <div>
        <dt className="text-xs text-fg-muted">Base price</dt>
        <dd className="font-mono tabular-nums text-fg">{money(basePrice)}</dd>
      </div>
      <div>
        <dt className="text-xs text-fg-muted">Threshold</dt>
        <dd className="font-mono tabular-nums text-fg">{threshold != null ? pct(threshold, 1) : "No limit"}</dd>
      </div>
      <div>
        <dt className="text-xs text-fg-muted">Price change</dt>
        <dd className="font-mono tabular-nums text-fg">{pct(calc.percent_change)}</dd>
      </div>
      <div>
        <dt className="text-xs text-fg-muted">Multiplier</dt>
        <dd className="font-mono tabular-nums text-fg">{Number(calc.multiplier ?? 1).toFixed(4)}×</dd>
      </div>
    </dl>
  );
}

export function PreviewDialog({ open, onClose, loading, fuelPrice, data }: PreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" title="Rate adjustment preview" description={`How rates will be adjusted at a fuel price of ${formatCurrency(Number(fuelPrice || 0), { digits: 2 })}`}>
        {loading ? (
          <LoadingBlock label="Calculating adjustments…" />
        ) : !data || data.length === 0 ? (
          <EmptyState compact title="Nothing to preview" description="No contracts would be affected at this fuel price." />
        ) : (
          <div className="space-y-4">
            {data.map((item, idx) => {
              const isShuttle = item.type === "shuttle";
              const petrol = item.calculation;
              const diesel = item.diesel_calculation;
              return (
                <section key={idx} className="rounded-xl border border-line bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-fg">{item.company?.name || "Company"}</h4>
                      <Badge tone={isShuttle ? "info" : "purple"} size="sm">
                        {isShuttle ? "Shuttle" : "Chauffeur"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {petrol && (
                        <Badge tone={petrol.will_adjust ? "warning" : "success"} dot size="sm">
                          Petrol: {petrol.will_adjust ? "will adjust" : "no adjustment"}
                        </Badge>
                      )}
                      {isShuttle && diesel && (
                        <Badge tone={diesel.will_adjust ? "warning" : "success"} dot size="sm">
                          Diesel: {diesel.will_adjust ? "will adjust" : "no adjustment"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {petrol && <CalcGrid label="Petrol" calc={petrol} basePrice={item.contract?.fuel_base_price} threshold={item.contract?.revision_percentage} />}
                    {isShuttle && diesel && <CalcGrid label="Diesel" calc={diesel} basePrice={diesel.diesel_base_price} threshold={item.contract?.revision_percentage} />}
                  </div>

                  {!isShuttle && item.rates && item.rates.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-subtle text-left text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                          <tr>
                            <th scope="col" className="px-2 py-1.5">Vehicle</th>
                            <th scope="col" className="px-2 py-1.5 text-right">Base cost / km</th>
                            <th scope="col" className="px-2 py-1.5 text-right">Adjusted cost / km</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {item.rates.map((rate, r) => {
                            const changed = Number(rate.base_cost_per_km) !== Number(rate.adjusted_cost_per_km);
                            return (
                              <tr key={r}>
                                <td className="px-2 py-1.5 text-fg">{rate.vehicle_model}</td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-fg-secondary">{money(rate.base_cost_per_km, 2)}</td>
                                <td className={`px-2 py-1.5 text-right font-mono font-semibold tabular-nums ${changed ? "text-warning-ink" : "text-success-ink"}`}>{money(rate.adjusted_cost_per_km, 2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isShuttle && item.routes && item.routes.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-subtle text-left text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                          <tr>
                            <th scope="col" className="px-2 py-1.5">Particulars</th>
                            <th scope="col" className="px-2 py-1.5">Vehicle type</th>
                            <th scope="col" className="px-2 py-1.5 text-right">Base fuel / vehicle</th>
                            <th scope="col" className="px-2 py-1.5 text-right">Adjusted fuel / vehicle</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {item.routes.map((route, r) => {
                            const changed = Number(route.base_fuel_cost_per_vehicle) !== Number(route.adjusted_fuel_cost_per_vehicle);
                            return (
                              <tr key={r}>
                                <td className="px-2 py-1.5 text-fg">{route.particulars}</td>
                                <td className="px-2 py-1.5 text-fg-secondary">{route.vehicle_type}</td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-fg-secondary">{money(route.base_fuel_cost_per_vehicle, 2)}</td>
                                <td className={`px-2 py-1.5 text-right font-mono font-semibold tabular-nums ${changed ? "text-warning-ink" : "text-success-ink"}`}>{money(route.adjusted_fuel_cost_per_vehicle, 2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
