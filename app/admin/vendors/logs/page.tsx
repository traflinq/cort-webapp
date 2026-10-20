"use client";

import { useCallback, useEffect, useState } from "react";
import { Receipt, Route, Ruler, Wallet } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../../lib/store/hooks";
import {
  fetchVendorLogs,
  fetchVendorStats,
  setFilters,
  clearFilters,
  selectVendorLogs,
  selectVendorStats,
  selectVendorLogsStatus,
  selectVendorLogsFilters,
  selectVendorLogsPagination,
} from "../../../lib/store/slices/vendorLogsSlice";
import { fetchAdminVendors, selectAdminVendors } from "../../../lib/store/slices/adminVendorsSlice";
import type { RootState } from "../../../lib/store/store";
import { AdminProtectedPage } from "../../components/AdminProtectedPage";
import { useAdminAbility } from "../../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../../lib/abilities/admin-subjects";
import { Card, CardContent, DataTable, DateRangePicker, FilterBar, FilterField, KpiCard, KpiGrid, PageHeader, Select, type DateRange } from "../../ui";
import { formatCurrency, formatNumber } from "../../lib/format";
import { useVendorLogColumns } from "../components/log-columns";
import { SettlementDrawer } from "../components/SettlementDrawer";
import { VendorDistanceDialog } from "../components/VendorDistanceDialog";
import { PAYMENT_STATUS_OPTIONS, type VendorLogRow } from "../components/types";

export default function VendorLogsPage() {
  return (
    <AdminProtectedPage permission="vendor_logs" subject={ADMIN_SUBJECTS.vendor_logs}>
      <VendorLogsContent />
    </AdminProtectedPage>
  );
}

function VendorLogsContent() {
  const dispatch = useAppDispatch();
  const ability = useAdminAbility();
  const canEditPayments = ability.can("update", ADMIN_SUBJECTS.vendor_logs);

  const logs = useAppSelector(selectVendorLogs) as unknown as VendorLogRow[];
  const stats = useAppSelector(selectVendorStats);
  const status = useAppSelector(selectVendorLogsStatus);
  const error = useAppSelector((s: RootState) => s.vendorLogs.error);
  const filters = useAppSelector(selectVendorLogsFilters);
  const pagination = useAppSelector(selectVendorLogsPagination);
  const vendors = useAppSelector(selectAdminVendors);

  useEffect(() => {
    dispatch(fetchAdminVendors({ limit: 100 }));
  }, [dispatch]);

  const refresh = useCallback(() => {
    dispatch(fetchVendorStats({ vendor_id: filters.vendor_id, company_id: filters.company_id }));
    dispatch(fetchVendorLogs(filters));
  }, [dispatch, filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const [settlementLog, setSettlementLog] = useState<VendorLogRow | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [distanceLog, setDistanceLog] = useState<VendorLogRow | null>(null);
  const [distanceOpen, setDistanceOpen] = useState(false);

  const openSettlement = (log: VendorLogRow) => {
    setSettlementLog(log);
    setSettlementOpen(true);
  };

  const columns = useVendorLogColumns({ showVendor: true, showDistance: true });
  const range: DateRange | null = filters.start_date && filters.end_date ? { start: filters.start_date, end: filters.end_date } : null;
  const activeFilters = (filters.vendor_id ? 1 : 0) + (range ? 1 : 0) + (filters.payment_status ? 1 : 0);
  const loading = status === "loading";
  const outstanding = Number(stats?.total_outstanding || 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Vendor trip logs" description="Partner vehicle trips, vendor cost and payments across all vendors." />

      <KpiGrid cols={3}>
        <KpiCard label="Total rides" value={formatNumber(stats?.total_rides || 0)} icon={<Route />} tone="info" loading={!stats && loading} />
        <KpiCard label="Total vendor cost" value={formatCurrency(stats?.total_cost || 0)} icon={<Receipt />} tone="neutral" loading={!stats && loading} />
        <KpiCard label="Outstanding" value={formatCurrency(outstanding)} icon={<Wallet />} tone={outstanding > 0 ? "warning" : "success"} emphasis={outstanding > 0 ? "brand" : "none"} loading={!stats && loading} />
      </KpiGrid>

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar activeCount={activeFilters} onClear={() => dispatch(clearFilters())}>
            <FilterField label="Vendor">
              <Select
                value={filters.vendor_id ?? ""}
                onChange={(e) => dispatch(setFilters({ vendor_id: Number(e.target.value) || undefined }))}
                placeholder="All vendors"
                className="h-8 text-xs"
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Period">
              <DateRangePicker value={range} onChange={(r) => dispatch(setFilters({ start_date: r?.start || undefined, end_date: r?.end || undefined }))} allowClear size="sm" />
            </FilterField>
            <FilterField label="Payment">
              <Select value={filters.payment_status ?? ""} onChange={(e) => dispatch(setFilters({ payment_status: e.target.value || undefined }))} placeholder="All statuses" className="h-8 text-xs">
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
          caption="Vendor trip logs"
          rows={logs}
          rowKey={(log) => `${log.type}-${log.id}`}
          columns={columns}
          loading={loading}
          error={status === "failed" ? error : null}
          onRetry={refresh}
          empty={{ title: "No trips match your filters", description: activeFilters > 0 ? "Try widening the period or clearing filters." : "Vendor trips appear here once partner vehicles complete bookings." }}
          onRowClick={openSettlement}
          rowActions={(log) => [
            { label: "View settlement", onSelect: () => openSettlement(log) },
            {
              label: "Edit vendor distance",
              icon: <Ruler />,
              hidden: log.type !== "CHAUFFEUR" || !log.booking_id,
              disabled: !canEditPayments,
              onSelect: () => {
                setDistanceLog(log);
                setDistanceOpen(true);
              },
            },
          ]}
          pagination={{
            page: pagination.page || 1,
            totalPages: pagination.pages || 1,
            total: pagination.total,
            pageSize: pagination.limit || 10,
            onPageChange: (page) => dispatch(setFilters({ page })),
          }}
        />
      </Card>

      <SettlementDrawer log={settlementLog} open={settlementOpen} onOpenChange={setSettlementOpen} canEditPayments={canEditPayments} onChanged={refresh} />
      <VendorDistanceDialog
        log={distanceLog}
        open={distanceOpen}
        onOpenChange={setDistanceOpen}
        onSaved={() => {
          setDistanceOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
