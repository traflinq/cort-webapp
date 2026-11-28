"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Check, Pencil, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { useCompanyAccess } from "../lib/access-context";
import { fetchEmployees, selectEmployees, selectEmployeesStatus, updateEmployee, deactivateEmployee } from "../../lib/store/slices/employeeSlice";
import { apiClient } from "../../lib/services/api-client";
import { Card } from "../components/Card";
import { KpiTile } from "../components/overview/KpiTile";
import { useCompanyLocale } from "../lib/locale-context";
import { formatLocaleNumber } from "../../lib/i18n/format";
import { Button, Dialog, DialogContent, Field, IconButton, InlineError, Input, StatusBadge, TableSkeletonRows } from "@/app/admin/ui";
import { AccountCredentialsReveal, SaveCredentialsNote } from "../components/AccountCredentialsReveal";
import { PageHeader, TableEmptyState, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../components/PageLayout";
import { COMPANY_PAGE_SIZE, TablePagination } from "../components/TablePagination";
import {
  getPhoneValidationError,
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  sanitizePhoneInput,
} from "../../lib/utils/phone";
import { toast } from "sonner";

export default function EmployeesPage() {
  const t = useTranslations("company.employees");
  const tCredentials = useTranslations("company.credentials");
  const tCommon = useTranslations("common");
  const { locale } = useCompanyLocale();
  const num = (v: number) => formatLocaleNumber(v, locale);
  const dispatch = useAppDispatch();
  const { company, access } = useCompanyAccess();
  const isTrialUser = !!access.trial;
  const maxEmployees = access.trial?.pool && access.trial.shuttle ? 6 : 3;
  const employees = useAppSelector(selectEmployees);
  const status = useAppSelector(selectEmployeesStatus);
  const loading = status === 'loading';

  const [lastFetchedParams, setLastFetchedParams] = useState<string>("");

  useEffect(() => {
    if (!company?.id) return;

    if (company.id.toString() === lastFetchedParams && status !== 'idle') return;

    setLastFetchedParams(company.id.toString());
    dispatch(fetchEmployees(company.id.toString()));
  }, [dispatch, company?.id, lastFetchedParams, status]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState<string>("");
  const [editEmail, setEditEmail] = useState<string>("");

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [employeeFormError, setEmployeeFormError] = useState<string | null>(null);
  const [employeeCreated, setEmployeeCreated] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; full_name: string } | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    department: "",
    employee_id: "",
  });

  const atEmployeeLimit = isTrialUser && employees.length >= maxEmployees;

  const [currentPage, setCurrentPage] = useState(1);
  const totalEmployees = employees.length;
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status?.toLowerCase() === "active").length,
    [employees],
  );
  const totalPages = Math.max(1, Math.ceil(totalEmployees / COMPANY_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * COMPANY_PAGE_SIZE;
  const pagedEmployees = employees.slice(pageStart, pageStart + COMPANY_PAGE_SIZE);

  function closeAddEmployeeModal() {
    setShowAddEmployee(false);
    setEmployeeCreated(false);
    setCreatedCredentials(null);
    setEmployeeFormError(null);
    setEmployeeForm({ full_name: "", email: "", phone: "", department: "", employee_id: "" });
  }

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!company?.id) return;
    const phoneError = getPhoneValidationError(employeeForm.phone, {
      messages: {
        required: tCommon("validation.phoneRequired"),
        invalid: tCommon("validation.phoneInvalid"),
      },
    });
    if (phoneError) {
      setEmployeeFormError(phoneError);
      return;
    }
    setEmployeeSaving(true);
    setEmployeeFormError(null);
    try {
      const created = await apiClient.createEmployee({
        full_name: employeeForm.full_name.trim(),
        email: employeeForm.email.trim(),
        phone: employeeForm.phone.trim(),
        department: employeeForm.department.trim() || undefined,
        employee_id: employeeForm.employee_id.trim() || undefined,
        company_id: Number(company.id),
      });
      const password = created.data?.password ?? (created.data as { generatedPassword?: string })?.generatedPassword;
      if (password) {
        setCreatedCredentials({
          email: employeeForm.email.trim(),
          password,
          full_name: employeeForm.full_name.trim(),
        });
      }
      setEmployeeCreated(true);
      dispatch(fetchEmployees(company.id.toString()));
      toast.success(t("employeeCreatedSuccess"));
    } catch (err) {
      setEmployeeFormError(err instanceof Error ? err.message : t("failedCreateEmployee"));
    } finally {
      setEmployeeSaving(false);
    }
  }

  function startEdit(employee: typeof employees[0]) {
    setEditingId(employee.id);
    setEditPhone(employee.phone || "");
    setEditEmail(employee.email);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPhone("");
    setEditEmail("");
  }

  async function saveEdit(employee: typeof employees[0]) {
    if (!editingId) return;
    const phoneError = getPhoneValidationError(editPhone, {
      messages: {
        required: tCommon("validation.phoneRequired"),
        invalid: tCommon("validation.phoneInvalid"),
      },
    });
    if (phoneError) {
      toast.error(phoneError);
      return;
    }
    const result = await dispatch(updateEmployee({
      employeeId: employee.id,
      data: { phone: editPhone, email: editEmail }
    }));
    if (updateEmployee.fulfilled.match(result)) {
      toast.success(t("updatedSuccess"));
      if (company?.id) dispatch(fetchEmployees(company.id.toString()));
    } else {
      toast.error((result.payload as string) || tCommon("errors.failedToUpdateEmployee"));
    }
    cancelEdit();
  }

  async function handleDeactivate(employee: typeof employees[0]) {
    const isActive = employee.status.toLowerCase() === "active";
    if (confirm(t("confirmStatusChange", {
      action: isActive ? tCommon("actions.deactivate") : tCommon("actions.activate"),
      name: employee.full_name,
    }))) {
      const result = await dispatch(deactivateEmployee({
        employeeId: employee.id,
        isActive: !isActive
      }));
      if (deactivateEmployee.fulfilled.match(result)) {
        toast.success(t("statusChanged", {
          name: employee.full_name,
          status: !isActive ? t("activated") : t("deactivated"),
        }));
      } else {
        toast.error((result.payload as string) || tCommon("errors.failedToUpdateEmployeeStatus"));
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12">
      <PageHeader
        label={t("label")}
        title={t("title")}
        action={
          <Button
            leftIcon={<UserPlus />}
            onClick={() => setShowAddEmployee(true)}
            disabled={atEmployeeLimit}
            title={atEmployeeLimit ? t("trialBanner", { used: employees.length, max: maxEmployees }) : undefined}
          >
            {t("addEmployee")}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile label={t("totalEmployees")} value={num(totalEmployees)} />
        <KpiTile label={t("activeEmployees")} value={num(activeEmployees)} />
        <KpiTile label={t("inactiveEmployees")} value={num(totalEmployees - activeEmployees)} />
      </div>

      {isTrialUser && (
        <div role="note" className="rounded-lg border border-warning-line bg-warning-soft px-4 py-3 text-sm text-fg">
          {t("trialBanner", { used: employees.length, max: maxEmployees })}
        </div>
      )}

      <Card className={TABLE_CARD_CLASS}>
        <div className={TABLE_TOP_BAR_CLASS}>
          <h2 className="text-sm font-semibold text-fg">
            {isTrialUser ? t("trialInfoTitle") : t("infoTitle")}
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-fg-muted">
            {isTrialUser ? t("trialInfoDescription") : t("infoDescription")}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-start text-sm">
            <thead>
              <tr className="border-b border-line text-start">
                <th className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("employeeId")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("fullName")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("phone")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("email")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("department")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("status")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && employees.length === 0 ? (
                <TableSkeletonRows columns={7} rows={8} />
              ) : employees.length === 0 && !loading ? (
                <TableEmptyState message={t("noEmployees")} icon={Users} />
              ) : (
                pagedEmployees.map((e) => {
                  const isEditing = editingId === e.id;
                  const isActive = e.status.toLowerCase() === "active";
                  return (
                    <tr key={e.id} className={isEditing ? "bg-subtle" : "transition-colors hover:bg-row-hover"}>
                      <td className={`${TABLE_CELL_CLASS} font-mono text-xs text-fg-muted`}>{e.employee_id || "—"}</td>
                      <td className={`${TABLE_CELL_CLASS} font-medium text-fg`}>{e.full_name}</td>
                      <td className={TABLE_CELL_CLASS}>
                        {isEditing ? (
                          <Input
                            type="tel"
                            inputMode="numeric"
                            maxLength={PHONE_MAX_LENGTH}
                            value={editPhone}
                            onChange={(ev) => setEditPhone(sanitizePhoneInput(ev.target.value))}
                            placeholder={tCommon("validation.phonePlaceholder")}
                            aria-label={t("phone")}
                            className="h-8 min-w-36"
                          />
                        ) : (
                          <span className="ltr-content text-fg-secondary">{e.phone || "—"}</span>
                        )}
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        {isEditing ? (
                          <Input
                            value={editEmail}
                            onChange={(ev) => setEditEmail(ev.target.value)}
                            placeholder={t("email")}
                            aria-label={t("email")}
                            className="h-8 min-w-48"
                          />
                        ) : (
                          <span className="ltr-content text-fg-secondary">{e.email || "—"}</span>
                        )}
                      </td>
                      <td className={`${TABLE_CELL_CLASS} text-fg-secondary`}>{e.department || "—"}</td>
                      <td className={TABLE_CELL_CLASS}>
                        <StatusBadge status={e.status} size="sm" />
                      </td>
                      <td className={`${TABLE_CELL_CLASS} text-end`}>
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={() => saveEdit(e)}>
                                {tCommon("actions.save")}
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                {tCommon("actions.cancel")}
                              </Button>
                            </>
                          ) : (
                            <>
                              <IconButton label={t("editDetails")} size="icon-sm" onClick={() => startEdit(e)}>
                                <Pencil />
                              </IconButton>
                              <IconButton
                                label={isActive ? t("deactivateUser") : t("activateUser")}
                                size="icon-sm"
                                onClick={() => handleDeactivate(e)}
                                className={isActive ? "hover:bg-danger-soft hover:text-danger-ink" : "hover:bg-success-soft hover:text-success-ink"}
                              >
                                {isActive ? <Ban /> : <Check />}
                              </IconButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={safePage}
          totalPages={totalPages}
          total={totalEmployees}
          pageSize={COMPANY_PAGE_SIZE}
          onPageChange={setCurrentPage}
          summary={(range) => t("showingRange", range)}
        />
      </Card>

      <Dialog open={showAddEmployee} onOpenChange={(open) => { if (!open) closeAddEmployeeModal(); }}>
        <DialogContent
          size="md"
          title={employeeCreated ? t("employeeCreatedTitle") : t("addEmployee")}
          onInteractOutside={(ev) => ev.preventDefault()}
        >
          {employeeCreated ? (
            <div className="space-y-5">
              {createdCredentials ? (
                <AccountCredentialsReveal
                  email={createdCredentials.email}
                  password={createdCredentials.password}
                  fullName={createdCredentials.full_name}
                  subtitle={tCredentials("employeeAppSubtitle")}
                  accountTypeKey="employee"
                />
              ) : (
                <SaveCredentialsNote accountTypeKey="employee" />
              )}
              <div className="flex justify-end">
                <Button type="button" onClick={closeAddEmployeeModal}>
                  {tCredentials("done")}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <SaveCredentialsNote accountTypeKey="employee" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("fullName")} required className="sm:col-span-2">
                  <Input required value={employeeForm.full_name} onChange={(e) => setEmployeeForm((f) => ({ ...f, full_name: e.target.value }))} placeholder={t("namePlaceholder")} />
                </Field>
                <Field label={t("employeeId")}>
                  <Input value={employeeForm.employee_id} onChange={(e) => setEmployeeForm((f) => ({ ...f, employee_id: e.target.value }))} placeholder={t("employeeIdPlaceholder")} />
                </Field>
                <Field label={t("department")}>
                  <Input value={employeeForm.department} onChange={(e) => setEmployeeForm((f) => ({ ...f, department: e.target.value }))} placeholder={t("departmentPlaceholder")} />
                </Field>
                <Field label={t("email")} required className="sm:col-span-2">
                  <Input required type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm((f) => ({ ...f, email: e.target.value }))} placeholder={t("emailPlaceholder")} />
                </Field>
                <Field label={t("phone")} className="sm:col-span-2">
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={PHONE_MAX_LENGTH}
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm((f) => ({ ...f, phone: sanitizePhoneInput(e.target.value) }))}
                    placeholder={PHONE_PLACEHOLDER}
                  />
                </Field>
              </div>
              {employeeFormError && <InlineError>{employeeFormError}</InlineError>}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={closeAddEmployeeModal}>
                  {tCommon("actions.cancel")}
                </Button>
                <Button
                  type="submit"
                  leftIcon={<UserPlus />}
                  disabled={employeeSaving || !employeeForm.full_name.trim() || !employeeForm.email.trim()}
                >
                  {employeeSaving ? t("addingEmployee") : t("addEmployee")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
