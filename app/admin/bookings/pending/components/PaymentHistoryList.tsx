"use client";

import { memo } from "react";
import { PaymentTransaction } from "../../../../lib/services/api-client";
import { Badge } from "../../../ui";
import { formatCurrency, formatDateTime, humanize } from "../../../lib/format";

export const PaymentHistoryList = memo(function PaymentHistoryList({ payments }: { payments: PaymentTransaction[] }) {
  if (!payments || payments.length === 0) {
    return <p className="py-2 text-sm text-fg-muted">No payments recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Payment history ({payments.length})</h4>
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {payments.map((payment) => (
          <li key={payment.id} className="rounded-lg border border-line bg-subtle p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold tabular-nums text-fg">{formatCurrency(payment.amount)}</span>
              <Badge tone="info" size="sm">
                {payment.payment_method ? humanize(payment.payment_method) : "N/A"}
              </Badge>
            </div>
            <div className="mt-0.5 text-xs text-fg-muted">
              {formatDateTime(payment.payment_date)}
              {payment.users_received_by && <span> · by {payment.users_received_by.full_name}</span>}
            </div>
            {payment.notes && <p className="mt-1 text-xs text-fg-secondary">{payment.notes}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
});
