"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Ban,
  Bus as BusIcon,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Fingerprint,
  Globe2,
  IdCard,
  Link as LinkIcon,
  Luggage,
  Mail,
  MapPin,
  Phone,
  Plane,
  Route,
  TrainFront,
  User,
  UtensilsCrossed,
  Wallet,
  XCircle,
} from "lucide-react";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import Modal from "../bookings/components/Modal";
import {
  Field,
  PRIMARY_BUTTON_CLASS,
  StatusChip,
  TextInput,
  bookingFareTotal,
  bookingTrip,
  mileLabel,
  mileVendorName,
  money,
  shortDate,
  shortDateTime,
} from "./travel-ui";

const STATUS_KEYS: Record<string, "statusReview" | "statusApproval" | "statusConfirmed" | "statusRejected"> = {
  REVIEW: "statusReview",
  APPROVAL: "statusApproval",
  CONFIRMED: "statusConfirmed",
  REJECTED: "statusRejected",
};

const TRANSPORT_KEYS: Record<string, "bus" | "flight" | "train" | "car"> = {
  BUS: "bus",
  FLIGHT: "flight",
  TRAIN: "train",
  CAR: "car",
};

const TRANSPORT_ICON: Record<string, typeof Plane> = {
  BUS: BusIcon,
  FLIGHT: Plane,
  TRAIN: TrainFront,
  CAR: Car,
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: React.ReactNode;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
        <p className="mt-0.5 font-bold text-[var(--text-primary)] break-words">{empty ? "-" : value}</p>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
      <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">{title}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export default function TravelBookingDetailModal({
  bookingId,
  onClose,
  onChanged,
}: {
  bookingId: number | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const t = useTranslations("company.travel");
  const { user } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [driver, setDriver] = useState({
    first_mile_driver: "",
    first_mile_vehicle: "",
    last_mile_driver: "",
    last_mile_vehicle: "",
  });

  const isOpen = bookingId !== null;

  useEffect(() => {
    if (bookingId === null || !user?.company_id) return;
    setLoading(true);
    setError(null);
    apiClient
      .getCompanyTravelBooking(user.company_id, bookingId)
      .then((res) => {
        const data = res.data;
        setBooking(data);
        const trip = bookingTrip(data);
        setDriver({
          first_mile_driver: trip.first?.driver || "",
          first_mile_vehicle: trip.first?.vehicle || "",
          last_mile_driver: trip.last?.driver || "",
          last_mile_vehicle: trip.last?.vehicle || "",
        });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : t("loadFailed");
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [bookingId, user?.company_id, t]);

  useEffect(() => {
    if (!isOpen) {
      setBooking(null);
      setError(null);
    }
  }, [isOpen]);

  const act = async (approve: boolean) => {
    if (!user?.company_id || bookingId === null) return;
    setActing(true);
    try {
      if (approve) await apiClient.approveTravelBooking(user.company_id, bookingId);
      else await apiClient.rejectTravelBooking(user.company_id, bookingId);
      toast.success(approve ? t("approved") : t("rejectedLabel"));
      const res = await apiClient.getCompanyTravelBooking(user.company_id, bookingId);
      setBooking(res.data);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setActing(false);
    }
  };

  const save = async () => {
    if (!user?.company_id || bookingId === null) return;
    setSaving(true);
    try {
      const res = await apiClient.patchTravelBooking(user.company_id, bookingId, driver);
      setBooking(res.data);
      toast.success(t("updated"));
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const trip = booking ? bookingTrip(booking) : null;
  const isCar = trip?.transport_type === "CAR";
  const showFirst = Boolean(booking && !isCar && trip?.first && trip.first.type !== "NONE");
  const showLast = Boolean(booking && !isCar && trip?.last && trip.last.type !== "NONE");
  const traveler = trip?.traveler;
  const travelerName = `${traveler?.first_name || ""} ${traveler?.last_name || ""}`.trim();
  const TransportIcon = (trip?.transport_type && TRANSPORT_ICON[trip.transport_type]) || Route;
  const transportLabel = trip?.transport_type ? t(TRANSPORT_KEYS[trip.transport_type] || "type") : "-";
  const scopeLabel =
    trip?.scope === "INTERNATIONAL" ? t("international") : trip?.scope === "DOMESTIC" ? t("domestic") : trip?.scope || "-";
  const directionLabel =
    trip?.trip_direction === "ROUND_TRIP"
      ? t("roundTrip")
      : trip?.trip_direction === "ONE_WAY"
        ? t("oneWay")
        : trip?.trip_direction || "-";
  const accountLabel =
    booking?.account_mode === "COMPANY"
      ? t("companyAccount")
      : booking?.account_mode === "PERSONAL"
        ? t("personalAccount")
        : booking?.account_mode || "-";
  const mealLabel =
    trip?.meal_included === true ? t("withMeal") : trip?.meal_included === false ? t("withoutMeal") : "-";
  const firstMiles = Number(trip?.first?.estimate ?? 0);
  const lastMiles = Number(trip?.last?.estimate ?? 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={booking ? `${t("bookingId")} #${booking.id}` : t("bookingDetails")}
      panelClassName="!max-w-3xl"
    >
      {loading || !booking ? (
        error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
        ) : (
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-subtle)]" />
            <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-subtle)]" />
            <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-subtle)]" />
          </div>
        )
      ) : (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-[var(--border-default)] bg-gradient-to-br from-[#0c225e] to-[#13306f] p-6 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                  <TransportIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">{transportLabel}</p>
                  <div className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
                    <span>{trip?.origin || "-"}</span>
                    <span className="text-white/50">&rarr;</span>
                    <span>{trip?.destination || "-"}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-white/70">{shortDate(trip?.travel_date)}</p>
                </div>
              </div>
              <StatusChip status={booking.status} label={t(STATUS_KEYS[booking.status] || "status")} />
            </div>
            {booking.status === "APPROVAL" ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => act(true)}
                  disabled={acting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> {t("approve")}
                </button>
                <button
                  type="button"
                  onClick={() => act(false)}
                  disabled={acting}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" /> {t("reject")}
                </button>
              </div>
            ) : null}
          </div>

          <Group title={t("travelerDetails")}>
            <InfoRow icon={User} label={t("travelerName")} value={travelerName || booking.employee?.full_name} />
            <InfoRow icon={Mail} label={t("travelerEmail")} value={traveler?.email || booking.employee?.email} />
            <InfoRow icon={Phone} label={t("phone")} value={traveler?.phone || booking.employee?.phone} />
            <InfoRow icon={Fingerprint} label={t("passportNumber")} value={traveler?.passport_number} />
            <InfoRow icon={IdCard} label={t("cnicNumber")} value={traveler?.cnic_number} />
            <InfoRow icon={Globe2} label={t("nationality")} value={traveler?.nationality} />
          </Group>

          <Group title={t("tripDetails")}>
            <InfoRow icon={MapPin} label={t("from")} value={trip?.origin} />
            <InfoRow icon={MapPin} label={t("to")} value={trip?.destination} />
            <InfoRow icon={Calendar} label={t("travelDate")} value={shortDate(trip?.travel_date)} />
            <InfoRow icon={TransportIcon} label={t("transport")} value={transportLabel} />
            <InfoRow icon={Globe2} label={t("scope")} value={scopeLabel} />
            {isCar ? <InfoRow icon={Route} label={t("tripDirection")} value={directionLabel} /> : null}
            <InfoRow icon={Luggage} label={t("bags")} value={trip?.bag_count} />
            {!isCar ? <InfoRow icon={CreditCard} label={t("class")} value={trip?.travel_class} /> : null}
          </Group>

          <Group title={t("offerDetails")}>
            <InfoRow icon={Building2} label={t("operator")} value={trip?.operator_name} />
            {!isCar ? <InfoRow icon={Clock} label={t("duration")} value={trip?.duration} /> : null}
            {!isCar ? <InfoRow icon={UtensilsCrossed} label={t("meal")} value={mealLabel} /> : null}
            {!isCar ? <InfoRow icon={Luggage} label={t("bagAllowance")} value={trip?.bag_allowance} /> : null}
            {isCar ? (
              <InfoRow icon={Route} label={t("distance")} value={trip?.distance_km ? `${trip.distance_km} km` : "-"} />
            ) : null}
            {isCar ? (
              <InfoRow icon={Wallet} label={t("costPerKm")} value={trip?.cost_per_km != null ? money(trip.cost_per_km) : "-"} />
            ) : null}
            {isCar ? (
              <InfoRow icon={Wallet} label={t("rental")} value={trip?.rental_amount != null ? money(trip.rental_amount) : "-"} />
            ) : null}
            {isCar ? (
              <InfoRow icon={Wallet} label={t("fuel")} value={trip?.fuel_amount != null ? money(trip.fuel_amount) : "-"} />
            ) : null}
            {isCar ? (
              <InfoRow
                icon={Wallet}
                label={t("estimatedToll")}
                value={trip?.estimated_toll != null ? money(trip.estimated_toll) : "-"}
              />
            ) : null}
            <InfoRow icon={Wallet} label={t("fare")} value={money(booking.fare_amount)} />
            <InfoRow icon={Wallet} label={t("total")} value={money(bookingFareTotal(booking))} />
            {trip?.source_url ? (
              <InfoRow
                icon={LinkIcon}
                label={t("sourceLink")}
                value={
                  <a href={trip.source_url} target="_blank" rel="noreferrer" className="text-[#f47f00] underline break-all">
                    {trip.source_url}
                  </a>
                }
              />
            ) : null}
            {booking.travel_invoice ? (
              <InfoRow
                icon={FileText}
                label={t("invoice")}
                value={`${booking.travel_invoice.invoice_number} - ${money(booking.travel_invoice.total_amount)} - ${booking.travel_invoice.status}`}
              />
            ) : null}
          </Group>

          {!isCar && (showFirst || showLast || firstMiles > 0 || lastMiles > 0) ? (
            <Group title={t("miles")}>
              <InfoRow
                icon={Ban}
                label={t("firstMile")}
                value={mileLabel(trip?.first?.type, trip?.first?.provider, trip?.transport_type)}
              />
              <InfoRow icon={Building2} label={t("vendor")} value={mileVendorName(trip?.first)} />
              <InfoRow
                icon={Ban}
                label={t("lastMile")}
                value={mileLabel(trip?.last?.type, trip?.last?.provider, trip?.transport_type)}
              />
              <InfoRow icon={Building2} label={t("vendor")} value={mileVendorName(trip?.last)} />
            </Group>
          ) : null}

          <Group title={t("bookingDetails")}>
            <InfoRow icon={User} label={t("bookedBy")} value={booking.booked_by?.full_name || booking.booked_by?.email} />
            <InfoRow icon={Wallet} label={t("accountMode")} value={accountLabel} />
            <InfoRow icon={Calendar} label={t("createdAt")} value={shortDateTime(booking.created_at)} />
            <InfoRow icon={Calendar} label={t("confirmedAt")} value={shortDateTime(booking.confirmed_at)} />
          </Group>

          {showFirst || showLast ? (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
              <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                {t("itinerary")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {showFirst ? (
                  <>
                    <Field label={t("firstMileDriver")}>
                      <TextInput
                        value={driver.first_mile_driver}
                        onChange={(e) => setDriver((d) => ({ ...d, first_mile_driver: e.target.value }))}
                      />
                    </Field>
                    <Field label={t("firstMileVehicle")}>
                      <TextInput
                        value={driver.first_mile_vehicle}
                        onChange={(e) => setDriver((d) => ({ ...d, first_mile_vehicle: e.target.value }))}
                      />
                    </Field>
                  </>
                ) : null}
                {showLast ? (
                  <>
                    <Field label={t("lastMileDriver")}>
                      <TextInput
                        value={driver.last_mile_driver}
                        onChange={(e) => setDriver((d) => ({ ...d, last_mile_driver: e.target.value }))}
                      />
                    </Field>
                    <Field label={t("lastMileVehicle")}>
                      <TextInput
                        value={driver.last_mile_vehicle}
                        onChange={(e) => setDriver((d) => ({ ...d, last_mile_vehicle: e.target.value }))}
                      />
                    </Field>
                  </>
                ) : null}
              </div>
              <div className="mt-4">
                <button onClick={save} disabled={saving} className={PRIMARY_BUTTON_CLASS}>
                  {saving ? t("saving") : t("saveItinerary")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
