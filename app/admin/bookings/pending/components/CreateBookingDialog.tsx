"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "../../../../lib/services/api-client";
import Map from "../../../ui/Map";
import StopAddressSearch from "../../../ui/StopAddressSearch";
import { Button, Checkbox, Dialog, DialogContent, Field, FormGrid, Input, InlineError, LoadingBlock, Select } from "../../../ui";
import { errorMessage } from "./booking-status";
import type { CompanyOption } from "../hooks/usePendingBookings";

type Fulfillment = "CORT_MANAGED" | "EXTERNAL_VENDOR" | "SELF_MANAGED";

type Options = {
  company: { id: number; name: string; is_chauffeur_enabled: boolean };
  features: string[];
  allowed_vehicle_models: string[];
  employees: { id: string; full_name: string; email: string }[];
  pool_vehicles: { id: number; plate_number: string; make: string; model: string }[];
  pool_drivers: { id: string; full_name?: string; phone?: string }[];
  vendor_links: { id: number; name?: string }[];
};

const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  CORT_MANAGED: "Cort managed",
  EXTERNAL_VENDOR: "External vendor",
  SELF_MANAGED: "Self managed (company pool)",
};

const FEATURE_FOR: Record<Fulfillment, string> = {
  CORT_MANAGED: "chauffeur_cort_managed",
  EXTERNAL_VENDOR: "chauffeur_external_vendor",
  SELF_MANAGED: "chauffeur_self_managed",
};

interface Props {
  open: boolean;
  companies: CompanyOption[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateBookingDialog({ open, companies, onClose, onCreated }: Props) {
  const [companyId, setCompanyId] = useState("");
  const [loadedOptions, setOptions] = useState<Options | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const requestRef = useRef(0);
  const options = companyId ? loadedOptions : null;

  const [fulfillment, setFulfillment] = useState<Fulfillment>("CORT_MANAGED");
  const [broadcast, setBroadcast] = useState(false);
  const [vendorLinkId, setVendorLinkId] = useState("");
  const [poolVehicleId, setPoolVehicleId] = useState("");
  const [poolDriverId, setPoolDriverId] = useState("");
  const [serviceCategory, setServiceCategory] = useState("Chauffeur Ride");
  const [passengerId, setPassengerId] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [bookingType, setBookingType] = useState("SPOT");
  const [packageSelected, setPackageSelected] = useState("HOURS_10");
  const [tripType, setTripType] = useState("IN_CITY");
  const [city, setCity] = useState("");
  const [destinationCities, setDestinationCities] = useState("");
  const [noOfDays, setNoOfDays] = useState("1");
  const [scheduledFor, setScheduledFor] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [pickup, setPickup] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the chosen company's form options (stale responses are ignored)
  function selectCompany(id: string) {
    setCompanyId(id);
    const token = ++requestRef.current;
    if (!id) return;
    setOptionsLoading(true);
    setOptionsError(null);
    apiClient
      .getAdminBookingOptions(Number(id))
      .then((res) => {
        if (token !== requestRef.current) return;
        const data = (res?.data ?? res) as Options;
        setOptions(data);
        setFulfillment(
          (["CORT_MANAGED", "EXTERNAL_VENDOR", "SELF_MANAGED"] as Fulfillment[]).find((f) => data.features.includes(FEATURE_FOR[f])) ??
            "CORT_MANAGED",
        );
        setBroadcast(false);
        setVendorLinkId("");
        setPoolVehicleId("");
        setPoolDriverId("");
        setPassengerId("");
        setVehicleModel("");
      })
      .catch((err) => token === requestRef.current && setOptionsError(errorMessage(err, "Failed to load company options")))
      .finally(() => token === requestRef.current && setOptionsLoading(false));
  }

  const fulfillmentChoices = useMemo<Fulfillment[]>(() => {
    if (!options) return [];
    const enabled = (Object.keys(FEATURE_FOR) as Fulfillment[]).filter((f) => options.features.includes(FEATURE_FOR[f]));
    return enabled.length ? enabled : ["CORT_MANAGED"];
  }, [options]);

  const canBroadcast =
    fulfillment === "CORT_MANAGED" &&
    !!options &&
    options.features.includes("chauffeur_cort_managed") &&
    options.features.includes("chauffeur_external_vendor");

  const isOutstation = tripType === "OUT_STATION";
  const destinations = destinationCities.split(",").map((c) => c.trim()).filter(Boolean);

  const missing = (() => {
    if (!options) return "Select a company";
    if (!options.company.is_chauffeur_enabled) return "Chauffeur service is disabled for this company";
    if (!vehicleModel.trim()) return "Vehicle model is required";
    if (!scheduledFor) return "Pickup date & time is required";
    if (!pickup) return "Choose a pickup location";
    if (isOutstation && destinations.length === 0) return "Add at least one destination city";
    if (fulfillment === "SELF_MANAGED" && (!poolVehicleId || !poolDriverId)) return "Select a pool vehicle and driver";
    return null;
  })();

  async function handleSubmit() {
    if (missing || !options || !pickup) return;
    setSubmitting(true);
    setError(null);
    const payload: Record<string, unknown> = {
      booking_type: bookingType,
      vehicle_model: vehicleModel.trim(),
      is_special_request: options.allowed_vehicle_models.length > 0 && !options.allowed_vehicle_models.includes(vehicleModel.trim()),
      package_selected: packageSelected,
      trip_type: tripType,
      pickup_location: { latitude: pickup.lat, longitude: pickup.lng },
      pickup_address: pickup.address,
      scheduled_for: new Date(scheduledFor).toISOString(),
      destination_cities: isOutstation ? destinations : [],
      service_category: serviceCategory,
      city: city.trim() || undefined,
      no_of_days: Math.max(1, Number(noOfDays) || 1),
      fulfillment_type: fulfillment,
    };
    if (passengerId) payload.passenger_id = passengerId;
    if (costCenter.trim()) payload.internal_cost_center_code = costCenter.trim();
    if (fulfillment === "SELF_MANAGED") {
      payload.vehicle_id = Number(poolVehicleId);
      payload.driver_id = poolDriverId;
    }
    if (fulfillment === "EXTERNAL_VENDOR" && vendorLinkId) payload.vendor_link_ids = [Number(vendorLinkId)];
    if (fulfillment === "CORT_MANAGED" && broadcast) {
      payload.broadcast_to_all_vendors = true;
      if (vendorLinkId) payload.vendor_link_ids = [Number(vendorLinkId)];
    }
    try {
      await apiClient.adminCreateChauffeurBooking(options.company.id, payload as never);
      toast.success(`Booking created for ${options.company.name}`);
      onCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Failed to create booking"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent
        size="lg"
        title="Create booking"
        description="Book a chauffeur on behalf of any company."
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={!!missing}>
              Create booking
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Company" required>
            <Select value={companyId} onChange={(e) => selectCompany(e.target.value)} placeholder="Select a company">
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          {optionsLoading && <LoadingBlock />}
          {optionsError && <InlineError>{optionsError}</InlineError>}

          {options && !optionsLoading && (
            <>
              {!options.company.is_chauffeur_enabled && <InlineError>Chauffeur service is disabled for this company.</InlineError>}

              <FormGrid cols={2}>
                {fulfillmentChoices.length > 1 && (
                  <Field label="Fulfillment" required>
                    <Select
                      value={fulfillment}
                      onChange={(e) => {
                        setFulfillment(e.target.value as Fulfillment);
                        setBroadcast(false);
                        setVendorLinkId("");
                      }}
                    >
                      {fulfillmentChoices.map((f) => (
                        <option key={f} value={f}>
                          {FULFILLMENT_LABELS[f]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="Service">
                  <Select value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)}>
                    <option value="Chauffeur Ride">Chauffeur ride</option>
                    <option value="Event Shuttle">Event shuttle</option>
                  </Select>
                </Field>

                {fulfillment === "SELF_MANAGED" && (
                  <>
                    <Field label="Pool vehicle" required>
                      <Select
                        value={poolVehicleId}
                        onChange={(e) => {
                          setPoolVehicleId(e.target.value);
                          const v = options.pool_vehicles.find((x) => String(x.id) === e.target.value);
                          if (v) setVehicleModel(`${v.make} ${v.model}`);
                        }}
                        placeholder="Select vehicle"
                      >
                        {options.pool_vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.make} {v.model} · {v.plate_number}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Pool driver" required>
                      <Select value={poolDriverId} onChange={(e) => setPoolDriverId(e.target.value)} placeholder="Select driver">
                        {options.pool_drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name ?? d.id}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </>
                )}

                {(fulfillment === "EXTERNAL_VENDOR" || (canBroadcast && broadcast)) && (
                  <Field label="Vendor" hint="Leave empty to send to all linked vendors.">
                    <Select value={vendorLinkId} onChange={(e) => setVendorLinkId(e.target.value)} placeholder="All vendors">
                      {options.vendor_links.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name ?? `Vendor #${l.id}`}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                <Field label="Passenger" hint="Optional. Leave empty for a group booking.">
                  <Select value={passengerId} onChange={(e) => setPassengerId(e.target.value)} placeholder="No passenger">
                    {options.employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} · {e.email}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Vehicle model" required hint={options.allowed_vehicle_models.length ? "Contract models are suggested; anything else is a special request." : undefined}>
                  <Input
                    list="admin-booking-models"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    readOnly={fulfillment === "SELF_MANAGED" && !!poolVehicleId}
                  />
                  <datalist id="admin-booking-models">
                    {options.allowed_vehicle_models.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </Field>

                <Field label="Booking type" required>
                  <Select value={bookingType} onChange={(e) => setBookingType(e.target.value)}>
                    <option value="SPOT">Spot</option>
                    <option value="MONTHLY">Monthly</option>
                  </Select>
                </Field>
                <Field label="Package" required>
                  <Select value={packageSelected} onChange={(e) => setPackageSelected(e.target.value)}>
                    <option value="HOURS_5">5 hours</option>
                    <option value="HOURS_10">10 hours</option>
                    <option value="HOURS_24">24 hours</option>
                  </Select>
                </Field>

                <Field label="Trip type" required>
                  <Select value={tripType} onChange={(e) => setTripType(e.target.value)}>
                    <option value="IN_CITY">In city</option>
                    <option value="OUT_STATION">Out station</option>
                  </Select>
                </Field>
                <Field label="City">
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </Field>

                {isOutstation && (
                  <Field label="Destination cities" required hint="Comma separated.">
                    <Input value={destinationCities} onChange={(e) => setDestinationCities(e.target.value)} />
                  </Field>
                )}
                <Field label="Number of days">
                  <Input type="number" min={1} value={noOfDays} onChange={(e) => setNoOfDays(e.target.value)} />
                </Field>

                <Field label="Pickup date & time" required>
                  <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
                </Field>
                <Field label="Cost center code">
                  <Input value={costCenter} onChange={(e) => setCostCenter(e.target.value)} />
                </Field>
              </FormGrid>

              {canBroadcast && (
                <Checkbox
                  checked={broadcast}
                  onCheckedChange={(v) => setBroadcast(v === true)}
                  label="Also broadcast to vendors"
                  description="Cort ops and vendors race to assign this booking."
                />
              )}

              <Field label="Pickup location" required hint={pickup ? pickup.address : "Search an address or click the map."}>
                <StopAddressSearch
                  aria-label="Search pickup address"
                  placeholder="Search pickup address"
                  onSelect={(s) => setPickup({ lat: s.lat, lng: s.lng, address: s.fullAddress })}
                />
              </Field>
              <div className="overflow-hidden rounded-lg border border-line">
                <Map
                  height="240px"
                  center={pickup ? [pickup.lat, pickup.lng] : undefined}
                  markers={pickup ? [{ id: "pickup", position: [pickup.lat, pickup.lng], label: "Pickup" }] : []}
                  onMapClick={(lat, lng) => setPickup((p) => ({ lat, lng, address: p?.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}` }))}
                />
              </div>

              {error && <InlineError>{error}</InlineError>}
              {missing && !error && <p className="text-xs text-fg-muted">{missing}</p>}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
