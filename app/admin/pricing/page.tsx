"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { PermissionGate } from "../components/PermissionGate";
import { AdminCan, useAdminAbility } from "../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import {
  fetchPricingCompanies,
  fetchSystemFuelPrice,
  updateSystemFuelPrice,
  fetchSystemDieselPrice,
  updateSystemDieselPrice,
  fetchFuelPriceHistory,
  fetchDieselPriceHistory,
  fetchCompanyContractDetails,
  fetchShuttleContract,
  previewRateAdjustments,
  savePricingChanges,
  saveShuttleChanges,
  deleteRateRow,
  setSelectedCompanyId,
  setGlobalSettings,
  setShuttleSettings,
  setSystemFuelPriceLocal,
  setSystemDieselPriceLocal,
  setShowPreview,
  addRateRow,
  updateRateRow,
  resetActionStatus,
  selectPricingCompanies,
  selectPricingCurrentCompany,
  selectAdminPricingState,
  selectShuttleSettings,
  selectShuttleRouteRows,
  addShuttleRouteRow,
  updateShuttleRouteRow,
  removeShuttleRouteRow,
} from "../../lib/store/slices/adminPricingSlice";
import { ChauffeurContractRate, FuelPriceHistoryEntry, apiClient } from "../../lib/services/api-client";

const Input = ({
  label,
  value,
  onChange,
  placeholder = "0",
  type = "number",
  helperText,
  disabled,
  ...rest
}: any) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      {...rest}
      className="h-10 rounded-lg border border-[var(--border-default)] px-3 text-sm outline-none focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] transition-all disabled:cursor-not-allowed disabled:bg-[var(--bg-subtle)] disabled:opacity-70"
    />
    {helperText && <span className="text-xs text-[var(--text-muted)]">{helperText}</span>}
  </label>
);

const FuelPriceHistoryChart = ({
  data,
  color,
  gradientId,
}: {
  data: FuelPriceHistoryEntry[];
  color: string;
  gradientId: string;
}) => {
  const chartData = data.map((entry) => ({
    date: new Date(entry.effective_from).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    fullDate: new Date(entry.effective_from).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    price: Number(entry.price),
  }));

  if (chartData.length < 2) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-[var(--text-muted)]">
        Not enough history yet — make another price update to see the trend.
      </div>
    );
  }

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} dy={8} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            width={44}
            domain={["dataMin - 5", "dataMax + 5"]}
          />
          <Tooltip
            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", fontSize: "12px" }}
            formatter={(value: any) => [`PKR ${value}`, "Price"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""}
          />
          <Area type="stepAfter" dataKey="price" stroke={color} strokeWidth={2.5} fillOpacity={1} fill={`url(#${gradientId})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0c225e] border-t-transparent" />
        </div>
      }
    >
      <PermissionGate permission="pricing">
        <AdminCan I="read" a="Pricing">
          <PricingPageContent />
        </AdminCan>
      </PermissionGate>
    </Suspense>
  );
}

function PricingPageContent() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const companies = useAppSelector(selectPricingCompanies);
  const currentCompany = useAppSelector(selectPricingCurrentCompany);
  const {
    selectedCompanyId,
    globalSettings,
    rateRows,
    systemFuelPrice,
    systemDieselPrice,
    fuelPriceHistory,
    dieselPriceHistory,
    showPreview,
    previewData,
    isLoadingPreview,
    status,
    actionStatus,
    error
  } = useAppSelector(selectAdminPricingState);
  const shuttleSettings = useAppSelector(selectShuttleSettings);
  const shuttleRouteRows = useAppSelector(selectShuttleRouteRows);

  const ability = useAdminAbility();
  const canCreate = ability.can("create", ADMIN_SUBJECTS.pricing);
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.pricing);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.pricing);
  const canAddRows = canCreate || canUpdate;

  const [showMarketRates, setShowMarketRates] = useState(false);
  const [externalFuelLoading, setExternalFuelLoading] = useState(false);
  const [externalFuelApplying, setExternalFuelApplying] = useState(false);
  const [externalFuelError, setExternalFuelError] = useState<string | null>(null);
  const [externalFuelSuggestion, setExternalFuelSuggestion] = useState<{
    petrolPrice: string;
    dieselPrice: string;
    asOf?: string;
  } | null>(null);

  // Initial load
  useEffect(() => {
    dispatch(fetchPricingCompanies());
    dispatch(fetchSystemFuelPrice());
    dispatch(fetchSystemDieselPrice());
    dispatch(fetchFuelPriceHistory());
    dispatch(fetchDieselPriceHistory());
  }, [dispatch]);

  // Deep-link from company detail: /admin/pricing?companyId=123
  useEffect(() => {
    const cid = searchParams.get("company") || searchParams.get("companyId");
    if (cid) {
      dispatch(setSelectedCompanyId(cid));
    }
  }, [dispatch, searchParams]);

  // Load Contract Details when company selected
  useEffect(() => {
    if (selectedCompanyId) {
      dispatch(fetchCompanyContractDetails(selectedCompanyId));
      dispatch(fetchShuttleContract(selectedCompanyId));
    }
  }, [selectedCompanyId, dispatch]);

  // Handle action status updates
  useEffect(() => {
    if (actionStatus === 'succeeded') {
      alert("Action completed successfully!");
      dispatch(resetActionStatus());
    } else if (actionStatus === 'failed' && error) {
      alert("Action failed: " + error);
      dispatch(resetActionStatus());
    }
  }, [actionStatus, error, dispatch]);


  const handleUpdateGlobalFuel = async () => {
    await dispatch(updateSystemFuelPrice(systemFuelPrice));
    dispatch(fetchFuelPriceHistory());
  };

  const handleUpdateGlobalDiesel = async () => {
    await dispatch(updateSystemDieselPrice(systemDieselPrice));
    dispatch(fetchDieselPriceHistory());
  };

  const handleFetchExternalFuelPrices = async () => {
    setExternalFuelLoading(true);
    setExternalFuelError(null);
    try {
      const result = await apiClient.getExternalFuelPricesLatest();
      setExternalFuelSuggestion(result);
    } catch (e) {
      setExternalFuelSuggestion(null);
      setExternalFuelError(e instanceof Error ? e.message : "Failed to fetch external fuel prices");
    } finally {
      setExternalFuelLoading(false);
    }
  };

  const handleApplyExternalFuelPrices = async () => {
    if (!externalFuelSuggestion || !canUpdate) return;

    const petrolPrice = String(externalFuelSuggestion.petrolPrice);
    const dieselPrice = String(externalFuelSuggestion.dieselPrice);

    dispatch(setSystemFuelPriceLocal(petrolPrice));
    dispatch(setSystemDieselPriceLocal(dieselPrice));
    setExternalFuelApplying(true);
    setExternalFuelError(null);

    try {
      // Persist both globally in one click (bypass per-field Update buttons).
      await Promise.all([
        apiClient.updateSystemSetting("current_fuel_price", petrolPrice),
        apiClient.updateSystemSetting("current_diesel_price", dieselPrice),
      ]);
      await Promise.all([
        dispatch(fetchSystemFuelPrice()),
        dispatch(fetchSystemDieselPrice()),
        dispatch(fetchFuelPriceHistory()),
        dispatch(fetchDieselPriceHistory()),
      ]);
      alert("Petrol and diesel prices updated successfully!");
    } catch (e) {
      setExternalFuelError(e instanceof Error ? e.message : "Failed to update fuel prices");
    } finally {
      setExternalFuelApplying(false);
    }
  };

  const handlePreviewAdjustments = () => {
    if (!selectedCompanyId) return;
    dispatch(setShowPreview(true));
    dispatch(previewRateAdjustments({
      fuelPrice: Number(systemFuelPrice),
      companyId: Number(selectedCompanyId)
    }));
  };

  const handleDeleteRow = (index: number) => {
    const row = rateRows[index];
    if (row.id) {
      if (!confirm("Are you sure you want to delete this rate card?")) return;
    }
    dispatch(deleteRateRow(index));
  };

  const handleSave = () => {
    dispatch(savePricingChanges());
  };

  const handleShuttleSave = () => {
    dispatch(saveShuttleChanges());
  };

  const formatExternalAsOf = (asOf?: string) => {
    if (!asOf) return "";
    const d = new Date(asOf);
    if (Number.isNaN(d.getTime())) return asOf;
    return d.toLocaleString("en-GB", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSavings = (contractVal: string | number | undefined, marketVal: string | number | undefined) => {
    const c = Number(contractVal || 0);
    const m = Number(marketVal || 0);
    if (!m || !c || m <= c) return null;
    const diff = m - c;
    const pct = (diff / m) * 100;
    return (
      <div className="text-[10px] font-bold text-green-600 flex items-center gap-1">
        <span>↓ {pct.toFixed(0)}%</span>
        <span className="text-green-600/70">({diff.toLocaleString()})</span>
      </div>
    );
  };

  const isLoading = status === 'loading';
  const isSaving = actionStatus === 'loading';
  const isUpdatingFuel = actionStatus === 'loading'; // Simplified for now, could distinct

  return (
    <div className="flex flex-col gap-8 mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Contracts & Pricing</h1>
          <p className="mt-2 text-[var(--text-muted)]">Manage client-specific rates and contract terms with dynamic fuel price adjustments.</p>
        </div>
        <label className="flex flex-col gap-1.5 min-w-[300px]">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Select Company</span>
          <select
            value={selectedCompanyId}
            onChange={(e) => dispatch(setSelectedCompanyId(e.target.value))}
            className="h-11 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-sm font-medium outline-none focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] transition-all"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Global Fuel System Setting */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Global Fuel Configuration</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Set the current fuel price. Rates are calculated dynamically during invoice generation.</p>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleFetchExternalFuelPrices}
            disabled={externalFuelLoading}
            className="h-10 px-4 rounded-lg border border-blue-200 bg-white/10 text-[var(--text-primary)] text-sm font-bold hover:bg-white/15 transition-colors disabled:opacity-70"
          >
            {externalFuelLoading ? "Checking..." : "Fetch latest prices"}
          </button>

          {externalFuelError && (
            <div className="text-sm text-rose-500 font-semibold">{externalFuelError}</div>
          )}
        </div>

        {externalFuelSuggestion && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold text-[var(--text-primary)]">Suggested global fuel prices</div>
              <div className="text-xs text-[var(--text-muted)]">
                {externalFuelSuggestion.asOf ? `As of ${formatExternalAsOf(externalFuelSuggestion.asOf)}` : "Latest snapshot"}
              </div>
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              Petrol: <span className="font-bold text-[var(--text-primary)]">PKR {Number(externalFuelSuggestion.petrolPrice).toFixed(2)}</span>
              <span className="mx-2">|</span>
              Diesel: <span className="font-bold text-[var(--text-primary)]">PKR {Number(externalFuelSuggestion.dieselPrice).toFixed(2)}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleApplyExternalFuelPrices}
                disabled={!canUpdate || externalFuelApplying}
                className="h-9 px-4 rounded-lg bg-[#0c225e] text-white text-sm font-bold hover:bg-[#0a1a4a] transition-colors disabled:opacity-70"
              >
                {externalFuelApplying ? "Updating..." : "Apply & update both"}
              </button>
              <div className="text-xs text-[var(--text-muted)] self-center">
                Fills both fields and saves petrol + diesel globally in one click.
              </div>
            </div>
          </div>
        )}
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex-1 min-w-[200px]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Current Fuel Price (PKR)</span>
            <input
              type="number"
              value={systemFuelPrice}
              onChange={(e) => dispatch(setSystemFuelPriceLocal(e.target.value))}
              disabled={!canUpdate}
              className="h-10 w-full rounded-lg border border-[var(--border-default)] px-3 text-sm outline-none focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] disabled:cursor-not-allowed disabled:bg-[var(--bg-subtle)] disabled:opacity-70"
            />
          </label>
          <button
            onClick={handleUpdateGlobalFuel}
            className="h-10 px-4 rounded-lg bg-[#0c225e] text-white text-sm font-bold hover:bg-[#0a1a4a] transition-colors disabled:opacity-70"
            disabled={!canUpdate || isUpdatingFuel}
          >
            {isUpdatingFuel ? "Updating..." : "Update"}
          </button>
          <button
            onClick={handlePreviewAdjustments}
            className="h-10 px-4 rounded-lg border-2 border-[#f47f00] text-[#f47f00] text-sm font-bold hover:bg-[#f47f00] hover:text-white transition-all disabled:opacity-70"
            disabled={isLoadingPreview}
          >
            {isLoadingPreview ? "Loading..." : "Preview Adjustments"}
          </button>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Price History</span>
          <FuelPriceHistoryChart data={fuelPriceHistory} color="#f47f00" gradientId="colorFuelHistory" />
        </div>
      </div>

      {/* Global Diesel Rate (Shuttle Only) */}
      <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Global Diesel Rate <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Shuttle Only</span></h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Set the current diesel price used for shuttle route rows marked as Diesel. Adjusted dynamically at invoice generation.</p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex-1 min-w-[200px]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Current Diesel Price (PKR)</span>
            <input
              type="number"
              value={systemDieselPrice}
              onChange={(e) => dispatch(setSystemDieselPriceLocal(e.target.value))}
              disabled={!canUpdate}
              className="h-10 w-full rounded-lg border border-[var(--border-default)] px-3 text-sm outline-none focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] disabled:cursor-not-allowed disabled:bg-[var(--bg-subtle)] disabled:opacity-70"
            />
          </label>
          <button
            onClick={handleUpdateGlobalDiesel}
            className="h-10 px-4 rounded-lg bg-[#0c225e] text-white text-sm font-bold hover:bg-[#0a1a4a] transition-colors disabled:opacity-70"
            disabled={!canUpdate || isUpdatingFuel}
          >
            Update
          </button>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Price History</span>
          <FuelPriceHistoryChart data={dieselPriceHistory} color="#d97706" gradientId="colorDieselHistory" />
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Rate Adjustment Preview</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">How rates will be adjusted at fuel price: PKR {systemFuelPrice}</p>
            </div>
            <button onClick={() => dispatch(setShowPreview(false))} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">✕</button>
          </div>
          {previewData && previewData.length > 0 && (
            <div className="space-y-4">
              {previewData.map((item: any, idx: number) => (
                <div key={idx} className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border-default)]">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-[var(--text-primary)]">{item.company?.name || 'Company'}</h4>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-[var(--text-secondary)]">
                        {item.type === 'shuttle' ? 'Shuttle' : 'Chauffeur'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.calculation.will_adjust ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        Petrol: {item.calculation.will_adjust ? 'Will Adjust' : 'No Adjustment'}
                      </span>
                      {item.type === 'shuttle' && item.diesel_calculation && (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.diesel_calculation.will_adjust ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          Diesel: {item.diesel_calculation.will_adjust ? 'Will Adjust' : 'No Adjustment'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Petrol row */}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2 bg-blue-50/50 rounded p-2">
                    <div className="col-span-2 text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Petrol</div>
                    <div><span className="text-[var(--text-muted)]">Base Fuel Price:</span> <span className="font-semibold">PKR {Number(item.contract.fuel_base_price).toFixed(0)}</span></div>
                    <div><span className="text-[var(--text-muted)]">Threshold:</span> <span className="font-semibold">{item.contract.revision_percentage != null ? `${(Number(item.contract.revision_percentage) * 100).toFixed(1)}%` : 'No Limit'}</span></div>
                    <div><span className="text-[var(--text-muted)]">Price Change:</span> <span className="font-semibold text-orange-600">{(Number(item.calculation.percent_change) * 100).toFixed(2)}%</span></div>
                    <div><span className="text-[var(--text-muted)]">Multiplier:</span> <span className="font-semibold">{Number(item.calculation.multiplier).toFixed(4)}x</span></div>
                  </div>

                  {/* Diesel row (shuttle only, when diesel_base_price is set) */}
                  {item.type === 'shuttle' && item.diesel_calculation && (
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3 bg-amber-50/50 rounded p-2">
                      <div className="col-span-2 text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Diesel</div>
                      <div><span className="text-[var(--text-muted)]">Base Diesel Price:</span> <span className="font-semibold">PKR {Number(item.diesel_calculation.diesel_base_price).toFixed(0)}</span></div>
                      <div><span className="text-[var(--text-muted)]">Threshold:</span> <span className="font-semibold">{item.contract.revision_percentage != null ? `${(Number(item.contract.revision_percentage) * 100).toFixed(1)}%` : 'No Limit'}</span></div>
                      <div><span className="text-[var(--text-muted)]">Price Change:</span> <span className="font-semibold text-amber-600">{(Number(item.diesel_calculation.percent_change) * 100).toFixed(2)}%</span></div>
                      <div><span className="text-[var(--text-muted)]">Multiplier:</span> <span className="font-semibold">{Number(item.diesel_calculation.multiplier).toFixed(4)}x</span></div>
                    </div>
                  )}
                  {(item.type !== 'shuttle') && item.rates?.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-[var(--bg-subtle)]">
                          <tr>
                            <th className="px-2 py-2 text-left">Vehicle</th>
                            <th className="px-2 py-2 text-right">Base Cost/KM</th>
                            <th className="px-2 py-2 text-right">Adjusted Cost/KM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.rates.map((rate: any, rIdx: number) => (
                            <tr key={rIdx} className="border-t">
                              <td className="px-2 py-2">{rate.vehicle_model}</td>
                              <td className="px-2 py-2 text-right">PKR {Number(rate.base_cost_per_km).toFixed(2)}</td>
                              <td className={`px-2 py-2 text-right font-semibold ${rate.base_cost_per_km !== rate.adjusted_cost_per_km ? 'text-orange-600' : 'text-green-600'}`}>
                                PKR {Number(rate.adjusted_cost_per_km).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {item.type === 'shuttle' && item.routes?.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-[var(--bg-subtle)]">
                          <tr>
                            <th className="px-2 py-2 text-left">Particulars</th>
                            <th className="px-2 py-2 text-left">Vehicle Type</th>
                            <th className="px-2 py-2 text-right">Base Fuel/Vehicle</th>
                            <th className="px-2 py-2 text-right">Adjusted Fuel/Vehicle</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.routes.map((route: any, rIdx: number) => (
                            <tr key={rIdx} className="border-t">
                              <td className="px-2 py-2">{route.particulars}</td>
                              <td className="px-2 py-2">{route.vehicle_type}</td>
                              <td className="px-2 py-2 text-right">PKR {Number(route.base_fuel_cost_per_vehicle).toFixed(2)}</td>
                              <td className={`px-2 py-2 text-right font-semibold ${Number(route.base_fuel_cost_per_vehicle) !== Number(route.adjusted_fuel_cost_per_vehicle) ? 'text-orange-600' : 'text-green-600'}`}>
                                PKR {Number(route.adjusted_fuel_cost_per_vehicle).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading && <div className="p-12 text-center text-[var(--text-muted)]">Loading...</div>}

      {!isLoading && currentCompany && (
        <>
          {/* Chauffeur Section */}
          {currentCompany.is_chauffeur_enabled ? (
            <div className="flex flex-col gap-6">
              {/* Contract Settings */}
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-sm">
                <div className="mb-6 border-b border-[var(--border-default)] pb-4">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Chauffeur Contract Terms</h2>
                  <p className="text-sm text-[var(--text-muted)]">Global settings for this company.</p>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Input
                    label="Base Fuel Price (PKR)"
                    value={globalSettings.fuelBasePrice}
                    onChange={(v: string) => dispatch(setGlobalSettings({ fuelBasePrice: v }))}
                    disabled={!canUpdate}
                  />
                  <Input
                    label="Revision Threshold (%)"
                    value={globalSettings.revisionPercentage}
                    onChange={(v: string) => dispatch(setGlobalSettings({ revisionPercentage: v }))}
                    helperText="Recommended: 10–20. Leave empty to always adjust rates with fuel price changes."
                    disabled={!canUpdate}
                    min={0}
                    max={100}
                  />
                  <Input
                    label="Outstation Allowance"
                    value={globalSettings.allowanceOutstation}
                    onChange={(v: string) => dispatch(setGlobalSettings({ allowanceOutstation: v }))}
                    disabled={!canUpdate}
                  />
                  <Input
                    label="Accommodation Allowance"
                    value={globalSettings.allowanceAccommodation}
                    onChange={(v: string) => dispatch(setGlobalSettings({ allowanceAccommodation: v }))}
                    disabled={!canUpdate}
                  />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Contract Duration</span>
                    <select
                      value={globalSettings.contractDuration}
                      onChange={(e) => dispatch(setGlobalSettings({ contractDuration: e.target.value }))}
                      disabled={!canUpdate}
                      className="h-10 rounded-lg border border-[var(--border-default)] px-3 text-sm outline-none focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] transition-all bg-[var(--bg-card)] disabled:cursor-not-allowed disabled:bg-[var(--bg-subtle)] disabled:opacity-70"
                    >
                      <option value="">Select Duration</option>
                      <option value="6 Months">6 Months</option>
                      <option value="1 Year">1 Year</option>
                      <option value="2 Years">2 Years</option>
                      <option value="3 Years">3 Years</option>
                      <option value="5 Years">5 Years</option>
                    </select>
                  </label>
                  <Input
                    label="Contract Date"
                    value={globalSettings.contractDate}
                    onChange={(v: string) => dispatch(setGlobalSettings({ contractDate: v }))}
                    type="date"
                    disabled={!canUpdate}
                  />
                </div>
              </div>

              {/* Rates Table */}
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
                <div className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/50 px-6 py-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">Vehicle Rates</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Base rates - actual billing rates calculated dynamically.</p>
                  </div>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mr-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showMarketRates}
                        onChange={e => setShowMarketRates(e.target.checked)}
                        disabled={!canUpdate}
                        className="rounded border-slate-300 text-[#f47f00] focus:ring-[#f47f00]"
                      />
                      Show Market Rates
                    </label>
                    <button
                      onClick={() => dispatch(addRateRow())}
                      disabled={!canAddRows}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] px-3 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      + Add Vehicle
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!canUpdate || isSaving}
                      className="inline-flex items-center justify-center rounded-lg bg-[#f47f00] px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#d97000] disabled:opacity-70 transition-all"
                    >
                      {isSaving ? "Saving..." : "Save All Changes"}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--bg-subtle)] text-xs uppercase font-semibold text-[var(--text-muted)]">
                      <tr>
                        <th className="px-6 py-4 min-w-[200px]">Vehicle Model</th>
                        <th className="px-4 py-4 min-w-[120px]">Cost/KM (PKR)</th>
                        <th className="px-4 py-4 min-w-[100px]">5Hr Spot</th>
                        <th className="px-4 py-4 min-w-[100px]">10Hr Spot</th>
                        <th className="px-4 py-4 min-w-[100px]">24Hr Spot</th>
                        <th className="px-4 py-4 min-w-[100px]">Mth 10hr</th>
                        <th className="px-4 py-4 min-w-[100px]">Mth 24hr</th>
                        <th className="px-4 py-4 min-w-[100px]">Overtime/Hr</th>
                        <th className="px-4 py-4 w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rateRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-6 py-12 text-center text-[var(--text-muted)]">
                            No rates configured. Click "Add Vehicle" to start.
                          </td>
                        </tr>
                      ) : rateRows.map((row, idx) => (
                        <tr key={row.id || row.tempId} className="hover:bg-[var(--bg-subtle)]/50">
                          <td className="px-6 py-3">
                            <input
                              disabled={!canUpdate}
                              className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-300"
                              value={row.vehicle_model}
                              onChange={e => dispatch(updateRateRow({ index: idx, field: 'vehicle_model', value: e.target.value }))}
                              placeholder="e.g. Honda City"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <input disabled={!canUpdate} className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm" value={row.cost_per_km} onChange={e => dispatch(updateRateRow({ index: idx, field: 'cost_per_km', value: e.target.value }))} placeholder="Contract" />
                              {showMarketRates && (
                                <>
                                  <input disabled={!canUpdate} className="w-full h-9 rounded border border-orange-200 bg-orange-50 px-2 text-sm" value={row.market_cost_per_km} onChange={e => dispatch(updateRateRow({ index: idx, field: 'market_cost_per_km', value: e.target.value }))} placeholder="Market" />
                                  {getSavings(row.cost_per_km, row.market_cost_per_km)}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <input disabled={!canUpdate} className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm" value={row.rate_spot_5hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'rate_spot_5hr', value: e.target.value }))} placeholder="Contract" />
                              {showMarketRates && (
                                <>
                                  <input disabled={!canUpdate} className="w-full h-9 rounded border border-orange-200 bg-orange-50 px-2 text-sm" value={row.market_rate_spot_5hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'market_rate_spot_5hr', value: e.target.value }))} placeholder="Market" />
                                  {getSavings(row.rate_spot_5hr, row.market_rate_spot_5hr)}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <input disabled={!canUpdate} className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm" value={row.rate_spot_10hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'rate_spot_10hr', value: e.target.value }))} placeholder="Contract" />
                              {showMarketRates && (
                                <>
                                  <input disabled={!canUpdate} className="w-full h-9 rounded border border-orange-200 bg-orange-50 px-2 text-sm" value={row.market_rate_spot_10hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'market_rate_spot_10hr', value: e.target.value }))} placeholder="Market" />
                                  {getSavings(row.rate_spot_10hr, row.market_rate_spot_10hr)}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <input disabled={!canUpdate} className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm" value={row.rate_spot_24hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'rate_spot_24hr', value: e.target.value }))} placeholder="Contract" />
                              {showMarketRates && (
                                <>
                                  <input disabled={!canUpdate} className="w-full h-9 rounded border border-orange-200 bg-orange-50 px-2 text-sm" value={row.market_rate_spot_24hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'market_rate_spot_24hr', value: e.target.value }))} placeholder="Market" />
                                  {getSavings(row.rate_spot_24hr, row.market_rate_spot_24hr)}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <input disabled={!canUpdate} className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm" value={row.rate_monthly_10hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'rate_monthly_10hr', value: e.target.value }))} placeholder="Contract" />
                              {showMarketRates && (
                                <>
                                  <input disabled={!canUpdate} className="w-full h-9 rounded border border-orange-200 bg-orange-50 px-2 text-sm" value={row.market_rate_monthly_10hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'market_rate_monthly_10hr', value: e.target.value }))} placeholder="Market" />
                                  {getSavings(row.rate_monthly_10hr, row.market_rate_monthly_10hr)}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <input disabled={!canUpdate} className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm" value={row.rate_monthly_24hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'rate_monthly_24hr', value: e.target.value }))} placeholder="Contract" />
                              {showMarketRates && (
                                <>
                                  <input disabled={!canUpdate} className="w-full h-9 rounded border border-orange-200 bg-orange-50 px-2 text-sm" value={row.market_rate_monthly_24hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'market_rate_monthly_24hr', value: e.target.value }))} placeholder="Market" />
                                  {getSavings(row.rate_monthly_24hr, row.market_rate_monthly_24hr)}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <input disabled={!canUpdate} className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm" value={row.rate_overtime_per_hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'rate_overtime_per_hr', value: e.target.value }))} placeholder="Contract" />
                              {showMarketRates && (
                                <>
                                  <input disabled={!canUpdate} className="w-full h-9 rounded border border-orange-200 bg-orange-50 px-2 text-sm" value={row.market_rate_overtime_per_hr} onChange={e => dispatch(updateRateRow({ index: idx, field: 'market_rate_overtime_per_hr', value: e.target.value }))} placeholder="Market" />
                                  {getSavings(row.rate_overtime_per_hr, row.market_rate_overtime_per_hr)}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(idx)}
                              disabled={!canDelete}
                              className="text-red-400 hover:text-red-600 p-1 disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {currentCompany.is_shuttle_enabled && (
            <div className="flex flex-col gap-6 mt-6">
              {/* Shuttle Contract Settings */}
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-sm">
                <div className="mb-6 border-b border-[var(--border-default)] pb-4">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Shuttle Contract Terms</h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    Monthly shuttle contract settings for this company. Fuel cost per vehicle is adjusted using the same
                    fuel revision logic as chauffeur contracts.
                  </p>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Input
                    label="Base Fuel Price (PKR)"
                    value={shuttleSettings.fuelBasePrice}
                    onChange={(v: string) => dispatch(setShuttleSettings({ fuelBasePrice: v }))}
                    disabled={!canUpdate}
                  />
                  <Input
                    label="Base Diesel Price (PKR)"
                    value={shuttleSettings.dieselBasePrice}
                    onChange={(v: string) => dispatch(setShuttleSettings({ dieselBasePrice: v }))}
                    placeholder="0"
                    helperText="Required for any route rows marked as Diesel"
                    disabled={!canUpdate}
                  />
                  <Input
                    label="Revision Threshold (%)"
                    value={shuttleSettings.revisionPercentage}
                    onChange={(v: string) => dispatch(setShuttleSettings({ revisionPercentage: v }))}
                    helperText="Recommended: 10–20. Leave empty to always adjust fuel cost with fuel price changes."
                    disabled={!canUpdate}
                    min={0}
                    max={100}
                  />
                  <Input
                    label="S.S.T (%)"
                    value={shuttleSettings.sstPercentage}
                    onChange={(v: string) => dispatch(setShuttleSettings({ sstPercentage: v }))}
                    placeholder="10"
                    disabled={!canUpdate}
                  />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Contract Duration</span>
                    <select
                      value={shuttleSettings.contractDuration}
                      onChange={(e) => dispatch(setShuttleSettings({ contractDuration: e.target.value }))}
                      disabled={!canUpdate}
                      className="h-10 rounded-lg border border-[var(--border-default)] px-3 text-sm outline-none focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] transition-all bg-[var(--bg-card)] disabled:cursor-not-allowed disabled:bg-[var(--bg-subtle)] disabled:opacity-70"
                    >
                      <option value="">Select Duration</option>
                      <option value="6 Months">6 Months</option>
                      <option value="1 Year">1 Year</option>
                      <option value="2 Years">2 Years</option>
                      <option value="3 Years">3 Years</option>
                      <option value="5 Years">5 Years</option>
                    </select>
                  </label>
                  <Input
                    label="Contract Date"
                    value={shuttleSettings.contractDate}
                    onChange={(v: string) => dispatch(setShuttleSettings({ contractDate: v }))}
                    type="date"
                    disabled={!canUpdate}
                  />
                </div>
              </div>

              {/* Shuttle Route Rates */}
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
                <div className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/50 px-6 py-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">Shuttle Route Rates</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Fixed monthly service & fuel cost per vehicle for each shuttle leg.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => dispatch(addShuttleRouteRow())}
                      disabled={!canAddRows}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50 disabled:pointer-events-none"
                    >
                      + Add Shuttle Route
                    </button>
                    <button
                      onClick={handleShuttleSave}
                      disabled={!canUpdate || isSaving}
                      className="inline-flex items-center justify-center rounded-lg bg-[#f47f00] px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#d97000] disabled:opacity-70 transition-all"
                    >
                      {isSaving ? "Saving..." : "Save Shuttle Contract"}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--bg-subtle)] text-xs uppercase font-semibold text-[var(--text-muted)]">
                      <tr>
                        <th className="px-6 py-4 min-w-[220px]">Particulars</th>
                        <th className="px-4 py-4 min-w-[120px]">Vehicle Type</th>
                        <th className="px-4 py-4 min-w-[110px]">Fuel Type</th>
                        <th className="px-4 py-4 min-w-[140px]">Fixed Cost / Vehicle</th>
                        <th className="px-4 py-4 min-w-[140px]">Fuel Cost / Vehicle</th>
                        <th className="px-4 py-4 min-w-[130px]">Billing Type</th>
                        <th className="px-4 py-4 min-w-[120px]">Sched. Days</th>
                        <th className="px-4 py-4 min-w-[80px] text-center">Qty</th>
                        <th className="px-4 py-4 w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shuttleRouteRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-12 text-center text-[var(--text-muted)]">
                            No shuttle routes configured. Click &quot;Add Shuttle Route&quot; to start.
                          </td>
                        </tr>
                      ) : (
                        shuttleRouteRows.map((row, idx) => (
                          <tr key={row.id || row.tempId} className="hover:bg-[var(--bg-subtle)]/50">
                            <td className="px-6 py-3">
                              <input
                                disabled={!canUpdate}
                                className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-300"
                                value={row.particulars || ""}
                                onChange={(e) =>
                                  dispatch(
                                    updateShuttleRouteRow({
                                      index: idx,
                                      field: "particulars",
                                      value: e.target.value,
                                    }),
                                  )
                                }
                                placeholder="e.g. Karachi to DFML - BUS"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm"
                                value={row.vehicle_type || ""}
                                onChange={(e) =>
                                  dispatch(
                                    updateShuttleRouteRow({
                                      index: idx,
                                      field: "vehicle_type",
                                      value: e.target.value,
                                    }),
                                  )
                                }
                                placeholder="e.g. BUS, COASTER"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                disabled={!canUpdate}
                                className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm bg-[var(--bg-card)] focus:border-[#f47f00] focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                                value={row.fuel_type || "PETROL"}
                                onChange={(e) =>
                                  dispatch(
                                    updateShuttleRouteRow({
                                      index: idx,
                                      field: "fuel_type",
                                      value: e.target.value,
                                    }),
                                  )
                                }
                              >
                                <option value="PETROL">Petrol</option>
                                <option value="DIESEL">Diesel</option>
                              </select>
                              {row.fuel_type === "DIESEL" && (
                                <span className="text-[10px] text-amber-600 mt-1 block">Uses global diesel rate</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm"
                                value={row.fixed_cost_per_vehicle || ""}
                                onChange={(e) =>
                                  dispatch(
                                    updateShuttleRouteRow({
                                      index: idx,
                                      field: "fixed_cost_per_vehicle",
                                      value: e.target.value,
                                    }),
                                  )
                                }
                                placeholder="30000"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm"
                                value={row.fuel_cost_per_vehicle || ""}
                                onChange={(e) =>
                                  dispatch(
                                    updateShuttleRouteRow({
                                      index: idx,
                                      field: "fuel_cost_per_vehicle",
                                      value: e.target.value,
                                    }),
                                  )
                                }
                                placeholder="20000"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                disabled={!canUpdate}
                                className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm bg-[var(--bg-card)] focus:border-[#f47f00] focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                                value={row.billing_type || "MONTHLY"}
                                onChange={(e) =>
                                  dispatch(
                                    updateShuttleRouteRow({
                                      index: idx,
                                      field: "billing_type",
                                      value: e.target.value,
                                    }),
                                  )
                                }
                              >
                                <option value="MONTHLY">Monthly</option>
                                <option value="PER_TRIP">Per Trip</option>
                              </select>
                              {row.billing_type === "PER_TRIP" && (
                                <span className="text-[10px] text-amber-600 mt-1 block">Cost × trips run at invoice time</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                disabled={!canUpdate}
                                className="w-full h-9 rounded border border-[var(--border-default)] px-2 text-sm placeholder:text-slate-300 disabled:opacity-70"
                                value={row.scheduled_days || ""}
                                onChange={(e) =>
                                  dispatch(
                                    updateShuttleRouteRow({
                                      index: idx,
                                      field: "scheduled_days",
                                      value: e.target.value,
                                    }),
                                  )
                                }
                                placeholder="e.g. MON, FRI/SAT"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                disabled={!canUpdate}
                                className="w-20 h-9 rounded border border-[var(--border-default)] px-2 text-sm text-center"
                                value={row.quantity ?? 0}
                                onChange={(e) =>
                                  dispatch(
                                    updateShuttleRouteRow({
                                      index: idx,
                                      field: "quantity",
                                      value: e.target.value,
                                    }),
                                  )
                                }
                                min={0}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => dispatch(removeShuttleRouteRow(idx))}
                                disabled={!canDelete}
                                className="text-red-400 hover:text-red-600 p-1 disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M3 6h18" />
                                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
