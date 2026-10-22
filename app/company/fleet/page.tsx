"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, BarChart2, Car, Clock, Plus, TrendingDown, UserPlus, Zap } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  FormGrid,
  Input,
  KpiCard,
  KpiGrid,
  LoadingBlock,
  PageHeader,
  PageSkeleton,
  Select,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useFormatters,
  type DataTableColumn,
} from "@/app/ui";
import { generatePassword } from "@/app/ui/lib/format";
import { useConfirm } from "@/app/lib/hooks/useConfirm";
import { useAppSelector } from "@/app/lib/store/hooks";
import { selectCompany } from "@/app/lib/store/slices/companySlice";
import { useAuth } from "@/app/lib/contexts/auth-context";
import { apiClient, canServeChauffeur, canServeShuttle } from "@/app/lib/services/api-client";
import type { CompanyFeature, PoolDriver, PoolVehicle } from "@/app/lib/services/types/multi-mode";
import { VehicleCategory } from "@/app/lib/services/types/vehicles";
import { getPhoneValidationError, PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, sanitizePhoneInput } from "@/app/lib/utils/phone";
import { InsightCard, UtilizationBar, type FleetInsight, type PoolUtilizationSummary, type PoolVehicleRow } from "@/app/components/fleet/FleetEfficiencyPanel";
import { AccountCredentialsReveal, SaveCredentialsNote } from "../components/AccountCredentialsReveal";
import { trialHasPool, trialHasShuttle } from "../lib/nav";

const VEHICLE_CATEGORIES = Object.values(VehicleCategory);
const formatVehicleCategory = (category: string) =>
  category
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");

const getDefaultVehicleForm = () => ({
  plate_number: "",
  make: "",
  model: "",
  year: new Date().getFullYear(),
  color: "",
  category: VehicleCategory.SEDAN,
  fuel_avg_city: 10,
  fuel_avg_highway: 13,
  seat_capacity: 14,
});

type DriverType = "CHAUFFEUR" | "SHUTTLE" | "BOTH";
type FleetTab = "vehicles" | "drivers" | "analytics";

const emptyDriverForm = (driver_type: DriverType) => ({
  email: "",
  password: "",
  full_name: "",
  phone: "",
  cnic_number: "",
  license_number: "",
  driver_type,
});

export default function CompanyFleetPage() {
  const t = useTranslations("company.fleet");
  const tCredentials = useTranslations("company.credentials");
  const tCommon = useTranslations("common");
  const fmt = useFormatters();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isTrialUser = !!user?.is_trial;
  const trialModules = user?.trial_modules;
  const company = useAppSelector(selectCompany);
  const companyId = Number(company?.id);

  const fleetTabs = useMemo<FleetTab[]>(() => (isTrialUser ? ["vehicles", "drivers"] : ["vehicles", "drivers", "analytics"]), [isTrialUser]);

  const [features, setFeatures] = useState<CompanyFeature[]>([]);
  const [featureLoaded, setFeatureLoaded] = useState(false);
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<FleetTab>(initialTab === "drivers" ? "drivers" : initialTab === "analytics" && !isTrialUser ? "analytics" : "vehicles");

  const [vehicles, setVehicles] = useState<PoolVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(getDefaultVehicleForm);
  const [vehicleSaving, setVehicleSaving] = useState(false);

  const [drivers, setDrivers] = useState<PoolDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [driverCreatedCredentials, setDriverCreatedCredentials] = useState<{ email: string; password: string; full_name: string; driver_type: string } | null>(null);
  const [driverForm, setDriverForm] = useState(() => emptyDriverForm("CHAUFFEUR"));
  const [driverSaving, setDriverSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [poolUtil, setPoolUtil] = useState<{ summary: PoolUtilizationSummary; vehicles: PoolVehicleRow[] } | null>(null);
  const [poolInsights, setPoolInsights] = useState<FleetInsight[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const atVehicleLimit = isTrialUser && vehicles.length >= (trialHasPool(trialModules) && trialHasShuttle(trialModules) ? 2 : 1);
  const chauffeurDriverCount = drivers.filter((d) => canServeChauffeur(d.driver_type)).length;
  const shuttleDriverCount = drivers.filter((d) => canServeShuttle(d.driver_type)).length;
  const atChauffeurDriverLimit = isTrialUser && trialHasPool(trialModules) && chauffeurDriverCount >= 1;
  const atShuttleDriverLimit = isTrialUser && trialHasShuttle(trialModules) && shuttleDriverCount >= 1;

  const isChauffeurFleetEnabled = features.find((f) => f.feature_key === "chauffeur_self_managed")?.is_enabled ?? false;
  const isShuttleFleetEnabled = features.find((f) => f.feature_key === "shuttle_self_managed")?.is_enabled ?? false;
  const showFleet = isChauffeurFleetEnabled || isShuttleFleetEnabled || isTrialUser;
  const showShuttleSeatCapacity = isShuttleFleetEnabled || (isTrialUser && trialHasShuttle(trialModules));

  const defaultDriverType = (): DriverType => {
    if (isShuttleFleetEnabled && !isChauffeurFleetEnabled) return "SHUTTLE";
    if (trialHasShuttle(trialModules) && !trialHasPool(trialModules)) return "SHUTTLE";
    return "CHAUFFEUR";
  };

  const canAddChauffeurDriver = isTrialUser ? trialHasPool(trialModules) : isChauffeurFleetEnabled;
  const canAddShuttleDriver = isTrialUser ? trialHasShuttle(trialModules) : isShuttleFleetEnabled;
  const addDriverDisabled =
    isTrialUser && trialHasPool(trialModules) && trialHasShuttle(trialModules)
      ? atChauffeurDriverLimit && atShuttleDriverLimit
      : isTrialUser
        ? trialHasShuttle(trialModules)
          ? atShuttleDriverLimit
          : atChauffeurDriverLimit
        : false;

  // Trial accounts never see the analytics tab (render-time adjustment, no effect).
  if (isTrialUser && activeTab === "analytics") setActiveTab("vehicles");

  useEffect(() => {
    if (!companyId) return;
    apiClient
      .getCompanyFeatures(companyId)
      .then((r) => {
        setFeatures(r.data);
        setFeatureLoaded(true);
      })
      .catch(() => setFeatureLoaded(true));
  }, [companyId]);

  const openAddDriver = () => {
    setDriverForm({ ...emptyDriverForm(defaultDriverType()), password: generatePassword() });
    setPhoneError(null);
    if (isTrialUser) toast.message(t("driverPasswordGenerated"));
    setShowAddDriver(true);
  };

  const fetchVehicles = useCallback(async () => {
    if (!companyId) return;
    setVehiclesLoading(true);
    setVehiclesError(null);
    try {
      const res = await apiClient.getPoolVehicles(companyId);
      setVehicles(res.data);
    } catch (err) {
      setVehiclesError(err instanceof Error ? err.message : t("failedLoadVehicles"));
    } finally {
      setVehiclesLoading(false);
    }
  }, [companyId, t]);

  const fetchDrivers = useCallback(async () => {
    if (!companyId) return;
    setDriversLoading(true);
    setDriversError(null);
    try {
      const res = await apiClient.getPoolDrivers(companyId);
      setDrivers(res.data);
    } catch (err) {
      setDriversError(err instanceof Error ? err.message : t("failedLoadDrivers"));
    } finally {
      setDriversLoading(false);
    }
  }, [companyId, t]);

  const fetchAnalytics = useCallback(async () => {
    if (!companyId) return;
    setAnalyticsLoading(true);
    try {
      const [utilRes, insightsRes] = await Promise.allSettled([
        apiClient.request<{ summary: PoolUtilizationSummary; vehicles: PoolVehicleRow[] }>("/company/pool-utilization"),
        apiClient.request<FleetInsight[]>("/company/fleet-insights"),
      ]);
      if (utilRes.status === "fulfilled") setPoolUtil(utilRes.value);
      if (insightsRes.status === "fulfilled") setPoolInsights((insightsRes.value as FleetInsight[]).filter((i) => i.insight_type === "POOL_UTILIZATION"));
      if (utilRes.status === "rejected" && insightsRes.status === "rejected") {
        toast.error(utilRes.reason instanceof Error ? utilRes.reason.message : t("failedLoadAnalytics"));
      }
    } finally {
      setAnalyticsLoading(false);
    }
  }, [companyId, t]);

  const triggerGenerate = async () => {
    setGenerating(true);
    try {
      await apiClient.request<{ generated: number }>("/company/fleet-insights/generate", { method: "POST" });
      await fetchAnalytics();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedGenerate"));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!showFleet) return;
    // Kick the fetch off in a callback so the loading flag flips outside the effect body.
    const id = window.requestAnimationFrame(() => {
      if (activeTab === "vehicles") void fetchVehicles();
      if (activeTab === "drivers") void fetchDrivers();
      if (activeTab === "analytics") void fetchAnalytics();
    });
    return () => window.cancelAnimationFrame(id);
  }, [activeTab, showFleet, fetchVehicles, fetchDrivers, fetchAnalytics]);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleSaving(true);
    try {
      await apiClient.createPoolVehicle(companyId, {
        plate_number: vehicleForm.plate_number,
        make: vehicleForm.make,
        model: vehicleForm.model,
        year: vehicleForm.year,
        color: vehicleForm.color || undefined,
        category: vehicleForm.category,
        fuel_avg_city: vehicleForm.fuel_avg_city,
        fuel_avg_highway: vehicleForm.fuel_avg_highway,
        ...(showShuttleSeatCapacity ? { seat_capacity: vehicleForm.seat_capacity } : {}),
      });
      toast.success(isTrialUser ? t("vehicleAddedFleet") : t("vehicleAdded"));
      setShowAddVehicle(false);
      setVehicleForm(getDefaultVehicleForm());
      void fetchVehicles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedAddVehicle"));
    } finally {
      setVehicleSaving(false);
    }
  };

  const handleDeactivateVehicle = async (v: PoolVehicle) => {
    const ok = await confirm({
      title: t("confirmDeactivateVehicle"),
      message: `${v.make} ${v.model} · ${v.plate_number}`,
      consequences: [t("deactivateVehicleConsequence1"), t("deactivateVehicleConsequence2")],
      confirmLabel: t("deactivate"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiClient.deactivatePoolVehicle(companyId, v.id);
      toast.success(t("vehicleDeactivated"));
      void fetchVehicles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedDeactivateVehicle"));
    }
  };

  const handleInviteDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneErr = getPhoneValidationError(driverForm.phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    setPhoneError(null);
    setDriverSaving(true);
    try {
      await apiClient.invitePoolDriver(companyId, {
        email: driverForm.email,
        password: driverForm.password,
        full_name: driverForm.full_name,
        phone: driverForm.phone || undefined,
        driver_type: driverForm.driver_type,
        cnic_number: driverForm.cnic_number || undefined,
        license_number: driverForm.license_number || undefined,
      });
      setDriverCreatedCredentials({ email: driverForm.email, password: driverForm.password, full_name: driverForm.full_name, driver_type: driverForm.driver_type });
      void fetchDrivers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedInviteDriver"));
    } finally {
      setDriverSaving(false);
    }
  };

  const closeDriverDialog = () => {
    setShowAddDriver(false);
    setDriverCreatedCredentials(null);
    setDriverForm(emptyDriverForm(defaultDriverType()));
    setPhoneError(null);
  };

  const handleDeactivateDriver = async (d: PoolDriver) => {
    const ok = await confirm({
      title: t("confirmDeactivateDriver"),
      message: `${d.users.full_name} · ${d.users.email}`,
      consequences: [t("deactivateDriverConsequence1"), t("deactivateDriverConsequence2")],
      confirmLabel: t("deactivate"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiClient.deactivatePoolDriver(companyId, d.user_id);
      toast.success(t("driverDeactivated"));
      void fetchDrivers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedDeactivateDriver"));
    }
  };

  const trialLimitsText = useMemo(() => {
    if (trialHasPool(trialModules) && trialHasShuttle(trialModules)) return t("trialLimitsBoth");
    if (trialHasShuttle(trialModules)) return t("trialLimitsShuttle");
    return t("trialLimitsPool");
  }, [trialModules, t]);

  const driverTypeLabel = (type: string) => (type === "SHUTTLE" ? t("driverTypeShuttle") : type === "BOTH" ? t("driverTypeBoth") : t("driverTypeChauffeur"));

  const vehicleColumns: DataTableColumn<PoolVehicle>[] = [
    { key: "plate", header: t("plate"), mono: true, cell: (v) => <span className="text-fg">{v.plate_number}</span> },
    { key: "makeModel", header: t("makeModel"), cell: (v) => <span className="font-medium text-fg">{v.make} {v.model}</span> },
    { key: "year", header: t("year"), hideBelow: "sm", cell: (v) => <span className="text-fg-secondary">{v.year}</span> },
    { key: "category", header: t("category"), hideBelow: "md", cell: (v) => <span className="text-fg-secondary">{formatVehicleCategory(v.category)}</span> },
    { key: "status", header: t("status"), cell: (v) => <StatusBadge status={v.status} /> },
  ];

  const driverColumns: DataTableColumn<PoolDriver>[] = [
    { key: "name", header: t("name"), cell: (d) => <span className="font-medium text-fg">{d.users.full_name}</span> },
    { key: "email", header: t("email"), hideBelow: "md", cell: (d) => <span className="text-fg-secondary">{d.users.email}</span> },
    { key: "phone", header: t("phone"), hideBelow: "lg", cell: (d) => <span dir="ltr" className="text-fg-muted">{d.users.phone ?? "—"}</span> },
    { key: "type", header: t("type"), hideBelow: "sm", cell: (d) => <span className="text-fg-secondary">{driverTypeLabel(d.driver_type)}</span> },
    { key: "status", header: t("status"), cell: (d) => <StatusBadge status={d.users.status} /> },
  ];

  const poolColumns: DataTableColumn<PoolVehicleRow>[] = [
    {
      key: "vehicle",
      header: t("vehicle"),
      cell: (v) => (
        <div className="min-w-0">
          <div className="font-medium text-fg">{v.plate_number}</div>
          {(v.make || v.model) && <div className="text-xs text-fg-muted">{[v.make, v.model].filter(Boolean).join(" ")}</div>}
        </div>
      ),
    },
    { key: "category", header: t("category"), hideBelow: "sm", cell: (v) => (v.category ? formatVehicleCategory(v.category) : "—") },
    { key: "trips", header: t("trips"), align: "right", mono: true, cell: (v) => v.trips_count },
    { key: "hours", header: t("hoursUsed"), align: "right", mono: true, cell: (v) => `${v.total_hours_booked}h` },
    { key: "util", header: t("utilization"), width: "11rem", cell: (v) => <UtilizationBar pct={v.utilization_pct} threshold={30} /> },
  ];

  if (!featureLoaded) return <PageSkeleton />;

  if (!showFleet) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("fleetTitle")} description={t("fleetDescription")} />
        <Card>
          <EmptyState icon={<Car aria-hidden="true" />} title={t("notEnabled")} description={t("notEnabledDescription")} />
        </Card>
      </div>
    );
  }

  const headerAction =
    activeTab === "vehicles" ? (
      <Button leftIcon={<Plus />} onClick={() => setShowAddVehicle(true)} disabled={atVehicleLimit}>
        {t("addVehicle")}
      </Button>
    ) : activeTab === "drivers" ? (
      <Button leftIcon={<UserPlus />} onClick={openAddDriver} disabled={addDriverDisabled}>
        {t("inviteDriver")}
      </Button>
    ) : (
      <Button leftIcon={<Zap />} loading={generating} onClick={() => void triggerGenerate()}>
        {generating ? t("generating") : t("runAiAnalysis")}
      </Button>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={isTrialUser ? t("trialFleetTitle") : t("title")}
        description={isTrialUser ? t("trialFleetDescription") : t("selfManagedDescription")}
        actions={headerAction}
        tabs={
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FleetTab)}>
            <TabsList>
              {fleetTabs.map((tab) => (
                <TabsTrigger key={tab} value={tab} count={tab === "vehicles" ? vehicles.length || undefined : tab === "drivers" ? drivers.length || undefined : undefined}>
                  {tab === "vehicles" ? (isTrialUser ? t("vehicles") : t("poolVehicles")) : tab === "drivers" ? (isTrialUser ? t("drivers") : t("poolDrivers")) : t("analytics")}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      {isTrialUser && (
        <div role="note" className="rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-sm text-fg">
          <span className="font-semibold">{t("trialLimitsTitle")}</span> {trialLimitsText} {t("trialLimitsAssign")}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FleetTab)}>
        <TabsContent value="vehicles" className="mt-0">
          <Card>
            <CardHeader description={isTrialUser ? t("trialVehiclesDescription") : t("vehiclesDescription")} />
            <DataTable<PoolVehicle>
              caption={t("poolVehicles")}
              rows={vehicles}
              rowKey={(v) => v.id}
              columns={vehicleColumns}
              loading={vehiclesLoading}
              error={vehiclesError}
              onRetry={() => void fetchVehicles()}
              empty={{ title: t("noPoolVehicles"), icon: <Car aria-hidden="true" /> }}
              rowActions={(v) => [{ label: t("deactivate"), destructive: true, hidden: v.status !== "ACTIVE", onSelect: () => void handleDeactivateVehicle(v) }]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="drivers" className="mt-0">
          <Card>
            <CardHeader description={isTrialUser ? t("trialDriversDescription") : t("driversDescription")} />
            <DataTable<PoolDriver>
              caption={t("poolDrivers")}
              rows={drivers}
              rowKey={(d) => d.user_id}
              columns={driverColumns}
              loading={driversLoading}
              error={driversError}
              onRetry={() => void fetchDrivers()}
              empty={{ title: t("noPoolDrivers"), icon: <UserPlus aria-hidden="true" /> }}
              rowActions={(d) => [{ label: t("deactivate"), destructive: true, hidden: d.users.status !== "ACTIVE", onSelect: () => void handleDeactivateDriver(d) }]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-0 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-fg">{t("poolAnalyticsTitle")}</h2>
            <p className="mt-0.5 text-xs text-fg-muted">{t("poolAnalyticsSubtitle")}</p>
          </div>
          {analyticsLoading ? (
            <LoadingBlock label={t("loadingAnalytics")} />
          ) : (
            <>
              {poolInsights.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {poolInsights.map((i) => (
                    <InsightCard key={i.id} insight={i} />
                  ))}
                </div>
              )}
              {poolUtil && (
                <>
                  <KpiGrid cols={4}>
                    <KpiCard label={t("poolVehiclesKpi")} value={fmt.formatNumber(poolUtil.summary.total_pool_vehicles)} icon={<Car />} tone="purple" />
                    <KpiCard label={t("avgUtilization")} value={`${poolUtil.summary.avg_utilization_pct}%`} icon={<Clock />} tone={poolUtil.summary.avg_utilization_pct >= 30 ? "success" : "warning"} />
                    <KpiCard label={t("idleVehicles")} value={fmt.formatNumber(poolUtil.summary.idle_vehicle_count)} icon={<AlertTriangle />} tone={poolUtil.summary.idle_vehicle_count === 0 ? "success" : "warning"} />
                    <KpiCard label={t("underutilized")} value={fmt.formatNumber(poolUtil.summary.underutilized_count)} icon={<TrendingDown />} tone={poolUtil.summary.underutilized_count === 0 ? "success" : "danger"} />
                  </KpiGrid>
                  {poolUtil.vehicles.length > 0 && (
                    <Card>
                      <CardHeader title={t("vehicleUtilization")} />
                      <DataTable<PoolVehicleRow> rows={poolUtil.vehicles} rowKey={(v) => v.vehicle_id} columns={poolColumns} density="compact" />
                    </Card>
                  )}
                </>
              )}
              {!poolUtil && poolInsights.length === 0 && (
                <Card>
                  <EmptyState icon={<BarChart2 aria-hidden="true" />} title={t("noAnalyticsData")} description={t("noAnalyticsHint")} />
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showAddVehicle} onOpenChange={(open) => !open && setShowAddVehicle(false)}>
        <DialogContent
          title={isTrialUser ? t("addFleetVehicle") : t("addPoolVehicle")}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowAddVehicle(false)} disabled={vehicleSaving}>
                {tCommon("actions.cancel")}
              </Button>
              <Button type="submit" form="add-vehicle-form" loading={vehicleSaving}>
                {vehicleSaving ? t("adding") : t("addVehicle")}
              </Button>
            </>
          }
        >
          <form id="add-vehicle-form" onSubmit={handleAddVehicle}>
            <FormGrid cols={2}>
              <Field label={t("plate")} required>
                <Input required value={vehicleForm.plate_number} onChange={(e) => setVehicleForm((f) => ({ ...f, plate_number: e.target.value }))} />
              </Field>
              <Field label={t("category")}>
                <Select value={vehicleForm.category} onChange={(e) => setVehicleForm((f) => ({ ...f, category: e.target.value as VehicleCategory }))}>
                  {VEHICLE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {formatVehicleCategory(c)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("make")} required>
                <Input required value={vehicleForm.make} onChange={(e) => setVehicleForm((f) => ({ ...f, make: e.target.value }))} />
              </Field>
              <Field label={t("model")} required>
                <Input required value={vehicleForm.model} onChange={(e) => setVehicleForm((f) => ({ ...f, model: e.target.value }))} />
              </Field>
              <Field label={t("year")} required>
                <Input required type="number" value={vehicleForm.year} onChange={(e) => setVehicleForm((f) => ({ ...f, year: Number(e.target.value) }))} />
              </Field>
              <Field label={t("color")}>
                <Input value={vehicleForm.color} onChange={(e) => setVehicleForm((f) => ({ ...f, color: e.target.value }))} />
              </Field>
              <Field label={t("fuelAvgCity")}>
                <Input type="number" step="0.1" value={vehicleForm.fuel_avg_city} onChange={(e) => setVehicleForm((f) => ({ ...f, fuel_avg_city: Number(e.target.value) }))} />
              </Field>
              <Field label={t("fuelAvgHighway")}>
                <Input type="number" step="0.1" value={vehicleForm.fuel_avg_highway} onChange={(e) => setVehicleForm((f) => ({ ...f, fuel_avg_highway: Number(e.target.value) }))} />
              </Field>
              {showShuttleSeatCapacity && (
                <Field label={t("seatCapacity")}>
                  <Input type="number" min={1} value={vehicleForm.seat_capacity} onChange={(e) => setVehicleForm((f) => ({ ...f, seat_capacity: Number(e.target.value) }))} />
                </Field>
              )}
            </FormGrid>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDriver} onOpenChange={(open) => !open && closeDriverDialog()}>
        <DialogContent
          title={driverCreatedCredentials ? t("driverCreatedTitle") : isTrialUser ? t("inviteFleetDriver") : t("invitePoolDriver")}
          footer={
            driverCreatedCredentials ? (
              <Button onClick={closeDriverDialog}>{tCredentials("done")}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeDriverDialog} disabled={driverSaving}>
                  {tCommon("actions.cancel")}
                </Button>
                <Button type="submit" form="invite-driver-form" loading={driverSaving}>
                  {driverSaving ? t("inviting") : t("inviteDriver")}
                </Button>
              </>
            )
          }
        >
          {driverCreatedCredentials ? (
            <div className="space-y-5">
              <p className="text-center text-sm text-fg-muted">{t("driverInvitedAs", { name: driverCreatedCredentials.full_name, type: driverTypeLabel(driverCreatedCredentials.driver_type) })}</p>
              <AccountCredentialsReveal email={driverCreatedCredentials.email} password={driverCreatedCredentials.password} fullName={driverCreatedCredentials.full_name} subtitle={tCredentials("driverAppSubtitle")} accountTypeKey="driver" />
            </div>
          ) : (
            <form id="invite-driver-form" onSubmit={handleInviteDriver} className="space-y-4">
              <SaveCredentialsNote accountTypeKey="driver" />
              {canAddChauffeurDriver && canAddShuttleDriver && (
                <Field label={t("driverType")} required>
                  <Select required value={driverForm.driver_type} onChange={(e) => setDriverForm((f) => ({ ...f, driver_type: e.target.value as DriverType }))}>
                    <option value="CHAUFFEUR" disabled={atChauffeurDriverLimit}>{t("driverTypeChauffeur")}</option>
                    <option value="SHUTTLE" disabled={atShuttleDriverLimit}>{t("driverTypeShuttle")}</option>
                    <option value="BOTH" disabled={atChauffeurDriverLimit || atShuttleDriverLimit}>{t("driverTypeBoth")}</option>
                  </Select>
                </Field>
              )}
              <FormGrid cols={2}>
                <Field label={t("fullName")} required>
                  <Input required value={driverForm.full_name} onChange={(e) => setDriverForm((f) => ({ ...f, full_name: e.target.value }))} />
                </Field>
                <Field label={t("phone")} required error={phoneError} hint={PHONE_PLACEHOLDER}>
                  <Input
                    required
                    type="tel"
                    inputMode="numeric"
                    dir="ltr"
                    maxLength={PHONE_MAX_LENGTH}
                    value={driverForm.phone}
                    onChange={(e) => {
                      setPhoneError(null);
                      setDriverForm((f) => ({ ...f, phone: sanitizePhoneInput(e.target.value) }));
                    }}
                    placeholder={PHONE_PLACEHOLDER}
                  />
                </Field>
                <Field label={t("email")} required>
                  <Input required type="email" dir="ltr" value={driverForm.email} onChange={(e) => setDriverForm((f) => ({ ...f, email: e.target.value }))} />
                </Field>
                <Field label={t("password")} required>
                  <Input required type="password" minLength={8} dir="ltr" value={driverForm.password} onChange={(e) => setDriverForm((f) => ({ ...f, password: e.target.value }))} />
                </Field>
                <Field label={t("cnic")}>
                  <Input dir="ltr" value={driverForm.cnic_number} onChange={(e) => setDriverForm((f) => ({ ...f, cnic_number: e.target.value }))} />
                </Field>
                <Field label={t("licenseNo")}>
                  <Input dir="ltr" value={driverForm.license_number} onChange={(e) => setDriverForm((f) => ({ ...f, license_number: e.target.value }))} />
                </Field>
              </FormGrid>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
