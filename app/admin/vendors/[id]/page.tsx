"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Banknote, Receipt, Route, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "../../../lib/store/hooks";
import { selectAdminVendors } from "../../../lib/store/slices/adminVendorsSlice";
import { fetchAdminCompanies, selectAdminCompanies } from "../../../lib/store/slices/adminCompaniesSlice";
import {
  fetchVendorLogs,
  fetchVendorStats,
  selectVendorLogs,
  selectVendorStats,
  selectVendorLogsStatus,
  selectVendorLogsPagination,
  createVendorPayment,
} from "../../../lib/store/slices/vendorLogsSlice";
import type { RootState } from "../../../lib/store/store";
import { AdminProtectedPage } from "../../components/AdminProtectedPage";
import { useAdminAbility } from "../../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../../lib/abilities/admin-subjects";
import { apiClient, type Vendor } from "../../../lib/services/api-client";
import {
  Card,
  CardContent,
  DataTable,
  DateRangePicker,
  FilterBar,
  FilterField,
  KpiCard,
  KpiGrid,
  PageHeader,
  Select,
  usePageBreadcrumbs,
  type DateRange,
} from "../../ui";
import { formatCurrency, formatNumber } from "../../lib/format";
import { useVendorLogColumns } from "../components/log-columns";
import { SettlementDrawer } from "../components/SettlementDrawer";
import { VendorAdvances } from "../components/VendorAdvances";
import { RecordPaymentDialog } from "../components/RecordPaymentDialog";
import { VendorPortalAccess } from "../components/VendorPortalAccess";
import { isPaidStatus, paymentTargetFor, PAYMENT_STATUS_OPTIONS, type PaymentTarget, type VendorLogRow } from "../components/types";

export default function VendorDetailsPage() {
  return (
    <AdminProtectedPage permission="vendor_logs" subject={ADMIN_SUBJECTS.vendor_logs}>
      <VendorDetailsContent />
    </AdminProtectedPage>
  );
}

type Filters = { start_date: string; end_date: string; payment_status: string; company_id: string };
const EMPTY_FILTERS: Filters = { start_date: "", end_date: "", payment_status: "", company_id: "" };

function VendorDetailsContent() {
  const params = useParams();
  const dispatch = useAppDispatch();
  const ability = useAdminAbility();
  const canEditPayments = ability.can("update", ADMIN_SUBJECTS.vendor_logs);
  const canManagePortal = ability.can("update", ADMIN_SUBJECTS.vendors);
  const vendorId = Number(params.id);

  const logs = useAppSelector(selectVendorLogs) as unknown as VendorLogRow[];
  const stats = useAppSelector(selectVendorStats);
  const logsStatus = useAppSelector(selectVendorLogsStatus);
  const logsError = useAppSelector((s: RootState) => s.vendorLogs.error);
  const logsPagination = useAppSelector(selectVendorLogsPagination);
  const vendors = useAppSelector(selectAdminVendors);
  const companies = useAppSelector(selectAdminCompanies);

  // Vendor name: from the loaded list when available, otherwise fetched directly (direct visits).
  const listedVendor = vendors.find((v) => v.id === vendorId);
  const [fetchedVendor, setFetchedVendor] = useState<Vendor | null>(null);
  const vendor = listedVendor ?? fetchedVendor;

  useEffect(() => {
    if (listedVendor || !vendorId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getVendor(vendorId);
        if (!cancelled) setFetchedVendor(res.data);
      } catch {
        /* header falls back to the id */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listedVendor, vendorId]);

  usePageBreadcrumbs([{ label: vendor?.name ?? `Vendor #${vendorId}` }]);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  /** One place that turns the UI filters into API params (was repeated four times). */
  const buildLogParams = useCallback(
    (page: number, limit: number) => ({
      vendor_id: vendorId,
      page,
      limit,
      ...(filters.start_date ? { start_date: filters.start_date } : {}),
      ...(filters.end_date ? { end_date: filters.end_date } : {}),
      ...(filters.payment_status ? { payment_status: filters.payment_status } : {}),
      ...(filters.company_id ? { company_id: Number(filters.company_id) } : {}),
    }),
    [vendorId, filters],
  );
  const statsParams = useMemo(
    () => ({ vendor_id: vendorId, ...(filters.company_id ? { company_id: Number(filters.company_id) } : {}) }),
    [vendorId, filters.company_id],
  );

  useEffect(() => {
    dispatch(fetchAdminCompanies({ limit: 200 }));
  }, [dispatch]);

  useEffect(() => {
    if (!vendorId) return;
    dispatch(fetchVendorStats(statsParams));
    dispatch(fetchVendorLogs(buildLogParams(1, 10)));
  }, [dispatch, vendorId, statsParams, buildLogParams]);

  const [advancesKey, setAdvancesKey] = useState(0);
  const refresh = useCallback(() => {
    setAdvancesKey((k) => k + 1);
    dispatch(fetchVendorStats(statsParams));
    dispatch(fetchVendorLogs(buildLogParams(logsPagination.page, logsPagination.limit)));
  }, [dispatch, statsParams, buildLogParams, logsPagination.page, logsPagination.limit]);

  // Record payment
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const openPayment = (log: VendorLogRow) => {
    const target = paymentTargetFor(log);
    if (!target) return;
    setPaymentTarget(target);
    setPaymentOpen(true);
  };
  const submitPayment = async (amount: number, notes: string) => {
    if (!paymentTarget) return;
    const payload =
      paymentTarget.type === "SHUTTLE"
        ? { invoice_id: paymentTarget.id, amount, notes, payment_method: "CASH" as const }
        : { booking_id: paymentTarget.id, amount, notes, payment_method: "CASH" as const };
    await dispatch(createVendorPayment(payload)).unwrap();
    toast.success("Payment recorded");
    setPaymentOpen(false);
    refresh();
  };

  // Settlement drawer
  const [settlementLog, setSettlementLog] = useState<VendorLogRow | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const openSettlement = (log: VendorLogRow) => {
    setSettlementLog(log);
    setSettlementOpen(true);
  };

  const columns = useVendorLogColumns({ showDriver: true });
  const range: DateRange | null = filters.start_date && filters.end_date ? { start: filters.start_date, end: filters.end_date } : null;
  const activeFilters = (range ? 1 : 0) + (filters.payment_status ? 1 : 0) + (filters.company_id ? 1 : 0);
  const loading = logsStatus === "loading";
  const settled = (stats?.total_cost || 0) - (stats?.total_outstanding || 0);
  const outstanding = stats?.total_outstanding || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/vendors", label: "Back to vendors" }}
        title={vendor?.name ?? `Vendor #${vendorId}`}
        description="Trip and shuttle logs, vendor cost and settlements."
        actions={<VendorPortalAccess vendorId={vendorId} canEdit={canManagePortal} />}
      />

      <KpiGrid cols={4}>
        <KpiCard label="Logs" value={formatNumber(stats?.total_rides || 0)} icon={<Route />} tone="info" loading={!stats && loading} />
        <KpiCard label="Total vendor cost" value={formatCurrency(stats?.total_cost || 0)} icon={<Receipt />} tone="neutral" loading={!stats && loading} />
        <KpiCard label="Outstanding" value={formatCurrency(outstanding)} icon={<Wallet />} tone={outstanding > 0 ? "warning" : "success"} emphasis={outstanding > 0 ? "brand" : "none"} loading={!stats && loading} />
        <KpiCard label="Settled to date" value={formatCurrency(settled)} icon={<Banknote />} tone="success" loading={!stats && loading} />
      </KpiGrid>

      <VendorAdvances vendorId={vendorId} refreshKey={advancesKey} canEdit={canEditPayments} onChanged={refresh} />

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar activeCount={activeFilters} onClear={() => setFilters(EMPTY_FILTERS)}>
            <FilterField label="Period">
              <DateRangePicker
                value={range}
                onChange={(r) => setFilters((f) => ({ ...f, start_date: r?.start ?? "", end_date: r?.end ?? "" }))}
                allowClear
                size="sm"
              />
            </FilterField>
            <FilterField label="Company">
              <Select value={filters.company_id} onChange={(e) => setFilters((f) => ({ ...f, company_id: e.target.value }))} placeholder="All companies" className="h-8 text-xs">
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Payment">
              <Select value={filters.payment_status} onChange={(e) => setFilters((f) => ({ ...f, payment_status: e.target.value }))} placeholder="All statuses" className="h-8 text-xs">
                {PAYMENT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FilterField>
          </FilterBar>
        </CardContent>
        <DataTable<VendorLogRow>
          caption="Vendor logs"
          rows={logs}
          rowKey={(log) => `${log.type}-${log.id}`}
          columns={columns}
          loading={loading}
          error={logsStatus === "failed" ? logsError : null}
          onRetry={refresh}
          empty={{ title: "No logs match these filters", description: activeFilters > 0 ? "Try widening the period or clearing filters." : "Trips and shuttle invoices for this vendor appear here." }}
          onRowClick={openSettlement}
          rowActions={(log) => {
            const target = paymentTargetFor(log);
            const payable = !!target && !isPaidStatus(log.status);
            const advanceOnly = Number(log.cost) <= 0;
            return [
              { label: "View settlement", onSelect: () => openSettlement(log) },
              {
                label: advanceOnly ? "Pay advance" : "Settle",
                icon: <Banknote />,
                hidden: !payable,
                disabled: !canEditPayments,
                onSelect: () => openPayment(log),
              },
            ];
          }}
          pagination={{
            page: logsPagination.page || 1,
            totalPages: logsPagination.pages || 1,
            total: logsPagination.total,
            pageSize: logsPagination.limit || 10,
            onPageChange: (page) => dispatch(fetchVendorLogs(buildLogParams(page, logsPagination.limit))),
          }}
        />
      </Card>

      <RecordPaymentDialog target={paymentTarget} open={paymentOpen} onOpenChange={setPaymentOpen} onSubmit={submitPayment} />
      <SettlementDrawer log={settlementLog} open={settlementOpen} onOpenChange={setSettlementOpen} canEditPayments={canEditPayments} onChanged={refresh} />
    </div>
  );
}
