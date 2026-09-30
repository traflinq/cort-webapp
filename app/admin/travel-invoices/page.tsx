"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "../../lib/services/api-client";
import { Modal } from "../components/ui/Modal";

function money(value: unknown) {
  const n = Number(value ?? 0);
  return `PKR ${n.toLocaleString()}`;
}

function dateLabel(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default function AdminTravelInvoicesPage() {
  const [pending, setPending] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [kmInputs, setKmInputs] = useState<Record<number, string>>({});
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{
    bookingId: number;
    rentalDistanceKm?: number;
    data: any;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, invoicesRes] = await Promise.all([
        apiClient.getAdminTravelInvoicesPending(1, 50),
        apiClient.getAdminTravelInvoices(1, 50),
      ]);
      setPending(pendingRes.data?.data ?? pendingRes.data ?? []);
      setInvoices(invoicesRes.data?.data ?? invoicesRes.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load travel invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPreview = async (booking: any) => {
    const hasCortRental = booking.miles?.some(
      (m: any) => m.type === "RENTAL" && m.provider === "CORT",
    );
    let rentalDistanceKm: number | undefined;
    if (hasCortRental) {
      const raw = kmInputs[booking.id]?.trim();
      const parsed = raw ? Number(raw) : NaN;
      if (!raw || !Number.isFinite(parsed) || parsed <= 0) {
        toast.error("Enter the distance driven (km) for the CORT rental first");
        return;
      }
      rentalDistanceKm = parsed;
    }
    setPreviewLoadingId(booking.id);
    try {
      const res = await apiClient.previewAdminTravelInvoice(booking.id, rentalDistanceKm);
      setPreview({ bookingId: booking.id, rentalDistanceKm, data: res.data ?? res });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to preview invoice");
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const confirmGenerate = async () => {
    if (!preview) return;
    const { bookingId, rentalDistanceKm } = preview;
    setGeneratingId(bookingId);
    try {
      await apiClient.generateAdminTravelInvoice(bookingId, rentalDistanceKm);
      toast.success("Travel invoice generated");
      setPreview(null);
      setKmInputs((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate invoice");
    } finally {
      setGeneratingId(null);
    }
  };

  const markPaid = async (id: number) => {
    setBusyId(id);
    try {
      await apiClient.updateAdminTravelInvoiceStatus(id, "PAID");
      toast.success("Invoice marked paid");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-sm font-medium text-muted">Travel</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Travel invoices
        </h1>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          Generate one CORT invoice per confirmed company booking. Ticket fare and CORT/Bykea miles are included. Vendor-fulfilled legs are billed separately by the vendor.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-[var(--bg-card)] overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Pending generation</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Travel date</th>
                <th className="px-4 py-3 text-right">Fare</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && pending.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
              ) : pending.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No confirmed bookings waiting for a CORT invoice</td></tr>
              ) : pending.map((booking) => {
                const hasCortRental = booking.miles?.some(
                  (m: any) => m.type === "RENTAL" && m.provider === "CORT",
                );
                return (
                <tr key={booking.id}>
                  <td className="px-4 py-3">{booking.employee?.full_name ?? "-"}</td>
                  <td className="px-4 py-3">{booking.companies?.name ?? "-"}</td>
                  <td className="px-4 py-3">{booking.quote?.origin} - {booking.quote?.destination}</td>
                  <td className="px-4 py-3">{dateLabel(booking.quote?.travel_date)}</td>
                  <td className="px-4 py-3 text-right">{money(booking.fare_amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {hasCortRental ? (
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          placeholder="Rental km"
                          value={kmInputs[booking.id] ?? ""}
                          onChange={(e) =>
                            setKmInputs((prev) => ({ ...prev, [booking.id]: e.target.value }))
                          }
                          className="w-24 rounded-lg border border-border px-2 py-1.5 text-xs"
                        />
                      ) : null}
                      <button
                        onClick={() => openPreview(booking)}
                        disabled={previewLoadingId === booking.id}
                        className="inline-flex items-center rounded-lg bg-[#f47f00] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#d97000] disabled:opacity-50"
                      >
                        {previewLoadingId === booking.id ? "Loading..." : "Generate invoice"}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-[var(--bg-card)] overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Generated invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && invoices.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No travel invoices generated yet</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-3">{inv.travel_booking?.employee?.full_name ?? "-"}</td>
                  <td className="px-4 py-3">
                    {inv.travel_booking?.quote?.origin} - {inv.travel_booking?.quote?.destination}
                    {inv.line_items?.length ? (
                      <ul className="mt-1 text-xs text-muted space-y-0.5">
                        {inv.line_items.map((item: any) => (
                          <li key={item.id}>{item.description} - {money(item.total_price)}</li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{money(inv.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      inv.status === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => apiClient.viewAdminTravelInvoicePdf(inv.id).catch(() => toast.error("Failed to view PDF"))}
                        className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        View
                      </button>
                      <button
                        onClick={() => apiClient.downloadAdminTravelInvoicePdf(inv.id, inv.invoice_number).catch(() => toast.error("Failed to download PDF"))}
                        className="text-xs font-medium text-[#f47f00] hover:text-[#d97000]"
                      >
                        PDF
                      </button>
                      {inv.status !== "PAID" && (
                        <button
                          onClick={() => markPaid(inv.id)}
                          disabled={busyId === inv.id}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        title="Preview invoice"
        size="md"
      >
        {preview ? (
          <div className="flex flex-col gap-4">
            <div className="text-sm text-muted">
              Invoice <span className="font-mono">{preview.data.invoice_number}</span> for{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {preview.data.employee?.full_name ?? "-"}
              </span>{" "}
              at {preview.data.company?.name ?? "-"} · {preview.data.quote?.origin} -{" "}
              {preview.data.quote?.destination}
            </div>

            <div className="rounded-lg border border-border divide-y divide-border">
              {preview.data.line_items?.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-[var(--text-primary)]">{item.description}</span>
                  <span className="font-semibold">{money(item.total_price)}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-1 text-sm font-bold">
              <span>Total</span>
              <span>{money(preview.data.total_amount)}</span>
            </div>

            {preview.data.wallet_charge_note ? (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {preview.data.wallet_charge_note}
              </div>
            ) : null}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPreview(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--row-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={confirmGenerate}
                disabled={generatingId === preview.bookingId}
                className="inline-flex items-center rounded-lg bg-[#f47f00] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#d97000] disabled:opacity-50"
              >
                {generatingId === preview.bookingId ? "Generating..." : "Confirm & generate"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
