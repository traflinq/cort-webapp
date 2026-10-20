"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Car, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Vehicle, QueryVehicleParams, VehicleCategory, OwnershipType } from "../../lib/services/api-client";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import {
  fetchAdminVehicles,
  createAdminVehicle,
  updateAdminVehicle,
  deleteAdminVehicle,
  selectAdminVehicles,
  selectAdminVehiclesStatus,
  selectAdminVehiclesError,
  selectAdminVehiclesActionStatus,
  selectVehicleFilters,
  selectAdminVehiclesPagination,
} from "../../lib/store/slices/adminVehiclesSlice";
import { VehicleFormInline, type VehicleFormData } from "./components/VehicleFormInline";
import { PermissionGate } from "../components/PermissionGate";
import { AdminCan, useAdminAbility } from "../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { useDebounce } from "../../lib/hooks/useDebounce";
import { useConfirm } from "../../lib/hooks/useConfirm";
import { formatCurrency, humanize } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  Dialog,
  DialogContent,
  FilterBar,
  FilterField,
  PageHeader,
  Select,
  type DataTableColumn,
  type RowKey,
} from "../ui";

const PAGE_SIZE = 10;

export default function VehiclesPage() {
  return (
    <PermissionGate permission="vehicles">
      <AdminCan I="read" a="Vehicles">
        <Suspense fallback={null}>
          <VehiclesPageContent />
        </Suspense>
      </AdminCan>
    </PermissionGate>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

function PartnerRates({ vehicle }: { vehicle: Vehicle }) {
  const rows: Array<[string, number | undefined]> = [
    ["Rent per 24h (city)", vehicle.rent_per_day_city],
    ["Rent per 24h (outstation)", vehicle.rent_per_day_outstation],
    ["Overtime rate (per hour)", vehicle.vendor_overtime_rate],
    ["5h fixed rent", vehicle.vendor_rent_5hr],
    ["10h fixed rent", vehicle.vendor_rent_10hr],
  ];
  return (
    <div className="grid gap-x-8 gap-y-2 px-6 py-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2 lg:col-span-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Vendor</span>
        <div className="font-medium text-fg">{vehicle.vendors?.name ?? "—"}</div>
      </div>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 border-t border-line py-1.5">
          <span className="text-fg-muted">{label}</span>
          <span className="font-mono tabular-nums text-fg">{value ? formatCurrency(value) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function VehiclesPageContent() {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const ability = useAdminAbility();
  const searchParams = useSearchParams();
  const canCreate = ability.can("create", ADMIN_SUBJECTS.vehicles);
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.vehicles);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.vehicles);
  const vehicles = useAppSelector(selectAdminVehicles);
  const status = useAppSelector(selectAdminVehiclesStatus);
  const error = useAppSelector(selectAdminVehiclesError);
  const actionStatus = useAppSelector(selectAdminVehiclesActionStatus);
  const savedFilters = useAppSelector(selectVehicleFilters);
  const pagination = useAppSelector(selectAdminVehiclesPagination);

  // `?q=` comes from the command palette; otherwise restore the last search.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? savedFilters.search);
  const debouncedSearch = useDebounce(search, 500);
  const [category, setCategory] = useState<string>(savedFilters.category);
  const [ownership, setOwnership] = useState<string>(savedFilters.ownership);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [expanded, setExpanded] = useState<Set<RowKey>>(new Set());

  const buildParams = (page: number): QueryVehicleParams => {
    const params: QueryVehicleParams = {
      limit: PAGE_SIZE,
      page,
      search: debouncedSearch || undefined,
    };
    if (category) params.category = category as VehicleCategory;
    if (ownership) params.ownership = ownership as OwnershipType;
    return params;
  };

  useEffect(() => {
    const filtersChanged = debouncedSearch !== savedFilters.search || category !== savedFilters.category || ownership !== savedFilters.ownership;
    const shouldFetch = status === "idle" || filtersChanged;
    if (!shouldFetch) return;
    const page = filtersChanged ? 1 : pagination.page;
    dispatch(fetchAdminVehicles(buildParams(page)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, debouncedSearch, category, ownership, status, pagination.page, savedFilters.search, savedFilters.category, savedFilters.ownership]);

  const reload = (page = pagination.page) => dispatch(fetchAdminVehicles(buildParams(page)));

  const handleCreateNew = () => {
    setEditingVehicle(null);
    setIsModalOpen(true);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsModalOpen(true);
  };

  const handleDelete = async (vehicle: Vehicle) => {
    const ok = await confirm({
      title: `Delete ${vehicle.plate_number}?`,
      message: `${vehicle.make} ${vehicle.model} will be removed from the fleet.`,
      consequences: [
        "The vehicle can no longer be assigned to routes or bookings",
        vehicle.ownership === OwnershipType.PARTNER ? "Its partner driver account is affected as well" : "Existing fuel and maintenance records keep their history",
        "This cannot be undone from the portal",
      ],
      destructive: true,
      confirmLabel: "Delete vehicle",
    });
    if (!ok) return;
    try {
      await dispatch(deleteAdminVehicle(vehicle.id)).unwrap();
      toast.success(`${vehicle.plate_number} deleted`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete vehicle"));
    }
  };

  const handleSave = async (data: VehicleFormData) => {
    try {
      if (editingVehicle) {
        // Driver fields are only sent on create.
        const {
          driver_full_name: _n,
          driver_email: _e,
          driver_phone: _p,
          driver_password: _pw,
          driver_cnic_number: _c,
          driver_license_number: _l,
          driver_type: _t,
          ...vehicleData
        } = data;
        void [_n, _e, _p, _pw, _c, _l, _t];
        await dispatch(updateAdminVehicle({ id: editingVehicle.id, data: vehicleData })).unwrap();
        toast.success("Vehicle updated");
      } else {
        await dispatch(createAdminVehicle(data)).unwrap();
        toast.success("Vehicle added");
      }
      setIsModalOpen(false);
      setEditingVehicle(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save vehicle"));
    }
  };

  const activeFilters = (search ? 1 : 0) + (category ? 1 : 0) + (ownership ? 1 : 0);
  const isLoading = status === "loading";
  const isSaving = actionStatus === "loading";

  const columns = useMemo<DataTableColumn<Vehicle>[]>(
    () => [
      {
        key: "vehicle",
        header: "Vehicle",
        cell: (v) => (
          <div className="min-w-0">
            <div className="font-medium text-fg">
              {v.make} {v.model}
            </div>
            <div className="text-xs text-fg-muted">
              <span className="font-mono">{v.plate_number}</span>
              {v.color ? ` · ${v.color}` : ""}
            </div>
          </div>
        ),
      },
      { key: "category", header: "Category", hideBelow: "sm", cell: (v) => <Badge tone="neutral">{humanize(v.category)}</Badge> },
      { key: "seats", header: "Seats", align: "right", mono: true, hideBelow: "md", cell: (v) => v.seat_capacity || 0 },
      { key: "year", header: "Year", align: "right", mono: true, hideBelow: "md", cell: (v) => v.year },
      {
        key: "ownership",
        header: "Ownership",
        cell: (v) => (
          <div className="flex flex-col items-start gap-1">
            <Badge tone={v.ownership === OwnershipType.OWNED ? "info" : "purple"}>{humanize(v.ownership)}</Badge>
            {v.ownership === OwnershipType.PARTNER && v.vendors?.name && <span className="text-xs text-fg-muted">{v.vendors.name}</span>}
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicles"
        description="Owned fleet and partner vehicles. Expand a partner vehicle to see its vendor rates."
        actions={
          <Button leftIcon={<Plus />} onClick={handleCreateNew} disabled={!canCreate}>
            Add vehicle
          </Button>
        }
      />

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar
            search={{ value: search, onChange: setSearch, placeholder: "Search make, model or plate…" }}
            activeCount={activeFilters}
            onClear={() => {
              setSearch("");
              setCategory("");
              setOwnership("");
            }}
          >
            <FilterField label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All" className="h-8 text-xs">
                {Object.values(VehicleCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {humanize(cat)}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Ownership">
              <Select value={ownership} onChange={(e) => setOwnership(e.target.value)} placeholder="All" className="h-8 text-xs">
                {Object.values(OwnershipType).map((type) => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </Select>
            </FilterField>
          </FilterBar>
        </CardContent>

        <DataTable<Vehicle>
          caption="Vehicles"
          columns={columns}
          rows={vehicles}
          rowKey={(v) => v.id}
          loading={isLoading}
          error={error}
          onRetry={() => reload()}
          empty={{
            icon: <Car aria-hidden="true" />,
            title: activeFilters > 0 ? "No vehicles match these filters" : "No vehicles yet",
            description: activeFilters > 0 ? "Try clearing the filters." : "Add your first vehicle to start tracking fuel and maintenance.",
            action:
              activeFilters === 0 ? (
                <Button size="sm" leftIcon={<Plus />} onClick={handleCreateNew} disabled={!canCreate}>
                  Add vehicle
                </Button>
              ) : undefined,
          }}
          expandable={{
            isExpanded: (v) => v.ownership === OwnershipType.PARTNER && expanded.has(v.id),
            onToggle: (v) =>
              setExpanded((s) => {
                const n = new Set(s);
                if (n.has(v.id)) n.delete(v.id);
                else n.add(v.id);
                return n;
              }),
            render: (v) => <PartnerRates vehicle={v} />,
          }}
          rowActions={(v) => [
            { label: "Edit", icon: <Pencil />, onSelect: () => handleEdit(v), disabled: !canUpdate },
            { label: "Delete", icon: <Trash2 />, destructive: true, separatorBefore: true, onSelect: () => handleDelete(v), disabled: !canDelete },
          ]}
          pagination={{
            page: pagination.page,
            totalPages: pagination.totalPages,
            total: pagination.total,
            pageSize: pagination.limit || PAGE_SIZE,
            onPageChange: (page) => reload(page),
          }}
        />
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && !isSaving && setIsModalOpen(false)}>
        <DialogContent size="lg" title={editingVehicle ? "Edit vehicle" : "Add vehicle"} description={editingVehicle ? `${editingVehicle.make} ${editingVehicle.model} · ${editingVehicle.plate_number}` : undefined}>
          <VehicleFormInline
            key={editingVehicle?.id ?? "new"}
            vehicle={editingVehicle}
            onSave={handleSave}
            onCancel={() => setIsModalOpen(false)}
            isSaving={isSaving}
            saveDisabled={editingVehicle ? !canUpdate : !canCreate}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
