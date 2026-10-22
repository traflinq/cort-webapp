"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Car, Check, MapPin, User } from "lucide-react";
import { useAppSelector } from "@/app/lib/store/hooks";
import { selectCompany } from "@/app/lib/store/slices/companySlice";
import { apiClient, type ChauffeurBooking } from "@/app/lib/services/api-client";
import type { BookingVendorRequest } from "@/app/lib/services/types/multi-mode";
import { useConfirm } from "@/app/lib/hooks/useConfirm";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardSkeleton,
  DataTable,
  EmptyState,
  PageHeader,
  StatusBadge,
  useFormatters,
  usePageBreadcrumbs,
  type DataTableColumn,
} from "@/app/ui";
import { useCompanyBasePath } from "../../lib/use-company-base-path";

type DailyLog = NonNullable<ChauffeurBooking["chauffeur_trip_daily_logs"]>[number];

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("company.bookings");
  const tCommon = useTranslations("common");
  const { formatDate, formatDateTime } = useFormatters();
  const { companyPath } = useCompanyBasePath();
  const confirm = useConfirm();
  const company = useAppSelector(selectCompany);
  const companyId = Number(company?.id);

  usePageBreadcrumbs([{ label: `#${id}` }]);

  const [booking, setBooking] = useState<ChauffeurBooking | null>(null);
  const [vendorRequests, setVendorRequests] = useState<BookingVendorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  const [reloadTick, setReloadTick] = useState(0);
  const load = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    Promise.all([
      apiClient.getCompanyChauffeurBooking(companyId, Number(id)),
      apiClient.getBookingVendorRequests(companyId, Number(id)).catch(() => ({ data: [] })),
    ])
      .then(([bookingRes, reqRes]) => {
        if (cancelled) return;
        setBooking(bookingRes.data as unknown as ChauffeurBooking);
        setVendorRequests((reqRes as { data: BookingVendorRequest[] }).data ?? []);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("failedToLoadBooking"));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, id, t, reloadTick]);

  // Poll while any vendor request is still pending.
  useEffect(() => {
    const hasPending = vendorRequests.some((r) => r.status === "PENDING");
    if (!hasPending) return;
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [vendorRequests, load]);

  const confirmVendor = async (req: BookingVendorRequest) => {
    const vendorName = req.company_vendor_links?.companies?.name ?? `#${req.company_vendor_link_id}`;
    const ok = await confirm({
      title: t("confirmVendor"),
      message: t("confirmVendorMessage", { vendor: vendorName }),
      consequences: [t("confirmVendorConsequence")],
      confirmLabel: t("confirmVendor"),
    });
    if (!ok) return;
    setConfirming(req.id);
    try {
      await apiClient.confirmVendorForBooking(companyId, Number(id), req.id);
      toast.success(t("vendorConfirmed"));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToConfirmVendor"));
    } finally {
      setConfirming(null);
    }
  };

  const backHref = companyPath("/company/bookings");

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader back={{ href: backHref, label: t("backToBookings") }} title={`#${id}`} />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="space-y-6">
        <PageHeader back={{ href: backHref, label: t("backToBookings") }} title={`#${id}`} />
        <Card>
          <EmptyState
            title={error ?? t("bookingNotFound")}
            action={
              <Button variant="outline" size="sm" onClick={load}>
                {tCommon("actions.tryAgain")}
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const passenger = booking.users_chauffeur_bookings_passenger_idTousers;
  const driver = booking.users_chauffeur_bookings_driver_idTousers;
  const isExternalVendor = booking.fulfillment_type === "EXTERNAL_VENDOR";
  const showVendorResponses = isExternalVendor || vendorRequests.length > 0;
  const hasPendingVendor = vendorRequests.some((r) => r.status === "PENDING");
  const dailyLogs = booking.chauffeur_trip_daily_logs ?? [];

  const vendorColumns: DataTableColumn<BookingVendorRequest>[] = [
    {
      key: "vendor",
      header: t("vendorName"),
      cell: (req) => <span className="font-medium text-fg">{req.company_vendor_links?.companies?.name ?? `#${req.company_vendor_link_id}`}</span>,
    },
    { key: "status", header: t("status"), cell: (req) => <StatusBadge status={req.status} /> },
    {
      key: "vehicle",
      header: t("assignedVehicle"),
      hideBelow: "md",
      cell: (req) => (req.vehicles ? `${req.vehicles.plate_number} — ${req.vehicles.make} ${req.vehicles.model}` : "—"),
    },
    { key: "driver", header: t("assignedDriver"), hideBelow: "md", cell: (req) => req.users?.full_name ?? "—" },
    { key: "responded", header: t("respondedAt"), hideBelow: "lg", cell: (req) => <span className="text-fg-muted">{req.responded_at ? formatDateTime(req.responded_at) : "—"}</span> },
    {
      key: "action",
      header: t("action"),
      align: "right",
      cell: (req) =>
        req.status === "ACCEPTED" ? (
          <Button size="sm" leftIcon={<Check />} loading={confirming === req.id} onClick={() => void confirmVendor(req)}>
            {t("confirmVendor")}
          </Button>
        ) : null,
    },
  ];

  const logColumns: DataTableColumn<DailyLog>[] = [
    { key: "date", header: t("logDate"), cell: (log) => <span className="text-fg">{formatDate(log.log_date)}</span> },
    { key: "type", header: t("logType"), cell: (log) => <StatusBadge status={log.trip_type} size="sm" dot={false} /> },
    { key: "usage", header: t("logUsage"), cell: (log) => (log.hours_used ? t("hoursUsed", { count: Number(log.hours_used).toFixed(1) }) : "—") },
    { key: "fullDay", header: t("fullDay"), align: "center", cell: (log) => (log.is_full_day ? <Check className="mx-auto size-4 text-success-ink" aria-label={t("fullDay")} /> : <span className="text-fg-muted">—</span>) },
    {
      key: "accommodation",
      header: t("accommodationShort"),
      align: "center",
      cell: (log) => (log.apply_accommodation ? <Check className="mx-auto size-4 text-success-ink" aria-label={t("accommodationShort")} /> : <span className="text-fg-muted">—</span>),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: backHref, label: t("backToBookings") }}
        title={t("bookingDetails", { id: booking.id })}
        description={booking.service_category ?? t("chauffeurRide")}
        meta={
          <>
            <StatusBadge status={booking.status} />
            <StatusBadge status={booking.fulfillment_type} dot={false} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("tripDetails")} />
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <Detail label={t("scheduledFor")} value={booking.scheduled_for ? formatDateTime(booking.scheduled_for) : "—"} />
              <Detail label={t("duration")} value={t("daysCount", { count: booking.no_of_days || 1 })} />
              <Detail label={t("type")} value={<span className="capitalize">{booking.trip_type.replace(/_/g, " ").toLowerCase()}</span>} />
              <Detail label={t("package")} value={<span className="capitalize">{booking.package_selected.replace(/_/g, " ").toLowerCase()}</span>} />
              <Detail label={t("city")} value={booking.city ?? "—"} />
              <Detail label={t("category")} value={booking.service_category ?? "—"} />
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wider text-fg-muted">{t("pickupAddress")}</dt>
                <dd className="mt-1 flex items-start gap-2 rounded-lg border border-line bg-subtle px-3 py-2 text-fg">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden="true" />
                  <span>{booking.pickup_address || "—"}</span>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("passenger")} />
            <CardContent className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                <User className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="font-medium text-fg">{passenger?.full_name || t("unknownPassenger")}</div>
                <div dir="ltr" className="truncate text-xs text-fg-muted">
                  {passenger?.email || tCommon("misc.noEmail")}
                </div>
              </div>
            </CardContent>
          </Card>

          {booking.status !== "PENDING" && (
            <Card>
              <CardHeader title={t("fleetAssignment")} />
              <CardContent>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-fg-muted">
                      <User className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wider text-fg-muted">{t("chauffeur")}</dt>
                      <dd className="mt-0.5 font-medium text-fg">{driver?.full_name || t("assigning")}</dd>
                      {driver?.phone && (
                        <dd dir="ltr" className="text-xs text-fg-muted">
                          {driver.phone}
                        </dd>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-fg-muted">
                      <Car className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wider text-fg-muted">{t("fleetUnit")}</dt>
                      <dd className="mt-0.5 font-medium text-fg">{booking.vehicles ? booking.vehicles.model : t("vehiclePending")}</dd>
                      {booking.vehicles?.plate_number && (
                        <dd>
                          <Badge tone="brand" size="sm" className="font-mono">
                            {booking.vehicles.plate_number}
                          </Badge>
                        </dd>
                      )}
                    </div>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showVendorResponses && (
        <Card>
          <CardHeader
            title={t("vendorResponses")}
            description={!isExternalVendor && vendorRequests.length > 0 ? t("vendorBroadcastNote") : undefined}
            actions={hasPendingVendor ? <span className="text-xs text-fg-muted">{t("autoRefreshing")}</span> : undefined}
          />
          <DataTable<BookingVendorRequest>
            caption={t("vendorResponses")}
            columns={vendorColumns}
            rows={vendorRequests}
            rowKey={(r) => r.id}
            empty={{ title: t("noVendorResponses") }}
            rowClassName={(r) => (r.status === "ACCEPTED" ? "bg-success-soft/40" : undefined)}
          />
        </Card>
      )}

      {dailyLogs.length > 0 && (
        <Card>
          <CardHeader title={t("tripLogs")} />
          <DataTable<DailyLog> caption={t("tripLogs")} columns={logColumns} rows={dailyLogs} rowKey={(l) => l.id ?? `${l.log_date}-${l.trip_type}`} density="compact" />
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-fg-muted">{label}</dt>
      <dd className="mt-1 text-fg">{value}</dd>
    </div>
  );
}
