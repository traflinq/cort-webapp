"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiClient } from "../../../lib/services/api-client";
import { useAuth } from "../../../lib/contexts/auth-context";
import { Card } from "../../components/DashboardComponents";
import { PageHeader } from "../../components/PageLayout";

export default function TravelWalletsPage() {
  const t = useTranslations("company.travel");
  const { user } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [equalAmount, setEqualAmount] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user?.company_id) return;
    const [w, list] = await Promise.all([
      apiClient.getCompanyTravelWallet(user.company_id),
      apiClient.getCompanyEmployeeTravelWallets(user.company_id),
    ]);
    setWallet(w.data);
    setEmployees(list.data || []);
  };

  useEffect(() => { load(); }, [user?.company_id]);

  const assign = async () => {
    if (!user?.company_id) return;
    const ids = employees.filter((e) => selected[e.id]).map((e) => e.id);
    if (ids.length === 0) return;
    const assignments = ids.map((id) => ({
      employee_id: id,
      amount: Number(custom[id] || equalAmount),
    })).filter((a) => a.amount > 0);
    try {
      await apiClient.assignEmployeeTravelWallets(user.company_id, assignments);
      toast.success("Assigned");
      setEqualAmount("");
      setCustom({});
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader label={t("label")} title={t("walletTitle")} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><p className="text-xs uppercase text-[var(--text-muted)]">{t("companyBalance")}</p><p className="text-2xl font-bold">PKR {Number(wallet?.balance ?? 0).toLocaleString()}</p></Card>
        <Card><p className="text-xs uppercase text-[var(--text-muted)]">{t("assigned")}</p><p className="text-2xl font-bold">PKR {Number(wallet?.assigned_total ?? 0).toLocaleString()}</p></Card>
        <Card>
          <label className="text-xs uppercase text-[var(--text-muted)]">{t("equalAmount")}</label>
          <input value={equalAmount} onChange={(e) => setEqualAmount(e.target.value)} className="mt-2 w-full border rounded-lg px-3 py-2 bg-transparent" />
          <button onClick={assign} className="mt-3 bg-[#f47f00] text-white px-4 py-2 rounded-lg text-sm font-bold">{t("assign")}</button>
        </Card>
      </div>
      <Card>
        <div className="space-y-2">
          {employees.map((emp) => (
            <label key={emp.id} className="flex items-center gap-3 py-2 border-b border-[var(--border-light)]">
              <input type="checkbox" checked={!!selected[emp.id]} onChange={(e) => setSelected((s) => ({ ...s, [emp.id]: e.target.checked }))} />
              <span className="flex-1">{emp.full_name}</span>
              <span className="text-sm text-[var(--text-muted)]">{emp.allocated ? `PKR ${Number(emp.balance).toLocaleString()}` : t("unallocated")}</span>
              <input
                value={custom[emp.id] || ""}
                onChange={(e) => setCustom((c) => ({ ...c, [emp.id]: e.target.value }))}
                placeholder="Amount"
                className="w-28 border rounded-lg px-2 py-1 bg-transparent text-sm"
              />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
