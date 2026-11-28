"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Download, ExternalLink, FileBarChart } from "@/app/components/icons";
import { Badge, Button, Input, TableSkeletonRows, focusRingInset, focusRing } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { formatLocaleDate, formatLocaleNumber } from "@/app/lib/i18n/format";
import { useCompanyAccess } from "../../lib/access-context";
import { useCompanyLocale } from "../../lib/locale-context";
import { ChauffeurReport, apiClient } from "../../../lib/services/api-client";
import { Card } from "../../components/Card";
import { PageHeader, TableEmptyState, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../../components/PageLayout";
import { COMPANY_PAGE_SIZE, TablePagination } from "../../components/TablePagination";
import Modal from "../../bookings/components/Modal";
import { VendorAuditBadge, VendorAuditPanel } from "./VendorAuditPanel";
import { DetailRow, DetailRows, DetailSection, DetailSections, FactRow, Ledger, NotRecorded, RouteSteps, useDurationFormat } from "../../components/DetailView";

const isVendorTrip = (r: ChauffeurReport) => r.fulfillment_type === "EXTERNAL_VENDOR";

/** The reports endpoint answers `{ data, pagination }`, sometimes wrapped once more in `data`. */
function parseChauffeurReportsResponse(res: unknown, fallbackPage: number) {
  const raw = (res as { data?: unknown })?.data ?? res;
  const payload = raw as { data?: ChauffeurReport[]; pagination?: { page?: number; pages?: number; total?: number } };
  const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(raw) ? (raw as ChauffeurReport[]) : [];
  const meta = payload?.pagination ?? {};
  return {
    list,
    pagination: { page: meta.page ?? fallbackPage, pages: meta.pages ?? 1, total: meta.total ?? list.length },
  };
}

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


function ReceiptLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("group flex flex-col gap-1.5 rounded-lg", focusRing)}
    >
      <span className="relative block aspect-[4/3] overflow-hidden rounded-lg border border-line transition-colors group-hover:border-line-strong">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt={label} className="h-full w-full object-cover" />
      </span>
      <span className="flex items-center gap-1 text-xs text-fg-secondary group-hover:text-fg">
        {label}
        <ExternalLink className="size-3 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
      </span>
    </a>
  );
}


export default function ChauffeurReportsPage() {
  const t = useTranslations("company.reports");
  const tAudit = useTranslations("company.reports.vendorAudit");
  const tCommon = useTranslations("common");
  const tDetail = useTranslations("company.detail");
  const tFulfillment = useTranslations("common.fulfillment");
  const duration = useDurationFormat();
  const { company } = useCompanyAccess();
  const { locale } = useCompanyLocale();

  const [reports, setReports] = useState<ChauffeurReport[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [selectedReport, setSelectedReport] = useState<ChauffeurReport | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  /** Whole numbers in the company locale (table columns carry the PKR unit in the header). */
  const num = (v: number) => formatLocaleNumber(v, locale, { maximumFractionDigits: 0 });
  /** Decimal-friendly figures (hours, km). */
  const dec = (v: number, dp = 1) => formatLocaleNumber(v, locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  /** Full PKR amount, e.g. "PKR 1,240,500". */
  const money = (v: number) => `${tCommon("currency.pkr")} ${formatLocaleNumber(v, locale, { maximumFractionDigits: 2 })}`;
  const fulfillmentLabel = (type: ChauffeurReport["fulfillment_type"]) =>
    type === "EXTERNAL_VENDOR" ? tFulfillment("vendorManaged") : type === "SELF_MANAGED" ? tFulfillment("ownPoolCars") : tFulfillment("cortManaged");
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

  // Dates the table is showing: the inputs settle into this after a short pause, and the page
  // goes back to 1 in the same step, so one change means one request.
  const [applied, setApplied] = useState({ startDate: "", endDate: "" });
  useEffect(() => {
    if (applied.startDate === startDate && applied.endDate === endDate) return;
    const timer = setTimeout(() => {
      setApplied({ startDate, endDate });
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [startDate, endDate, applied]);

  // The view on screen lags the one asked for while a request is out: that gap is "loading".
  const requestKey = JSON.stringify([company?.id, currentPage, applied]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const isLoading = !!company?.id && loadedKey !== requestKey;
  useEffect(() => {
    if (!company?.id) return;
    // Cleared when the page or dates move on, so a slower earlier response can't overwrite a newer one.
    let current = true;
    apiClient
      .getChauffeurReports(company.id, {
        startDate: applied.startDate || undefined,
        endDate: applied.endDate || undefined,
        page: currentPage,
        limit: COMPANY_PAGE_SIZE,
      })
      .then((res) => {
        if (!current) return;
        const parsed = parseChauffeurReportsResponse(res, currentPage);
        setReports(parsed.list);
        setPagination(parsed.pagination);
      })
      .catch((e) => {
        if (current) console.error("Failed to fetch chauffeur reports", e);
      })
      .finally(() => {
        if (current) setLoadedKey(requestKey);
      });
    return () => {
      current = false;
    };
  }, [company?.id, currentPage, applied, requestKey]);

  /** The export covers every trip in the date range, not just the page on screen. */
  const handleExport = async () => {
    if (!company?.id || isExporting) return;
    setIsExporting(true);
    try {
      const all: ChauffeurReport[] = [];
      let page = 1;
      let pages = 1;
      do {
        const res = await apiClient.getChauffeurReports(company.id, {
          startDate: applied.startDate || undefined,
          endDate: applied.endDate || undefined,
          page,
          limit: 100,
        });
        const parsed = parseChauffeurReportsResponse(res, page);
        all.push(...parsed.list);
        pages = parsed.pagination.pages || 1;
        page += 1;
      } while (page <= pages);
      exportChauffeurCSV(all, company.name ?? "Company", applied.startDate, applied.endDate);
    } catch (e) {
      console.error("Failed to export chauffeur reports", e);
    } finally {
      setIsExporting(false);
    }
  };

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
              loading={isExporting}
              onClick={handleExport}
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
        <TablePagination
          page={currentPage}
          totalPages={pagination.pages}
          total={reports.length === 0 ? 0 : pagination.total}
          pageSize={COMPANY_PAGE_SIZE}
          onPageChange={setCurrentPage}
          summary={(range) => t("showingTrips", range)}
        />
      </Card>

      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={selectedReport ? t("tripTitle", { id: selectedReport.id }) : t("tripDetails")}
        titleAside={selectedReport ? <Badge tone="neutral">{fulfillmentLabel(selectedReport.fulfillment_type)}</Badge> : undefined}
        description={
          selectedReport
            ? [selectedReport.completed_at ? dateTime(selectedReport.completed_at) : null, selectedReport.city].filter(Boolean).join(" · ")
            : undefined
        }
      >
        {selectedReport && (() => {
          const r = selectedReport;
          const b = r.breakdown;
          const n = (v: unknown) => Number(v ?? 0) || 0;
          const isSelfManaged = r.fulfillment_type === "SELF_MANAGED";
          const distance = n(r.total_distance_km);
          const toll = n(b?.toll);
          const parking = n(b?.parking);
          const total = r.total_cost == null ? null : n(r.total_cost);

          // Billed trips: list the lines the total is made of, then whatever is left (sales tax / adjustments).
          const billedLines: { label: ReactNode; value: string; sub?: boolean }[] = [];
          if (b && !isSelfManaged) {
            billedLines.push({ label: t("serviceChargeBase"), value: money(n(b.service_charge)) });
            if (n(b.overtime) > 0) billedLines.push({ sub: true, label: t("includesOvertime"), value: money(n(b.overtime)) });
            if (n(b.outstation_allowance) > 0) billedLines.push({ sub: true, label: t("includesOutstationAllowance"), value: money(n(b.outstation_allowance)) });
            if (n(b.accommodation) > 0) billedLines.push({ sub: true, label: t("includesAccommodation"), value: money(n(b.accommodation)) });
            billedLines.push({ label: t("fuelSurcharge"), value: money(n(b.fuel_cost)) });
            if (toll > 0) billedLines.push({ label: t("tollCharges"), value: money(toll) });
            if (parking > 0) billedLines.push({ label: t("parkingFees"), value: money(parking) });
            const listed = n(b.service_charge) + n(b.fuel_cost) + toll + parking;
            if (total != null && Math.abs(total - listed) >= 1) {
              billedLines.push({ label: t("taxAndAdjustments"), value: money(total - listed) });
            }
          }
          const receipts = [
            b?.expense_toll_image_url ? { href: b.expense_toll_image_url, label: t("tollReceipt") } : null,
            b?.expense_parking_image_url ? { href: b.expense_parking_image_url, label: t("parkingReceipt") } : null,
          ].filter((x): x is { href: string; label: string } => !!x);
          const logs = [...(r.daily_logs ?? [])].sort((a, c) => new Date(a.log_date).getTime() - new Date(c.log_date).getTime());

          return (
            <DetailSections>
              <DetailSection>
                <FactRow
                  items={[
                    {
                      label: t("tripCost"),
                      value: isSelfManaged ? t("notBilled") : total != null ? money(total) : "—",
                    },
                    { label: t("duration"), value: duration(r.total_duration_minutes) ?? tDetail("notRecorded"), muted: r.total_duration_minutes == null },
                    {
                      label: t("distance"),
                      value: distance > 0 ? t("km", { count: dec(distance) }) : tDetail("notRecorded"),
                      muted: distance <= 0,
                    },
                  ]}
                />
              </DetailSection>

              <DetailSection title={t("route")}>
                <RouteSteps
                  steps={[
                    { label: tDetail("pickup"), place: r.route?.pickup || <NotRecorded /> },
                    { label: tDetail("dropoff"), place: r.route?.dropoff || <NotRecorded /> },
                  ]}
                />
              </DetailSection>

              <DetailSection>
                <DetailRows>
                  <DetailRow label={t("passenger")} hint={r.passenger?.employee_id || undefined}>
                    {r.passenger?.full_name || t("guest")}
                  </DetailRow>
                  <DetailRow label={t("driver")}>{r.driver?.full_name || <NotRecorded />}</DetailRow>
                  <DetailRow label={t("vehicle")} hint={r.vehicle?.plate_number ? <span className="ltr-content tabular-nums">{r.vehicle.plate_number}</span> : undefined}>
                    {[r.vehicle?.make, r.vehicle?.model].filter(Boolean).join(" ") || <NotRecorded />}
                  </DetailRow>
                </DetailRows>
              </DetailSection>

              {logs.length > 0 && (
                <DetailSection title={t("dailyLog")}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className="pb-2 text-start text-xs font-medium text-fg-muted">{t("date")}</th>
                        <th scope="col" className="pb-2 text-start text-xs font-medium text-fg-muted">{t("tripType")}</th>
                        <th scope="col" className="pb-2 text-end text-xs font-medium text-fg-muted">{t("timeUsed")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {logs.map((log, idx) => {
                        const hours = log.hours_used != null ? parseFloat(log.hours_used.toString()) : null;
                        return (
                          <tr key={idx}>
                            <td className="whitespace-nowrap py-2.5 pe-3 text-fg tabular-nums">
                              {formatLocaleDate(log.log_date, locale, { month: "short", day: "numeric", weekday: "short" })}
                            </td>
                            <td className="py-2.5 pe-3 text-fg-secondary">
                              {log.trip_type === "OUT_STATION" ? t("outstation") : t("inCity")}
                            </td>
                            <td className="whitespace-nowrap py-2.5 text-end text-fg tabular-nums">
                              {log.is_full_day ? (
                                <Badge tone="neutral">{t("fullDay")}</Badge>
                              ) : hours != null ? (
                                duration(hours * 60)
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </DetailSection>
              )}

              {isVendorTrip(r) && company?.id && (
                <DetailSection>
                  <VendorAuditPanel
                    key={r.id}
                    companyId={company.id}
                    report={r}
                    onAudited={(audit) => {
                      const charged = audit.status === "DONE" ? audit.vendor_charged_amount : null;
                      const patch = (x: ChauffeurReport) => (x.id === r.id ? { ...x, vendor_audit: audit, total_cost: charged } : x);
                      setReports((rows) => rows.map(patch));
                      setSelectedReport((x) => (x ? patch(x) : x));
                    }}
                  />
                </DetailSection>
              )}

              {/* Cost: billed trips (calculated amounts are not shown for vendor trips) */}
              {b && !isSelfManaged && (
                <DetailSection title={t("costBreakdown")}>
                  <Ledger lines={billedLines} total={total != null ? { label: t("totalTripCost"), value: money(total) } : undefined} />
                </DetailSection>
              )}

              {/* Pool-car trips are never billed: show only what the driver spent. */}
              {isSelfManaged && (
                <DetailSection title={t("driverExpenses")}>
                  <p className="text-sm text-fg-muted">{t("selfManagedNote")}</p>
                  {(toll > 0 || parking > 0) && (
                    <div className="mt-3">
                      <Ledger
                        lines={[
                          ...(toll > 0 ? [{ label: t("tollCharges"), value: money(toll) }] : []),
                          ...(parking > 0 ? [{ label: t("parkingFees"), value: money(parking) }] : []),
                        ]}
                        total={{ label: t("totalExpenses"), value: money(toll + parking) }}
                      />
                    </div>
                  )}
                </DetailSection>
              )}

              {receipts.length > 0 && (
                <DetailSection title={t("expenseReceipts")}>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {receipts.map((rc) => (
                      <ReceiptLink key={rc.href} href={rc.href} label={rc.label} />
                    ))}
                  </div>
                </DetailSection>
              )}
            </DetailSections>
          );
        })()}
      </Modal>
    </div>
  );
}
