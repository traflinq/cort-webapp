"use client";

import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { fetchBookings, setPage, setFilters, selectBookings, selectPagination, selectBookingsStatus, selectFilters } from "../../lib/store/slices/bookingsSlice";
import { selectCompany } from "../../lib/store/slices/companySlice";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatLocaleDate, formatLocaleTime } from "@/app/lib/i18n/format";
import type { Locale } from "@/i18n/config";
import Modal, { ModalTrigger } from "./components/Modal";
import CreateBookingForm from "./components/CreateBookingForm";
import { ChauffeurBooking } from "../../lib/services/api-client";
import { useSearchParams, useRouter } from "next/navigation";
import { Card } from "../components/DashboardComponents";
import { PageHeader, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS, TABLE_PAGINATION_WRAPPER_CLASS } from "../components/PageLayout";
import TableSkeleton from "@/app/components/ui/TableSkeleton";
import TablePageSkeleton from "../components/TablePageSkeleton";
import Pagination from "../../components/ui/Pagination";

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
            isModalOpen ? (
              <span className="invisible pointer-events-none inline-flex items-center justify-center bg-[#f47f00] px-5 py-2.5 rounded-xl text-sm font-bold">
                {tCommon("actions.newBooking")}
              </span>
            ) : (
            <ModalTrigger
              layoutId="company-bookings-create"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-[#f47f00] text-white px-5 py-2.5 rounded-xl text-sm font-bold"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>{tCommon("actions.newBooking")}</span>
            </ModalTrigger>
            )
          ) : undefined
        }
      />

      <Card className={`min-h-[600px] border border-[var(--border-light)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${TABLE_CARD_CLASS}`}>
        {/* Filters */}
        <div className={`flex flex-wrap gap-5 p-5 ${TABLE_TOP_BAR_CLASS}`}>
          <div className="flex-1 min-w-[300px]">
            <div className="group relative">
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                className="w-full h-12 ps-11 pe-4 rounded-xl border border-[var(--border-light)] bg-[var(--surface-subtle)]/30 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--cort-orange)]/10 focus:border-[var(--cort-orange)] transition-all placeholder:text-[var(--text-muted)] text-[var(--text-primary)] font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <svg className="absolute start-4 top-4 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--cort-orange)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="w-[220px]">
            <div className="group relative">
              <select
                className="w-full h-12 ps-10 pe-10 rounded-xl border border-[var(--border-light)] bg-[var(--surface-subtle)]/30 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--cort-orange)]/10 focus:border-[var(--cort-orange)] transition-all appearance-none text-[var(--text-primary)] font-bold cursor-pointer"
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
              <svg className="absolute start-3.5 top-4 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--cort-orange)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" />
              </svg>
              <svg className="absolute end-3.5 top-4 w-4 h-4 text-[var(--text-muted)] pointer-events-none group-focus-within:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="w-[200px]">
            <div className="group relative">
              <select
                className="w-full h-12 ps-10 pe-10 rounded-xl border border-[var(--border-light)] bg-[var(--surface-subtle)]/30 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--cort-orange)]/10 focus:border-[var(--cort-orange)] transition-all appearance-none text-[var(--cort-navy)] font-bold cursor-pointer"
                value={fulfillmentFilter}
                onChange={(e) => setFulfillmentFilter(e.target.value)}
              >
                <option value="">{t("allTypes")}</option>
                <option value="CORT_MANAGED">{tFulfillment("cortManaged")}</option>
                <option value="EXTERNAL_VENDOR">{tFulfillment("vendorManaged")}</option>
                <option value="SELF_MANAGED">{tFulfillment("ownPoolCars")}</option>
              </select>
              <svg className="absolute start-3.5 top-4 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--cort-orange)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
              <svg className="absolute end-3.5 top-4 w-4 h-4 text-[var(--text-muted)] pointer-events-none group-focus-within:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto px-1">
          <table className="min-w-full text-sm text-start border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[var(--text-muted)] uppercase text-[10px] font-bold tracking-widest">
                <th className="px-6 py-4">{t("id")}</th>
                <th className="px-6 py-4">{t("service")}</th>
                <th className="px-6 py-4">{t("fulfillment")}</th>
                <th className="px-6 py-4">{t("passenger")}</th>
                <th className="px-6 py-4">{t("driver")}</th>
                <th className="px-6 py-4">{t("package")}</th>
                <th className="px-6 py-4">{t("pickup")}</th>
                <th className="px-6 py-4">{t("city")}</th>
                <th className="px-6 py-4">{t("scheduled")}</th>
                <th className="px-6 py-4 text-center">{t("days")}</th>
                <th className="px-6 py-4">{t("status")}</th>
                <th className="px-6 py-4 text-end">{t("action")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && bookings.length === 0 ? (
                <TableSkeleton columns={10} rows={8} />
              ) : bookings.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
                      <div className="bg-[var(--surface-subtle)]/50 p-6 rounded-3xl mb-4 shadow-inner">
                        <svg className="w-10 h-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <span className="font-bold text-lg text-[var(--text-primary)]">{t("noRecords")}</span>
                      <span className="text-sm mt-1">{t("adjustFilters")}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const isPending = booking.status === "PENDING";
                  return (
                    <tr
                      key={booking.id}
                      onClick={() => !isPending && setSelectedBooking(booking)}
                      className={`group transition-all duration-300 bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-[var(--cort-orange)]/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 rounded-2xl ${isPending ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <td className="px-6 py-5 first:rounded-s-2xl font-bold text-[var(--text-primary)]">#{booking.id}</td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-primary)] text-[10px] font-bold border border-[var(--border-input)] uppercase tracking-tight">
                          {booking.service_category || tCommon("misc.standard")}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {(() => {
                          const ft = booking.fulfillment_type;
                          const ftStyles: Record<string, string> = {
                            CORT_MANAGED: "bg-blue-50 text-blue-700 border-blue-200",
                            EXTERNAL_VENDOR: "bg-orange-50 text-orange-700 border-orange-200",
                            SELF_MANAGED: "bg-purple-50 text-purple-700 border-purple-200",
                          };
                          const ftLabels: Record<string, string> = {
                            CORT_MANAGED: tFulfillment("cort"),
                            EXTERNAL_VENDOR: tFulfillment("vendor"),
                            SELF_MANAGED: tFulfillment("pool"),
                          };
                          return (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-tight ${ftStyles[ft] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                              {ftLabels[ft] ?? ft}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-5 font-bold text-[var(--cort-navy)]">
                        {getPassengerName(booking)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-[var(--text-primary)] text-xs">{booking.users_chauffeur_bookings_driver_idTousers?.full_name || "—"}</span>
                          {booking.users_chauffeur_bookings_driver_idTousers?.phone && (
                            <span className="text-[10px] text-[var(--text-muted)] font-medium">{booking.users_chauffeur_bookings_driver_idTousers.phone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-[var(--text-muted)] capitalize font-medium">{booking.package_selected.replace(/_/g, " ")}</td>
                      <td className="px-6 py-5">
                        <div className="max-w-[180px] truncate text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" title={booking.pickup_address || tCommon("misc.noAddress")}>
                          {booking.pickup_address || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-[var(--text-primary)] font-bold">
                        {booking.city || "—"}
                      </td>
                      <td className="px-6 py-5 text-[var(--text-primary)] font-medium">
                        <div className="flex flex-col">
                           <span className="font-bold">{formatScheduledDate(booking.scheduled_for)}</span>
                           <span className="text-[10px] text-[var(--text-muted)]">{formatScheduledTime(booking.scheduled_for)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-[var(--text-primary)] font-bold text-center">
                        <span className="bg-[var(--bg-subtle)] px-2 py-1 rounded-md">{booking.no_of_days || 1}</span>
                      </td>
                      <td className="px-6 py-5">
                        {(() => {
                          const statusStyles: Record<string, { bg: string, text: string, border: string, dot: string }> = {
                            PENDING: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-200/50", dot: "bg-amber-500" },
                            ASSIGNED: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-200/50", dot: "bg-blue-500" },
                            ARRIVED: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-200/50", dot: "bg-purple-500" },
                            IN_PROGRESS: { bg: "bg-indigo-500/10", text: "text-indigo-600", border: "border-indigo-200/50", dot: "bg-indigo-500" },
                            COMPLETED: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-200/50", dot: "bg-emerald-500" },
                            CANCELLED: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-200/50", dot: "bg-rose-500" },
                          };
                          const style = statusStyles[booking.status] || { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20", dot: "bg-slate-500" };

                          return (
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black border ${style.bg} ${style.text} ${style.border} uppercase tracking-widest`}>
                              <span className={`w-1.5 h-1.5 rounded-full me-2 ${style.dot} animate-pulse`}></span>
                              {getStatusLabel(booking.status)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-5 text-end last:rounded-e-2xl">
                        <button
                          disabled={isPending}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isPending ? "text-[var(--text-muted)]/20 cursor-default" : "text-[var(--cort-orange)] bg-[var(--cort-orange)]/5 hover:bg-[var(--cort-orange)] hover:text-[var(--text-primary)] hover:shadow-lg hover:shadow-[var(--cort-orange)]/20 active:scale-95"}`}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </button>
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
        layoutId="company-bookings-create"
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
              <div className="flex items-center justify-between bg-gradient-to-br from-[var(--cort-navy)] to-[#0c1a45] p-6 rounded-[2rem] text-[var(--text-primary)] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 end-0 w-32 h-32 bg-white/5 rounded-full -me-16 -mt-16 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em] font-black mb-2">{t("currentStatus")}</div>
                  <div className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-black border backdrop-blur-md ${selectedBooking.status === 'PENDING' ? "bg-amber-500/10 text-amber-300 border-amber-500/30" :
                    selectedBooking.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" :
                      selectedBooking.status === 'CANCELLED' ? "bg-rose-500/10 text-rose-300 border-rose-500/30" :
                        "bg-blue-500/10 text-blue-300 border-blue-500/30"
                    }`}>
                    <span className={`w-2 h-2 rounded-full me-2.5 ${selectedBooking.status === 'PENDING' ? "bg-amber-400" :
                      selectedBooking.status === 'COMPLETED' ? "bg-emerald-400" :
                        selectedBooking.status === 'CANCELLED' ? "bg-rose-400" :
                          "bg-blue-400"
                      } animate-pulse`}></span>
                    {getStatusLabel(selectedBooking.status)}
                  </div>
                </div>
                <div className="text-end relative z-10">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em] font-black mb-2">{t("scheduledFor")}</div>
                  <div className="text-xl font-black text-[var(--text-primary)] tracking-tighter">{formatScheduledDateTime(selectedBooking.scheduled_for)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Trip Details Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                    <span className="w-1.5 h-1.5 bg-[var(--cort-orange)] rounded-full"></span> {t("tripDetails")}
                  </h4>
                  <div className="bg-[var(--bg-card)] backdrop-blur-sm p-6 rounded-[1.5rem] border border-[var(--border-default)] space-y-5">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                       <div>
                          <div className="text-[9px] text-[var(--text-muted)] font-black uppercase mb-1">{t("type")}</div>
                          <div className="font-bold text-[var(--text-primary)] capitalize">{selectedBooking.trip_type.replace(/_/g, " ")}</div>
                       </div>
                       <div>
                          <div className="text-[9px] text-[var(--text-muted)] font-black uppercase mb-1">{t("category")}</div>
                          <div className="font-bold text-[var(--text-primary)]">{selectedBooking.service_category || "—"}</div>
                       </div>
                       <div>
                          <div className="text-[9px] text-[var(--text-muted)] font-black uppercase mb-1">{t("package")}</div>
                          <div className="font-bold text-[var(--text-primary)] capitalize">{selectedBooking.package_selected.replace(/_/g, " ")}</div>
                       </div>
                       <div>
                          <div className="text-[9px] text-[var(--text-muted)] font-black uppercase mb-1">{t("duration")}</div>
                          <div className="font-bold text-[var(--text-primary)]">{t("daysCount", { count: selectedBooking.no_of_days || 1 })}</div>
                       </div>
                    </div>
                    <div className="pt-4 border-t border-[var(--border-default)]">
                      <div className="text-[9px] text-[var(--text-muted)] font-black uppercase mb-2">{t("pickupAddress")}</div>
                      <div className="flex items-start gap-2.5 text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-subtle)] p-4 rounded-xl border border-[var(--border-default)]">
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
                    <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] flex items-center gap-2 px-1 mb-4">
                      <span className="w-1.5 h-1.5 bg-[var(--cort-orange)] rounded-full"></span> {t("passenger")}
                    </h4>
                    <div className="flex items-center gap-4 bg-[var(--bg-card)] p-4 rounded-[1.5rem] border border-[var(--border-default)] group hover:border-[#fe8503]/30 transition-all">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--cort-orange)]/10 flex items-center justify-center text-[var(--cort-orange)] font-black text-lg shadow-inner">
                        {selectedBooking.users_chauffeur_bookings_passenger_idTousers?.full_name?.charAt(0) || "P"}
                      </div>
                      <div>
                        <div className="text-sm font-black text-[var(--text-primary)]">{selectedBooking.users_chauffeur_bookings_passenger_idTousers?.full_name || t("unknownPassenger")}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-bold mt-0.5">{selectedBooking.users_chauffeur_bookings_passenger_idTousers?.email || tCommon("misc.noEmail")}</div>
                      </div>
                    </div>
                  </div>

                  {/* Assignment */}
                  {selectedBooking.status !== 'PENDING' && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] flex items-center gap-2 px-1 mb-4">
                        <span className="w-1.5 h-1.5 bg-[var(--cort-orange)] rounded-full"></span> {t("fleetAssignment")}
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        {/* Driver & Vehicle combined or separate cards */}
                        <div className="bg-[var(--bg-subtle)] p-4 rounded-[1.5rem] border border-[var(--border-default)] flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-input)] flex items-center justify-center text-[var(--text-muted)]">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                           </div>
                           <div className="flex-1">
                              <div className="text-[8px] text-[var(--text-muted)] font-black uppercase">{t("chauffeur")}</div>
                              <div className="text-xs font-black text-[var(--text-primary)]">{selectedBooking.users_chauffeur_bookings_driver_idTousers?.full_name || t("assigning")}</div>
                              {selectedBooking.users_chauffeur_bookings_driver_idTousers?.phone && (
                                <div className="text-[9px] text-[var(--text-muted)] font-bold mt-0.5">{selectedBooking.users_chauffeur_bookings_driver_idTousers.phone}</div>
                              )}
                           </div>
                           <div className="w-px h-8 bg-white/10" />
                           <div className="flex-1 ps-2">
                              <div className="text-[8px] text-[var(--text-muted)] font-black uppercase">{t("fleetUnit")}</div>
                              <div className="text-xs font-black text-[var(--text-primary)]">{selectedBooking.vehicles ? selectedBooking.vehicles.model : t("vehiclePending")}</div>
                              {selectedBooking.vehicles?.plate_number && <div className="text-[9px] font-mono text-[var(--cort-orange)] font-bold">{selectedBooking.vehicles.plate_number}</div>}
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
                  <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                    <span className="w-1.5 h-1.5 bg-[var(--cort-orange)] rounded-full"></span> {t("tripLogs")}
                  </h4>
                  <div className="border border-[var(--border-default)] rounded-[1.5rem] overflow-hidden bg-[var(--bg-card)]">
                    <table className="w-full text-[10px] text-start">
                      <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] font-black uppercase tracking-widest">
                        <tr>
                          <th className="px-5 py-3">{t("logDate")}</th>
                          <th className="px-5 py-3">{t("logType")}</th>
                          <th className="px-5 py-3">{t("logUsage")}</th>
                          <th className="px-5 py-3 text-center">{t("fullDay")}</th>
                          <th className="px-5 py-3 text-center">{t("accommodationShort")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-default)]">
                        {selectedBooking.chauffeur_trip_daily_logs.map((log, idx) => (
                          <tr key={idx} className="hover:bg-[var(--bg-subtle)] transition-colors">
                            <td className="px-5 py-3.5 font-black text-[var(--text-primary)]">
                              {formatLocaleDate(log.log_date, locale, { month: 'short', day: 'numeric', weekday: 'short' })}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black tracking-tighter uppercase ${log.trip_type === 'OUT_STATION' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                {log.trip_type.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-bold text-[var(--text-secondary)]">{log.hours_used ? t("hoursUsed", { count: Number(log.hours_used).toFixed(1) }) : '-'}</td>
                            <td className="px-5 py-3.5 text-center">
                              {log.is_full_day ? (
                                <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                              ) : (
                                <span className="text-[var(--text-placeholder)]">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {log.apply_accommodation ? (
                                <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
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

              <div className="flex justify-end pt-5 border-t border-[var(--border-input)]">
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--border-input)] bg-[var(--bg-subtle)] px-10 text-sm font-black text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-all active:scale-95"
                >
                  {t("closeView")}
                </button>
              </div>
            </div>
          </Modal>
        )
      }
    </div>
  );
}
