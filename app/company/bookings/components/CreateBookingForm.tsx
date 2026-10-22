"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Clock, MapPin, Search, Settings2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/app/lib/store/hooks";
import { fetchCompanyFeatures, selectCompany, selectCompanyFeatures, selectCompanyFeaturesStatus } from "@/app/lib/store/slices/companySlice";
import { fetchEmployees, selectEmployees } from "@/app/lib/store/slices/employeeSlice";
import { fetchContract, selectAllowedVehicleModels, selectContract } from "@/app/lib/store/slices/contractSlice";
import Map from "@/app/ui/Map";
import { useGooglePlacesAutocomplete } from "@/app/hooks/useGooglePlacesAutocomplete";
import { AutocompleteInput } from "@/app/components/AutocompleteInput";
import { pakistaniCars } from "@/app/lib/data/pakistaniCars";
import { pakistaniCities } from "@/app/lib/data/pakistaniCities";
import { apiClient, canServeChauffeur } from "@/app/lib/services/api-client";
import type { PoolVehicle, PoolDriver, VendorVehicle } from "@/app/lib/services/types/multi-mode";
import { Badge, Button, Card, CardContent, CardHeader, Checkbox, EmptyState, Field, FormGrid, InlineError, Input, Select, Skeleton, Spinner, focusRing, focusRingInset } from "@/app/ui";
import { useCompanyVendors, type CompanyVendorLink } from "../../lib/use-company-vendors";
import OutstationEstimatePanel from "./OutstationEstimatePanel";

type FulfillmentType = "CORT_MANAGED" | "EXTERNAL_VENDOR" | "SELF_MANAGED";
type PackageType = "5hr" | "10hr" | "24hr" | "monthly_10hr" | "monthly_24hr";

const EVENT_SHUTTLE_SEATER_OPTIONS = ["7 Seater", "14 Seater AC", "14 Seater Non-AC", "24 Seater", "32 Seater Non-AC", "48 Seater", "62 Seater AC", "62 Seater Non-AC"];

const PACKAGE_MAP: Record<string, string> = { "5hr": "HOURS_5", "10hr": "HOURS_10", "24hr": "HOURS_24", monthly_10hr: "HOURS_10", monthly_24hr: "HOURS_24" };
const transformPackageType = (pkg: string) => PACKAGE_MAP[pkg] || "HOURS_10";
const transformTripType = (tripType: string) => (tripType === "in_city" ? "IN_CITY" : "OUT_STATION");
const EMPTY_VEHICLE_MAP: Record<number, VendorVehicle[]> = {};

/** Pill-style single-choice group (fulfilment type, vendor target). */
function ChoiceGroup<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-8 cursor-pointer rounded-lg border px-3 text-xs font-medium transition-colors",
              active ? "border-brand bg-brand text-white" : "border-line bg-card text-fg hover:border-brand-line hover:bg-subtle",
              focusRing,
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

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
  const featuresLoading = featuresStatus === "idle" || featuresStatus === "loading";
  const vendors = useCompanyVendors();

  // Fulfillment type (multi-mode feature)
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("CORT_MANAGED");
  const [poolVehicles, setPoolVehicles] = useState<PoolVehicle[]>([]);
  const [poolDrivers, setPoolDrivers] = useState<PoolDriver[]>([]);
  const [poolVehicleId, setPoolVehicleId] = useState<number | null>(null);
  const [poolDriverId, setPoolDriverId] = useState<string | null>(null);

  // Vendor state for EXTERNAL_VENDOR fulfillment
  const [vendorVehicles, setVendorVehicles] = useState<{ key: string; map: Record<number, VendorVehicle[]> }>({ key: "", map: {} });
  const [vendorMode, setVendorMode] = useState<"all" | number>("all"); // "all" or specific link id
  /** CORT_MANAGED + external feature: also fan out to vendors (first assignment wins). */
  const [broadcastToAllVendors, setBroadcastToAllVendors] = useState(false);

  const vendorLinks = useMemo(() => vendors.links.filter((l) => l.serves_chauffeur && l.is_active), [vendors.links]);
  const vendorLinksKey = vendorLinks.map((l) => l.id).join(",");
  const vendorVehicleMap = vendorLinksKey && vendorVehicles.key === vendorLinksKey ? vendorVehicles.map : EMPTY_VEHICLE_MAP;
  const vendorVehiclesLoading = vendorLinksKey !== "" && vendorVehicles.key !== vendorLinksKey;
  const vendorsLoading = vendors.loading || vendorVehiclesLoading;

  useEffect(() => {
    if (!company?.id) return;
    const companyId = Number(company.id);

    dispatch(fetchEmployees(company.id.toString()));
    dispatch(fetchContract());
    dispatch(fetchCompanyFeatures(companyId));

    // Prefetch pool data so it is ready before the user clicks any option.
    Promise.all([
      apiClient.getPoolVehicles(companyId).catch(() => ({ data: [] as PoolVehicle[] })),
      apiClient.getPoolDrivers(companyId).catch(() => ({ data: [] as PoolDriver[] })),
    ]).then(([poolVehiclesRes, poolDriversRes]) => {
      setPoolVehicles(poolVehiclesRes.data);
      setPoolDrivers(poolDriversRes.data);
    });
  }, [dispatch, company?.id]);

  // Fetch vehicles for every chauffeur vendor link in parallel (links come from the shared vendors hook).
  useEffect(() => {
    if (vendors.loading || vendorLinks.length === 0) return;
    let cancelled = false;
    const key = vendorLinksKey;
    const vehicleMap: Record<number, VendorVehicle[]> = {};
    Promise.all(
      vendorLinks.map(async (link: CompanyVendorLink) => {
        try {
          const vr = await apiClient.getVendorVehicles(link.id);
          vehicleMap[link.id] = vr.data;
        } catch {
          vehicleMap[link.id] = [];
        }
      }),
    ).finally(() => {
      if (!cancelled) setVendorVehicles({ key, map: vehicleMap });
    });
    return () => {
      cancelled = true;
    };
  }, [vendors.loading, vendorLinks, vendorLinksKey]);

  const availableFulfillmentTypes = useMemo(() => {
    const opts: { value: FulfillmentType; label: string }[] = [];
    if (features.find((f) => f.feature_key === "chauffeur_cort_managed")?.is_enabled) opts.push({ value: "CORT_MANAGED", label: tFulfillment("cortManaged") });
    if (features.find((f) => f.feature_key === "chauffeur_external_vendor")?.is_enabled) opts.push({ value: "EXTERNAL_VENDOR", label: tFulfillment("externalVendor") });
    if (features.find((f) => f.feature_key === "chauffeur_self_managed")?.is_enabled) opts.push({ value: "SELF_MANAGED", label: tFulfillment("selfManaged") });
    return opts;
  }, [features, tFulfillment]);

  const showBroadcastOption = useMemo(
    () => availableFulfillmentTypes.some((o) => o.value === "CORT_MANAGED") && availableFulfillmentTypes.some((o) => o.value === "EXTERNAL_VENDOR"),
    [availableFulfillmentTypes],
  );

  // Auto-select the first available fulfillment type once features load (render-time state adjustment).
  if (!featuresLoading && availableFulfillmentTypes.length > 0 && !availableFulfillmentTypes.find((o) => o.value === fulfillmentType)) {
    setFulfillmentType(availableFulfillmentTypes[0].value);
  }

  const [serviceCategory, setServiceCategory] = useState<string>("Chauffeur Ride");
  const [passengerId, setPassengerId] = useState<string>("");
  const [vehicleModel, setVehicleModel] = useState<string>("");
  const [customVehicleModel, setCustomVehicleModel] = useState<string>("");
  const [packageType, setPackageType] = useState<PackageType>("10hr");
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

  const isEventShuttle = serviceCategory === "Event Shuttle";

  // Google Places autocomplete for the pickup pin
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { suggestions, isLoading: isLoadingSuggestions, search, clearSuggestions, refreshToken } = useGooglePlacesAutocomplete({ apiKey: googleMapsKey });

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "ACTIVE"), [employees]);

  // Unique vehicle models from vendor vehicles (filtered by selected vendor for EXTERNAL_VENDOR)
  const vendorCarModels = useMemo(() => {
    const vehicles: VendorVehicle[] = vendorMode === "all" ? Object.values(vendorVehicleMap).flat() : (vendorVehicleMap[vendorMode] ?? []);
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
    for (const m of [...allowedVehicleModels, ...vendorCarModels]) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return contract.chauffeur_contract_rates.find((r: any) => r.vehicle_model === vehicleModel) ?? null;
  }, [contract, vehicleModel]);

  const outstationAllowancePerDay = useMemo(() => Number(contract?.allowance_outstation ?? 0), [contract]);
  const accommodationAllowancePerNight = useMemo(() => Number(contract?.allowance_accommodation ?? 0), [contract]);

  const canSubmit = useMemo(() => {
    const vehicleModelValid = isEventShuttle ? vehicleModel.length > 0 : vehicleModel === "Other" ? customVehicleModel.length > 0 : vehicleModel.length > 0;
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
  const handleRemoveCity = (index: number) => setDestinationCities(destinationCities.filter((_, i) => i !== index));

  // All hooks are above this line; the early returns below are safe.
  if (!company) {
    return <EmptyState title={tCommon("errors.noCompanySelected")} />;
  }

  if (!company.services_enabled.chauffeur_enabled) {
    return <EmptyState title={t("chauffeurDisabled")} description={t("chauffeurDisabledHint")} />;
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
      setError(!pickupLat || !pickupLng ? t("selectMapLocation") : tCommon("validation.fillRequiredFields"));
      setIsSubmitting(false);
      return;
    }

    const passenger = employees.find((emp) => emp.id === passengerId);
    if (!passenger && !isEventShuttle) {
      setError(t("passengerNotFound"));
      setIsSubmitting(false);
      return;
    }

    const scheduledAt = timeType === "now" ? new Date().toISOString() : new Date(scheduledDateTime).toISOString();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiData: any = {
        booking_type: packageType.includes("monthly") ? "MONTHLY" : "SPOT",
        vehicle_model: vehicleModel === "Other" ? customVehicleModel : vehicleModel,
        is_special_request: vehicleModel === "Other",
        package_selected: transformPackageType(packageType),
        trip_type: transformTripType(tripType),
        pickup_location: { latitude: pickupLat!, longitude: pickupLng! },
        pickup_address: pickupAddress,
        scheduled_for: scheduledAt,
        destination_cities: tripType === "out_station" ? destinationCities : [],
        service_category: serviceCategory,
        city: bookingCity,
        no_of_days: noOfDays,
      };

      // For Chauffeur Ride, passenger is required; for Event Shuttle it's optional (group booking)
      if (passengerId) apiData.passenger_id = passengerId;

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
        if (vendorMode !== "all") apiData.vendor_link_ids = [vendorMode];
      }

      await apiClient.createChauffeurBooking(Number(company.id), apiData);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const vendorOptions = [
    { value: "all" as const, label: t("allVendorsCount", { count: vendorLinks.length }) },
    ...vendorLinks.map((link) => ({ value: link.id, label: link.external_vendors?.name ?? t("vendorHash", { id: link.id }) })),
  ];
  const chooseVendor = (v: "all" | number) => {
    setVendorMode(v);
    setVehicleModel("");
  };

  const vehicleModelField = (() => {
    if (isEventShuttle) {
      return (
        <Select value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} required placeholder={t("selectType")}>
          {EVENT_SHUTTLE_SEATER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      );
    }
    if (fulfillmentType === "EXTERNAL_VENDOR") {
      return (
        <Select
          value={vehicleModel}
          onChange={(e) => setVehicleModel(e.target.value)}
          required
          disabled={vendorsLoading || vendorCarModels.length === 0}
          placeholder={vendorsLoading ? t("loadingVendorVehicles") : vendorCarModels.length === 0 ? t("noVendorVehicles") : t("selectVehicleType")}
        >
          {vendorCarModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
          <option value="Other">{t("otherSpecialRequest")}</option>
        </Select>
      );
    }
    if (fulfillmentType === "CORT_MANAGED" && broadcastToAllVendors && cortBroadcastCarModels) {
      return (
        <Select
          value={vehicleModel}
          onChange={(e) => setVehicleModel(e.target.value)}
          required
          disabled={vendorsLoading || cortBroadcastCarModels.length === 0}
          placeholder={vendorsLoading ? t("loadingShort") : cortBroadcastCarModels.length === 0 ? t("noMatchingVehicleTypes") : t("selectVehicleTypeContractVendor")}
        >
          {cortBroadcastCarModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
          <option value="Other">{t("otherSpecialRequest")}</option>
        </Select>
      );
    }
    if (fulfillmentType === "SELF_MANAGED") {
      return (
        <Select
          value={poolVehicleId !== null ? String(poolVehicleId) : ""}
          onChange={(e) => {
            const vid = Number(e.target.value) || null;
            setPoolVehicleId(vid);
            const v = vid ? poolVehicles.find((pv) => pv.id === vid) : undefined;
            setVehicleModel(v ? `${v.make} ${v.model}` : "");
          }}
          required
          disabled={poolVehicles.length === 0}
          placeholder={poolVehicles.length === 0 ? t("noPoolVehicles") : t("selectPoolVehicle")}
        >
          {poolVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate_number} — {v.make} {v.model}
            </option>
          ))}
        </Select>
      );
    }
    return (
      <Select
        value={vehicleModel}
        onChange={(e) => setVehicleModel(e.target.value)}
        required
        disabled={allowedVehicleModels.length === 0}
        placeholder={allowedVehicleModels.length === 0 ? t("noVehiclesWhitelisted") : t("selectVehicle")}
      >
        {allowedVehicleModels.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
        <option value="Other">{t("otherSpecialRequest")}</option>
      </Select>
    );
  })();

  const vehicleModelError =
    !isEventShuttle && fulfillmentType === "CORT_MANAGED" && !broadcastToAllVendors && allowedVehicleModels.length === 0
      ? t("noVehiclesWhitelistedWarning")
      : !isEventShuttle && fulfillmentType === "EXTERNAL_VENDOR" && !vendorsLoading && vendorCarModels.length === 0
        ? t("noVendorVehiclesFound")
        : !isEventShuttle && fulfillmentType === "CORT_MANAGED" && broadcastToAllVendors && !vendorsLoading && cortBroadcastCarModels && cortBroadcastCarModels.length === 0
          ? t("noOverlapVehicles")
          : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Fulfillment type: hidden when only one mode is enabled, unless it needs extra pickers. */}
      {featuresLoading ? (
        <Card padding="md" className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
        </Card>
      ) : (
        availableFulfillmentTypes.length > 0 && (
          <Card padding="md" className="space-y-4 border-brand-line bg-brand-soft/40">
            {availableFulfillmentTypes.length > 1 && (
              <Field label={t("fulfillmentType")}>
                <ChoiceGroup
                  label={t("fulfillmentType")}
                  value={fulfillmentType}
                  options={availableFulfillmentTypes}
                  onChange={(v) => {
                    setFulfillmentType(v);
                    setVehicleModel("");
                    setPoolVehicleId(null);
                    setPoolDriverId(null);
                    if (v !== "CORT_MANAGED") setBroadcastToAllVendors(false);
                  }}
                />
              </Field>
            )}

            {fulfillmentType === "CORT_MANAGED" && showBroadcastOption && (
              <div className="space-y-3 border-t border-brand-line pt-4">
                <Checkbox
                  checked={broadcastToAllVendors}
                  onCheckedChange={(c) => {
                    const on = c === true;
                    setBroadcastToAllVendors(on);
                    setVehicleModel("");
                    if (on) setVendorMode("all");
                  }}
                  label={t("alsoSendToVendors")}
                  description={t("broadcastHint")}
                />
                {broadcastToAllVendors &&
                  (vendorsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-fg-muted">
                      <Spinner size="xs" /> {t("loadingVendors")}
                    </div>
                  ) : vendorLinks.length === 0 ? (
                    <InlineError>{t("noActiveVendors")}</InlineError>
                  ) : (
                    <Field label={t("sendVendorRequestsTo")}>
                      <ChoiceGroup label={t("sendVendorRequestsTo")} value={vendorMode} options={vendorOptions} onChange={chooseVendor} />
                    </Field>
                  ))}
              </div>
            )}

            {fulfillmentType === "EXTERNAL_VENDOR" &&
              (vendorsLoading ? (
                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  <Spinner size="xs" /> {t("loadingVendors")}
                </div>
              ) : vendorLinks.length === 0 ? (
                <InlineError>{t("noActiveVendorsExternal")}</InlineError>
              ) : (
                <Field
                  label={t("sendRequestTo")}
                  hint={
                    vendorMode === "all"
                      ? t("requestAllVendors")
                      : t("requestSingleVendor", { name: vendorLinks.find((l) => l.id === vendorMode)?.external_vendors?.name ?? t("selectedVendor") })
                  }
                >
                  <ChoiceGroup label={t("sendRequestTo")} value={vendorMode} options={vendorOptions} onChange={chooseVendor} />
                </Field>
              ))}

            {fulfillmentType === "SELF_MANAGED" && (
              <Field label={t("poolDriver")} required>
                <Select value={poolDriverId ?? ""} onChange={(e) => setPoolDriverId(e.target.value || null)} required placeholder={t("selectDriverOption")}>
                  {poolDrivers
                    .filter((d) => canServeChauffeur(d.driver_type) && d.users.status === "ACTIVE")
                    .map((d) => (
                      <option key={d.user_id} value={d.user_id}>
                        {d.users.full_name}
                      </option>
                    ))}
                </Select>
              </Field>
            )}
          </Card>
        )
      )}

      {/* Service configuration */}
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Settings2 className="size-4 text-brand-ink" aria-hidden="true" />{t("serviceConfiguration")}</span>} />
        <CardContent>
          <FormGrid cols={2}>
            <Field label={t("serviceType")} required>
              <Select value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)} required>
                <option value="Chauffeur Ride">{t("chauffeurRide")}</option>
                <option value="Event Shuttle">{t("eventShuttle")}</option>
              </Select>
            </Field>
            <Field label={t("city")} required>
              <AutocompleteInput value={bookingCity} onChange={setBookingCity} options={pakistaniCities} placeholder={t("cityPlaceholder")} required />
            </Field>
            <Field label={t("passenger")} required={!isEventShuttle} className="sm:col-span-2" hint={isEventShuttle ? t("passengerOptionalHint") : undefined}>
              <Select value={passengerId} onChange={(e) => setPassengerId(e.target.value)} required={!isEventShuttle} placeholder={isEventShuttle ? t("groupBookingNone") : t("selectEmployee")}>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} {emp.employee_id ? `(${emp.employee_id})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </FormGrid>
        </CardContent>
      </Card>

      {/* Ride details */}
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Clock className="size-4 text-brand-ink" aria-hidden="true" />{t("rideDetails")}</span>} />
        <CardContent>
          <FormGrid cols={2}>
            <Field label={isEventShuttle ? t("seaterType") : t("carType")} required error={vehicleModelError} hint={!isEventShuttle && fulfillmentType !== "SELF_MANAGED" && vehicleModel === "Other" ? t("specialRequestSelected") : undefined}>
              {vehicleModelField}
            </Field>

            {!isEventShuttle && fulfillmentType !== "SELF_MANAGED" && vehicleModel === "Other" && (
              <Field label={t("specifyVehicle")} required>
                <AutocompleteInput value={customVehicleModel} onChange={setCustomVehicleModel} options={pakistaniCars} placeholder={t("vehiclePlaceholder")} required />
              </Field>
            )}

            <Field label={t("usagePackage")} required>
              <Select value={packageType} onChange={(e) => setPackageType(e.target.value as PackageType)} required>
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
              <Select value={tripType} onChange={(e) => setTripType(e.target.value as "in_city" | "out_station")} required>
                <option value="in_city">{t("inCity")}</option>
                <option value="out_station">{t("outStation")}</option>
              </Select>
            </Field>

            <Field label={t("numberOfDays")} required>
              <Input type="number" min={1} value={noOfDays} onChange={(e) => setNoOfDays(parseInt(e.target.value) || 1)} required />
            </Field>

            {tripType === "out_station" && (
              <div className="space-y-3 sm:col-span-2">
                <Field label={t("destinationCities")} required>
                  <div className="flex gap-2">
                    <AutocompleteInput value={cityInput} onChange={setCityInput} options={pakistaniCities} placeholder={t("searchAddCity")} className="flex-1" />
                    <Button type="button" variant="outline" onClick={handleAddCity} disabled={!cityInput.trim()}>
                      {tCommon("actions.add")}
                    </Button>
                  </div>
                </Field>
                {destinationCities.length > 0 && (
                  <ul className="flex flex-wrap gap-2" aria-label={t("destinationCities")}>
                    {destinationCities.map((city, index) => (
                      <li key={`${city}-${index}`}>
                        <Badge tone="neutral">
                          {city}
                          <button
                            type="button"
                            onClick={() => handleRemoveCity(index)}
                            aria-label={`${tCommon("actions.delete")} ${city}`}
                            className={cn("ms-0.5 cursor-pointer rounded-full p-0.5 text-fg-muted hover:bg-danger-soft hover:text-danger-ink", focusRing)}
                          >
                            <X className="size-3" aria-hidden="true" />
                          </button>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <OutstationEstimatePanel
                  originCity={bookingCity}
                  destinationCities={destinationCities}
                  noOfDays={noOfDays}
                  packageType={packageType}
                  contractRate={selectedContractRate}
                  outstationAllowancePerDay={outstationAllowancePerDay}
                  accommodationAllowancePerNight={accommodationAllowancePerNight}
                />
              </div>
            )}
          </FormGrid>
        </CardContent>
      </Card>

      {/* Logistics */}
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><MapPin className="size-4 text-brand-ink" aria-hidden="true" />{t("logisticsSchedule")}</span>} />
        <CardContent className="space-y-4">
          <FormGrid cols={2}>
            <Field label={t("pickupTime")} required>
              <Select value={timeType} onChange={(e) => setTimeType(e.target.value as "now" | "scheduled")} required>
                <option value="now">{t("nowQuickDispatch")}</option>
                <option value="scheduled">{t("scheduledLater")}</option>
              </Select>
            </Field>
            {timeType === "scheduled" && (
              <Field label={t("scheduledAt")} required>
                <Input type="datetime-local" value={scheduledDateTime} onChange={(e) => setScheduledDateTime(e.target.value)} required />
              </Field>
            )}
            <Field label={t("exactAddress")} required className="sm:col-span-2">
              <Input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder={t("addressPlaceholder")} required />
            </Field>
          </FormGrid>

          <div className="space-y-3 rounded-xl border border-line bg-subtle p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{t("interactivePin")}</span>
              {pickupLat !== undefined && pickupLng !== undefined && (
                <Badge tone="brand" size="sm" className="font-mono">
                  {pickupLat.toFixed(4)}, {pickupLng.toFixed(4)}
                </Badge>
              )}
            </div>

            <div className="relative z-20">
              <Input
                onChange={(e) => search(e.target.value)}
                placeholder={t("searchMapPlaceholder")}
                aria-label={t("searchMapPlaceholder")}
                leftIcon={<Search aria-hidden="true" />}
                rightIcon={isLoadingSuggestions ? <Spinner size="xs" /> : undefined}
                autoComplete="off"
              />
              {suggestions.length > 0 && (
                <ul role="listbox" className="absolute start-0 top-full z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-line bg-elevated py-1 shadow-[var(--shadow-modal)]">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.place_id} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={() => {
                          setPickupLat(suggestion.lat);
                          setPickupLng(suggestion.lng);
                          setPickupAddress(suggestion.display_name);
                          clearSuggestions();
                          refreshToken();
                        }}
                        className={cn("w-full cursor-pointer px-3 py-2 text-start hover:bg-subtle", focusRingInset)}
                      >
                        <div className="text-sm font-medium text-fg">{suggestion.name}</div>
                        <div className="truncate text-xs text-fg-muted">{suggestion.display_name}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-line">
              <Map
                height="280px"
                center={pickupLat !== undefined && pickupLng !== undefined ? [pickupLat, pickupLng] : undefined}
                markers={pickupLat !== undefined && pickupLng !== undefined ? [{ id: "pickup", position: [pickupLat, pickupLng] as [number, number], label: t("pickupLabel"), color: "#fe8503" }] : []}
                onMapClick={(lat, lng) => {
                  setPickupLat(lat);
                  setPickupLng(lng);
                }}
              />
            </div>
            <p className="text-xs text-fg-muted">{t("pinLocationHint")}</p>
          </div>
        </CardContent>
      </Card>

      {error && <InlineError>{error}</InlineError>}

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("discard")}
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={!canSubmit || isSubmitting}>
          {t("confirmBooking")}
        </Button>
      </div>
    </form>
  );
}
