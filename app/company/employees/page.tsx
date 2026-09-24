"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { selectCompany } from "../../lib/store/slices/companySlice";
import { fetchEmployees, selectEmployees, selectEmployeesStatus, updateEmployee, deactivateEmployee } from "../../lib/store/slices/employeeSlice";
import { useAuth } from "../../lib/contexts/auth-context";
import { apiClient } from "../../lib/services/api-client";
import { Card } from "../components/DashboardComponents";
import { AccountCredentialsReveal, SaveCredentialsNote } from "../components/AccountCredentialsReveal";
import { PageHeader, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../components/PageLayout";
import TablePageSkeleton from "../components/TablePageSkeleton";
import TableSkeleton from "@/app/components/ui/TableSkeleton";
import {
  getPhoneValidationError,
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  sanitizePhoneInput,
} from "../../lib/utils/phone";
import { toast } from "sonner";
import Modal, { ModalTrigger } from "../bookings/components/Modal";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-9 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--cort-orange)]/20 focus:border-[var(--cort-orange)] transition-all text-[var(--text-primary)] shadow-sm",
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

  useEffect(() => {
    if (!company?.id || !company.services_enabled?.travel_enabled) {
      setGrades([]);
      return;
    }
    apiClient.getCompanyTravelGrades(Number(company.id))
      .then((res) => setGrades(res.data || []))
      .catch(() => setGrades([]));
  }, [company?.id, company?.services_enabled?.travel_enabled]);

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
    travel_grade_id: "",
  });
  const [grades, setGrades] = useState<Array<{ id: number; name: string; approval_required: boolean }>>([]);
  const [editGradeId, setEditGradeId] = useState("");
  const [gradeName, setGradeName] = useState("");
  const [gradeNeedsApproval, setGradeNeedsApproval] = useState(true);
  const [savingGrade, setSavingGrade] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Record<number, string>>({});
  const travelEnabled = !!company?.services_enabled?.travel_enabled;

  const atEmployeeLimit = isTrialUser && employees.length >= maxEmployees;

  function closeAddEmployeeModal() {
    setShowAddEmployee(false);
    setEmployeeCreated(false);
    setCreatedCredentials(null);
    setEmployeeFormError(null);
    setEmployeeForm({ full_name: "", email: "", phone: "", department: "", employee_id: "", travel_grade_id: "" });
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
        travel_grade_id: employeeForm.travel_grade_id ? Number(employeeForm.travel_grade_id) : undefined,
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
    setEditGradeId(
      employee.travel_grade_id
        ? String(employee.travel_grade_id)
        : employee.travel_grade?.id
          ? String(employee.travel_grade.id)
          : "",
    );
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPhone("");
    setEditEmail("");
    setEditGradeId("");
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
      data: {
        phone: editPhone,
        email: editEmail,
        travel_grade_id: editGradeId ? Number(editGradeId) : null,
      }
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

  async function addGrade() {
    if (!company?.id || savingGrade) return;
    const name = gradeName.trim();
    if (!name) return;
    setSavingGrade(true);
    try {
      const res = await apiClient.createCompanyTravelGrade(Number(company.id), {
        name,
        approval_required: gradeNeedsApproval,
      });
      setGrades((current) => [...current, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setGradeName("");
      setGradeNeedsApproval(true);
      toast.success(t("gradeCreated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("gradeSaveFailed"));
    } finally {
      setSavingGrade(false);
    }
  }

  async function patchGrade(gradeId: number, body: { name?: string; approval_required?: boolean }) {
    if (!company?.id) return;
    try {
      const res = await apiClient.updateCompanyTravelGrade(Number(company.id), gradeId, body);
      setGrades((current) => current.map((row) => (row.id === gradeId ? { ...row, ...res.data } : row)));
      toast.success(t("gradeUpdated"));
      dispatch(fetchEmployees(company.id.toString()));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("gradeSaveFailed"));
    }
  }

  async function removeGrade(gradeId: number) {
    if (!company?.id) return;
    try {
      await apiClient.deleteCompanyTravelGrade(Number(company.id), gradeId);
      setGrades((current) => current.filter((row) => row.id !== gradeId));
      toast.success(t("gradeDeleted"));
      dispatch(fetchEmployees(company.id.toString()));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("gradeDeleteFailed"));
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

      {travelEnabled ? (
        <Card className="overflow-hidden !p-0">
          <div className="border-b border-[var(--border-light)] bg-[var(--surface-subtle)]/50 p-6">
            <div className="text-sm font-bold text-[var(--text-primary)]">{t("gradesTitle")}</div>
            <div className="text-sm text-[var(--text-muted)] mt-0.5 leading-relaxed max-w-3xl">{t("gradesHint")}</div>
          </div>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t("gradeName")}</label>
                <TextInput
                  value={gradeName}
                  onChange={(e) => setGradeName(e.target.value)}
                  placeholder={t("gradeNamePlaceholder")}
                  className="w-full"
                />
              </div>
              <label className="flex items-center gap-2 h-9 text-sm font-medium text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={gradeNeedsApproval}
                  onChange={(e) => setGradeNeedsApproval(e.target.checked)}
                />
                {t("requireApproval")}
              </label>
              <button
                type="button"
                onClick={addGrade}
                disabled={savingGrade || !gradeName.trim()}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[var(--cort-orange)] px-4 text-sm font-bold text-white shadow-sm hover:bg-[var(--cort-orange-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t("addGrade")}
              </button>
            </div>
            <div className="mt-4">
              {grades.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t("noGrades")}</p>
              ) : (
                grades.map((grade) => (
                  <div
                    key={grade.id}
                    className="flex flex-wrap items-center gap-3 py-3 border-b border-[var(--border-light)] last:border-b-0"
                  >
                    <input
                      value={editingGrade[grade.id] ?? grade.name}
                      onChange={(e) => setEditingGrade((current) => ({ ...current, [grade.id]: e.target.value }))}
                      onBlur={() => {
                        const next = (editingGrade[grade.id] ?? grade.name).trim();
                        if (!next || next === grade.name) {
                          setEditingGrade((current) => {
                            const copy = { ...current };
                            delete copy[grade.id];
                            return copy;
                          });
                          return;
                        }
                        patchGrade(grade.id, { name: next });
                      }}
                      className="flex-1 min-w-[8rem] h-9 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] px-3 text-sm font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--cort-orange)]/20 focus:border-[var(--cort-orange)]"
                    />
                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={grade.approval_required}
                        onChange={(e) => patchGrade(grade.id, { approval_required: e.target.checked })}
                      />
                      {t("requireApproval")}
                    </label>
                    <button
                      type="button"
                      onClick={() => removeGrade(grade.id)}
                      className="text-sm font-bold text-rose-500 hover:text-rose-400"
                    >
                      {t("deleteGrade")}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      ) : null}

      <Card className={`min-h-[500px] ${TABLE_CARD_CLASS}`}>
        <div className={TABLE_TOP_BAR_CLASS}>
          <div className="flex items-start justify-between gap-4 w-full">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[var(--cort-orange)]/10 border border-[var(--cort-orange)]/20 rounded-lg text-[var(--cort-orange)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">
                  {isTrialUser ? t("trialInfoTitle") : t("infoTitle")}
                </div>
                <div className="text-sm text-[var(--text-muted)] mt-0.5 leading-relaxed max-w-3xl">
                  {isTrialUser ? t("trialInfoDescription") : t("infoDescription")}
                </div>
              </div>
            </div>
            <ModalTrigger
              layoutId="company-add-employee"
              onClick={() => setShowAddEmployee(true)}
              disabled={atEmployeeLimit}
              title={atEmployeeLimit ? t("trialBanner", { used: employees.length, max: maxEmployees }) : undefined}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--cort-orange)] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[var(--cort-orange-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {t("addEmployee")}
            </ModalTrigger>
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
                {travelEnabled ? <th className={TABLE_HEADER_CELL_CLASS}>{t("grade")}</th> : null}
                <th className={TABLE_HEADER_CELL_CLASS}>{t("status")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]/50">
              {loading && employees.length === 0 ? (
                <TableSkeleton columns={travelEnabled ? 8 : 7} rows={8} />
              ) : employees.length === 0 && !loading ? (
                <tr>
                  <td colSpan={travelEnabled ? 8 : 7} className={`${TABLE_CELL_CLASS} py-12 text-center text-[var(--text-muted)]`}>
                    {t("noEmployees")}
                  </td>
                </tr>
              ) : (
                employees.map((e) => {
                  const isEditing = editingId === e.id;
                  return (
                    <tr key={e.id} className={`group transition-colors ${isEditing ? 'bg-[var(--cort-orange)]/5' : 'hover:bg-[var(--surface-subtle)]/80'}`}>
                      <td className={`${TABLE_CELL_CLASS} font-mono text-xs text-[var(--text-muted)]`}>{e.employee_id || "—"}</td>
                      <td className={`${TABLE_CELL_CLASS} font-bold text-[var(--text-primary)]`}>{e.full_name}</td>
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
                      {travelEnabled ? (
                        <td className={TABLE_CELL_CLASS}>
                          {isEditing ? (
                            <select
                              value={editGradeId}
                              onChange={(ev) => setEditGradeId(ev.target.value)}
                              className="h-9 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--cort-orange)]/20 focus:border-[var(--cort-orange)] text-[var(--text-primary)]"
                            >
                              <option value="">{t("noGrade")}</option>
                              {grades.map((grade) => (
                                <option key={grade.id} value={grade.id}>{grade.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[var(--text-secondary)]">{e.travel_grade?.name || t("noGrade")}</span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${e.status.toLowerCase() === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full me-1.5 ${e.status.toLowerCase() === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
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
                                className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--cort-orange)] px-3 text-xs font-bold text-[var(--text-primary)] shadow-sm hover:bg-[var(--cort-orange-hover)] transition-colors"
                              >
                                {tCommon("actions.save")}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border-input)] bg-[var(--bg-subtle)] px-3 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                              >
                                {tCommon("actions.cancel")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(e)}
                                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--cort-orange)] hover:bg-[var(--cort-orange)]/10 rounded-lg transition-colors"
                                title={t("editDetails")}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeactivate(e)}
                                className={`p-1.5 rounded-lg transition-colors ${e.status.toLowerCase() === 'active' ? 'text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10' : 'text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10'}`}
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

      <Modal
        isOpen={showAddEmployee}
        onClose={closeAddEmployeeModal}
        title={employeeCreated ? t("employeeCreatedTitle") : t("addEmployee")}
        layoutId="company-add-employee"
        panelClassName="!max-w-lg"
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
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={closeAddEmployeeModal}
                    className="bg-[var(--cort-orange)] text-[var(--text-primary)] px-4 py-2 rounded-lg text-sm font-bold hover:bg-[var(--cort-orange-hover)] transition-colors"
                  >
                    {tCredentials("done")}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <SaveCredentialsNote accountTypeKey="employee" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t("fullName")} *</label>
                    <TextInput required value={employeeForm.full_name} onChange={(e) => setEmployeeForm((f) => ({ ...f, full_name: e.target.value }))} placeholder={t("namePlaceholder")} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t("employeeId")}</label>
                    <TextInput value={employeeForm.employee_id} onChange={(e) => setEmployeeForm((f) => ({ ...f, employee_id: e.target.value }))} placeholder={t("employeeIdPlaceholder")} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t("department")}</label>
                    <TextInput value={employeeForm.department} onChange={(e) => setEmployeeForm((f) => ({ ...f, department: e.target.value }))} placeholder={t("departmentPlaceholder")} />
                  </div>
                  {travelEnabled ? (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t("grade")}</label>
                      <select
                        value={employeeForm.travel_grade_id}
                        onChange={(e) => setEmployeeForm((f) => ({ ...f, travel_grade_id: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--cort-orange)]/20 focus:border-[var(--cort-orange)] text-[var(--text-primary)]"
                      >
                        <option value="">{t("noGrade")}</option>
                        {grades.map((grade) => (
                          <option key={grade.id} value={grade.id}>{grade.name}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{t("noGradeHint")}</p>
                    </div>
                  ) : null}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t("email")} *</label>
                    <TextInput required type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm((f) => ({ ...f, email: e.target.value }))} placeholder={t("emailPlaceholder")} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t("phone")}</label>
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
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {employeeFormError}
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeAddEmployeeModal} className="border border-[var(--border-light)] text-[var(--text-secondary)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--surface-subtle)] transition-colors">
                    {tCommon("actions.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={employeeSaving || !employeeForm.full_name.trim() || !employeeForm.email.trim()}
                    className="inline-flex items-center gap-2 bg-[var(--cort-orange)] text-[var(--text-primary)] px-4 py-2 rounded-lg text-sm font-bold hover:bg-[var(--cort-orange-hover)] disabled:opacity-50 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    {employeeSaving ? t("addingEmployee") : t("addEmployee")}
                  </button>
                </div>
              </form>
            )}
      </Modal>
    </div>
  );
}
