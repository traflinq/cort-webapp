"use client";

import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { fetchBookings, setPage, setFilters, selectBookings, selectPagination, selectBookingsStatus, selectFilters } from "../../lib/store/slices/bookingsSlice";
import { useCompanyAccess } from "../lib/access-context";
import { useState, useEffect, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatLocaleDate, formatLocaleTime } from "@/app/lib/i18n/format";
import type { Locale } from "@/i18n/config";
import Modal from "./components/Modal";
import CreateBookingForm from "./components/CreateBookingForm";
import { ChauffeurBooking } from "../../lib/services/api-client";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, ChevronRight, MapPin, Plus } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  TableSkeletonRows,
  Tabs,
  TabsList,
  TabsTrigger,
  type StatusEntry,
} from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { Card } from "../components/Card";
import { TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../components/PageLayout";

const BOOKING_STATUS_KEYS: Record<string, "pending" | "assigned" | "arrived" | "inProgress" | "completed" | "cancelled"> = {
  PENDING: "pending",
  ASSIGNED: "assigned",
  ARRIVED: "arrived",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const STATUS_FILTERS = ["PENDING", "ASSIGNED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

/** Booking-specific tones on top of the shared registry (ARRIVED is unique to chauffeur trips). */
const BOOKING_STATUS_TONES: Record<string, StatusEntry> = {
  ARRIVED: { tone: "info" },
  IN_PROGRESS: { tone: "purple" },
};

const TH = cn(TABLE_HEADER_CELL_CLASS, "text-start");
const TD = TABLE_CELL_CLASS;

/** Small label / value pair used in the booking detail modal. */
function DetailItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="mt-1 text-sm text-fg">{children}</dd>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

/** "HOURS_10" → "hours 10" (rendered with CSS capitalize). */
const humanizeEnum = (value: string | null | undefined) => (value ?? "").replace(/_/g, " ").toLowerCase();

export default function BookingsPage() {
  const t = useTranslations("company.bookings");
  const tStatus = useTranslations("common.status");
  const tFulfillment = useTranslations("common.fulfillment");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const dispatch = useAppDispatch();
  const { company, access } = useCompanyAccess();
  const bookings = useAppSelector(selectBookings);
  const { page: reduxPage, limit, pages: totalPages } = useAppSelector(selectPagination);
  const { search, status, fulfillmentType } = useAppSelector(selectFilters);
  const statusState = useAppSelector(selectBookingsStatus);
  const isLoading = statusState === 'loading';

  const searchParams = useSearchParams();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ChauffeurBooking | null>(null);

  // Local state for pagination - decoupled from Redux metadata to prevent loops
  const [currentPage, setCurrentPage] = useState(reduxPage);

  // Local state for inputs to allow debouncing
  const [searchQuery, setSearchQuery] = useState(search);
  const [statusFilter, setStatusFilter] = useState(status);
  const [fulfillmentFilter, setFulfillmentFilter] = useState(fulfillmentType);

  // Sync local state with Redux when it changes (e.g., on mount or navigation back)
  useEffect(() => {
    setSearchQuery(search);
    setStatusFilter(status);
    setFulfillmentFilter(fulfillmentType);
  }, [search, status, fulfillmentType]);

  // Check for action param to open modal
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "new") {
      setIsModalOpen(true);
      // Clean up URL without reload
      router.replace("/company/bookings", { scroll: false });
    }
  }, [searchParams, router]);

  // Debounce search and update Redux filters
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== search || statusFilter !== status || fulfillmentFilter !== fulfillmentType) {
        dispatch(setFilters({ search: searchQuery, status: statusFilter, fulfillmentType: fulfillmentFilter }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, fulfillmentFilter, search, status, fulfillmentType, dispatch]);

  // Track last fetched params to avoid duplicates
  const [lastFetchedParams, setLastFetchedParams] = useState<string>("");

  // Fetch when params change - Primary driver is LOCAL state
  useEffect(() => {
    if (!company?.id) return;

    const currentParams = JSON.stringify({ currentPage, limit, status, search, fulfillmentType });
    if (currentParams === lastFetchedParams && statusState !== 'idle') return;

    setLastFetchedParams(currentParams);
    dispatch(fetchBookings({
      companyId: company.id,
      page: currentPage,
      limit,
      status,
      search,
      fulfillment_type: fulfillmentType || undefined,
    }));
  }, [dispatch, company?.id, currentPage, limit, status, search, fulfillmentType, lastFetchedParams, statusState]);

  const handleBookingCreated = () => {
    setIsModalOpen(false);
    if (company?.id) {
      setCurrentPage(1); // Reset local page
      dispatch(fetchBookings({ companyId: company.id, page: 1, limit, status, search, fulfillment_type: fulfillmentType || undefined }));
    }
  };

  const getPassengerName = (booking: ChauffeurBooking) => {
    return booking.users_chauffeur_bookings_passenger_idTousers?.full_name || tStatus("unknown");
  };

  const getStatusLabel = (status: string) => {
    const key = BOOKING_STATUS_KEYS[status];
    return key ? tStatus(key) : status;
  };

  const formatScheduledDate = (iso: string) =>
    formatLocaleDate(iso, locale, {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatScheduledTime = (iso: string) =>
    formatLocaleTime(iso, locale, {
      timeZone: "Asia/Karachi",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatScheduledDateTime = (iso: string) =>
    `${formatScheduledDate(iso)} ${formatScheduledTime(iso)}`;

  const selectedPassenger = selectedBooking?.users_chauffeur_bookings_passenger_idTousers;
  const selectedDriver = selectedBooking?.users_chauffeur_bookings_driver_idTousers;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-6 pb-12">
      <PageHeader
        title={t("title")}
        actions={
          access.services.chauffeur ? (
            <Button leftIcon={<Plus />} onClick={() => setIsModalOpen(true)}>
              {tCommon("actions.newBooking")}
            </Button>
          ) : undefined
        }
      />

      <Card className="overflow-hidden p-0 sm:p-0">
        {/* Status tabs */}
        <Tabs value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
          <TabsList aria-label={t("status")} className="px-2 sm:px-3">
            <TabsTrigger value="all">{t("allStatuses")}</TabsTrigger>
            {STATUS_FILTERS.map((value) => (
              <TabsTrigger key={value} value={value}>
                {getStatusLabel(value)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Search + fulfilment filter */}
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <div className="w-full sm:max-w-sm">
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t("searchPlaceholder")} />
          </div>
          <div className="w-full sm:w-56">
            <Select
              aria-label={t("fulfillment")}
              value={fulfillmentFilter}
              onChange={(e) => setFulfillmentFilter(e.target.value)}
            >
              <option value="">{t("allTypes")}</option>
              <option value="CORT_MANAGED">{tFulfillment("cortManaged")}</option>
              <option value="EXTERNAL_VENDOR">{tFulfillment("vendorManaged")}</option>
              <option value="SELF_MANAGED">{tFulfillment("ownPoolCars")}</option>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-line bg-subtle/50">
              <tr>
                <th scope="col" className={TH}>{t("id")}</th>
                <th scope="col" className={TH}>{t("service")}</th>
                <th scope="col" className={TH}>{t("fulfillment")}</th>
                <th scope="col" className={TH}>{t("passenger")}</th>
                <th scope="col" className={TH}>{t("driver")}</th>
                <th scope="col" className={TH}>{t("package")}</th>
                <th scope="col" className={TH}>{t("pickup")}</th>
                <th scope="col" className={TH}>{t("city")}</th>
                <th scope="col" className={TH}>{t("scheduled")}</th>
                <th scope="col" className={cn(TABLE_HEADER_CELL_CLASS, "text-end")}>{t("days")}</th>
                <th scope="col" className={TH}>{t("status")}</th>
                <th scope="col" className={cn(TABLE_HEADER_CELL_CLASS, "text-end")}>
                  <span className="sr-only">{t("action")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading && bookings.length === 0 ? (
                <TableSkeletonRows columns={12} rows={8} />
              ) : bookings.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={12}>
                    <EmptyState title={t("noRecords")} description={t("adjustFilters")} />
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const isPending = booking.status === "PENDING";
                  const driver = booking.users_chauffeur_bookings_driver_idTousers;
                  const ft = booking.fulfillment_type;
                  const ftLabels: Record<string, string> = {
                    CORT_MANAGED: tFulfillment("cort"),
                    EXTERNAL_VENDOR: tFulfillment("vendor"),
                    SELF_MANAGED: tFulfillment("pool"),
                  };
                  return (
                    <tr
                      key={booking.id}
                      onClick={() => !isPending && setSelectedBooking(booking)}
                      className={cn("transition-colors hover:bg-row-hover", isPending ? "cursor-default" : "cursor-pointer")}
                    >
                      <td className={cn(TD, "whitespace-nowrap font-medium text-fg")}>#{booking.id}</td>
                      <td className={cn(TD, "whitespace-nowrap text-fg-secondary")}>
                        {booking.service_category || tCommon("misc.standard")}
                      </td>
                      <td className={TD}>
                        <Badge tone="neutral">{ftLabels[ft] ?? ft}</Badge>
                      </td>
                      <td className={cn(TD, "whitespace-nowrap font-medium text-fg")}>{getPassengerName(booking)}</td>
                      <td className={TD}>
                        <div className="flex flex-col">
                          <span className="whitespace-nowrap text-fg">{driver?.full_name || "—"}</span>
                          {driver?.phone && <span className="ltr-content text-xs text-fg-muted">{driver.phone}</span>}
                        </div>
                      </td>
                      <td className={cn(TD, "whitespace-nowrap capitalize text-fg-secondary")}>{humanizeEnum(booking.package_selected)}</td>
                      <td className={TD}>
                        <div className="max-w-[200px] truncate text-fg-secondary" title={booking.pickup_address || tCommon("misc.noAddress")}>
                          {booking.pickup_address || "—"}
                        </div>
                      </td>
                      <td className={cn(TD, "whitespace-nowrap text-fg-secondary")}>{booking.city || "—"}</td>
                      <td className={cn(TD, "whitespace-nowrap")}>
                        <div className="flex flex-col">
                          <span className="text-fg">{formatScheduledDate(booking.scheduled_for)}</span>
                          <span className="text-xs text-fg-muted">{formatScheduledTime(booking.scheduled_for)}</span>
                        </div>
                      </td>
                      <td className={cn(TD, "text-end text-fg")}>{booking.no_of_days || 1}</td>
                      <td className={TD}>
                        <StatusBadge status={booking.status} label={getStatusLabel(booking.status)} overrides={BOOKING_STATUS_TONES} />
                      </td>
                      <td className={cn(TD, "py-2 text-end")}>
                        <IconButton
                          label={tCommon("actions.view")}
                          size="icon-sm"
                          disabled={isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isPending) setSelectedBooking(booking);
                          }}
                        >
                          <ChevronRight className="rtl:rotate-180" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="border-t border-line px-4 sm:px-5">
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => {
                setCurrentPage(page);
                dispatch(setPage(page));
              }}
            />
          </div>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("createNewBooking")}
      >
        <CreateBookingForm
          onSuccess={handleBookingCreated}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <Modal
          isOpen={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          title={t("bookingDetails", { id: selectedBooking.id })}
        >
          <div className="flex flex-col gap-6">
            {/* Status + schedule summary */}
            <dl className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-subtle/40 p-4 sm:grid-cols-2">
              <DetailItem label={t("currentStatus")}>
                <StatusBadge
                  status={selectedBooking.status}
                  label={getStatusLabel(selectedBooking.status)}
                  overrides={BOOKING_STATUS_TONES}
                />
              </DetailItem>
              <DetailItem label={t("scheduledFor")} className="sm:text-end">
                <span className="text-base font-semibold tabular-nums text-fg">
                  {formatScheduledDateTime(selectedBooking.scheduled_for)}
                </span>
              </DetailItem>
            </dl>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <DetailSection title={t("tripDetails")}>
                <dl className="grid grid-cols-2 gap-4">
                  <DetailItem label={t("type")}>
                    <span className="capitalize">{humanizeEnum(selectedBooking.trip_type)}</span>
                  </DetailItem>
                  <DetailItem label={t("category")}>{selectedBooking.service_category || "—"}</DetailItem>
                  <DetailItem label={t("package")}>
                    <span className="capitalize">{humanizeEnum(selectedBooking.package_selected)}</span>
                  </DetailItem>
                  <DetailItem label={t("duration")}>
                    <span className="tabular-nums">{t("daysCount", { count: selectedBooking.no_of_days || 1 })}</span>
                  </DetailItem>
                  <DetailItem label={t("pickupAddress")} className="col-span-2">
                    <span className="flex items-start gap-2 text-fg-secondary">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                      <span className="leading-relaxed">{selectedBooking.pickup_address || "—"}</span>
                    </span>
                  </DetailItem>
                </dl>
              </DetailSection>

              <div className="flex flex-col gap-6">
                <DetailSection title={t("passenger")}>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-semibold text-fg-secondary"
                    >
                      {selectedPassenger?.full_name?.charAt(0) || "P"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {selectedPassenger?.full_name || t("unknownPassenger")}
                      </p>
                      <p className="truncate text-xs text-fg-muted">
                        {selectedPassenger?.email || tCommon("misc.noEmail")}
                      </p>
                    </div>
                  </div>
                </DetailSection>

                {selectedBooking.status !== "PENDING" && (
                  <DetailSection title={t("fleetAssignment")}>
                    <dl className="grid grid-cols-2 gap-4">
                      <DetailItem label={t("chauffeur")}>
                        <span className="block">{selectedDriver?.full_name || t("assigning")}</span>
                        {selectedDriver?.phone && (
                          <span className="ltr-content mt-0.5 block text-xs text-fg-muted">{selectedDriver.phone}</span>
                        )}
                      </DetailItem>
                      <DetailItem label={t("fleetUnit")}>
                        <span className="block">
                          {selectedBooking.vehicles ? selectedBooking.vehicles.model : t("vehiclePending")}
                        </span>
                        {selectedBooking.vehicles?.plate_number && (
                          <span className="mt-0.5 block font-mono text-xs text-fg-muted">
                            {selectedBooking.vehicles.plate_number}
                          </span>
                        )}
                      </DetailItem>
                    </dl>
                  </DetailSection>
                )}
              </div>
            </div>

            {/* Trip Breakdown Table */}
            {selectedBooking.chauffeur_trip_daily_logs && selectedBooking.chauffeur_trip_daily_logs.length > 0 && (
              <DetailSection title={t("tripLogs")}>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-line bg-subtle/50">
                      <tr>
                        <th scope="col" className={TH}>{t("logDate")}</th>
                        <th scope="col" className={TH}>{t("logType")}</th>
                        <th scope="col" className={cn(TABLE_HEADER_CELL_CLASS, "text-end")}>{t("logUsage")}</th>
                        <th scope="col" className={cn(TABLE_HEADER_CELL_CLASS, "text-center")}>{t("fullDay")}</th>
                        <th scope="col" className={cn(TABLE_HEADER_CELL_CLASS, "text-center")}>{t("accommodationShort")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {selectedBooking.chauffeur_trip_daily_logs.map((log, idx) => (
                        <tr key={idx} className="transition-colors hover:bg-row-hover">
                          <td className={cn(TD, "whitespace-nowrap text-fg")}>
                            {formatLocaleDate(log.log_date, locale, { month: "short", day: "numeric", weekday: "short" })}
                          </td>
                          <td className={TD}>
                            <Badge tone="neutral" className="capitalize">
                              {humanizeEnum(log.trip_type)}
                            </Badge>
                          </td>
                          <td className={cn(TD, "whitespace-nowrap text-end text-fg-secondary")}>
                            {log.hours_used ? t("hoursUsed", { count: Number(log.hours_used).toFixed(1) }) : "—"}
                          </td>
                          <td className={cn(TD, "text-center")}>
                            {log.is_full_day ? (
                              <Check className="mx-auto size-4 text-success-ink" aria-label={t("fullDay")} />
                            ) : (
                              <span className="text-fg-muted">—</span>
                            )}
                          </td>
                          <td className={cn(TD, "text-center")}>
                            {log.apply_accommodation ? (
                              <Check className="mx-auto size-4 text-success-ink" aria-label={t("accommodationShort")} />
                            ) : (
                              <span className="text-fg-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DetailSection>
            )}

            <div className="flex justify-end border-t border-line pt-4">
              <Button variant="outline" onClick={() => setSelectedBooking(null)}>
                {t("closeView")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
