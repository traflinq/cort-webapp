"use client";

import * as React from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type VendorPaymentTransaction } from "../../../lib/services/api-client";
import { useConfirm } from "../../../lib/hooks/useConfirm";
import {
  Badge,
  DataTable,
  Drawer,
  DrawerContent,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  InlineError,
  Input,
  StatusBadge,
  type DataTableColumn,
} from "../../ui";
import { formatCurrency, formatDateTime } from "../../lib/format";
import { PAYMENT_STATUS_OVERRIDES, referenceLabel, type VendorLogRow } from "./types";

export interface SettlementDrawerProps {
  log: VendorLogRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEditPayments: boolean;
  /** Called after a transaction is edited so the page can refresh logs and stats. */
  onChanged?: () => void;
}

/**
 * Settlement breakdown for one vendor log: summary + payment transactions with inline edit.
 * Shared by the vendor detail page and the all-vendors logs page.
 */
export function SettlementDrawer({ log, open, onOpenChange, canEditPayments, onChanged }: SettlementDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        size="xl"
        title="Settlement breakdown"
        description={log ? [log.vendor_name, referenceLabel(log)].filter(Boolean).join(" · ") || undefined : undefined}
        headerExtra={
          log ? (
            <>
              <StatusBadge status={log.type} dot={false} size="sm" />
              <StatusBadge status={log.status || "UNPAID"} overrides={PAYMENT_STATUS_OVERRIDES} size="sm" />
            </>
          ) : undefined
        }
      >
        {log && <SettlementBody key={`${log.type}-${log.booking_id ?? log.invoice_id ?? log.id}`} log={log} canEditPayments={canEditPayments} onChanged={onChanged} />}
      </DrawerContent>
    </Drawer>
  );
}

type EditForm = { amount: string; payment_method: string; notes: string; payment_date: string };

const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function SettlementBody({ log, canEditPayments, onChanged }: { log: VendorLogRow; canEditPayments: boolean; onChanged?: () => void }) {
  const confirm = useConfirm();
  const isShuttle = log.type === "SHUTTLE";
  const hasHistory = isShuttle ? !!log.invoice_id : !!log.booking_id;
  const [txns, setTxns] = React.useState<VendorPaymentTransaction[]>([]);
  const [loading, setLoading] = React.useState(hasHistory);
  const [error, setError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<EditForm>({ amount: "", payment_method: "", notes: "", payment_date: "" });
  const [saving, setSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const loadHistory = React.useCallback(async () => {
    const res: unknown = isShuttle
      ? log.invoice_id
        ? await apiClient.getVendorInvoicePaymentHistory(log.invoice_id)
        : []
      : log.booking_id
        ? await apiClient.getVendorPaymentHistory(log.booking_id)
        : [];
    const rows = Array.isArray(res) ? res : ((res as { data?: unknown })?.data ?? []);
    return Array.isArray(rows) ? (rows as VendorPaymentTransaction[]) : [];
  }, [isShuttle, log.booking_id, log.invoice_id]);

  React.useEffect(() => {
    if (!hasHistory) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await loadHistory();
        if (!cancelled) setTxns(rows ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load settlement history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasHistory, loadHistory]);

  const startEdit = (t: VendorPaymentTransaction) => {
    setEditingId(t.id);
    setForm({
      amount: String(Number(t.amount || 0)),
      payment_method: t.payment_method || "",
      notes: t.notes || "",
      payment_date: t.payment_date ? toDatetimeLocal(t.payment_date) : "",
    });
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const saveEdit = async (txnId: number) => {
    const amount = parseFloat(form.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      setEditError("Enter a valid amount greater than zero.");
      return;
    }
    const ok = await confirm({
      title: "Update this payment?",
      message: `The transaction will be changed to ${formatCurrency(amount)}.`,
      consequences: ["The vendor's paid and outstanding balances are recalculated", "The change is recorded against your account"],
      confirmLabel: "Save changes",
    });
    if (!ok) return;
    setSaving(true);
    setEditError(null);
    try {
      await (isShuttle ? apiClient.updateVendorInvoicePayment : apiClient.updateVendorPayment).call(apiClient, txnId, {
        amount,
        payment_method: form.payment_method || undefined,
        notes: form.notes || undefined,
        payment_date: form.payment_date ? new Date(form.payment_date).toISOString() : undefined,
      });
      const rows = await loadHistory();
      setTxns(rows ?? []);
      setEditingId(null);
      toast.success("Payment updated");
      onChanged?.();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<VendorPaymentTransaction>[] = [
    {
      key: "payment_date",
      header: "Date",
      cell: (t) =>
        editingId === t.id ? (
          <Field label="Payment date" className="[&>label]:sr-only">
            <Input type="datetime-local" value={form.payment_date} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} className="h-8 min-w-[12rem] text-xs" />
          </Field>
        ) : (
          <span className="whitespace-nowrap text-fg">{t.payment_date ? formatDateTime(t.payment_date) : "—"}</span>
        ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (t) =>
        editingId === t.id ? (
          <Field label="Amount" className="[&>label]:sr-only">
            <Input type="number" min={0} step="0.01" mono value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="h-8 w-32 text-right text-xs" />
          </Field>
        ) : (
          <span className="font-mono font-medium tabular-nums text-fg">{formatCurrency(t.amount)}</span>
        ),
    },
    {
      key: "payment_method",
      header: "Method",
      cell: (t) =>
        editingId === t.id ? (
          <Field label="Method" className="[&>label]:sr-only">
            <Input value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))} className="h-8 w-28 text-xs" />
          </Field>
        ) : (
          <span className="text-fg-secondary">{t.payment_method || "—"}</span>
        ),
    },
    {
      key: "notes",
      header: "Notes",
      cell: (t) =>
        editingId === t.id ? (
          <Field label="Notes" className="[&>label]:sr-only">
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="h-8 min-w-[10rem] text-xs" />
          </Field>
        ) : (
          <span className="text-fg-secondary">{t.notes || "—"}</span>
        ),
    },
    { key: "by", header: "Settled by", hideBelow: "md", cell: (t) => <span className="whitespace-nowrap text-fg-secondary">{t.users?.full_name || t.created_by || "—"}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (t) => {
        if (!canEditPayments) return <span className="text-fg-muted">—</span>;
        if (editingId === t.id) {
          return (
            <div className="flex items-center justify-end gap-1">
              <IconButton label="Save payment" size="icon-sm" variant="outline" onClick={() => void saveEdit(t.id)} loading={saving} tooltip={false}>
                <Check className="text-success-ink" />
              </IconButton>
              <IconButton label="Cancel editing" size="icon-sm" onClick={cancelEdit} disabled={saving} tooltip={false}>
                <X />
              </IconButton>
            </div>
          );
        }
        return (
          <IconButton label="Edit payment" size="icon-sm" onClick={() => startEdit(t)}>
            <Pencil />
          </IconButton>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-line bg-subtle p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-fg-muted">Vehicle</dt>
          <dd className="font-medium text-fg">{log.vehicle || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Passenger</dt>
          <dd className="font-medium text-fg">{log.passenger || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Driver</dt>
          <dd className="font-medium text-fg">{log.driver || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Total cost</dt>
          <dd className="font-mono font-medium tabular-nums text-fg">{formatCurrency(log.cost)}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Paid</dt>
          <dd className="font-mono font-medium tabular-nums text-success-ink">{formatCurrency(log.amount_paid || 0)}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Remaining</dt>
          <dd className="font-mono font-medium tabular-nums text-warning-ink">{formatCurrency(log.amount_remaining || 0)}</dd>
        </div>
      </dl>

      {!hasHistory ? (
        <EmptyState compact title="No settlement history" description="This log isn't linked to a booking or invoice." />
      ) : error ? (
        <ErrorState compact message={error} />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Payments</h3>
            <Badge tone="neutral" size="sm">
              {txns.length}
            </Badge>
          </div>
          {editError && <InlineError>{editError}</InlineError>}
          <div className="overflow-hidden rounded-lg border border-line">
            <DataTable<VendorPaymentTransaction>
              rows={txns}
              rowKey={(t) => t.id}
              columns={columns}
              loading={loading}
              density="compact"
              caption="Payment transactions"
              empty={{ title: "No payments recorded yet" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
