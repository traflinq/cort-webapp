"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { formatDateTime } from "@/app/lib/utils";
import { useAppSelector } from "../../../lib/store/hooks";
import { selectCompany } from "../../../lib/store/slices/companySlice";
import { ChauffeurReport, apiClient } from "../../../lib/services/api-client";
import { Card } from "../../components/DashboardComponents";
import { PageHeader, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../../components/PageLayout";
import Modal from "../../bookings/components/Modal";
import TablePageSkeleton from "../../components/TablePageSkeleton";
import TableSkeleton from "@/app/components/ui/TableSkeleton";
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

export default function ChauffeurReportsPage() {
  const t = useTranslations("company.reports");
  const tCommon = useTranslations("common");
  const tAudit = useTranslations("company.reports.vendorAudit");
  const company = useAppSelector(selectCompany);

  const [reports, setReports] = useState<ChauffeurReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ChauffeurReport | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

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

  if (!company) {
    // If company is loading, shell might cover it, or we can show skeleton.
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-[var(--text-muted)]">{tCommon("errors.noCompanySelected")}</div>
      </div>
    );
  }

  if (!company.services_enabled?.chauffeur_enabled) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md text-center flex flex-col items-center justify-center py-12">
          <div className="text-lg font-bold text-[var(--text-primary)]">{t("chauffeurDisabled")}</div>
          <div className="mt-2 text-sm text-[var(--text-muted)]">{t("chauffeurDisabledDescription")}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      <PageHeader
        label={t("chauffeurLabel")}
        title={t("chauffeurTitle")}
        action={
          <>
            <div className="flex items-center gap-2 bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border-strong)] backdrop-blur-sm">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 rounded-lg border-0 bg-transparent px-3 text-sm text-[var(--text-primary)] focus:ring-0" placeholder={t("startDate")} />
              <span className="text-[var(--text-muted)]">/</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 rounded-lg border-0 bg-transparent px-3 text-sm text-[var(--text-primary)] focus:ring-0" placeholder={t("endDate")} />
            </div>
            <button type="button" className="group relative flex items-center gap-2 rounded-xl bg-[var(--cort-orange)] px-5 py-2.5 text-sm font-bold text-[var(--text-primary)] transition-all hover:bg-[var(--cort-orange-hover)] hover:-translate-y-0.5 shadow-lg active:translate-y-0 active:shadow-md" onClick={() => exportChauffeurCSV(reports, company?.name ?? "Company", startDate, endDate)}>
              <svg className="w-4 h-4 text-[var(--text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {t("exportCsv")}
            </button>
          </>
        }
      />

      <Card className={`min-h-[500px] ${TABLE_CARD_CLASS}`}>
        <div className={TABLE_TOP_BAR_CLASS}>
          <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">{t("chauffeurTableDescription")}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-start">
            <thead>
              <tr className="border-b border-[var(--border-light)]">
                <th className={TABLE_HEADER_CELL_CLASS}>{t("date")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("city")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("bookingId")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("passenger")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("vehicle")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("route")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("durMin")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("distKm")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("svcChg")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("fuel")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("extras")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("totalPkr")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{tAudit("column")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]/50">
              {isLoading && reports.length === 0 ? (
                <TableSkeleton columns={13} rows={8} />
              ) : reports.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
                      <span className="bg-[var(--surface-subtle)] p-4 rounded-full mb-3">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </span>
                      <span>{t("noReports")}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="group transition-colors border-b border-transparent hover:bg-[var(--surface-subtle)]/80 cursor-pointer"
                  >
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-[var(--text-primary)] font-medium font-mono text-xs`}>
                      {report.completed_at ? formatDateTime(report.completed_at) : "-"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-[var(--text-primary)] font-medium text-xs`}>
                      {report.city || "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} font-bold text-[var(--text-primary)]`}>
                      #{report.id}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="font-bold text-[var(--text-primary)] text-sm">
                        {report.passenger?.full_name || t("guest")}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {report.passenger?.employee_id || "-"}
                      </div>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="text-[var(--text-primary)] font-medium">{report.vehicle?.make} {report.vehicle?.model}</div>
                      <div className="text-xs text-[var(--text-muted)] font-mono">
                        {report.vehicle?.plate_number}
                      </div>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} max-w-xs`}>
                      <div title={report.route.pickup} className="truncate text-[var(--text-primary)] font-medium text-xs">
                        <span className="text-emerald-500 font-bold me-1">A</span> {report.route.pickup || "-"}
                      </div>
                      <div title={report.route.dropoff} className="truncate text-[var(--text-muted)] text-xs mt-0.5">
                        <span className="text-rose-500 font-bold me-1">B</span> {report.route.dropoff || "-"}
                      </div>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end text-[var(--text-primary)] font-mono text-xs`}>
                      {report.total_duration_minutes}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end text-[var(--text-primary)] font-mono text-xs`}>
                      {report.total_distance_km}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end text-[var(--text-muted)] text-xs`}>
                      {report.breakdown ? Number(report.breakdown.service_charge).toLocaleString() : "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end text-[var(--text-muted)] text-xs`}>
                      {report.breakdown ? Number(report.breakdown.fuel_cost).toLocaleString() : "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end text-[var(--text-muted)] text-xs`}>
                      {report.breakdown
                        ? (
                            Number(report.breakdown.toll) +
                            Number(report.breakdown.parking) +
                            Number(report.breakdown.accommodation) +
                            Number(report.breakdown.outstation_allowance)
                          ).toLocaleString()
                        : "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end font-bold text-[var(--text-primary)]`}>
                      {report.total_cost != null ? Number(report.total_cost).toLocaleString() : "—"}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      {isVendorTrip(report) ? (
                        <div className="flex flex-col items-start gap-1">
                          <VendorAuditBadge audit={report.vendor_audit} />
                          {report.vendor_audit?.vendor?.name && (
                            <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[10rem]">{report.vendor_audit.vendor.name}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">—</span>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--surface-subtle)] p-4 rounded-xl border border-[var(--border-light)]">
                <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t("passenger")}</h4>
                <div className="font-bold text-[var(--text-primary)]">{selectedReport.passenger?.full_name || t("guest")}</div>
                <div className="text-sm text-[var(--text-muted)] font-mono mt-1">{selectedReport.passenger?.employee_id || "N/A"}</div>

              </div>
              <div className="bg-[var(--surface-subtle)] p-4 rounded-xl border border-[var(--border-light)]">
                <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t("vehicleAndDriver")}</h4>
                <div className="font-bold text-[var(--text-primary)]">{selectedReport.vehicle?.make} {selectedReport.vehicle?.model}</div>
                <div className="text-sm text-[var(--text-muted)] font-mono mt-1">{selectedReport.vehicle?.plate_number}</div>
                <div className="text-sm text-[var(--text-muted)] mt-1">{t("driver")}: {selectedReport.driver?.full_name || t("assignedDriver")}</div>
              </div>
            </div>

            <div className="bg-[var(--surface-subtle)] p-4 rounded-xl border border-[var(--border-light)]">
              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">{t("routeJourney")}</h4>
              <div className="flex flex-col gap-3 relative">
                <div className="absolute start-[11px] top-2 bottom-2 w-0.5 bg-[var(--border-light)]"></div>
                <div className="flex gap-3 items-start relative z-10">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0 ring-4 ring-white">A</div>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{selectedReport.route.pickup}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">{t("pickupLocation")}</div>
                  </div>
                </div>
                <div className="flex gap-3 items-start relative z-10">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold shrink-0 ring-4 ring-white">B</div>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{selectedReport.route.dropoff}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">{t("dropoffLocation")}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[var(--border-light)]">
                <div>
                  <span className="text-xs text-[var(--text-muted)]">{t("duration")}:</span>
                  <span className="ms-2 text-sm font-bold text-[var(--text-primary)]">{t("mins", { count: selectedReport.total_duration_minutes })}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)]">{t("distance")}:</span>
                  <span className="ms-2 text-sm font-bold text-[var(--text-primary)]">{t("km", { count: selectedReport.total_distance_km })}</span>
                </div>
              </div>
            </div>

            {selectedReport.daily_logs && selectedReport.daily_logs.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--cort-orange)]"></span>
                  {t("tripBreakdown")}
                </h4>
                <div className="bg-white border border-[var(--border-light)] rounded-lg overflow-hidden shadow-sm">
                  <table className="min-w-full text-start text-xs">
                    <thead className="bg-[var(--surface-subtle)] font-bold text-[var(--text-muted)] uppercase tracking-tight">
                      <tr>
                        <th className="px-4 py-2.5 border-b border-[var(--border-light)]">{t("date")}</th>
                        <th className="px-4 py-2.5 border-b border-[var(--border-light)]">{t("tripType")}</th>
                        <th className="px-4 py-2.5 border-b border-[var(--border-light)] text-end">{t("hours")}</th>
                        <th className="px-4 py-2.5 border-b border-[var(--border-light)] text-end">{t("fullDay")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)]">
                      {[...selectedReport.daily_logs].sort((a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime()).map((log, idx) => (
                        <tr key={idx} className="hover:bg-[var(--surface-subtle)]/50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                            {new Date(log.log_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              weekday: 'short'
                            })}
                          </td>
                          <td className="px-4 py-2.5">
                            {log.trip_type === 'OUT_STATION' ? (
                              <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded text-[10px]">{t("outstation")}</span>
                            ) : (
                              <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded text-[10px]">{t("inCity")}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-end font-mono text-[var(--text-primary)]">
                            {log.hours_used ? parseFloat(log.hours_used.toString()).toFixed(1) : (log.is_full_day ? "24.0" : "0.0")}
                          </td>
                          <td className="px-4 py-2.5 text-end">
                            {log.is_full_day ? (
                              <span className="text-emerald-600 text-[10px] font-bold bg-emerald-50 px-2 py-0.5 rounded uppercase">{t("yes")}</span>
                            ) : (
                              <span className="text-[var(--text-muted)] text-[10px] font-bold bg-[var(--surface-subtle)] px-2 py-0.5 rounded uppercase">{t("no")}</span>
                            )}
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
              <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--cort-orange)]"></span>
                {t("costBreakdown")}
              </h4>
              <div className="bg-white border border-[var(--border-light)] rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-[var(--border-light)]">
                    <tr className="hover:bg-[var(--surface-subtle)]/50">
                      <td className="px-4 py-3 text-[var(--text-primary)]">{t("serviceChargeBase")}</td>
                      <td className="px-4 py-3 text-end font-medium text-[var(--text-primary)]">PKR {Number(selectedReport.breakdown.service_charge).toLocaleString()}</td>
                    </tr>
                    <tr className="hover:bg-[var(--surface-subtle)]/50">
                      <td className="px-4 py-3 text-[var(--text-primary)]">{t("fuelSurcharge")}</td>
                      <td className="px-4 py-3 text-end font-medium text-[var(--text-primary)]">PKR {Number(selectedReport.breakdown.fuel_cost).toLocaleString()}</td>
                    </tr>
                    {Number(selectedReport.breakdown.toll) > 0 && (
                      <tr className="bg-[var(--surface-subtle)]/30">
                        <td className="px-4 py-2 text-[var(--text-muted)] ps-8 text-xs">{t("tollCharges")}</td>
                        <td className="px-4 py-2 text-end text-[var(--text-primary)] text-xs">PKR {Number(selectedReport.breakdown.toll).toLocaleString()}</td>
                      </tr>
                    )}
                    {Number(selectedReport.breakdown.parking) > 0 && (
                      <tr className="bg-[var(--surface-subtle)]/30">
                        <td className="px-4 py-2 text-[var(--text-muted)] ps-8 text-xs">{t("parkingFees")}</td>
                        <td className="px-4 py-2 text-end text-[var(--text-primary)] text-xs">PKR {Number(selectedReport.breakdown.parking).toLocaleString()}</td>
                      </tr>
                    )}
                    {Number(selectedReport.breakdown.outstation_allowance) > 0 && (
                      <tr className="bg-[var(--surface-subtle)]/30">
                        <td className="px-4 py-2 text-[var(--text-muted)] ps-8 text-xs">{t("outstationAllowance")}</td>
                        <td className="px-4 py-2 text-end text-[var(--text-primary)] text-xs">PKR {Number(selectedReport.breakdown.outstation_allowance).toLocaleString()}</td>
                      </tr>
                    )}
                    {Number(selectedReport.breakdown.accommodation) > 0 && (
                      <tr className="bg-[var(--surface-subtle)]/30">
                        <td className="px-4 py-2 text-[var(--text-muted)] ps-8 text-xs">{t("accommodation")}</td>
                        <td className="px-4 py-2 text-end text-[var(--text-primary)] text-xs">PKR {Number(selectedReport.breakdown.accommodation).toLocaleString()}</td>
                      </tr>
                    )}
                    <tr className="bg-[var(--surface-subtle)] font-bold border-t border-[var(--border-light)]">
                      <td className="px-4 py-3 text-[var(--text-primary)]">{t("totalTripCost")}</td>
                      <td className="px-4 py-3 text-end text-[var(--cort-orange)]">PKR {Number(selectedReport.total_cost).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {selectedReport.breakdown && (selectedReport.breakdown.expense_toll_image_url || selectedReport.breakdown.expense_parking_image_url) && (
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--cort-orange)]"></span>
                  {t("expenseReceipts")}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {selectedReport.breakdown.expense_toll_image_url && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("tollReceipt")}</p>
                      <a
                        href={selectedReport.breakdown.expense_toll_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-[4/3] rounded-lg overflow-hidden border border-[var(--border-light)] hover:border-[var(--cort-orange)] transition-colors group relative"
                      >
                        <img
                          src={selectedReport.breakdown.expense_toll_image_url}
                          alt="Toll Receipt"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <svg className="w-6 h-6 text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                      </a>
                    </div>
                  )}
                  {selectedReport.breakdown.expense_parking_image_url && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("parkingReceipt")}</p>
                      <a
                        href={selectedReport.breakdown.expense_parking_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-[4/3] rounded-lg overflow-hidden border border-[var(--border-light)] hover:border-[var(--cort-orange)] transition-colors group relative"
                      >
                        <img
                          src={selectedReport.breakdown.expense_parking_image_url}
                          alt="Parking Receipt"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <svg className="w-6 h-6 text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                      </a>
                    </div>
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

