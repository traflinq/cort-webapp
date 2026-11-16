"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SuperAdminPage } from "../../components/SuperAdminPage";
import { apiClient } from "../../../lib/services/api-client";
import { useConfirm } from "../../../lib/hooks/useConfirm";
import { Card, ErrorState, PageHeader, Switch, usePageBreadcrumbs } from "../../ui";
import { SavingsIntl } from "../SavingsIntl";
import { SavingsDashboard, SavingsMonthPicker } from "@/app/components/savings/SavingsDashboard";
import { monthKey, type SavingsDashboardFull } from "@/app/components/savings/types";
import { useSavingsFetch } from "@/app/components/savings/useSavingsFetch";

export default function AdminCompanySavingsPage() {
  return (
    <SuperAdminPage>
      <SavingsIntl>
        <CompanySavingsContent />
      </SavingsIntl>
    </SuperAdminPage>
  );
}

function CompanySavingsContent() {
  const { companyId } = useParams<{ companyId: string }>();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const [month, setMonth] = useState(() => searchParams.get("month") || monthKey());
  const { data, error, loading, reload, setData } = useSavingsFetch<SavingsDashboardFull>(
    `/admin/companies/${companyId}/savings-dashboard?month=${month}`,
  );
  const [saving, setSaving] = useState(false);

  usePageBreadcrumbs([{ label: "Savings", href: "/admin/savings" }, { label: data?.company.name ?? `Company #${companyId}` }]);

  async function toggleUnlock(next: boolean) {
    if (!data) return;
    const ok = await confirm(
      next
        ? {
            title: "Unlock full savings report",
            message: `Unlock the full savings report for ${data.company.name}?`,
            consequences: [
              "Company admins will see every KPI and the full savings breakdown on their Savings page.",
              "You can lock it again at any time.",
            ],
            confirmLabel: "Unlock report",
          }
        : {
            title: "Lock savings report",
            message: `Lock the savings report for ${data.company.name}?`,
            consequences: ["Company admins will see only the total savings figure."],
            confirmLabel: "Lock report",
            destructive: true,
          },
    );
    if (!ok) return;
    setSaving(true);
    try {
      await apiClient.request(`/admin/companies/${companyId}/savings-unlock`, {
        method: "PATCH",
        body: JSON.stringify({ unlocked: next }),
      });
      setData({ ...data, company: { ...data.company, savings_unlocked: next } });
      toast.success(next ? "Full savings report unlocked" : "Savings report locked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update access");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data?.company.name ?? "Company savings"}
        description="Full savings and KPI report, as the company sees it once unlocked."
        back={{ href: "/admin/savings", label: "All companies" }}
        actions={<SavingsMonthPicker month={month} onChange={setMonth} />}
      />

      {data && (
        <Card className="p-4">
          <Switch
            checked={data.company.savings_unlocked}
            onCheckedChange={toggleUnlock}
            loading={saving}
            label="Company can see the full report"
            description={
              data.company.savings_unlocked
                ? "Company admins see every KPI and the savings breakdown."
                : "Company admins see only the total savings figure."
            }
          />
        </Card>
      )}

      {loading && <div className="h-64 animate-pulse rounded-2xl border border-line bg-card" />}
      {error && <ErrorState title="Could not load savings" message={error} onRetry={reload} />}
      {data && !loading && !error && <SavingsDashboard data={data} />}
    </div>
  );
}
