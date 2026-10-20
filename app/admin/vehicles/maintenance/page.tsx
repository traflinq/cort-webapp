"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "../../../lib/store/hooks";
import { useAuth } from "../../../lib/contexts/auth-context";
import { useConfirm } from "../../../lib/hooks/useConfirm";
import { PermissionGate } from "../../components/PermissionGate";
import { AdminCan, useAdminAbility } from "../../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../../lib/abilities/admin-subjects";
import {
  fetchMaintenanceRecords,
  fetchUpcomingMaintenance,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
  markMaintenanceRecordAsPaid,
  fetchAdminVehicles,
  selectMaintenanceRecords,
  selectUpcomingMaintenance,
  selectMaintenanceStatus,
  selectMaintenanceActionStatus,
  selectMaintenancePagination,
  selectAdminVehicles,
  selectMaintenanceFilters,
  resetMaintenanceActionStatus,
} from "../../../lib/store/slices/adminVehiclesSlice";
import {
  MaintenanceRecord,
  MaintenanceType,
  CreateMaintenanceRecordRequest,
  UpdateMaintenanceRecordRequest,
  QueryMaintenanceRecordParams,
  OwnershipType,
} from "../../../lib/services/api-client";
import { formatCurrency, formatDate, formatNumber, humanize } from "../../lib/format";
import { todayYmd, type DateRange } from "../../lib/dates";
import {
  Button,
  Card,
  CardContent,
  DataTable,
  DateRangePicker,
  Dialog,
  DialogContent,
  Field,
  FilterBar,
  FilterField,
  FormGrid,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  type DataTableColumn,
  type StatusEntry,
} from "../../ui";

export default function MaintenancePage() {
  return (
    <PermissionGate permission="maintenance">
      <AdminCan I="read" a="Maintenance">
        <MaintenancePageContent />
      </AdminCan>
    </PermissionGate>
  );
}

/** Tone per maintenance type (passed as StatusBadge overrides; the shared registry stays untouched). */
const TYPE_TONES: Record<string, StatusEntry> = {
  OIL_CHANGE: { tone: "info", label: "Oil change" },
  TIRE_ROTATION: { tone: "purple", label: "Tire rotation" },
  BRAKE_SERVICE: { tone: "danger", label: "Brake service" },
  GENERAL_INSPECTION: { tone: "success", label: "General inspection" },
  REPAIR: { tone: "warning", label: "Repair" },
  OTHER: { tone: "neutral", label: "Other" },
};

type UpcomingItem = { vehicle_id: number; plate_number: string; make?: string; model?: string; next_service_odometer: number };

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

function MaintenancePageContent() {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const { user, isSuperAdmin } = useAuth();
  const ability = useAdminAbility();
  const canCreate = ability.can("create", ADMIN_SUBJECTS.maintenance);
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.maintenance);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.maintenance);

  const records = useAppSelector(selectMaintenanceRecords);
  const vehicles = useAppSelector(selectAdminVehicles);
  const upcomingMaintenance = useAppSelector(selectUpcomingMaintenance) as UpcomingItem[];
  const status = useAppSelector(selectMaintenanceStatus);
  const actionStatus = useAppSelector(selectMaintenanceActionStatus);
  const pagination = useAppSelector(selectMaintenancePagination);
  const savedFilters = useAppSelector(selectMaintenanceFilters);

  // Filters — initialised from Redux once; no re-sync effect, so user edits are never reset.
  const [filterVehicleId, setFilterVehicleId] = useState<number | "ALL">(savedFilters.filterVehicleId);
  const [filterType, setFilterType] = useState<MaintenanceType | "ALL">(savedFilters.filterType);
  const [range, setRange] = useState<DateRange | null>(() =>
    savedFilters.startDate || savedFilters.endDate ? { start: savedFilters.startDate, end: savedFilters.endDate } : null,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dialog
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [formData, setFormData] = useState<Partial<CreateMaintenanceRecordRequest>>({});
  const [formError, setFormError] = useState<string | null>(null);
  /** Interval until next oil change; converted to absolute next_service_odometer on save. */
  const [oilChangeIntervalKm, setOilChangeIntervalKm] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const buildParams = (): QueryMaintenanceRecordParams => {
    const params: QueryMaintenanceRecordParams = { page, limit: pageSize };
    if (filterVehicleId !== "ALL") params.vehicle_id = filterVehicleId;
    if (filterType !== "ALL") params.maintenance_type = filterType;
    if (range?.start) params.start_date = range.start;
    if (range?.end) params.end_date = range.end;
    return params;
  };

  const loadData = async () => {
    setLoadError(null);
    dispatch(fetchUpcomingMaintenance());
    try {
      await dispatch(fetchMaintenanceRecords(buildParams())).unwrap();
    } catch (err) {
      setLoadError(errorMessage(err, "Failed to load maintenance records"));
    }
  };

  useEffect(() => {
    // Vehicle picker: owned vehicles only (unchanged call).
    dispatch(fetchAdminVehicles({ limit: 500, show_all: true, ownership: OwnershipType.OWNED }));
  }, [dispatch]);

  const lastQuery = useRef<string | null>(null);
  const queryKey = JSON.stringify({ filterVehicleId, filterType, range, page, pageSize });
  useEffect(() => {
    if (lastQuery.current === queryKey) return;
    lastQuery.current = queryKey;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const onFilterChange = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
    setFormData({});
    setFormError(null);
    setOilChangeIntervalKm("");
  };

  const afterAction = () => {
    dispatch(resetMaintenanceActionStatus());
    void loadData();
  };

  const resolveOilInterval = (odometer: number): number | null => {
    const interval = Number(oilChangeIntervalKm);
    if (!oilChangeIntervalKm || Number.isNaN(interval) || interval <= 0) {
      setFormError("Enter how many km until the next oil change (e.g. 5000).");
      return null;
    }
    if (Number.isNaN(odometer)) {
      setFormError("Enter a valid odometer reading.");
      return null;
    }
    return odometer + interval;
  };

  const handleCreate = async () => {
    if (!formData.vehicle_id || !formData.maintenance_type || !formData.date || !formData.odometer_reading) {
      setFormError("Vehicle, type, date and odometer reading are required.");
      return;
    }
    const payload: CreateMaintenanceRecordRequest = { ...(formData as CreateMaintenanceRecordRequest) };
    if (formData.maintenance_type === MaintenanceType.OIL_CHANGE) {
      const next = resolveOilInterval(Number(formData.odometer_reading));
      if (next == null) return;
      payload.next_service_odometer = next;
    }
    setIsSubmitting(true);
    try {
      await dispatch(createMaintenanceRecord(payload)).unwrap();
      toast.success("Maintenance record added");
      closeModal();
      afterAction();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to add maintenance record"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRecord) return;
    const payload: UpdateMaintenanceRecordRequest = { ...formData };
    const type = formData.maintenance_type ?? selectedRecord.maintenance_type;
    if (type === MaintenanceType.OIL_CHANGE) {
      const next = resolveOilInterval(Number(formData.odometer_reading ?? selectedRecord.odometer_reading));
      if (next == null) return;
      payload.next_service_odometer = next;
    }
    setIsSubmitting(true);
    try {
      await dispatch(updateMaintenanceRecord({ id: selectedRecord.id, data: payload })).unwrap();
      toast.success("Maintenance record updated");
      closeModal();
      afterAction();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update maintenance record"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (record: MaintenanceRecord) => {
    const isOwner = isSuperAdmin || record.created_by === user?.id;
    const label = `${record.vehicles?.plate_number ?? "vehicle"} · ${humanize(record.maintenance_type)} · ${formatDate(record.date)}`;
    const ok = isOwner
      ? await confirm({
          title: "Delete this maintenance record?",
          message: label,
          consequences: ["The service history and any next-service reminder from this record are removed", "This cannot be undone"],
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
      const result = await dispatch(deleteMaintenanceRecord(record.id)).unwrap();
      if (result.requiresApproval) toast.success(result.message || "Delete request sent for super admin approval");
      else toast.success("Maintenance record deleted");
      afterAction();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete maintenance record"));
    }
  };

  const handleMarkAsPaid = async (record: MaintenanceRecord) => {
    const ok = await confirm({
      title: "Mark as paid?",
      message: `${record.vehicles?.plate_number ?? "Vehicle"} · ${humanize(record.maintenance_type)} · ${record.cost ? formatCurrency(record.cost) : "no cost recorded"}`,
      consequences: ["The record is marked paid with today's date"],
      confirmLabel: "Mark as paid",
    });
    if (!ok) return;
    try {
      await dispatch(markMaintenanceRecordAsPaid(record.id)).unwrap();
      toast.success("Maintenance record marked as paid");
      afterAction();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to mark maintenance record as paid"));
    }
  };

  const startCreate = () => {
    setSelectedRecord(null);
    setFormData({ date: todayYmd(), maintenance_type: MaintenanceType.OIL_CHANGE });
    setOilChangeIntervalKm("");
    setFormError(null);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const startEdit = (record: MaintenanceRecord) => {
    setSelectedRecord(record);
    setFormData({
      vehicle_id: record.vehicle_id,
      maintenance_type: record.maintenance_type,
      date: record.date ? record.date.split("T")[0] : "",
      odometer_reading: record.odometer_reading,
      next_service_odometer: record.next_service_odometer ?? undefined,
      cost: record.cost || undefined,
      notes: record.notes || undefined,
    });
    if (record.maintenance_type === MaintenanceType.OIL_CHANGE && record.next_service_odometer != null && record.odometer_reading != null) {
      const interval = Number(record.next_service_odometer) - Number(record.odometer_reading);
      setOilChangeIntervalKm(interval > 0 ? interval : "");
    } else {
      setOilChangeIntervalKm("");
    }
    setFormError(null);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const isLoading = status === "loading";
  const activeFilters = (filterVehicleId !== "ALL" ? 1 : 0) + (filterType !== "ALL" ? 1 : 0) + (range ? 1 : 0);
  const nextOilChange =
    formData.maintenance_type === MaintenanceType.OIL_CHANGE && formData.odometer_reading && oilChangeIntervalKm !== "" && Number(oilChangeIntervalKm) > 0
      ? Number(formData.odometer_reading) + Number(oilChangeIntervalKm)
      : null;

  const columns = useMemo<DataTableColumn<MaintenanceRecord>[]>(
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
          </div>
        ),
      },
      { key: "type", header: "Type", cell: (r) => <StatusBadge status={r.maintenance_type} overrides={TYPE_TONES} dot={false} /> },
      { key: "odometer", header: "Odometer", align: "right", mono: true, hideBelow: "md", cell: (r) => `${formatNumber(r.odometer_reading)} km` },
      { key: "next", header: "Next service", align: "right", mono: true, hideBelow: "lg", cell: (r) => (r.next_service_odometer ? `${formatNumber(r.next_service_odometer)} km` : <span className="text-fg-muted">—</span>) },
      { key: "cost", header: "Cost", align: "right", mono: true, cell: (r) => (r.cost ? <span className="font-semibold text-fg">{formatCurrency(r.cost, { digits: 2 })}</span> : <span className="text-fg-muted">—</span>) },
      { key: "payment", header: "Payment", cell: (r) => <StatusBadge status={r.payment_status || "UNPAID"} /> },
      { key: "added_by", header: "Added by", hideBelow: "xl", cell: (r) => <span className="text-fg-muted">{r.added_by_name || "—"}</span> },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Service records, costs and upcoming oil changes."
        actions={
          <Button leftIcon={<Plus />} onClick={startCreate} disabled={!canCreate}>
            Add maintenance record
          </Button>
        }
      />

      {upcomingMaintenance && upcomingMaintenance.length > 0 && (
        <section role="status" aria-label="Vehicles due for maintenance" className="rounded-xl border border-warning-line bg-warning-soft p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-fg">
                {upcomingMaintenance.length} vehicle{upcomingMaintenance.length === 1 ? "" : "s"} due for service
              </h2>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {upcomingMaintenance.map((m) => (
                  <li key={m.vehicle_id} className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[13px] font-medium text-fg">{m.plate_number}</span>
                    <span className="text-xs text-fg-muted">next at {formatNumber(m.next_service_odometer)} km</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar
            activeCount={activeFilters}
            onClear={() => {
              onFilterChange(setFilterVehicleId)("ALL");
              onFilterChange(setFilterType)("ALL");
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
            <FilterField label="Type">
              <Select value={filterType} onChange={(e) => onFilterChange(setFilterType)(e.target.value === "ALL" ? "ALL" : (e.target.value as MaintenanceType))} className="h-8 text-xs">
                <option value="ALL">All types</option>
                {Object.values(MaintenanceType).map((type) => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Period">
              <DateRangePicker value={range} onChange={onFilterChange(setRange)} size="sm" allowClear />
            </FilterField>
          </FilterBar>
        </CardContent>

        <DataTable<MaintenanceRecord>
          caption="Maintenance records"
          columns={columns}
          rows={records}
          rowKey={(r) => r.id}
          loading={isLoading}
          error={loadError}
          onRetry={() => void loadData()}
          empty={{
            icon: <Wrench aria-hidden="true" />,
            title: activeFilters > 0 ? "No maintenance records match these filters" : "No maintenance records yet",
            description: activeFilters > 0 ? "Try widening the period or clearing filters." : "Log the first service to start tracking costs and due dates.",
          }}
          rowActions={(r) => [
            { label: "Edit", icon: <Pencil />, onSelect: () => startEdit(r), disabled: !canUpdate },
            { label: "Mark as paid", icon: <CheckCircle2 />, onSelect: () => void handleMarkAsPaid(r), hidden: r.payment_status === "PAID", disabled: !canUpdate || actionStatus === "loading" },
            { label: "Delete", icon: <Trash2 />, destructive: true, separatorBefore: true, onSelect: () => void handleDelete(r), disabled: !canDelete },
          ]}
          pagination={{
            page: pagination.page || page,
            totalPages: pagination.pages,
            total: pagination.total,
            pageSize,
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(1);
            },
            pageSizeOptions: [25, 50, 100],
          }}
        />
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && !isSubmitting && closeModal()}>
        <DialogContent
          size="lg"
          title={modalMode === "create" ? "Add maintenance record" : "Edit maintenance record"}
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
            <Field label="Maintenance type" required>
              <Select value={formData.maintenance_type || ""} onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value as MaintenanceType })} disabled={isSubmitting}>
                {Object.values(MaintenanceType).map((type) => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" required>
              <Input type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} disabled={isSubmitting} />
            </Field>
            <Field label="Odometer reading (km)" required>
              <Input type="number" min={0} value={formData.odometer_reading || ""} onChange={(e) => setFormData({ ...formData, odometer_reading: Number(e.target.value) })} placeholder="125000" disabled={isSubmitting} />
            </Field>
            <Field label="Cost (PKR)">
              <Input type="number" step="0.01" min={0} value={formData.cost || ""} onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })} placeholder="5000.00" disabled={isSubmitting} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Parts replaced, workshop, anything worth remembering…" disabled={isSubmitting} />
            </Field>
            {formData.maintenance_type === MaintenanceType.OIL_CHANGE && (
              <div className="space-y-3 rounded-lg border border-info-line bg-info-soft p-4 sm:col-span-2">
                <Field label="Next service interval (km)" required hint="How many km after this service until the next oil change.">
                  <Input type="number" min={1} value={oilChangeIntervalKm} onChange={(e) => setOilChangeIntervalKm(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 5000" disabled={isSubmitting} />
                </Field>
                {nextOilChange != null && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Next oil change due</div>
                    <div className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{formatNumber(nextOilChange)} km</div>
                    <div className="text-xs text-fg-muted">
                      Current {formatNumber(Number(formData.odometer_reading))} + {formatNumber(Number(oilChangeIntervalKm))} km
                    </div>
                  </div>
                )}
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
