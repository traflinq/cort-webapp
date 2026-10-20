"use client";

import { memo } from "react";
import { PaymentSummary } from "../../../../lib/services/api-client";
import { StatusBadge } from "../../../ui";
import { formatCurrency } from "../../../lib/format";
import { BOOKING_STATUS_OVERRIDES } from "./booking-status";

export const PaymentSummaryCard = memo(function PaymentSummaryCard({ summary }: { summary: PaymentSummary | null }) {
  if (!summary) return null;

  const invoiceAmount = parseFloat(summary.invoice_amount);
  const totalPaid = parseFloat(summary.total_paid);
  const remaining = parseFloat(summary.amount_remaining);
  const percentPaid = invoiceAmount > 0 ? Math.min((totalPaid / invoiceAmount) * 100, 100) : 0;

  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Payment status</h4>
        <StatusBadge status={summary.payment_status} overrides={BOOKING_STATUS_OVERRIDES} size="sm" />
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-fg-muted">Invoice total</dt>
          <dd className="font-mono tabular-nums text-fg">{formatCurrency(invoiceAmount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fg-muted">Amount paid</dt>
          <dd className="font-mono tabular-nums text-success-ink">{formatCurrency(totalPaid)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2">
          <dt className="font-medium text-fg">Balance due</dt>
          <dd className="font-mono text-base font-semibold tabular-nums text-brand-ink">{formatCurrency(remaining)}</dd>
        </div>
      </dl>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percentPaid)}
        aria-label="Percentage paid"
      >
        <div className="h-full rounded-full bg-success transition-[width] duration-200" style={{ width: `${percentPaid}%` }} />
      </div>
      <p className="mt-1 text-right text-[11px] text-fg-muted">{percentPaid.toFixed(1)}% paid</p>
    </div>
  );
});
