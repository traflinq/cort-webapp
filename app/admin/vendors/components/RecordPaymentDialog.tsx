"use client";

import * as React from "react";
import { useConfirm } from "../../../lib/hooks/useConfirm";
import { Button, Dialog, DialogContent, Field, InlineError, Input, Textarea } from "../../ui";
import { formatCurrency } from "../../lib/format";
import type { PaymentTarget } from "./types";

export interface RecordPaymentDialogProps {
  target: PaymentTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves on success; reject/throw to show the error inline. */
  onSubmit: (amount: number, notes: string) => Promise<void>;
}

export function RecordPaymentDialog({ target, open, onOpenChange, onSubmit }: RecordPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Record payment" description={target ? `${target.type === "SHUTTLE" ? "Invoice" : "Booking"} #${target.id}` : undefined} hideClose={false}>
        {target && <PaymentForm key={`${target.type}-${target.id}`} target={target} onCancel={() => onOpenChange(false)} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({ target, onCancel, onSubmit }: { target: PaymentTarget; onCancel: () => void; onSubmit: RecordPaymentDialogProps["onSubmit"] }) {
  const confirm = useConfirm();
  const remaining = Math.max(target.cost - target.paid, 0);
  const [amount, setAmount] = React.useState(target.cost > 0 ? String(remaining) : "");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    const ok = await confirm({
      title: `Record ${formatCurrency(value)}?`,
      message: `A cash payment of ${formatCurrency(value)} will be recorded against ${target.type === "SHUTTLE" ? "invoice" : "booking"} #${target.id}.`,
      consequences: [
        target.cost > 0 ? `Remaining balance becomes ${formatCurrency(Math.max(remaining - value, 0))}` : "Recorded as an advance until the trip cost is finalised",
        "The vendor's outstanding total is updated",
      ],
      confirmLabel: "Record payment",
    });
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(value, notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-subtle p-3 text-sm">
        <div>
          <dt className="text-xs text-fg-muted">Total cost</dt>
          <dd className="font-mono font-medium tabular-nums text-fg">
            {target.cost > 0 ? formatCurrency(target.cost) : <span className="font-sans text-warning-ink">Not finalised yet</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Already paid</dt>
          <dd className="font-mono font-medium tabular-nums text-success-ink">{formatCurrency(target.paid)}</dd>
        </div>
        {target.cost > 0 && (
          <div className="col-span-2">
            <dt className="text-xs text-fg-muted">Remaining</dt>
            <dd className="font-mono font-medium tabular-nums text-warning-ink">{formatCurrency(remaining)}</dd>
          </div>
        )}
      </dl>
      <Field label="Payment amount (PKR)" required>
        <Input type="number" min={1} step="0.01" required mono value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
      </Field>
      <Field label="Notes" hint="Optional. Reference numbers, who received the cash, etc.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Field>
      {error && <InlineError>{error}</InlineError>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Record payment
        </Button>
      </div>
    </form>
  );
}
