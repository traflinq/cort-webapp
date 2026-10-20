"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, Download, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { PermissionGate } from "../components/PermissionGate";
import { AdminCan, useAdminAbility } from "../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { useConfirm } from "../../lib/hooks/useConfirm";
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
import { apiClient, type ChauffeurContractRate } from "../../lib/services/api-client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardSkeleton,
  EmptyState,
  ErrorState,
  Field,
  FormGrid,
  InlineError,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
} from "../ui";
import { formatCurrency, formatDateTime } from "../lib/format";
import { CONTRACT_DURATION_OPTIONS } from "./components/constants";
import { FuelPricePanel } from "./components/FuelPricePanel";
import { ChauffeurRatesTable } from "./components/ChauffeurRatesTable";
import { ShuttleRatesTable, type ShuttleRouteField } from "./components/ShuttleRatesTable";
import { PreviewDialog, type PreviewItem } from "./components/PreviewDialog";

type PendingAction = "fuel" | "diesel" | "chauffeur" | "shuttle" | "delete-row" | null;

export default function PricingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
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
  const confirm = useConfirm();
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
    error,
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
  const [externalFuelSuggestion, setExternalFuelSuggestion] = useState<{ petrolPrice: string; dieselPrice: string; asOf?: string } | null>(null);
  /** Which thunk is in flight — replaces the shared actionStatus for button spinners. */
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [chauffeurDirty, setChauffeurDirty] = useState(false);
  const [shuttleDirty, setShuttleDirty] = useState(false);

  const loadGlobals = useCallback(() => {
    dispatch(fetchPricingCompanies());
    dispatch(fetchSystemFuelPrice());
    dispatch(fetchSystemDieselPrice());
    dispatch(fetchFuelPriceHistory());
    dispatch(fetchDieselPriceHistory());
  }, [dispatch]);

  // Initial load
  useEffect(() => {
    loadGlobals();
  }, [loadGlobals]);

  // Deep-link from company detail: /admin/pricing?companyId=123 (or ?company=)
  useEffect(() => {
    const cid = searchParams.get("company") || searchParams.get("companyId");
    if (cid) dispatch(setSelectedCompanyId(cid));
  }, [dispatch, searchParams]);

  // Load contract details when the company changes
  useEffect(() => {
    if (selectedCompanyId) {
      dispatch(fetchCompanyContractDetails(selectedCompanyId));
      dispatch(fetchShuttleContract(selectedCompanyId));
    }
  }, [selectedCompanyId, dispatch]);

  const errorMessage = (result: { payload?: unknown; error?: { message?: string } }, fallback: string) =>
    typeof result.payload === "string" ? result.payload : result.error?.message || fallback;

  const handleUpdateGlobalFuel = async () => {
    const ok = await confirm({
      title: "Update the global petrol price?",
      message: `Set the current petrol price to ${formatCurrency(Number(systemFuelPrice || 0), { digits: 2 })}.`,
      consequences: ["Applies to every company's chauffeur and shuttle contracts", "Rates are re-adjusted at the next invoice generation"],
      confirmLabel: "Update price",
    });
    if (!ok) return;
    setPendingAction("fuel");
    const result = await dispatch(updateSystemFuelPrice(systemFuelPrice));
    setPendingAction(null);
    if (updateSystemFuelPrice.fulfilled.match(result)) {
      toast.success("Petrol price updated");
      dispatch(fetchFuelPriceHistory());
    } else {
      toast.error(errorMessage(result, "Failed to update petrol price"));
    }
    dispatch(resetActionStatus());
  };

  const handleUpdateGlobalDiesel = async () => {
    const ok = await confirm({
      title: "Update the global diesel price?",
      message: `Set the current diesel price to ${formatCurrency(Number(systemDieselPrice || 0), { digits: 2 })}.`,
      consequences: ["Applies to every shuttle route marked as diesel, across all companies", "Fuel cost is re-adjusted at the next invoice generation"],
      confirmLabel: "Update price",
    });
    if (!ok) return;
    setPendingAction("diesel");
    const result = await dispatch(updateSystemDieselPrice(systemDieselPrice));
    setPendingAction(null);
    if (updateSystemDieselPrice.fulfilled.match(result)) {
      toast.success("Diesel price updated");
      dispatch(fetchDieselPriceHistory());
    } else {
      toast.error(errorMessage(result, "Failed to update diesel price"));
    }
    dispatch(resetActionStatus());
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

    const ok = await confirm({
      title: "Apply the suggested fuel prices?",
      message: `Petrol ${formatCurrency(Number(petrolPrice), { digits: 2 })} and diesel ${formatCurrency(Number(dieselPrice), { digits: 2 })} will be saved globally.`,
      consequences: ["Applies to every company's contracts", "Rates are re-adjusted at the next invoice generation"],
      confirmLabel: "Apply both",
    });
    if (!ok) return;

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
      toast.success("Petrol and diesel prices updated");
    } catch (e) {
      setExternalFuelError(e instanceof Error ? e.message : "Failed to update fuel prices");
    } finally {
      setExternalFuelApplying(false);
    }
  };

  const handlePreviewAdjustments = () => {
    if (!selectedCompanyId) return;
    dispatch(setShowPreview(true));
    dispatch(previewRateAdjustments({ fuelPrice: Number(systemFuelPrice), companyId: Number(selectedCompanyId) }));
  };

  const handleDeleteRow = async (index: number) => {
    const row = rateRows[index];
    if (row?.id) {
      const ok = await confirm({
        title: "Remove this rate card?",
        message: `Remove the rates for ${row.vehicle_model || "this vehicle"}.`,
        consequences: ["The row is removed only when you save the vehicle rates", "Existing bookings keep the rates they were created with"],
        destructive: true,
        confirmLabel: "Remove",
      });
      if (!ok) return;
    }
    setPendingAction("delete-row");
    const result = await dispatch(deleteRateRow(index));
    setPendingAction(null);
    if (deleteRateRow.fulfilled.match(result)) {
      setChauffeurDirty(true);
    } else {
      toast.error(errorMessage(result, "Failed to remove the rate card"));
    }
  };

  const handleDeleteShuttleRow = async (index: number) => {
    const row = shuttleRouteRows[index];
    if (row?.id) {
      const ok = await confirm({
        title: "Remove this shuttle route rate?",
        message: `Remove ${row.particulars || "this route"} from the shuttle contract.`,
        consequences: ["The row is removed only when you save the shuttle contract", "Invoices already generated are not changed"],
        destructive: true,
        confirmLabel: "Remove",
      });
      if (!ok) return;
    }
    dispatch(removeShuttleRouteRow(index));
    setShuttleDirty(true);
  };

  const handleSave = async () => {
    setPendingAction("chauffeur");
    const result = await dispatch(savePricingChanges());
    setPendingAction(null);
    if (savePricingChanges.fulfilled.match(result)) {
      toast.success("Chauffeur contract saved");
      setChauffeurDirty(false);
    } else {
      toast.error(errorMessage(result, "Failed to save chauffeur contract"));
    }
    dispatch(resetActionStatus());
  };

  const handleShuttleSave = async () => {
    setPendingAction("shuttle");
    const result = await dispatch(saveShuttleChanges());
    setPendingAction(null);
    if (saveShuttleChanges.fulfilled.match(result)) {
      toast.success("Shuttle contract saved");
      setShuttleDirty(false);
    } else {
      toast.error(errorMessage(result, "Failed to save shuttle contract"));
    }
    dispatch(resetActionStatus());
  };

  const handleDiscard = async () => {
    const ok = await confirm({
      title: "Discard unsaved changes?",
      message: "The contract will be reloaded from the server.",
      destructive: true,
      confirmLabel: "Discard",
    });
    if (!ok || !selectedCompanyId) return;
    dispatch(fetchCompanyContractDetails(selectedCompanyId));
    dispatch(fetchShuttleContract(selectedCompanyId));
    setChauffeurDirty(false);
    setShuttleDirty(false);
  };

  const onCompanyChange = (id: string) => {
    dispatch(setSelectedCompanyId(id));
    setChauffeurDirty(false);
    setShuttleDirty(false);
  };

  const updateGlobal = (patch: Parameters<typeof setGlobalSettings>[0]) => {
    dispatch(setGlobalSettings(patch));
    setChauffeurDirty(true);
  };
  const updateShuttle = (patch: Parameters<typeof setShuttleSettings>[0]) => {
    dispatch(setShuttleSettings(patch));
    setShuttleDirty(true);
  };
  const changeRateRow = (index: number, field: keyof ChauffeurContractRate, value: string) => {
    dispatch(updateRateRow({ index, field, value }));
    setChauffeurDirty(true);
  };
  const changeShuttleRow = (index: number, field: ShuttleRouteField, value: string) => {
    dispatch(updateShuttleRouteRow({ index, field, value }));
    setShuttleDirty(true);
  };

  const isLoading = status === "loading";
  const loadFailed = status === "failed";
  const isSaving = actionStatus === "loading";
  const anyDirty = chauffeurDirty || shuttleDirty;

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Contracts & Pricing"
        description="Client-specific rates and contract terms with dynamic fuel price adjustments."
        actions={
          <Field inline label="Company" className="w-full sm:w-auto">
            <Select aria-label="Company" value={selectedCompanyId} onChange={(e) => onCompanyChange(e.target.value)} placeholder="Select a company" className="w-full sm:w-64">
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <FuelPricePanel
          kind="petrol"
          title="Global petrol price"
          description="Rates are calculated dynamically from this price during invoice generation."
          value={systemFuelPrice}
          onChange={(v) => dispatch(setSystemFuelPriceLocal(v))}
          onUpdate={handleUpdateGlobalFuel}
          updating={pendingAction === "fuel"}
          canUpdate={canUpdate}
          history={fuelPriceHistory}
          extraActions={
            <Button variant="outline" leftIcon={<Calculator />} onClick={handlePreviewAdjustments} disabled={!selectedCompanyId} loading={isLoadingPreview}>
              Preview adjustments
            </Button>
          }
        >
          <div className="space-y-3 rounded-lg border border-line bg-subtle p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg">Market prices</p>
              <Button variant="outline" size="sm" leftIcon={<Download />} onClick={handleFetchExternalFuelPrices} loading={externalFuelLoading}>
                {externalFuelLoading ? "Checking…" : "Fetch latest prices"}
              </Button>
            </div>
            {externalFuelError && <InlineError>{externalFuelError}</InlineError>}
            {externalFuelSuggestion && (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-fg-secondary">
                    Petrol <span className="font-mono font-semibold tabular-nums text-fg">{formatCurrency(Number(externalFuelSuggestion.petrolPrice), { digits: 2 })}</span>
                    <span className="mx-2 text-fg-muted">·</span>
                    Diesel <span className="font-mono font-semibold tabular-nums text-fg">{formatCurrency(Number(externalFuelSuggestion.dieselPrice), { digits: 2 })}</span>
                  </span>
                  <span className="text-xs text-fg-muted">{externalFuelSuggestion.asOf ? `As of ${formatDateTime(externalFuelSuggestion.asOf)}` : "Latest snapshot"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={handleApplyExternalFuelPrices} disabled={!canUpdate} loading={externalFuelApplying}>
                    {externalFuelApplying ? "Updating…" : "Apply & update both"}
                  </Button>
                  <span className="text-xs text-fg-muted">Fills both fields and saves petrol and diesel globally in one step.</span>
                </div>
              </div>
            )}
          </div>
        </FuelPricePanel>

        <FuelPricePanel
          kind="diesel"
          title="Global diesel price"
          description="Used for shuttle route rows marked as diesel. Adjusted dynamically at invoice generation."
          value={systemDieselPrice}
          onChange={(v) => dispatch(setSystemDieselPriceLocal(v))}
          onUpdate={handleUpdateGlobalDiesel}
          updating={pendingAction === "diesel"}
          canUpdate={canUpdate}
          history={dieselPriceHistory}
        />
      </div>

      <PreviewDialog open={showPreview} onClose={() => dispatch(setShowPreview(false))} loading={isLoadingPreview} fuelPrice={systemFuelPrice} data={previewData as PreviewItem[] | null} />

      {loadFailed && !isLoading && (
        <ErrorState
          title="Couldn't load contract details"
          message={error}
          onRetry={() => {
            loadGlobals();
            if (selectedCompanyId) {
              dispatch(fetchCompanyContractDetails(selectedCompanyId));
              dispatch(fetchShuttleContract(selectedCompanyId));
            }
          }}
        />
      )}

      {isLoading && (
        <div className="space-y-4" aria-busy="true">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={6} />
        </div>
      )}

      {!isLoading && !loadFailed && !selectedCompanyId && (
        <EmptyState title="Select a company" description="Choose a company above to view and edit its contract rates." />
      )}

      {!isLoading && !loadFailed && selectedCompanyId && currentCompany && !currentCompany.is_chauffeur_enabled && !currentCompany.is_shuttle_enabled && (
        <EmptyState title="No services enabled" description={`${currentCompany.name} has neither chauffeur nor shuttle service enabled, so there are no rates to configure.`} />
      )}

      {!isLoading && !loadFailed && currentCompany?.is_chauffeur_enabled && (
        <section className="space-y-4" aria-labelledby="chauffeur-terms">
          <Card>
            <CardHeader title={<span id="chauffeur-terms">Chauffeur contract terms</span>} description="Company-wide settings for chauffeur billing." />
            <CardContent>
              <FormGrid cols={3}>
                <Field label="Base fuel price (PKR)">
                  <Input type="number" min={0} mono value={globalSettings.fuelBasePrice} onChange={(e) => updateGlobal({ fuelBasePrice: e.target.value })} disabled={!canUpdate} />
                </Field>
                <Field label="Revision threshold (%)" hint="Recommended 10–20. Leave empty to always adjust rates with fuel price changes.">
                  <Input type="number" min={0} max={100} mono value={globalSettings.revisionPercentage} onChange={(e) => updateGlobal({ revisionPercentage: e.target.value })} disabled={!canUpdate} />
                </Field>
                <Field label="Contract duration">
                  <Select value={globalSettings.contractDuration} onChange={(e) => updateGlobal({ contractDuration: e.target.value })} disabled={!canUpdate} placeholder="Select duration">
                    {CONTRACT_DURATION_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Outstation allowance (default)" hint="Per day. Used for vehicles without their own allowance.">
                  <Input type="number" min={0} mono value={globalSettings.allowanceOutstation} onChange={(e) => updateGlobal({ allowanceOutstation: e.target.value })} disabled={!canUpdate} />
                </Field>
                <Field label="Accommodation allowance (default)" hint="Per night. Used for vehicles without their own allowance.">
                  <Input type="number" min={0} mono value={globalSettings.allowanceAccommodation} onChange={(e) => updateGlobal({ allowanceAccommodation: e.target.value })} disabled={!canUpdate} />
                </Field>
                <Field label="Contract date">
                  <Input type="date" value={globalSettings.contractDate} onChange={(e) => updateGlobal({ contractDate: e.target.value })} disabled={!canUpdate} />
                </Field>
              </FormGrid>
            </CardContent>
          </Card>

          <ChauffeurRatesTable
            rows={rateRows}
            canUpdate={canUpdate}
            canDelete={canDelete}
            canAddRows={canAddRows}
            showMarketRates={showMarketRates}
            onToggleMarketRates={setShowMarketRates}
            onAdd={() => {
              dispatch(addRateRow());
              setChauffeurDirty(true);
            }}
            onChange={changeRateRow}
            onDelete={handleDeleteRow}
            onSave={handleSave}
            saving={pendingAction === "chauffeur" && isSaving}
            dirty={chauffeurDirty}
            defaultOutstation={globalSettings.allowanceOutstation}
            defaultAccommodation={globalSettings.allowanceAccommodation}
          />
        </section>
      )}

      {!isLoading && !loadFailed && currentCompany?.is_shuttle_enabled && (
        <section className="space-y-4" aria-labelledby="shuttle-terms">
          <Card>
            <CardHeader
              title={<span id="shuttle-terms">Shuttle contract terms</span>}
              description="Monthly shuttle settings for this company. Fuel cost per vehicle uses the same revision logic as chauffeur contracts."
            />
            <CardContent>
              <FormGrid cols={3}>
                <Field label="Base fuel price (PKR)">
                  <Input type="number" min={0} mono value={shuttleSettings.fuelBasePrice} onChange={(e) => updateShuttle({ fuelBasePrice: e.target.value })} disabled={!canUpdate} />
                </Field>
                <Field label="Base diesel price (PKR)" hint="Required for route rows marked as diesel.">
                  <Input type="number" min={0} mono value={shuttleSettings.dieselBasePrice} onChange={(e) => updateShuttle({ dieselBasePrice: e.target.value })} disabled={!canUpdate} placeholder="0" />
                </Field>
                <Field label="Revision threshold (%)" hint="Recommended 10–20. Leave empty to always adjust fuel cost with price changes.">
                  <Input type="number" min={0} max={100} mono value={shuttleSettings.revisionPercentage} onChange={(e) => updateShuttle({ revisionPercentage: e.target.value })} disabled={!canUpdate} />
                </Field>
                <Field label="Sales tax, SST (%)">
                  <Input type="number" min={0} mono value={shuttleSettings.sstPercentage} onChange={(e) => updateShuttle({ sstPercentage: e.target.value })} disabled={!canUpdate} placeholder="10" />
                </Field>
                <Field label="Contract duration">
                  <Select value={shuttleSettings.contractDuration} onChange={(e) => updateShuttle({ contractDuration: e.target.value })} disabled={!canUpdate} placeholder="Select duration">
                    {CONTRACT_DURATION_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Contract date">
                  <Input type="date" value={shuttleSettings.contractDate} onChange={(e) => updateShuttle({ contractDate: e.target.value })} disabled={!canUpdate} />
                </Field>
              </FormGrid>
            </CardContent>
          </Card>

          <ShuttleRatesTable
            rows={shuttleRouteRows}
            canUpdate={canUpdate}
            canDelete={canDelete}
            canAddRows={canAddRows}
            onAdd={() => {
              dispatch(addShuttleRouteRow());
              setShuttleDirty(true);
            }}
            onChange={changeShuttleRow}
            onDelete={handleDeleteShuttleRow}
            onSave={handleShuttleSave}
            saving={pendingAction === "shuttle" && isSaving}
            dirty={shuttleDirty}
          />
        </section>
      )}

      {anyDirty && (
        <div className="sticky bottom-4 z-20 flex justify-center" role="region" aria-label="Unsaved changes">
          <Card className="flex w-full max-w-3xl flex-col gap-3 border-brand-line p-3 shadow-[var(--shadow-modal)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-fg">
              <span className="font-medium">Unsaved changes</span>
              <span className="text-fg-muted">
                {" "}
                in {[chauffeurDirty && "chauffeur contract", shuttleDirty && "shuttle contract"].filter(Boolean).join(" and ")}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" leftIcon={<Undo2 />} onClick={handleDiscard} disabled={isSaving}>
                Discard
              </Button>
              {chauffeurDirty && (
                <Button size="sm" leftIcon={<Save />} onClick={handleSave} disabled={!canUpdate} loading={pendingAction === "chauffeur" && isSaving}>
                  Save chauffeur
                </Button>
              )}
              {shuttleDirty && (
                <Button size="sm" leftIcon={<Save />} onClick={handleShuttleSave} disabled={!canUpdate} loading={pendingAction === "shuttle" && isSaving}>
                  Save shuttle
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
