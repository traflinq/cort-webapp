"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAppDispatch, useAppSelector } from "../../../lib/store/hooks";
import { selectCompany } from "../../../lib/store/slices/companySlice";
import { fetchEmployees, selectEmployees } from "../../../lib/store/slices/employeeSlice";
import { fetchContract, selectAllowedVehicleModels } from "../../../lib/store/slices/contractSlice";
import { fetchCompanyFeatures, selectCompanyFeatures, selectCompanyFeaturesStatus } from "../../../lib/store/slices/companySlice";
import Map from "../../../admin/ui/Map";
import { useGooglePlacesAutocomplete } from "../../../hooks/useGooglePlacesAutocomplete";
import { AutocompleteInput } from "../../../components/AutocompleteInput";
import { pakistaniCars } from "../../../lib/data/pakistaniCars";
import { pakistaniCities } from "../../../lib/data/pakistaniCities";
import { apiClient, canServeChauffeur } from "../../../lib/services/api-client";
import { selectContract } from "../../../lib/store/slices/contractSlice";
import OutstationEstimatePanel from "./OutstationEstimatePanel";
import { PoolVehicle, PoolDriver, CompanyVendorLink, VendorVehicle } from "../../../lib/services/types/multi-mode";

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

function CardSection({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-default)] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-500">
            <div className="flex items-center gap-2.5 mb-6 px-1">
                {icon && <div className="text-[#fe8503]">{icon}</div>}
                <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">{title}</h3>
            </div>
            <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
                {children}
            </div>
        </div>
    );
}

function Field({
    label,
    children,
    required,
    className,
}: {
    label: string;
    children: React.ReactNode;
    required?: boolean;
    className?: string;
}) {
    return (
        <label className={cx("flex flex-col gap-2", className)}>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] px-1">
                {label}
                {required && <span className="text-[#fe8503] ms-0.5"> *</span>}
            </span>
            {children}
        </label>
    );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={cx(
                "h-12 rounded-xl border border-[var(--border-input)] bg-[var(--bg-card)] px-4 text-sm font-medium outline-none transition-all placeholder:text-[var(--text-placeholder)] focus:bg-[var(--bg-input-focus)] focus:border-[#fe8503] focus:ring-4 focus:ring-[#fe8503]/10 text-[var(--text-primary)]",
                props.className,
            )}
        />
    );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div className="relative group">
            <select
                {...props}
                className={cx(
                    "w-full h-12 rounded-xl border border-[var(--border-input)] bg-[var(--bg-card)] px-4 text-sm font-bold outline-none transition-all focus:bg-[var(--bg-input-focus)] focus:border-[#fe8503] focus:ring-4 focus:ring-[#fe8503]/10 text-[var(--text-primary)] appearance-none",
                    props.className,
                )}
            />
            <div className="absolute end-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)] group-focus-within:text-[var(--cort-orange)] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
    );
}

// ... existing interface ...
interface CreateBookingFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

export default function CreateBookingForm({ onSuccess, onCancel }: CreateBookingFormProps) {
    const t = useTranslations("company.bookings");
    const tFulfillment = useTranslations("common.fulfillment");
    const tCommon = useTranslations("common");
    const dispatch = useAppDispatch();
    const company = useAppSelector(selectCompany);
    const employees = useAppSelector(selectEmployees);
    const allowedVehicleModels = useAppSelector(selectAllowedVehicleModels);
    const contract = useAppSelector(selectContract);
    const features = useAppSelector(selectCompanyFeatures);
    const featuresStatus = useAppSelector(selectCompanyFeaturesStatus);
    const featuresLoading = featuresStatus === 'idle' || featuresStatus === 'loading';

    // Legacy store for createBooking action (to be refactored or kept if just an action)

    // Fulfillment type (multi-mode feature) — declared before useEffects to avoid TDZ errors
    const [fulfillmentType, setFulfillmentType] = useState<"CORT_MANAGED" | "EXTERNAL_VENDOR" | "SELF_MANAGED">("CORT_MANAGED");
    const [poolVehicles, setPoolVehicles] = useState<PoolVehicle[]>([]);
    const [poolDrivers, setPoolDrivers] = useState<PoolDriver[]>([]);
    const [poolVehicleId, setPoolVehicleId] = useState<number | null>(null);
    const [poolDriverId, setPoolDriverId] = useState<string | null>(null);

    // Vendor state for EXTERNAL_VENDOR fulfillment
    const [vendorLinks, setVendorLinks] = useState<CompanyVendorLink[]>([]);
    const [vendorVehicleMap, setVendorVehicleMap] = useState<Record<number, VendorVehicle[]>>({});
    const [vendorMode, setVendorMode] = useState<"all" | number>("all"); // "all" or specific link id
    const [vendorsLoading, setVendorsLoading] = useState(false);
    /** CORT_MANAGED + external feature: also fan out to vendors (first assignment wins). */
    const [broadcastToAllVendors, setBroadcastToAllVendors] = useState(false);

    useEffect(() => {
        if (!company?.id) return;
        const companyId = Number(company.id);

        dispatch(fetchEmployees(company.id.toString()));
        dispatch(fetchContract());
        dispatch(fetchCompanyFeatures(companyId));

        // Prefetch all mode data in parallel so it is ready before the user clicks any option.
        // This also prevents duplicate fetches when switching between fulfillment types.
        setVendorsLoading(true);

        Promise.all([
            apiClient.getPoolVehicles(companyId).catch(() => ({ data: [] as PoolVehicle[] })),
            apiClient.getPoolDrivers(companyId).catch(() => ({ data: [] as PoolDriver[] })),
            apiClient.getCompanyExternalVendors(companyId).catch(() => ({ data: [] as CompanyVendorLink[] })),
        ]).then(async ([poolVehiclesRes, poolDriversRes, vendorsRes]) => {
            setPoolVehicles(poolVehiclesRes.data);
            setPoolDrivers(poolDriversRes.data);

            const chauffeurLinks = (vendorsRes.data as CompanyVendorLink[]).filter(
                (l) => l.serves_chauffeur && l.is_active,
            );
            setVendorLinks(chauffeurLinks);

            // Fetch vehicles for every vendor link in parallel
            const vehicleMap: Record<number, VendorVehicle[]> = {};
            await Promise.all(
                chauffeurLinks.map(async (link) => {
                    try {
                        const vr = await apiClient.getVendorVehicles(link.id);
                        vehicleMap[link.id] = vr.data;
                    } catch {
                        vehicleMap[link.id] = [];
                    }
                }),
            );
            setVendorVehicleMap(vehicleMap);
        }).catch(() => {}).finally(() => {
            setVendorsLoading(false);
        });
    }, [dispatch, company?.id]);

    const availableFulfillmentTypes = useMemo(() => {
        const opts: { value: "CORT_MANAGED" | "EXTERNAL_VENDOR" | "SELF_MANAGED"; label: string }[] = [];
        if (features.find((f) => f.feature_key === "chauffeur_cort_managed")?.is_enabled) {
            opts.push({ value: "CORT_MANAGED", label: tFulfillment("cortManaged") });
        }
        if (features.find((f) => f.feature_key === "chauffeur_external_vendor")?.is_enabled) {
            opts.push({ value: "EXTERNAL_VENDOR", label: tFulfillment("externalVendor") });
        }
        if (features.find((f) => f.feature_key === "chauffeur_self_managed")?.is_enabled) {
            opts.push({ value: "SELF_MANAGED", label: tFulfillment("selfManaged") });
        }
        return opts;
    }, [features, tFulfillment]);

    const showBroadcastOption = useMemo(() => {
        return (
            availableFulfillmentTypes.some((o) => o.value === "CORT_MANAGED") &&
            availableFulfillmentTypes.some((o) => o.value === "EXTERNAL_VENDOR")
        );
    }, [availableFulfillmentTypes]);

    // Auto-select first available fulfillment type after features load
    useEffect(() => {
        if (!featuresLoading && availableFulfillmentTypes.length > 0) {
            if (!availableFulfillmentTypes.find((o) => o.value === fulfillmentType)) {
                setFulfillmentType(availableFulfillmentTypes[0].value);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [featuresLoading, availableFulfillmentTypes]);

    const [serviceCategory, setServiceCategory] = useState<string>("Chauffeur Ride");
    const [passengerId, setPassengerId] = useState<string>("");
    const [vehicleModel, setVehicleModel] = useState<string>("");
    const [customVehicleModel, setCustomVehicleModel] = useState<string>("");
    const [packageType, setPackageType] = useState<"5hr" | "10hr" | "24hr" | "monthly_10hr" | "monthly_24hr">("10hr");
    const [tripType, setTripType] = useState<"in_city" | "out_station">("in_city");
    const [timeType, setTimeType] = useState<"now" | "scheduled">("now");
    const [scheduledDateTime, setScheduledDateTime] = useState<string>("");
    const [pickupAddress, setPickupAddress] = useState<string>("");
    const [pickupLat, setPickupLat] = useState<number | undefined>();
    const [pickupLng, setPickupLng] = useState<number | undefined>();
    const [destinationCities, setDestinationCities] = useState<string[]>([]);
    const [cityInput, setCityInput] = useState("");
    const [bookingCity, setBookingCity] = useState(""); // City for the booking itself
    const [noOfDays, setNoOfDays] = useState<number>(1);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const EVENT_SHUTTLE_SEATER_OPTIONS = [
        "7 Seater",
        "14 Seater AC",
        "14 Seater Non-AC",
        "24 Seater",
        "32 Seater Non-AC",
        "48 Seater",
        "62 Seater AC",
        "62 Seater Non-AC",
    ];

    const isEventShuttle = serviceCategory === "Event Shuttle";

    // Initialize Google Places autocomplete
    const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    const { suggestions, isLoading: isLoadingSuggestions, search, clearSuggestions, refreshToken } = useGooglePlacesAutocomplete({
        apiKey: googleMapsKey,
    });

    const activeEmployees = useMemo(() => {
        return employees.filter((e) => e.status === "ACTIVE");
    }, [employees]);

    // Unique vehicle models from vendor vehicles (filtered by selected vendor for EXTERNAL_VENDOR)
    const vendorCarModels = useMemo(() => {
        let vehicles: VendorVehicle[] = [];
        if (vendorMode === "all") {
            vehicles = Object.values(vendorVehicleMap).flat();
        } else {
            vehicles = vendorVehicleMap[vendorMode] ?? [];
        }
        const seen = new Set<string>();
        const models: string[] = [];
        for (const v of vehicles) {
            const key = `${v.make} ${v.model}`.trim();
            if (key && !seen.has(key)) {
                seen.add(key);
                models.push(key);
            }
        }
        return models;
    }, [vendorVehicleMap, vendorMode]);

    // Union of contract and vendor models when racing Cort + vendors (non–event shuttle)
    const cortBroadcastCarModels = useMemo(() => {
        if (isEventShuttle || !broadcastToAllVendors || fulfillmentType !== "CORT_MANAGED") return null;
        const seen = new Set<string>();
        const out: string[] = [];
        for (const m of allowedVehicleModels) {
            if (m && !seen.has(m)) {
                seen.add(m);
                out.push(m);
            }
        }
        for (const m of vendorCarModels) {
            if (m && !seen.has(m)) {
                seen.add(m);
                out.push(m);
            }
        }
        return out;
    }, [isEventShuttle, broadcastToAllVendors, fulfillmentType, allowedVehicleModels, vendorCarModels]);

    // Derive the contract rate for the selected vehicle model (used for outstation cost estimate)
    const selectedContractRate = useMemo(() => {
        if (!contract?.chauffeur_contract_rates || !vehicleModel || vehicleModel === "Other") return null;
        return contract.chauffeur_contract_rates.find(
            (r: any) => r.vehicle_model === vehicleModel
        ) ?? null;
    }, [contract, vehicleModel]);

    const outstationAllowancePerDay = useMemo(() => {
        return Number(contract?.allowance_outstation ?? 0);
    }, [contract]);

    const accommodationAllowancePerNight = useMemo(() => {
        return Number(contract?.allowance_accommodation ?? 0);
    }, [contract]);

    const canSubmit = useMemo(() => {
        const vehicleModelValid = isEventShuttle
            ? vehicleModel.length > 0
            : (vehicleModel === "Other" ? customVehicleModel.length > 0 : vehicleModel.length > 0);

        // For Event Shuttle, passenger is optional (group booking — falls back to auth user)
        const passengerValid = isEventShuttle ? true : passengerId.length > 0;

        const basicFields =
            passengerValid &&
            vehicleModelValid &&
            (timeType === "now" || scheduledDateTime.length > 0) &&
            pickupAddress.length > 0 &&
            bookingCity.length > 0 &&
            pickupLat !== undefined &&
            pickupLng !== undefined &&
            noOfDays >= 1;

        if (tripType === "out_station") {
            if (!basicFields || destinationCities.length === 0) return false;
        } else if (!basicFields) {
            return false;
        }

        if (fulfillmentType === "CORT_MANAGED" && broadcastToAllVendors && !isEventShuttle) {
            if (vendorsLoading || vendorLinks.length === 0) return false;
            if (!cortBroadcastCarModels || cortBroadcastCarModels.length === 0) return false;
        }

        return true;
    }, [passengerId, vehicleModel, customVehicleModel, isEventShuttle, timeType, scheduledDateTime, pickupAddress, pickupLat, pickupLng, tripType, destinationCities, bookingCity, noOfDays, fulfillmentType, broadcastToAllVendors, vendorsLoading, vendorLinks.length, cortBroadcastCarModels]);

    const handleAddCity = () => {
        if (cityInput.trim()) {
            setDestinationCities([...destinationCities, cityInput.trim()]);
            setCityInput("");
        }
    };

    const handleRemoveCity = (index: number) => {
        setDestinationCities(destinationCities.filter((_, i) => i !== index));
    };

    const handleCityKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCity();
        }
    };

    if (!company) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-sm text-[var(--text-muted)]">{tCommon("errors.noCompanySelected")}</div>
            </div>
        );
    }

    if (!company.services_enabled.chauffeur_enabled) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="rounded-xl border border-[var(--border-input)] bg-[var(--bg-card)] p-6 text-center">
                    <div className="text-lg font-bold text-[var(--text-primary)]">{t("chauffeurDisabled")}</div>
                    <div className="mt-2 text-sm text-[var(--text-muted)]">
                        {t("chauffeurDisabledHint")}
                    </div>
                </div>
            </div>
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        if (!company) {
            setError(t("companyNotFound"));
            setIsSubmitting(false);
            return;
        }

        if (!canSubmit) {
            if (!pickupLat || !pickupLng) {
                setError(t("selectMapLocation"));
            } else {
                setError(tCommon("validation.fillRequiredFields"));
            }
            setIsSubmitting(false);
            return;
        }

        const passenger = employees.find((e) => e.id === passengerId);
        if (!passenger && !isEventShuttle) {
            setError(t("passengerNotFound"));
            setIsSubmitting(false);
            return;
        }

        // Determine scheduled_at
        const scheduledAt =
            timeType === "now"
                ? new Date().toISOString()
                : new Date(scheduledDateTime).toISOString();

        try {
            const apiData: any = {
                booking_type: packageType.includes('monthly') ? 'MONTHLY' : 'SPOT' as any,
                vehicle_model: vehicleModel === "Other" ? customVehicleModel : vehicleModel,
                is_special_request: vehicleModel === "Other",
                package_selected: transformPackageType(packageType) as any,
                trip_type: transformTripType(tripType) as any,
                pickup_location: {
                    latitude: pickupLat!,
                    longitude: pickupLng!,
                },
                pickup_address: pickupAddress,
                scheduled_for: scheduledAt,
                destination_cities: tripType === "out_station" ? destinationCities : [],
                service_category: serviceCategory,
                city: bookingCity,
                no_of_days: noOfDays,
            };

            // For Chauffeur Ride, passenger is required; for Event Shuttle it's optional (group booking)
            if (passengerId) {
                apiData.passenger_id = passengerId;
            }

            apiData.fulfillment_type = fulfillmentType;
            if (fulfillmentType === "SELF_MANAGED") {
                if (poolVehicleId) apiData.vehicle_id = poolVehicleId;
                if (poolDriverId) apiData.driver_id = poolDriverId;
            }
            if (fulfillmentType === "EXTERNAL_VENDOR" && vendorMode !== "all") {
                apiData.vendor_link_ids = [vendorMode];
            }
            if (fulfillmentType === "CORT_MANAGED" && broadcastToAllVendors) {
                apiData.broadcast_to_all_vendors = true;
                if (vendorMode !== "all") {
                    apiData.vendor_link_ids = [vendorMode];
                }
            }

            await apiClient.createChauffeurBooking(Number(company.id), apiData);

            // Reset form handled by parent unmounting or manual reset if needed, but we close modal on success
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : t("createFailed"));
        } finally {
            setIsSubmitting(false);
        }
    }

    // Helpers
    const transformPackageType = useCallback((pkg: string): string => {
        const pkgMap: Record<string, string> = {
            '5hr': 'HOURS_5',
            '10hr': 'HOURS_10',
            '24hr': 'HOURS_24',
            'monthly_10hr': 'HOURS_10',
            'monthly_24hr': 'HOURS_24',
        };
        return pkgMap[pkg] || 'HOURS_10';
    }, []);

    const transformTripType = useCallback((tripType: string): string => {
        return tripType === 'in_city' ? 'IN_CITY' : 'OUT_STATION';
    }, []);

    // No minimum datetime restriction — past dates are allowed for data entry purposes

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div className="flex flex-col gap-6">
                {/* Fulfillment Type Selector — always show when SELF_MANAGED (pool driver picker);
                    hide type buttons when only one fulfillment mode is enabled. */}
                {featuresLoading ? (
                    <div className="bg-[var(--cort-orange)]/10 border border-[var(--cort-orange)]/20 rounded-2xl p-5 animate-pulse">
                        <div className="h-2.5 w-28 bg-[var(--cort-orange)]/30 rounded mb-4"></div>
                        <div className="flex gap-2">
                            <div className="h-9 w-28 bg-[var(--cort-orange)]/30 rounded-xl"></div>
                            <div className="h-9 w-28 bg-[var(--cort-orange)]/30 rounded-xl opacity-60"></div>
                        </div>
                    </div>
                ) : availableFulfillmentTypes.length > 0 && (
                    <div className="bg-[var(--cort-orange)]/10 border border-[var(--cort-orange)]/20 rounded-2xl p-5">
                        {availableFulfillmentTypes.length > 1 && (
                            <>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-3">{t("fulfillmentType")}</p>
                        <div className="flex flex-wrap gap-2">
                            {availableFulfillmentTypes.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        setFulfillmentType(opt.value);
                                        setVehicleModel("");
                                        setPoolVehicleId(null);
                                        setPoolDriverId(null);
                                        if (opt.value !== "CORT_MANAGED") setBroadcastToAllVendors(false);
                                    }}
                                    className={cx(
                                        "px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all",
                                        fulfillmentType === opt.value
                                            ? "bg-[var(--cort-orange)] border-[var(--cort-orange)] text-white"
                                            : "bg-[var(--bg-card)] border-[var(--border-input)] text-[var(--text-primary)] hover:border-[var(--cort-orange)]/50"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                            </>
                        )}
                        {fulfillmentType === "CORT_MANAGED" && showBroadcastOption && (
                            <div className="mt-4 space-y-3 border-t border-[var(--cort-orange)]/20 pt-4">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={broadcastToAllVendors}
                                        onChange={(e) => {
                                            const on = e.target.checked;
                                            setBroadcastToAllVendors(on);
                                            setVehicleModel("");
                                            if (on) setVendorMode("all");
                                        }}
                                        className="mt-1 rounded border-[var(--border-input)] text-[var(--cort-orange)] focus:ring-[var(--cort-orange)]"
                                    />
                                    <span className="text-sm text-[var(--text-primary)] leading-snug">
                                        <span className="font-bold">{t("alsoSendToVendors")}</span>
                                        <span className="block text-xs font-medium text-[var(--text-secondary)] mt-1">
                                            {t("broadcastHint")}
                                        </span>
                                    </span>
                                </label>
                                {broadcastToAllVendors && (
                                    <>
                                        {vendorsLoading ? (
                                            <div className="text-xs text-[var(--text-muted)] font-medium animate-pulse px-1">{t("loadingVendors")}</div>
                                        ) : vendorLinks.length === 0 ? (
                                            <p className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 font-semibold">
                                                {t("noActiveVendors")}
                                            </p>
                                        ) : (
                                            <>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] px-1">{t("sendVendorRequestsTo")}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setVendorMode("all"); setVehicleModel(""); }}
                                                        className={cx(
                                                            "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                                            vendorMode === "all"
                                                                ? "bg-[var(--cort-orange)] border-[var(--cort-orange)] text-white"
                                                                : "bg-[var(--bg-card)] border-[var(--border-input)] text-[var(--text-primary)] hover:border-[var(--cort-orange)]/40"
                                                        )}
                                                    >
                                                        {t("allVendorsCount", { count: vendorLinks.length })}
                                                    </button>
                                                    {vendorLinks.map((link) => (
                                                        <button
                                                            key={link.id}
                                                            type="button"
                                                            onClick={() => { setVendorMode(link.id); setVehicleModel(""); }}
                                                            className={cx(
                                                                "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                                                vendorMode === link.id
                                                                    ? "bg-[var(--cort-orange)] border-[var(--cort-orange)] text-white"
                                                                    : "bg-[var(--bg-card)] border-[var(--border-input)] text-[var(--text-primary)] hover:border-[var(--cort-orange)]/40"
                                                            )}
                                                        >
                                                            {link.external_vendors?.name ?? t("vendorHash", { id: link.id })}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                        {fulfillmentType === "EXTERNAL_VENDOR" && (
                            <div className="mt-3 space-y-2">
                                {vendorsLoading ? (
                                    <div className="text-xs text-[var(--text-muted)] font-medium animate-pulse px-1">{t("loadingVendors")}</div>
                                ) : vendorLinks.length === 0 ? (
                                    <p className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 font-semibold">
                                        {t("noActiveVendorsExternal")}
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] px-1">{t("sendRequestTo")}</p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setVendorMode("all"); setVehicleModel(""); }}
                                                className={cx(
                                                    "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                                    vendorMode === "all"
                                                        ? "bg-[var(--cort-orange)] border-[var(--cort-orange)] text-white"
                                                        : "bg-[var(--bg-card)] border-[var(--border-input)] text-[var(--text-primary)] hover:border-[var(--cort-orange)]/40"
                                                )}
                                            >
                                                {t("allVendorsCaps", { count: vendorLinks.length })}
                                            </button>
                                            {vendorLinks.map((link) => (
                                                <button
                                                    key={link.id}
                                                    type="button"
                                                    onClick={() => { setVendorMode(link.id); setVehicleModel(""); }}
                                                    className={cx(
                                                        "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                                        vendorMode === link.id
                                                            ? "bg-[var(--cort-orange)] border-[var(--cort-orange)] text-white"
                                                            : "bg-[var(--bg-card)] border-[var(--border-input)] text-[var(--text-primary)] hover:border-[var(--cort-orange)]/40"
                                                    )}
                                                >
                                                    {link.external_vendors?.name ?? t("vendorHash", { id: link.id })}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-[var(--text-muted)] px-1">
                                            {vendorMode === "all"
                                                ? t("requestAllVendors")
                                                : t("requestSingleVendor", { name: vendorLinks.find((l) => l.id === vendorMode)?.external_vendors?.name ?? t("selectedVendor") })}
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                        {fulfillmentType === "SELF_MANAGED" && (
                            <div className={availableFulfillmentTypes.length > 1 ? "mt-3" : ""}>
                                <div>
                                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">{t("poolDriver")}</label>
                                    <select
                                        value={poolDriverId ?? ""}
                                        onChange={(e) => setPoolDriverId(e.target.value || null)}
                                        className="w-full h-10 rounded-xl border border-[var(--border-input)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)]"
                                        required
                                    >
                                        <option value="">{t("selectDriverOption")}</option>
                                        {poolDrivers
                                            .filter((d) => canServeChauffeur(d.driver_type) && d.users.status === "ACTIVE")
                                            .map((d) => (
                                            <option key={d.user_id} value={d.user_id}>{d.users.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Service Configuration Section */}
                <CardSection
                    title={t("serviceConfiguration")}
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                >
                    <Field label={t("serviceType")} required>
                        <Select
                            value={serviceCategory}
                            onChange={(e) => setServiceCategory(e.target.value)}
                            required
                        >
                            <option value="Chauffeur Ride">{t("chauffeurRide")}</option>
                            <option value="Event Shuttle">{t("eventShuttle")}</option>
                        </Select>
                    </Field>

                    <Field label={t("city")} required>
                        <AutocompleteInput
                            value={bookingCity}
                            onChange={setBookingCity}
                            options={pakistaniCities}
                            placeholder={t("cityPlaceholder")}
                            required
                        />
                    </Field>

                    <Field label={t("passenger")} required={!isEventShuttle} className="sm:col-span-2">
                        <Select
                            value={passengerId}
                            onChange={(e) => setPassengerId(e.target.value)}
                            required={!isEventShuttle}
                            autoFocus
                        >
                            <option value="">{isEventShuttle ? t("groupBookingNone") : t("selectEmployee")}</option>
                            {activeEmployees.map((e) => (
                                <option key={e.id} value={e.id}>
                                    {e.full_name} {e.employee_id ? `(${e.employee_id})` : ''}
                                </option>
                            ))}
                        </Select>
                        {isEventShuttle && (
                            <div className="mt-1.5 text-[10px] text-[var(--text-muted)] font-bold px-1 uppercase tracking-tight">
                                {t("passengerOptionalHint")}
                            </div>
                        )}
                    </Field>
                </CardSection>

                {/* Trip Details Section */}
                <CardSection
                    title={t("rideDetails")}
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                >
                    <Field label={isEventShuttle ? t("seaterType") : t("carType")} required>
                        {isEventShuttle ? (
                            <Select
                                value={vehicleModel}
                                onChange={(e) => setVehicleModel(e.target.value)}
                                required
                            >
                                <option value="">{t("selectType")}</option>
                                {EVENT_SHUTTLE_SEATER_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </Select>
                        ) : fulfillmentType === "EXTERNAL_VENDOR" ? (
                            <Select
                                value={vehicleModel}
                                onChange={(e) => setVehicleModel(e.target.value)}
                                required
                                disabled={vendorsLoading || vendorCarModels.length === 0}
                            >
                                <option value="">
                                    {vendorsLoading ? t("loadingVendorVehicles") : vendorCarModels.length === 0 ? t("noVendorVehicles") : t("selectVehicleType")}
                                </option>
                                {vendorCarModels.map((model) => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
                                <option value="Other">{t("otherSpecialRequest")}</option>
                            </Select>
                        ) : fulfillmentType === "CORT_MANAGED" && broadcastToAllVendors && cortBroadcastCarModels ? (
                            <Select
                                value={vehicleModel}
                                onChange={(e) => setVehicleModel(e.target.value)}
                                required
                                disabled={vendorsLoading || cortBroadcastCarModels.length === 0}
                            >
                                <option value="">
                                    {vendorsLoading ? t("loadingShort") : cortBroadcastCarModels.length === 0 ? t("noMatchingVehicleTypes") : t("selectVehicleTypeContractVendor")}
                                </option>
                                {cortBroadcastCarModels.map((model) => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
                                <option value="Other">{t("otherSpecialRequest")}</option>
                            </Select>
                        ) : fulfillmentType === "SELF_MANAGED" ? (
                            <Select
                                value={poolVehicleId !== null ? String(poolVehicleId) : ""}
                                onChange={(e) => {
                                    const id = Number(e.target.value) || null;
                                    setPoolVehicleId(id);
                                    if (id) {
                                        const v = poolVehicles.find((pv) => pv.id === id);
                                        setVehicleModel(v ? `${v.make} ${v.model}` : "");
                                    } else {
                                        setVehicleModel("");
                                    }
                                }}
                                required
                                disabled={poolVehicles.length === 0}
                            >
                                <option value="">
                                    {poolVehicles.length === 0 ? t("noPoolVehicles") : t("selectPoolVehicle")}
                                </option>
                                {poolVehicles.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.plate_number} — {v.make} {v.model}
                                    </option>
                                ))}
                            </Select>
                        ) : (
                            <Select
                                value={vehicleModel}
                                onChange={(e) => setVehicleModel(e.target.value)}
                                required
                                disabled={allowedVehicleModels.length === 0}
                            >
                                <option value="">
                                    {allowedVehicleModels.length === 0 ? t("noVehiclesWhitelisted") : t("selectVehicle")}
                                </option>
                                {allowedVehicleModels.map((model) => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
                                <option value="Other">{t("otherSpecialRequest")}</option>
                            </Select>
                        )}
                        {!isEventShuttle && fulfillmentType === "CORT_MANAGED" && allowedVehicleModels.length === 0 && (
                            <div className="mt-1 text-[10px] text-rose-500 font-black uppercase">
                                {t("noVehiclesWhitelistedWarning")}
                            </div>
                        )}
                        {!isEventShuttle && fulfillmentType === "EXTERNAL_VENDOR" && !vendorsLoading && vendorCarModels.length === 0 && (
                            <div className="mt-1 text-[10px] text-rose-500 font-black uppercase">
                                {t("noVendorVehiclesFound")}
                            </div>
                        )}
                        {!isEventShuttle && fulfillmentType === "CORT_MANAGED" && broadcastToAllVendors && !vendorsLoading && cortBroadcastCarModels && cortBroadcastCarModels.length === 0 && (
                            <div className="mt-1 text-[10px] text-rose-500 font-black uppercase">
                                {t("noOverlapVehicles")}
                            </div>
                        )}
                    </Field>

                    {!isEventShuttle && fulfillmentType !== "SELF_MANAGED" && vehicleModel === "Other" && (
                        <div className="-mt-2 text-[10px] font-black uppercase tracking-wide text-[#fe8503]">
                            {t("specialRequestSelected")}
                        </div>
                    )}

                    {!isEventShuttle && fulfillmentType !== "SELF_MANAGED" && vehicleModel === "Other" && (
                        <Field label={t("specifyVehicle")} required>
                            <AutocompleteInput
                                value={customVehicleModel}
                                onChange={setCustomVehicleModel}
                                options={pakistaniCars}
                                placeholder={t("vehiclePlaceholder")}
                                required
                            />
                        </Field>
                    )}

                    <Field label={t("usagePackage")} required>
                        <Select
                            value={packageType}
                            onChange={(e) => setPackageType(e.target.value as any)}
                            required
                        >
                            <optgroup label={t("spot")}>
                                <option value="5hr">{t("hours5")}</option>
                                <option value="10hr">{t("hours10")}</option>
                                <option value="24hr">{t("hours24")}</option>
                            </optgroup>
                            <optgroup label={t("monthly")}>
                                <option value="monthly_10hr">{t("monthly10hr")}</option>
                                <option value="monthly_24hr">{t("monthly24hr")}</option>
                            </optgroup>
                        </Select>
                    </Field>

                    <Field label={t("tripType")} required>
                        <Select
                            value={tripType}
                            onChange={(e) => setTripType(e.target.value as any)}
                            required
                        >
                            <option value="in_city">{t("inCity")}</option>
                            <option value="out_station">{t("outStation")}</option>
                        </Select>
                    </Field>

                    <Field label={t("numberOfDays")} required>
                        <TextInput
                            type="number"
                            min={1}
                            value={noOfDays}
                            onChange={(e) => setNoOfDays(parseInt(e.target.value) || 1)}
                            required
                        />
                    </Field>

                    {tripType === "out_station" && (
                        <div className="sm:col-span-2">
                            <Field label={t("destinationCities")} required>
                                <div className="flex gap-2">
                                    <AutocompleteInput
                                        value={cityInput}
                                        onChange={(val) => setCityInput(val)}
                                        options={pakistaniCities}
                                        placeholder={t("searchAddCity")}
                                        className="flex-1"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddCity}
                                        disabled={!cityInput.trim()}
                                        className="h-12 px-6 rounded-xl bg-[var(--cort-orange)]/10 text-[var(--cort-orange)] text-xs font-black uppercase hover:bg-[var(--cort-orange)]/20 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {tCommon("actions.add")}
                                    </button>
                                </div>
                                {destinationCities.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {destinationCities.map((city, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center gap-2 rounded-full bg-[var(--bg-subtle)] px-4 py-1.5 text-xs font-black text-[var(--text-primary)] border border-[var(--border-input)]"
                                            >
                                                <span>{city}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCity(index)}
                                                    className="w-4 h-4 rounded-full bg-white/10 text-[var(--text-muted)] flex items-center justify-center hover:bg-rose-500 hover:text-[var(--text-primary)] transition-all"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Live outstation cost estimate */}
                                <OutstationEstimatePanel
                                    originCity={bookingCity}
                                    destinationCities={destinationCities}
                                    noOfDays={noOfDays}
                                    packageType={packageType}
                                    contractRate={selectedContractRate}
                                    outstationAllowancePerDay={outstationAllowancePerDay}
                                    accommodationAllowancePerNight={accommodationAllowancePerNight}
                                />
                            </Field>
                        </div>
                    )}
                </CardSection>

                {/* Logistics Section */}
                <CardSection
                    title={t("logisticsSchedule")}
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                >
                    <Field label={t("pickupTime")} required>
                        <Select
                            value={timeType}
                            onChange={(e) => setTimeType(e.target.value as any)}
                            required
                        >
                            <option value="now">{t("nowQuickDispatch")}</option>
                            <option value="scheduled">{t("scheduledLater")}</option>
                        </Select>
                    </Field>

                    {timeType === "scheduled" && (
                        <Field label={t("scheduledAt")} required>
                            <TextInput
                                type="datetime-local"
                                value={scheduledDateTime}
                                onChange={(e) => setScheduledDateTime(e.target.value)}
                                required
                            />
                        </Field>
                    )}

                    <Field label={t("exactAddress")} required className="sm:col-span-2">
                        <TextInput
                            value={pickupAddress}
                            onChange={(e) => setPickupAddress(e.target.value)}
                            placeholder={t("addressPlaceholder")}
                            required
                        />
                    </Field>

                    <div className="sm:col-span-2 space-y-4">
                        <div className="bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] p-5 mt-2">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">{t("interactivePin")}</div>
                                {pickupLat && pickupLng && (
                                    <div className="text-[9px] font-mono text-[var(--cort-orange)] font-bold bg-[var(--cort-orange)]/5 px-2 py-1 rounded-lg">
                                        {pickupLat.toFixed(4)}, {pickupLng.toFixed(4)}
                                    </div>
                                )}
                            </div>

                            {/* Map Search Bar */}
                            <div className="relative mb-4 z-[50]">
                                <TextInput
                                    onChange={(e) => search(e.target.value)}
                                    placeholder={t("searchMapPlaceholder")}
                                    className="w-full ps-11 bg-[var(--bg-card)]"
                                />
                                <div className="absolute start-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                {isLoadingSuggestions && (
                                    <div className="absolute end-3 top-1/2 -translate-y-1/2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--cort-orange)] border-t-transparent"></div>
                                    </div>
                                )}

                                {/* Suggestions Dropdown */}
                                {suggestions.length > 0 && (
                                    <div className="absolute top-full start-0 mt-2 w-full rounded-2xl border border-[var(--border-input)] bg-[var(--bg-card)] shadow-2xl max-h-60 overflow-auto z-[60] py-2">
                                        {suggestions.map((suggestion) => (
                                            <button
                                                key={suggestion.place_id}
                                                type="button"
                                                onClick={() => {
                                                    setPickupLat(suggestion.lat);
                                                    setPickupLng(suggestion.lng);
                                                    setPickupAddress(suggestion.display_name);
                                                    clearSuggestions();
                                                    refreshToken();
                                                }}
                                                className="w-full px-5 py-3 text-start hover:bg-[var(--bg-subtle)] transition-colors group"
                                            >
                                                <div className="text-xs font-black text-[var(--text-primary)] group-hover:text-[#fe8503] transition-colors">{suggestion.name}</div>
                                                <div className="text-[10px] text-[var(--text-muted)] mt-1 truncate font-medium">{suggestion.display_name}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl overflow-hidden border border-[var(--border-input)] shadow-inner bg-[var(--bg-page)]">
                                <Map
                                    height="280px"
                                    center={pickupLat && pickupLng ? [pickupLat, pickupLng] : undefined}
                                    markers={pickupLat && pickupLng ? [{ id: "pickup", position: [pickupLat, pickupLng] as any, label: t("pickupLabel"), color: "#FF6B00" }] : []}
                                    onMapClick={(lat, lng) => { setPickupLat(lat); setPickupLng(lng); }}
                                />
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-tight">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--cort-orange)] animate-pulse"></span>
                                {t("pinLocationHint")}
                            </div>
                        </div>
                    </div>
                </CardSection>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400 font-black uppercase tracking-tight flex items-start gap-3 animate-shake">
                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>{error}</span>
                </div>
            )}

            <div className="flex items-center gap-4 justify-end pt-8 border-t border-[var(--border-input)]">
                <button
                    type="button"
                    onClick={onCancel}
                    className="h-12 px-8 rounded-xl border border-[var(--border-input)] text-xs font-black uppercase text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-all active:scale-95"
                >
                    {t("discard")}
                </button>
                <button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    className="h-12 min-w-[180px] px-10 rounded-xl bg-[#fe8503] text-xs font-black uppercase text-[var(--text-primary)] shadow-xl shadow-[#fe8503]/20 hover:bg-[#f07a00] hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
                >
                    {isSubmitting ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                    ) : (
                        t("confirmBooking")
                    )}
                </button>
            </div>
        </form>
    );
}
