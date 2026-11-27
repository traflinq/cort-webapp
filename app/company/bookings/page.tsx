"use client";

import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { fetchBookings, setPage, setFilters, selectBookings, selectPagination, selectBookingsStatus, selectFilters } from "../../lib/store/slices/bookingsSlice";
import { useCompanyAccess } from "../lib/access-context";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatLocaleDate, formatLocaleNumber, formatLocaleTime } from "@/app/lib/i18n/format";
import type { Locale } from "@/i18n/config";
import Modal from "./components/Modal";
import CreateBookingForm from "./components/CreateBookingForm";
import { ChauffeurBooking } from "../../lib/services/api-client";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
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
import { DetailRow, DetailRows, DetailSection, DetailSections, FactRow, NotRecorded, RouteSteps, useDurationFormat } from "../components/DetailView";

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

/** "HOURS_10" → "hours 10" (rendered with CSS capitalize). */
const humanizeEnum = (value: string | null | undefined) => (value ?? "").replace(/_/g, " ").toLowerCase();

export default function BookingsPage() {
  const t = useTranslations("company.bookings");
  const tStatus = useTranslations("common.status");
  const tFulfillment = useTranslations("common.fulfillment");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const tDetail = useTranslations("company.detail");
  const duration = useDurationFormat();
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

  const fulfillmentLabel = (type: string | null | undefined) =>
    type === "EXTERNAL_VENDOR" ? tFulfillment("vendorManaged") : type === "SELF_MANAGED" ? tFulfillment("ownPoolCars") : tFulfillment("cortManaged");
  const PACKAGE_KEYS: Record<string, "hours5" | "hours10" | "hours24"> = { HOURS_5: "hours5", HOURS_10: "hours10", HOURS_24: "hours24" };
  const packageLabel = (pkg: string | null | undefined) => (pkg && PACKAGE_KEYS[pkg] ? t(PACKAGE_KEYS[pkg]) : humanizeEnum(pkg) || "—");
  const tripTypeLabel = (type: string | null | undefined) =>
    type === "OUT_STATION" ? t("outStation") : type === "IN_CITY" ? t("inCity") : humanizeEnum(type) || "—";

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
                      <td className={cn(TD, "whitespace-nowrap text-fg-secondary")}>{packageLabel(booking.package_selected)}</td>
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
          title={t("bookingTitle", { id: selectedBooking.id })}
          titleAside={
            <StatusBadge
              status={selectedBooking.status}
              label={getStatusLabel(selectedBooking.status)}
              overrides={BOOKING_STATUS_TONES}
            />
          }
          description={[
            selectedBooking.scheduled_for ? t("scheduledForValue", { date: formatScheduledDateTime(selectedBooking.scheduled_for) }) : null,
            selectedBooking.city,
          ].filter(Boolean).join(" · ")}
        >
          <DetailSections>
            <DetailSection>
              <FactRow
                items={[
                  { label: t("service"), value: fulfillmentLabel(selectedBooking.fulfillment_type) },
                  { label: t("package"), value: packageLabel(selectedBooking.package_selected) },
                  { label: t("tripType"), value: tripTypeLabel(selectedBooking.trip_type) },
                  { label: t("days"), value: formatLocaleNumber(selectedBooking.no_of_days || 1, locale) },
                ]}
              />
            </DetailSection>

            <DetailSection title={t("route")}>
              <RouteSteps
                steps={[
                  { label: tDetail("pickup"), place: selectedBooking.pickup_address || <NotRecorded /> },
                  ...(selectedBooking.destination_cities ?? []).map((city) => ({ label: t("destination"), place: city })),
                ]}
              />
            </DetailSection>

            <DetailSection>
              <DetailRows>
                <DetailRow label={t("passenger")} hint={selectedPassenger?.email || undefined}>
                  {selectedPassenger?.full_name || t("unknownPassenger")}
                </DetailRow>
                <DetailRow
                  label={t("driver")}
                  hint={selectedDriver?.phone ? <span className="ltr-content tabular-nums">{selectedDriver.phone}</span> : undefined}
                >
                  {selectedDriver?.full_name || <span className="text-fg-muted">{t("notAssignedYet")}</span>}
                </DetailRow>
                <DetailRow
                  label={t("vehicle")}
                  hint={selectedBooking.vehicles?.plate_number ? <span className="ltr-content tabular-nums">{selectedBooking.vehicles.plate_number}</span> : undefined}
                >
                  {selectedBooking.vehicles?.model || <span className="text-fg-muted">{t("notAssignedYet")}</span>}
                </DetailRow>
              </DetailRows>
            </DetailSection>

            {selectedBooking.chauffeur_trip_daily_logs && selectedBooking.chauffeur_trip_daily_logs.length > 0 && (
              <DetailSection title={t("dailyLog")}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="pb-2 text-start text-xs font-medium text-fg-muted">{t("logDate")}</th>
                      <th scope="col" className="pb-2 text-start text-xs font-medium text-fg-muted">{t("logType")}</th>
                      <th scope="col" className="pb-2 text-end text-xs font-medium text-fg-muted">{t("timeUsed")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {selectedBooking.chauffeur_trip_daily_logs.map((log, idx) => (
                      <tr key={idx}>
                        <td className="whitespace-nowrap py-2.5 pe-3 text-fg tabular-nums">
                          {formatLocaleDate(log.log_date, locale, { month: "short", day: "numeric", weekday: "short" })}
                        </td>
                        <td className="py-2.5 pe-3 text-fg-secondary">
                          <span className="flex flex-wrap items-center gap-1.5">
                            {tripTypeLabel(log.trip_type)}
                            {log.apply_accommodation && <Badge tone="neutral">{t("accommodation")}</Badge>}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-2.5 text-end text-fg tabular-nums">
                          {log.is_full_day ? (
                            <Badge tone="neutral">{t("fullDay")}</Badge>
                          ) : log.hours_used ? (
                            duration(Number(log.hours_used) * 60)
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DetailSection>
            )}
          </DetailSections>
        </Modal>
      )}
    </div>
  );
}
