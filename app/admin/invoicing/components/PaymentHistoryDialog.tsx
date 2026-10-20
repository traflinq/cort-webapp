"use client";

import { Receipt } from "lucide-react";
import { Button, Dialog, DialogContent, EmptyState, LoadingBlock } from "../../ui";
import { formatCurrency, formatDate } from "../../lib/format";
import type { InvoicesController } from "../hooks/useInvoices";

export function PaymentHistoryDialog({ inv }: { inv: InvoicesController }) {
  const logs = inv.activeInvoiceLogs;
  const payments = logs?.shuttle_invoice_payments ?? [];
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  return (
    <Dialog open={inv.showLogsModal} onOpenChange={(open) => !open && inv.closeLogsModal()}>
      <DialogContent
        size="lg"
        flush
        title={logs?.invoice_number ? `Payment history · ${logs.invoice_number}` : "Payment history"}
        description={payments.length > 0 ? `${payments.length} payment${payments.length === 1 ? "" : "s"} · ${formatCurrency(totalPaid)} received` : undefined}
        footer={
          <Button variant="outline" onClick={inv.closeLogsModal}>
            Close
          </Button>
        }
      >
        {inv.isLoadingLogs ? (
          <LoadingBlock label="Loading payment history…" />
        ) : payments.length === 0 ? (
          <EmptyState compact icon={<Receipt aria-hidden="true" />} title="No payments recorded" description="Payments appear here once they are recorded against this invoice." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Payments recorded against this invoice</caption>
              <thead className="bg-subtle text-left text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5">Date</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Amount</th>
                  <th scope="col" className="px-4 py-2.5">Method</th>
                  <th scope="col" className="px-4 py-2.5">Notes</th>
                  <th scope="col" className="px-5 py-2.5">Recorded by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-5 py-3 text-fg">{formatDate(p.payment_date)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium tabular-nums text-fg">{formatCurrency(Number(p.amount))}</td>
                    <td className="px-4 py-3 text-fg-secondary">{p.payment_method || "—"}</td>
                    <td className="px-4 py-3 text-xs text-fg-muted">{p.notes || "—"}</td>
                    <td className="px-5 py-3 text-fg-secondary">{p.users?.full_name || "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
