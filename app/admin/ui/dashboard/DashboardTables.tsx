import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { BreakdownItem, OverdueInvoice, ProblemReport } from "../../../lib/types/admin-dashboard";
import { ArrowUpRight, CheckCircle2, Fuel, MessageSquare, Receipt, Users, Wrench } from "lucide-react";
import { adminCard, adminTableRow } from "../../components/ui/admin-styles";
import { cx } from "../../components/ui/cx";
import { EmptyState } from "../../components/ui/EmptyState";

interface DashboardTablesProps {
  revenueByClient: BreakdownItem[];
  fuelExpenses: BreakdownItem[];
  repairExpenses: BreakdownItem[];
  overdueInvoices: OverdueInvoice[];
  problemReports: ProblemReport[];
}

const currency = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

const th = "px-5 py-2.5 text-left";
const td = "px-5 py-3";

function TableCard({
  title,
  icon: Icon,
  tone = "default",
  right,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: "default" | "danger" | "warning";
  right?: ReactNode;
  children: ReactNode;
}) {
  const iconTone =
    tone === "danger"
      ? "bg-rose-500/10 text-[var(--danger-text)]"
      : tone === "warning"
        ? "bg-amber-500/10 text-[var(--warning-text)]"
        : "bg-[var(--bg-subtle)] text-[var(--text-muted)]";

  return (
    <div className={cx(adminCard, "flex h-full flex-col overflow-hidden")}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", iconTone)}>
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <h3 className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
        </div>
        {right}
      </div>
      <div className="custom-scrollbar max-h-80 overflow-auto">{children}</div>
    </div>
  );
}

function SimpleTable({
  title,
  data,
  valueLabel,
  icon,
}: {
  title: string;
  data: BreakdownItem[];
  valueLabel: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <TableCard title={title} icon={icon}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-[var(--bg-card)]">
          <tr className="border-b border-[var(--border-default)]">
            <th className={th}>Name</th>
            <th className={cx(th, "text-right")}>{valueLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {data.length === 0 ? (
            <tr>
              <td colSpan={2}>
                <EmptyState title="No records for this period" className="py-10" />
              </td>
            </tr>
          ) : (
            data.map((item, idx) => (
              <tr key={idx} className={adminTableRow}>
                <td className={td}>
                  <span
                    className="block max-w-[200px] truncate text-[13px] font-medium text-[var(--text-primary)]"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </td>
                <td className={cx(td, "text-right text-[13px] font-semibold tabular-nums text-[var(--text-primary)]")}>
                  {currency.format(item.value)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableCard>
  );
}

function OverdueInvoicesTable({ invoices }: { invoices: OverdueInvoice[] }) {
  return (
    <TableCard
      title="Overdue payables (>30 days)"
      icon={Receipt}
      tone="danger"
      right={
        <Link
          href="/admin/invoicing"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          Review all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-[var(--bg-card)]">
          <tr className="border-b border-[var(--border-default)]">
            <th className={th}>Billing entity</th>
            <th className={th}>Generated</th>
            <th className={th}>Status</th>
            <th className={cx(th, "text-right")}>Outstanding</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={4}>
                <EmptyState icon={CheckCircle2} title="No overdue payments" description="Everything is within terms." />
              </td>
            </tr>
          ) : (
            invoices.map((inv) => (
              <tr key={inv.id} className={adminTableRow}>
                <td className={td}>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">{inv.company_name}</span>
                    <span className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                      #{inv.invoice_number}
                    </span>
                  </div>
                </td>
                <td className={cx(td, "whitespace-nowrap text-xs text-[var(--text-muted)]")}>
                  {new Date(inv.generated_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className={td}>
                  <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--danger-text)] ring-1 ring-inset ring-rose-500/20">
                    {inv.status}
                  </span>
                </td>
                <td className={cx(td, "text-right text-[13px] font-semibold tabular-nums text-[var(--danger-text)]")}>
                  {currency.format(inv.total_amount)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableCard>
  );
}

function formatProblemIssueType(issueType: ProblemReport["issue_type"]): string {
  switch (issueType) {
    case "app_issue":
      return "App issue";
    case "ride_issue":
      return "Ride issue";
    case "other":
      return "Other";
    default:
      return "-";
  }
}

function ProblemReportsTable({ reports }: { reports: ProblemReport[] }) {
  return (
    <TableCard
      title="Field problem reports"
      icon={MessageSquare}
      tone="warning"
      right={
        <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-[var(--warning-text)]">
          {reports.length} {reports.length === 1 ? "report" : "reports"}
        </span>
      }
    >
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-[var(--bg-card)]">
          <tr className="border-b border-[var(--border-default)]">
            <th className={th}>When</th>
            <th className={th}>Reporter</th>
            <th className={th}>Type</th>
            <th className={th}>Message</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {reports.length === 0 ? (
            <tr>
              <td colSpan={4}>
                <EmptyState icon={CheckCircle2} title="No active incident reports" />
              </td>
            </tr>
          ) : (
            reports.map((report) => (
              <tr key={report.id} className={adminTableRow}>
                <td className={cx(td, "whitespace-nowrap")}>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {new Date(report.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {new Date(report.created_at).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </td>
                <td className={td}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[10px] font-semibold text-[var(--text-secondary)]">
                      {report.reporter_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div className="flex flex-col whitespace-nowrap">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">{report.reporter_name}</span>
                      <span className="text-[11px] uppercase text-[var(--text-muted)]">{report.reporter_role}</span>
                    </div>
                  </div>
                </td>
                <td className={cx(td, "whitespace-nowrap text-xs text-[var(--text-secondary)]")}>
                  {formatProblemIssueType(report.issue_type)}
                </td>
                <td className={cx(td, "max-w-md text-xs leading-relaxed text-[var(--text-secondary)]")}>
                  {report.message.length > 100 ? `${report.message.substring(0, 100)}…` : report.message}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableCard>
  );
}

export function DashboardTables({
  revenueByClient,
  fuelExpenses,
  repairExpenses,
  overdueInvoices,
  problemReports,
}: DashboardTablesProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SimpleTable title="Top clients by revenue" data={revenueByClient} valueLabel="Revenue" icon={Users} />
        <SimpleTable title="Fuel consumption" data={fuelExpenses} valueLabel="Cost" icon={Fuel} />
        <SimpleTable title="Maintenance costs" data={repairExpenses} valueLabel="Expense" icon={Wrench} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OverdueInvoicesTable invoices={overdueInvoices || []} />
        <ProblemReportsTable reports={problemReports || []} />
      </div>
    </div>
  );
}
