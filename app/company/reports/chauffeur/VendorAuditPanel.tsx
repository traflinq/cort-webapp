"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CircleCheck, Info } from "@/app/components/icons";
import { Badge, Button, Field, InlineError, Input } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { formatLocaleDate, formatLocaleNumber } from "@/app/lib/i18n/format";
import { useCompanyLocale } from "../../lib/locale-context";
import { apiClient, type ChauffeurReport, type VendorTripAudit } from "../../../lib/services/api-client";

type DoneAudit = Extract<VendorTripAudit, { status: "DONE" }>;

/** Locale-aware whole-rupee formatting: "1,240,500" and "PKR 1,240,500". */
function useAuditFormat() {
  const { locale } = useCompanyLocale();
  const tCommon = useTranslations("common");
  const num = (n: number) => formatLocaleNumber(Math.round(n), locale, { maximumFractionDigits: 0 });
  const qty = (n: number) => formatLocaleNumber(n, locale, { maximumFractionDigits: 2 });
  const money = (n: number) => `${tCommon("currency.pkr")} ${num(n)}`;
  const dateTime = (iso: string) =>
    formatLocaleDate(iso, locale, {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  return { num, qty, money, dateTime };
}

/** Row badge for the "Vendor audit" column. */
export function VendorAuditBadge({ audit }: { audit: VendorTripAudit | null | undefined }) {
  const t = useTranslations("company.reports.vendorAudit");
  const f = useAuditFormat();
  if (!audit) return <span className="text-xs text-fg-muted">—</span>;
  if (audit.status === "NOT_AVAILABLE") {
    return <Badge tone="neutral" dot>{t("notReady")}</Badge>;
  }
  if (audit.status === "NOT_RUN") {
    return <Badge tone="warning" dot>{t("notAudited")}</Badge>;
  }
  if (audit.verdict === "OVERCHARGED") {
    return (
      <Badge tone="danger" icon={<ArrowUpRight aria-hidden="true" />} className="tabular-nums">
        {t("overcharged")} +{f.money(audit.difference_amount)}
      </Badge>
    );
  }
  if (audit.verdict === "UNDERCHARGED") {
    return (
      <Badge tone="info" icon={<ArrowDownRight aria-hidden="true" />} className="tabular-nums">
        {t("undercharged")} −{f.money(Math.abs(audit.difference_amount))}
      </Badge>
    );
  }
  return <Badge tone="success" dot>{t("matched")}</Badge>;
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
    <section>
      <h4 className="text-sm font-semibold text-fg">{t("title")}</h4>
      {vendorName && <p className="mt-0.5 text-xs text-fg-muted">{t("byVendor", { vendor: vendorName })}</p>}

      <div className="mt-3">
        {audit?.status === "NOT_AVAILABLE" && (
          <div className="flex items-start gap-2 rounded-lg border border-line bg-subtle p-4 text-sm text-fg-secondary">
            <Info className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <span>{audit.reason === "TRIP_NOT_COMPLETED" ? t("notCompletedMessage") : t("notReadyMessage")}</span>
          </div>
        )}

        {audit?.status === "DONE" && !editing && <AuditResult audit={audit} onEdit={() => startEdit(audit)} />}

        {(audit?.status === "NOT_RUN" || (audit?.status === "DONE" && editing)) && (
          <div className="space-y-4 rounded-lg border border-line bg-card p-4">
            {audit.status === "NOT_RUN" && <p className="text-sm text-fg-secondary">{t("intro")}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("chargedLabel")} hint={t("chargedHint")} className="sm:col-span-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  mono
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label={t("referenceLabel")}>
                <Input type="text" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
              </Field>
              <Field label={t("notesLabel")}>
                <Input type="text" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            {error && <InlineError>{error}</InlineError>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={run} loading={submitting}>
                {submitting ? t("running") : audit.status === "DONE" ? t("rerun") : t("run")}
              </Button>
              {audit.status === "DONE" && (
                <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={submitting}>
                  {t("cancel")}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AuditResult({ audit, onEdit }: { audit: DoneAudit; onEdit: () => void }) {
  const t = useTranslations("company.reports.vendorAudit");
  const f = useAuditFormat();
  const percent = audit.difference_percentage != null ? Math.abs(audit.difference_percentage).toFixed(1) : "—";
  const tone =
    audit.verdict === "OVERCHARGED"
      ? "border-danger-line bg-danger-soft text-danger-ink"
      : audit.verdict === "UNDERCHARGED"
        ? "border-info-line bg-info-soft text-info-ink"
        : "border-success-line bg-success-soft text-success-ink";
  const HeadlineIcon = audit.verdict === "OVERCHARGED" ? AlertTriangle : audit.verdict === "UNDERCHARGED" ? Info : CircleCheck;
  const headline =
    audit.verdict === "OVERCHARGED"
      ? t("overchargedBy", { amount: f.num(audit.difference_amount), percent })
      : audit.verdict === "UNDERCHARGED"
        ? t("underchargedBy", { amount: f.num(Math.abs(audit.difference_amount)), percent })
        : t("matchedMessage");

  const diff = audit.difference_amount;
  const DiffIcon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : null;

  return (
    <div className="space-y-4">
      <div className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm font-medium tabular-nums", tone)} role="status">
        <HeadlineIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{headline}</span>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={t("vendorCharged")} value={f.money(audit.vendor_charged_amount)} />
        <Stat label={t("expected")} value={f.money(audit.expected_amount)} />
        <Stat
          label={t("difference")}
          value={`${diff > 0 ? "+" : diff < 0 ? "−" : ""}${f.money(Math.abs(diff))}`}
          icon={DiffIcon ? <DiffIcon className="size-4 shrink-0" aria-hidden="true" /> : undefined}
          emphasis={audit.verdict === "OVERCHARGED"}
        />
      </dl>

      {audit.expected_changed_since_audit && (
        <p className="flex items-start gap-2 rounded-lg border border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning-ink tabular-nums">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{t("expectedChanged", { amount: f.num(audit.expected_amount_at_audit) })}</span>
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-medium text-fg-muted">{t("expectedBreakdown")}</p>
        <div className="overflow-hidden rounded-lg border border-line bg-card">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {audit.expected_breakdown.map((line, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 text-start text-fg">
                    {line.description}
                    {line.quantity != null && line.unit_price != null && (
                      <span className="ms-2 text-xs text-fg-muted tabular-nums">
                        {f.qty(line.quantity)} × {f.num(line.unit_price)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end text-fg tabular-nums">
                    {line.amount < 0 ? "−" : ""}{f.money(Math.abs(line.amount))}
                  </td>
                </tr>
              ))}
              <tr className="bg-subtle">
                <td className="px-4 py-3 text-start font-semibold text-fg">{t("lineTotal")}</td>
                <td className="whitespace-nowrap px-4 py-3 text-end font-semibold text-fg tabular-nums">{f.money(audit.expected_amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
        <span className="tabular-nums">
          {t("auditedOn", { date: f.dateTime(audit.audited_at) })}
          {audit.vendor_invoice_reference && <span className="ms-2">· {t("reference", { reference: audit.vendor_invoice_reference })}</span>}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          {t("editAudit")}
        </Button>
      </div>
      {audit.notes && <p className="whitespace-pre-line text-xs text-fg-muted">{audit.notes}</p>}
    </div>
  );
}

function Stat({ label, value, emphasis, icon }: { label: string; value: string; emphasis?: boolean; icon?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={cn("mt-1 flex items-center gap-1 text-base font-semibold tabular-nums", emphasis ? "text-danger-ink" : "text-fg")}>
        {icon}
        {value}
      </dd>
    </div>
  );
}
