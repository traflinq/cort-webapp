"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { TravelPlaceField } from "./TravelPlaceField";
import {
  CardSection,
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  Select,
  TextInput,
  money,
} from "./travel-ui";

type TripDirection = "ONE_WAY" | "ROUND_TRIP";
type Traveler = {
  first_name: string;
  last_name: string;
  email: string;
  passport_number: string;
  cnic_number: string;
  phone: string;
  nationality: string;
};

const emptyTraveler: Traveler = {
  first_name: "",
  last_name: "",
  email: "",
  passport_number: "",
  cnic_number: "",
  phone: "",
  nationality: "",
};

function travelerComplete(traveler: Traveler) {
  return Boolean(
    traveler.first_name.trim() && traveler.last_name.trim() && traveler.email.includes("@"),
  );
}

export default function NewTravelBookingForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const t = useTranslations("company.travel");
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [scope, setScope] = useState("DOMESTIC");
  const [transportType, setTransportType] = useState("BUS");
  const [tripDirection, setTripDirection] = useState<TripDirection>("ONE_WAY");
  const [bags, setBags] = useState("1");
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [offerId, setOfferId] = useState("");
  const [packageFilter, setPackageFilter] = useState("ALL");
  const [wantFirst, setWantFirst] = useState(false);
  const [wantLast, setWantLast] = useState(false);
  const [firstType, setFirstType] = useState<"RIDE_HAIL" | "AIRPORT_TRANSFER">("RIDE_HAIL");
  const [lastType, setLastType] = useState<"RIDE_HAIL" | "AIRPORT_TRANSFER" | "RENTAL">("RIDE_HAIL");
  const [firstMileVehicleId, setFirstMileVehicleId] = useState<number | null>(null);
  const [lastMileVehicleId, setLastMileVehicleId] = useState<number | null>(null);
  const [firstProvider, setFirstProvider] = useState("BYKEA");
  const [lastProvider, setLastProvider] = useState("BYKEA");
  const [firstVendorLinkId, setFirstVendorLinkId] = useState<number | null>(null);
  const [lastVendorLinkId, setLastVendorLinkId] = useState<number | null>(null);
  const [mileOptions, setMileOptions] = useState<any>(null);
  const [traveler, setTraveler] = useState<Traveler>(emptyTraveler);
  const [editingTraveler, setEditingTraveler] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [didSearch, setDidSearch] = useState(false);

  useEffect(() => {
    if (!user?.company_id) {
      setEmployeesLoading(false);
      return;
    }
    setEmployeesLoading(true);
    apiClient.getCompanyEmployeeTravelWallets(user.company_id)
      .then((res) => setEmployees(res.data || []))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : t("loadEmployeesFailed"));
        setEmployees([]);
      })
      .finally(() => setEmployeesLoading(false));
  }, [user?.company_id, t]);

  const resetOffers = () => {
    setQuoteId(null);
    setOffers([]);
    setOfferId("");
    setPackageFilter("ALL");
    setDidSearch(false);
  };

  const changeTransport = (next: string) => {
    setTransportType(next);
    if (next !== "FLIGHT") setScope("DOMESTIC");
    if (next === "CAR") {
      setWantFirst(false);
      setWantLast(false);
      setMileOptions(null);
    }
    resetOffers();
  };

  const selectEmployee = async (id: string) => {
    setEmployeeId(id);
    setEditingTraveler(false);
    if (!id) return;
    if (user?.company_id) {
      try {
        const res = await apiClient.getCompanyEmployeeTravelProfile(user.company_id, id);
        const profile = res.data;
        if (profile) {
          setTraveler({
            first_name: profile.first_name || "",
            last_name: profile.last_name || "",
            email: profile.email || "",
            passport_number: profile.passport_number || "",
            cnic_number: profile.cnic_number || "",
            phone: profile.phone || "",
            nationality: profile.nationality || "",
          });
          return;
        }
      } catch {
        // Fall through to employee list fields.
      }
    }
    const emp = employees.find((e) => e.id === id);
    if (!emp) return;
    const parts = String(emp.full_name || "").trim().split(/\s+/);
    setTraveler((current) => ({
      ...current,
      first_name: parts[0] || "",
      last_name: parts.slice(1).join(" "),
      email: emp.email || current.email,
      phone: emp.phone || current.phone,
    }));
  };

  const placeCountry = scope === "DOMESTIC" ? "pk" : undefined;
  const canSearch = Boolean(user?.company_id && employeeId && origin.trim() && destination.trim() && travelDate);
  const canConfirm = Boolean(quoteId && offerId && !submitting && travelerComplete(traveler));
  const showTravelerSummary = travelerComplete(traveler) && !editingTraveler;

  const search = async () => {
    if (!user?.company_id || !canSearch) return;
    setSearching(true);
    resetOffers();
    try {
      const res = await apiClient.searchCompanyTravel(user.company_id, {
        origin,
        destination,
        travel_date: travelDate,
        scope: transportType === "FLIGHT" ? scope : "DOMESTIC",
        bag_count: Number(bags),
        transport_type: transportType,
        ...(transportType === "CAR" ? { trip_direction: tripDirection } : {}),
      });
      setQuoteId(res.data.quote_id);
      setOffers(res.data.offers || []);
      setDidSearch(true);
      if (transportType !== "CAR") {
        const miles = await apiClient.getTravelMileOptions(user.company_id, Number(bags), res.data.quote_id);
        setMileOptions(miles.data);
      } else {
        setMileOptions(null);
        setWantFirst(false);
        setWantLast(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("searchFailed"));
    } finally {
      setSearching(false);
    }
  };

  const mile = (
    want: boolean,
    type: "RIDE_HAIL" | "AIRPORT_TRANSFER" | "RENTAL",
    provider: string,
    vehicleId: number | null,
    vendorLinkId: number | null,
  ) => {
    if (!want) return { type: "NONE" };
    if (type === "RIDE_HAIL") return { type: "RIDE_HAIL", provider: "BYKEA" };
    return {
      type,
      provider,
      mile_vehicle_id: vehicleId ?? undefined,
      vendor_link_id: vendorLinkId ?? undefined,
    };
  };

  const submit = async () => {
    if (!user?.company_id || !quoteId || !offerId) return;
    setSubmitting(true);
    try {
      await apiClient.createCompanyTravelBooking(user.company_id, {
        quote_id: quoteId,
        offer_id: offerId,
        account_mode: "COMPANY",
        employee_id: employeeId,
        package_filter: transportType === "CAR" ? "ALL" : packageFilter,
        bag_count: Number(bags),
        first_mile: mile(
          transportType === "CAR" ? false : wantFirst,
          firstType,
          firstProvider,
          firstMileVehicleId,
          firstVendorLinkId,
        ),
        last_mile: mile(
          transportType === "CAR" ? false : wantLast,
          lastType,
          lastProvider,
          lastMileVehicleId,
          lastVendorLinkId,
        ),
        traveler,
      });
      toast.success(t("bookingCreated"));
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("confirmFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const visibleOffers = offers.filter((o) => {
    if (transportType === "CAR" || packageFilter === "ALL") return true;
    if (packageFilter === "WITH_MEAL") return o.meal_included;
    if (packageFilter === "WITHOUT_MEAL") return !o.meal_included;
    if (packageFilter === "BAGS") return o.bag_allowance >= Number(bags);
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <CardSection title={t("tripDetails")}>
        <Field label={t("employee")} required>
          <Select value={employeeId} onChange={(e) => selectEmployee(e.target.value)} disabled={employeesLoading}>
            <option value="">{employeesLoading ? t("loading") : t("selectEmployee")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("travelDate")} required>
          <TextInput type="date" value={travelDate} onChange={(e) => { setTravelDate(e.target.value); resetOffers(); }} />
        </Field>
        <TravelPlaceField
          label={t("from")}
          required
          value={origin}
          onChange={(value) => { setOrigin(value); resetOffers(); }}
          placeholder={t("from")}
          country={placeCountry}
        />
        <TravelPlaceField
          label={t("to")}
          required
          value={destination}
          onChange={(value) => { setDestination(value); resetOffers(); }}
          placeholder={t("to")}
          country={placeCountry}
        />
        <Field label={t("transport")} required>
          <Select value={transportType} onChange={(e) => changeTransport(e.target.value)}>
            <option value="BUS">{t("bus")}</option>
            <option value="FLIGHT">{t("flight")}</option>
            <option value="TRAIN">{t("train")}</option>
            <option value="CAR">{t("car")}</option>
          </Select>
        </Field>
        {transportType === "FLIGHT" ? (
          <Field label={t("scope")}>
            <Select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                resetOffers();
              }}
            >
              <option value="DOMESTIC">{t("domestic")}</option>
              <option value="INTERNATIONAL">{t("international")}</option>
            </Select>
          </Field>
        ) : null}
        {transportType === "CAR" ? (
          <Field label={t("tripDirection")}>
            <Select
              value={tripDirection}
              onChange={(e) => {
                setTripDirection(e.target.value as TripDirection);
                resetOffers();
              }}
            >
              <option value="ONE_WAY">{t("oneWay")}</option>
              <option value="ROUND_TRIP">{t("roundTrip")}</option>
            </Select>
          </Field>
        ) : null}
        <Field label={t("bags")}>
          <TextInput type="number" min={0} max={8} value={bags} onChange={(e) => setBags(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <button onClick={search} disabled={searching || !canSearch} className={PRIMARY_BUTTON_CLASS}>
            {searching ? t("searching") : t("search")}
          </button>
        </div>
      </CardSection>

      {didSearch || searching ? (
        <CardSection title={t("offers")} grid={false}>
          {transportType !== "CAR" ? (
            <Field label={t("packageFilter")}>
              <Select value={packageFilter} onChange={(e) => setPackageFilter(e.target.value)}>
                <option value="ALL">{t("allPackages")}</option>
                <option value="WITH_MEAL">{t("withMeal")}</option>
                <option value="WITHOUT_MEAL">{t("withoutMeal")}</option>
                <option value="BAGS">{t("bagsFilter")}</option>
              </Select>
            </Field>
          ) : null}
          {searching ? (
            <p className="text-sm text-[var(--text-muted)]">{t("searching")}</p>
          ) : visibleOffers.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t("noOffers")}</p>
          ) : (
            <div className="space-y-3">
              {visibleOffers.map((o) => {
                const selected = offerId === o.offer_id;
                return (
                  <label
                    key={o.offer_id}
                    className={`flex gap-3 items-start rounded-2xl border p-4 cursor-pointer transition-all ${
                      selected
                        ? "border-[#f47f00] bg-[#f47f00]/5"
                        : "border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[#f47f00]/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="offer"
                      className="mt-1"
                      checked={selected}
                      onChange={() => setOfferId(o.offer_id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-[var(--text-primary)]">{o.operator}</p>
                        {o.class ? (
                          <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                            {o.class}
                          </span>
                        ) : null}
                      </div>
                      {o.mode === "CAR" ? (
                        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                          <p><span className="text-[var(--text-muted)]">{t("rental")}</span> {money(o.rental_amount)}</p>
                          <p>
                            <span className="text-[var(--text-muted)]">{t("fuel")}</span> {money(o.fuel_amount)}
                            <span className="block text-xs text-[var(--text-muted)]">
                              {o.distance_km ?? 0} km x {money(o.cost_per_km)}
                            </span>
                          </p>
                          <p><span className="text-[var(--text-muted)]">{t("estimatedToll")}</span> {money(o.estimated_toll)}</p>
                          <p><span className="text-[var(--text-muted)]">{t("total")}</span> {money(o.price)}</p>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {o.mode} {o.class} - {money(o.price)}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </CardSection>
      ) : null}

      {didSearch && offers.length > 0 && transportType !== "CAR" ? (
        <CardSection title={t("miles")} grid={false}>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <input type="checkbox" checked={wantFirst} onChange={(e) => setWantFirst(e.target.checked)} />
            {t("firstMile")}
          </label>
          {wantFirst ? (
            <MileOptionList
              groupName="first-mile"
              rideHail={mileOptions?.ride_hail}
              airportTransfers={mileOptions?.airport_transfers || []}
              selectedType={firstType}
              selectedVehicleId={firstMileVehicleId}
              selectedProvider={firstProvider}
              onRideHail={() => {
                setFirstType("RIDE_HAIL");
                setFirstProvider("BYKEA");
                setFirstMileVehicleId(null);
                setFirstVendorLinkId(null);
              }}
              onAirport={(row) => {
                setFirstType("AIRPORT_TRANSFER");
                setFirstProvider(row.provider);
                setFirstMileVehicleId(row.id);
                setFirstVendorLinkId(row.vendor_link_id ?? null);
              }}
              t={t}
            />
          ) : null}
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <input type="checkbox" checked={wantLast} onChange={(e) => setWantLast(e.target.checked)} />
            {t("lastMile")}
          </label>
          {wantLast ? (
            <>
              <MileOptionList
                groupName="last-mile"
                rideHail={mileOptions?.ride_hail}
                airportTransfers={mileOptions?.airport_transfers || []}
                selectedType={lastType}
                selectedVehicleId={lastMileVehicleId}
                selectedProvider={lastProvider}
                onRideHail={() => {
                  setLastType("RIDE_HAIL");
                  setLastProvider("BYKEA");
                  setLastMileVehicleId(null);
                  setLastVendorLinkId(null);
                }}
                onAirport={(row) => {
                  setLastType("AIRPORT_TRANSFER");
                  setLastProvider(row.provider);
                  setLastMileVehicleId(row.id);
                  setLastVendorLinkId(row.vendor_link_id ?? null);
                }}
                t={t}
              />
              {(mileOptions?.rentals_10hr || []).length > 0 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{t("rental10Hours")}</p>
                {(mileOptions?.rentals_10hr || []).map((row: any) => {
                  const selected = lastType === "RENTAL" && lastMileVehicleId === row.id && lastProvider === row.provider;
                  return (
                    <label
                      key={`rental-${row.provider}-${row.id}`}
                      className={`flex gap-3 items-start rounded-2xl border p-4 cursor-pointer transition-all ${
                        selected
                          ? "border-[#f47f00] bg-[#f47f00]/5"
                          : "border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[#f47f00]/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="last-mile"
                        className="mt-1"
                        checked={selected}
                        onChange={() => {
                          setLastType("RENTAL");
                          setLastProvider(row.provider);
                          setLastMileVehicleId(row.id);
                          setLastVendorLinkId(row.vendor_link_id ?? null);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[var(--text-primary)]">
                          {row.operator} - {row.name}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">{t("rental10Hours")}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              ) : null}
            </>
          ) : null}
        </CardSection>
      ) : null}

      {didSearch && offers.length > 0 ? (
        <CardSection title={t("travelerDetails")} grid={!showTravelerSummary}>
          {showTravelerSummary ? (
            <>
              <p className="text-sm text-[var(--text-muted)]">{t("travelerSavedHint")}</p>
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    {t("savedDetails")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingTraveler(true)}
                    className="text-sm font-bold text-[#f47f00]"
                  >
                    {t("editTraveler")}
                  </button>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                      {t("travelerName")}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                      {`${traveler.first_name} ${traveler.last_name}`.trim()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                      {t("travelerEmail")}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{traveler.email}</dd>
                  </div>
                  {traveler.phone.trim() ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                        {t("phone")}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{traveler.phone}</dd>
                    </div>
                  ) : null}
                  {traveler.cnic_number.trim() ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                        {t("cnicNumber")}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{traveler.cnic_number}</dd>
                    </div>
                  ) : null}
                  {traveler.passport_number.trim() ? (
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                        {t("passportNumber")}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{traveler.passport_number}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <button onClick={submit} disabled={!canConfirm} className={SECONDARY_BUTTON_CLASS}>
                {submitting ? t("confirming") : t("confirmBooking")}
              </button>
            </>
          ) : (
            <>
              <Field label={t("travelerFirstName")} required>
                <TextInput value={traveler.first_name} onChange={(e) => setTraveler((current) => ({ ...current, first_name: e.target.value }))} />
              </Field>
              <Field label={t("travelerLastName")}>
                <TextInput value={traveler.last_name} onChange={(e) => setTraveler((current) => ({ ...current, last_name: e.target.value }))} />
              </Field>
              <Field label={t("travelerEmail")} required>
                <TextInput type="email" value={traveler.email} onChange={(e) => setTraveler((current) => ({ ...current, email: e.target.value }))} />
              </Field>
              <Field label={t("phone")}>
                <TextInput value={traveler.phone} onChange={(e) => setTraveler((current) => ({ ...current, phone: e.target.value }))} />
              </Field>
              <Field label={t("cnicNumber")}>
                <TextInput value={traveler.cnic_number} onChange={(e) => setTraveler((current) => ({ ...current, cnic_number: e.target.value }))} />
              </Field>
              <Field label={t("passportNumber")}>
                <TextInput value={traveler.passport_number} onChange={(e) => setTraveler((current) => ({ ...current, passport_number: e.target.value }))} />
              </Field>
              <Field label={t("nationality")}>
                <TextInput value={traveler.nationality} onChange={(e) => setTraveler((current) => ({ ...current, nationality: e.target.value }))} />
              </Field>
              <div className="sm:col-span-2">
                <button onClick={submit} disabled={!canConfirm} className={SECONDARY_BUTTON_CLASS}>
                  {submitting ? t("confirming") : t("confirmBooking")}
                </button>
              </div>
            </>
          )}
        </CardSection>
      ) : null}
    </div>
  );
}

function MileOptionList({
  groupName,
  rideHail,
  airportTransfers,
  selectedType,
  selectedVehicleId,
  selectedProvider,
  onRideHail,
  onAirport,
  t,
}: {
  groupName: string;
  rideHail?: { amount?: number; disclaimer?: string } | null;
  airportTransfers: Array<{
    id: number;
    provider: string;
    name: string;
    operator: string;
    amount: number;
    vendor_link_id?: number | null;
  }>;
  selectedType: string;
  selectedVehicleId: number | null;
  selectedProvider: string;
  onRideHail: () => void;
  onAirport: (row: {
    id: number;
    provider: string;
    vendor_link_id?: number | null;
  }) => void;
  t: (key: string) => string;
}) {
  const rideSelected = selectedType === "RIDE_HAIL";
  return (
    <div className="space-y-3">
      <label
        className={`flex gap-3 items-start rounded-2xl border p-4 cursor-pointer transition-all ${
          rideSelected
            ? "border-[#f47f00] bg-[#f47f00]/5"
            : "border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[#f47f00]/40"
        }`}
      >
        <input type="radio" name={groupName} className="mt-1" checked={rideSelected} onChange={onRideHail} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[var(--text-primary)]">
            {t("bykea")} - {money(rideHail?.amount ?? 0)}
          </p>
          {rideHail?.disclaimer ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">{rideHail.disclaimer}</p>
          ) : null}
        </div>
      </label>
      {airportTransfers.length > 0 ? (
        <p className="text-sm font-semibold text-[var(--text-primary)]">{t("airportTransfer")}</p>
      ) : null}
      {airportTransfers.map((row) => {
        const selected =
          selectedType === "AIRPORT_TRANSFER" &&
          selectedVehicleId === row.id &&
          selectedProvider === row.provider;
        return (
          <label
            key={`${row.provider}-${row.id}`}
            className={`flex gap-3 items-start rounded-2xl border p-4 cursor-pointer transition-all ${
              selected
                ? "border-[#f47f00] bg-[#f47f00]/5"
                : "border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[#f47f00]/40"
            }`}
          >
            <input
              type="radio"
              name={groupName}
              className="mt-1"
              checked={selected}
              onChange={() => onAirport(row)}
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[var(--text-primary)]">
                {row.operator} - {row.name}
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {t("fixedAmount")} {money(row.amount)}
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
