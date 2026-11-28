"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSaudiBasePath, withSaudiBase } from "@/app/lib/i18n/saudi-route";
import { useTranslations } from "next-intl";
import { Car, Plus, UserPlus } from "@/app/components/icons";
import { useCompanyAccess } from "../lib/access-context";
import { apiClient, canServeChauffeur, canServeShuttle } from "../../lib/services/api-client";
import { PoolVehicle, PoolDriver } from "../../lib/services/types/multi-mode";
import { VehicleCategory } from "../../lib/services/types/vehicles";
import { toast } from "sonner";
import { Card } from "../components/Card";
import { Badge, Button, Dialog, DialogContent, Field, Input, Select, StatusBadge, TableSkeletonRows, Tabs, TabsList, TabsTrigger } from "@/app/admin/ui";
import { AccountCredentialsReveal, SaveCredentialsNote } from "../components/AccountCredentialsReveal";
import { PageHeader, TableEmptyState, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../components/PageLayout";
import {
    getPhoneValidationError,
    PHONE_MAX_LENGTH,
    PHONE_PLACEHOLDER,
    sanitizePhoneInput,
} from "../../lib/utils/phone";

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
    // The page guard opens this page only when the company runs its own cars or shuttles (or is a trial).
    const { company, access } = useCompanyAccess();
    const companyId = company.id;
    const isTrialUser = !!access.trial;
    const trialPool = !!access.trial?.pool;
    const trialShuttle = !!access.trial?.shuttle;

    const fleetTabs = ["vehicles", "drivers"] as const;

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


    const atVehicleLimit = isTrialUser && vehicles.length >= (trialPool && trialShuttle ? 2 : 1);
    const chauffeurDriverCount = drivers.filter((d) => canServeChauffeur(d.driver_type)).length;
    const shuttleDriverCount = drivers.filter((d) => canServeShuttle(d.driver_type)).length;
    const atChauffeurDriverLimit = isTrialUser && trialPool && chauffeurDriverCount >= 1;
    const atShuttleDriverLimit = isTrialUser && trialShuttle && shuttleDriverCount >= 1;

    const showShuttleSeatCapacity = access.can.selfManageShuttle;

    const defaultDriverType = (): "CHAUFFEUR" | "SHUTTLE" | "BOTH" => {
        if (access.can.selfManageShuttle && !access.can.selfManageChauffeur) return "SHUTTLE";
        return "CHAUFFEUR";
    };

    const canAddChauffeurDriver = access.can.selfManageChauffeur;
    const canAddShuttleDriver = access.can.selfManageShuttle;

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
        if (activeTab === "vehicles") fetchVehicles();
        if (activeTab === "drivers") fetchDrivers();
    }, [activeTab, fetchVehicles, fetchDrivers]);

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
        if (trialPool && trialShuttle) return t("trialLimitsBoth");
        if (trialShuttle) return t("trialLimitsShuttle");
        return t("trialLimitsPool");
    }, [trialPool, trialShuttle, t]);

    const driverTypeLabel = (type: string) =>
        type === "SHUTTLE" ? t("driverTypeShuttle") : type === "BOTH" ? t("driverTypeBoth") : type === "CHAUFFEUR" ? t("driverTypeChauffeur") : type;

    return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12">
            <PageHeader
                label={isTrialUser ? t("trialFleetLabel") : t("selfManagedLabel")}
                title={isTrialUser ? t("trialFleetTitle") : t("title")}
                description={isTrialUser ? t("trialFleetDescription") : t("selfManagedDescription")}
                action={
                    activeTab === "vehicles" ? (
                        <Button leftIcon={<Plus />} onClick={() => setShowAddVehicle(true)} disabled={atVehicleLimit}>
                            {t("addVehicle")}
                        </Button>
                    ) : activeTab === "drivers" ? (
                        <Button
                            leftIcon={<UserPlus />}
                            onClick={openAddDriver}
                            disabled={
                                isTrialUser && trialPool && trialShuttle
                                    ? atChauffeurDriverLimit && atShuttleDriverLimit
                                    : isTrialUser
                                        ? (trialShuttle ? atShuttleDriverLimit : atChauffeurDriverLimit)
                                        : false
                            }
                        >
                            {t("inviteDriver")}
                        </Button>
                    ) : null
                }
            />

            {isTrialUser && (
                <div role="note" className="rounded-lg border border-warning-line bg-warning-soft px-4 py-3 text-sm text-fg">
                    <span className="font-semibold">{t("trialLimitsTitle")}</span>{" "}
                    {trialLimitsText}{" "}
                    {t("trialLimitsAssign")}
                </div>
            )}

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "vehicles" | "drivers")}>
                <TabsList>
                    {fleetTabs.map((tab) => (
                        <TabsTrigger key={tab} value={tab}>
                            {tab === "vehicles"
                                ? (isTrialUser ? t("vehicles") : t("poolVehicles"))
                                : (isTrialUser ? t("drivers") : t("poolDrivers"))}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {activeTab === "vehicles" && (
                <Card className={TABLE_CARD_CLASS}>
                    <div className={TABLE_TOP_BAR_CLASS}>
                        <p className="text-sm text-fg-muted">
                            {isTrialUser ? t("trialVehiclesDescription") : t("vehiclesDescription")}
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-start text-sm">
                            <thead>
                                <tr className="border-b border-line">
                                    {[t("plate"), t("makeModel"), t("year"), t("category"), t("status")].map((h) => (
                                        <th key={h} className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{h}</th>
                                    ))}
                                    <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("actions")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {vehiclesLoading ? (
                                    <TableSkeletonRows columns={6} rows={5} />
                                ) : vehicles.length === 0 ? (
                                    <TableEmptyState message={t("noPoolVehicles")} icon={Car} />
                                ) : vehicles.map((v) => (
                                    <tr key={v.id} className="transition-colors hover:bg-row-hover">
                                        <td className={`${TABLE_CELL_CLASS} ltr-content font-mono text-xs text-fg-secondary`}>{v.plate_number}</td>
                                        <td className={`${TABLE_CELL_CLASS} font-medium text-fg`}>{v.make} {v.model}</td>
                                        <td className={`${TABLE_CELL_CLASS} text-fg-secondary`}>{v.year}</td>
                                        <td className={`${TABLE_CELL_CLASS} text-fg-secondary`}>{formatVehicleCategory(v.category)}</td>
                                        <td className={TABLE_CELL_CLASS}>
                                            <StatusBadge status={v.status} size="sm" />
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-end`}>
                                            {v.status === "ACTIVE" && (
                                                <Button variant="ghost" size="sm" className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink" onClick={() => handleDeactivateVehicle(v.id)}>
                                                    {t("deactivate")}
                                                </Button>
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
                        <p className="text-sm text-fg-muted">
                            {isTrialUser ? t("trialDriversDescription") : t("driversDescription")}
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-start text-sm">
                            <thead>
                                <tr className="border-b border-line">
                                    {[t("name"), t("email"), t("phone"), t("type"), t("status")].map((h) => (
                                        <th key={h} className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{h}</th>
                                    ))}
                                    <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("actions")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {driversLoading ? (
                                    <TableSkeletonRows columns={6} rows={5} />
                                ) : drivers.length === 0 ? (
                                    <TableEmptyState message={t("noPoolDrivers")} icon={UserPlus} />
                                ) : drivers.map((d) => (
                                    <tr key={d.user_id} className="transition-colors hover:bg-row-hover">
                                        <td className={`${TABLE_CELL_CLASS} font-medium text-fg`}>{d.users.full_name}</td>
                                        <td className={`${TABLE_CELL_CLASS} text-fg-secondary`}><span className="ltr-content">{d.users.email}</span></td>
                                        <td className={`${TABLE_CELL_CLASS} text-fg-secondary`}><span className="ltr-content">{d.users.phone ?? "—"}</span></td>
                                        <td className={TABLE_CELL_CLASS}>
                                            <Badge size="sm" variant="outline">{driverTypeLabel(d.driver_type)}</Badge>
                                        </td>
                                        <td className={TABLE_CELL_CLASS}>
                                            <StatusBadge status={d.users.status} size="sm" />
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-end`}>
                                            {d.users.status === "ACTIVE" && (
                                                <Button variant="ghost" size="sm" className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink" onClick={() => handleDeactivateDriver(d.user_id)}>
                                                    {t("deactivate")}
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Dialog open={showAddVehicle} onOpenChange={(open) => { if (!open) setShowAddVehicle(false); }}>
                <DialogContent
                    size="md"
                    title={isTrialUser ? t("addFleetVehicle") : t("addPoolVehicle")}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <form onSubmit={handleAddVehicle} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label={t("plate")} required><Input required value={vehicleForm.plate_number} onChange={(e) => setVehicleForm((f) => ({ ...f, plate_number: e.target.value }))} /></Field>
                            <Field label={t("category")}>
                                <Select value={vehicleForm.category} onChange={(e) => setVehicleForm((f) => ({ ...f, category: e.target.value as VehicleCategory }))}>
                                    {VEHICLE_CATEGORIES.map((c) => (
                                        <option key={c} value={c}>{formatVehicleCategory(c)}</option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label={t("make")} required><Input required value={vehicleForm.make} onChange={(e) => setVehicleForm((f) => ({ ...f, make: e.target.value }))} /></Field>
                            <Field label={t("model")} required><Input required value={vehicleForm.model} onChange={(e) => setVehicleForm((f) => ({ ...f, model: e.target.value }))} /></Field>
                            <Field label={t("year")} required><Input required type="number" className="tabular-nums" value={vehicleForm.year} onChange={(e) => setVehicleForm((f) => ({ ...f, year: Number(e.target.value) }))} /></Field>
                            <Field label={t("color")}><Input value={vehicleForm.color} onChange={(e) => setVehicleForm((f) => ({ ...f, color: e.target.value }))} /></Field>
                            <Field label={t("fuelAvgCity")}><Input type="number" step="0.1" className="tabular-nums" value={vehicleForm.fuel_avg_city} onChange={(e) => setVehicleForm((f) => ({ ...f, fuel_avg_city: Number(e.target.value) }))} /></Field>
                            <Field label={t("fuelAvgHighway")}><Input type="number" step="0.1" className="tabular-nums" value={vehicleForm.fuel_avg_highway} onChange={(e) => setVehicleForm((f) => ({ ...f, fuel_avg_highway: Number(e.target.value) }))} /></Field>
                            <Field label={t("fuelType")}>
                                <Select value={vehicleForm.fuel_type} onChange={(e) => setVehicleForm((f) => ({ ...f, fuel_type: e.target.value as "" | "PETROL" | "DIESEL" }))}>
                                    <option value="">{t("fuelTypeAuto")}</option>
                                    <option value="PETROL">{t("fuelPetrol")}</option>
                                    <option value="DIESEL">{t("fuelDiesel")}</option>
                                </Select>
                            </Field>
                            <Field label={t("acLabel")}>
                                <Select value={vehicleForm.ac_on} onChange={(e) => setVehicleForm((f) => ({ ...f, ac_on: e.target.value as "" | "on" | "off" }))}>
                                    <option value="">{t("acUnset")}</option>
                                    <option value="on">{t("acOn")}</option>
                                    <option value="off">{t("acOff")}</option>
                                </Select>
                            </Field>
                            {showShuttleSeatCapacity && (
                                <Field label={t("seatCapacity")}>
                                    <Input type="number" min={1} className="tabular-nums" value={vehicleForm.seat_capacity} onChange={(e) => setVehicleForm((f) => ({ ...f, seat_capacity: Number(e.target.value) }))} />
                                </Field>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button type="button" variant="outline" onClick={() => setShowAddVehicle(false)}>{tCommon("actions.cancel")}</Button>
                            <Button type="submit" disabled={vehicleSaving}>{vehicleSaving ? t("adding") : t("addVehicle")}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={showAddDriver} onOpenChange={(open) => { if (!open) closeDriverModal(); }}>
                <DialogContent
                    size="md"
                    title={driverCreatedCredentials ? t("driverCreatedTitle") : (isTrialUser ? t("inviteFleetDriver") : t("invitePoolDriver"))}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    {driverCreatedCredentials ? (
                        <div className="space-y-5">
                            <p className="text-center text-sm text-fg-muted">
                                {t("driverInvitedAs", {
                                    name: driverCreatedCredentials.full_name,
                                    type: driverCreatedCredentials.driver_type === "SHUTTLE"
                                        ? t("driverTypeShuttle")
                                        : driverCreatedCredentials.driver_type === "BOTH"
                                            ? t("driverTypeBoth")
                                            : t("driverTypeChauffeur"),
                                })}
                            </p>
                            <AccountCredentialsReveal
                                email={driverCreatedCredentials.email}
                                password={driverCreatedCredentials.password}
                                fullName={driverCreatedCredentials.full_name}
                                subtitle={tCredentials("driverAppSubtitle")}
                                accountTypeKey="driver"
                            />
                            <div className="flex justify-end">
                                <Button type="button" onClick={closeDriverModal}>{tCredentials("done")}</Button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleInviteDriver} className="space-y-4">
                            <SaveCredentialsNote accountTypeKey="driver" />
                            {(canAddChauffeurDriver && canAddShuttleDriver) ? (
                                <Field label={t("driverTypeLabel")}>
                                    <Select
                                        required
                                        value={driverForm.driver_type}
                                        onChange={(e) => setDriverForm((f) => ({ ...f, driver_type: e.target.value as "CHAUFFEUR" | "SHUTTLE" | "BOTH" }))}
                                    >
                                        <option value="CHAUFFEUR" disabled={atChauffeurDriverLimit}>{t("driverTypeChauffeur")}</option>
                                        <option value="SHUTTLE" disabled={atShuttleDriverLimit}>{t("driverTypeShuttle")}</option>
                                        <option value="BOTH" disabled={atChauffeurDriverLimit || atShuttleDriverLimit}>{t("driverTypeBoth")}</option>
                                    </Select>
                                </Field>
                            ) : null}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field label={t("fullNameRequired")}><Input required value={driverForm.full_name} onChange={(e) => setDriverForm((f) => ({ ...f, full_name: e.target.value }))} /></Field>
                                <Field label={t("phone")}><Input type="tel" inputMode="numeric" maxLength={PHONE_MAX_LENGTH} value={driverForm.phone} onChange={(e) => setDriverForm((f) => ({ ...f, phone: sanitizePhoneInput(e.target.value) }))} placeholder={PHONE_PLACEHOLDER} /></Field>
                                <Field label={t("email")} required><Input required type="email" value={driverForm.email} onChange={(e) => setDriverForm((f) => ({ ...f, email: e.target.value }))} /></Field>
                                <Field label={t("passwordRequired")}><Input required type="password" minLength={8} value={driverForm.password} onChange={(e) => setDriverForm((f) => ({ ...f, password: e.target.value }))} /></Field>
                                <Field label={t("cnic")}><Input value={driverForm.cnic_number} onChange={(e) => setDriverForm((f) => ({ ...f, cnic_number: e.target.value }))} /></Field>
                                <Field label={t("licenseNo")}><Input value={driverForm.license_number} onChange={(e) => setDriverForm((f) => ({ ...f, license_number: e.target.value }))} /></Field>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <Button type="button" variant="outline" onClick={closeDriverModal}>{tCommon("actions.cancel")}</Button>
                                <Button type="submit" disabled={driverSaving}>{driverSaving ? t("inviting") : t("inviteDriver")}</Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
