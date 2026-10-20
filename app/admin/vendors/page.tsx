"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { useDebounce } from "../../lib/hooks/useDebounce";
import { useConfirm } from "../../lib/hooks/useConfirm";
import {
  fetchAdminVendors,
  createAdminVendor,
  updateAdminVendor,
  deleteAdminVendor,
  selectAdminVendors,
  selectAdminVendorsStatus,
  selectAdminVendorsActionStatus,
  selectAdminVendorsError,
  selectVendorFilters,
  resetActionStatus,
  selectAdminVendorsPagination,
} from "../../lib/store/slices/adminVendorsSlice";
import { Vendor, CreateVendorRequest } from "../../lib/services/api-client";
import { AdminProtectedPage } from "../components/AdminProtectedPage";
import { useAdminAbility } from "../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { getPhoneValidationError, PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, sanitizePhoneInput } from "../../lib/utils/phone";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  Dialog,
  DialogContent,
  Field,
  FilterBar,
  FormGrid,
  Input,
  PageHeader,
  Textarea,
  Tooltip,
  type DataTableColumn,
} from "../ui";

const PAGE_SIZE = 10;

export default function VendorsPage() {
  return (
    <AdminProtectedPage permission="vendors" subject={ADMIN_SUBJECTS.vendors}>
      <VendorsPageContent />
    </AdminProtectedPage>
  );
}

function VendorsPageContent() {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const ability = useAdminAbility();
  const canCreate = ability.can("create", ADMIN_SUBJECTS.vendors);
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.vendors);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.vendors);
  const vendors = useAppSelector(selectAdminVendors);
  const status = useAppSelector(selectAdminVendorsStatus);
  const actionStatus = useAppSelector(selectAdminVendorsActionStatus);
  const error = useAppSelector(selectAdminVendorsError);
  const savedFilters = useAppSelector(selectVendorFilters);
  const pagination = useAppSelector(selectAdminVendorsPagination);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [search, setSearch] = useState(savedFilters.search);
  const debouncedSearch = useDebounce(search, 500);
  const [formData, setFormData] = useState<Partial<CreateVendorRequest>>({});

  useEffect(() => {
    const filtersChanged = debouncedSearch !== savedFilters.search;
    if (status === "idle" || filtersChanged) {
      dispatch(fetchAdminVendors({ limit: PAGE_SIZE, page: 1, search: debouncedSearch }));
    }
  }, [dispatch, debouncedSearch, status, savedFilters]);

  const handlePageChange = (page: number) => {
    dispatch(fetchAdminVendors({ limit: PAGE_SIZE, page, search: debouncedSearch }));
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedVendor(null);
    setFormData({});
  };

  /** Runs a create/update thunk, closes the dialog on success, toasts either way, and clears the slice's action status. */
  const runSave = async (run: () => Promise<unknown>, successMessage: string) => {
    try {
      await run();
      closeModal();
      toast.success(successMessage);
    } catch (err) {
      toast.error(typeof err === "string" ? err : error || "Failed to save vendor");
    } finally {
      dispatch(resetActionStatus());
    }
  };

  const handleCreate = () => {
    if (!formData.name) {
      toast.error("Vendor name is required");
      return;
    }
    const phoneError = getPhoneValidationError(formData.phone || "");
    if (phoneError) {
      toast.error(phoneError);
      return;
    }
    void runSave(() => dispatch(createAdminVendor(formData as CreateVendorRequest)).unwrap(), "Vendor created");
  };

  const handleUpdate = () => {
    if (!selectedVendor) return;
    const phoneError = getPhoneValidationError(formData.phone || "");
    if (phoneError) {
      toast.error(phoneError);
      return;
    }
    void runSave(() => dispatch(updateAdminVendor({ id: selectedVendor.id, data: formData })).unwrap(), "Vendor updated");
  };

  const handleDelete = async (vendor: Vendor) => {
    const vehicles = vendor._count?.vehicles ?? 0;
    const ok = await confirm({
      title: `Delete ${vendor.name}?`,
      message: "This permanently removes the vendor record.",
      consequences: [
        vehicles > 0 ? `${vehicles} partner ${vehicles === 1 ? "vehicle is" : "vehicles are"} linked to this vendor` : "No vehicles are linked to this vendor",
        "Trip logs and settlements already recorded are kept",
        "This cannot be undone",
      ],
      destructive: true,
      confirmLabel: "Delete vendor",
    });
    if (!ok) return;
    try {
      await dispatch(deleteAdminVendor(vendor.id)).unwrap();
      toast.success(`${vendor.name} deleted`);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Failed to delete vendor");
    }
  };

  const startCreate = () => {
    setSelectedVendor(null);
    setFormData({});
    setModalMode("create");
    setIsModalOpen(true);
  };

  const startEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setFormData({
      name: vendor.name,
      contact_person: vendor.contact_person || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      address: vendor.address || "",
    });
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const isLoading = status === "loading";
  const isSubmitting = actionStatus === "loading";

  const columns: DataTableColumn<Vendor>[] = [
    { key: "name", header: "Vendor", sortable: false, cell: (v) => <span className="font-medium text-fg">{v.name}</span> },
    { key: "contact", header: "Contact", hideBelow: "md", cell: (v) => <span className="text-fg">{v.contact_person || "—"}</span> },
    {
      key: "phone",
      header: "Phone / email",
      cell: (v) => (
        <div className="min-w-0">
          <div className="font-mono text-[13px] text-fg">{v.phone || "—"}</div>
          <div className="truncate text-xs text-fg-muted">{v.email || ""}</div>
        </div>
      ),
    },
    { key: "vehicles", header: "Vehicles", align: "center", width: "1%", cell: (v) => <Badge tone={v._count?.vehicles ? "info" : "neutral"}>{v._count?.vehicles || 0}</Badge> },
  ];

  const addButton = (
    <Button leftIcon={<Plus />} onClick={startCreate} disabled={!canCreate}>
      Add vendor
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Partner vehicle vendors and their fleet."
        actions={
          canCreate ? (
            addButton
          ) : (
            <Tooltip content="You don't have permission to add vendors">
              <span tabIndex={0} className="inline-flex rounded-lg">
                {addButton}
              </span>
            </Tooltip>
          )
        }
      />

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar search={{ value: search, onChange: setSearch, placeholder: "Search vendors…" }} activeCount={search ? 1 : 0} onClear={() => setSearch("")} />
        </CardContent>
        <DataTable<Vendor>
          caption="Vendors"
          rows={vendors}
          rowKey={(v) => v.id}
          columns={columns}
          loading={isLoading}
          error={status === "failed" ? error : null}
          onRetry={() => dispatch(fetchAdminVendors({ limit: PAGE_SIZE, page: pagination.page || 1, search: debouncedSearch }))}
          empty={{
            title: search ? "No vendors match your search" : "No vendors yet",
            description: search ? "Try a different name." : "Add your first partner vendor to start logging trips.",
            action: canCreate && !search ? <Button size="sm" leftIcon={<Plus />} onClick={startCreate}>Add vendor</Button> : undefined,
          }}
          rowActions={(v) => [
            { label: "View logs & settlements", icon: <Eye />, href: `/admin/vendors/${v.id}` },
            { label: "Edit", icon: <Pencil />, disabled: !canUpdate, onSelect: () => startEdit(v) },
            { label: "Delete", icon: <Trash2 />, destructive: true, separatorBefore: true, disabled: !canDelete, onSelect: () => void handleDelete(v) },
          ]}
          pagination={{
            page: pagination.page || 1,
            totalPages: pagination.pages || 1,
            total: pagination.total,
            pageSize: pagination.limit || PAGE_SIZE,
            onPageChange: handlePageChange,
          }}
        />
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && !isSubmitting && closeModal()}>
        <DialogContent
          size="lg"
          title={modalMode === "create" ? "Add vendor" : `Edit ${selectedVendor?.name ?? "vendor"}`}
          footer={
            <>
              <Button variant="outline" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={modalMode === "create" ? handleCreate : handleUpdate} loading={isSubmitting} disabled={modalMode === "create" ? !canCreate : !canUpdate}>
                {modalMode === "create" ? "Create vendor" : "Save changes"}
              </Button>
            </>
          }
        >
          <FormGrid cols={2}>
            <Field label="Vendor name" required>
              <Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="ABC Transport" autoFocus />
            </Field>
            <Field label="Contact person">
              <Input value={formData.contact_person || ""} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} placeholder="Full name" />
            </Field>
            <Field label="Phone">
              <Input
                type="tel"
                inputMode="numeric"
                mono
                maxLength={PHONE_MAX_LENGTH}
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: sanitizePhoneInput(e.target.value) })}
                placeholder={PHONE_PLACEHOLDER}
              />
            </Field>
            <Field label="Email">
              <Input type="email" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contact@example.com" />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Textarea value={formData.address || ""} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Street, city" rows={3} />
            </Field>
          </FormGrid>
        </DialogContent>
      </Dialog>
    </div>
  );
}
