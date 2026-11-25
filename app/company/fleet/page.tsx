"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSaudiBasePath, withSaudiBase } from "@/app/lib/i18n/saudi-route";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { useAppSelector } from "../../lib/store/hooks";
import { selectCompany } from "../../lib/store/slices/companySlice";
import { useAuth } from "../../lib/contexts/auth-context";
import type { TrialModules } from "../../lib/types/auth-types";
import { apiClient, canServeChauffeur, canServeShuttle } from "../../lib/services/api-client";
import { CompanyFeature, PoolVehicle, PoolDriver } from "../../lib/services/types/multi-mode";
import { VehicleCategory } from "../../lib/services/types/vehicles";
import { toast } from "sonner";
import { Card } from "../components/DashboardComponents";
import { AccountCredentialsReveal, SaveCredentialsNote } from "../components/AccountCredentialsReveal";
import { PageHeader, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../components/PageLayout";
import {
    getPhoneValidationError,
    PHONE_MAX_LENGTH,
    PHONE_PLACEHOLDER,
    sanitizePhoneInput,
} from "../../lib/utils/phone";

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

const VEHICLE_CATEGORIES = Object.values(VehicleCategory);

const formatVehicleCategory = (category: string) =>
    category.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

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
    /** "" = infer from the category (coaster/bus = diesel) */
    fuel_type: "" as "" | "PETROL" | "DIESEL",
    /** "" = not set (idling CO2 then uses the AC-off rate) */
    ac_on: "" as "" | "on" | "off",
});

function trialHasPool(modules?: TrialModules): boolean {
    return modules === "pool" || modules === "both" || !modules;
}

function trialHasShuttle(modules?: TrialModules): boolean {
    return modules === "shuttle" || modules === "both";
}

function generateDriverPassword(length = 12): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

export default function CompanyFleetPage() {
    const t = useTranslations("company.fleet");
    const tCredentials = useTranslations("company.credentials");
    const tCommon = useTranslations("common");
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const isTrialUser = !!user?.is_trial;
    const trialModules = user?.trial_modules;
    const company = useAppSelector(selectCompany);
    const companyId = Number(company?.id);

    const fleetTabs = ["vehicles", "drivers"] as const;

    const [features, setFeatures] = useState<CompanyFeature[]>([]);
    const [featureLoaded, setFeatureLoaded] = useState(false);
    const initialTab = searchParams.get("tab");
    const [activeTab, setActiveTab] = useState<"vehicles" | "drivers">(initialTab === "drivers" ? "drivers" : "vehicles");

    // Pool analytics moved to Analytics → Pool cars; keep old links working.
    const router = useRouter();
    const basePath = getSaudiBasePath(usePathname());
    useEffect(() => {
        if (initialTab === "analytics" && !isTrialUser) router.replace(withSaudiBase("/company/analytics?tab=pool", basePath));
    }, [initialTab, isTrialUser, router, basePath]);

    const [vehicles, setVehicles] = useState<PoolVehicle[]>([]);
    const [vehiclesLoading, setVehiclesLoading] = useState(false);
    const [showAddVehicle, setShowAddVehicle] = useState(false);
    const [vehicleForm, setVehicleForm] = useState(getDefaultVehicleForm);
    const [vehicleSaving, setVehicleSaving] = useState(false);

    const [drivers, setDrivers] = useState<PoolDriver[]>([]);
    const [driversLoading, setDriversLoading] = useState(false);
    const [showAddDriver, setShowAddDriver] = useState(false);
    const [driverCreatedCredentials, setDriverCreatedCredentials] = useState<{
        email: string;
        password: string;
        full_name: string;
        driver_type: string;
    } | null>(null);
    const [driverForm, setDriverForm] = useState({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        cnic_number: "",
        license_number: "",
        driver_type: "CHAUFFEUR" as "CHAUFFEUR" | "SHUTTLE" | "BOTH",
    });
    const [driverSaving, setDriverSaving] = useState(false);


    const atVehicleLimit = isTrialUser && vehicles.length >= (trialHasPool(trialModules) && trialHasShuttle(trialModules) ? 2 : 1);
    const chauffeurDriverCount = drivers.filter((d) => canServeChauffeur(d.driver_type)).length;
    const shuttleDriverCount = drivers.filter((d) => canServeShuttle(d.driver_type)).length;
    const atChauffeurDriverLimit = isTrialUser && trialHasPool(trialModules) && chauffeurDriverCount >= 1;
    const atShuttleDriverLimit = isTrialUser && trialHasShuttle(trialModules) && shuttleDriverCount >= 1;

    const isChauffeurFleetEnabled = features.find((f) => f.feature_key === "chauffeur_self_managed")?.is_enabled ?? false;
    const isShuttleFleetEnabled = features.find((f) => f.feature_key === "shuttle_self_managed")?.is_enabled ?? false;
    const showFleet = isChauffeurFleetEnabled || isShuttleFleetEnabled || isTrialUser;
    const showShuttleSeatCapacity = isShuttleFleetEnabled || (isTrialUser && trialHasShuttle(trialModules));

    const defaultDriverType = (): "CHAUFFEUR" | "SHUTTLE" | "BOTH" => {
        if (isShuttleFleetEnabled && !isChauffeurFleetEnabled) return "SHUTTLE";
        if (trialHasShuttle(trialModules) && !trialHasPool(trialModules)) return "SHUTTLE";
        return "CHAUFFEUR";
    };

    const canAddChauffeurDriver = isTrialUser ? trialHasPool(trialModules) : isChauffeurFleetEnabled;
    const canAddShuttleDriver = isTrialUser ? trialHasShuttle(trialModules) : isShuttleFleetEnabled;

    useEffect(() => {
        if (!companyId) return;
        apiClient.getCompanyFeatures(companyId)
            .then((r) => { setFeatures(r.data); setFeatureLoaded(true); })
            .catch(() => setFeatureLoaded(true));
    }, [companyId]);

    const openAddDriver = () => {
        const generated = generateDriverPassword();
        const driverType = defaultDriverType();
        setDriverForm((f) => ({ ...f, password: generated, driver_type: driverType }));
        if (isTrialUser) {
            toast.message(t("driverPasswordGenerated"));
        }
        setShowAddDriver(true);
    };

    const fetchVehicles = useCallback(async () => {
        if (!companyId) return;
        setVehiclesLoading(true);
        try {
            const res = await apiClient.getPoolVehicles(companyId);
            setVehicles(res.data);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t("failedLoadVehicles"));
        } finally {
            setVehiclesLoading(false);
        }
    }, [companyId, t]);

    const fetchDrivers = useCallback(async () => {
        if (!companyId) return;
        setDriversLoading(true);
        try {
            const res = await apiClient.getPoolDrivers(companyId);
            setDrivers(res.data);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t("failedLoadDrivers"));
        } finally {
            setDriversLoading(false);
        }
    }, [companyId, t]);

    useEffect(() => {
        if (!showFleet) return;
        if (activeTab === "vehicles") fetchVehicles();
        if (activeTab === "drivers") fetchDrivers();
    }, [activeTab, showFleet, fetchVehicles, fetchDrivers]);

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
                ...(vehicleForm.fuel_type ? { fuel_type: vehicleForm.fuel_type } : {}),
                ...(vehicleForm.ac_on ? { ac_on: vehicleForm.ac_on === "on" } : {}),
                ...(showShuttleSeatCapacity ? { seat_capacity: vehicleForm.seat_capacity } : {}),
            });
            toast.success(isTrialUser ? t("vehicleAddedFleet") : t("vehicleAdded"));
            setShowAddVehicle(false);
            setVehicleForm(getDefaultVehicleForm());
            fetchVehicles();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t("failedAddVehicle"));
        } finally {
            setVehicleSaving(false);
        }
    };

    const handleDeactivateVehicle = async (vehicleId: number) => {
        if (!confirm(t("confirmDeactivateVehicle"))) return;
        try {
            await apiClient.deactivatePoolVehicle(companyId, vehicleId);
            toast.success(t("vehicleDeactivated"));
            fetchVehicles();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t("failedDeactivateVehicle"));
        }
    };

    const handleInviteDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        const phoneError = getPhoneValidationError(driverForm.phone);
        if (phoneError) {
            toast.error(phoneError);
            return;
        }
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
            setDriverCreatedCredentials({
                email: driverForm.email,
                password: driverForm.password,
                full_name: driverForm.full_name,
                driver_type: driverForm.driver_type,
            });
            fetchDrivers();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t("failedInviteDriver"));
        } finally {
            setDriverSaving(false);
        }
    };

    function closeDriverModal() {
        setShowAddDriver(false);
        setDriverCreatedCredentials(null);
        setDriverForm({
            email: "",
            password: "",
            full_name: "",
            phone: "",
            cnic_number: "",
            license_number: "",
            driver_type: defaultDriverType(),
        });
    }

    const handleDeactivateDriver = async (userId: string) => {
        if (!confirm(t("confirmDeactivateDriver"))) return;
        try {
            await apiClient.deactivatePoolDriver(companyId, userId);
            toast.success(t("driverDeactivated"));
            fetchDrivers();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t("failedDeactivateDriver"));
        }
    };

    const trialLimitsText = useMemo(() => {
        if (trialHasPool(trialModules) && trialHasShuttle(trialModules)) return t("trialLimitsBoth");
        if (trialHasShuttle(trialModules)) return t("trialLimitsShuttle");
        return t("trialLimitsPool");
    }, [trialModules, t]);

    if (!featureLoaded) {
        return (
            <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
                <div className="flex items-center justify-center py-24">
                    <div className="text-sm text-[var(--text-muted)]">{t("loadingFleet")}</div>
                </div>
            </div>
        );
    }

    if (!showFleet) {
        return (
            <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
                <PageHeader label={t("fleetLabel")} title={t("fleetTitle")} description={t("fleetDescription")} />
                <Card className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center max-w-sm">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--surface-subtle)] mb-4">
                            <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
                        </div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">{t("notEnabled")}</h2>
                        <p className="text-sm text-[var(--text-muted)]">{t("notEnabledDescription")}</p>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
            <PageHeader
                label={isTrialUser ? t("trialFleetLabel") : t("selfManagedLabel")}
                title={isTrialUser ? t("trialFleetTitle") : t("title")}
                description={isTrialUser ? t("trialFleetDescription") : t("selfManagedDescription")}
                action={
                    activeTab === "vehicles" ? (
                        <button
                            onClick={() => setShowAddVehicle(true)}
                            disabled={atVehicleLimit}
                            className="group relative flex items-center gap-2 rounded-xl bg-[var(--cort-orange)] px-5 py-2.5 text-sm font-bold text-[var(--text-primary)] transition-all hover:bg-[var(--cort-orange-hover)] disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                            + {t("addVehicle")}
                        </button>
                    ) : activeTab === "drivers" ? (
                        <button
                            onClick={openAddDriver}
                            disabled={
                                isTrialUser && trialHasPool(trialModules) && trialHasShuttle(trialModules)
                                    ? atChauffeurDriverLimit && atShuttleDriverLimit
                                    : isTrialUser
                                        ? (trialHasShuttle(trialModules) ? atShuttleDriverLimit : atChauffeurDriverLimit)
                                        : false
                            }
                            className="group relative flex items-center gap-2 rounded-xl bg-[var(--cort-orange)] px-5 py-2.5 text-sm font-bold text-[var(--text-primary)] transition-all hover:bg-[var(--cort-orange-hover)] disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                            + {t("inviteDriver")}
                        </button>
                    ) : null
                }
            />

            {isTrialUser && (
                <div className="alert-banner-warning">
                    <span className="font-semibold">{t("trialLimitsTitle")}</span>{" "}
                    {trialLimitsText}{" "}
                    {t("trialLimitsAssign")}
                </div>
            )}

            <div className="border-b border-[var(--border-light)]">
                <nav className="-mb-px flex space-x-8">
                    {fleetTabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cx(
                                "whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors",
                                activeTab === tab
                                    ? "border-[var(--cort-orange)] text-[var(--cort-orange)]"
                                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-light)]",
                            )}
                        >
                            {tab === "vehicles"
                                ? (isTrialUser ? t("vehicles") : t("poolVehicles"))
                                : (isTrialUser ? t("drivers") : t("poolDrivers"))}
                        </button>
                    ))}
                </nav>
            </div>

            {activeTab === "vehicles" && (
                <Card className={TABLE_CARD_CLASS}>
                    <div className={TABLE_TOP_BAR_CLASS}>
                        <p className="text-sm text-[var(--text-muted)]">
                            {isTrialUser ? t("trialVehiclesDescription") : t("vehiclesDescription")}
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-start">
                            <thead>
                                <tr className="border-b border-[var(--border-light)]">
                                    {[t("plate"), t("makeModel"), t("year"), t("category"), t("status"), t("actions")].map((h) => (
                                        <th key={h} className={TABLE_HEADER_CELL_CLASS}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-light)]/50">
                                {vehiclesLoading ? (
                                    <tr><td colSpan={6} className={`${TABLE_CELL_CLASS} py-12 text-center text-[var(--text-muted)]`}>{tCommon("status.loading")}</td></tr>
                                ) : vehicles.length === 0 ? (
                                    <tr><td colSpan={6} className={`${TABLE_CELL_CLASS} py-12 text-center text-[var(--text-muted)]`}>{t("noPoolVehicles")}</td></tr>
                                ) : vehicles.map((v) => (
                                    <tr key={v.id} className="group transition-colors hover:bg-[var(--surface-subtle)]/80">
                                        <td className={`${TABLE_CELL_CLASS} font-mono text-xs text-[var(--text-muted)]`}>{v.plate_number}</td>
                                        <td className={`${TABLE_CELL_CLASS} font-bold text-[var(--text-primary)]`}>{v.make} {v.model}</td>
                                        <td className={`${TABLE_CELL_CLASS} text-[var(--text-secondary)]`}>{v.year}</td>
                                        <td className={`${TABLE_CELL_CLASS} text-[var(--text-secondary)]`}>{formatVehicleCategory(v.category)}</td>
                                        <td className={TABLE_CELL_CLASS}>
                                            <span className={cx(
                                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border",
                                                v.status === "ACTIVE"
                                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                    : "bg-[var(--surface-subtle)] text-[var(--text-muted)] border-[var(--border-light)]",
                                            )}>
                                                <span className={cx("w-1.5 h-1.5 rounded-full me-1.5", v.status === "ACTIVE" ? "bg-emerald-400" : "bg-[var(--text-muted)]")} />
                                                {v.status ?? "—"}
                                            </span>
                                        </td>
                                        <td className={TABLE_CELL_CLASS}>
                                            {v.status === "ACTIVE" && (
                                                <button onClick={() => handleDeactivateVehicle(v.id)} className="text-xs text-rose-400 hover:text-rose-300 transition-colors">{t("deactivate")}</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {activeTab === "drivers" && (
                <Card className={TABLE_CARD_CLASS}>
                    <div className={TABLE_TOP_BAR_CLASS}>
                        <p className="text-sm text-[var(--text-muted)]">
                            {isTrialUser ? t("trialDriversDescription") : t("driversDescription")}
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-start">
                            <thead>
                                <tr className="border-b border-[var(--border-light)]">
                                    {[t("name"), t("email"), t("phone"), t("type"), t("status"), t("actions")].map((h) => (
                                        <th key={h} className={TABLE_HEADER_CELL_CLASS}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-light)]/50">
                                {driversLoading ? (
                                    <tr><td colSpan={6} className={`${TABLE_CELL_CLASS} py-12 text-center text-[var(--text-muted)]`}>{tCommon("status.loading")}</td></tr>
                                ) : drivers.length === 0 ? (
                                    <tr><td colSpan={6} className={`${TABLE_CELL_CLASS} py-12 text-center text-[var(--text-muted)]`}>{t("noPoolDrivers")}</td></tr>
                                ) : drivers.map((d) => (
                                    <tr key={d.user_id} className="group transition-colors hover:bg-[var(--surface-subtle)]/80">
                                        <td className={`${TABLE_CELL_CLASS} font-bold text-[var(--text-primary)]`}>{d.users.full_name}</td>
                                        <td className={`${TABLE_CELL_CLASS} text-[var(--text-secondary)]`}>{d.users.email}</td>
                                        <td className={`${TABLE_CELL_CLASS} text-[var(--text-muted)]`}>{d.users.phone ?? "—"}</td>
                                        <td className={`${TABLE_CELL_CLASS} text-[var(--text-muted)]`}>{d.driver_type}</td>
                                        <td className={TABLE_CELL_CLASS}>
                                            <span className={cx(
                                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border",
                                                d.users.status === "ACTIVE"
                                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                    : "bg-[var(--surface-subtle)] text-[var(--text-muted)] border-[var(--border-light)]",
                                            )}>
                                                <span className={cx("w-1.5 h-1.5 rounded-full me-1.5", d.users.status === "ACTIVE" ? "bg-emerald-400" : "bg-[var(--text-muted)]")} />
                                                {d.users.status ?? "—"}
                                            </span>
                                        </td>
                                        <td className={TABLE_CELL_CLASS}>
                                            {d.users.status === "ACTIVE" && (
                                                <button onClick={() => handleDeactivateDriver(d.user_id)} className="text-xs text-rose-400 hover:text-rose-300 transition-colors">{t("deactivate")}</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {showAddVehicle && (
                <Modal title={isTrialUser ? t("addFleetVehicle") : t("addPoolVehicle")} onClose={() => setShowAddVehicle(false)}>
                    <form onSubmit={handleAddVehicle} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t("plate") + " *"}><input required value={vehicleForm.plate_number} onChange={(e) => setVehicleForm((f) => ({ ...f, plate_number: e.target.value }))} className={inputCls} /></Field>
                            <Field label={t("category")}>
                                <select value={vehicleForm.category} onChange={(e) => setVehicleForm((f) => ({ ...f, category: e.target.value as VehicleCategory }))} className={inputCls}>
                                    {VEHICLE_CATEGORIES.map((c) => (
                                        <option key={c} value={c}>{formatVehicleCategory(c)}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label={t("make") + " *"}><input required value={vehicleForm.make} onChange={(e) => setVehicleForm((f) => ({ ...f, make: e.target.value }))} className={inputCls} /></Field>
                            <Field label={t("model") + " *"}><input required value={vehicleForm.model} onChange={(e) => setVehicleForm((f) => ({ ...f, model: e.target.value }))} className={inputCls} /></Field>
                            <Field label={t("year") + " *"}><input required type="number" value={vehicleForm.year} onChange={(e) => setVehicleForm((f) => ({ ...f, year: Number(e.target.value) }))} className={inputCls} /></Field>
                            <Field label={t("color")}><input value={vehicleForm.color} onChange={(e) => setVehicleForm((f) => ({ ...f, color: e.target.value }))} className={inputCls} /></Field>
                            <Field label={t("fuelAvgCity")}><input type="number" step="0.1" value={vehicleForm.fuel_avg_city} onChange={(e) => setVehicleForm((f) => ({ ...f, fuel_avg_city: Number(e.target.value) }))} className={inputCls} /></Field>
                            <Field label={t("fuelAvgHighway")}><input type="number" step="0.1" value={vehicleForm.fuel_avg_highway} onChange={(e) => setVehicleForm((f) => ({ ...f, fuel_avg_highway: Number(e.target.value) }))} className={inputCls} /></Field>
                            <Field label={t("fuelType")}>
                                <select value={vehicleForm.fuel_type} onChange={(e) => setVehicleForm((f) => ({ ...f, fuel_type: e.target.value as "" | "PETROL" | "DIESEL" }))} className={inputCls}>
                                    <option value="">{t("fuelTypeAuto")}</option>
                                    <option value="PETROL">{t("fuelPetrol")}</option>
                                    <option value="DIESEL">{t("fuelDiesel")}</option>
                                </select>
                            </Field>
                            <Field label={t("acLabel")}>
                                <select value={vehicleForm.ac_on} onChange={(e) => setVehicleForm((f) => ({ ...f, ac_on: e.target.value as "" | "on" | "off" }))} className={inputCls}>
                                    <option value="">{t("acUnset")}</option>
                                    <option value="on">{t("acOn")}</option>
                                    <option value="off">{t("acOff")}</option>
                                </select>
                            </Field>
                            {showShuttleSeatCapacity && (
                                <Field label={t("seatCapacity")}>
                                    <input type="number" min={1} value={vehicleForm.seat_capacity} onChange={(e) => setVehicleForm((f) => ({ ...f, seat_capacity: Number(e.target.value) }))} className={inputCls} />
                                </Field>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setShowAddVehicle(false)} className={cancelBtnCls}>{tCommon("actions.cancel")}</button>
                            <button type="submit" disabled={vehicleSaving} className={saveBtnCls}>{vehicleSaving ? t("adding") : t("addVehicle")}</button>
                        </div>
                    </form>
                </Modal>
            )}

            {showAddDriver && (
                <Modal title={driverCreatedCredentials ? t("driverCreatedTitle") : (isTrialUser ? t("inviteFleetDriver") : t("invitePoolDriver"))} onClose={closeDriverModal}>
                    {driverCreatedCredentials ? (
                        <div className="space-y-5">
                            <div className="text-center text-sm text-[var(--text-muted)]">
                                {t("driverInvitedAs", {
                                    name: driverCreatedCredentials.full_name,
                                    type: driverCreatedCredentials.driver_type === "SHUTTLE"
                                        ? t("driverTypeShuttle")
                                        : driverCreatedCredentials.driver_type === "BOTH"
                                            ? t("driverTypeBoth")
                                            : t("driverTypeChauffeur"),
                                })}
                            </div>
                            <AccountCredentialsReveal
                                email={driverCreatedCredentials.email}
                                password={driverCreatedCredentials.password}
                                fullName={driverCreatedCredentials.full_name}
                                subtitle={tCredentials("driverAppSubtitle")}
                                accountTypeKey="driver"
                            />
                            <div className="flex justify-end pt-2">
                                <button type="button" onClick={closeDriverModal} className={saveBtnCls}>{tCredentials("done")}</button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleInviteDriver} className="space-y-4">
                            <SaveCredentialsNote accountTypeKey="driver" />
                            {(canAddChauffeurDriver && canAddShuttleDriver) ? (
                                <Field label={t("driverTypeLabel")}>
                                    <select
                                        required
                                        value={driverForm.driver_type}
                                        onChange={(e) => setDriverForm((f) => ({ ...f, driver_type: e.target.value as "CHAUFFEUR" | "SHUTTLE" | "BOTH" }))}
                                        className={inputCls}
                                    >
                                        <option value="CHAUFFEUR" disabled={atChauffeurDriverLimit}>{t("driverTypeChauffeur")}</option>
                                        <option value="SHUTTLE" disabled={atShuttleDriverLimit}>{t("driverTypeShuttle")}</option>
                                        <option value="BOTH" disabled={atChauffeurDriverLimit || atShuttleDriverLimit}>{t("driverTypeBoth")}</option>
                                    </select>
                                </Field>
                            ) : null}
                            <div className="grid grid-cols-2 gap-3">
                                <Field label={t("fullNameRequired")}><input required value={driverForm.full_name} onChange={(e) => setDriverForm((f) => ({ ...f, full_name: e.target.value }))} className={inputCls} /></Field>
                                <Field label={t("phone")}><input type="tel" inputMode="numeric" maxLength={PHONE_MAX_LENGTH} value={driverForm.phone} onChange={(e) => setDriverForm((f) => ({ ...f, phone: sanitizePhoneInput(e.target.value) }))} placeholder={PHONE_PLACEHOLDER} className={inputCls} /></Field>
                                <Field label={t("email") + " *"}><input required type="email" value={driverForm.email} onChange={(e) => setDriverForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} /></Field>
                                <Field label={t("passwordRequired")}><input required type="password" minLength={8} value={driverForm.password} onChange={(e) => setDriverForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} /></Field>
                                <Field label={t("cnic")}><input value={driverForm.cnic_number} onChange={(e) => setDriverForm((f) => ({ ...f, cnic_number: e.target.value }))} className={inputCls} /></Field>
                                <Field label={t("licenseNo")}><input value={driverForm.license_number} onChange={(e) => setDriverForm((f) => ({ ...f, license_number: e.target.value }))} className={inputCls} /></Field>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={closeDriverModal} className={cancelBtnCls}>{tCommon("actions.cancel")}</button>
                                <button type="submit" disabled={driverSaving} className={saveBtnCls}>{driverSaving ? t("inviting") : t("inviteDriver")}</button>
                            </div>
                        </form>
                    )}
                </Modal>
            )}
        </div>
    );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-center-overlay">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto modal-center-panel">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-2xl leading-none transition-colors">×</button>
                </div>
                {children}
            </div>
        </div>,
        document.body,
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>
            {children}
        </div>
    );
}

const inputCls = "w-full h-9 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--cort-orange)]/20 focus:border-[var(--cort-orange)] transition-all text-[var(--text-primary)] shadow-sm";
const saveBtnCls = "bg-[var(--cort-orange)] text-[var(--text-primary)] px-4 py-2 rounded-lg text-sm font-bold hover:bg-[var(--cort-orange-hover)] disabled:opacity-50 transition-colors";
const cancelBtnCls = "border border-[var(--border-light)] text-[var(--text-secondary)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--surface-subtle)] transition-colors";
