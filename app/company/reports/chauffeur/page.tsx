"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Download, ExternalLink, FileBarChart } from "lucide-react";
import { Badge, Button, Input, TableSkeletonRows, focusRingInset, focusRing } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { formatLocaleDate, formatLocaleNumber } from "@/app/lib/i18n/format";
import { useCompanyAccess } from "../../lib/access-context";
import { useCompanyLocale } from "../../lib/locale-context";
import { ChauffeurReport, apiClient } from "../../../lib/services/api-client";
import { Card } from "../../components/Card";
import { PageHeader, TableEmptyState, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../../components/PageLayout";
import Modal from "../../bookings/components/Modal";
import { VendorAuditBadge, VendorAuditPanel } from "./VendorAuditPanel";

const isVendorTrip = (r: ChauffeurReport) => r.fulfillment_type === "EXTERNAL_VENDOR";

function escapeCSV(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function auditLabel(r: ChauffeurReport): string {
  const a = r.vendor_audit;
  if (!isVendorTrip(r) || !a) return "";
  if (a.status === "DONE") return a.verdict;
  return a.status === "NOT_RUN" ? "NOT_AUDITED" : "PENDING";
}

function exportChauffeurCSV(reports: ChauffeurReport[], companyName: string, startDate: string, endDate: string) {
  const headers = [
    "Date", "City", "Booking ID", "Passenger", "Employee ID",
    "Vehicle", "Plate Number", "Driver",
    "Pickup", "Dropoff",
    "Duration (min)", "Distance (km)",
    "Service Charge (PKR)", "Fuel Cost (PKR)", "Toll (PKR)", "Parking (PKR)", "Accommodation (PKR)", "Outstation Allowance (PKR)", "Total (PKR)",
    "Vendor", "Vendor Audit", "Audit Difference (PKR)",
  ];

  const rows = reports.map((r) => [
    r.completed_at ? new Date(r.completed_at).toLocaleString("en-PK", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "",
    r.city || "",
    r.id,
    r.passenger?.full_name || "Guest",
    r.passenger?.employee_id || "",
    `${r.vehicle?.make || ""} ${r.vehicle?.model || ""}`.trim(),
    r.vehicle?.plate_number || "",
    r.driver?.full_name || "",
    r.route?.pickup || "",
    r.route?.dropoff || "",
    r.total_duration_minutes ?? "",
    r.total_distance_km ?? "",
    // Vendor trips: no calculated breakdown; total = what the vendor charged (once audited)
    r.breakdown ? Number(r.breakdown.service_charge ?? 0) : "",
    r.breakdown ? Number(r.breakdown.fuel_cost ?? 0) : "",
    r.breakdown ? Number(r.breakdown.toll ?? 0) : "",
    r.breakdown ? Number(r.breakdown.parking ?? 0) : "",
    r.breakdown ? Number(r.breakdown.accommodation ?? 0) : "",
    r.breakdown ? Number(r.breakdown.outstation_allowance ?? 0) : "",
    r.total_cost != null ? Number(r.total_cost) : "",
    isVendorTrip(r) ? r.vendor_audit?.vendor?.name ?? "" : "",
    auditLabel(r),
    r.vendor_audit?.status === "DONE" ? Math.round(r.vendor_audit.difference_amount) : "",
  ]);

  const csvContent = [
    `# CORT - Chauffeur Report`,
    `# Company: ${companyName}`,
    `# Period: ${startDate || "All"} to ${endDate || "All"}`,
    `# Generated: ${new Date().toLocaleString("en-PK")}`,
    `# Total Trips: ${reports.length}`,
    `# Total Cost: PKR ${reports.reduce((s, r) => s + Number(r.total_cost ?? 0), 0).toLocaleString()}`,
    "",
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateLabel = startDate && endDate ? `_${startDate}_to_${endDate}` : startDate ? `_from_${startDate}` : "";
  a.href = url;
  a.download = `cort_chauffeur_report${dateLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const DETAIL_LABEL = "text-xs font-medium text-fg-muted";
const SECTION_TITLE = "mb-3 text-sm font-semibold text-fg";

function ReceiptLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="space-y-2">
      <p className={DETAIL_LABEL}>{label}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("group relative block aspect-[4/3] overflow-hidden rounded-lg border border-line transition-colors hover:border-line-strong", focusRing)}
      >
        <img src={href} alt={label} className="h-full w-full object-cover" />
        <span className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-md border border-line bg-card text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </span>
      </a>
    </div>
  );
}

function BreakdownRow({ label, value, sub = false }: { label: ReactNode; value: string; sub?: boolean }) {
  return (
    <tr>
      <td className={cn("px-4 text-start", sub ? "py-2 ps-8 text-xs text-fg-secondary" : "py-3 text-fg")}>{label}</td>
      <td className={cn("whitespace-nowrap px-4 text-end tabular-nums text-fg", sub ? "py-2 text-xs" : "py-3")}>{value}</td>
    </tr>
  );
}

export default function ChauffeurReportsPage() {
  const t = useTranslations("company.reports");
  const tAudit = useTranslations("company.reports.vendorAudit");
  const tCommon = useTranslations("common");
  const { company } = useCompanyAccess();
  const { locale } = useCompanyLocale();

  const [reports, setReports] = useState<ChauffeurReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ChauffeurReport | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  /** Whole numbers in the company locale (table columns carry the PKR unit in the header). */
  const num = (v: number) => formatLocaleNumber(v, locale, { maximumFractionDigits: 0 });
  /** Decimal-friendly figures (hours, km). */
  const dec = (v: number, dp = 1) => formatLocaleNumber(v, locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  /** Full PKR amount, e.g. "PKR 1,240,500". */
  const money = (v: number) => `${tCommon("currency.pkr")} ${formatLocaleNumber(v, locale, { maximumFractionDigits: 2 })}`;
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

  const fetchReports = useCallback(async (start: string, end: string) => {
    if (!company?.id) return;
    setIsLoading(true);
    try {
      const res = await apiClient.getChauffeurReports(company.id, {
        startDate: start || undefined,
        endDate: end || undefined,
      }) as any;
      const raw = res?.data ?? res;
      setReports(raw?.data ?? raw ?? []);
    } catch (e) {
      console.error("Failed to fetch chauffeur reports", e);
    } finally {
      setIsLoading(false);
    }
  }, [company?.id]);

  // Debounce filter changes and re-fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReports(startDate, endDate);
    }, 400);
    return () => clearTimeout(timer);
  }, [startDate, endDate, fetchReports]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12">
      <PageHeader
        label={t("chauffeurLabel")}
        title={t("chauffeurTitle")}
        action={
          <>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label={t("startDate")}
                className="w-auto tabular-nums"
              />
              <span className="text-fg-muted" aria-hidden="true">–</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label={t("endDate")}
                className="w-auto tabular-nums"
              />
            </div>
            <Button
              type="button"
              leftIcon={<Download aria-hidden="true" />}
              onClick={() => exportChauffeurCSV(reports, company?.name ?? "Company", startDate, endDate)}
            >
              {t("exportCsv")}
            </Button>
          </>
        }
      />

      <Card className={TABLE_CARD_CLASS}>
        <div className={TABLE_TOP_BAR_CLASS}>
          <p className="text-sm text-fg-secondary">{t("chauffeurTableDescription")}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-start text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("date")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("city")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("bookingId")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("passenger")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("vehicle")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("route")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("durMin")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("distKm")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("svcChg")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("fuel")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("extras")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("totalPkr")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{tAudit("column")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading && reports.length === 0 ? (
                <TableSkeletonRows columns={13} rows={8} />
              ) : reports.length === 0 && !isLoading ? (
                <TableEmptyState message={t("noReports")} icon={FileBarChart} />
              ) : (
                reports.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedReport(report);
                      }
                    }}
                    tabIndex={0}
                    className={cn("cursor-pointer transition-colors hover:bg-row-hover", focusRingInset)}
                  >
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-fg`}>
                      {report.completed_at ? dateTime(report.completed_at) : "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-fg-secondary`}>
                      {report.city || "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap font-medium text-fg`}>
                      #{report.id}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="font-medium text-fg">
                        {report.passenger?.full_name || t("guest")}
                      </div>
                      <div className="text-xs text-fg-muted">
                        {report.passenger?.employee_id || "—"}
                      </div>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="whitespace-nowrap text-fg">{report.vehicle?.make} {report.vehicle?.model}</div>
                      <div className="text-xs text-fg-muted">
                        {report.vehicle?.plate_number}
                      </div>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} max-w-xs`}>
                      <div title={report.route.pickup} className="truncate text-xs text-fg">
                        <span className="me-1 font-medium text-fg-muted">A</span> {report.route.pickup || "—"}
                      </div>
                      <div title={report.route.dropoff} className="mt-0.5 truncate text-xs text-fg-secondary">
                        <span className="me-1 font-medium text-fg-muted">B</span> {report.route.dropoff || "—"}
                      </div>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end text-fg-secondary`}>
                      {report.total_duration_minutes != null ? num(Number(report.total_duration_minutes)) : "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end text-fg-secondary`}>
                      {report.total_distance_km != null ? formatLocaleNumber(Number(report.total_distance_km), locale, { maximumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-end text-fg-secondary`}>
                      {report.breakdown ? num(Number(report.breakdown.service_charge)) : "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-end text-fg-secondary`}>
                      {report.breakdown ? num(Number(report.breakdown.fuel_cost)) : "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-end text-fg-secondary`}>
                      {report.breakdown
                        ? num(
                            Number(report.breakdown.toll) +
                            Number(report.breakdown.parking) +
                            Number(report.breakdown.accommodation) +
                            Number(report.breakdown.outstation_allowance),
                          )
                        : "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-end font-semibold text-fg`}>
                      {report.total_cost != null ? num(Number(report.total_cost)) : "—"}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      {isVendorTrip(report) ? (
                        <div className="flex flex-col items-start gap-1">
                          <VendorAuditBadge audit={report.vendor_audit} />
                          {report.vendor_audit?.vendor?.name && (
                            <span className="max-w-[10rem] truncate text-xs text-fg-muted">{report.vendor_audit.vendor.name}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-fg-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={selectedReport ? t("tripDetails") + ` #${selectedReport.id}` : t("tripDetails")}
      >
        {selectedReport && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line p-4">
                <h4 className={cn(DETAIL_LABEL, "mb-2")}>{t("passenger")}</h4>
                <div className="text-sm font-semibold text-fg">{selectedReport.passenger?.full_name || t("guest")}</div>
                <div className="mt-1 text-sm text-fg-muted tabular-nums">{selectedReport.passenger?.employee_id || "N/A"}</div>
              </div>
              <div className="rounded-lg border border-line p-4">
                <h4 className={cn(DETAIL_LABEL, "mb-2")}>{t("vehicleAndDriver")}</h4>
                <div className="text-sm font-semibold text-fg">{selectedReport.vehicle?.make} {selectedReport.vehicle?.model}</div>
                <div className="mt-1 text-sm text-fg-muted tabular-nums">{selectedReport.vehicle?.plate_number}</div>
                <div className="mt-1 text-sm text-fg-muted">{t("driver")}: {selectedReport.driver?.full_name || t("assignedDriver")}</div>
              </div>
            </div>

            <div className="rounded-lg border border-line p-4">
              <h4 className={cn(DETAIL_LABEL, "mb-3")}>{t("routeJourney")}</h4>
              <ol className="relative flex flex-col gap-3">
                <span className="absolute start-[11px] top-2 bottom-2 w-px bg-line" aria-hidden="true" />
                <li className="relative flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-card text-xs font-medium text-fg-secondary">A</span>
                  <div>
                    <div className="text-sm font-medium text-fg">{selectedReport.route.pickup}</div>
                    <div className="mt-0.5 text-xs text-fg-muted">{t("pickupLocation")}</div>
                  </div>
                </li>
                <li className="relative flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-card text-xs font-medium text-fg-secondary">B</span>
                  <div>
                    <div className="text-sm font-medium text-fg">{selectedReport.route.dropoff}</div>
                    <div className="mt-0.5 text-xs text-fg-muted">{t("dropoffLocation")}</div>
                  </div>
                </li>
              </ol>
              <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4">
                <div>
                  <dt className="text-xs text-fg-muted">{t("duration")}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-fg tabular-nums">{t("mins", { count: selectedReport.total_duration_minutes })}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-muted">{t("distance")}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-fg tabular-nums">{t("km", { count: selectedReport.total_distance_km })}</dd>
                </div>
              </dl>
            </div>

            {selectedReport.daily_logs && selectedReport.daily_logs.length > 0 && (
              <div>
                <h4 className={SECTION_TITLE}>{t("tripBreakdown")}</h4>
                <div className="overflow-hidden rounded-lg border border-line bg-card">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className="px-4 py-2.5 text-start text-xs font-medium text-fg-muted">{t("date")}</th>
                        <th scope="col" className="px-4 py-2.5 text-start text-xs font-medium text-fg-muted">{t("tripType")}</th>
                        <th scope="col" className="px-4 py-2.5 text-end text-xs font-medium text-fg-muted">{t("hours")}</th>
                        <th scope="col" className="px-4 py-2.5 text-end text-xs font-medium text-fg-muted">{t("fullDay")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {[...selectedReport.daily_logs].sort((a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime()).map((log, idx) => (
                        <tr key={idx}>
                          <td className="whitespace-nowrap px-4 py-2.5 text-fg tabular-nums">
                            {formatLocaleDate(log.log_date, locale, { month: "short", day: "numeric", weekday: "short" })}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge tone="neutral">{log.trip_type === "OUT_STATION" ? t("outstation") : t("inCity")}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-end text-fg tabular-nums">
                            {dec(log.hours_used ? parseFloat(log.hours_used.toString()) : log.is_full_day ? 24 : 0)}
                          </td>
                          <td className="px-4 py-2.5 text-end text-fg-secondary">
                            {log.is_full_day ? t("yes") : t("no")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {isVendorTrip(selectedReport) && company?.id && (
              <VendorAuditPanel
                key={selectedReport.id}
                companyId={company.id}
                report={selectedReport}
                onAudited={(audit) => {
                  const charged = audit.status === "DONE" ? audit.vendor_charged_amount : null;
                  const patch = (r: ChauffeurReport) => (r.id === selectedReport.id ? { ...r, vendor_audit: audit, total_cost: charged } : r);
                  setReports((rows) => rows.map(patch));
                  setSelectedReport((r) => (r ? patch(r) : r));
                }}
              />
            )}

            {/* Cost Breakdown (calculated amounts are not shown for vendor trips) */}
            {selectedReport.breakdown && (
              <div>
                <h4 className={SECTION_TITLE}>{t("costBreakdown")}</h4>
                <div className="overflow-hidden rounded-lg border border-line bg-card">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-line">
                      <BreakdownRow label={t("serviceChargeBase")} value={money(Number(selectedReport.breakdown.service_charge))} />
                      <BreakdownRow label={t("fuelSurcharge")} value={money(Number(selectedReport.breakdown.fuel_cost))} />
                      {Number(selectedReport.breakdown.toll) > 0 && (
                        <BreakdownRow sub label={t("tollCharges")} value={money(Number(selectedReport.breakdown.toll))} />
                      )}
                      {Number(selectedReport.breakdown.parking) > 0 && (
                        <BreakdownRow sub label={t("parkingFees")} value={money(Number(selectedReport.breakdown.parking))} />
                      )}
                      {Number(selectedReport.breakdown.outstation_allowance) > 0 && (
                        <BreakdownRow sub label={t("outstationAllowance")} value={money(Number(selectedReport.breakdown.outstation_allowance))} />
                      )}
                      {Number(selectedReport.breakdown.accommodation) > 0 && (
                        <BreakdownRow sub label={t("accommodation")} value={money(Number(selectedReport.breakdown.accommodation))} />
                      )}
                      <tr className="bg-subtle">
                        <td className="px-4 py-3 text-start font-semibold text-fg">{t("totalTripCost")}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-end font-semibold text-fg tabular-nums">{money(Number(selectedReport.total_cost))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedReport.breakdown && (selectedReport.breakdown.expense_toll_image_url || selectedReport.breakdown.expense_parking_image_url) && (
              <div>
                <h4 className={SECTION_TITLE}>{t("expenseReceipts")}</h4>
                <div className="grid grid-cols-2 gap-4">
                  {selectedReport.breakdown.expense_toll_image_url && (
                    <ReceiptLink href={selectedReport.breakdown.expense_toll_image_url} label={t("tollReceipt")} />
                  )}
                  {selectedReport.breakdown.expense_parking_image_url && (
                    <ReceiptLink href={selectedReport.breakdown.expense_parking_image_url} label={t("parkingReceipt")} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
