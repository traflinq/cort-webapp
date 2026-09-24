"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiClient } from "../../../lib/services/api-client";
import { useAuth } from "../../../lib/contexts/auth-context";
import { Card } from "../../components/DashboardComponents";
import { PageHeader, TABLE_CELL_CLASS, TABLE_HEADER_CELL_CLASS } from "../../components/PageLayout";
import {
  Field,
  KpiCard,
  PRIMARY_BUTTON_CLASS,
  TextInput,
  money,
} from "../travel-ui";

type EmployeeWalletRow = {
  id: string;
  full_name: string | null;
  email?: string | null;
  employee_id?: string | null;
  allocated?: boolean;
  balance?: number;
  remaining?: number;
  allocated_total?: number;
  used_total?: number;
};

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

function amountForEmployee(
  emp: EmployeeWalletRow,
  selected: Record<string, boolean>,
  custom: Record<string, string>,
  equalAmount: string,
) {
  if (!selected[emp.id]) return 0;
  return asNumber(custom[emp.id] || equalAmount);
}

export default function TravelWalletsPage() {
  const t = useTranslations("company.travel");
  const { user } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [employees, setEmployees] = useState<EmployeeWalletRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [equalAmount, setEqualAmount] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    if (!user?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [w, list] = await Promise.all([
        apiClient.getCompanyTravelWallet(user.company_id),
        apiClient.getCompanyEmployeeTravelWallets(user.company_id),
      ]);
      setWallet(w.data);
      setEmployees(list.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("loadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user?.company_id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const haystack = [emp.full_name, emp.email, emp.employee_id].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [employees, query]);

  const selectedEmployees = employees.filter((e) => selected[e.id]);
  const assignmentTotal = selectedEmployees.reduce(
    (sum, emp) => sum + amountForEmployee(emp, selected, custom, equalAmount),
    0,
  );
  const companyBalance = asNumber(wallet?.balance);
  const companyLeft = companyBalance - assignmentTotal;
  const overBudget = assignmentTotal > companyBalance;
  const canAssign =
    selectedEmployees.some((e) => amountForEmployee(e, selected, custom, equalAmount) > 0) &&
    !assigning &&
    !overBudget;

  const allVisibleSelected = filtered.length > 0 && filtered.every((emp) => selected[emp.id]);

  const assign = async () => {
    if (!user?.company_id || !canAssign) return;
    const assignments = selectedEmployees
      .map((e) => ({
        employee_id: e.id,
        amount: amountForEmployee(e, selected, custom, equalAmount),
      }))
      .filter((a) => a.amount > 0);
    if (assignments.length === 0) return;
    setAssigning(true);
    try {
      await apiClient.assignEmployeeTravelWallets(user.company_id, assignments);
      toast.success(t("assignedSuccess"));
      setEqualAmount("");
      setCustom({});
      setSelected({});
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("assignFailed"));
    } finally {
      setAssigning(false);
    }
  };

  const toggleAllVisible = () => {
    const nextSelected = { ...selected };
    const nextValue = !allVisibleSelected;
    for (const emp of filtered) nextSelected[emp.id] = nextValue;
    setSelected(nextSelected);
  };

  const applySameAmount = () => {
    if (!equalAmount || selectedEmployees.length === 0) return;
    setCustom((current) => {
      const next = { ...current };
      for (const emp of selectedEmployees) next[emp.id] = equalAmount;
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader label={t("label")} title={t("walletTitle")} description={t("walletDescription")} />
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label={t("allocatedToCompany")}
          value={money(wallet?.company_allocated_total ?? (Number(wallet?.balance ?? 0) + Number(wallet?.employee_allocated_total ?? 0)))}
          loading={loading}
        />
        <KpiCard
          label={t("allocatedToEmployees")}
          value={money(wallet?.employee_allocated_total ?? 0)}
          loading={loading}
        />
        <KpiCard label={t("usedByEmployees")} value={money(wallet?.employee_used_total)} loading={loading} />
        <KpiCard
          label={t("remaining")}
          value={money(wallet?.employee_remaining_total ?? wallet?.assigned_total)}
          loading={loading}
        />
      </div>

      <Card>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
          {t("allocateTitle")}
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{t("allocateHint")}</p>
        <div className="mt-4 flex flex-col xl:flex-row xl:items-end gap-3">
          <Field label={t("searchEmployees")} className="flex-1 min-w-0">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchEmployees")}
            />
          </Field>
          <Field label={t("amount")} className="xl:w-48">
            <TextInput
              type="number"
              min={0}
              value={equalAmount}
              onChange={(e) => setEqualAmount(e.target.value)}
              placeholder="0"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleAllVisible}
              disabled={filtered.length === 0}
              className="h-12 px-4 rounded-xl border border-[var(--border-default)] text-sm font-bold text-[var(--text-primary)] disabled:opacity-60"
            >
              {allVisibleSelected ? t("clearSelection") : t("selectAll")}
            </button>
            <button
              type="button"
              onClick={applySameAmount}
              disabled={!equalAmount || selectedEmployees.length === 0}
              className="h-12 px-4 rounded-xl border border-[var(--border-default)] text-sm font-bold text-[var(--text-primary)] disabled:opacity-60"
            >
              {t("applySameAmount")}
            </button>
            <button onClick={assign} disabled={!canAssign} className={`${PRIMARY_BUTTON_CLASS} h-12`}>
              {assigning ? t("saving") : t("assign")}
            </button>
          </div>
        </div>
        <p className={`mt-3 text-sm font-semibold ${overBudget ? "text-rose-600" : "text-[var(--text-muted)]"}`}>
          {overBudget
            ? t("notEnoughBalance")
            : t("allocateSummary", {
                count: selectedEmployees.length,
                total: money(assignmentTotal),
                left: money(companyLeft),
              })}
        </p>
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="px-6 py-4 border-b border-[var(--border-light)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
            {t("employees")}
          </p>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--surface-subtle)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--text-muted)]">{t("emptyWallets")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-[var(--surface-subtle)]/50">
                <tr>
                  <th className={`${TABLE_HEADER_CELL_CLASS} w-12`}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label={t("selectAll")}
                    />
                  </th>
                  <th className={TABLE_HEADER_CELL_CLASS}>{t("employee")}</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>{t("allocatedToEmployees")}</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>{t("used")}</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>{t("remaining")}</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>{t("topUp")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => {
                  const remaining = asNumber(emp.remaining ?? emp.balance);
                  const allocatedTotal = asNumber(emp.allocated_total);
                  const usedTotal = asNumber(emp.used_total ?? Math.max(0, allocatedTotal - remaining));
                  return (
                    <tr key={emp.id} className="border-t border-[var(--border-light)]">
                      <td className={TABLE_CELL_CLASS}>
                        <input
                          type="checkbox"
                          checked={!!selected[emp.id]}
                          onChange={(e) => setSelected((s) => ({ ...s, [emp.id]: e.target.checked }))}
                        />
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <div className="font-semibold text-[var(--text-primary)]">{emp.full_name}</div>
                        {emp.email ? <div className="text-xs text-[var(--text-muted)]">{emp.email}</div> : null}
                      </td>
                      <td className={`${TABLE_CELL_CLASS} text-sm text-[var(--text-primary)]`}>
                        {emp.allocated || allocatedTotal > 0 ? money(allocatedTotal) : t("unallocated")}
                      </td>
                      <td className={`${TABLE_CELL_CLASS} text-sm text-[var(--text-primary)]`}>{money(usedTotal)}</td>
                      <td className={`${TABLE_CELL_CLASS} text-sm font-semibold text-[var(--text-primary)]`}>
                        {money(remaining)}
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <input
                          value={custom[emp.id] || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setCustom((c) => ({ ...c, [emp.id]: value }));
                            if (value && !selected[emp.id]) {
                              setSelected((s) => ({ ...s, [emp.id]: true }));
                            }
                          }}
                          placeholder={selected[emp.id] && equalAmount ? equalAmount : t("topUp")}
                          className="w-36 h-10 rounded-xl border border-[var(--border-input)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[#fe8503]"
                          inputMode="decimal"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
