"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAppDispatch, useAppSelector } from "../../../lib/store/hooks";
import { useCompanyAccess } from "../../lib/access-context";
import { chauffeurFulfilments, type ChauffeurFulfilment } from "../../lib/access";
import { fetchEmployees, selectEmployees } from "../../../lib/store/slices/employeeSlice";
import { fetchContract, selectAllowedVehicleModels } from "../../../lib/store/slices/contractSlice";
import Map from "../../../admin/ui/Map";
import { useGooglePlacesAutocomplete } from "../../../hooks/useGooglePlacesAutocomplete";
import { AutocompleteInput } from "../../../components/AutocompleteInput";
import { pakistaniCars } from "../../../lib/data/pakistaniCars";
import { pakistaniCities } from "../../../lib/data/pakistaniCities";
import { apiClient, canServeChauffeur } from "../../../lib/services/api-client";
import { selectContract } from "../../../lib/store/slices/contractSlice";
import OutstationEstimatePanel from "./OutstationEstimatePanel";
import { AlertTriangle, Check, ChevronDown, Clock, MapPin, Plus, Search, Settings2, Truck, X } from "@/app/components/icons";
import { Button, Checkbox, EmptyState, IconButton, Spinner, focusRing, inputBase } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { PoolVehicle, PoolDriver, CompanyVendorLink, VendorVehicle, PoolAvailabilityWindow } from "../../../lib/services/types/multi-mode";

const PACKAGE_API_VALUE: Record<string, string> = {
    '5hr': 'HOURS_5',
    '10hr': 'HOURS_10',
    '24hr': 'HOURS_24',
    'monthly_10hr': 'HOURS_10',
    'monthly_24hr': 'HOURS_24',
};

function toApiPackage(pkg: string): string {
    return PACKAGE_API_VALUE[pkg] || 'HOURS_10';
}

/** One titled block of the form; blocks are separated by hairlines rather than nested cards. */
function CardSection({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2">
                {icon && <span className="text-fg-muted [&_svg]:size-4" aria-hidden="true">{icon}</span>}
                <h3 className="text-sm font-semibold text-fg">{title}</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                {children}
            </div>
        </section>
    );
}

/** Label + control. Wraps in a <label> so non-kit controls (AutocompleteInput) stay associated. */
function Field({
    label,
    children,
    required,
    className,
    group,
}: {
    label: string;
    children: React.ReactNode;
    required?: boolean;
    className?: string;
    /** Render as a grouped block (for fields holding several interactive controls). */
    group?: boolean;
}) {
    const Comp = group ? "div" : "label";
    return (
        <Comp className={cn("flex min-w-0 flex-col gap-1.5", className)} {...(group ? { role: "group", "aria-label": label } : {})}>
            <span className="text-[13px] font-medium leading-none text-fg-secondary">
                {label}
                {required && <span aria-hidden="true" className="ms-0.5 text-danger-ink">*</span>}
            </span>
            {children}
        </Comp>
    );
}

function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={cn(
                inputBase,
                "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60",
                className,
            )}
        />
    );
}

function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div className="relative w-full">
            <select {...props} className={cn(inputBase, "cursor-pointer appearance-none pe-9", className)} />
            <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
            />
        </div>
    );
}

/** Toggle chip for single-choice options (fulfilment mode, vendor target). */
function ChoiceChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                focusRing,
                selected
                    ? "border-fg bg-subtle text-fg"
                    : "border-line bg-card text-fg-secondary hover:border-line-strong hover:text-fg",
            )}
        >
            {selected && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
            {children}
        </button>
    );
}

/** Inline blocking notice (missing vendors / vehicle types). */
function InlineNotice({ children }: { children: React.ReactNode }) {
    return (
        <p className="flex items-start gap-1.5 text-xs text-danger-ink">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </p>
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
    const { company, access } = useCompanyAccess();
    const employees = useAppSelector(selectEmployees);
    const allowedVehicleModels = useAppSelector(selectAllowedVehicleModels);
    const contract = useAppSelector(selectContract);
    const fulfilments = chauffeurFulfilments(access);

    // Legacy store for createBooking action (to be refactored or kept if just an action)

    // Fulfillment type (multi-mode feature) — declared before useEffects to avoid TDZ errors
    const [fulfillmentType, setFulfillmentType] = useState<ChauffeurFulfilment>(fulfilments[0] ?? "CORT_MANAGED");
    const [poolVehicles, setPoolVehicles] = useState<PoolVehicle[]>([]);
    const [poolDrivers, setPoolDrivers] = useState<PoolDriver[]>([]);
    const [poolVehicleId, setPoolVehicleId] = useState<number | null>(null);
    const [poolDriverId, setPoolDriverId] = useState<string | null>(null);
    // Mirrors of the current selection, so the availability fetch can prune a
    // now-reserved choice without re-running every time the user picks one.
    const poolVehicleIdRef = useRef<number | null>(null);
    const poolDriverIdRef = useRef<string | null>(null);
    useEffect(() => {
        poolVehicleIdRef.current = poolVehicleId;
        poolDriverIdRef.current = poolDriverId;
    }, [poolVehicleId, poolDriverId]);

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

        // Prefetch all mode data in parallel so it is ready before the user clicks any option.
        // This also prevents duplicate fetches when switching between fulfillment types.
        setVendorsLoading(true);

        apiClient.getCompanyExternalVendors(companyId)
            .catch(() => ({ data: [] as CompanyVendorLink[] }))
            .then(async (vendorsRes) => {
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
        const labels: Record<ChauffeurFulfilment, string> = {
            CORT_MANAGED: tFulfillment("cortManaged"),
            EXTERNAL_VENDOR: tFulfillment("externalVendor"),
            SELF_MANAGED: tFulfillment("selfManaged"),
        };
        return chauffeurFulfilments(access).map((value) => ({ value, label: labels[value] }));
    }, [access, tFulfillment]);

    const showBroadcastOption = useMemo(() => {
        return (
            availableFulfillmentTypes.some((o) => o.value === "CORT_MANAGED") &&
            availableFulfillmentTypes.some((o) => o.value === "EXTERNAL_VENDOR")
        );
    }, [availableFulfillmentTypes]);

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
    const [poolLoading, setPoolLoading] = useState(false);

    /**
     * The pool pickers must only offer drivers and vehicles that are free for the
     * slot being booked. The window depends on when the ride starts and how long it
     * runs, so the lists are refetched whenever those inputs change. Until a
     * scheduled date is entered the window is "starting now"; the server re-checks
     * the real window on submit, so a stale list cannot create a double booking.
     */
    const availabilityWindow = useMemo<PoolAvailabilityWindow>(() => {
        const base: PoolAvailabilityWindow = {
            package_selected: toApiPackage(packageType),
            no_of_days: noOfDays,
        };
        if (timeType !== "scheduled" || !scheduledDateTime) return base; // "now"
        const d = new Date(scheduledDateTime);
        if (Number.isNaN(d.getTime())) return base;
        return { ...base, scheduled_for: d.toISOString() };
    }, [timeType, scheduledDateTime, packageType, noOfDays]);

    useEffect(() => {
        if (!company?.id) return;
        const companyId = Number(company.id);
        let cancelled = false;

        setPoolLoading(true);
        Promise.all([
            apiClient.getPoolVehicles(companyId, availabilityWindow)
                .catch(() => ({ data: [] as PoolVehicle[] })),
            apiClient.getPoolDrivers(companyId, availabilityWindow)
                .catch(() => ({ data: [] as PoolDriver[] })),
        ]).then(([vehiclesRes, driversRes]) => {
            if (cancelled) return;
            const vehicles = vehiclesRes.data;
            const drivers = driversRes.data;
            setPoolVehicles(vehicles);
            setPoolDrivers(drivers);

            // A resource that just became reserved must not stay selected.
            const selectedVehicle = poolVehicleIdRef.current;
            if (selectedVehicle !== null && !vehicles.some((v) => v.id === selectedVehicle)) {
                setPoolVehicleId(null);
                setVehicleModel("");
            }
            const selectedDriver = poolDriverIdRef.current;
            if (selectedDriver !== null && !drivers.some((d) => d.user_id === selectedDriver)) {
                setPoolDriverId(null);
            }
        }).finally(() => {
            if (!cancelled) setPoolLoading(false);
        });

        return () => { cancelled = true; };
    }, [company?.id, availabilityWindow]);

    /** Pool drivers that can take a chauffeur ride and are free for this window. */
    const availablePoolDrivers = useMemo(
        () => poolDrivers.filter((d) => canServeChauffeur(d.driver_type) && d.users.status === "ACTIVE"),
        [poolDrivers],
    );

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

    // EXTERNAL_VENDOR car types = vehicle models on the vendor's contract (set by Cort), so every
    // booking can be priced on that contract. "All vendors" offers the union of their contracts.
    const vendorContractModels = useMemo(() => {
        const links = vendorMode === "all" ? vendorLinks : vendorLinks.filter((l) => l.id === vendorMode);
        const seen = new Set<string>();
        const models: string[] = [];
        for (const link of links) {
            for (const m of link.chauffeur_contract_models ?? []) {
                if (m && !seen.has(m)) {
                    seen.add(m);
                    models.push(m);
                }
            }
        }
        return models;
    }, [vendorLinks, vendorMode]);

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

    // Helpers (declared before the early return so hook order never changes)
    const transformPackageType = useCallback((pkg: string): string => toApiPackage(pkg), []);

    const transformTripType = useCallback((tripType: string): string => {
        return tripType === 'in_city' ? 'IN_CITY' : 'OUT_STATION';
    }, []);

    if (!access.services.chauffeur) {
        return (
            <EmptyState title={t("chauffeurDisabled")} description={t("chauffeurDisabledHint")} />
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

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

    // No minimum datetime restriction — past dates are allowed for data entry purposes

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col divide-y divide-line">
                {/* Fulfillment Type Selector — always show when SELF_MANAGED (pool driver picker);
                    hide type buttons when only one fulfillment mode is enabled. */}
                {availableFulfillmentTypes.length > 0 && (
                    <section className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0">
                        {availableFulfillmentTypes.length > 1 && (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <Truck className="size-4 text-fg-muted" aria-hidden="true" />
                                    <h3 className="text-sm font-semibold text-fg">{t("fulfillmentType")}</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {availableFulfillmentTypes.map((opt) => (
                                        <ChoiceChip
                                            key={opt.value}
                                            selected={fulfillmentType === opt.value}
                                            onClick={() => {
                                                setFulfillmentType(opt.value);
                                                setVehicleModel("");
                                                setPoolVehicleId(null);
                                                setPoolDriverId(null);
                                                if (opt.value !== "CORT_MANAGED") setBroadcastToAllVendors(false);
                                            }}
                                        >
                                            {opt.label}
                                        </ChoiceChip>
                                    ))}
                                </div>
                            </div>
                        )}
                        {fulfillmentType === "CORT_MANAGED" && showBroadcastOption && (
                            <div className="flex flex-col gap-3 rounded-lg border border-line bg-subtle/40 p-4">
                                <Checkbox
                                    checked={broadcastToAllVendors}
                                    onCheckedChange={(checked) => {
                                        const on = checked === true;
                                        setBroadcastToAllVendors(on);
                                        setVehicleModel("");
                                        if (on) setVendorMode("all");
                                    }}
                                    label={<span className="font-medium">{t("alsoSendToVendors")}</span>}
                                    description={t("broadcastHint")}
                                />
                                {broadcastToAllVendors && (
                                    <>
                                        {vendorsLoading ? (
                                            <div className="flex items-center gap-2 text-xs text-fg-muted">
                                                <Spinner size="xs" label={t("loadingVendors")} />
                                                <span aria-hidden="true">{t("loadingVendors")}</span>
                                            </div>
                                        ) : vendorLinks.length === 0 ? (
                                            <InlineNotice>{t("noActiveVendors")}</InlineNotice>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                <p className="text-xs font-medium text-fg-muted">{t("sendVendorRequestsTo")}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <ChoiceChip
                                                        selected={vendorMode === "all"}
                                                        onClick={() => { setVendorMode("all"); setVehicleModel(""); }}
                                                    >
                                                        {t("allVendorsCount", { count: vendorLinks.length })}
                                                    </ChoiceChip>
                                                    {vendorLinks.map((link) => (
                                                        <ChoiceChip
                                                            key={link.id}
                                                            selected={vendorMode === link.id}
                                                            onClick={() => { setVendorMode(link.id); setVehicleModel(""); }}
                                                        >
                                                            {link.external_vendors?.name ?? t("vendorHash", { id: link.id })}
                                                        </ChoiceChip>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                        {fulfillmentType === "EXTERNAL_VENDOR" && (
                            <div className="flex flex-col gap-2">
                                {vendorsLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-fg-muted">
                                        <Spinner size="xs" label={t("loadingVendors")} />
                                        <span aria-hidden="true">{t("loadingVendors")}</span>
                                    </div>
                                ) : vendorLinks.length === 0 ? (
                                    <InlineNotice>{t("noActiveVendorsExternal")}</InlineNotice>
                                ) : (
                                    <>
                                        <p className="text-xs font-medium text-fg-muted">{t("sendRequestTo")}</p>
                                        <div className="flex flex-wrap gap-2">
                                            <ChoiceChip
                                                selected={vendorMode === "all"}
                                                onClick={() => { setVendorMode("all"); setVehicleModel(""); }}
                                            >
                                                {t("allVendorsCaps", { count: vendorLinks.length })}
                                            </ChoiceChip>
                                            {vendorLinks.map((link) => (
                                                <ChoiceChip
                                                    key={link.id}
                                                    selected={vendorMode === link.id}
                                                    onClick={() => { setVendorMode(link.id); setVehicleModel(""); }}
                                                >
                                                    {link.external_vendors?.name ?? t("vendorHash", { id: link.id })}
                                                </ChoiceChip>
                                            ))}
                                        </div>
                                        <p className="text-xs text-fg-muted">
                                            {vendorMode === "all"
                                                ? t("requestAllVendors")
                                                : t("requestSingleVendor", { name: vendorLinks.find((l) => l.id === vendorMode)?.external_vendors?.name ?? t("selectedVendor") })}
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                        {fulfillmentType === "SELF_MANAGED" && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label={t("poolDriver")} required>
                                    <Select
                                        value={poolDriverId ?? ""}
                                        onChange={(e) => setPoolDriverId(e.target.value || null)}
                                        required
                                        disabled={poolLoading || availablePoolDrivers.length === 0}
                                    >
                                        <option value="">
                                            {poolLoading
                                                ? t("loadingShort")
                                                : availablePoolDrivers.length === 0
                                                    ? t("noAvailablePoolDrivers")
                                                    : t("selectDriverOption")}
                                        </option>
                                        {availablePoolDrivers.map((d) => (
                                            <option key={d.user_id} value={d.user_id}>{d.users.full_name}</option>
                                        ))}
                                    </Select>
                                </Field>
                            </div>
                        )}
                    </section>
                )}

                {/* Service Configuration Section */}
                <CardSection title={t("serviceConfiguration")} icon={<Settings2 />}>
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
                            <p className="text-xs text-fg-muted">{t("passengerOptionalHint")}</p>
                        )}
                    </Field>
                </CardSection>

                {/* Trip Details Section */}
                <CardSection title={t("rideDetails")} icon={<Clock />}>
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
                                disabled={vendorsLoading || vendorContractModels.length === 0}
                            >
                                <option value="">
                                    {vendorsLoading ? t("loadingVendorVehicles") : vendorContractModels.length === 0 ? t("noVendorContractModels") : t("selectVehicleType")}
                                </option>
                                {vendorContractModels.map((model) => (
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
                                disabled={poolLoading || poolVehicles.length === 0}
                            >
                                <option value="">
                                    {poolLoading
                                        ? t("loadingShort")
                                        : poolVehicles.length === 0
                                            ? t("noAvailablePoolVehicles")
                                            : t("selectPoolVehicle")}
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
                            <InlineNotice>{t("noVehiclesWhitelistedWarning")}</InlineNotice>
                        )}
                        {!isEventShuttle && fulfillmentType === "EXTERNAL_VENDOR" && !vendorsLoading && vendorLinks.length > 0 && vendorContractModels.length === 0 && (
                            <InlineNotice>{t("noVendorContractModelsFound")}</InlineNotice>
                        )}
                        {!isEventShuttle && fulfillmentType === "CORT_MANAGED" && broadcastToAllVendors && !vendorsLoading && cortBroadcastCarModels && cortBroadcastCarModels.length === 0 && (
                            <InlineNotice>{t("noOverlapVehicles")}</InlineNotice>
                        )}
                        {!isEventShuttle && fulfillmentType !== "SELF_MANAGED" && vehicleModel === "Other" && (
                            <p className="text-xs text-fg-muted">{t("specialRequestSelected")}</p>
                        )}
                    </Field>

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
                            className="tabular-nums"
                            required
                        />
                    </Field>

                    {tripType === "out_station" && (
                        <div className="sm:col-span-2">
                            <Field label={t("destinationCities")} required group>
                                <div className="flex gap-2">
                                    <AutocompleteInput
                                        value={cityInput}
                                        onChange={(val) => setCityInput(val)}
                                        options={pakistaniCities}
                                        placeholder={t("searchAddCity")}
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        leftIcon={<Plus />}
                                        onClick={handleAddCity}
                                        disabled={!cityInput.trim()}
                                    >
                                        {tCommon("actions.add")}
                                    </Button>
                                </div>
                                {destinationCities.length > 0 && (
                                    <ul className="mt-1 flex flex-wrap gap-2">
                                        {destinationCities.map((city, index) => (
                                            <li
                                                key={index}
                                                className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-subtle pe-0.5 ps-2.5 text-xs font-medium text-fg"
                                            >
                                                <span>{city}</span>
                                                <IconButton
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    tooltip={false}
                                                    label={`${tCommon("actions.delete")} ${city}`}
                                                    onClick={() => handleRemoveCity(index)}
                                                    className="size-6"
                                                >
                                                    <X />
                                                </IconButton>
                                            </li>
                                        ))}
                                    </ul>
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
                <CardSection title={t("logisticsSchedule")} icon={<MapPin />}>
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
                                className="tabular-nums"
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

                    <div className="flex flex-col gap-3 rounded-lg border border-line bg-subtle/40 p-4 sm:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-medium text-fg-secondary">{t("interactivePin")}</span>
                            {pickupLat && pickupLng && (
                                <span className="ltr-content font-mono text-xs tabular-nums text-fg-muted">
                                    {pickupLat.toFixed(4)}, {pickupLng.toFixed(4)}
                                </span>
                            )}
                        </div>

                        {/* Map Search Bar */}
                        <div className="relative z-[50]">
                            <TextInput
                                onChange={(e) => search(e.target.value)}
                                placeholder={t("searchMapPlaceholder")}
                                aria-label={t("searchMapPlaceholder")}
                                className="ps-9 pe-9"
                            />
                            <Search
                                aria-hidden="true"
                                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
                            />
                            {isLoadingSuggestions && (
                                <Spinner size="sm" className="absolute end-3 top-1/2 -translate-y-1/2" />
                            )}

                            {/* Suggestions Dropdown */}
                            {suggestions.length > 0 && (
                                <div className="absolute start-0 top-full z-[60] mt-1 max-h-60 w-full overflow-auto rounded-lg border border-line bg-card py-1 shadow-[var(--shadow-modal)]">
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
                                            className={cn("block w-full px-3 py-2 text-start transition-colors hover:bg-subtle", focusRing)}
                                        >
                                            <span className="block truncate text-sm font-medium text-fg">{suggestion.name}</span>
                                            <span className="mt-0.5 block truncate text-xs text-fg-muted">{suggestion.display_name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="overflow-hidden rounded-lg border border-line bg-page">
                            <Map
                                height="280px"
                                center={pickupLat && pickupLng ? [pickupLat, pickupLng] : undefined}
                                markers={pickupLat && pickupLng ? [{ id: "pickup", position: [pickupLat, pickupLng] as any, label: t("pickupLabel"), color: "#e2622a" }] : []}
                                onMapClick={(lat, lng) => { setPickupLat(lat); setPickupLng(lng); }}
                            />
                        </div>
                        <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                            {t("pinLocationHint")}
                        </p>
                    </div>
                </CardSection>
            </div>

            {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger-ink">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onCancel}>
                    {t("discard")}
                </Button>
                <Button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    loading={isSubmitting}
                    className="sm:min-w-40"
                >
                    {t("confirmBooking")}
                </Button>
            </div>
        </form>
    );
}
