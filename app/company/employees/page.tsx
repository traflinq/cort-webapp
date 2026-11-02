"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { selectCompany } from "../../lib/store/slices/companySlice";
import { fetchEmployees, selectEmployees, selectEmployeesStatus, updateEmployee, deactivateEmployee } from "../../lib/store/slices/employeeSlice";
import { useAuth } from "../../lib/contexts/auth-context";
import { apiClient } from "../../lib/services/api-client";
import { Card } from "../components/DashboardComponents";
import { AccountCredentialsReveal, SaveCredentialsNote } from "../components/AccountCredentialsReveal";
import { PageHeader, TableEmptyState, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../components/PageLayout";
import TablePageSkeleton from "../components/TablePageSkeleton";
import { IconCircleButton, IllustrationTile, PillButton } from "../ui";
import TableSkeleton from "@/app/components/ui/TableSkeleton";
import {
  getPhoneValidationError,
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  sanitizePhoneInput,
} from "../../lib/utils/phone";
import { toast } from "sonner";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-11 w-full rounded-full border border-[var(--border-input)] bg-[var(--bg-card)] px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--cort-orange)]/20 focus:border-[var(--cort-orange)] transition-colors text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]",
        props.className,
      )}
    />
  );
}

export default function EmployeesPage() {
  const t = useTranslations("company.employees");
  const tCredentials = useTranslations("company.credentials");
  const tCommon = useTranslations("common");
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const isTrialUser = !!user?.is_trial;
  const maxEmployees = user?.trial_modules === "both" ? 6 : 3;
  const company = useAppSelector(selectCompany);
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

  if (!company) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-[var(--text-muted)]">{tCommon("errors.noCompanySelected")}</div>
      </div>
    );
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
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      <PageHeader label={t("label")} title={t("title")} />

      {isTrialUser && (
        <div className="alert-banner-warning">
          {t("trialBanner", { used: employees.length, max: maxEmployees })}
        </div>
      )}

      <Card className={`min-h-[500px] ${TABLE_CARD_CLASS}`}>
        <div className={TABLE_TOP_BAR_CLASS}>
          <div className="flex items-start justify-between gap-4 w-full">
            <div className="flex items-center gap-4">
              <IllustrationTile name="clipboard" size="md" />
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {isTrialUser ? t("trialInfoTitle") : t("infoTitle")}
                </div>
                <div className="text-sm text-[var(--text-muted)] mt-0.5 leading-relaxed max-w-3xl">
                  {isTrialUser ? t("trialInfoDescription") : t("infoDescription")}
                </div>
              </div>
            </div>
            <PillButton
              variant="primary"
              icon={<UserPlus strokeWidth={2} />}
              onClick={() => setShowAddEmployee(true)}
              disabled={atEmployeeLimit}
              title={atEmployeeLimit ? t("trialBanner", { used: employees.length, max: maxEmployees }) : undefined}
            >
              {t("addEmployee")}
            </PillButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-start">
            <thead>
              <tr className="border-b border-[var(--border-light)]">
                <th className={TABLE_HEADER_CELL_CLASS}>{t("employeeId")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("fullName")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("phone")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("email")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("department")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("status")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {loading && employees.length === 0 ? (
                <TableSkeleton columns={7} rows={8} />
              ) : employees.length === 0 && !loading ? (
                <TableEmptyState illustration="people" message={t("noEmployees")} />
              ) : (
                employees.map((e) => {
                  const isEditing = editingId === e.id;
                  return (
                    <tr key={e.id} className={`group transition-colors ${isEditing ? 'bg-[var(--cort-orange)]/5' : 'hover:bg-[var(--row-hover)]'}`}>
                      <td className={`${TABLE_CELL_CLASS} font-mono text-xs text-[var(--text-muted)]`}>{e.employee_id || "—"}</td>
                      <td className={`${TABLE_CELL_CLASS} font-medium text-[var(--text-primary)]`}>{e.full_name}</td>
                      <td className={TABLE_CELL_CLASS}>
                        {isEditing ? (
                          <TextInput
                            type="tel"
                            inputMode="numeric"
                            maxLength={PHONE_MAX_LENGTH}
                            value={editPhone}
                            onChange={(ev) => setEditPhone(sanitizePhoneInput(ev.target.value))}
                            placeholder={tCommon("validation.phonePlaceholder")}
                          />
                        ) : (
                          <span className="text-[var(--text-secondary)] font-medium">{e.phone || "—"}</span>
                        )}
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        {isEditing ? (
                          <TextInput
                            value={editEmail}
                            onChange={(ev) => setEditEmail(ev.target.value)}
                            placeholder={t("email")}
                          />
                        ) : (
                          <span className="text-[var(--text-secondary)]">{e.email || "—"}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-muted)]">{e.department || "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${e.status.toLowerCase() === 'active' ? 'bg-[var(--tone-success-soft)] text-[var(--tone-success-ink)] border-[var(--tone-success-line)]' :
 'bg-[var(--tone-danger-soft)] text-[var(--tone-danger-ink)] border-[var(--tone-danger-line)]'
 }`}>
                          <span className={`w-1.5 h-1.5 rounded-full me-1.5 ${e.status.toLowerCase() === 'active' ? 'bg-[var(--tone-success-ink)]' : 'bg-[var(--tone-danger-ink)]'}`}></span>
                          {e.status}
                        </span>
                      </td>
                      <td className={`${TABLE_CELL_CLASS} text-end`}>
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveEdit(e)}
                                className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--cort-orange)] px-4 text-xs font-medium text-white hover:bg-[var(--cort-orange-hover)] transition-colors"
                              >
                                {tCommon("actions.save")}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--pill-line)] px-4 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
                              >
                                {tCommon("actions.cancel")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(e)}
                                className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--pill-line)] text-[var(--text-primary)] hover:text-[var(--cort-orange)] hover:bg-[var(--tone-brand-soft)] transition-colors"
                                title={t("editDetails")}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeactivate(e)}
                                className={`inline-flex size-9 items-center justify-center rounded-full border border-[var(--pill-line)] transition-colors ${e.status.toLowerCase() === 'active' ? 'text-[var(--text-muted)] hover:text-[var(--tone-danger-ink)] hover:bg-[var(--tone-danger-soft)]' : 'text-[var(--text-muted)] hover:text-[var(--tone-success-ink)] hover:bg-[var(--tone-success-soft)]'}`}
                                title={e.status.toLowerCase() === "active" ? t("deactivateUser") : t("activateUser")}
                              >
                                {e.status.toLowerCase() === "active" ? (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                )}
                              </button>
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
      </Card>

      {showAddEmployee && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] backdrop-blur-[2px] p-4">
          <div className="bg-[var(--bg-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-modal)] w-full max-w-lg p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-medium text-[var(--text-primary)]">
                {employeeCreated ? t("employeeCreatedTitle") : t("addEmployee")}
              </h2>
              <IconCircleButton label={tCommon("actions.cancel")} variant="outline" size="sm" onClick={closeAddEmployeeModal}>
                <X strokeWidth={1.8} />
              </IconCircleButton>
            </div>

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
                <div className="flex justify-end pt-2">
                  <PillButton variant="primary" size="sm" onClick={closeAddEmployeeModal}>
                    {tCredentials("done")}
                  </PillButton>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <SaveCredentialsNote accountTypeKey="employee" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm text-[var(--text-secondary)] mb-1.5">{t("fullName")} *</label>
                    <TextInput required value={employeeForm.full_name} onChange={(e) => setEmployeeForm((f) => ({ ...f, full_name: e.target.value }))} placeholder={t("namePlaceholder")} />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1.5">{t("employeeId")}</label>
                    <TextInput value={employeeForm.employee_id} onChange={(e) => setEmployeeForm((f) => ({ ...f, employee_id: e.target.value }))} placeholder={t("employeeIdPlaceholder")} />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1.5">{t("department")}</label>
                    <TextInput value={employeeForm.department} onChange={(e) => setEmployeeForm((f) => ({ ...f, department: e.target.value }))} placeholder={t("departmentPlaceholder")} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-[var(--text-secondary)] mb-1.5">{t("email")} *</label>
                    <TextInput required type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm((f) => ({ ...f, email: e.target.value }))} placeholder={t("emailPlaceholder")} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-[var(--text-secondary)] mb-1.5">{t("phone")}</label>
                    <TextInput
                      type="tel"
                      inputMode="numeric"
                      maxLength={PHONE_MAX_LENGTH}
                      value={employeeForm.phone}
                      onChange={(e) => setEmployeeForm((f) => ({ ...f, phone: sanitizePhoneInput(e.target.value) }))}
                      placeholder={PHONE_PLACEHOLDER}
                    />
                  </div>
                </div>
                {employeeFormError && (
                  <div className="rounded-2xl border border-[var(--tone-danger-line)] bg-[var(--tone-danger-soft)] px-4 py-3 text-sm text-[var(--tone-danger-ink)]">
                    {employeeFormError}
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <PillButton variant="outline" size="sm" onClick={closeAddEmployeeModal}>
                    {tCommon("actions.cancel")}
                  </PillButton>
                  <PillButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon={<UserPlus strokeWidth={2} />}
                    disabled={employeeSaving || !employeeForm.full_name.trim() || !employeeForm.email.trim()}
                  >
                    {employeeSaving ? t("addingEmployee") : t("addEmployee")}
                  </PillButton>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
