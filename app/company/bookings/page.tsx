"use client";

import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { fetchBookings, setPage, setFilters, selectBookings, selectPagination, selectBookingsStatus, selectFilters } from "../../lib/store/slices/bookingsSlice";
import { selectCompany } from "../../lib/store/slices/companySlice";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatLocaleDate, formatLocaleTime } from "@/app/lib/i18n/format";
import type { Locale } from "@/i18n/config";
import Modal from "./components/Modal";
import CreateBookingForm from "./components/CreateBookingForm";
import { ChauffeurBooking } from "../../lib/services/api-client";
import { useSearchParams, useRouter } from "next/navigation";
import { Card } from "../components/DashboardComponents";
import { PageHeader, TableEmptyState, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS, TABLE_PAGINATION_WRAPPER_CLASS } from "../components/PageLayout";
import TableSkeleton from "@/app/components/ui/TableSkeleton";
import TablePageSkeleton from "../components/TablePageSkeleton";
import Pagination from "../../components/ui/Pagination";
import { IconCircleButton, IllustrationTile, PillButton } from "../ui";
import { ArrowRight, Plus } from "lucide-react";

const BOOKING_STATUS_KEYS: Record<string, "pending" | "assigned" | "arrived" | "inProgress" | "completed" | "cancelled"> = {
  PENDING: "pending",
  ASSIGNED: "assigned",
  ARRIVED: "arrived",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export default function BookingsPage() {
  const t = useTranslations("company.bookings");
  const tStatus = useTranslations("common.status");
  const tFulfillment = useTranslations("common.fulfillment");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const dispatch = useAppDispatch();
  const company = useAppSelector(selectCompany);
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

  if (!company) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-[var(--text-muted)]">{tCommon("errors.noCompanySelected")}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      <PageHeader
        label={t("label")}
        title={t("title")}
        action={
          company.services_enabled.chauffeur_enabled ? (
            <PillButton icon={<Plus strokeWidth={2.2} />} onClick={() => setIsModalOpen(true)}>
              {tCommon("actions.newBooking")}
            </PillButton>
          ) : undefined
        }
      />

      <Card className={`min-h-[600px] ${TABLE_CARD_CLASS}`}>
        {/* Filters */}
        <div className={`flex flex-wrap gap-3 ${TABLE_TOP_BAR_CLASS}`}>
          <div className="flex-1 min-w-[240px]">
            <div className="group relative">
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                className="w-full h-11 ps-11 pe-4 rounded-full border border-[var(--border-input)] bg-[var(--tile-bg)] text-sm focus:outline-none focus:ring-4 focus:ring-[var(--cort-orange)]/10 focus:border-[var(--cort-orange)] transition-colors placeholder:text-[var(--text-muted)] text-[var(--text-primary)] font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <svg className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--cort-orange)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="w-full sm:w-[220px]">
            <div className="group relative">
              <select
                className="w-full h-11 ps-10 pe-10 rounded-full border border-[var(--border-input)] bg-[var(--tile-bg)] text-sm focus:outline-none focus:ring-4 focus:ring-[var(--cort-orange)]/10 focus:border-[var(--cort-orange)] transition-colors appearance-none text-[var(--text-primary)] font-medium cursor-pointer"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">{t("allStatuses")}</option>
                <option value="PENDING">{tStatus("pending")}</option>
                <option value="ASSIGNED">{tStatus("assigned")}</option>
                <option value="ARRIVED">{tStatus("arrived")}</option>
                <option value="IN_PROGRESS">{tStatus("inProgress")}</option>
                <option value="COMPLETED">{tStatus("completed")}</option>
                <option value="CANCELLED">{tStatus("cancelled")}</option>
              </select>
              <svg className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--cort-orange)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" />
              </svg>
              <svg className="absolute end-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="w-full sm:w-[200px]">
            <div className="group relative">
              <select
                className="w-full h-11 ps-10 pe-10 rounded-full border border-[var(--border-input)] bg-[var(--tile-bg)] text-sm focus:outline-none focus:ring-4 focus:ring-[var(--cort-orange)]/10 focus:border-[var(--cort-orange)] transition-colors appearance-none text-[var(--text-primary)] font-medium cursor-pointer"
                value={fulfillmentFilter}
                onChange={(e) => setFulfillmentFilter(e.target.value)}
              >
                <option value="">{t("allTypes")}</option>
                <option value="CORT_MANAGED">{tFulfillment("cortManaged")}</option>
                <option value="EXTERNAL_VENDOR">{tFulfillment("vendorManaged")}</option>
                <option value="SELF_MANAGED">{tFulfillment("ownPoolCars")}</option>
              </select>
              <svg className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--cort-orange)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
              <svg className="absolute end-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-start">
            <thead>
              <tr className="border-b border-[var(--divider)] text-[var(--text-muted)] text-[13px]">
                <th className="px-4 py-4 font-normal whitespace-nowrap text-start">{t("id")}</th>
                <th className="px-4 py-4 font-normal whitespace-nowrap text-start">{t("service")}</th>
                <th className="px-4 py-4 font-normal whitespace-nowrap text-start">{t("fulfillment")}</th>
                <th className="px-4 py-4 font-normal whitespace-nowrap text-start">{t("passenger")}</th>
                <th className="px-4 py-4 font-normal whitespace-nowrap text-start">{t("driver")}</th>
                <th className="px-4 py-4 font-normal whitespace-nowrap text-start">{t("package")}</th>
                <th className="px-4 py-4 font-normal whitespace-nowrap text-start">{t("pickup")}</th>
                <th className="px-4 py-4 font-normal whitespace-nowrap text-start">{t("city")}</th>
                <th className="px-4 py-4 font-normal whitespace-nowrap text-start">{t("scheduled")}</th>
                <th className="px-4 py-4 font-normal whitespace-nowrap text-center">{t("days")}</th>
                <th className="px-4 py-4 font-normal whitespace-nowrap text-start">{t("status")}</th>
                <th className="px-4 py-4 font-normal whitespace-nowrap text-end">{t("action")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && bookings.length === 0 ? (
                <TableSkeleton columns={10} rows={8} />
              ) : bookings.length === 0 && !isLoading ? (
                <TableEmptyState illustration="calendar" message={t("noRecords")} description={t("adjustFilters")} />
              ) : (
                bookings.map((booking) => {
                  const isPending = booking.status === "PENDING";
                  return (
                    <tr
                      key={booking.id}
                      onClick={() => !isPending && setSelectedBooking(booking)}
                      className={`group border-b border-[var(--divider)] last:border-b-0 transition-colors hover:bg-[var(--row-hover)] ${isPending ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <td className="px-4 py-4 font-medium text-[var(--text-primary)]">#{booking.id}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-2.5 text-[var(--text-primary)] text-xs">
                          <IllustrationTile
                            name={/chauffeur/i.test(booking.service_category ?? "") ? "car" : "taxi"}
                            size="sm"
                          />
                          <span className="max-w-[7rem] leading-tight">{booking.service_category || tCommon("misc.standard")}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {(() => {
                          const ft = booking.fulfillment_type;
                          const ftStyles: Record<string, string> = {
                            CORT_MANAGED: "bg-[var(--tone-info-soft)] text-[var(--tone-info-ink)]",
                            EXTERNAL_VENDOR: "bg-[var(--tone-brand-soft)] text-[var(--tone-brand-ink)]",
                            SELF_MANAGED: "bg-[var(--tone-purple-soft)] text-[var(--tone-purple-ink)]",
                          };
                          const ftLabels: Record<string, string> = {
                            CORT_MANAGED: tFulfillment("cort"),
                            EXTERNAL_VENDOR: tFulfillment("vendor"),
                            SELF_MANAGED: tFulfillment("pool"),
                          };
                          return (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${ftStyles[ft] ?? "bg-[var(--tone-neutral-soft)] text-[var(--tone-neutral-ink)]"}`}>
                              {ftLabels[ft] ?? ft}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4 font-medium text-[var(--text-primary)]">
                        {getPassengerName(booking)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--text-primary)] text-xs">{booking.users_chauffeur_bookings_driver_idTousers?.full_name || "—"}</span>
                          {booking.users_chauffeur_bookings_driver_idTousers?.phone && (
                            <span className="text-xs text-[var(--text-muted)] font-medium">{booking.users_chauffeur_bookings_driver_idTousers.phone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[var(--text-muted)] capitalize font-medium">{booking.package_selected.replace(/_/g, " ")}</td>
                      <td className="px-4 py-4">
                        <div className="max-w-[180px] truncate text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" title={booking.pickup_address || tCommon("misc.noAddress")}>
                          {booking.pickup_address || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[var(--text-primary)] font-medium">
                        {booking.city || "—"}
                      </td>
                      <td className="px-4 py-4 text-[var(--text-primary)] font-medium">
                        <div className="flex flex-col">
                           <span className="font-medium">{formatScheduledDate(booking.scheduled_for)}</span>
                           <span className="text-xs text-[var(--text-muted)]">{formatScheduledTime(booking.scheduled_for)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[var(--text-primary)] font-medium text-center">
                        <span className="inline-flex min-w-7 justify-center rounded-full bg-[var(--tile-bg)] px-2 py-1 tabular-nums">{booking.no_of_days || 1}</span>
                      </td>
                      <td className="px-4 py-4">
                        {(() => {
                          const statusStyles: Record<string, { bg: string, text: string, border: string, dot: string }> = {
                            PENDING: { bg: "bg-[var(--tone-warning-soft)]", text: "text-[var(--tone-warning-ink)]", border: "border-transparent", dot: "bg-[var(--accent-warning)]" },
                            ASSIGNED: { bg: "bg-[var(--tone-info-soft)]", text: "text-[var(--tone-info-ink)]", border: "border-transparent", dot: "bg-[var(--accent-info)]" },
                            ARRIVED: { bg: "bg-[var(--tone-purple-soft)]", text: "text-[var(--tone-purple-ink)]", border: "border-transparent", dot: "bg-[var(--tone-purple-solid)]" },
                            IN_PROGRESS: { bg: "bg-[var(--tone-brand-soft)]", text: "text-[var(--tone-brand-ink)]", border: "border-transparent", dot: "bg-[var(--cort-orange)]" },
                            COMPLETED: { bg: "bg-[var(--tone-success-soft)]", text: "text-[var(--tone-success-ink)]", border: "border-transparent", dot: "bg-[var(--accent-success)]" },
                            CANCELLED: { bg: "bg-[var(--tone-danger-soft)]", text: "text-[var(--tone-danger-ink)]", border: "border-transparent", dot: "bg-[var(--accent-danger)]" },
                          };
                          const style = statusStyles[booking.status] || { bg: "bg-[var(--tone-neutral-soft)]", text: "text-[var(--tone-neutral-ink)]", border: "border-transparent", dot: "bg-[var(--text-muted)]" };

                          return (
                            <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full me-2 ${style.dot}`}></span>
                              {getStatusLabel(booking.status)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4 text-end">
                        <IconCircleButton
                          label={t("bookingDetails", { id: booking.id })}
                          variant={isPending ? "ghost" : "outline"}
                          size="sm"
                          disabled={isPending}
                          className="group-hover:bg-[var(--cort-navy)] group-hover:text-white group-hover:border-transparent"
                        >
                          <ArrowRight className="rtl-flip" strokeWidth={1.8} />
                        </IconCircleButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className={TABLE_PAGINATION_WRAPPER_CLASS}>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => {
              setCurrentPage(page);
              dispatch(setPage(page));
            }}
          />
        </div>
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
      {
        selectedBooking && (
          <Modal
            isOpen={!!selectedBooking}
            onClose={() => setSelectedBooking(null)}
            title={t("bookingDetails", { id: selectedBooking.id })}
          >
            <div className="flex flex-col gap-8 relative pb-4">
              {/* Status Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--cort-navy)] p-6 rounded-[var(--radius-card)] text-white relative overflow-hidden group">
                <div className="absolute top-0 end-0 w-32 h-32 bg-white/5 rounded-full -me-16 -mt-16" />
                <div className="relative z-10">
                  <div className="text-xs text-white/60 mb-2">{t("currentStatus")}</div>
                  <div className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium border backdrop-blur-md ${selectedBooking.status === 'PENDING' ? "bg-amber-500/10 text-amber-300 border-amber-500/30" :
 selectedBooking.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" :
 selectedBooking.status === 'CANCELLED' ? "bg-rose-500/10 text-rose-300 border-rose-500/30" :
 "bg-blue-500/10 text-blue-300 border-blue-500/30"
 }`}>
                    <span className={`w-2 h-2 rounded-full me-2.5 ${selectedBooking.status === 'PENDING' ? "bg-amber-400" :
 selectedBooking.status === 'COMPLETED' ? "bg-emerald-400" :
 selectedBooking.status === 'CANCELLED' ? "bg-rose-400" :
 "bg-blue-400"
 }`}></span>
                    {getStatusLabel(selectedBooking.status)}
                  </div>
                </div>
                <div className="text-end relative z-10">
                  <div className="text-xs text-white/60 mb-2">{t("scheduledFor")}</div>
                  <div className="text-xl font-medium text-white">{formatScheduledDateTime(selectedBooking.scheduled_for)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Trip Details Section */}
                <div className="space-y-4">
                  <h4 className="text-[15px] font-medium text-[var(--text-primary)] flex items-center gap-2 px-1">
                    <span className="w-1.5 h-1.5 bg-[var(--cort-orange)] rounded-full"></span> {t("tripDetails")}
                  </h4>
                  <div className="p-5 rounded-[20px] bg-[var(--tile-bg)] space-y-5">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                       <div>
                          <div className="text-[11px] text-[var(--text-muted)] font-medium mb-1">{t("type")}</div>
                          <div className="font-medium text-[var(--text-primary)] capitalize">{selectedBooking.trip_type.replace(/_/g, " ")}</div>
                       </div>
                       <div>
                          <div className="text-[11px] text-[var(--text-muted)] font-medium mb-1">{t("category")}</div>
                          <div className="font-medium text-[var(--text-primary)]">{selectedBooking.service_category || "—"}</div>
                       </div>
                       <div>
                          <div className="text-[11px] text-[var(--text-muted)] font-medium mb-1">{t("package")}</div>
                          <div className="font-medium text-[var(--text-primary)] capitalize">{selectedBooking.package_selected.replace(/_/g, " ")}</div>
                       </div>
                       <div>
                          <div className="text-[11px] text-[var(--text-muted)] font-medium mb-1">{t("duration")}</div>
                          <div className="font-medium text-[var(--text-primary)]">{t("daysCount", { count: selectedBooking.no_of_days || 1 })}</div>
                       </div>
                    </div>
                    <div className="pt-4 border-t border-[var(--border-default)]">
                      <div className="text-[11px] text-[var(--text-muted)] font-medium mb-2">{t("pickupAddress")}</div>
                      <div className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)] bg-[var(--bg-card)] p-4 rounded-2xl">
                        <svg className="w-4 h-4 text-[var(--cort-orange)] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="leading-relaxed">{selectedBooking.pickup_address || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Passenger & Assignment Section */}
                <div className="space-y-6">
                  {/* Passenger */}
                  <div>
                    <h4 className="text-[15px] font-medium text-[var(--text-primary)] flex items-center gap-2 px-1 mb-4">
                      <span className="w-1.5 h-1.5 bg-[var(--cort-orange)] rounded-full"></span> {t("passenger")}
                    </h4>
                    <div className="flex items-center gap-4 p-4 rounded-[20px] bg-[var(--tile-bg)]">
                      <div className="w-12 h-12 rounded-full bg-[var(--tone-brand-soft)] flex items-center justify-center text-[var(--cort-orange)] font-medium text-lg">
                        {selectedBooking.users_chauffeur_bookings_passenger_idTousers?.full_name?.charAt(0) || "P"}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">{selectedBooking.users_chauffeur_bookings_passenger_idTousers?.full_name || t("unknownPassenger")}</div>
                        <div className="text-xs text-[var(--text-muted)] font-medium mt-0.5">{selectedBooking.users_chauffeur_bookings_passenger_idTousers?.email || tCommon("misc.noEmail")}</div>
                      </div>
                    </div>
                  </div>

                  {/* Assignment */}
                  {selectedBooking.status !== 'PENDING' && (
                    <div className="space-y-4">
                      <h4 className="text-[15px] font-medium text-[var(--text-primary)] flex items-center gap-2 px-1 mb-4">
                        <span className="w-1.5 h-1.5 bg-[var(--cort-orange)] rounded-full"></span> {t("fleetAssignment")}
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        {/* Driver & Vehicle combined or separate cards */}
                        <div className="p-4 rounded-[20px] bg-[var(--tile-bg)] flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-muted)]">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                           </div>
                           <div className="flex-1">
                              <div className="text-[11px] text-[var(--text-muted)]">{t("chauffeur")}</div>
                              <div className="text-xs font-medium text-[var(--text-primary)]">{selectedBooking.users_chauffeur_bookings_driver_idTousers?.full_name || t("assigning")}</div>
                              {selectedBooking.users_chauffeur_bookings_driver_idTousers?.phone && (
                                <div className="text-[11px] text-[var(--text-muted)] font-medium mt-0.5">{selectedBooking.users_chauffeur_bookings_driver_idTousers.phone}</div>
                              )}
                           </div>
                           <div className="w-px h-8 bg-[var(--divider)]" />
                           <div className="flex-1 ps-2">
                              <div className="text-[11px] text-[var(--text-muted)]">{t("fleetUnit")}</div>
                              <div className="text-xs font-medium text-[var(--text-primary)]">{selectedBooking.vehicles ? selectedBooking.vehicles.model : t("vehiclePending")}</div>
                              {selectedBooking.vehicles?.plate_number && <div className="text-[11px] font-mono text-[var(--cort-orange)] font-medium">{selectedBooking.vehicles.plate_number}</div>}
                           </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Trip Breakdown Table */}
              {selectedBooking.chauffeur_trip_daily_logs && selectedBooking.chauffeur_trip_daily_logs.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[15px] font-medium text-[var(--text-primary)] flex items-center gap-2 px-1">
                    <span className="w-1.5 h-1.5 bg-[var(--cort-orange)] rounded-full"></span> {t("tripLogs")}
                  </h4>
                  <div className="rounded-[20px] border border-[var(--divider)] overflow-hidden">
                    <table className="w-full text-xs text-start">
                      <thead className="bg-[var(--tile-bg)] text-[var(--text-muted)]">
                        <tr>
                          <th className="px-5 py-3">{t("logDate")}</th>
                          <th className="px-5 py-3">{t("logType")}</th>
                          <th className="px-5 py-3">{t("logUsage")}</th>
                          <th className="px-5 py-3 text-center">{t("fullDay")}</th>
                          <th className="px-5 py-3 text-center">{t("accommodationShort")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--divider)]">
                        {selectedBooking.chauffeur_trip_daily_logs.map((log, idx) => (
                          <tr key={idx} className="hover:bg-[var(--bg-subtle)] transition-colors">
                            <td className="px-5 py-3.5 font-medium text-[var(--text-primary)]">
                              {formatLocaleDate(log.log_date, locale, { month: 'short', day: 'numeric', weekday: 'short' })}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${log.trip_type === 'OUT_STATION' ? 'bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)]' : 'bg-[var(--tone-info-soft)] text-[var(--tone-info-ink)]'}`}>
                                {log.trip_type.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-medium text-[var(--text-secondary)]">{log.hours_used ? t("hoursUsed", { count: Number(log.hours_used).toFixed(1) }) : '-'}</td>
                            <td className="px-5 py-3.5 text-center">
                              {log.is_full_day ? (
                                <div className="w-5 h-5 bg-[var(--tone-success-soft)] rounded-full flex items-center justify-center mx-auto">
                                  <svg className="w-3 h-3 text-[var(--tone-success-ink)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                              ) : (
                                <span className="text-[var(--text-placeholder)]">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {log.apply_accommodation ? (
                                <div className="w-5 h-5 bg-[var(--tone-success-soft)] rounded-full flex items-center justify-center mx-auto">
                                  <svg className="w-3 h-3 text-[var(--tone-success-ink)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                              ) : (
                                <span className="text-[var(--text-placeholder)]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-5 border-t border-[var(--divider)]">
                <PillButton variant="outline" onClick={() => setSelectedBooking(null)}>
                  {t("closeView")}
                </PillButton>
              </div>
            </div>
          </Modal>
        )
      }
    </div>
  );
}
