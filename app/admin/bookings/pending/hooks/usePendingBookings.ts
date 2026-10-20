"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DriverType, ChauffeurBooking, apiClient } from "../../../../lib/services/api-client";
import { useDebounce } from "../../../../lib/hooks/useDebounce";
import type { DateRange } from "../../../lib/dates";
import { errorMessage } from "../components/booking-status";

export type BookingStats = {
  total: number;
  pending: number;
  assigned: number;
  arrived: number;
  in_progress: number;
  ended: number;
  completed: number;
  cancelled: number;
};

export type CompanyOption = { id: number; name: string };

export type AssignableVehicle = { id: number; make: string; model: string; plate_number: string };
export type AssignableDriver = {
  id: string;
  full_name: string;
  email: string;
  drivers_profile?: { driver_type?: string; current_vehicle_id?: number | null } | null;
};

export const BOOKINGS_PAGE_SIZE = 10;

type ListQuery = {
  page: number;
  search?: string;
  status?: string;
  company_id?: number;
  start_date?: string;
  end_date?: string;
};

type ListResult = {
  key: string;
  rows: ChauffeurBooking[];
  pagination: { page: number; pages: number; total: number };
  error: string | null;
};

type StatsResult = { key: string; stats: BookingStats | null };

/** API responses come back as `{ data: { data, pagination } }`, `{ data }` or bare; normalise once. */
function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in res) {
    const inner = (res as { data: unknown }).data;
    if (inner !== undefined && inner !== null) return inner as T;
  }
  return res as T;
}

function unwrapList<T>(res: unknown): { rows: T[]; pagination?: { page?: number; pages?: number; total?: number } } {
  const raw = unwrap<{ data?: T[]; pagination?: { page?: number; pages?: number; total?: number } } | T[]>(res);
  if (Array.isArray(raw)) return { rows: raw };
  return { rows: raw?.data ?? [], pagination: raw?.pagination };
}

export function usePendingBookings() {
  // ── Filters (each setter also resets the page) ─────────────────────────
  const [searchQuery, setSearchQueryState] = useState("");
  const [statusFilter, setStatusFilterState] = useState("");
  const [companyFilter, setCompanyFilterState] = useState("");
  const [dateRange, setDateRangeState] = useState<DateRange | null>(null);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const debouncedSearch = useDebounce(searchQuery, 400);

  const setSearchQuery = useCallback((v: string) => {
    setSearchQueryState(v);
    setPage(1);
  }, []);
  const setStatusFilter = useCallback((v: string) => {
    setStatusFilterState(v);
    setPage(1);
  }, []);
  const setCompanyFilter = useCallback((v: string) => {
    setCompanyFilterState(v);
    setPage(1);
  }, []);
  const setDateRange = useCallback((v: DateRange | null) => {
    setDateRangeState(v);
    setPage(1);
  }, []);
  const clearFilters = useCallback(() => {
    setSearchQueryState("");
    setStatusFilterState("");
    setCompanyFilterState("");
    setDateRangeState(null);
    setPage(1);
  }, []);

  const query = useMemo<ListQuery>(
    () => ({
      page,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      company_id: companyFilter ? Number(companyFilter) : undefined,
      start_date: dateRange?.start || undefined,
      end_date: dateRange?.end || undefined,
    }),
    [page, debouncedSearch, statusFilter, companyFilter, dateRange],
  );
  const queryKey = JSON.stringify({ ...query, tick });

  const statsParams = useMemo(
    () => ({ company_id: query.company_id, start_date: query.start_date, end_date: query.end_date }),
    [query.company_id, query.start_date, query.end_date],
  );
  const statsKey = JSON.stringify({ ...statsParams, tick });

  // ── List: one request per distinct query; stale responses are dropped ──
  const [list, setList] = useState<ListResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getAllBookings({ ...query, limit: BOOKINGS_PAGE_SIZE });
        if (cancelled) return;
        const { rows, pagination } = unwrapList<ChauffeurBooking>(res);
        setList({
          key: queryKey,
          rows,
          pagination: { page: pagination?.page ?? query.page, pages: pagination?.pages ?? 1, total: pagination?.total ?? rows.length },
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setList((prev) => ({
          key: queryKey,
          rows: prev?.rows ?? [],
          pagination: prev?.pagination ?? { page: 1, pages: 1, total: 0 },
          error: errorMessage(e, "Failed to load bookings"),
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // query is fully represented by queryKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const isLoading = list?.key !== queryKey;
  const bookings = useMemo(() => (list?.error && list.key === queryKey ? [] : list?.rows ?? []), [list, queryKey]);
  const pagination = list?.pagination ?? { page: 1, pages: 1, total: 0 };
  const listError = list?.key === queryKey ? list.error : null;

  // ── Stats ──────────────────────────────────────────────────────────────
  const [statsResult, setStatsResult] = useState<StatsResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getBookingStats(statsParams);
        if (!cancelled) setStatsResult({ key: statsKey, stats: unwrap<BookingStats>(res) });
      } catch (e) {
        console.error("Failed to load booking stats", e);
        if (!cancelled) setStatsResult((prev) => ({ key: statsKey, stats: prev?.stats ?? null }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsKey]);
  const stats = statsResult?.stats ?? null;
  const statsLoading = statsResult?.key !== statsKey;

  // ── Companies for the filter ───────────────────────────────────────────
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getCompanies({ limit: 200 });
        if (!cancelled) setCompanies(unwrapList<CompanyOption>(res).rows);
      } catch (e) {
        console.error("Failed to load companies", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshList = useCallback(() => setTick((t) => t + 1), []);

  // Live refresh when a new booking arrives (socket → window event).
  useEffect(() => {
    window.addEventListener("booking:new", refreshList);
    return () => window.removeEventListener("booking:new", refreshList);
  }, [refreshList]);

  // ── Selection / detail ─────────────────────────────────────────────────
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedCarId, setSelectedCarIdState] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [availableCars, setAvailableCars] = useState<AssignableVehicle[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<AssignableDriver[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<unknown[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<unknown>(null);

  /** Picking a vehicle auto-selects the driver currently assigned to it. */
  const setSelectedCarId = useCallback(
    (carId: string, drivers: AssignableDriver[] = availableDrivers) => {
      setSelectedCarIdState(carId);
      if (!carId) return;
      const numeric = parseInt(carId, 10);
      const assigned = drivers.find((d) => d.drivers_profile?.current_vehicle_id === numeric);
      if (assigned) setSelectedDriverId(assigned.id);
    },
    [availableDrivers],
  );

  const loadPaymentData = useCallback(async (bookingId: number) => {
    try {
      const [histRes, sumRes] = await Promise.all([apiClient.getPaymentHistory(bookingId), apiClient.getPaymentSummary(bookingId)]);
      setPaymentHistory(unwrapList<unknown>(histRes).rows);
      setPaymentSummary(unwrap<unknown>(sumRes) ?? null);
    } catch (e) {
      console.error("Failed to load payment data", e);
    }
  }, []);

  const onOpenBookingModal = async (booking: ChauffeurBooking) => {
    setSelectedBookingId(booking.id);
    setSelectedCarIdState(booking.vehicles?.id?.toString() || "");
    setSelectedDriverId(booking.users_chauffeur_bookings_driver_idTousers?.id?.toString() || "");
    setAvailableCars([]);
    setAvailableDrivers([]);
    setPaymentHistory([]);
    setPaymentSummary(null);

    const canEditAssignment = booking.status === "PENDING" || booking.status === "ASSIGNED" || booking.status === "ARRIVED";

    if (canEditAssignment) {
      setResourcesLoading(true);
      try {
        const [carsRes, driversRes] = await Promise.all([
          apiClient.getAvailableVehicles({ limit: 100 }),
          apiClient.getAvailableDrivers({ limit: 100, driver_type: DriverType.CHAUFFEUR }),
        ]);
        const cars = [...unwrapList<AssignableVehicle>(carsRes).rows];
        const drivers = [...unwrapList<AssignableDriver>(driversRes).rows];

        const currentCar = booking.vehicles as AssignableVehicle | undefined;
        if (currentCar?.id != null && !cars.some((c) => c?.id === currentCar.id)) cars.push(currentCar);

        const currentDriver = booking.users_chauffeur_bookings_driver_idTousers as AssignableDriver | undefined;
        if (currentDriver?.id && !drivers.some((d) => d?.id === currentDriver.id)) drivers.push(currentDriver);

        setAvailableCars(cars);
        setAvailableDrivers(drivers);
      } catch (e) {
        console.error("Failed to load assignment resources", e);
      } finally {
        setResourcesLoading(false);
      }
    }

    if (booking.status !== "PENDING") {
      void loadPaymentData(booking.id);
    }
  };

  const selectedBooking = useMemo(() => {
    if (!selectedBookingId) return null;
    return bookings.find((b) => b.id === selectedBookingId) ?? null;
  }, [bookings, selectedBookingId]);

  const closeBookingModal = useCallback(() => setSelectedBookingId(null), []);

  const activeFilterCount = (searchQuery ? 1 : 0) + (statusFilter ? 1 : 0) + (companyFilter ? 1 : 0) + (dateRange ? 1 : 0);

  return {
    bookings,
    pagination,
    isLoading,
    listError,
    stats,
    statsLoading,
    companies,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    companyFilter,
    setCompanyFilter,
    dateRange,
    setDateRange,
    clearFilters,
    activeFilterCount,
    currentPage: page,
    setCurrentPage: setPage,
    selectedBooking,
    selectedBookingId,
    setSelectedBookingId,
    closeBookingModal,
    selectedCarId,
    setSelectedCarId,
    selectedDriverId,
    setSelectedDriverId,
    availableCars,
    availableDrivers,
    resourcesLoading,
    paymentHistory,
    paymentSummary,
    onOpenBookingModal,
    loadPaymentData,
    refreshList,
  };
}
