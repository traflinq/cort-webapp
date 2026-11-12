"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatDateTime } from "@/app/lib/utils";
import { apiClient, type ChauffeurReport, type VendorTripAudit } from "../../../lib/services/api-client";

const pkr = (n: number) => Math.round(n).toLocaleString();

type DoneAudit = Extract<VendorTripAudit, { status: "DONE" }>;

/** Row badge for the "Vendor audit" column. */
export function VendorAuditBadge({ audit }: { audit: VendorTripAudit | null | undefined }) {
  const t = useTranslations("company.reports.vendorAudit");
  if (!audit) return <span className="text-[var(--text-muted)] text-xs">—</span>;
  if (audit.status === "NOT_AVAILABLE") {
    return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--text-muted)]">{t("notReady")}</span>;
  }
  if (audit.status === "NOT_RUN") {
    return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700">{t("notAudited")}</span>;
  }
  if (audit.verdict === "OVERCHARGED") {
    return (
      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-700 whitespace-nowrap">
        {t("overcharged")} +{pkr(audit.difference_amount)}
      </span>
    );
  }
  if (audit.verdict === "UNDERCHARGED") {
    return (
      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-50 text-sky-700 whitespace-nowrap">
        {t("undercharged")} −{pkr(Math.abs(audit.difference_amount))}
      </span>
    );
  }
  return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{t("matched")}</span>;
}

/**
 * Financial audit of a trip fulfilled by the company's own vendor: the admin enters what the vendor
 * billed, and we compare it with the amount calculated from the vendor contract. The calculated
 * amount is only revealed once an audit has been run.
 */
export function VendorAuditPanel({
  companyId,
  report,
  onAudited,
}: {
  companyId: number;
  report: ChauffeurReport;
  onAudited: (audit: VendorTripAudit) => void;
}) {
  const t = useTranslations("company.reports.vendorAudit");
  const [audit, setAudit] = useState<VendorTripAudit | null>(report.vendor_audit ?? null);
  const [editing, setEditing] = useState(audit?.status === "NOT_RUN");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always refresh from the server: the list row may be stale.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .getVendorTripAudit(companyId, report.id)
      .then((res) => {
        if (cancelled) return;
        setAudit(res.data);
        setEditing(res.data.status === "NOT_RUN");
      })
      .catch(() => { /* keep the row's copy */ });
    return () => { cancelled = true; };
  }, [companyId, report.id]);

  const startEdit = (done: DoneAudit) => {
    setAmount(String(done.vendor_charged_amount));
    setReference(done.vendor_invoice_reference ?? "");
    setNotes(done.notes ?? "");
    setError(null);
    setEditing(true);
  };

  const run = async () => {
    const value = Number(amount);
    if (amount.trim() === "" || !Number.isFinite(value) || value < 0) {
      setError(t("invalidAmount"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.runVendorTripAudit(companyId, report.id, {
        vendor_charged_amount: value,
        vendor_invoice_reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setAudit(res.data);
      setEditing(false);
      onAudited(res.data);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const vendorName = audit?.vendor?.name;

  return (
    <div>
      <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--cort-orange)]"></span>
        {t("title")}
      </h4>
      {vendorName && <p className="text-xs text-[var(--text-muted)] mb-3">{t("byVendor", { vendor: vendorName })}</p>}

      {audit?.status === "NOT_AVAILABLE" && (
        <div className="rounded-lg border border-[var(--border-light)] bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-muted)]">
          {audit.reason === "TRIP_NOT_COMPLETED" ? t("notCompletedMessage") : t("notReadyMessage")}
        </div>
      )}

      {audit?.status === "DONE" && !editing && <AuditResult audit={audit} onEdit={() => startEdit(audit)} />}

      {(audit?.status === "NOT_RUN" || (audit?.status === "DONE" && editing)) && (
        <div className="rounded-lg border border-[var(--border-light)] bg-white p-4 space-y-3">
          {audit.status === "NOT_RUN" && <p className="text-sm text-[var(--text-muted)]">{t("intro")}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">{t("chargedLabel")}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[var(--border-strong)] bg-transparent px-3 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--cort-orange)]"
                aria-describedby="vendor-audit-charged-hint"
              />
              <span id="vendor-audit-charged-hint" className="mt-1 block text-xs text-[var(--text-muted)]">{t("chargedHint")}</span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--text-primary)]">{t("referenceLabel")}</span>
              <input
                type="text"
                maxLength={100}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[var(--border-strong)] bg-transparent px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--cort-orange)]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--text-primary)]">{t("notesLabel")}</span>
              <input
                type="text"
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[var(--border-strong)] bg-transparent px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--cort-orange)]"
              />
            </label>
          </div>
          {error && <p className="text-xs font-medium text-rose-600" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={run}
              disabled={submitting}
              className="rounded-xl bg-[var(--cort-orange)] px-5 py-2.5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--cort-orange-hover)] disabled:opacity-60"
            >
              {submitting ? t("running") : audit.status === "DONE" ? t("rerun") : t("run")}
            </button>
            {audit.status === "DONE" && (
              <button type="button" onClick={() => setEditing(false)} disabled={submitting} className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                {t("cancel")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditResult({ audit, onEdit }: { audit: DoneAudit; onEdit: () => void }) {
  const t = useTranslations("company.reports.vendorAudit");
  const percent = audit.difference_percentage != null ? Math.abs(audit.difference_percentage).toFixed(1) : "—";
  const tone =
    audit.verdict === "OVERCHARGED"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : audit.verdict === "UNDERCHARGED"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
  const headline =
    audit.verdict === "OVERCHARGED"
      ? t("overchargedBy", { amount: pkr(audit.difference_amount), percent })
      : audit.verdict === "UNDERCHARGED"
        ? t("underchargedBy", { amount: pkr(Math.abs(audit.difference_amount)), percent })
        : t("matchedMessage");

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-4 text-sm font-bold ${tone}`} role="status">{headline}</div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("vendorCharged")} value={`PKR ${pkr(audit.vendor_charged_amount)}`} />
        <Stat label={t("expected")} value={`PKR ${pkr(audit.expected_amount)}`} />
        <Stat
          label={t("difference")}
          value={`${audit.difference_amount > 0 ? "+" : audit.difference_amount < 0 ? "−" : ""}PKR ${pkr(Math.abs(audit.difference_amount))}`}
          emphasis={audit.verdict === "OVERCHARGED"}
        />
      </div>

      {audit.expected_changed_since_audit && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{t("expectedChanged", { amount: pkr(audit.expected_amount_at_audit) })}</p>
      )}

      <div>
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t("expectedBreakdown")}</p>
        <div className="bg-white border border-[var(--border-light)] rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--border-light)]">
              {audit.expected_breakdown.map((line, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 text-[var(--text-primary)]">
                    {line.description}
                    {line.quantity != null && line.unit_price != null && (
                      <span className="ms-2 text-xs text-[var(--text-muted)] font-mono">
                        {line.quantity} × {pkr(line.unit_price)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-end font-medium text-[var(--text-primary)] font-mono">
                    {line.amount < 0 ? "−" : ""}PKR {pkr(Math.abs(line.amount))}
                  </td>
                </tr>
              ))}
              <tr className="bg-[var(--surface-subtle)] font-bold">
                <td className="px-4 py-3 text-[var(--text-primary)]">{t("lineTotal")}</td>
                <td className="px-4 py-3 text-end text-[var(--cort-orange)] font-mono">PKR {pkr(audit.expected_amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <span>
          {t("auditedOn", { date: formatDateTime(audit.audited_at) })}
          {audit.vendor_invoice_reference && <span className="ms-2">· {t("reference", { reference: audit.vendor_invoice_reference })}</span>}
        </span>
        <button type="button" onClick={onEdit} className="font-semibold text-[var(--text-primary)] underline underline-offset-2 hover:text-[var(--cort-orange)]">
          {t("editAudit")}
        </button>
      </div>
      {audit.notes && <p className="text-xs text-[var(--text-muted)] whitespace-pre-line">{audit.notes}</p>}
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="bg-[var(--surface-subtle)] p-3 rounded-xl border border-[var(--border-light)]">
      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{label}</div>
      <div className={`mt-1 text-sm font-bold font-mono ${emphasis ? "text-rose-700" : "text-[var(--text-primary)]"}`}>{value}</div>
    </div>
  );
}
