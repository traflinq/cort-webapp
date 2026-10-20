"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../../../lib/services/api-client";
import type { ChauffeurContract } from "../../../../lib/services/types/pricing";
import { Field, Input, Select } from "../../../ui";
import { formatCurrency } from "../../../lib/format";

export type ChauffeurFuelMode = "CONTRACT" | "SELECTED";

type Props = {
  companyId?: number | null;
  vehicleModel?: string | null;
  distanceKm: string;
  fuelMode: ChauffeurFuelMode;
  selectedFuelPrice: string;
  onFuelModeChange: (mode: ChauffeurFuelMode) => void;
  onSelectedFuelPriceChange: (value: string) => void;
};

function parsePositiveNumber(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function calculateAdjustedRate(
  baseRate: number,
  contractBase: number,
  currentPrice: number,
  revisionPercentage: number | null,
): { adjusted: number; willAdjust: boolean; percentChange: number } {
  if (!contractBase) return { adjusted: baseRate, willAdjust: false, percentChange: 0 };
  const percentChange = (currentPrice - contractBase) / contractBase;
  const willAdjust = revisionPercentage === null || Math.abs(percentChange) > revisionPercentage;
  return { adjusted: willAdjust ? baseRate * (currentPrice / contractBase) : baseRate, willAdjust, percentChange };
}

const money2 = (n: number) => formatCurrency(n, { digits: 2 });

export function ChauffeurFuelBillingSection({ companyId, vehicleModel, distanceKm, fuelMode, selectedFuelPrice, onFuelModeChange, onSelectedFuelPriceChange }: Props) {
  const [contract, setContract] = useState<ChauffeurContract | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const res: unknown = await apiClient.getChauffeurContracts(companyId);
        const raw = res as { data?: ChauffeurContract[] | { data?: ChauffeurContract[] } } | ChauffeurContract[];
        const contracts: ChauffeurContract[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray((raw?.data as { data?: ChauffeurContract[] })?.data)
              ? ((raw?.data as { data?: ChauffeurContract[] }).data as ChauffeurContract[])
              : [];
        if (!cancelled) {
          setContract(contracts[0] ?? null);
          setLoadError(contracts[0] ? null : "No chauffeur contract found for this company.");
        }
      } catch {
        if (!cancelled) setLoadError("Could not load the chauffeur contract.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (fuelMode !== "SELECTED" || selectedFuelPrice) return;
    (async () => {
      try {
        const petrol = await apiClient.getSystemSetting("current_fuel_price");
        const value = petrol?.data?.value;
        if (value) onSelectedFuelPriceChange(value);
      } catch {
        // User can type a price.
      }
    })();
  }, [fuelMode, selectedFuelPrice, onSelectedFuelPriceChange]);

  const preview = useMemo(() => {
    if (!contract) return null;
    const petrolBase = parsePositiveNumber(contract.fuel_base_price) ?? 0;
    const revisionRaw = contract.revision_percentage;
    const revision = revisionRaw == null || revisionRaw === "" ? null : Number(revisionRaw);
    const safeRevision = revision != null && Number.isFinite(revision) ? revision : null;
    const rate = (contract.chauffeur_contract_rates ?? []).find((r) => r.vehicle_model === vehicleModel);
    const baseCostPerKm = Number(rate?.cost_per_km ?? 0);
    const distance = Number(distanceKm);
    const billedDistance = Number.isFinite(distance) && distance > 0 ? distance : 0;

    const selectedPrice = parsePositiveNumber(selectedFuelPrice);
    const billedPrice = fuelMode === "CONTRACT" ? petrolBase : selectedPrice;
    if (billedPrice == null || petrolBase <= 0 || !rate) return null;

    const fuel = calculateAdjustedRate(baseCostPerKm, petrolBase, billedPrice, safeRevision);
    const effectiveCostPerKm = fuelMode === "CONTRACT" ? baseCostPerKm : fuel.adjusted;
    const roundedCostPerKm = Math.round(effectiveCostPerKm);
    const contractFuelTotal = Math.round(baseCostPerKm) * billedDistance;
    const adjustedFuelTotal = roundedCostPerKm * billedDistance;

    return {
      revisionLabel: safeRevision == null ? "No limit (always revises)" : `${(safeRevision * 100).toFixed(1)}%`,
      baseCostPerKm,
      roundedCostPerKm,
      billedDistance,
      percentChange: fuel.percentChange,
      willAdjust: fuelMode === "CONTRACT" ? false : fuel.willAdjust,
      contractFuelTotal,
      adjustedFuelTotal,
      delta: adjustedFuelTotal - contractFuelTotal,
      vehicleModel: rate.vehicle_model,
      changed: Math.abs(roundedCostPerKm - Math.round(baseCostPerKm)) > 0,
    };
  }, [contract, vehicleModel, distanceKm, fuelMode, selectedFuelPrice]);

  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Fuel billing</h4>
      <Field
        label="How to bill fuel for this invoice"
        error={loadError}
        hint={
          !loadError && contract?.fuel_base_price
            ? `Contract petrol base: PKR ${contract.fuel_base_price}/L${
                contract.revision_percentage != null && contract.revision_percentage !== ""
                  ? ` · Threshold: ${(Number(contract.revision_percentage) * 100).toFixed(1)}%`
                  : " · Always revises with fuel price"
              }`
            : undefined
        }
      >
        <Select value={fuelMode} onChange={(e) => onFuelModeChange(e.target.value as ChauffeurFuelMode)}>
          <option value="CONTRACT">Same as contract (no fuel revision)</option>
          <option value="SELECTED">Adjust to selected fuel price (this invoice only)</option>
        </Select>
      </Field>

      {fuelMode === "SELECTED" && (
        <Field label="Petrol price (PKR/L)" hint="Fuel on this invoice is revised against the contract base using this price. Global fuel settings are not changed.">
          <Input type="number" min={0} step="0.01" value={selectedFuelPrice} onChange={(e) => onSelectedFuelPriceChange(e.target.value)} placeholder="e.g. 264.61" mono />
        </Field>
      )}

      {preview ? (
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="space-y-1 bg-subtle px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Fuel adjustment preview</div>
            <p className="text-xs text-fg-secondary">
              {fuelMode === "CONTRACT" ? (
                "Fuel is billed at the contract cost/km with no petrol revision."
              ) : (
                <>
                  Contract threshold: {preview.revisionLabel}. Selected petrol is {preview.percentChange >= 0 ? "+" : ""}
                  {(preview.percentChange * 100).toFixed(1)}% vs contract
                  {preview.willAdjust ? " — cost/km will be revised." : " — within threshold, cost/km stays as contract."}
                </>
              )}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-subtle text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">
                    Vehicle
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Contract / km
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Billed / km
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    This invoice fuel
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line">
                  <td className="px-3 py-2">
                    <div className="font-medium text-fg">{preview.vehicleModel}</div>
                    <div className="text-fg-muted">{preview.billedDistance > 0 ? `${preview.billedDistance} km` : "Enter distance to see billed fuel"}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-fg">{preview.baseCostPerKm.toFixed(2)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold tabular-nums ${preview.changed ? "text-warning-ink" : "text-success-ink"}`}>{preview.roundedCostPerKm}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-fg">{preview.billedDistance > 0 ? money2(preview.adjustedFuelTotal) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {preview.billedDistance > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs">
              <span className="text-fg-muted">Contract fuel: {money2(preview.contractFuelTotal)}</span>
              <span className="font-semibold text-fg">
                Billed fuel: {money2(preview.adjustedFuelTotal)}
                {Math.abs(preview.delta) >= 0.01 && (
                  <span className={preview.delta > 0 ? " text-warning-ink" : " text-success-ink"}>
                    {" "}
                    ({preview.delta > 0 ? "+" : ""}
                    {money2(preview.delta)})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      ) : fuelMode === "SELECTED" ? (
        <p className="text-xs text-fg-muted">Enter a petrol price to preview the fuel adjustment for this invoice.</p>
      ) : null}
    </div>
  );
}
