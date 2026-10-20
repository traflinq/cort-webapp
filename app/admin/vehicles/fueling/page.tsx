"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, Droplets, Fuel, Gauge, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "../../../lib/store/hooks";
import { useAuth } from "../../../lib/contexts/auth-context";
import { useConfirm } from "../../../lib/hooks/useConfirm";
import { PermissionGate } from "../../components/PermissionGate";
import { AdminCan, useAdminAbility } from "../../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../../lib/abilities/admin-subjects";
import {
  fetchFuelRecords,
  createFuelRecord,
  updateFuelRecord,
  deleteFuelRecord,
  fetchAdminVehicles,
  markFuelRecordsAsPaid,
  selectFuelRecords,
  selectFuelStatus,
  selectFuelActionStatus,
  selectFuelPagination,
  selectAdminVehicles,
  selectFuelFilters,
  resetFuelActionStatus,
} from "../../../lib/store/slices/adminVehiclesSlice";
import {
  FuelRecord,
  CreateFuelRecordRequest,
  UpdateFuelRecordRequest,
  QueryFuelRecordParams,
  OwnershipType,
  apiClient,
} from "../../../lib/services/api-client";
import { BookingTagPicker, TaggedBooking } from "../../components/BookingTagPicker";
import { formatCurrency, formatDate, formatNumber } from "../../lib/format";
import { currentMonthRange, todayYmd, type DateRange } from "../../lib/dates";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  DataTable,
  DateRangePicker,
  Dialog,
  DialogContent,
  Field,
  FilterBar,
  FilterField,
  FormGrid,
  Input,
  KpiCard,
  KpiGrid,
  PageHeader,
  Select,
  StatusBadge,
  Tooltip,
  type DataTableColumn,
  type RowKey,
} from "../../ui";

export default function FuelingPage() {
  return (
    <PermissionGate permission="fuel_records">
      <AdminCan I="read" a="FuelRecords">
        <FuelingPageContent />
      </AdminCan>
    </PermissionGate>
  );
}

type FuelFormData = Omit<Partial<CreateFuelRecordRequest>, "booking_id"> & { booking_id?: number | null };

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

function FuelingPageContent() {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const { user, isSuperAdmin } = useAuth();
  const ability = useAdminAbility();
  const canCreate = ability.can("create", ADMIN_SUBJECTS.fuel_records);
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.fuel_records);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.fuel_records);

  const records = useAppSelector(selectFuelRecords);
  const vehicles = useAppSelector(selectAdminVehicles);
  const status = useAppSelector(selectFuelStatus);
  const actionStatus = useAppSelector(selectFuelActionStatus);
  const pagination = useAppSelector(selectFuelPagination);
  const savedFilters = useAppSelector(selectFuelFilters);

  // Filters — restore from Redux, default to the current month.
  const [filterVehicleId, setFilterVehicleId] = useState<number | "ALL">(savedFilters.filterVehicleId);
  const [filterBilled, setFilterBilled] = useState<boolean | "ALL">(savedFilters.filterBilled);
  const [range, setRange] = useState<DateRange | null>(() =>
    savedFilters.startDate || savedFilters.endDate ? { start: savedFilters.startDate, end: savedFilters.endDate } : currentMonthRange(),
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<RowKey[]>([]);

  // Dialog
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedRecord, setSelectedRecord] = useState<FuelRecord | null>(null);
  const [formData, setFormData] = useState<FuelFormData>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [taggedBooking, setTaggedBooking] = useState<TaggedBooking | null>(null);
  const [previousOdometer, setPreviousOdometer] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const buildParams = (): QueryFuelRecordParams => {
    const params: QueryFuelRecordParams = { page, limit: pageSize };
    if (filterVehicleId !== "ALL") params.vehicle_id = filterVehicleId;
    if (filterBilled !== "ALL") params.billed = filterBilled;
    if (range?.start) params.start_date = range.start;
    if (range?.end) params.end_date = range.end;
    return params;
  };

  const loadData = async () => {
    setLoadError(null);
    try {
      await dispatch(fetchFuelRecords(buildParams())).unwrap();
    } catch (err) {
      setLoadError(errorMessage(err, "Failed to load fuel records"));
    }
  };

  useEffect(() => {
    // Vehicle picker: owned vehicles only (same call as before the redesign).
    dispatch(fetchAdminVehicles({ limit: 500, show_all: true, ownership: OwnershipType.OWNED }));
  }, [dispatch]);

  // Fetch whenever the query changes (filters, page, page size). Filters reset the page to 1.
  const lastQuery = useRef<string | null>(null);
  const queryKey = JSON.stringify({ filterVehicleId, filterBilled, range, page, pageSize });
  useEffect(() => {
    if (lastQuery.current === queryKey) return;
    lastQuery.current = queryKey;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const onFilterChange = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
    setSelectedIds([]);
  };

  // Previous odometer for the chosen vehicle (for km-driven preview in the form).
  useEffect(() => {
    if (!isModalOpen || !formData.vehicle_id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getPreviousFuelOdometer({
          vehicle_id: formData.vehicle_id!,
          before_record_id: modalMode === "edit" && selectedRecord ? selectedRecord.id : undefined,
        });
        if (!cancelled) setPreviousOdometer(res.data?.odometer_reading != null ? Number(res.data.odometer_reading) : null);
      } catch {
        if (!cancelled) setPreviousOdometer(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isModalOpen, formData.vehicle_id, modalMode, selectedRecord]);

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
    setFormData({});
    setFormError(null);
    setTaggedBooking(null);
    setPreviousOdometer(null);
  };

  const afterAction = () => {
    dispatch(resetFuelActionStatus());
    setSelectedIds([]);
    void loadData();
  };

  const handleCreate = async () => {
    if (!formData.vehicle_id || !formData.date || !formData.fuel_litres || !formData.current_fuel_rate) {
      setFormError("Vehicle, date, litres and fuel rate are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await dispatch(createFuelRecord(formData as CreateFuelRecordRequest)).unwrap();
      toast.success("Fuel record added");
      closeModal();
      afterAction();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to add fuel record"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRecord) return;
    setIsSubmitting(true);
    try {
      await dispatch(updateFuelRecord({ id: selectedRecord.id, data: formData as UpdateFuelRecordRequest })).unwrap();
      toast.success("Fuel record updated");
      closeModal();
      afterAction();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update fuel record"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (record: FuelRecord) => {
    const isOwner = isSuperAdmin || record.created_by === user?.id;
    const label = `${record.vehicles?.plate_number ?? "vehicle"} · ${formatDate(record.date)} · ${formatCurrency(record.fuel_cost)}`;
    const ok = isOwner
      ? await confirm({
          title: "Delete this fuel record?",
          message: label,
          consequences: ["The record is removed from fuel totals and mileage calculations", "This cannot be undone"],
          destructive: true,
          confirmLabel: "Delete record",
        })
      : await confirm({
          title: "Request deletion?",
          message: label,
          description: "You didn't add this record, so deleting it sends a request to the super admin for approval. The record stays until it is approved.",
          confirmLabel: "Send request",
        });
    if (!ok) return;
    try {
      const result = await dispatch(deleteFuelRecord(record.id)).unwrap();
      if (result.requiresApproval) toast.success(result.message || "Delete request sent for super admin approval");
      else toast.success("Fuel record deleted");
      afterAction();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete fuel record"));
    }
  };

  const handleBulkPay = async (keys: RowKey[], clear: () => void) => {
    const ids = keys.map(Number);
    if (ids.length === 0) return;
    const total = records.filter((r) => ids.includes(r.id)).reduce((s, r) => s + Number(r.fuel_cost), 0);
    const ok = await confirm({
      title: `Mark ${ids.length} record${ids.length === 1 ? "" : "s"} as paid?`,
      message: `Total ${formatCurrency(total)}.`,
      consequences: ["Paid records are excluded from the unpaid filter and can't be bulk-selected again"],
      confirmLabel: "Mark as paid",
    });
    if (!ok) return;
    try {
      await dispatch(markFuelRecordsAsPaid(ids)).unwrap();
      toast.success(`${ids.length} record${ids.length === 1 ? "" : "s"} marked as paid`);
      clear();
      afterAction();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to mark records as paid"));
    }
  };

  const startCreate = async () => {
    setSelectedRecord(null);
    let autoRate: number | undefined;
    try {
      const res = await apiClient.getSystemSetting("current_fuel_price");
      const val = Number(res.data.value);
      if (!Number.isNaN(val) && val > 0) autoRate = val;
    } catch {
      // user can enter the rate manually
    }
    setFormData({ date: todayYmd(), current_fuel_rate: autoRate });
    setFormError(null);
    setTaggedBooking(null);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const startEdit = (record: FuelRecord) => {
    setSelectedRecord(record);
    setFormData({
      vehicle_id: record.vehicle_id,
      date: record.date ? record.date.split("T")[0] : "",
      fuel_litres: record.fuel_litres,
      current_fuel_rate: record.current_fuel_rate,
      odometer_reading: record.odometer_reading ?? undefined,
      billed: record.billed,
      booking_id: record.booking_id ?? undefined,
      receipt_id: record.receipt_id ?? undefined,
    });
    setFormError(null);
    setTaggedBooking(record.booking_id ? { id: record.booking_id, label: `Booking #${record.booking_id}` } : null);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  // Stats are computed from the records on this page (the list endpoint is paginated).
  const stats = useMemo(() => {
    const totalCost = records.reduce((sum, r) => sum + Number(r.fuel_cost), 0);
    const avgRate = records.length > 0 ? records.reduce((sum, r) => sum + Number(r.current_fuel_rate), 0) / records.length : 0;
    const mileage = records.map((r) => r.mileage_km_per_litre).filter((v): v is number => v != null && v > 0);
    const avgMileage = mileage.length > 0 ? mileage.reduce((s, v) => s + v, 0) / mileage.length : null;
    return { totalCost, avgRate, avgMileage, mileageIntervals: mileage.length };
  }, [records]);

  const isLoading = status === "loading";
  const isPaginated = pagination.pages > 1;
  const scopeHint = isPaginated ? `Across ${records.length} records on this page` : `Across ${records.length} record${records.length === 1 ? "" : "s"}`;
  const activeFilters = (filterVehicleId !== "ALL" ? 1 : 0) + (filterBilled !== "ALL" ? 1 : 0) + (range ? 1 : 0);

  const kmDriven = previousOdometer != null && formData.odometer_reading ? Number(formData.odometer_reading) - previousOdometer : null;
  const calculatedCost = formData.fuel_litres && formData.current_fuel_rate ? formData.fuel_litres * formData.current_fuel_rate : null;

  const columns = useMemo<DataTableColumn<FuelRecord>[]>(
    () => [
      { key: "date", header: "Date", cell: (r) => <span className="whitespace-nowrap font-medium text-fg">{formatDate(r.date)}</span> },
      {
        key: "vehicle",
        header: "Vehicle",
        cell: (r) => (
          <div className="min-w-0">
            <div className="font-mono text-[13px] font-medium text-fg">{r.vehicles?.plate_number ?? "—"}</div>
            <div className="text-xs text-fg-muted">
              {r.vehicles?.make} {r.vehicles?.model}
            </div>
            {r.booking_id && (
              <Tooltip content={`Tagged to booking #${r.booking_id} — actual fuel cost is attributed to this ride's chauffeur COGS`}>
                <span className="mt-1 inline-block">
                  <Badge tone="purple" size="sm">
                    Booking #{r.booking_id}
                  </Badge>
                </span>
              </Tooltip>
            )}
          </div>
        ),
      },
      { key: "odometer", header: "Odometer", align: "right", mono: true, hideBelow: "lg", cell: (r) => (r.odometer_reading ? `${formatNumber(r.odometer_reading)} km` : <span className="text-fg-muted">—</span>) },
      {
        key: "mileage",
        header: "Mileage",
        align: "right",
        hideBelow: "lg",
        cell: (r) =>
          r.mileage_km_per_litre != null && r.mileage_km_driven != null ? (
            <div className="tabular-nums">
              <div className="font-medium text-fg">
                {r.mileage_km_per_litre.toFixed(1)} <span className="text-xs font-normal text-fg-muted">km/L</span>
              </div>
              <div className="text-xs text-fg-muted">{formatNumber(r.mileage_km_driven)} km</div>
            </div>
          ) : (
            <span className="text-fg-muted">—</span>
          ),
      },
      { key: "litres", header: "Litres", align: "right", mono: true, cell: (r) => `${Number(r.fuel_litres)} L` },
      { key: "rate", header: "Rate", align: "right", mono: true, hideBelow: "md", cell: (r) => `${formatCurrency(r.current_fuel_rate, { digits: 2 })}/L` },
      { key: "cost", header: "Cost", align: "right", mono: true, cell: (r) => <span className="font-semibold text-fg">{formatCurrency(r.fuel_cost, { digits: 2 })}</span> },
      { key: "receipt", header: "Receipt", mono: true, hideBelow: "xl", cell: (r) => r.receipt_id || <span className="text-fg-muted">—</span> },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.billed ? "PAID" : "UNPAID"} /> },
      { key: "added_by", header: "Added by", hideBelow: "xl", cell: (r) => <span className="text-fg-muted">{r.added_by_name || "—"}</span> },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fuel records"
        description="Fuel purchases, mileage between fills and payment status."
        actions={
          <Button leftIcon={<Plus />} onClick={startCreate} disabled={!canCreate}>
            Add fuel record
          </Button>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard label="Total fuel cost" value={formatCurrency(stats.totalCost)} hint={scopeHint} icon={<Fuel />} tone="brand" loading={isLoading && records.length === 0} />
        <KpiCard label="Average fuel rate" value={`${formatCurrency(stats.avgRate, { digits: 2 })}/L`} hint={scopeHint} icon={<Droplets />} tone="info" loading={isLoading && records.length === 0} />
        <KpiCard label="Records" value={isPaginated ? `${records.length} of ${formatNumber(pagination.total)}` : records.length} hint={isPaginated ? "On this page / matching filters" : "Matching filters"} icon={<Receipt />} loading={isLoading && records.length === 0} />
        <KpiCard
          label="Average mileage"
          value={stats.avgMileage != null ? `${stats.avgMileage.toFixed(1)} km/L` : "—"}
          hint={stats.avgMileage != null ? `Based on ${stats.mileageIntervals} interval${stats.mileageIntervals === 1 ? "" : "s"}` : "Add odometer readings to track mileage"}
          icon={<Gauge />}
          tone="success"
          loading={isLoading && records.length === 0}
        />
      </KpiGrid>

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar
            activeCount={activeFilters}
            onClear={() => {
              onFilterChange(setFilterVehicleId)("ALL");
              onFilterChange(setFilterBilled)("ALL");
              onFilterChange(setRange)(null);
            }}
          >
            <FilterField label="Vehicle">
              <Select value={filterVehicleId} onChange={(e) => onFilterChange(setFilterVehicleId)(e.target.value === "ALL" ? "ALL" : Number(e.target.value))} className="h-8 text-xs">
                <option value="ALL">All vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Status">
              <Select value={String(filterBilled)} onChange={(e) => onFilterChange(setFilterBilled)(e.target.value === "ALL" ? "ALL" : e.target.value === "true")} className="h-8 text-xs">
                <option value="ALL">All</option>
                <option value="true">Paid</option>
                <option value="false">Unpaid</option>
              </Select>
            </FilterField>
            <FilterField label="Period">
              <DateRangePicker value={range} onChange={onFilterChange(setRange)} size="sm" allowClear />
            </FilterField>
          </FilterBar>
        </CardContent>

        <DataTable<FuelRecord>
          caption="Fuel records"
          columns={columns}
          rows={records}
          rowKey={(r) => r.id}
          loading={isLoading}
          error={loadError}
          onRetry={() => void loadData()}
          empty={{
            icon: <Fuel aria-hidden="true" />,
            title: activeFilters > 0 ? "No fuel records match these filters" : "No fuel records yet",
            description: activeFilters > 0 ? "Try widening the period or clearing filters." : "Add the first fuel purchase to start tracking cost and mileage.",
          }}
          selectable={canUpdate}
          selectedKeys={selectedIds}
          onSelectedKeysChange={setSelectedIds}
          isRowSelectable={(r) => !r.billed}
          bulkActions={(keys, clear) => (
            <Button size="sm" leftIcon={<CheckCheck />} onClick={() => void handleBulkPay(keys, clear)} loading={actionStatus === "loading"}>
              Mark {keys.length} as paid
            </Button>
          )}
          rowActions={(r) => [
            { label: "Edit", icon: <Pencil />, onSelect: () => startEdit(r), disabled: !canUpdate },
            { label: "Delete", icon: <Trash2 />, destructive: true, separatorBefore: true, onSelect: () => void handleDelete(r), disabled: !canDelete },
          ]}
          pagination={{
            page: pagination.page || page,
            totalPages: pagination.pages,
            total: pagination.total,
            pageSize,
            onPageChange: (p) => {
              setPage(p);
              setSelectedIds([]);
            },
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(1);
              setSelectedIds([]);
            },
            pageSizeOptions: [25, 50, 100],
          }}
        />
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && !isSubmitting && closeModal()}>
        <DialogContent
          size="lg"
          title={modalMode === "create" ? "Add fuel record" : "Edit fuel record"}
          description={modalMode === "edit" && selectedRecord ? `${selectedRecord.vehicles?.plate_number ?? ""} · ${formatDate(selectedRecord.date)}` : "Fields marked * are required."}
          footer={
            <>
              <Button variant="outline" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={modalMode === "create" ? handleCreate : handleUpdate} loading={isSubmitting} disabled={modalMode === "create" ? !canCreate : !canUpdate}>
                {modalMode === "create" ? "Add record" : "Save changes"}
              </Button>
            </>
          }
        >
          <FormGrid cols={2}>
            <Field label="Vehicle" required className="sm:col-span-2">
              <Select value={formData.vehicle_id || ""} onChange={(e) => setFormData({ ...formData, vehicle_id: Number(e.target.value) })} placeholder="Select vehicle" disabled={isSubmitting}>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number} — {v.make} {v.model}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" required>
              <Input type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} disabled={isSubmitting} />
            </Field>
            <Field label="Fuel litres" required>
              <Input type="number" step="0.01" min={0} value={formData.fuel_litres || ""} onChange={(e) => setFormData({ ...formData, fuel_litres: Number(e.target.value) })} placeholder="50.00" disabled={isSubmitting} />
            </Field>
            <Field label="Fuel rate (PKR/L)" required hint={modalMode === "create" && formData.current_fuel_rate ? "Pre-filled from the current system fuel price." : undefined}>
              <Input type="number" step="0.01" min={0} value={formData.current_fuel_rate || ""} onChange={(e) => setFormData({ ...formData, current_fuel_rate: Number(e.target.value) })} placeholder="280.00" disabled={isSubmitting} />
            </Field>
            <Field
              label="Odometer reading (km)"
              hint={
                previousOdometer != null && formData.vehicle_id ? (
                  <>
                    Last reading <span className="font-medium text-fg">{formatNumber(previousOdometer)} km</span>
                    {kmDriven != null && kmDriven > 0 && (
                      <>
                        {" · "}
                        <span className="font-medium text-fg">{formatNumber(kmDriven)} km driven</span>
                        {formData.fuel_litres && formData.fuel_litres > 0 && (
                          <>
                            {" · "}
                            <span className="font-medium text-success-ink">{(kmDriven / formData.fuel_litres).toFixed(1)} km/L</span>
                          </>
                        )}
                      </>
                    )}
                  </>
                ) : undefined
              }
            >
              <Input type="number" step="1" min={0} value={formData.odometer_reading || ""} onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value ? Number(e.target.value) : undefined })} placeholder="45230" disabled={isSubmitting} />
            </Field>
            <Field label="Receipt ID">
              <Input mono value={formData.receipt_id || ""} onChange={(e) => setFormData({ ...formData, receipt_id: e.target.value || undefined })} placeholder="RCP-20250812-0042" disabled={isSubmitting} />
            </Field>
            <Field
              label="Tag to a booking"
              hint="Optional. Tagging attributes the actual fuel cost to that ride's chauffeur COGS; customer billing still uses distance × contract rate."
              className="sm:col-span-2"
            >
              <BookingTagPicker
                value={taggedBooking}
                onChange={(b) => {
                  setTaggedBooking(b);
                  setFormData({ ...formData, booking_id: b ? b.id : null });
                }}
                vehicleId={formData.vehicle_id}
              />
            </Field>
            {modalMode === "edit" && (
              <div className="sm:col-span-2">
                <Checkbox label="Paid" description="Mark this fuel purchase as settled." checked={!!formData.billed} onCheckedChange={(c) => setFormData({ ...formData, billed: c === true })} disabled={isSubmitting} />
              </div>
            )}
            {calculatedCost != null && (
              <div className="rounded-lg border border-info-line bg-info-soft px-4 py-3 sm:col-span-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Calculated cost</div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{formatCurrency(calculatedCost, { digits: 2 })}</div>
              </div>
            )}
            {formError && (
              <p role="alert" className="text-sm text-danger-ink sm:col-span-2">
                {formError}
              </p>
            )}
          </FormGrid>
        </DialogContent>
      </Dialog>
    </div>
  );
}
