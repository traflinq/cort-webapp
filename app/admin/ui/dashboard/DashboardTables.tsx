"use client";

import Link from "next/link";
import { ArrowUpRight, Fuel, MessageSquare, Users, Wrench } from "lucide-react";
import type { ComponentType } from "react";
import type { BreakdownItem, FuelMonthComparison, OverdueInvoice, ProblemReport } from "../../../lib/types/admin-dashboard";
import { Badge, Button, Card, CardHeader, DataTable, StatusBadge, type DataTableColumn } from "..";
import { formatCurrency, formatDate, formatDateTime, humanize, initials } from "../../lib/format";

interface DashboardTablesProps {
  revenueByClient: BreakdownItem[];
  fuelExpenses: BreakdownItem[];
  fuelMonthComparison?: FuelMonthComparison;
  repairExpenses: BreakdownItem[];
  overdueInvoices: OverdueInvoice[];
  problemReports: ProblemReport[];
}

function RankingTable({
  title,
  description,
  data,
  valueLabel,
  icon: Icon,
  emptyTitle,
}: {
  title: string;
  description: string;
  data: BreakdownItem[];
  valueLabel: string;
  icon: ComponentType<{ className?: string }>;
  emptyTitle: string;
}) {
  const rows = [...(data ?? [])].sort((a, b) => b.value - a.value);
  const columns: DataTableColumn<BreakdownItem>[] = [
    { key: "name", header: "Name", cell: (r) => <span className="line-clamp-1 font-medium text-fg">{r.name}</span> },
    { key: "value", header: valueLabel, align: "right", mono: true, width: "9rem", cell: (r) => formatCurrency(r.value) },
  ];
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Icon className="size-4 text-fg-muted" />
            {title}
          </span>
        }
        description={description}
      />
      <div className="max-h-80 overflow-y-auto">
        <DataTable<BreakdownItem> rows={rows} rowKey={(r) => r.name} columns={columns} density="compact" stickyHeader empty={{ title: emptyTitle }} caption={title} />
      </div>
    </Card>
  );
}

function FuelMonthTable({ data }: { data?: FuelMonthComparison }) {
  type Row = FuelMonthComparison["rows"][number];
  const rows = data?.rows ?? [];
  const columns: DataTableColumn<Row>[] = [
    { key: "name", header: "Name", cell: (r) => <span className="line-clamp-1 font-medium text-fg">{r.name}</span> },
    { key: "current", header: data?.currentLabel ?? "This month", align: "right", mono: true, width: "8rem", cell: (r) => formatCurrency(r.current) },
    { key: "previous", header: data?.previousLabel ?? "Last month", align: "right", mono: true, width: "8rem", cell: (r) => <span className="text-fg-secondary">{formatCurrency(r.previous)}</span> },
  ];
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Fuel className="size-4 text-fg-muted" />
            Fuel cost
          </span>
        }
        description="By vehicle · this month vs last month"
      />
      <div className="max-h-80 overflow-y-auto">
        <DataTable<Row> rows={rows} rowKey={(r) => r.name} columns={columns} density="compact" stickyHeader empty={{ title: "No fuel records" }} caption="Fuel cost" />
      </div>
    </Card>
  );
}

const overdueColumns: DataTableColumn<OverdueInvoice>[] = [
  {
    key: "company",
    header: "Company",
    cell: (inv) => (
      <div className="min-w-0">
        <div className="font-medium text-fg">{inv.company_name}</div>
        <div className="font-mono text-xs text-fg-muted">#{inv.invoice_number}</div>
      </div>
    ),
  },
  { key: "generated_at", header: "Issued", hideBelow: "sm", cell: (inv) => <span className="text-fg-secondary">{formatDate(inv.generated_at)}</span> },
  { key: "status", header: "Status", cell: (inv) => <StatusBadge status={inv.status} /> },
  { key: "total_amount", header: "Outstanding", align: "right", mono: true, cell: (inv) => <span className="font-semibold text-danger-ink">{formatCurrency(inv.total_amount)}</span> },
];

const reportColumns: DataTableColumn<ProblemReport>[] = [
  { key: "created_at", header: "When", width: "11rem", cell: (r) => <span className="whitespace-nowrap text-fg-secondary">{formatDateTime(r.created_at)}</span> },
  {
    key: "reporter",
    header: "Reporter",
    cell: (r) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle text-[10px] font-semibold text-fg">{initials(r.reporter_name)}</span>
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">{r.reporter_name}</div>
          <div className="truncate text-xs text-fg-muted">
            {humanize(r.reporter_role)}
            {r.company_name ? ` · ${r.company_name}` : ""}
          </div>
        </div>
      </div>
    ),
  },
  { key: "issue_type", header: "Type", hideBelow: "md", cell: (r) => <Badge tone="neutral">{r.issue_type ? humanize(r.issue_type) : "—"}</Badge> },
  { key: "message", header: "Message", cell: (r) => <p className="line-clamp-2 max-w-md text-fg-secondary" title={r.message}>{r.message}</p> },
];

export function DashboardTables({ revenueByClient, fuelExpenses, fuelMonthComparison, repairExpenses, overdueInvoices, problemReports }: DashboardTablesProps) {
  const overdue = overdueInvoices ?? [];
  const reports = problemReports ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <RankingTable title="Top clients by revenue" description="Gross revenue in the period" data={revenueByClient} valueLabel="Revenue" icon={Users} emptyTitle="No client revenue yet" />
        {fuelMonthComparison ? (
          <FuelMonthTable data={fuelMonthComparison} />
        ) : (
          <RankingTable title="Fuel cost" description="By vehicle, period total" data={fuelExpenses} valueLabel="Cost" icon={Fuel} emptyTitle="No fuel records" />
        )}
        <RankingTable title="Maintenance cost" description="By vehicle, period total" data={repairExpenses} valueLabel="Cost" icon={Wrench} emptyTitle="No maintenance records" />
      </div>

      <Card className={overdue.length > 0 ? "border-danger-line" : undefined}>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              Overdue invoices
              <Badge tone={overdue.length > 0 ? "danger" : "success"} size="sm">
                {overdue.length}
              </Badge>
            </span>
          }
          description="Unpaid for more than 30 days"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/invoicing">
                Review all
                <ArrowUpRight />
              </Link>
            </Button>
          }
        />
        <div className="max-h-96 overflow-y-auto">
          <DataTable<OverdueInvoice>
            rows={overdue}
            rowKey={(inv) => inv.id}
            columns={overdueColumns}
            density="compact"
            stickyHeader
            caption="Overdue invoices"
            empty={{ title: "No overdue invoices", description: "Every invoice older than 30 days is settled." }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="size-4 text-fg-muted" />
              Problem reports
              <Badge tone={reports.length > 0 ? "warning" : "neutral"} size="sm">
                {reports.length}
              </Badge>
            </span>
          }
          description="Reported from the driver and employee apps"
        />
        <div className="max-h-96 overflow-y-auto">
          <DataTable<ProblemReport>
            rows={reports}
            rowKey={(r) => r.id}
            columns={reportColumns}
            density="compact"
            stickyHeader
            caption="Problem reports"
            empty={{ title: "No open problem reports" }}
          />
        </div>
      </Card>
    </div>
  );
}
