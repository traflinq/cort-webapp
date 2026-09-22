"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiClient } from "../../../lib/services/api-client";
import { useAuth } from "../../../lib/contexts/auth-context";
import { PageHeader } from "../../components/PageLayout";
import { TravelPlaceField } from "../TravelPlaceField";
import {
  CardSection,
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  Select,
  TextInput,
  money,
} from "../travel-ui";

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

export default function NewTravelBookingPage() {
  const t = useTranslations("company.travel");
  const { user } = useAuth();
  const router = useRouter();
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
  const [firstProvider, setFirstProvider] = useState("BYKEA");
  const [lastProvider, setLastProvider] = useState("BYKEA");
  const [mileOptions, setMileOptions] = useState<any>(null);
  const [traveler, setTraveler] = useState<Traveler>(emptyTraveler);
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

  const selectEmployee = (id: string) => {
    setEmployeeId(id);
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
  const canConfirm = Boolean(quoteId && offerId && !submitting);

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
        const miles = await apiClient.getTravelMileOptions(user.company_id, Number(bags));
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

  const mile = (want: boolean, provider: string) => {
    if (!want) return { type: "NONE" };
    if (provider === "BYKEA") return { type: "RIDE_HAIL", provider: "BYKEA" };
    const rental = (mileOptions?.rentals || []).find((r: any) => r.provider === provider);
    return { type: "RENTAL", provider, vendor_link_id: rental?.vendor_link_id };
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
        first_mile: mile(transportType === "CAR" ? false : wantFirst, firstProvider),
        last_mile: mile(transportType === "CAR" ? false : wantLast, lastProvider),
        traveler,
      });
      toast.success(t("bookingCreated"));
      router.push("/company/travel");
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
    <div className="flex flex-col gap-6 max-w-4xl pb-12">
      <PageHeader label={t("label")} title={t("newTitle")} />

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
            <Field label={t("firstMile")}>
              <Select value={firstProvider} onChange={(e) => setFirstProvider(e.target.value)}>
                <option value="BYKEA">{t("bykea")}</option>
                <option value="CORT">{t("cortRental")}</option>
                <option value="COMPANY_VENDOR">{t("companyVendor")}</option>
                <option value="SHORT_RENTAL">{t("shortRental")}</option>
              </Select>
            </Field>
          ) : null}
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <input type="checkbox" checked={wantLast} onChange={(e) => setWantLast(e.target.checked)} />
            {t("lastMile")}
          </label>
          {wantLast ? (
            <Field label={t("lastMile")}>
              <Select value={lastProvider} onChange={(e) => setLastProvider(e.target.value)}>
                <option value="BYKEA">{t("bykea")}</option>
                <option value="CORT">{t("cortRental")}</option>
                <option value="COMPANY_VENDOR">{t("companyVendor")}</option>
                <option value="SHORT_RENTAL">{t("shortRental")}</option>
              </Select>
            </Field>
          ) : null}
        </CardSection>
      ) : null}

      {didSearch && offers.length > 0 ? (
        <CardSection title={t("travelerDetails")}>
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
        </CardSection>
      ) : null}
    </div>
  );
}
