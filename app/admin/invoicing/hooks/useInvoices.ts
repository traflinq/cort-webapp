"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiClient, Company } from "../../../lib/services/api-client";
import { ShuttleContractRoute } from "../../../lib/services/types/pricing";
import { useAdminAbility } from "../../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../../lib/abilities/admin-subjects";
import { useConfirm } from "../../../lib/hooks/useConfirm";
import { formatCurrency } from "../../lib/format";
import { todayYmd } from "../../lib/dates";
import { errorMessage, type Invoice, type InvoicePaymentLogs, type InvoiceStats, type InvoiceStatus, type PaginationMeta } from "../types";

const WEEKLY_DIVISOR = 4.33;
/** Companies/vendors pickers are capped at this many rows (existing behaviour). */
export const PICKER_LIMIT = 1000;

function parsePositiveNumber(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function calculateAdjustedFuel(
  baseFuel: number,
  contractBase: number,
  currentPrice: number,
  revisionPercentage: number | null,
): { adjusted: number; willAdjust: boolean; percentChange: number } {
  if (!contractBase) {
    return { adjusted: baseFuel, willAdjust: false, percentChange: 0 };
  }
  const percentChange = (currentPrice - contractBase) / contractBase;
  const willAdjust = revisionPercentage === null || Math.abs(percentChange) > revisionPercentage;
  return {
    adjusted: willAdjust ? baseFuel * (currentPrice / contractBase) : baseFuel,
    willAdjust,
    percentChange,
  };
}

type ListEnvelope = {
  data?: { data?: Invoice[]; pagination?: Partial<PaginationMeta> } | Invoice[];
  pagination?: Partial<PaginationMeta>;
};

function unwrapInvoiceList(res: unknown): { rows: Invoice[]; meta: Partial<PaginationMeta> } {
  const env = res as ListEnvelope | undefined;
  const inner = env?.data;
  if (Array.isArray(inner)) return { rows: inner, meta: env?.pagination ?? {} };
  return { rows: inner?.data ?? [], meta: inner?.pagination ?? env?.pagination ?? {} };
}

export function useInvoices() {
  const confirm = useConfirm();
  const ability = useAdminAbility();
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.invoicing);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.invoicing);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats>({ totalCollectable: 0, totalCollected: 0, totalOverdue: 0 });
  const [listError, setListError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pages: 1, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [filterCompanyId, setFilterCompanyId] = useState<number | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | "">("");
  // Request keys: loading is derived (requested ≠ loaded), state is only set in promise callbacks.
  const [listNonce, setListNonce] = useState(0);
  const [statsNonce, setStatsNonce] = useState(0);
  const listKey = `${currentPage}|${filterCompanyId ?? ""}|${filterStatus}|${listNonce}`;
  const statsKey = `${filterCompanyId ?? ""}|${statsNonce}`;
  const [loadedListKey, setLoadedListKey] = useState<string | null>(null);
  const isLoading = loadedListKey !== listKey;

  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<number | null>(null);
  const [isGeneratingShuttle, setIsGeneratingShuttle] = useState(false);

  const [showShuttleModal, setShowShuttleModal] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesTruncated, setCompaniesTruncated] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [billingMonthRaw, setBillingMonthRaw] = useState<string>("");
  const [billingPeriod, setBillingPeriod] = useState<"MONTHLY" | "WEEKLY">("MONTHLY");
  const [weeklyStartDate, setWeeklyStartDate] = useState<string>("");
  const [weeklyEndDate, setWeeklyEndDate] = useState<string>("");
  const [continuedVehicles, setContinuedVehicles] = useState<string>("");
  const [amountMode, setAmountMode] = useState<"EXACT" | "LESS" | "MORE">("EXACT");
  const [amountDelta, setAmountDelta] = useState<string>("");
  const [fuelMode, setFuelMode] = useState<"CONTRACT" | "SELECTED">("CONTRACT");
  const [selectedFuelPrice, setSelectedFuelPrice] = useState<string>("");
  const [selectedDieselPrice, setSelectedDieselPrice] = useState<string>("");
  const [shuttleContractFuel, setShuttleContractFuel] = useState<{
    fuelBasePrice: string;
    dieselBasePrice: string | null;
    revisionPercentage: string | null;
  } | null>(null);
  const [shuttleDiscountType, setShuttleDiscountType] = useState<"NONE" | "PERCENTAGE" | "FLAT">("NONE");
  const [shuttleDiscountValue, setShuttleDiscountValue] = useState<string>("");
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<number | null>(null);

  // Shuttle route input state (all contract routes)
  const [shuttleRoutes, setShuttleRoutes] = useState<ShuttleContractRoute[]>([]);
  const [routeTrips, setRouteTrips] = useState<Record<number, string>>({});
  const [routeQuantities, setRouteQuantities] = useState<Record<number, string>>({});
  const [routeTripDates, setRouteTripDates] = useState<Record<number, string>>({});

  // Vendor state for shuttle invoice
  const [isVendorCar, setIsVendorCar] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [vendorCost, setVendorCost] = useState<string>("");
  const [allVendors, setAllVendors] = useState<{ id: number; name: string }[]>([]);
  const [vendorsTruncated, setVendorsTruncated] = useState(false);

  // Settle dialog state
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlingInvoice, setSettlingInvoice] = useState<Invoice | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>("");
  const [settlePaymentType, setSettlePaymentType] = useState<"PARTIAL" | "FINAL">("PARTIAL");
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<string>("");
  const [settleNotes, setSettleNotes] = useState<string>("");
  const [settlePaymentDate, setSettlePaymentDate] = useState<string>(todayYmd());
  const [isSettling, setIsSettling] = useState(false);

  // Payment history dialog state
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [activeInvoiceLogs, setActiveInvoiceLogs] = useState<InvoicePaymentLogs | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Invoice list — one request per key change; stale responses are ignored.
  useEffect(() => {
    let cancelled = false;
    const page = currentPage;
    apiClient
      .getAllInvoices({
        page,
        ...(filterCompanyId ? { company_id: filterCompanyId } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
      })
      .then((res) => {
        if (cancelled) return;
        const { rows, meta } = unwrapInvoiceList(res);
        setInvoices(rows);
        setPagination({ page: meta.page ?? page, pages: meta.pages ?? 1, total: meta.total ?? 0 });
        setListError(null);
        setLoadedListKey(listKey);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error("Failed to fetch invoices", e);
        setListError(errorMessage(e, "Could not load invoices."));
        setLoadedListKey(listKey);
      });
    return () => {
      cancelled = true;
    };
    // listKey encodes page/filters/nonce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  // Totals
  useEffect(() => {
    let cancelled = false;
    apiClient
      .getInvoiceStats(filterCompanyId)
      .then((res: { data?: Partial<InvoiceStats> } | Partial<InvoiceStats> | undefined) => {
        if (cancelled) return;
        const raw = (res && "data" in (res as object) ? (res as { data?: Partial<InvoiceStats> }).data : res) as Partial<InvoiceStats> | undefined;
        setStats({
          totalCollectable: raw?.totalCollectable ?? 0,
          totalCollected: raw?.totalCollected ?? 0,
          totalOverdue: raw?.totalOverdue ?? 0,
        });
        setStatsError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error("Failed to fetch invoice stats", e);
        setStatsError(errorMessage(e, "Could not load invoice totals."));
      });
    return () => {
      cancelled = true;
    };
    // statsKey encodes company filter/nonce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsKey]);

  const refetchStats = useCallback(() => setStatsNonce((n) => n + 1), []);
  const refetch = useCallback(() => {
    setListNonce((n) => n + 1);
    setStatsNonce((n) => n + 1);
  }, []);

  /** Filter setters reset to page 1 in the same event so only one fetch fires. */
  const applyCompanyFilter = (companyId: number | undefined) => {
    setFilterCompanyId(companyId);
    setCurrentPage(1);
  };
  const applyStatusFilter = (status: InvoiceStatus | "") => {
    setFilterStatus(status);
    setCurrentPage(1);
  };
  const clearFilters = () => {
    setFilterCompanyId(undefined);
    setFilterStatus("");
    setCurrentPage(1);
  };

  // Companies feed the ledger filter and the generate dialog. Nothing is pre-selected,
  // so no per-company request fires until the user picks one.
  useEffect(() => {
    (async () => {
      try {
        const compRes = await apiClient.getCompanies({ limit: PICKER_LIMIT });
        setCompanies(compRes.data.data);
        setCompaniesTruncated((compRes.data.pagination?.total ?? 0) > PICKER_LIMIT);
      } catch (e) {
        console.error("Failed to load companies for invoicing", e);
        toast.error(errorMessage(e, "Could not load companies."));
      }
    })();
  }, []);

  // Vendors are only needed for the "vendor car" option in the generate dialog, so load them on first use.
  const vendorsRequested = useRef(false);
  useEffect(() => {
    if (!isVendorCar || vendorsRequested.current) return;
    vendorsRequested.current = true;
    (async () => {
      try {
        const vendRes = await apiClient.getVendors({ limit: PICKER_LIMIT });
        setAllVendors(vendRes.data.data);
        setVendorsTruncated((vendRes.data.pagination?.total ?? 0) > PICKER_LIMIT);
      } catch (e) {
        vendorsRequested.current = false;
        toast.error(errorMessage(e, "Could not load vendors."));
      }
    })();
  }, [isVendorCar]);

  // Load shuttle contract routes when company changes
  useEffect(() => {
    if (!selectedCompanyId) return;
    (async () => {
      try {
        const res = await apiClient.getShuttleContract(Number(selectedCompanyId));
        const routes: ShuttleContractRoute[] = res?.data?.shuttle_contract_routes ?? [];
        setShuttleRoutes(routes);
        setShuttleContractFuel({
          fuelBasePrice: String(res?.data?.fuel_base_price ?? ""),
          dieselBasePrice: res?.data?.diesel_base_price != null ? String(res.data.diesel_base_price) : null,
          revisionPercentage: res?.data?.revision_percentage != null ? String(res.data.revision_percentage) : null,
        });
        const initial: Record<number, string> = {};
        const initialQuantities: Record<number, string> = {};
        const initialDates: Record<number, string> = {};
        routes.forEach((r) => {
          initial[r.id] = r.billing_type === "PER_TRIP" ? "0" : "1";
          initialQuantities[r.id] = String(Number(r.quantity ?? 0));
          initialDates[r.id] = "";
        });
        setRouteTrips(initial);
        setRouteQuantities(initialQuantities);
        setRouteTripDates(initialDates);
      } catch {
        setShuttleRoutes([]);
        setRouteTrips({});
        setRouteQuantities({});
        setShuttleContractFuel(null);
      }
    })();
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!showShuttleModal) return;
    (async () => {
      try {
        const petrol = await apiClient.getSystemSetting("current_fuel_price");
        setSelectedFuelPrice((prev) => prev || petrol?.data?.value || "");
      } catch {
        // Leave empty; user can type a price when using selected-fuel mode.
      }
      try {
        const diesel = await apiClient.getSystemSetting("current_diesel_price");
        setSelectedDieselPrice((prev) => prev || diesel?.data?.value || "");
      } catch {
        // Diesel setting is optional.
      }
    })();
  }, [showShuttleModal]);

  const handleSendEmail = async (id: number, invoiceNumber: string) => {
    if (sendingEmailId) return;
    const ok = await confirm({
      title: "Send invoice by email?",
      message: `Invoice ${invoiceNumber} will be emailed to the company's billing contact.`,
      confirmLabel: "Send email",
    });
    if (!ok) return;

    setSendingEmailId(id);
    try {
      await apiClient.sendInvoiceEmail(id);
      toast.success(`Invoice ${invoiceNumber} sent.`);
    } catch (e) {
      console.error("Failed to send email", e);
      toast.error("Could not send email", { description: errorMessage(e, "Please try again.") });
    } finally {
      setSendingEmailId(null);
    }
  };

  const downloadPdf = async (id: number, invoiceNumber: string) => {
    if (downloadingId) return;
    setDownloadingId(id);
    try {
      await apiClient.downloadInvoicePdf(id, invoiceNumber);
    } catch (e) {
      console.error("Failed to download PDF", e);
      toast.error("Could not download the PDF", { description: errorMessage(e, "Please try again.") });
    } finally {
      setDownloadingId(null);
    }
  };

  const viewPdf = async (id: number) => {
    if (viewingId) return;
    setViewingId(id);
    try {
      await apiClient.viewInvoicePdf(id);
    } catch (e) {
      console.error("Failed to view PDF", e);
      toast.error("Could not open the PDF", { description: errorMessage(e, "Please try again.") });
    } finally {
      setViewingId(null);
    }
  };

  const handleStatusUpdate = async (id: number, invoiceNumber: string, newStatus: string) => {
    const ok = await confirm({
      title: "Change invoice status?",
      message: `Set invoice ${invoiceNumber} to "${newStatus.replace(/_/g, " ").toLowerCase()}"?`,
      consequences: ["Collectable and collected totals are recalculated", "The change is visible to the company on its invoices page"],
      confirmLabel: "Change status",
    });
    if (!ok) return;
    try {
      await apiClient.updateInvoiceStatus(id, newStatus);
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status: newStatus } : inv)));
      refetchStats();
      toast.success("Status updated.");
    } catch (e) {
      console.error("Failed to update status:", e);
      toast.error("Could not update status", { description: errorMessage(e, "Please try again.") });
    }
  };

  const formatPeriodDate = (value: string) => {
    const hasTimeComponent = value.includes("T");
    const dt = hasTimeComponent ? new Date(value) : new Date(`${value}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatInvoicePeriod = (invoice: Invoice) => {
    if (invoice.period_start && invoice.period_end) {
      const start = formatPeriodDate(invoice.period_start);
      const end = formatPeriodDate(invoice.period_end);
      return start === end ? start : `${start} to ${end}`;
    }

    const raw = invoice.billing_month ?? "";

    // Backward-compatible parsing for legacy weekly key format: "4/2026 W0401-0407"
    const weeklyMatch = raw.match(/^(\d{1,2})\/(\d{4})\s+W(\d{4})-(\d{4})$/);
    if (weeklyMatch) {
      const year = Number(weeklyMatch[2]);
      const startMonth = Number(weeklyMatch[3].slice(0, 2));
      const startDay = Number(weeklyMatch[3].slice(2, 4));
      const endMonth = Number(weeklyMatch[4].slice(0, 2));
      const endDay = Number(weeklyMatch[4].slice(2, 4));

      const start = new Date(year, startMonth - 1, startDay);
      const end = new Date(year, endMonth - 1, endDay);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        const startText = start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const endText = end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        return `${startText} to ${endText}`;
      }
    }

    const monthlyMatch = raw.match(/^(\d{1,2})\/(\d{4})$/);
    if (monthlyMatch) {
      const month = Number(monthlyMatch[1]);
      const year = Number(monthlyMatch[2]);
      const dt = new Date(year, month - 1, 1);
      if (!Number.isNaN(dt.getTime())) {
        return dt.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      }
    }

    return raw;
  };

  const getInvoicePeriodType = (invoice: Invoice): "WEEKLY" | "MONTHLY" => {
    if (invoice.billing_period === "WEEKLY" || invoice.billing_period === "MONTHLY") {
      return invoice.billing_period;
    }
    const raw = invoice.billing_month ?? "";
    return /\s+W\d{4}-\d{4}$/.test(raw) ? "WEEKLY" : "MONTHLY";
  };

  const fuelAdjustmentPreview = useMemo(() => {
    const petrolPrice = parsePositiveNumber(selectedFuelPrice);
    if (fuelMode !== "SELECTED" || !shuttleContractFuel || petrolPrice == null) {
      return null;
    }

    const dieselPrice = parsePositiveNumber(selectedDieselPrice) ?? petrolPrice;
    const petrolBase = parsePositiveNumber(shuttleContractFuel.fuelBasePrice) ?? 0;
    const dieselBase = parsePositiveNumber(shuttleContractFuel.dieselBasePrice) ?? petrolBase;
    const revisionRaw = shuttleContractFuel.revisionPercentage;
    const revisionPercentage = revisionRaw == null || revisionRaw === "" ? null : Number(revisionRaw);
    const safeRevision = revisionPercentage != null && Number.isFinite(revisionPercentage) ? revisionPercentage : null;

    const petrolAdj = calculateAdjustedFuel(1, petrolBase, petrolPrice, safeRevision);
    const dieselAdj = calculateAdjustedFuel(1, dieselBase, dieselPrice, safeRevision);
    const hasDieselRoutes = shuttleRoutes.some((r) => r.fuel_type === "DIESEL");
    const isWeekly = billingPeriod === "WEEKLY";

    const rows = shuttleRoutes.map((route) => {
      const isDiesel = route.fuel_type === "DIESEL";
      const isPerTrip = route.billing_type === "PER_TRIP";
      const qty = Number(routeQuantities[route.id] ?? route.quantity ?? 0);
      const trips = isPerTrip ? Number(routeTrips[route.id] ?? 0) : 1;
      const billed = qty > 0 && (!isPerTrip || trips > 0);
      const baseFuel = Number(route.fuel_cost_per_vehicle ?? 0);
      const currentPrice = isDiesel ? dieselPrice : petrolPrice;
      const contractBase = isDiesel ? dieselBase : petrolBase;
      const fuel = calculateAdjustedFuel(baseFuel, contractBase, currentPrice, safeRevision);
      const unitMultiplier = isPerTrip ? trips : isWeekly ? 1 / WEEKLY_DIVISOR : 1;
      const billedQty = billed ? qty * unitMultiplier : 0;

      return {
        routeId: route.id,
        particulars: route.particulars,
        vehicleType: route.vehicle_type,
        fuelType: isDiesel ? "Diesel" : "Petrol",
        billed,
        baseFuelPerVehicle: baseFuel,
        adjustedFuelPerVehicle: fuel.adjusted,
        billedContractFuel: billedQty * baseFuel,
        billedAdjustedFuel: billedQty * fuel.adjusted,
        willAdjust: fuel.willAdjust,
        percentChange: fuel.percentChange,
      };
    });

    const contractFuelTotal = rows.reduce((sum, row) => sum + row.billedContractFuel, 0);
    const adjustedFuelTotal = rows.reduce((sum, row) => sum + row.billedAdjustedFuel, 0);

    return {
      petrolPercentChange: petrolAdj.percentChange,
      dieselPercentChange: hasDieselRoutes ? dieselAdj.percentChange : null,
      willPetrolAdjust: petrolAdj.willAdjust,
      willDieselAdjust: hasDieselRoutes ? dieselAdj.willAdjust : null,
      revisionLabel: safeRevision == null ? "No limit (always revises)" : `${(safeRevision * 100).toFixed(1)}%`,
      rows,
      contractFuelTotal,
      adjustedFuelTotal,
      delta: adjustedFuelTotal - contractFuelTotal,
    };
  }, [fuelMode, selectedFuelPrice, selectedDieselPrice, shuttleContractFuel, shuttleRoutes, routeQuantities, routeTrips, billingPeriod]);

  const handleGenerateShuttleInvoice = async () => {
    if (!selectedCompanyId) {
      toast.error("Please select a company.");
      return;
    }
    if (isVendorCar && !selectedVendorId) {
      toast.error("Please select a vendor.");
      return;
    }

    let billingMonth: string | undefined;

    if (billingPeriod === "MONTHLY") {
      if (!billingMonthRaw) {
        toast.error("Please select a billing month.");
        return;
      }
      const [year, month] = billingMonthRaw.split("-");
      if (!year || !month) {
        toast.error("Invalid billing month.");
        return;
      }
      billingMonth = `${Number(month)}/${year}`;
    } else {
      if (!weeklyStartDate || !weeklyEndDate) {
        toast.error("Please select weekly start and end dates.");
        return;
      }
      const start = new Date(weeklyStartDate);
      const end = new Date(weeklyEndDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        toast.error("Invalid weekly date range.");
        return;
      }
      if (start > end) {
        toast.error("Weekly start date cannot be after end date.");
        return;
      }
    }

    if (fuelMode === "SELECTED") {
      const petrol = Number(selectedFuelPrice);
      if (!selectedFuelPrice || Number.isNaN(petrol) || petrol <= 0) {
        toast.error("Please enter a petrol price to adjust fuel for this invoice.");
        return;
      }
      const hasDieselRoutes = shuttleRoutes.some((r) => r.fuel_type === "DIESEL");
      if (hasDieselRoutes) {
        const diesel = Number(selectedDieselPrice);
        if (!selectedDieselPrice || Number.isNaN(diesel) || diesel <= 0) {
          toast.error("Please enter a diesel price to adjust diesel routes for this invoice.");
          return;
        }
      }
    }

    setIsGeneratingShuttle(true);
    try {
      const contractRes = await apiClient.getShuttleContract(Number(selectedCompanyId));
      const contract = contractRes.data;
      if (!contract) {
        toast.error("No shuttle contract found for the selected company.");
        return;
      }

      await apiClient.generateShuttleInvoice(contract.id, {
        billingMonth,
        continuedVehicles: continuedVehicles !== "" ? Number(continuedVehicles) : undefined,
        amountMode,
        amountDelta: amountMode !== "EXACT" && amountDelta !== "" ? Number(amountDelta) : undefined,
        billingPeriod,
        weeklyStartDate: billingPeriod === "WEEKLY" ? weeklyStartDate : undefined,
        weeklyEndDate: billingPeriod === "WEEKLY" ? weeklyEndDate : undefined,
        routeTrips:
          shuttleRoutes.length > 0
            ? shuttleRoutes.map((r) => ({
                routeId: r.id,
                tripsCount: r.billing_type === "PER_TRIP" ? Number(routeTrips[r.id] ?? 0) : 0,
                quantity: Number(routeQuantities[r.id] ?? r.quantity ?? 0),
                tripDate: r.billing_type === "PER_TRIP" ? routeTripDates[r.id] || undefined : undefined,
              }))
            : undefined,
        discountType: shuttleDiscountType !== "NONE" ? shuttleDiscountType : undefined,
        discountValue: shuttleDiscountType !== "NONE" && shuttleDiscountValue !== "" ? Number(shuttleDiscountValue) : undefined,
        vendorId: isVendorCar ? Number(selectedVendorId) : undefined,
        vendorCost: isVendorCar && vendorCost !== "" ? Number(vendorCost) : undefined,
        fuelMode,
        selectedFuelPrice: fuelMode === "SELECTED" && selectedFuelPrice !== "" ? Number(selectedFuelPrice) : undefined,
        selectedDieselPrice: fuelMode === "SELECTED" && selectedDieselPrice !== "" ? Number(selectedDieselPrice) : undefined,
      });

      refetch();

      toast.success("Shuttle invoice generated.");
      setShowShuttleModal(false);
      setBillingMonthRaw("");
      setBillingPeriod("MONTHLY");
      setWeeklyStartDate("");
      setWeeklyEndDate("");
      setContinuedVehicles("");
      setAmountMode("EXACT");
      setAmountDelta("");
      setFuelMode("CONTRACT");
      setShuttleDiscountType("NONE");
      setShuttleDiscountValue("");
      setIsVendorCar(false);
      setVendorCost("");

      const resetTrips: Record<number, string> = {};
      const resetQuantities: Record<number, string> = {};
      shuttleRoutes.forEach((r) => {
        resetTrips[r.id] = r.billing_type === "PER_TRIP" ? "0" : "1";
        resetQuantities[r.id] = String(Number(r.quantity ?? 0));
      });
      setRouteTrips(resetTrips);
      setRouteQuantities(resetQuantities);
    } catch (e) {
      console.error("Failed to generate shuttle invoice", e);
      toast.error("Could not generate the invoice", { description: errorMessage(e, "Please check the inputs and try again.") });
    } finally {
      setIsGeneratingShuttle(false);
    }
  };

  const openSettleModal = (inv: Invoice) => {
    setSettlingInvoice(inv);
    setSettleAmount("");
    setSettlePaymentType("PARTIAL");
    setSettlePaymentMethod("");
    setSettleNotes("");
    setSettlePaymentDate(todayYmd());
    setShowSettleModal(true);
  };

  /** Closing (cancel, Esc, overlay) always clears the selected invoice. */
  const closeSettleModal = () => {
    if (isSettling) return;
    setShowSettleModal(false);
    setSettlingInvoice(null);
  };

  const handleSettleInvoice = async () => {
    if (!settlingInvoice) return;
    const amount = Number(settleAmount);
    if (!settleAmount || Number.isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    setIsSettling(true);
    try {
      await apiClient.settleShuttleInvoice(settlingInvoice.id, {
        amount,
        paymentType: settlePaymentType,
        paymentMethod: settlePaymentMethod || undefined,
        notes: settleNotes || undefined,
        paymentDate: settlePaymentDate || undefined,
      });
      refetch();
      toast.success(`Payment of ${formatCurrency(amount)} recorded.`);
      setShowSettleModal(false);
      setSettlingInvoice(null);
    } catch (e) {
      toast.error("Could not record the payment", { description: errorMessage(e, "Please try again.") });
    } finally {
      setIsSettling(false);
    }
  };

  const openLogsModal = async (inv: Invoice) => {
    setIsLoadingLogs(true);
    setActiveInvoiceLogs(null);
    setShowLogsModal(true);
    try {
      const res = await apiClient.getShuttleInvoicePayments(inv.id);
      setActiveInvoiceLogs((res?.data ?? null) as InvoicePaymentLogs | null);
    } catch (e) {
      console.error("Failed to fetch logs", e);
      toast.error("Could not load payment history", { description: errorMessage(e, "Please try again.") });
      setShowLogsModal(false);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const closeLogsModal = () => {
    setShowLogsModal(false);
    setActiveInvoiceLogs(null);
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const ok = await confirm({
      title: `Delete invoice ${invoice.invoice_number}?`,
      message: "This permanently removes the invoice from the ledger.",
      consequences: [
        "Recorded payments against this invoice are no longer visible here",
        "Collectable and collected totals are recalculated",
        "This cannot be undone",
      ],
      destructive: true,
      confirmLabel: "Delete invoice",
    });
    if (!ok) return;
    setDeletingInvoiceId(invoice.id);
    try {
      await apiClient.deleteInvoice(invoice.id);
      toast.success(`Invoice ${invoice.invoice_number} deleted.`);
      // Refetch so pagination and totals stay accurate (previously only removed locally).
      refetch();
    } catch (e) {
      toast.error("Could not delete the invoice", { description: errorMessage(e, "Please try again.") });
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  return {
    // list
    invoices, stats, isLoading, listError, statsError, pagination, currentPage, setCurrentPage, refetch,
    filterCompanyId, filterStatus, applyCompanyFilter, applyStatusFilter, clearFilters,
    companies, companiesTruncated, canUpdate, canDelete,
    downloadingId, viewingId, sendingEmailId, deletingInvoiceId,
    // generate
    showShuttleModal, setShowShuttleModal, isGeneratingShuttle,
    selectedCompanyId, setSelectedCompanyId, billingMonthRaw, setBillingMonthRaw,
    billingPeriod, setBillingPeriod, weeklyStartDate, setWeeklyStartDate, weeklyEndDate, setWeeklyEndDate,
    continuedVehicles, setContinuedVehicles, amountMode, setAmountMode, amountDelta, setAmountDelta,
    fuelMode, setFuelMode, selectedFuelPrice, setSelectedFuelPrice, selectedDieselPrice, setSelectedDieselPrice,
    shuttleContractFuel, fuelAdjustmentPreview,
    shuttleDiscountType, setShuttleDiscountType, shuttleDiscountValue, setShuttleDiscountValue,
    shuttleRoutes, routeTrips, setRouteTrips, routeQuantities, setRouteQuantities, routeTripDates, setRouteTripDates,
    isVendorCar, setIsVendorCar, selectedVendorId, setSelectedVendorId, vendorCost, setVendorCost, allVendors, vendorsTruncated,
    // settle
    showSettleModal, closeSettleModal, settlingInvoice, settleAmount, setSettleAmount, settlePaymentType, setSettlePaymentType,
    settlePaymentMethod, setSettlePaymentMethod, settleNotes, setSettleNotes, settlePaymentDate, setSettlePaymentDate, isSettling,
    // logs
    showLogsModal, closeLogsModal, activeInvoiceLogs, isLoadingLogs,
    // helpers + actions
    formatInvoicePeriod, getInvoicePeriodType, handleSendEmail, downloadPdf, viewPdf, handleStatusUpdate,
    handleGenerateShuttleInvoice, openSettleModal, handleSettleInvoice, openLogsModal, handleDeleteInvoice,
  };
}

export type InvoicesController = ReturnType<typeof useInvoices>;
