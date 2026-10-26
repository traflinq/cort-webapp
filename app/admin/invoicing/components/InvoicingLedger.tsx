"use client";

import { Download, Eye, FilePlus2, FileText, History, Mail, Trash2, Wallet } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  FilterBar,
  FilterField,
  PageHeader,
  Select,
  StatusBadge,
  type ActionMenuItem,
  type DataTableColumn,
} from "../../ui";
import { formatCurrency, formatDate } from "../../lib/format";
import { INVOICE_STATUSES, type Invoice, type InvoiceStatus } from "../types";
import type { InvoicesController } from "../hooks/useInvoices";
import { PICKER_LIMIT } from "../hooks/useInvoices";
import { InvoiceStatsCards } from "./InvoiceStatsCards";
import { GenerateInvoiceDialog } from "./GenerateInvoiceDialog";
import { SettleInvoiceDialog } from "./SettleInvoiceDialog";
import { PaymentHistoryDialog } from "./PaymentHistoryDialog";

type InvoicingLedgerProps = {
  inv: InvoicesController;
};

export function InvoicingLedger({ inv }: InvoicingLedgerProps) {
  const activeFilters = (inv.filterCompanyId ? 1 : 0) + (inv.filterStatus ? 1 : 0);

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: "invoice",
      header: "Invoice",
      cell: (row) => (
        <div className="min-w-0">
          <div className="font-mono text-[13px] font-medium text-fg">{row.invoice_number}</div>
          <div className="text-xs text-fg-muted">ID {row.id}</div>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      cell: (row) => <span className="text-fg">{row.companies?.name || <span className="text-fg-muted">Unknown</span>}</span>,
    },
    {
      key: "period",
      header: "Billing period",
      hideBelow: "md",
      cell: (row) => (
        <div>
          <div className="text-fg">{inv.formatInvoicePeriod(row)}</div>
          <div className="text-xs text-fg-muted">{inv.getInvoicePeriodType(row) === "WEEKLY" ? "Weekly" : "Monthly"}</div>
        </div>
      ),
    },
    {
      key: "generated",
      header: "Generated",
      hideBelow: "lg",
      cell: (row) => <span className="text-fg-secondary">{formatDate(row.generated_at)}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      mono: true,
      cell: (row) => formatCurrency(Number(row.total_amount)),
    },
    {
      key: "received",
      header: "Received",
      align: "right",
      mono: true,
      hideBelow: "sm",
      cell: (row) =>
        row.amount_paid != null && Number(row.amount_paid) > 0 ? (
          <span className="text-success-ink">{formatCurrency(Number(row.amount_paid))}</span>
        ) : (
          <span className="text-fg-muted">—</span>
        ),
    },
    {
      key: "receivable",
      header: "Receivable",
      align: "right",
      mono: true,
      hideBelow: "sm",
      cell: (row) =>
        row.status === "PAID" ? (
          <Badge tone="success" size="sm">
            Fully paid
          </Badge>
        ) : (
          <span className="text-danger-ink">{formatCurrency(Math.max(0, Number(row.total_amount) - Number(row.amount_paid ?? 0)))}</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) =>
        inv.canUpdate ? (
          <div className="flex items-center gap-2">
            <StatusBadge status={row.status || "DRAFT"} />
          <Select
            width="auto"
            aria-label={`Status of invoice ${row.invoice_number}`}
            className="h-8 text-xs"
            value={row.status || "DRAFT"}
            onChange={(e) => inv.handleStatusUpdate(row.id, row.invoice_number, e.target.value)}
          >
            {INVOICE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          </div>
        ) : (
          <StatusBadge status={row.status || "DRAFT"} />
        ),
    },
  ];

  const rowActions = (row: Invoice): ActionMenuItem[] => {
    const isShuttle = !!row.shuttle_contract_id;
    const canSettle = isShuttle && row.status !== "PAID" && row.status !== "CANCELLED" && inv.canUpdate;
    return [
      { label: inv.viewingId === row.id ? "Opening…" : "View PDF", icon: <Eye />, disabled: inv.viewingId === row.id, onSelect: () => inv.viewPdf(row.id) },
      { label: inv.downloadingId === row.id ? "Downloading…" : "Download PDF", icon: <Download />, disabled: inv.downloadingId === row.id, onSelect: () => inv.downloadPdf(row.id, row.invoice_number) },
      {
        label: inv.sendingEmailId === row.id ? "Sending…" : "Email to company",
        icon: <Mail />,
        disabled: inv.sendingEmailId === row.id || !inv.canUpdate,
        onSelect: () => inv.handleSendEmail(row.id, row.invoice_number),
      },
      { label: "Record payment", icon: <Wallet />, hidden: !canSettle, separatorBefore: true, onSelect: () => inv.openSettleModal(row) },
      { label: "Payment history", icon: <History />, hidden: !isShuttle, onSelect: () => inv.openLogsModal(row) },
      {
        label: inv.deletingInvoiceId === row.id ? "Deleting…" : "Delete",
        icon: <Trash2 />,
        destructive: true,
        separatorBefore: true,
        disabled: inv.deletingInvoiceId === row.id || !inv.canDelete,
        onSelect: () => inv.handleDeleteInvoice(row),
      },
    ];
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoicing"
        description="General ledger of company invoices, payments and PDFs."
        actions={
          <Button leftIcon={<FilePlus2 />} onClick={() => inv.setShowShuttleModal(true)} disabled={!inv.canUpdate}>
            Generate shuttle invoice
          </Button>
        }
      />

      <InvoiceStatsCards stats={inv.stats} error={inv.statsError} />

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar activeCount={activeFilters} onClear={inv.clearFilters}>
            <FilterField label="Company">
              <Select
                value={inv.filterCompanyId ?? ""}
                onChange={(e) => inv.applyCompanyFilter(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="All companies"
                className="h-8 min-w-44 text-xs"
              >
                {inv.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Status">
              <Select
                value={inv.filterStatus}
                onChange={(e) => inv.applyStatusFilter(e.target.value as InvoiceStatus | "")}
                placeholder="Any status"
                className="h-8 text-xs"
              >
                {INVOICE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </FilterField>
            {inv.companiesTruncated && <span className="text-xs text-fg-muted">Company list shows the first {PICKER_LIMIT} companies.</span>}
          </FilterBar>
        </CardContent>

        <DataTable<Invoice>
          caption="Invoices"
          columns={columns}
          rows={inv.invoices}
          rowKey={(row) => row.id}
          loading={inv.isLoading}
          error={inv.listError}
          onRetry={inv.refetch}
          empty={{
            icon: <FileText aria-hidden="true" />,
            title: activeFilters > 0 ? "No invoices match these filters" : "No invoices yet",
            description: activeFilters > 0 ? "Try clearing the filters." : "Generate a shuttle invoice to start the ledger.",
            action:
              activeFilters > 0 ? (
                <Button size="sm" variant="outline" onClick={inv.clearFilters}>
                  Clear filters
                </Button>
              ) : inv.canUpdate ? (
                <Button size="sm" leftIcon={<FilePlus2 />} onClick={() => inv.setShowShuttleModal(true)}>
                  Generate shuttle invoice
                </Button>
              ) : undefined,
          }}
          rowActions={rowActions}
          pagination={{
            page: inv.currentPage,
            totalPages: inv.pagination.pages,
            total: inv.pagination.total,
            onPageChange: inv.setCurrentPage,
          }}
        />
      </Card>

      <GenerateInvoiceDialog inv={inv} />
      <SettleInvoiceDialog inv={inv} />
      <PaymentHistoryDialog inv={inv} />
    </div>
  );
}
