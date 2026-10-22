"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarX2, Plus } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/lib/store/hooks";
import { fetchBookings, setPage, setFilters, selectBookings, selectPagination, selectBookingsStatus, selectFilters } from "@/app/lib/store/slices/bookingsSlice";
import { selectCompany } from "@/app/lib/store/slices/companySlice";
import type { ChauffeurBooking } from "@/app/lib/services/api-client";
import {
  Button,
  Card,
  CardContent,
  DataTable,
  Drawer,
  DrawerContent,
  EmptyState,
  FilterBar,
  FilterField,
  PageHeader,
  Select,
  StatusBadge,
  useFormatters,
  type DataTableColumn,
} from "@/app/ui";
import { useCompanyBasePath } from "../lib/use-company-base-path";
import CreateBookingForm from "./components/CreateBookingForm";

export default function BookingsPage() {
  const t = useTranslations("company.bookings");
  const tStatus = useTranslations("common.status");
  const tFulfillment = useTranslations("common.fulfillment");
  const tCommon = useTranslations("common");
  const { formatDate, formatTime } = useFormatters();
  const { companyPath } = useCompanyBasePath();
  const dispatch = useAppDispatch();
  const company = useAppSelector(selectCompany);
  const bookings = useAppSelector(selectBookings);
  const { page: reduxPage, limit, pages: totalPages, total } = useAppSelector(selectPagination);
  const { search, status, fulfillmentType } = useAppSelector(selectFilters);
  const statusState = useAppSelector(selectBookingsStatus);
  const isLoading = statusState === "loading";

  const searchParams = useSearchParams();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  // Local state for pagination - decoupled from Redux metadata to prevent loops
  const [currentPage, setCurrentPage] = useState(reduxPage);

  // Local state for inputs to allow debouncing
  const [searchQuery, setSearchQuery] = useState(search);
  const [statusFilter, setStatusFilter] = useState(status);
  const [fulfillmentFilter, setFulfillmentFilter] = useState(fulfillmentType);

  // Sync local state with Redux when it changes (e.g., navigation back): render-time state adjustment.
  const [prevRedux, setPrevRedux] = useState({ search, status, fulfillmentType });
  if (prevRedux.search !== search || prevRedux.status !== status || prevRedux.fulfillmentType !== fulfillmentType) {
    setPrevRedux({ search, status, fulfillmentType });
    setSearchQuery(search);
    setStatusFilter(status);
    setFulfillmentFilter(fulfillmentType);
  }

  // ?action=new opens the create form (deep link from the dashboard), then cleans the URL.
  const wantsNew = searchParams.get("action") === "new";
  const [handledNew, setHandledNew] = useState(false);
  if (wantsNew && !handledNew) {
    setHandledNew(true);
    setCreateOpen(true);
  }
  useEffect(() => {
    if (wantsNew) router.replace(companyPath("/company/bookings"), { scroll: false });
  }, [wantsNew, router, companyPath]);

  // Debounce search and update Redux filters
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== search || statusFilter !== status || fulfillmentFilter !== fulfillmentType) {
        dispatch(setFilters({ search: searchQuery, status: statusFilter, fulfillmentType: fulfillmentFilter }));
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, fulfillmentFilter, search, status, fulfillmentType, dispatch]);

  // Track last fetched params to avoid duplicates
  const lastFetchedParams = useRef<string>("");

  useEffect(() => {
    if (!company?.id) return;
    const currentParams = JSON.stringify({ currentPage, limit, status, search, fulfillmentType });
    if (currentParams === lastFetchedParams.current && statusState !== "idle") return;
    lastFetchedParams.current = currentParams;
    dispatch(fetchBookings({ companyId: company.id, page: currentPage, limit, status, search, fulfillment_type: fulfillmentType || undefined }));
  }, [dispatch, company?.id, currentPage, limit, status, search, fulfillmentType, statusState]);

  const refetch = () => {
    if (!company?.id) return;
    dispatch(fetchBookings({ companyId: company.id, page: currentPage, limit, status, search, fulfillment_type: fulfillmentType || undefined }));
  };

  const handleBookingCreated = () => {
    setCreateOpen(false);
    if (!company?.id) return;
    if (currentPage === 1) {
      // Same params: the effect will not refire, so fetch once here.
      dispatch(fetchBookings({ companyId: company.id, page: 1, limit, status, search, fulfillment_type: fulfillmentType || undefined }));
    } else {
      setCurrentPage(1); // The params effect fetches page 1.
    }
  };

  const activeFilters = (searchQuery ? 1 : 0) + (statusFilter ? 1 : 0) + (fulfillmentFilter ? 1 : 0);
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setFulfillmentFilter("");
  };

  const columns: DataTableColumn<ChauffeurBooking>[] = [
    { key: "id", header: t("id"), mono: true, width: "1%", cell: (b) => <span className="font-medium text-fg">#{b.id}</span> },
    {
      key: "passenger",
      header: t("passenger"),
      cell: (b) => (
        <div className="min-w-0">
          <div className="font-medium text-fg">{b.users_chauffeur_bookings_passenger_idTousers?.full_name || tStatus("unknown")}</div>
          <div className="text-xs text-fg-muted">{b.service_category || tCommon("misc.standard")}</div>
        </div>
      ),
    },
    { key: "fulfillment", header: t("fulfillment"), hideBelow: "md", cell: (b) => <StatusBadge status={b.fulfillment_type} size="sm" dot={false} /> },
    {
      key: "driver",
      header: t("driver"),
      hideBelow: "lg",
      cell: (b) => (
        <div className="min-w-0">
          <div className="text-fg">{b.users_chauffeur_bookings_driver_idTousers?.full_name || "—"}</div>
          {b.users_chauffeur_bookings_driver_idTousers?.phone && (
            <div dir="ltr" className="text-xs text-fg-muted">
              {b.users_chauffeur_bookings_driver_idTousers.phone}
            </div>
          )}
        </div>
      ),
    },
    { key: "package", header: t("package"), hideBelow: "xl", cell: (b) => <span className="capitalize text-fg-secondary">{b.package_selected.replace(/_/g, " ").toLowerCase()}</span> },
    {
      key: "pickup",
      header: t("pickup"),
      hideBelow: "lg",
      cell: (b) => (
        <div className="min-w-0">
          <div className="max-w-[220px] truncate text-fg-secondary" title={b.pickup_address || tCommon("misc.noAddress")}>
            {b.pickup_address || "—"}
          </div>
          {b.city && <div className="text-xs text-fg-muted">{b.city}</div>}
        </div>
      ),
    },
    {
      key: "scheduled",
      header: t("scheduled"),
      cell: (b) => (
        <div className="min-w-0">
          <div className="text-fg">{formatDate(b.scheduled_for)}</div>
          <div className="text-xs text-fg-muted">{formatTime(b.scheduled_for)}</div>
        </div>
      ),
    },
    { key: "days", header: t("days"), align: "center", hideBelow: "xl", mono: true, cell: (b) => b.no_of_days || 1 },
    { key: "status", header: t("status"), cell: (b) => <StatusBadge status={b.status} /> },
  ];

  if (!company) {
    return <EmptyState title={tCommon("errors.noCompanySelected")} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          company.services_enabled.chauffeur_enabled ? (
            <Button leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
              {tCommon("actions.newBooking")}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar search={{ value: searchQuery, onChange: setSearchQuery, placeholder: t("searchPlaceholder") }} activeCount={activeFilters} onClear={clearFilters}>
            <FilterField label={t("status")}>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder={t("allStatuses")} className="h-8 text-xs">
                <option value="PENDING">{tStatus("pending")}</option>
                <option value="ASSIGNED">{tStatus("assigned")}</option>
                <option value="ARRIVED">{tStatus("arrived")}</option>
                <option value="IN_PROGRESS">{tStatus("inProgress")}</option>
                <option value="COMPLETED">{tStatus("completed")}</option>
                <option value="CANCELLED">{tStatus("cancelled")}</option>
              </Select>
            </FilterField>
            <FilterField label={t("fulfillment")}>
              <Select value={fulfillmentFilter} onChange={(e) => setFulfillmentFilter(e.target.value)} placeholder={t("allTypes")} className="h-8 text-xs">
                <option value="CORT_MANAGED">{tFulfillment("cortManaged")}</option>
                <option value="EXTERNAL_VENDOR">{tFulfillment("vendorManaged")}</option>
                <option value="SELF_MANAGED">{tFulfillment("ownPoolCars")}</option>
              </Select>
            </FilterField>
          </FilterBar>
        </CardContent>

        <DataTable<ChauffeurBooking>
          caption={t("title")}
          columns={columns}
          rows={bookings}
          rowKey={(b) => b.id}
          loading={isLoading}
          error={statusState === "failed" ? tCommon("errors.failedToLoad") : null}
          onRetry={refetch}
          onRowClick={(b) => router.push(companyPath(`/company/bookings/${b.id}`))}
          empty={{
            icon: <CalendarX2 aria-hidden="true" />,
            title: t("noRecords"),
            description: activeFilters > 0 ? t("adjustFilters") : undefined,
            action:
              activeFilters > 0 ? (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  {t("clearFilters")}
                </Button>
              ) : undefined,
          }}
          pagination={{
            page: currentPage,
            totalPages,
            total,
            pageSize: limit,
            onPageChange: (p) => {
              setCurrentPage(p);
              dispatch(setPage(p));
            },
          }}
        />
      </Card>

      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <DrawerContent side="end" size="xl" title={t("createNewBooking")}>
          {createOpen && <CreateBookingForm onSuccess={handleBookingCreated} onCancel={() => setCreateOpen(false)} />}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
