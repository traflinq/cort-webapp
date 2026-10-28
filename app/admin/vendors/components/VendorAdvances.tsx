"use client";

import * as React from "react";
import { Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type VendorPaymentTransaction } from "../../../lib/services/api-client";
import { useConfirm } from "../../../lib/hooks/useConfirm";
import { Badge, Button, Card, CardHeader, DataTable, Dialog, DialogContent, Field, IconButton, InlineError, Input, Select, Textarea, type DataTableColumn } from "../../ui";
import { formatCurrency, formatDateTime } from "../../lib/format";
import type { VendorLogRow } from "./types";

interface VendorAdvancesProps {
  vendorId: number;
  /** Bumped by the parent after invoices change so the list reloads. */
  refreshKey: number;
  canEdit: boolean;
  /** Called after an advance is recorded/linked/deleted so the page refreshes logs and stats. */
  onChanged: () => void;
}

/**
 * Advances paid to a shuttle vendor before the invoice exists.
 * Recorded against the vendor first, then linked to an invoice later.
 */
export function VendorAdvances({ vendorId, refreshKey, canEdit, onChanged }: VendorAdvancesProps) {
  const confirm = useConfirm();
  const [advances, setAdvances] = React.useState<VendorPaymentTransaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [linkTargets, setLinkTargets] = React.useState<VendorPaymentTransaction[]>([]);
  const [selected, setSelected] = React.useState<(string | number)[]>([]);

  const [retryTick, setRetryTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: unknown = await apiClient.getVendorAdvances(vendorId);
        const rows = Array.isArray(res) ? res : ((res as { data?: unknown })?.data ?? []);
        if (!cancelled) {
          setAdvances(Array.isArray(rows) ? (rows as VendorPaymentTransaction[]) : []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load advances");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId, refreshKey, retryTick]);

  // onChanged refreshes the page, which bumps refreshKey and reloads this list.
  const changed = onChanged;

  const remove = async (a: VendorPaymentTransaction) => {
    const ok = await confirm({
      title: "Delete this advance?",
      message: `The ${formatCurrency(Number(a.amount))} advance will be removed.`,
      consequences: ["It no longer counts as paid to this vendor"],
      confirmLabel: "Delete advance",
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiClient.deleteVendorAdvance(a.id);
      toast.success("Advance deleted");
      changed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete advance");
    }
  };

  const columns: DataTableColumn<VendorPaymentTransaction>[] = [
    { key: "date", header: "Paid on", cell: (a) => <span className="whitespace-nowrap text-fg-secondary">{formatDateTime(a.payment_date)}</span> },
    { key: "amount", header: "Amount", align: "right", mono: true, cell: (a) => <span className="font-medium text-fg">{formatCurrency(Number(a.amount))}</span> },
    { key: "method", header: "Method", hideBelow: "md", cell: (a) => <span className="text-fg-secondary">{a.payment_method || "—"}</span> },
    { key: "notes", header: "Notes", hideBelow: "md", cell: (a) => <span className="line-clamp-1 text-fg-secondary">{a.notes || "—"}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "1%",
      cell: (a) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" leftIcon={<Link2 />} disabled={!canEdit} onClick={() => setLinkTargets([a])}>
            Link to invoice
          </Button>
          <IconButton label="Delete advance" variant="ghost" disabled={!canEdit} onClick={() => void remove(a)}>
            <Trash2 />
          </IconButton>
        </div>
      ),
    },
  ];

  const total = advances.reduce((sum, a) => sum + Number(a.amount || 0), 0);

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            Advances not yet linked to an invoice
            <Badge tone={advances.length ? "warning" : "neutral"} size="sm">
              {advances.length ? formatCurrency(total) : "None"}
            </Badge>
          </span>
        }
        description="Record what you pay a shuttle vendor upfront, then link it to the invoice once it's generated."
        actions={
          <Button size="sm" leftIcon={<Plus />} disabled={!canEdit} onClick={() => setRecordOpen(true)}>
            Record advance
          </Button>
        }
      />
      <DataTable<VendorPaymentTransaction>
        caption="Unlinked vendor advances"
        rows={advances}
        rowKey={(a) => a.id}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={() => setRetryTick((t) => t + 1)}
        density="compact"
        empty={{ title: "No unlinked advances" }}
        selectable={canEdit}
        selectedKeys={selected}
        onSelectedKeysChange={setSelected}
        bulkActions={(keys) => (
          <Button
            size="sm"
            leftIcon={<Link2 />}
            onClick={() => setLinkTargets(advances.filter((a) => keys.includes(a.id)))}
          >
            Link {keys.length} selected to invoice
          </Button>
        )}
      />
      <RecordAdvanceDialog vendorId={vendorId} open={recordOpen} onOpenChange={setRecordOpen} onDone={changed} />
      <LinkAdvanceDialog vendorId={vendorId} advances={linkTargets} onOpenChange={(o) => !o && setLinkTargets([])} onDone={() => { setSelected([]); changed(); }} />
    </Card>
  );
}

function RecordAdvanceDialog({ vendorId, open, onOpenChange, onDone }: { vendorId: number; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Record advance" description="Paid to the vendor before an invoice exists.">
        {open && <RecordAdvanceForm vendorId={vendorId} onCancel={() => onOpenChange(false)} onDone={() => { onOpenChange(false); onDone(); }} />}
      </DialogContent>
    </Dialog>
  );
}

function RecordAdvanceForm({ vendorId, onCancel, onDone }: { vendorId: number; onCancel: () => void; onDone: () => void }) {
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState("CASH");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.createVendorAdvance({ vendor_id: vendorId, amount: value, payment_method: method || undefined, notes: notes || undefined });
      toast.success("Advance recorded");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record advance.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Amount (PKR)" required>
        <Input type="number" min={1} step="0.01" required mono value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
      </Field>
      <Field label="Payment method">
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="CHEQUE">Cheque</option>
        </Select>
      </Field>
      <Field label="Notes" hint="Optional. Reference numbers, who received it, etc.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Field>
      {error && <InlineError>{error}</InlineError>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Record advance
        </Button>
      </div>
    </form>
  );
}

function LinkAdvanceDialog({ vendorId, advances, onOpenChange, onDone }: { vendorId: number; advances: VendorPaymentTransaction[]; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const total = advances.reduce((sum, a) => sum + Number(a.amount), 0);
  const many = advances.length > 1;
  return (
    <Dialog open={advances.length > 0} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title="Link advance to invoice"
        description={advances.length ? (many ? `${advances.length} advances · ${formatCurrency(total)} in total` : `Advance of ${formatCurrency(total)}`) : undefined}
      >
        {advances.length > 0 && (
          <LinkAdvanceForm
            key={advances.map((a) => a.id).join("-")}
            vendorId={vendorId}
            advances={advances}
            onCancel={() => onOpenChange(false)}
            onDone={() => {
              onOpenChange(false);
              onDone();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LinkAdvanceForm({ vendorId, advances, onCancel, onDone }: { vendorId: number; advances: VendorPaymentTransaction[]; onCancel: () => void; onDone: () => void }) {
  const many = advances.length > 1;
  const advanceAmount = advances.reduce((sum, a) => sum + Number(a.amount), 0);
  const [invoices, setInvoices] = React.useState<VendorLogRow[] | null>(null);
  const [invoiceId, setInvoiceId] = React.useState("");
  const [amount, setAmount] = React.useState(String(advanceAmount));
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getVendorLogs({ vendor_id: vendorId, page: 1, limit: 200 });
        const rows = (res.data?.data ?? []) as unknown as VendorLogRow[];
        if (!cancelled) setInvoices(rows.filter((r) => r.type === "SHUTTLE" && r.invoice_id && Number(r.amount_remaining || 0) > 0));
      } catch (e) {
        if (!cancelled) {
          setInvoices([]);
          setError(e instanceof Error ? e.message : "Failed to load invoices");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const selected = invoices?.find((i) => String(i.invoice_id) === invoiceId);
  const room = Number(selected?.amount_remaining || 0);

  const onSelect = (id: string) => {
    setInvoiceId(id);
    const inv = invoices?.find((i) => String(i.invoice_id) === id);
    if (inv && !many) setAmount(String(Math.min(advanceAmount, Number(inv.amount_remaining || 0))));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceId) return setError("Choose an invoice.");
    setSubmitting(true);
    setError(null);
    try {
      if (many) {
        if (advanceAmount > room) {
          setError(`The selected advances total ${formatCurrency(advanceAmount)}, more than the invoice's remaining ${formatCurrency(room)}. Select fewer advances.`);
          return;
        }
        await apiClient.linkVendorAdvancesBulk({ advance_ids: advances.map((a) => a.id), invoice_id: Number(invoiceId) });
        toast.success(`${advances.length} advances linked to invoice`);
      } else {
        const value = parseFloat(amount);
        if (Number.isNaN(value) || value <= 0) return setError("Enter a valid amount greater than zero.");
        if (value > advanceAmount) return setError(`Amount can't exceed the advance of ${formatCurrency(advanceAmount)}.`);
        if (value > room) return setError(`Amount can't exceed the invoice's remaining ${formatCurrency(room)}.`);
        await apiClient.linkVendorAdvance(advances[0].id, { invoice_id: Number(invoiceId), amount: value });
        toast.success("Advance linked to invoice");
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link advance.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Invoice" required hint={invoices && invoices.length === 0 ? "No shuttle invoices with a balance for this vendor yet." : undefined}>
        <Select value={invoiceId} onChange={(e) => onSelect(e.target.value)} placeholder={invoices ? "Select an invoice" : "Loading…"} disabled={!invoices}>
          {(invoices ?? []).map((i) => (
            <option key={i.invoice_id} value={i.invoice_id ?? ""}>
              {`Invoice #${i.invoice_id} · ${i.company ?? i.passenger ?? ""} · ${i.details ?? ""} · remaining ${formatCurrency(Number(i.amount_remaining || 0))}`}
            </option>
          ))}
        </Select>
      </Field>
      {many ? (
        <ul className="space-y-1 rounded-lg border border-line bg-subtle p-3 text-sm">
          {advances.map((a) => (
            <li key={a.id} className="flex justify-between gap-3">
              <span className="text-fg-secondary">{formatDateTime(a.payment_date)}</span>
              <span className="font-mono tabular-nums text-fg">{formatCurrency(Number(a.amount))}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-line pt-1 font-medium">
            <span>Total applied</span>
            <span className="font-mono tabular-nums">{formatCurrency(advanceAmount)}</span>
          </li>
        </ul>
      ) : (
        <Field label="Amount to apply (PKR)" hint={amount && Number(amount) < advanceAmount ? `The remaining ${formatCurrency(advanceAmount - Number(amount))} stays as an advance.` : undefined}>
          <Input type="number" min={1} step="0.01" mono value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      )}
      {error && <InlineError>{error}</InlineError>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting} disabled={!invoices}>
          {many ? `Link ${advances.length} advances` : "Link advance"}
        </Button>
      </div>
    </form>
  );
}
