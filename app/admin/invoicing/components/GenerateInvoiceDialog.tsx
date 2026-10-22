"use client";

import { Button, Checkbox, Dialog, DialogContent, Field, FormGrid, Input, Select } from "../../ui";
import { formatCurrency, formatNumber } from "../../lib/format";
import type { InvoicesController } from "../hooks/useInvoices";
import { PICKER_LIMIT } from "../hooks/useInvoices";

export function GenerateInvoiceDialog({ inv }: { inv: InvoicesController }) {
  const hasDieselRoutes = inv.shuttleRoutes.some((r) => r.fuel_type === "DIESEL");
  const preview = inv.fuelAdjustmentPreview;
  const money2 = (n: number) => formatNumber(n, { digits: 2 });

  return (
    <Dialog open={inv.showShuttleModal} onOpenChange={(open) => !open && !inv.isGeneratingShuttle && inv.setShowShuttleModal(false)}>
      <DialogContent
        size="xl"
        title="Generate shuttle invoice"
        description="Builds an invoice from the company's shuttle contract. Nothing is saved until you generate."
        footer={
          <>
            <Button variant="outline" onClick={() => inv.setShowShuttleModal(false)} disabled={inv.isGeneratingShuttle}>
              Cancel
            </Button>
            <Button onClick={inv.handleGenerateShuttleInvoice} loading={inv.isGeneratingShuttle} disabled={!inv.canUpdate}>
              Generate invoice
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field
            label="Company"
            required
            hint={inv.companiesTruncated ? `Showing the first ${PICKER_LIMIT} companies only.` : undefined}
          >
            <Select value={inv.selectedCompanyId} onChange={(e) => inv.setSelectedCompanyId(e.target.value)} placeholder="Select a company">
              {inv.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          {inv.shuttleRoutes.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-[13px] font-medium text-fg-secondary">Route inputs for this invoice</legend>
              <p className="text-xs text-fg-muted">
                Set the quantity for each route. Per-trip routes also take a trip count and date. Routes with quantity 0 are excluded.
              </p>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                {inv.shuttleRoutes.map((route) => {
                  const perTrip = route.billing_type === "PER_TRIP";
                  return (
                    <li key={route.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-fg">{route.particulars}</div>
                        <div className="text-xs text-fg-muted">
                          {route.vehicle_type} · Contract qty {route.quantity} · {perTrip ? "Per trip" : "Monthly"}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-fg-muted">
                          Qty
                          <Input
                            type="number"
                            min={0}
                            aria-label={`Quantity for ${route.particulars}`}
                            className="h-8 w-20 text-center"
                            value={inv.routeQuantities[route.id] ?? String(Number(route.quantity ?? 0))}
                            onChange={(e) => inv.setRouteQuantities((prev) => ({ ...prev, [route.id]: e.target.value }))}
                          />
                        </label>
                        {perTrip && (
                          <>
                            <label className="flex items-center gap-1.5 text-xs text-fg-muted">
                              Trips
                              <Input
                                type="number"
                                min={0}
                                aria-label={`Trips for ${route.particulars}`}
                                className="h-8 w-20 text-center"
                                value={inv.routeTrips[route.id] ?? "0"}
                                onChange={(e) => inv.setRouteTrips((prev) => ({ ...prev, [route.id]: e.target.value }))}
                              />
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-fg-muted">
                              Date
                              <Input
                                type="date"
                                aria-label={`Trip date for ${route.particulars}`}
                                className="h-8 w-auto"
                                value={inv.routeTripDates[route.id] ?? ""}
                                onChange={(e) => inv.setRouteTripDates((prev) => ({ ...prev, [route.id]: e.target.value }))}
                              />
                            </label>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}

          <FormGrid cols={2}>
            <Field label="Billing period" required>
              <Select value={inv.billingPeriod} onChange={(e) => inv.setBillingPeriod(e.target.value as "MONTHLY" | "WEEKLY")}>
                <option value="MONTHLY">Monthly</option>
                <option value="WEEKLY">Weekly</option>
              </Select>
            </Field>
            {inv.billingPeriod === "MONTHLY" ? (
              <Field label="Billing month" required>
                <Input type="month" value={inv.billingMonthRaw} onChange={(e) => inv.setBillingMonthRaw(e.target.value)} />
              </Field>
            ) : (
              <>
                <Field label="Week start" required>
                  <Input type="date" value={inv.weeklyStartDate} max={inv.weeklyEndDate || undefined} onChange={(e) => inv.setWeeklyStartDate(e.target.value)} />
                </Field>
                <Field label="Week end" required>
                  <Input type="date" value={inv.weeklyEndDate} min={inv.weeklyStartDate || undefined} onChange={(e) => inv.setWeeklyEndDate(e.target.value)} />
                </Field>
              </>
            )}
            <Field label="Continued vehicles" hint="Optional.">
              <Input type="number" min={0} value={inv.continuedVehicles} onChange={(e) => inv.setContinuedVehicles(e.target.value)} placeholder="e.g. 8" />
            </Field>
            <Field
              label="Fuel billing"
              hint={
                inv.shuttleContractFuel?.fuelBasePrice
                  ? `Contract petrol base ${formatCurrency(Number(inv.shuttleContractFuel.fuelBasePrice), { digits: 2 })}/L${
                      inv.shuttleContractFuel.dieselBasePrice ? ` · diesel base ${formatCurrency(Number(inv.shuttleContractFuel.dieselBasePrice), { digits: 2 })}/L` : ""
                    }`
                  : undefined
              }
            >
              <Select value={inv.fuelMode} onChange={(e) => inv.setFuelMode(e.target.value as "CONTRACT" | "SELECTED")}>
                <option value="CONTRACT">Same as contract (no fuel revision)</option>
                <option value="SELECTED">Adjust to selected fuel (this invoice only)</option>
              </Select>
            </Field>
          </FormGrid>

          {inv.fuelMode === "SELECTED" && (
            <div className="space-y-3 rounded-lg border border-line bg-subtle/60 p-3">
              <FormGrid cols={2}>
                <Field label="Petrol price (PKR/L)" required>
                  <Input type="number" min={0} step="0.01" value={inv.selectedFuelPrice} onChange={(e) => inv.setSelectedFuelPrice(e.target.value)} placeholder="e.g. 264.61" />
                </Field>
                {hasDieselRoutes && (
                  <Field label="Diesel price (PKR/L)" required>
                    <Input type="number" min={0} step="0.01" value={inv.selectedDieselPrice} onChange={(e) => inv.setSelectedDieselPrice(e.target.value)} placeholder="e.g. 276.34" />
                  </Field>
                )}
              </FormGrid>
              <p className="text-xs text-fg-muted">
                Fuel on this invoice is revised against the contract base using these prices. Global fuel settings are not changed.
              </p>
              {preview ? (
                <div className="overflow-hidden rounded-lg border border-line bg-card">
                  <div className="space-y-1 border-b border-line px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Fuel adjustment preview</div>
                    <p className="text-xs text-fg-secondary">
                      Contract threshold: {preview.revisionLabel}. Selected petrol is {preview.petrolPercentChange >= 0 ? "+" : ""}
                      {(preview.petrolPercentChange * 100).toFixed(1)}% vs contract
                      {preview.willPetrolAdjust ? " — fuel will be revised." : " — within threshold, fuel stays as contract."}
                      {preview.dieselPercentChange != null && (
                        <>
                          {" "}Diesel is {preview.dieselPercentChange >= 0 ? "+" : ""}
                          {(preview.dieselPercentChange * 100).toFixed(1)}% vs contract
                          {preview.willDieselAdjust ? " — diesel fuel will be revised." : " — diesel stays as contract."}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-subtle text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left">Route</th>
                          <th scope="col" className="px-3 py-2 text-left">Fuel</th>
                          <th scope="col" className="px-3 py-2 text-right">Contract / veh</th>
                          <th scope="col" className="px-3 py-2 text-right">Adjusted / veh</th>
                          <th scope="col" className="px-3 py-2 text-right">This invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {preview.rows.map((row) => {
                          const changed = Math.abs(row.adjustedFuelPerVehicle - row.baseFuelPerVehicle) > 0.005;
                          return (
                            <tr key={row.routeId}>
                              <td className="px-3 py-2">
                                <div className="font-medium text-fg">{row.particulars}</div>
                                <div className="text-fg-muted">{row.vehicleType}</div>
                              </td>
                              <td className="px-3 py-2 text-fg-secondary">{row.fuelType}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">{money2(row.baseFuelPerVehicle)}</td>
                              <td className={`px-3 py-2 text-right font-mono font-semibold tabular-nums ${changed ? "text-warning-ink" : "text-success-ink"}`}>
                                {money2(row.adjustedFuelPerVehicle)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-fg-secondary">
                                {row.billed ? money2(row.billedAdjustedFuel) : "Excluded"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs">
                    <span className="text-fg-muted">Contract fuel total: {formatCurrency(preview.contractFuelTotal, { digits: 2 })}</span>
                    <span className="font-semibold text-fg">
                      Adjusted fuel total: {formatCurrency(preview.adjustedFuelTotal, { digits: 2 })}
                      {Math.abs(preview.delta) >= 0.01 && (
                        <span className={preview.delta > 0 ? " text-warning-ink" : " text-success-ink"}>
                          {" "}({preview.delta > 0 ? "+" : ""}
                          {money2(preview.delta)})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-fg-muted">Enter a petrol price to preview the fuel adjustment for this invoice.</p>
              )}
            </div>
          )}

          <FormGrid cols={2}>
            <Field label="Amount vs contract">
              <Select value={inv.amountMode} onChange={(e) => inv.setAmountMode(e.target.value as "EXACT" | "LESS" | "MORE")}>
                <option value="EXACT">Exact as contract</option>
                <option value="LESS">Less than contract</option>
                <option value="MORE">More than contract</option>
              </Select>
            </Field>
            {inv.amountMode !== "EXACT" && (
              <Field label="Amount difference (PKR)">
                <Input type="number" min={0} value={inv.amountDelta} onChange={(e) => inv.setAmountDelta(e.target.value)} placeholder="e.g. 25000" />
              </Field>
            )}
            <Field label="Invoice discount" hint="Optional.">
              <Select
                value={inv.shuttleDiscountType}
                onChange={(e) => {
                  inv.setShuttleDiscountType(e.target.value as "NONE" | "PERCENTAGE" | "FLAT");
                  inv.setShuttleDiscountValue("");
                }}
              >
                <option value="NONE">No discount</option>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat amount (PKR)</option>
              </Select>
            </Field>
            {inv.shuttleDiscountType !== "NONE" && (
              <Field label={inv.shuttleDiscountType === "PERCENTAGE" ? "Discount %" : "Discount amount (PKR)"}>
                <Input
                  type="number"
                  min={0}
                  value={inv.shuttleDiscountValue}
                  onChange={(e) => inv.setShuttleDiscountValue(e.target.value)}
                  placeholder={inv.shuttleDiscountType === "PERCENTAGE" ? "e.g. 10" : "e.g. 5000"}
                />
              </Field>
            )}
          </FormGrid>

          <div className="space-y-3 border-t border-line pt-4">
            <Checkbox
              checked={inv.isVendorCar}
              onCheckedChange={(c) => inv.setIsVendorCar(c === true)}
              label="Vehicle is from a vendor (external)"
              description="Records the vendor and internal cost against this invoice."
            />
            {inv.isVendorCar && (
              <FormGrid cols={2}>
                <Field label="Vendor" hint={inv.vendorsTruncated ? `Showing the first ${PICKER_LIMIT} vendors only.` : undefined}>
                  <Select value={inv.selectedVendorId} onChange={(e) => inv.setSelectedVendorId(e.target.value)} placeholder="Select a vendor">
                    {inv.allVendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Vendor cost (internal)">
                  <Input type="number" min={0} value={inv.vendorCost} onChange={(e) => inv.setVendorCost(e.target.value)} placeholder="e.g. 150000" />
                </Field>
              </FormGrid>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
