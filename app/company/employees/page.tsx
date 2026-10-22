"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Power, UserPlus, Users } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/lib/store/hooks";
import { selectCompany } from "@/app/lib/store/slices/companySlice";
import { fetchEmployees, selectEmployees, selectEmployeesStatus, updateEmployee, deactivateEmployee, type Employee } from "@/app/lib/store/slices/employeeSlice";
import { useAuth } from "@/app/lib/contexts/auth-context";
import { apiClient } from "@/app/lib/services/api-client";
import { useConfirm } from "@/app/lib/hooks/useConfirm";
import { getPhoneValidationError, PHONE_MAX_LENGTH, sanitizePhoneInput } from "@/app/lib/utils/phone";
import {
  Button,
  Card,
  CardContent,
  DataTable,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  FilterBar,
  FilterField,
  FormGrid,
  InlineError,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  type ActionMenuItem,
  type DataTableColumn,
} from "@/app/ui";
import { AccountCredentialsReveal, SaveCredentialsNote } from "../components/AccountCredentialsReveal";

const PAGE_SIZE = 25;

type EmployeeForm = { full_name: string; email: string; phone: string; department: string; employee_id: string };
const EMPTY_FORM: EmployeeForm = { full_name: "", email: "", phone: "", department: "", employee_id: "" };

export default function EmployeesPage() {
  const t = useTranslations("company.employees");
  const tCredentials = useTranslations("company.credentials");
  const tCommon = useTranslations("common");
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isTrialUser = !!user?.is_trial;
  const maxEmployees = user?.trial_modules === "both" ? 6 : 3;
  const company = useAppSelector(selectCompany);
  const employees = useAppSelector(selectEmployees);
  const status = useAppSelector(selectEmployeesStatus);
  const loading = status === "loading";

  const lastFetchedParams = useRef<string>("");
  useEffect(() => {
    if (!company?.id) return;
    if (company.id.toString() === lastFetchedParams.current && status !== "idle") return;
    lastFetchedParams.current = company.id.toString();
    dispatch(fetchEmployees(company.id.toString()));
  }, [dispatch, company?.id, status]);

  // Filters (client-side over the full roster the slice already fetches)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (statusFilter && e.status.toUpperCase() !== statusFilter) return false;
      if (!q) return true;
      return [e.full_name, e.email, e.phone, e.employee_id, e.department].some((v) => v?.toLowerCase().includes(q));
    });
  }, [employees, search, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage]);
  const activeFilters = (search ? 1 : 0) + (statusFilter ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPage(1);
  };

  // Edit dialog
  const [editing, setEditing] = useState<Employee | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Add dialog
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; full_name: string } | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);

  const atEmployeeLimit = isTrialUser && employees.length >= maxEmployees;
  const trialHint = isTrialUser ? t("trialBanner", { used: employees.length, max: maxEmployees }) : undefined;

  const phoneMessages = { required: tCommon("validation.phoneRequired"), invalid: tCommon("validation.phoneInvalid") };

  function closeAdd() {
    setShowAdd(false);
    setCreated(false);
    setCreatedCredentials(null);
    setFormError(null);
    setForm(EMPTY_FORM);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!company?.id) return;
    const phoneError = getPhoneValidationError(form.phone, { messages: phoneMessages });
    if (phoneError) {
      setFormError(phoneError);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await apiClient.createEmployee({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        department: form.department.trim() || undefined,
        employee_id: form.employee_id.trim() || undefined,
        company_id: Number(company.id),
      });
      const password = res.data?.password ?? (res.data as { generatedPassword?: string })?.generatedPassword;
      if (password) setCreatedCredentials({ email: form.email.trim(), password, full_name: form.full_name.trim() });
      setCreated(true);
      dispatch(fetchEmployees(company.id.toString()));
      toast.success(t("employeeCreatedSuccess"));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("failedCreateEmployee"));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(employee: Employee) {
    setEditing(employee);
    setEditPhone(employee.phone || "");
    setEditEmail(employee.email);
    setEditError(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const phoneError = getPhoneValidationError(editPhone, { messages: phoneMessages });
    if (phoneError) {
      setEditError(phoneError);
      return;
    }
    setEditSaving(true);
    const result = await dispatch(updateEmployee({ employeeId: editing.id, data: { phone: editPhone, email: editEmail } }));
    setEditSaving(false);
    if (updateEmployee.fulfilled.match(result)) {
      toast.success(t("updatedSuccess"));
      if (company?.id) dispatch(fetchEmployees(company.id.toString()));
      setEditing(null);
    } else {
      setEditError((result.payload as string) || tCommon("errors.failedToUpdateEmployee"));
    }
  }

  async function handleToggleStatus(employee: Employee) {
    const isActive = employee.status.toLowerCase() === "active";
    const ok = await confirm({
      title: isActive ? t("deactivateUser") : t("activateUser"),
      message: t("confirmStatusChange", { action: isActive ? tCommon("actions.deactivate") : tCommon("actions.activate"), name: employee.full_name }),
      consequences: [isActive ? t("deactivateConsequence") : t("activateConsequence")],
      confirmLabel: isActive ? t("deactivateUser") : t("activateUser"),
      destructive: isActive,
    });
    if (!ok) return;
    const result = await dispatch(deactivateEmployee({ employeeId: employee.id, isActive: !isActive }));
    if (deactivateEmployee.fulfilled.match(result)) {
      toast.success(t("statusChanged", { name: employee.full_name, status: !isActive ? t("activated") : t("deactivated") }));
    } else {
      toast.error((result.payload as string) || tCommon("errors.failedToUpdateEmployeeStatus"));
    }
  }

  const columns: DataTableColumn<Employee>[] = [
    { key: "employee_id", header: t("employeeId"), mono: true, hideBelow: "md", cell: (e) => <span className="text-fg-muted">{e.employee_id || "—"}</span> },
    { key: "full_name", header: t("fullName"), cell: (e) => <span className="font-medium text-fg">{e.full_name}</span> },
    { key: "phone", header: t("phone"), hideBelow: "sm", cell: (e) => <span dir="ltr" className="text-fg-secondary">{e.phone || "—"}</span> },
    { key: "email", header: t("email"), hideBelow: "lg", cell: (e) => <span dir="ltr" className="text-fg-secondary">{e.email || "—"}</span> },
    { key: "department", header: t("department"), hideBelow: "lg", cell: (e) => <span className="text-fg-muted">{e.department || "—"}</span> },
    { key: "status", header: t("status"), cell: (e) => <StatusBadge status={e.status} /> },
  ];

  const rowActions = (e: Employee): ActionMenuItem[] => {
    const isActive = e.status.toLowerCase() === "active";
    return [
      { label: t("editDetails"), icon: <Pencil />, onSelect: () => startEdit(e) },
      { label: isActive ? t("deactivateUser") : t("activateUser"), icon: <Power />, destructive: isActive, separatorBefore: true, onSelect: () => void handleToggleStatus(e) },
    ];
  };

  if (!company) {
    return <EmptyState title={tCommon("errors.noCompanySelected")} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={isTrialUser ? t("trialInfoDescription") : t("infoDescription")}
        actions={
          <Button leftIcon={<UserPlus />} onClick={() => setShowAdd(true)} disabled={atEmployeeLimit} title={atEmployeeLimit ? trialHint : undefined}>
            {t("addEmployee")}
          </Button>
        }
      />

      {isTrialUser && (
        <div role="status" className="rounded-lg border border-brand-line bg-brand-soft px-4 py-2.5 text-sm text-fg">
          {trialHint}
        </div>
      )}

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar
            search={{
              value: search,
              onChange: (v) => {
                setSearch(v);
                setPage(1);
              },
              placeholder: t("searchPlaceholder"),
            }}
            activeCount={activeFilters}
            onClear={clearFilters}
          >
            <FilterField label={t("status")}>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                placeholder={t("allStatuses")}
                className="h-8 text-xs"
              >
                <option value="ACTIVE">{tCommon("status.active")}</option>
                <option value="INACTIVE">{tCommon("status.inactive")}</option>
              </Select>
            </FilterField>
          </FilterBar>
        </CardContent>

        <DataTable<Employee>
          caption={t("title")}
          columns={columns}
          rows={pageRows}
          rowKey={(e) => e.id}
          loading={loading && employees.length === 0}
          empty={{
            icon: <Users aria-hidden="true" />,
            title: activeFilters > 0 ? t("noMatches") : t("noEmployees"),
            action:
              activeFilters > 0 ? (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  {t("clearFilters")}
                </Button>
              ) : undefined,
          }}
          rowActions={rowActions}
          pagination={{ page: safePage, totalPages, total: filtered.length, pageSize: PAGE_SIZE, onPageChange: setPage }}
        />
      </Card>

      {/* Edit details */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && !editSaving && setEditing(null)}>
        <DialogContent
          title={t("editDetails")}
          description={editing?.full_name}
          footer={
            <>
              <Button variant="outline" type="button" onClick={() => setEditing(null)} disabled={editSaving}>
                {tCommon("actions.cancel")}
              </Button>
              <Button type="submit" form="employee-edit-form" loading={editSaving}>
                {tCommon("actions.save")}
              </Button>
            </>
          }
        >
          <form id="employee-edit-form" onSubmit={saveEdit} className="space-y-4">
            <Field label={t("email")} required>
              <Input type="email" dir="ltr" value={editEmail} onChange={(ev) => setEditEmail(ev.target.value)} required />
            </Field>
            <Field label={t("phone")} required hint={tCommon("validation.phoneInvalid")}>
              <Input
                type="tel"
                dir="ltr"
                inputMode="numeric"
                maxLength={PHONE_MAX_LENGTH}
                value={editPhone}
                onChange={(ev) => setEditPhone(sanitizePhoneInput(ev.target.value))}
                placeholder={tCommon("validation.phonePlaceholder")}
                required
              />
            </Field>
            {editError && <InlineError>{editError}</InlineError>}
          </form>
        </DialogContent>
      </Dialog>

      {/* Add employee */}
      <Dialog open={showAdd} onOpenChange={(open) => !open && !saving && closeAdd()}>
        <DialogContent
          title={created ? t("employeeCreatedTitle") : t("addEmployee")}
          footer={
            created ? (
              <Button type="button" onClick={closeAdd}>
                {tCredentials("done")}
              </Button>
            ) : (
              <>
                <Button variant="outline" type="button" onClick={closeAdd} disabled={saving}>
                  {tCommon("actions.cancel")}
                </Button>
                <Button type="submit" form="employee-add-form" leftIcon={<UserPlus />} loading={saving} disabled={!form.full_name.trim() || !form.email.trim()}>
                  {t("addEmployee")}
                </Button>
              </>
            )
          }
        >
          {created ? (
            createdCredentials ? (
              <AccountCredentialsReveal
                email={createdCredentials.email}
                password={createdCredentials.password}
                fullName={createdCredentials.full_name}
                subtitle={tCredentials("employeeAppSubtitle")}
                accountTypeKey="employee"
              />
            ) : (
              <SaveCredentialsNote accountTypeKey="employee" />
            )
          ) : (
            <form id="employee-add-form" onSubmit={handleAdd} className="space-y-4">
              <SaveCredentialsNote accountTypeKey="employee" />
              <FormGrid cols={2}>
                <Field label={t("fullName")} required className="sm:col-span-2">
                  <Input required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder={t("namePlaceholder")} />
                </Field>
                <Field label={t("employeeId")}>
                  <Input value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} placeholder={t("employeeIdPlaceholder")} />
                </Field>
                <Field label={t("department")}>
                  <Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder={t("departmentPlaceholder")} />
                </Field>
                <Field label={t("email")} required className="sm:col-span-2">
                  <Input required type="email" dir="ltr" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder={t("emailPlaceholder")} />
                </Field>
                <Field label={t("phone")} required className="sm:col-span-2" hint={tCommon("validation.phoneInvalid")}>
                  <Input
                    type="tel"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={PHONE_MAX_LENGTH}
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: sanitizePhoneInput(e.target.value) }))}
                    placeholder={tCommon("validation.phonePlaceholder")}
                    required
                  />
                </Field>
              </FormGrid>
              {formError && <InlineError>{formError}</InlineError>}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
