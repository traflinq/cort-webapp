"use client";

import { cn } from "@/lib/utils";
import { Button, Dialog, DialogContent, Field, FormGrid, Input, Select, focusRing } from "../../ui";
import { formatCurrency } from "../../lib/format";
import type { InvoicesController } from "../hooks/useInvoices";

export function SettleInvoiceDialog({ inv }: { inv: InvoicesController }) {
  const invoice = inv.settlingInvoice;
  const total = Number(invoice?.total_amount ?? 0);
  const paid = Number(invoice?.amount_paid ?? 0);
  // total - paid handles stale amount_remaining = 0 on older invoices
  const remaining = Math.max(0, total - paid);

  return (
    <Dialog open={inv.showSettleModal} onOpenChange={(open) => !open && inv.closeSettleModal()}>
      <DialogContent
        size="sm"
        title="Record payment"
        description={invoice ? `Invoice ${invoice.invoice_number}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={inv.closeSettleModal} disabled={inv.isSettling}>
              Cancel
            </Button>
            <Button onClick={inv.handleSettleInvoice} loading={inv.isSettling} disabled={!inv.settleAmount}>
              Record payment
            </Button>
          </>
        }
      >
        {invoice && (
          <div className="space-y-4">
            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 rounded-lg border border-line bg-subtle/60 p-3 text-sm">
              <dt className="text-fg-muted">Total amount</dt>
              <dd className="font-mono font-medium tabular-nums text-fg">{formatCurrency(total)}</dd>
              <dt className="text-fg-muted">Already paid</dt>
              <dd className="font-mono font-medium tabular-nums text-success-ink">{formatCurrency(paid)}</dd>
              <dt className="text-fg-muted">Remaining</dt>
              <dd className="font-mono font-semibold tabular-nums text-danger-ink">{formatCurrency(remaining)}</dd>
            </dl>

            <Field label="Amount received (PKR)" required hint={`Up to ${formatCurrency(remaining)}`}>
              <Input type="number" min={0.01} step="0.01" value={inv.settleAmount} onChange={(e) => inv.setSettleAmount(e.target.value)} mono />
            </Field>

            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-fg-secondary">Payment type</span>
              <div role="group" aria-label="Payment type" className="grid grid-cols-2 gap-2">
                {(["PARTIAL", "FINAL"] as const).map((type) => {
                  const active = inv.settlePaymentType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        inv.setSettlePaymentType(type);
                        if (type === "FINAL") inv.setSettleAmount(String(remaining));
                      }}
                      className={cn(
                        "h-9 cursor-pointer rounded-lg border text-sm font-medium transition-colors",
                        active ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-card text-fg-secondary hover:bg-subtle",
                        focusRing,
                      )}
                    >
                      {type === "PARTIAL" ? "Partial" : "Full / final"}
                    </button>
                  );
                })}
              </div>
            </div>

            <FormGrid cols={2}>
              <Field label="Payment date">
                <Input type="date" value={inv.settlePaymentDate} onChange={(e) => inv.setSettlePaymentDate(e.target.value)} />
              </Field>
              <Field label="Payment method" hint="Optional.">
                <Select value={inv.settlePaymentMethod} onChange={(e) => inv.setSettlePaymentMethod(e.target.value)} placeholder="Select method…">
                  <option value="Bank Transfer">Bank transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Online Transfer">Online transfer</option>
                </Select>
              </Field>
            </FormGrid>

            <Field label="Notes" hint="Optional.">
              <Input value={inv.settleNotes} onChange={(e) => inv.setSettleNotes(e.target.value)} placeholder="e.g. Cheque #12345" />
            </Field>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
