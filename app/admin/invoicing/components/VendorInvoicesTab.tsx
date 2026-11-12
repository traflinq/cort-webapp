"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, FileDown, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  apiClient,
  type Company,
  type Invoice,
  type PendingVendorTrip,
  type PendingVendorTripReason,
} from "../../../lib/services/api-client";
import { useConfirm } from "../../../lib/hooks/useConfirm";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  Field,
  Select,
  StatusBadge,
  type BadgeTone,
  type DataTableColumn,
} from "../../ui";
import { companyLabel, formatCurrency, formatDate } from "../../lib/format";

const PAGE_SIZE = 20;

const REASON: Record<PendingVendorTripReason, { label: string; tone: BadgeTone; hint: string }> = {
  READY: { label: "Ready to invoice", tone: "success", hint: "The vendor contract has a rate for this vehicle." },
  NO_CONTRACT: { label: "No vendor contract", tone: "warning", hint: "Set this vendor's chauffeur contract for the company." },
  NO_RATE_FOR_MODEL: { label: "No rate for vehicle", tone: "warning", hint: "Add this vehicle model to the vendor's contract." },
  NO_VENDOR_ASSIGNED: { label: "No vendor confirmed", tone: "danger", hint: "The booking completed without a confirmed vendor, so it cannot be priced." },
};

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/**
 * Invoices issued by companies' own (external) vendors, computed from the vendor contracts super
 * admin sets. Not Cort revenue — kept apart from the ledger and profitability. Companies never see
 * these directly; they audit their vendor's bill against them from Chauffeur Reports.
 */
export function VendorInvoicesTab({ companies }: { companies: Company[] }) {
  const confirm = useConfirm();
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);

  // Request keys: loading is derived (requested ≠ loaded); state is only set in promise callbacks.
  const [pending, setPending] = useState<PendingVendorTrip[]>([]);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [pendingNonce, setPendingNonce] = useState(0);
  const pendingKey = `${companyId ?? ""}|${pendingNonce}`;
  const [pendingLoadedKey, setPendingLoadedKey] = useState<string | null>(null);
  const pendingLoading = pendingLoadedKey !== pendingKey;
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [listNonce, setListNonce] = useState(0);
  const listKey = `${companyId ?? ""}|${page}|${listNonce}`;
  const [listLoadedKey, setListLoadedKey] = useState<string | null>(null);
  const listLoading = listLoadedKey !== listKey;
  const [busyPdfId, setBusyPdfId] = useState<number | null>(null);

  const loadPending = useCallback(() => setPendingNonce((n) => n + 1), []);
  const loadInvoices = useCallback(() => setListNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getPendingVendorTrips(companyId)
      .then((res) => {
        if (cancelled) return;
        setPending(res.data ?? []);
        setPendingError(null);
      })
      .catch((e) => {
        if (!cancelled) setPendingError(errText(e, "Failed to load pending vendor trips"));
      })
      .finally(() => {
        if (!cancelled) setPendingLoadedKey(pendingKey);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, pendingKey]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getAllInvoices({ issuer: "EXTERNAL_VENDOR", company_id: companyId, page, limit: PAGE_SIZE })
      .then((raw) => {
        if (cancelled) return;
        const res = raw as unknown as {
          data?: Invoice[] | { data?: Invoice[]; pagination?: { pages?: number; total?: number } };
          pagination?: { pages?: number; total?: number };
        };
        const inner = res.data;
        const rows = Array.isArray(inner) ? inner : inner?.data ?? [];
        const meta = (Array.isArray(inner) ? res.pagination : inner?.pagination ?? res.pagination) ?? {};
        setInvoices(rows);
        setPages(Math.max(1, meta.pages ?? 1));
        setTotal(meta.total ?? rows.length);
        setListError(null);
      })
      .catch((e) => {
        if (!cancelled) setListError(errText(e, "Failed to load vendor invoices"));
      })
      .finally(() => {
        if (!cancelled) setListLoadedKey(listKey);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, page, listKey]);

  const generate = async (trip: PendingVendorTrip) => {
    const ok = await confirm({
      title: `Generate ${trip.vendor?.name ?? "vendor"}'s invoice for trip #${trip.id}?`,
      message: "The trip is priced on the vendor's contract with this company.",
      consequences: ["Not Cort revenue — it stays out of the ledger and profitability", "The company can audit its vendor's bill against this amount"],
      confirmLabel: "Generate invoice",
    });
    if (!ok) return;
    setGeneratingId(trip.id);
    try {
      // Recalculate prices the completed trip on the vendor contract and issues the invoice.
      await apiClient.recalculateBooking(trip.id, {});
      toast.success(`Vendor invoice generated for trip #${trip.id}`);
      loadPending();
      loadInvoices();
    } catch (e) {
      toast.error(errText(e, "Failed to generate the vendor invoice"));
    } finally {
      setGeneratingId(null);
    }
  };

  const pdf = async (inv: Invoice, mode: "view" | "download") => {
    setBusyPdfId(inv.id);
    try {
      if (mode === "view") await apiClient.viewInvoicePdf(inv.id);
      else await apiClient.downloadInvoicePdf(inv.id, inv.invoice_number);
    } catch (e) {
      toast.error(errText(e, "Failed to open the PDF"));
    } finally {
      setBusyPdfId(null);
    }
  };

  const pendingColumns: DataTableColumn<PendingVendorTrip>[] = [
    { key: "id", header: "Trip", cell: (t) => <span className="font-medium text-fg">#{t.id}</span>, width: "1%" },
    { key: "company", header: "Company", cell: (t) => t.companies?.name ?? "—" },
    { key: "vendor", header: "Vendor", cell: (t) => t.vendor?.name ?? "—" },
    { key: "vehicle", header: "Vehicle", cell: (t) => t.vehicle_model ?? "—", hideBelow: "md" },
    { key: "completed", header: "Completed", cell: (t) => formatDate(t.chauffeur_trip_logs?.completed_at ?? null), hideBelow: "sm" },
    {
      key: "reason",
      header: "Status",
      cell: (t) => (
        <Badge tone={REASON[t.reason].tone} size="sm" dot title={REASON[t.reason].hint}>
          {REASON[t.reason].label}
        </Badge>
      ),
    },
    {
      key: "action",
      header: <span className="sr-only">Action</span>,
      align: "right",
      cell: (t) =>
        t.reason === "READY" ? (
          <Button size="sm" onClick={() => generate(t)} loading={generatingId === t.id} disabled={generatingId !== null}>
            Generate invoice
          </Button>
        ) : t.reason === "NO_VENDOR_ASSIGNED" || !t.vendor_link_id ? null : (
          <Button size="sm" variant="outline" leftIcon={<FileText />} asChild>
            <Link href={`/admin/pricing?companyId=${t.company_id}&vendorLinkId=${t.vendor_link_id}`}>
              {t.reason === "NO_CONTRACT" ? "Set contract" : "Add rate"}
            </Link>
          </Button>
        ),
    },
  ];

  const invoiceColumns: DataTableColumn<Invoice>[] = [
    { key: "number", header: "Invoice", cell: (i) => <span className="font-mono text-fg">{i.invoice_number}</span> },
    { key: "vendor", header: "Issued by", cell: (i) => i.issuer_external_vendors?.name ?? "—" },
    { key: "company", header: "Billed to", cell: (i) => (i.companies ? companyLabel(i.companies) : "—") },
    { key: "date", header: "Date", cell: (i) => formatDate(i.generated_at), hideBelow: "sm" },
    { key: "amount", header: "System amount", align: "right", mono: true, cell: (i) => formatCurrency(i.total_amount) },
    {
      key: "audit",
      header: "Company audit",
      align: "right",
      cell: (i) => {
        const a = i.chauffeur_bookings?.vendor_trip_audits;
        if (!a) return <span className="text-xs text-fg-muted">Not audited</span>;
        const diff = Number(a.difference_amount);
        const tone: BadgeTone = Math.abs(diff) < 1 ? "success" : diff > 0 ? "danger" : "info";
        return (
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono text-xs text-fg">Charged {formatCurrency(a.vendor_charged_amount)}</span>
            <Badge tone={tone} size="sm">
              {Math.abs(diff) < 1 ? "Matched" : `${diff > 0 ? "+" : "−"}${formatCurrency(Math.abs(diff))}`}
            </Badge>
          </div>
        );
      },
    },
    { key: "status", header: "Status", cell: (i) => <StatusBadge status={i.status} size="sm" />, hideBelow: "md" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-fg-muted">
          Trips fulfilled by a company&apos;s own vendor, priced on the vendor contract. Not Cort revenue. Companies only see these amounts when they audit their vendor&apos;s bill.
        </p>
        <Field inline label="Company" className="w-full sm:w-auto">
          <Select
            aria-label="Company"
            value={companyId ? String(companyId) : ""}
            onChange={(e) => {
              setCompanyId(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="w-full sm:w-64"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {companyLabel(c)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Card>
        <CardHeader
          title="Waiting for a vendor invoice"
          description="Completed vendor trips that could not be priced yet. Fix the contract, then generate the invoice."
          actions={
            <Button variant="ghost" size="sm" leftIcon={<RefreshCw />} onClick={loadPending} disabled={pendingLoading}>
              Refresh
            </Button>
          }
        />
        <DataTable
          columns={pendingColumns}
          rows={pending}
          rowKey={(t) => t.id}
          loading={pendingLoading}
          error={pendingError}
          onRetry={loadPending}
          empty={{ title: "Nothing waiting", description: "Every completed vendor trip has its invoice." }}
          density="compact"
        />
      </Card>

      <Card>
        <CardHeader title="Vendor invoices" description="Issued in the vendor's name. No SST." />
        <DataTable
          columns={invoiceColumns}
          rows={invoices}
          rowKey={(i) => i.id}
          loading={listLoading}
          error={listError}
          onRetry={loadInvoices}
          empty={{ title: "No vendor invoices yet", description: "They appear here once a vendor trip is completed under a vendor contract." }}
          rowActions={(i) => [
            { label: "View PDF", icon: <Eye />, onSelect: () => pdf(i, "view"), disabled: busyPdfId === i.id },
            { label: "Download PDF", icon: <FileDown />, onSelect: () => pdf(i, "download"), disabled: busyPdfId === i.id },
          ]}
          pagination={{ page, totalPages: pages, total, pageSize: PAGE_SIZE, onPageChange: setPage }}
        />
      </Card>
    </div>
  );
}
