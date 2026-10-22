"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DataTable, StatusBadge, useFormatters, type DataTableColumn } from "@/app/ui";

export interface OutstandingInvoice {
  invoice_number: string;
  total_amount: number;
  status: string;
  due_date: string;
}

export function OutstandingInvoicesDialog({ open, onOpenChange, invoices, total }: { open: boolean; onOpenChange: (o: boolean) => void; invoices: OutstandingInvoice[]; total: number }) {
  const t = useTranslations("company.dashboard");
  const tInv = useTranslations("company.invoicing");
  const { formatCurrency, formatDate } = useFormatters();

  const columns: DataTableColumn<OutstandingInvoice>[] = [
    { key: "invoice_number", header: tInv("invoiceNumber"), cell: (r) => <span className="font-mono text-xs">{r.invoice_number}</span> },
    { key: "due_date", header: tInv("dueDate"), cell: (r) => formatDate(r.due_date) },
    { key: "status", header: tInv("status"), cell: (r) => <StatusBadge status={r.status} size="sm" /> },
    { key: "total_amount", header: tInv("totalAmount"), align: "right", cell: (r) => <span className="tabular-nums">{formatCurrency(r.total_amount)}</span> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("recentOutstandingInvoices")} description={`${t("outstandingBalance")}: ${formatCurrency(total)}`} size="lg" flush>
        <DataTable rows={invoices} columns={columns} rowKey={(r) => r.invoice_number} density="compact" empty={{ title: t("noPendingActions") }} />
        {invoices.length >= 10 && <p className="border-t border-line px-5 py-2 text-xs text-fg-muted">{t("showingTop10")}</p>}
      </DialogContent>
    </Dialog>
  );
}
