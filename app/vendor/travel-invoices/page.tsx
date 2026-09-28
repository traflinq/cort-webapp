"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../lib/services/api-client";
import { useVendorContext } from "../layout";
import { toast } from "sonner";

function money(value: unknown) {
  return `PKR ${Number(value ?? 0).toLocaleString()}`;
}

export default function VendorTravelInvoicesPage() {
  const { selectedLink } = useVendorContext();
  const [eligible, setEligible] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<number, { checked: boolean; amount: string }>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!selectedLink) return;
    setLoading(true);
    try {
      const [eligibleRes, invoicesRes] = await Promise.all([
        apiClient.getVendorTravelInvoiceEligible(selectedLink.id),
        apiClient.getVendorTravelInvoices({ link_id: selectedLink.id, page: 1, limit: 50 }),
      ]);
      const legs = eligibleRes.data ?? [];
      setEligible(Array.isArray(legs) ? legs : []);
      setInvoices(invoicesRes.data?.data ?? invoicesRes.data ?? []);
      setSelected({});
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load vendor invoices");
    } finally {
      setLoading(false);
    }
  }, [selectedLink]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (leg: any) => {
    setSelected((prev) => {
      const current = prev[leg.request_id];
      if (current?.checked) {
        const next = { ...prev };
        delete next[leg.request_id];
        return next;
      }
      return {
        ...prev,
        [leg.request_id]: { checked: true, amount: String(leg.estimate ?? 0) },
      };
    });
  };

  const createInvoice = async () => {
    const legs = Object.entries(selected)
      .filter(([, value]) => value.checked)
      .map(([requestId, value]) => ({
        request_id: Number(requestId),
        amount: Number(value.amount || 0),
      }));
    if (legs.length === 0) {
      toast.error("Select at least one completed leg");
      return;
    }
    setCreating(true);
    try {
      await apiClient.createVendorTravelInvoice({ legs, notes: notes.trim() || undefined });
      toast.success("Vendor invoice created");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0c225e]">Travel invoices</h1>
        <p className="text-sm text-gray-500 mt-1">
          Invoice the company for completed first/last mile legs you fulfilled.
        </p>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <h2 className="font-bold text-[#0c225e]">Uninvoiced completed legs</h2>
          <button
            onClick={createInvoice}
            disabled={creating || Object.values(selected).every((v) => !v.checked)}
            className="text-xs bg-[#f47f00] text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create invoice"}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Mile</th>
              <th className="px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : eligible.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No completed legs waiting to be invoiced</td></tr>
            ) : eligible.map((leg) => (
              <tr key={leg.request_id}>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={!!selected[leg.request_id]?.checked} onChange={() => toggle(leg)} />
                </td>
                <td className="px-4 py-3">{leg.employee_name}</td>
                <td className="px-4 py-3">{leg.origin} ? {leg.destination}</td>
                <td className="px-4 py-3">{leg.mile}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    disabled={!selected[leg.request_id]?.checked}
                    value={selected[leg.request_id]?.amount ?? String(leg.estimate ?? 0)}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [leg.request_id]: { checked: true, amount: e.target.value },
                      }))
                    }
                    className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-sm disabled:bg-gray-50"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {eligible.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for the company"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={2}
            />
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-bold text-[#0c225e]">Submitted invoices</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No vendor invoices yet</td></tr>
            ) : invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                <td className="px-4 py-3">{inv.companies?.name}</td>
                <td className="px-4 py-3">{money(inv.total_amount)}</td>
                <td className="px-4 py-3">{inv.status}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => apiClient.viewVendorTravelInvoicePdf(inv.id).catch(() => toast.error("Failed to view PDF"))}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900 me-3"
                  >
                    View
                  </button>
                  <button
                    onClick={() => apiClient.downloadVendorTravelInvoicePdf(inv.id, inv.invoice_number).catch(() => toast.error("Failed to download PDF"))}
                    className="text-xs font-medium text-[#f47f00]"
                  >
                    PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
