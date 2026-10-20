"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { SuperAdminPage } from "../components/SuperAdminPage";
import { PermissionsApi, type InternalStaffMember, type CreateInternalStaffRequest } from "../../lib/services/api-client";
import { PERMISSION_KEYS, type CrudAction, type PermissionKey, type SectionCrudPermissions, type StaffPermissions } from "../../lib/types/auth-types";
import { emptyStaffPermissions, fullStaffPermissions, normalizeStaffPermissions, sectionHasAnyCrud } from "../../lib/utils/staff-permissions";
import { getPhoneValidationError, PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, sanitizePhoneInput } from "../../lib/utils/phone";
import { useConfirm } from "../../lib/hooks/useConfirm";
import { PERMISSION_LABELS } from "../lib/nav";
import { PasswordInput } from "../components/PasswordInput";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  DialogContent,
  Field,
  FormGrid,
  InlineError,
  Input,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
} from "../ui";

const CRUD_META: { key: CrudAction; short: string; title: string }[] = [
  { key: "create", short: "C", title: "Create" },
  { key: "read", short: "R", title: "Read" },
  { key: "update", short: "U", title: "Update" },
  { key: "delete", short: "D", title: "Delete" },
];

/** Section × C/R/U/D matrix. Every checkbox is labelled "Create · Companies" etc. */
function PermissionMatrix({ value, onChange, disabled }: { value: StaffPermissions; onChange: (next: StaffPermissions) => void; disabled?: boolean }) {
  const setSection = (key: PermissionKey, next: SectionCrudPermissions) => onChange({ ...value, [key]: next });
  const sectionAll = (section: SectionCrudPermissions) => CRUD_META.every((m) => section[m.key]);
  const sectionSome = (section: SectionCrudPermissions) => CRUD_META.some((m) => section[m.key]);

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-subtle px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Create · Read · Update · Delete per section</span>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(fullStaffPermissions())} disabled={disabled}>
            Enable all
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(emptyStaffPermissions())} disabled={disabled}>
            Disable all
          </Button>
        </div>
      </div>
      <div className="max-h-[min(52vh,26rem)] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">
                Section
              </th>
              <th scope="col" className="w-12 px-1 py-2 text-center">
                <span className="sr-only">All actions</span>
                All
              </th>
              {CRUD_META.map((m) => (
                <th key={m.key} scope="col" className="w-12 px-1 py-2 text-center" title={m.title}>
                  <abbr title={m.title} className="no-underline">
                    {m.short}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {PERMISSION_KEYS.map((key) => {
              const section = value[key] ?? emptyStaffPermissions()[key];
              const all = sectionAll(section);
              const some = sectionSome(section);
              return (
                <tr key={key} className="hover:bg-row-hover">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium text-fg">
                    {PERMISSION_LABELS[key]}
                  </th>
                  <td className="px-1 py-1.5 text-center">
                    <Checkbox
                      aria-label={`All actions · ${PERMISSION_LABELS[key]}`}
                      checked={all ? true : some ? "indeterminate" : false}
                      disabled={disabled}
                      onCheckedChange={(c) => setSection(key, { create: c === true, read: c === true, update: c === true, delete: c === true })}
                    />
                  </td>
                  {CRUD_META.map((m) => (
                    <td key={m.key} className="px-1 py-1.5 text-center">
                      <Checkbox
                        aria-label={`${m.title} · ${PERMISSION_LABELS[key]}`}
                        checked={!!section[m.key]}
                        disabled={disabled}
                        onCheckedChange={(c) => setSection(key, { ...section, [m.key]: c === true })}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EMPTY_CREATE: CreateInternalStaffRequest & { confirmPassword: string } = {
  email: "",
  password: "",
  confirmPassword: "",
  full_name: "",
  phone: "",
  permissions: emptyStaffPermissions(),
};

export default function PermissionsPage() {
  return (
    <SuperAdminPage>
      <PermissionsPageContent />
    </SuperAdminPage>
  );
}

function PermissionsPageContent() {
  const confirm = useConfirm();
  const [staff, setStaff] = useState<InternalStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingStaff, setEditingStaff] = useState<InternalStaffMember | null>(null);
  const [editPermissions, setEditPermissions] = useState<StaffPermissions>(emptyStaffPermissions());
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await PermissionsApi.listStaff();
        if (cancelled) return;
        setStaff(res.data ?? []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load staff");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const fetchStaff = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  const passwordMismatch = createForm.confirmPassword.length > 0 && createForm.password !== createForm.confirmPassword;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createForm.password !== createForm.confirmPassword) {
      setCreateError("Passwords do not match");
      return;
    }
    const phoneError = getPhoneValidationError(createForm.phone);
    if (phoneError) {
      setCreateError(phoneError);
      return;
    }
    try {
      setCreateLoading(true);
      setCreateError(null);
      const { confirmPassword, ...payload } = createForm;
      void confirmPassword;
      await PermissionsApi.createStaff({
        ...payload,
        phone: payload.phone || undefined,
        permissions: payload.permissions,
      });
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      toast.success("Staff account created");
      fetchStaff();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create staff");
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditPermissions = (member: InternalStaffMember) => {
    setEditingStaff(member);
    setEditPermissions(normalizeStaffPermissions(member.permissions));
    setEditError(null);
  };

  const handleSavePermissions = async () => {
    if (!editingStaff) return;
    try {
      setEditLoading(true);
      setEditError(null);
      await PermissionsApi.updatePermissions(editingStaff.id, editPermissions);
      setEditingStaff(null);
      toast.success("Permissions updated");
      fetchStaff();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update permissions");
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async (member: InternalStaffMember) => {
    const deactivating = member.status === "ACTIVE";
    const ok = await confirm(
      deactivating
        ? {
            title: `Deactivate ${member.full_name}?`,
            message: "They will be signed out and lose access to the admin portal immediately.",
            consequences: ["Their permissions are kept and can be restored by reactivating", "Records they created are not affected"],
            confirmLabel: "Deactivate",
            destructive: true,
          }
        : {
            title: `Reactivate ${member.full_name}?`,
            message: "They will regain access with the permissions they had before.",
            confirmLabel: "Reactivate",
          },
    );
    if (!ok) return;
    try {
      setBusyId(member.id);
      if (deactivating) await PermissionsApi.deactivate(member.id);
      else await PermissionsApi.reactivate(member.id);
      toast.success(deactivating ? "Account deactivated" : "Account reactivated");
      fetchStaff();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusyId(null);
    }
  };

  const columns = useMemo<DataTableColumn<InternalStaffMember>[]>(
    () => [
      {
        key: "name",
        header: "Staff member",
        cell: (m) => (
          <div className="min-w-0">
            <div className="font-medium text-fg">{m.full_name}</div>
            <div className="truncate text-xs text-fg-muted">{m.email}</div>
          </div>
        ),
      },
      { key: "status", header: "Status", width: "8rem", cell: (m) => <StatusBadge status={m.status ?? "UNKNOWN"} /> },
      {
        key: "sections",
        header: "Access",
        cell: (m) => {
          const on = PERMISSION_KEYS.filter((k) => sectionHasAnyCrud(m.permissions, k));
          return (
            <div className="min-w-0">
              <div className="text-xs text-fg-secondary">
                {on.length} of {PERMISSION_KEYS.length} sections
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {on.slice(0, 6).map((k) => (
                  <Badge key={k} tone="info" size="sm">
                    {PERMISSION_LABELS[k]}
                  </Badge>
                ))}
                {on.length > 6 && (
                  <Badge tone="neutral" size="sm">
                    +{on.length - 6} more
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        align: "right",
        width: "1%",
        cell: (m) => (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="outline" leftIcon={<UserCog />} onClick={() => openEditPermissions(m)}>
              Permissions
            </Button>
            <Button
              size="sm"
              variant={m.status === "ACTIVE" ? "danger-outline" : "secondary"}
              leftIcon={m.status === "ACTIVE" ? <ShieldOff /> : <ShieldCheck />}
              loading={busyId === m.id}
              onClick={() => void handleToggleStatus(m)}
            >
              {m.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & permissions"
        description="Internal staff accounts and their per-section Create, Read, Update and Delete access. Enforced on the API and in this portal."
        actions={
          <Button leftIcon={<Plus />} onClick={() => setShowCreate(true)}>
            New staff account
          </Button>
        }
      />

      <Card>
        <DataTable<InternalStaffMember>
          caption="Internal staff accounts"
          rows={staff}
          rowKey={(m) => m.id}
          columns={columns}
          loading={loading}
          error={error}
          onRetry={fetchStaff}
          empty={{
            title: "No internal staff accounts yet",
            description: "Create an account and choose which sections it can access.",
            action: (
              <Button size="sm" leftIcon={<Plus />} onClick={() => setShowCreate(true)}>
                New staff account
              </Button>
            ),
          }}
        />
      </Card>

      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setCreateError(null);
          }
        }}
      >
        <DialogContent
          size="xl"
          title="New staff account"
          description="Credentials are set now; permissions can be changed later."
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={createLoading}>
                Cancel
              </Button>
              <Button type="submit" form="create-staff-form" loading={createLoading}>
                Create account
              </Button>
            </>
          }
        >
          <form id="create-staff-form" onSubmit={handleCreate} className="grid gap-6 lg:grid-cols-5" noValidate>
            <div className="space-y-4 lg:col-span-2">
              <Field label="Full name" required>
                <Input value={createForm.full_name} onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))} autoComplete="off" required />
              </Field>
              <Field label="Email" required>
                <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} autoComplete="off" required />
              </Field>
              <Field label="Phone" hint="Optional.">
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={PHONE_MAX_LENGTH}
                  value={createForm.phone ?? ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: sanitizePhoneInput(e.target.value) }))}
                  placeholder={PHONE_PLACEHOLDER}
                  mono
                />
              </Field>
              <FormGrid cols={1}>
                <Field label="Password" required>
                  <PasswordInput value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" required />
                </Field>
                <Field label="Confirm password" required error={passwordMismatch ? "Passwords do not match" : undefined}>
                  <PasswordInput value={createForm.confirmPassword} onChange={(e) => setCreateForm((f) => ({ ...f, confirmPassword: e.target.value }))} autoComplete="new-password" required />
                </Field>
              </FormGrid>
              {createError && <InlineError>{createError}</InlineError>}
            </div>
            <div className="lg:col-span-3">
              <p className="mb-2 text-[13px] font-medium text-fg-secondary">Initial permissions</p>
              <PermissionMatrix value={normalizeStaffPermissions(createForm.permissions ?? null)} onChange={(permissions) => setCreateForm((f) => ({ ...f, permissions }))} disabled={createLoading} />
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent
          size="lg"
          title="Edit permissions"
          description={
            editingStaff ? (
              <span>
                {editingStaff.full_name} · {editingStaff.email} · <StatusBadge status={editingStaff.status ?? "UNKNOWN"} size="sm" />
              </span>
            ) : undefined
          }
          footer={
            <>
              <Button variant="outline" onClick={() => setEditingStaff(null)} disabled={editLoading}>
                Cancel
              </Button>
              <Button onClick={() => void handleSavePermissions()} loading={editLoading}>
                Save permissions
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {editError && <InlineError>{editError}</InlineError>}
            <PermissionMatrix value={editPermissions} onChange={setEditPermissions} disabled={editLoading} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
