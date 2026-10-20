"use client";

import { useEffect, useState, useCallback } from "react";
import { Ban, Link2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "../../lib/services/api-client";
import { ExternalVendor, CompanyVendorLink } from "../../lib/services/types/multi-mode";
import { PermissionGate } from "../components/PermissionGate";
import { AdminCan, useAdminAbility } from "../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { useDebounce } from "../../lib/hooks/useDebounce";
import { useConfirm } from "../../lib/hooks/useConfirm";
import { getPhoneValidationError, PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, sanitizePhoneInput } from "../../lib/utils/phone";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  Dialog,
  DialogContent,
  Drawer,
  DrawerContent,
  Field,
  FilterBar,
  Input,
  PageHeader,
  StatusBadge,
  Switch,
  Tooltip,
  type DataTableColumn,
} from "../ui";

const PAGE_SIZE = 15;

export default function ExternalVendorsPage() {
  return (
    <PermissionGate permission="external_vendors">
      <AdminCan I="read" a="ExternalVendors">
        <ExternalVendorsContent />
      </AdminCan>
    </PermissionGate>
  );
}

function ExternalVendorsContent() {
  const ability = useAdminAbility();
  const confirm = useConfirm();
  const canCreate = ability.can("create", ADMIN_SUBJECTS.external_vendors);
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.external_vendors);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.external_vendors);

  const [vendors, setVendors] = useState<ExternalVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<ExternalVendor | null>(null);
  const [vendorLinks, setVendorLinks] = useState<CompanyVendorLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({ name: "", contact_email: "", password: "", contact_phone: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", contact_phone: "", is_active: true });
  const [editLoading, setEditLoading] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const loadVendors = useCallback(() => apiClient.getExternalVendors({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined }), [page, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await loadVendors();
        if (cancelled) return;
        setVendors(res.data.data);
        setTotalPages(res.data.pagination.pages ?? Math.ceil(res.data.pagination.total / PAGE_SIZE));
        setTotal(res.data.pagination.total);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load external vendors");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadVendors, reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneError = getPhoneValidationError(createForm.contact_phone);
    if (phoneError) {
      toast.error(phoneError);
      return;
    }
    setCreateLoading(true);
    try {
      await apiClient.createExternalVendor({
        name: createForm.name,
        contact_email: createForm.contact_email,
        password: createForm.password,
        contact_phone: createForm.contact_phone || undefined,
      });
      toast.success("External vendor created");
      setShowCreate(false);
      setCreateForm({ name: "", contact_email: "", password: "", contact_phone: "" });
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create vendor");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor) return;
    const phoneError = getPhoneValidationError(editForm.contact_phone);
    if (phoneError) {
      toast.error(phoneError);
      return;
    }
    setEditLoading(true);
    try {
      await apiClient.updateExternalVendor(selectedVendor.id, {
        name: editForm.name,
        contact_phone: editForm.contact_phone || undefined,
        is_active: editForm.is_active,
      });
      toast.success("Vendor updated");
      setShowEdit(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update vendor");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeactivate = async (vendor: ExternalVendor) => {
    const links = vendor.company_vendor_links?.length ?? 0;
    const ok = await confirm({
      title: `Deactivate ${vendor.name}?`,
      message: "The vendor's login stops working and every company link is deactivated.",
      consequences: [
        links > 0 ? `${links} company ${links === 1 ? "link is" : "links are"} deactivated` : "No company links exist for this vendor",
        "Companies can no longer assign bookings to this vendor",
        "You can reactivate the account later from Edit",
      ],
      destructive: true,
      confirmLabel: "Deactivate",
    });
    if (!ok) return;
    try {
      await apiClient.deactivateExternalVendor(vendor.id);
      toast.success(`${vendor.name} deactivated`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  const openEdit = (vendor: ExternalVendor) => {
    setSelectedVendor(vendor);
    setEditForm({ name: vendor.name, contact_phone: vendor.contact_phone ?? "", is_active: vendor.is_active });
    setShowEdit(true);
  };

  const openLinks = async (vendor: ExternalVendor) => {
    setSelectedVendor(vendor);
    setVendorLinks([]);
    setLinksError(null);
    setLinksLoading(true);
    setShowLinks(true);
    try {
      const res = await apiClient.getVendorLinks(vendor.id);
      setVendorLinks(res.data);
    } catch (err) {
      setLinksError(err instanceof Error ? err.message : "Failed to load vendor links");
    } finally {
      setLinksLoading(false);
    }
  };

  const columns: DataTableColumn<ExternalVendor>[] = [
    { key: "name", header: "Vendor", cell: (v) => <span className="font-medium text-fg">{v.name}</span> },
    { key: "email", header: "Login email", cell: (v) => <span className="font-mono text-[13px] text-fg-secondary">{v.contact_email ?? "—"}</span> },
    { key: "phone", header: "Phone", hideBelow: "md", mono: true, cell: (v) => v.contact_phone ?? "—" },
    {
      key: "links",
      header: "Company links",
      cell: (v) => {
        const n = v.company_vendor_links?.length ?? 0;
        return (
          <Button variant="link" size="sm" onClick={() => void openLinks(v)} leftIcon={<Link2 />}>
            {n} {n === 1 ? "link" : "links"}
          </Button>
        );
      },
    },
    { key: "status", header: "Status", cell: (v) => <StatusBadge status={v.is_active ? "ACTIVE" : "INACTIVE"} /> },
  ];

  const linkColumns: DataTableColumn<CompanyVendorLink>[] = [
    { key: "company", header: "Company", cell: (l) => <span className="font-medium text-fg">{l.companies?.name ?? `Company #${l.company_id}`}</span> },
    { key: "chauffeur", header: "Chauffeur", align: "center", cell: (l) => (l.serves_chauffeur ? <Badge tone="purple" size="sm">Yes</Badge> : <span className="text-fg-muted">—</span>) },
    { key: "shuttle", header: "Shuttle", align: "center", cell: (l) => (l.serves_shuttle ? <Badge tone="info" size="sm">Yes</Badge> : <span className="text-fg-muted">—</span>) },
    { key: "active", header: "Status", cell: (l) => <StatusBadge status={l.is_active ? "ACTIVE" : "INACTIVE"} size="sm" /> },
  ];

  const addButton = (
    <Button leftIcon={<Plus />} onClick={() => setShowCreate(true)} disabled={!canCreate}>
      Create vendor
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="External vendors"
        description="Third-party vendor accounts and the companies they serve."
        actions={
          canCreate ? (
            addButton
          ) : (
            <Tooltip content="You don't have permission to create external vendors">
              <span tabIndex={0} className="inline-flex rounded-lg">
                {addButton}
              </span>
            </Tooltip>
          )
        }
      />

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar
            search={{
              value: search,
              onChange: (v) => {
                setSearch(v);
                setPage(1);
              },
              placeholder: "Search by name or email…",
            }}
            activeCount={search ? 1 : 0}
            onClear={() => {
              setSearch("");
              setPage(1);
            }}
          />
        </CardContent>
        <DataTable<ExternalVendor>
          caption="External vendors"
          rows={vendors}
          rowKey={(v) => v.id}
          columns={columns}
          loading={loading}
          error={error}
          onRetry={reload}
          empty={{ title: search ? "No external vendors match" : "No external vendors yet", description: search ? "Try another name or email." : "Create a vendor account to let a third party serve company bookings." }}
          rowActions={(v) => [
            { label: "Edit", icon: <Pencil />, disabled: !canUpdate, onSelect: () => openEdit(v) },
            { label: "Company links", icon: <Link2 />, onSelect: () => void openLinks(v) },
            { label: "Deactivate", icon: <Ban />, destructive: true, separatorBefore: true, hidden: !v.is_active, disabled: !canDelete, onSelect: () => void handleDeactivate(v) },
          ]}
          pagination={{ page, totalPages, total, pageSize: PAGE_SIZE, onPageChange: setPage }}
        />
      </Card>

      <Dialog open={showCreate} onOpenChange={(open) => !open && !createLoading && setShowCreate(false)}>
        <DialogContent size="sm" title="Create external vendor" description="The vendor signs in with this email and password.">
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Vendor name" required>
              <Input required value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </Field>
            <Field label="Login email" required>
              <Input required type="email" value={createForm.contact_email} onChange={(e) => setCreateForm((f) => ({ ...f, contact_email: e.target.value }))} />
            </Field>
            <Field label="Initial password" required hint="At least 8 characters. Share it with the vendor securely.">
              <Input required type="password" minLength={8} autoComplete="new-password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <Input
                type="tel"
                inputMode="numeric"
                mono
                maxLength={PHONE_MAX_LENGTH}
                value={createForm.contact_phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, contact_phone: sanitizePhoneInput(e.target.value) }))}
                placeholder={PHONE_PLACEHOLDER}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={createLoading}>
                Cancel
              </Button>
              <Button type="submit" loading={createLoading}>
                Create vendor
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit && !!selectedVendor} onOpenChange={(open) => !open && !editLoading && setShowEdit(false)}>
        <DialogContent size="sm" title={`Edit ${selectedVendor?.name ?? "vendor"}`}>
          <form onSubmit={handleEdit} className="space-y-4">
            <Field label="Name" required>
              <Input required value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </Field>
            <Field label="Phone">
              <Input
                type="tel"
                inputMode="numeric"
                mono
                maxLength={PHONE_MAX_LENGTH}
                value={editForm.contact_phone}
                onChange={(e) => setEditForm((f) => ({ ...f, contact_phone: sanitizePhoneInput(e.target.value) }))}
                placeholder={PHONE_PLACEHOLDER}
              />
            </Field>
            <Switch label="Account active" description="Inactive vendors cannot sign in or receive bookings." checked={editForm.is_active} onCheckedChange={(checked) => setEditForm((f) => ({ ...f, is_active: checked }))} />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)} disabled={editLoading}>
                Cancel
              </Button>
              <Button type="submit" loading={editLoading}>
                Save changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Drawer open={showLinks && !!selectedVendor} onOpenChange={setShowLinks}>
        <DrawerContent size="lg" title={`Company links · ${selectedVendor?.name ?? ""}`} description="Companies this vendor can serve. Links are managed from each company's detail page." flush>
          <DataTable<CompanyVendorLink>
            caption="Company links"
            rows={vendorLinks}
            rowKey={(l) => l.id}
            columns={linkColumns}
            loading={linksLoading}
            error={linksError}
            onRetry={() => selectedVendor && void openLinks(selectedVendor)}
            density="compact"
            empty={{ title: "No company links yet", description: "Link this vendor to a company from the company detail page." }}
          />
        </DrawerContent>
      </Drawer>
    </div>
  );
}
