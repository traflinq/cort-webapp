"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { formatDateTime } from "@/app/lib/utils";
import { useAppSelector } from "../../../lib/store/hooks";
import { selectCompany } from "../../../lib/store/slices/companySlice";
import { ChauffeurReport, apiClient } from "../../../lib/services/api-client";
import { Card } from "../../components/DashboardComponents";
import { PageHeader, TableEmptyState, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../../components/PageLayout";
import Modal from "../../bookings/components/Modal";
import TablePageSkeleton from "../../components/TablePageSkeleton";
import { PillButton } from "../../ui";
import { CalendarDays, Download } from "lucide-react";
import TableSkeleton from "@/app/components/ui/TableSkeleton";

function escapeCSV(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportChauffeurCSV(reports: ChauffeurReport[], companyName: string, startDate: string, endDate: string) {
  const headers = [
    "Date", "City", "Booking ID", "Passenger", "Employee ID",
    "Vehicle", "Plate Number", "Driver",
    "Pickup", "Dropoff",
    "Duration (min)", "Distance (km)",
    "Service Charge (PKR)", "Fuel Cost (PKR)", "Toll (PKR)", "Parking (PKR)", "Accommodation (PKR)", "Outstation Allowance (PKR)", "Total (PKR)"
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
    Number(r.breakdown?.service_charge ?? 0),
    Number(r.breakdown?.fuel_cost ?? 0),
    Number(r.breakdown?.toll ?? 0),
    Number(r.breakdown?.parking ?? 0),
    Number(r.breakdown?.accommodation ?? 0),
    Number(r.breakdown?.outstation_allowance ?? 0),
    Number(r.total_cost ?? 0),
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
          <div className="text-lg font-medium text-[var(--text-primary)]">{t("chauffeurDisabled")}</div>
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
            <div className="flex h-12 items-center gap-1 rounded-full bg-[var(--bg-card)] ps-2 pe-3 shadow-[var(--shadow-card)]">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--tile-bg)] text-[var(--text-primary)]">
                <CalendarDays size={16} strokeWidth={1.6} />
              </span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-full border-0 bg-transparent px-2 text-sm text-[var(--text-primary)] outline-none focus:ring-0" placeholder={t("startDate")} />
              <span className="text-[var(--text-muted)]">/</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-full border-0 bg-transparent px-2 text-sm text-[var(--text-primary)] outline-none focus:ring-0" placeholder={t("endDate")} />
            </div>
            <PillButton variant="primary" icon={<Download strokeWidth={2} />} onClick={() => exportChauffeurCSV(reports, company?.name ?? "Company", startDate, endDate)}>
              {t("exportCsv")}
            </PillButton>
          </>
        }
      />

      <Card className={`min-h-[500px] ${TABLE_CARD_CLASS}`}>
        <div className={TABLE_TOP_BAR_CLASS}>
          <div className="text-[15px] text-[var(--text-secondary)]">{t("chauffeurTableDescription")}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-start">
            <thead>
              <tr className="border-b border-[var(--divider)]">
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4`}>{t("date")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4`}>{t("city")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4`}>{t("bookingId")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4`}>{t("passenger")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4`}>{t("vehicle")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4`}>{t("route")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4 text-end`}>{t("durMin")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4 text-end`}>{t("distKm")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4 text-end`}>{t("svcChg")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4 text-end`}>{t("fuel")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4 text-end`}>{t("extras")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} !px-4 text-end`}>{t("totalPkr")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {isLoading && reports.length === 0 ? (
                <TableSkeleton columns={12} rows={8} />
              ) : reports.length === 0 && !isLoading ? (
                <TableEmptyState illustration="chart" message={t("noReports")} />
              ) : (
                reports.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="group transition-colors border-b border-transparent hover:bg-[var(--row-hover)] cursor-pointer"
                  >
                    <td className={`${TABLE_CELL_CLASS} !px-4 whitespace-nowrap text-[var(--text-primary)] font-medium font-mono text-xs`}>
                      {report.completed_at ? formatDateTime(report.completed_at) : "-"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} !px-4 text-[var(--text-primary)] font-medium text-xs`}>
                      {report.city || "—"}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} !px-4 font-medium text-[var(--text-primary)]`}>
                      #{report.id}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} !px-4`}>
                      <div className="font-medium text-[var(--text-primary)] text-sm">
                        {report.passenger?.full_name || t("guest")}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {report.passenger?.employee_id || "-"}
                      </div>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} !px-4`}>
                      <div className="text-[var(--text-primary)] font-medium">{report.vehicle?.make} {report.vehicle?.model}</div>
                      <div className="text-xs text-[var(--text-muted)] font-mono">
                        {report.vehicle?.plate_number}
                      </div>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} !px-4 max-w-xs`}>
                      <div title={report.route.pickup} className="truncate text-[var(--text-primary)] font-medium text-xs">
                        <span className="text-[var(--tone-success-ink)] font-medium me-1">A</span> {report.route.pickup || "-"}
                      </div>
                      <div title={report.route.dropoff} className="truncate text-[var(--text-muted)] text-xs mt-0.5">
                        <span className="text-[var(--tone-danger-ink)] font-medium me-1">B</span> {report.route.dropoff || "-"}
                      </div>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} !px-4 text-end text-[var(--text-primary)] font-mono text-xs`}>
                      {report.total_duration_minutes}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} !px-4 text-end text-[var(--text-primary)] font-mono text-xs`}>
                      {report.total_distance_km}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} !px-4 text-end text-[var(--text-muted)] text-xs`}>
                      {Number(report.breakdown.service_charge).toLocaleString()}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} !px-4 text-end text-[var(--text-muted)] text-xs`}>
                      {Number(report.breakdown.fuel_cost).toLocaleString()}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} !px-4 text-end text-[var(--text-muted)] text-xs`}>
                      {(
                        Number(report.breakdown.toll) +
                        Number(report.breakdown.parking) +
                        Number(report.breakdown.accommodation) +
                        Number(report.breakdown.outstation_allowance)
                      ).toLocaleString()}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} !px-4 text-end font-medium text-[var(--text-primary)]`}>
                      {Number(report.total_cost).toLocaleString()}
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
              <div className="bg-[var(--tile-bg)] p-4 rounded-[var(--radius-tile)]">
                <h4 className="text-sm text-[var(--text-muted)] mb-2">{t("passenger")}</h4>
                <div className="font-medium text-[var(--text-primary)]">{selectedReport.passenger?.full_name || t("guest")}</div>
                <div className="text-sm text-[var(--text-muted)] font-mono mt-1">{selectedReport.passenger?.employee_id || "N/A"}</div>

              </div>
              <div className="bg-[var(--tile-bg)] p-4 rounded-[var(--radius-tile)]">
                <h4 className="text-sm text-[var(--text-muted)] mb-2">{t("vehicleAndDriver")}</h4>
                <div className="font-medium text-[var(--text-primary)]">{selectedReport.vehicle?.make} {selectedReport.vehicle?.model}</div>
                <div className="text-sm text-[var(--text-muted)] font-mono mt-1">{selectedReport.vehicle?.plate_number}</div>
                <div className="text-sm text-[var(--text-muted)] mt-1">{t("driver")}: {selectedReport.driver?.full_name || t("assignedDriver")}</div>
              </div>
            </div>

            <div className="bg-[var(--tile-bg)] p-4 rounded-[var(--radius-tile)]">
              <h4 className="text-sm text-[var(--text-muted)] mb-3">{t("routeJourney")}</h4>
              <div className="flex flex-col gap-3 relative">
                <div className="absolute start-[11px] top-2 bottom-2 w-0.5 bg-[var(--divider)]"></div>
                <div className="flex gap-3 items-start relative z-10">
                  <div className="w-6 h-6 rounded-full bg-[var(--tone-success-soft)] text-[var(--tone-success-ink)] flex items-center justify-center text-xs font-medium shrink-0 ring-4 ring-[var(--tile-bg)]">A</div>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{selectedReport.route.pickup}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">{t("pickupLocation")}</div>
                  </div>
                </div>
                <div className="flex gap-3 items-start relative z-10">
                  <div className="w-6 h-6 rounded-full bg-[var(--tone-danger-soft)] text-[var(--tone-danger-ink)] flex items-center justify-center text-xs font-medium shrink-0 ring-4 ring-[var(--tile-bg)]">B</div>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{selectedReport.route.dropoff}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">{t("dropoffLocation")}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[var(--divider)]">
                <div>
                  <span className="text-xs text-[var(--text-muted)]">{t("duration")}:</span>
                  <span className="ms-2 text-sm font-medium text-[var(--text-primary)]">{t("mins", { count: selectedReport.total_duration_minutes })}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)]">{t("distance")}:</span>
                  <span className="ms-2 text-sm font-medium text-[var(--text-primary)]">{t("km", { count: selectedReport.total_distance_km })}</span>
                </div>
              </div>
            </div>

            {selectedReport.daily_logs && selectedReport.daily_logs.length > 0 && (
              <div>
                <h4 className="text-base font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--cort-orange)]"></span>
                  {t("tripBreakdown")}
                </h4>
                <div className="bg-[var(--bg-card)] border border-[var(--divider)] rounded-[var(--radius-tile)] overflow-hidden">
                  <table className="min-w-full text-start text-xs">
                    <thead className="bg-[var(--tile-bg)] text-[var(--text-muted)]">
                      <tr>
                        <th className="px-4 py-2.5 border-b border-[var(--divider)]">{t("date")}</th>
                        <th className="px-4 py-2.5 border-b border-[var(--divider)]">{t("tripType")}</th>
                        <th className="px-4 py-2.5 border-b border-[var(--divider)] text-end">{t("hours")}</th>
                        <th className="px-4 py-2.5 border-b border-[var(--divider)] text-end">{t("fullDay")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--divider)]">
                      {[...selectedReport.daily_logs].sort((a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime()).map((log, idx) => (
                        <tr key={idx} className="hover:bg-[var(--row-hover)] transition-colors">
                          <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                            {new Date(log.log_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              weekday: 'short'
                            })}
                          </td>
                          <td className="px-4 py-2.5">
                            {log.trip_type === 'OUT_STATION' ? (
                              <span className="text-[var(--tone-warning-ink)] font-medium bg-[var(--tone-warning-soft)] px-2.5 py-0.5 rounded-full text-xs">{t("outstation")}</span>
                            ) : (
                              <span className="text-[var(--tone-info-ink)] font-medium bg-[var(--tone-info-soft)] px-2.5 py-0.5 rounded-full text-xs">{t("inCity")}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-end font-mono text-[var(--text-primary)]">
                            {log.hours_used ? parseFloat(log.hours_used.toString()).toFixed(1) : (log.is_full_day ? "24.0" : "0.0")}
                          </td>
                          <td className="px-4 py-2.5 text-end">
                            {log.is_full_day ? (
                              <span className="text-[var(--tone-success-ink)] text-xs font-medium bg-[var(--tone-success-soft)] px-2.5 py-0.5 rounded-full">{t("yes")}</span>
                            ) : (
                              <span className="text-[var(--text-muted)] text-xs font-medium bg-[var(--tile-bg)] px-2.5 py-0.5 rounded-full">{t("no")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cost Breakdown */}
            <div>
              <h4 className="text-base font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--cort-orange)]"></span>
                {t("costBreakdown")}
              </h4>
              <div className="bg-[var(--bg-card)] border border-[var(--divider)] rounded-[var(--radius-tile)] overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-[var(--divider)]">
                    <tr className="hover:bg-[var(--row-hover)]">
                      <td className="px-4 py-3 text-[var(--text-primary)]">{t("serviceChargeBase")}</td>
                      <td className="px-4 py-3 text-end font-medium text-[var(--text-primary)]">PKR {Number(selectedReport.breakdown.service_charge).toLocaleString()}</td>
                    </tr>
                    <tr className="hover:bg-[var(--row-hover)]">
                      <td className="px-4 py-3 text-[var(--text-primary)]">{t("fuelSurcharge")}</td>
                      <td className="px-4 py-3 text-end font-medium text-[var(--text-primary)]">PKR {Number(selectedReport.breakdown.fuel_cost).toLocaleString()}</td>
                    </tr>
                    {Number(selectedReport.breakdown.toll) > 0 && (
                      <tr className="bg-[var(--tile-bg)]">
                        <td className="px-4 py-2 text-[var(--text-muted)] ps-8 text-xs">{t("tollCharges")}</td>
                        <td className="px-4 py-2 text-end text-[var(--text-primary)] text-xs">PKR {Number(selectedReport.breakdown.toll).toLocaleString()}</td>
                      </tr>
                    )}
                    {Number(selectedReport.breakdown.parking) > 0 && (
                      <tr className="bg-[var(--tile-bg)]">
                        <td className="px-4 py-2 text-[var(--text-muted)] ps-8 text-xs">{t("parkingFees")}</td>
                        <td className="px-4 py-2 text-end text-[var(--text-primary)] text-xs">PKR {Number(selectedReport.breakdown.parking).toLocaleString()}</td>
                      </tr>
                    )}
                    {Number(selectedReport.breakdown.outstation_allowance) > 0 && (
                      <tr className="bg-[var(--tile-bg)]">
                        <td className="px-4 py-2 text-[var(--text-muted)] ps-8 text-xs">{t("outstationAllowance")}</td>
                        <td className="px-4 py-2 text-end text-[var(--text-primary)] text-xs">PKR {Number(selectedReport.breakdown.outstation_allowance).toLocaleString()}</td>
                      </tr>
                    )}
                    {Number(selectedReport.breakdown.accommodation) > 0 && (
                      <tr className="bg-[var(--tile-bg)]">
                        <td className="px-4 py-2 text-[var(--text-muted)] ps-8 text-xs">{t("accommodation")}</td>
                        <td className="px-4 py-2 text-end text-[var(--text-primary)] text-xs">PKR {Number(selectedReport.breakdown.accommodation).toLocaleString()}</td>
                      </tr>
                    )}
                    <tr className="bg-[var(--tile-bg)] font-medium border-t border-[var(--divider)]">
                      <td className="px-4 py-3 text-[var(--text-primary)]">{t("totalTripCost")}</td>
                      <td className="px-4 py-3 text-end text-[var(--cort-orange)]">PKR {Number(selectedReport.total_cost).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {(selectedReport.breakdown.expense_toll_image_url || selectedReport.breakdown.expense_parking_image_url) && (
              <div>
                <h4 className="text-base font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--cort-orange)]"></span>
                  {t("expenseReceipts")}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {selectedReport.breakdown.expense_toll_image_url && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[var(--text-muted)]">{t("tollReceipt")}</p>
                      <a
                        href={selectedReport.breakdown.expense_toll_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-[4/3] rounded-[var(--radius-tile)] overflow-hidden border border-[var(--divider)] hover:border-[var(--cort-orange)] transition-colors group relative"
                      >
                        <img
                          src={selectedReport.breakdown.expense_toll_image_url}
                          alt="Toll Receipt"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--bg-overlay)] transition-colors flex items-center justify-center">
                          <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                      </a>
                    </div>
                  )}
                  {selectedReport.breakdown.expense_parking_image_url && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[var(--text-muted)]">{t("parkingReceipt")}</p>
                      <a
                        href={selectedReport.breakdown.expense_parking_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-[4/3] rounded-[var(--radius-tile)] overflow-hidden border border-[var(--divider)] hover:border-[var(--cort-orange)] transition-colors group relative"
                      >
                        <img
                          src={selectedReport.breakdown.expense_parking_image_url}
                          alt="Parking Receipt"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--bg-overlay)] transition-colors flex items-center justify-center">
                          <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

