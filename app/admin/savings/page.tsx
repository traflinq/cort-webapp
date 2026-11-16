"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, PiggyBank } from "lucide-react";
import { SuperAdminPage } from "../components/SuperAdminPage";
import { Badge, Card, DataTable, KpiCard, KpiGrid, PageHeader, type DataTableColumn } from "../ui";
import { formatCurrency } from "../lib/format";
import { SavingsIntl } from "./SavingsIntl";
import { SavingsMonthPicker } from "@/app/components/savings/SavingsDashboard";
import { monthKey, type SavingsOverview, type SavingsOverviewRow } from "@/app/components/savings/types";
import { useSavingsFetch } from "@/app/components/savings/useSavingsFetch";

export default function AdminSavingsPage() {
  return (
    <SuperAdminPage>
      <SavingsIntl>
        <SavingsOverviewContent />
      </SavingsIntl>
    </SuperAdminPage>
  );
}

function SavingsOverviewContent() {
  const router = useRouter();
  const [month, setMonth] = useState(() => monthKey());
  const { data, error, loading, reload } = useSavingsFetch<SavingsOverview>(`/admin/savings-overview?month=${month}`);

  const services = (r: SavingsOverviewRow) =>
    [r.services.shuttle && "Shuttle", r.services.pool && "Pool", r.services.chauffeur && "Chauffeur"].filter(Boolean).join(" · ") || "—";

  const columns: DataTableColumn<SavingsOverviewRow>[] = [
    {
      key: "company",
      header: "Company",
      cell: (r) => (
        <div>
          <p className="font-medium text-fg">{r.company_name}</p>
          <p className="text-xs text-fg-muted">{services(r)}</p>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total savings",
      align: "right",
      mono: true,
      cell: (r) => (
        <span className={r.total_savings_pkr < 0 ? "text-danger-ink" : "font-semibold text-fg"}>
          {r.error ? "—" : formatCurrency(r.total_savings_pkr)}
        </span>
      ),
    },
    { key: "shuttle", header: "Shuttle", align: "right", mono: true, hideBelow: "md", cell: (r) => formatCurrency(r.shuttle_savings_pkr) },
    {
      key: "analysis",
      header: "Analysis",
      hideBelow: "lg",
      cell: (r) =>
        r.error ? (
          <Badge tone="danger">Error</Badge>
        ) : r.analysis_ready ? (
          <Badge tone="success">Final</Badge>
        ) : (
          <Badge tone="warning">Provisional</Badge>
        ),
    },
    {
      key: "access",
      header: "Company view",
      cell: (r) =>
        r.savings_unlocked ? (
          <Badge tone="success" icon={<LockOpen className="size-3" />}>
            Full report
          </Badge>
        ) : (
          <Badge tone="neutral" icon={<Lock className="size-3" />}>
            Total only
          </Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings"
        description="Savings for every company. Companies see only their total until you unlock the full report."
        actions={<SavingsMonthPicker month={month} onChange={setMonth} />}
      />
      <KpiGrid cols={3}>
        <KpiCard
          label={data?.period.is_mtd ? "Total savings (MTD)" : "Total savings"}
          value={formatCurrency(data?.total_savings_pkr ?? 0)}
          icon={<PiggyBank />}
          tone="success"
          loading={loading && !data}
        />
        <KpiCard label="Companies" value={data?.companies.length ?? 0} loading={loading && !data} />
        <KpiCard
          label="Full report unlocked"
          value={`${data?.unlocked_count ?? 0} of ${data?.companies.length ?? 0}`}
          icon={<LockOpen />}
          tone="brand"
          loading={loading && !data}
        />
      </KpiGrid>
      <Card>
        <DataTable
          columns={columns}
          rows={data?.companies ?? []}
          rowKey={(r) => r.company_id}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(r) => router.push(`/admin/savings/${r.company_id}?month=${month}`)}
          empty={{ title: "No companies with services enabled" }}
        />
      </Card>
    </div>
  );
}
