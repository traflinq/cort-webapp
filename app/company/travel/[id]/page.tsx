"use client";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiClient } from "../../../lib/services/api-client";
import { useAuth } from "../../../lib/contexts/auth-context";
import { Card } from "../../components/DashboardComponents";
import { PageHeader } from "../../components/PageLayout";
import {
  CardSection,
  Field,
  PRIMARY_BUTTON_CLASS,
  StatusChip,
  TextInput,
  mileLabel,
  bookingTrip,
  routeTitle,
  shortDate,
} from "../travel-ui";

const STATUS_KEYS: Record<string, "statusReview" | "statusApproval" | "statusConfirmed" | "statusRejected"> = {
  REVIEW: "statusReview",
  APPROVAL: "statusApproval",
  CONFIRMED: "statusConfirmed",
  REJECTED: "statusRejected",
};

export default function TravelBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("company.travel");
  const { user } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [driver, setDriver] = useState({
    first_mile_driver: "",
    first_mile_vehicle: "",
    last_mile_driver: "",
    last_mile_vehicle: "",
  });

  useEffect(() => {
    if (!user?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    apiClient.getCompanyTravelBooking(user.company_id, Number(id))
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
  }, [user?.company_id, id, t]);

  const save = async () => {
    if (!user?.company_id) return;
    setSaving(true);
    try {
      await apiClient.patchTravelBooking(user.company_id, Number(id), driver);
      toast.success(t("updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl">
        <PageHeader label={t("label")} title={t("loadingBooking")} />
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] h-64 animate-pulse" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl">
        <PageHeader label={t("label")} title={t("bookingNotFound")} />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error || t("bookingNotFound")}
        </div>
      </div>
    );
  }

  const trip = bookingTrip(booking);
  const isCar = trip.transport_type === "CAR";
  const showFirst = !isCar && trip.first && trip.first.type !== "NONE";
  const showLast = !isCar && trip.last && trip.last.type !== "NONE";
  const traveler = trip.traveler;

  return (
    <div className="flex flex-col gap-6 max-w-3xl pb-12">
      <PageHeader
        label={t("label")}
        title={routeTitle(trip.origin, trip.destination)}
        description={shortDate(trip.travel_date)}
        action={<StatusChip status={booking.status} label={t(STATUS_KEYS[booking.status] || "status")} />}
      />

      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">{t("employee")}</p>
            <p className="mt-1 font-bold text-[var(--text-primary)]">{booking.employee?.full_name || "-"}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">{t("transport")}</p>
            <p className="mt-1 font-bold text-[var(--text-primary)]">
              {trip.transport_type} {trip.travel_class ? `- ${trip.travel_class}` : ""}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">{t("operator")}</p>
            <p className="mt-1 font-bold text-[var(--text-primary)]">{trip.operator_name || "-"}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">{t("travelerDetails")}</p>
            <p className="mt-1 font-bold text-[var(--text-primary)]">
              {traveler?.first_name} {traveler?.last_name}
            </p>
            <p className="text-sm text-[var(--text-muted)]">{traveler?.email}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">{t("firstMile")}</p>
            <p className="mt-1 font-medium text-[var(--text-primary)]">
              {mileLabel(trip.first?.type, trip.first?.provider, trip.transport_type)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">{t("lastMile")}</p>
            <p className="mt-1 font-medium text-[var(--text-primary)]">
              {mileLabel(trip.last?.type, trip.last?.provider, trip.transport_type)}
            </p>
          </div>
        </div>
      </Card>

      {showFirst || showLast ? (
        <CardSection title={t("itinerary")}>
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
          <div className="sm:col-span-2">
            <button onClick={save} disabled={saving} className={PRIMARY_BUTTON_CLASS}>
              {saving ? t("saving") : t("saveItinerary")}
            </button>
          </div>
        </CardSection>
      ) : null}
    </div>
  );
}
