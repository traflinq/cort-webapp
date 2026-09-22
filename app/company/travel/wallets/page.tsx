"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiClient } from "../../../lib/services/api-client";
import { useAuth } from "../../../lib/contexts/auth-context";
import { Card } from "../../components/DashboardComponents";
import { PageHeader } from "../../components/PageLayout";
import {
  Field,
  KpiCard,
  PRIMARY_BUTTON_CLASS,
  TextInput,
  money,
} from "../travel-ui";

export default function TravelWalletsPage() {
  const t = useTranslations("company.travel");
  const { user } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [equalAmount, setEqualAmount] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [savingApproval, setSavingApproval] = useState(false);

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

  const selectedEmployees = employees.filter((e) => selected[e.id]);
  const canAssign = selectedEmployees.some((e) => Number(custom[e.id] || equalAmount) > 0) && !assigning;

  const assign = async () => {
    if (!user?.company_id || !canAssign) return;
    const assignments = selectedEmployees.map((e) => ({
      employee_id: e.id,
      amount: Number(custom[e.id] || equalAmount),
    })).filter((a) => a.amount > 0);
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

  const toggleApproval = async () => {
    if (!user?.company_id || savingApproval) return;
    const next = !Boolean(wallet?.approval_required);
    const previous = wallet;
    setSavingApproval(true);
    setWallet((current: any) => (current ? { ...current, approval_required: next } : current));
    try {
      const res = await apiClient.setTravelApprovalRequired(user.company_id, next);
      setWallet((current: any) => ({
        ...(current || {}),
        ...(res.data || {}),
        approval_required: res.data?.approval_required ?? next,
      }));
      toast.success(t("approvalUpdated"));
    } catch (err) {
      setWallet(previous);
      toast.error(err instanceof Error ? err.message : t("approvalUpdateFailed"));
    } finally {
      setSavingApproval(false);
    }
  };

  const approvalOn = Boolean(wallet?.approval_required);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader label={t("label")} title={t("walletTitle")} />
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label={t("companyBalance")} value={money(wallet?.balance)} loading={loading} />
        <KpiCard label={t("assigned")} value={money(wallet?.assigned_total)} loading={loading} />
        <KpiCard label={t("equalAmount")}>
          <Field label={t("amount")} className="mt-3">
            <TextInput
              type="number"
              min={0}
              value={equalAmount}
              onChange={(e) => setEqualAmount(e.target.value)}
              placeholder="0"
            />
          </Field>
          <button onClick={assign} disabled={!canAssign} className={`${PRIMARY_BUTTON_CLASS} mt-3`}>
            {assigning ? t("saving") : t("assign")}
          </button>
        </KpiCard>
      </div>
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
              {t("requireApproval")}
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{t("requireApprovalHint")}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={approvalOn}
            disabled={loading || savingApproval || !user?.company_id}
            onClick={toggleApproval}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
              approvalOn ? "bg-[#f47f00]" : "bg-[var(--border-default)]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[inset-inline-start] ${
                approvalOn ? "start-5" : "start-0.5"
              }`}
            />
          </button>
        </div>
      </Card>
      <Card>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-4">{t("employees")}</p>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--surface-subtle)]" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">{t("emptyWallets")}</p>
        ) : (
          <div className="space-y-1">
            {employees.map((emp) => (
              <label key={emp.id} className="flex flex-wrap items-center gap-3 py-3 border-b border-[var(--border-light)] last:border-b-0">
                <input
                  type="checkbox"
                  checked={!!selected[emp.id]}
                  onChange={(e) => setSelected((s) => ({ ...s, [emp.id]: e.target.checked }))}
                />
                <span className="flex-1 font-semibold text-[var(--text-primary)]">{emp.full_name}</span>
                <span className="text-sm text-[var(--text-muted)]">
                  {emp.allocated ? money(emp.balance) : t("unallocated")}
                </span>
                <input
                  value={custom[emp.id] || ""}
                  onChange={(e) => setCustom((c) => ({ ...c, [emp.id]: e.target.value }))}
                  placeholder={t("customAmount")}
                  className="w-36 h-10 rounded-xl border border-[var(--border-input)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[#fe8503]"
                />
              </label>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
