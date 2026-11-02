"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, ChevronDown, Download } from "lucide-react";
import { pillClasses } from "../../ui";
import { useAppSelector } from "../../../lib/store/hooks";
import { selectCompany } from "../../../lib/store/slices/companySlice";
import { ShuttleReport, apiClient } from "../../../lib/services/api-client";
import { Card } from "../../components/DashboardComponents";
import {
  PageHeader,
  TableEmptyState,
  TABLE_CARD_CLASS,
  TABLE_TOP_BAR_CLASS,
  TABLE_HEADER_CELL_CLASS,
  TABLE_CELL_CLASS,
} from "../../components/PageLayout";
import Modal from "../../bookings/components/Modal";
import TableSkeleton from "@/app/components/ui/TableSkeleton";

type ExportFormat = "csv" | "pdf";

function DirectionBadge({ direction }: { direction: string }) {
  const isEvening = direction === "EVENING";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
 isEvening
 ? "bg-[var(--tone-info-soft)] text-[var(--tone-info-ink)]"
 : "bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)]"
 }`}
    >
      {isEvening ? "🌙" : "☀️"} {direction}
    </span>
  );
}

interface PaginationMeta {
  page: number;
  pages: number;
  total: number;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTimeOnly(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function escapeCSV(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const SHUTTLE_EXPORT_HEADERS = [
  "Trip Date", "Direction", "Trip ID", "Route",
  "Vehicle", "Plate Number", "Driver",
  "Boarded", "Absent", "Total Assigned", "Started At", "Completed At",
];

function formatExportDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatExportDateTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const BOARDING_LOG_HEADERS = [
  "Trip Date", "Direction", "Trip ID", "Route",
  "Passenger", "Employee ID", "Department",
  "Status", "Boarded At", "Drop-off At",
];

function buildShuttleExportRows(reports: ShuttleReport[]) {
  return reports.map((r) => [
    formatExportDate(r.trip_date),
    r.direction || "",
    String(r.id),
    r.route?.name || "",
    `${r.vehicle?.make || ""} ${r.vehicle?.model || ""}`.trim(),
    r.vehicle?.plate_number || "",
    r.driver?.full_name || "",
    String(r.passengers?.boarded ?? 0),
    String(r.passengers?.absent ?? 0),
    String(r.passengers?.total ?? 0),
    formatExportDateTime(r.started_at),
    formatExportDateTime(r.completed_at),
  ]);
}

function buildBoardingLogRows(reports: ShuttleReport[]) {
  return reports.flatMap((r) =>
    (r.passengers?.details ?? []).map((log) => [
      formatExportDate(r.trip_date),
      r.direction || "",
      String(r.id),
      r.route?.name || "",
      log.employee?.full_name || "Unknown",
      log.employee?.employee_id || "",
      log.employee?.department || "",
      log.status || "",
      formatExportDateTime(log.scanned_at),
      formatExportDateTime(log.drop_off_at),
    ]),
  );
}

function shuttleExportBasename(startDate: string, endDate: string, routeName?: string) {
  const dateLabel = startDate && endDate ? `_${startDate}_to_${endDate}` : startDate ? `_from_${startDate}` : "";
  const routeLabel = routeName
    ? `_${routeName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40)}`
    : "";
  return `cort_shuttle_report${routeLabel}${dateLabel}`;
}

function parseShuttleReportsResponse(res: unknown, fallbackPage: number) {
  const raw = (res as { data?: unknown })?.data ?? res;
  const payload = raw as { data?: ShuttleReport[]; pagination?: PaginationMeta };
  const list = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(raw)
      ? (raw as ShuttleReport[])
      : [];
  const meta: Partial<PaginationMeta> = payload?.pagination ?? {};
  return {
    list,
    pagination: {
      page: meta.page ?? fallbackPage,
      pages: meta.pages ?? 1,
      total: meta.total ?? list.length,
    },
  };
}

function exportShuttleCSV(
  reports: ShuttleReport[],
  companyName: string,
  startDate: string,
  endDate: string,
  routeName?: string,
) {
  const rows = buildShuttleExportRows(reports);
  const boardingRows = buildBoardingLogRows(reports);
  const totalBoarded = reports.reduce((s, r) => s + (r.passengers?.boarded ?? 0), 0);

  const csvContent = [
    `# CORT - Shuttle Report`,
    `# Company: ${companyName}`,
    `# Route: ${routeName || "All"}`,
    `# Period: ${startDate || "All"} to ${endDate || "All"}`,
    `# Generated: ${new Date().toLocaleString("en-PK")}`,
    `# Total Trips: ${reports.length}`,
    `# Total Passengers Boarded: ${totalBoarded}`,
    `# Boarding Log Rows: ${boardingRows.length}`,
    "",
    "# Trips",
    SHUTTLE_EXPORT_HEADERS.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
    "",
    "# Boarding Logs",
    BOARDING_LOG_HEADERS.map(escapeCSV).join(","),
    ...boardingRows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${shuttleExportBasename(startDate, endDate, routeName)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportShuttlePDF(
  reports: ShuttleReport[],
  companyName: string,
  startDate: string,
  endDate: string,
  routeName?: string,
) {
  const jspdfMod = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  const jsPDF = jspdfMod.jsPDF ?? (jspdfMod as { default: typeof jspdfMod.jsPDF }).default;
  const autoTable = autoTableMod.default ?? autoTableMod.autoTable;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  const totalBoarded = reports.reduce((s, r) => s + (r.passengers?.boarded ?? 0), 0);

  doc.setFillColor(254, 133, 3);
  doc.rect(0, 0, pageWidth, 52, "F");
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Shuttle Report", margin, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(companyName, margin, 40);

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  doc.text(
    [
      `Route: ${routeName || "All"}`,
      `Period: ${startDate || "All"} to ${endDate || "All"}`,
      `Generated: ${new Date().toLocaleString("en-PK")}`,
      `Total trips: ${reports.length}`,
      `Passengers boarded: ${totalBoarded}`,
    ].join(" · "),
    margin,
    70,
  );

  autoTable(doc, {
    head: [SHUTTLE_EXPORT_HEADERS],
    body: buildShuttleExportRows(reports),
    startY: 82,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [254, 133, 3], textColor: [20, 20, 20], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 247, 244] },
    columnStyles: {
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
  });

  const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  const pageHeight = doc.internal.pageSize.getHeight();
  let boardingStartY = (lastTable?.finalY ?? 82) + 28;
  if (boardingStartY > pageHeight - 80) {
    doc.addPage();
    boardingStartY = 40;
  }
  const boardingRows = buildBoardingLogRows(reports);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Boarding Logs", margin, boardingStartY);

  autoTable(doc, {
    head: [BOARDING_LOG_HEADERS],
    body: boardingRows.length > 0
      ? boardingRows
      : [[{ content: "No boarding logs for the selected filters", colSpan: BOARDING_LOG_HEADERS.length }]],
    startY: boardingStartY + 10,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [254, 133, 3], textColor: [20, 20, 20], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 247, 244] },
  });

  doc.save(`${shuttleExportBasename(startDate, endDate, routeName)}.pdf`);
}

export default function ShuttleReportsPage() {
  const t = useTranslations("company.reports");
  const tCommon = useTranslations("common");
  const company = useAppSelector(selectCompany);

  const [reports, setReports] = useState<ShuttleReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pages: 1, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReport, setSelectedReport] = useState<ShuttleReport | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [routeId, setRouteId] = useState<string>("");
  const [routes, setRoutes] = useState<Array<{ id: number; name: string }>>([]);

  const selectedRouteId = routeId ? Number(routeId) : undefined;
  const selectedRouteName = routes.find((route) => String(route.id) === routeId)?.name;

  useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;
    apiClient
      .request(`/routes?company_id=${company.id}`)
      .then((res) => {
        if (cancelled) return;
        const raw = (res as { data?: unknown })?.data ?? res;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
        setRoutes(
          list
            .map((item) => {
              const route = item as { id?: number; name?: string };
              return route.id && route.name ? { id: route.id, name: route.name } : null;
            })
            .filter((route): route is { id: number; name: string } => route != null)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => {
        if (!cancelled) setRoutes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [company?.id]);

  const fetchReports = useCallback(async (page: number, start: string, end: string, selectedRoute?: number) => {
    if (!company?.id) return;
    setIsLoading(true);
    try {
      const res = await apiClient.getShuttleReports(company.id, {
        startDate: start || undefined,
        endDate: end || undefined,
        routeId: selectedRoute,
        page,
      });
      const parsed = parseShuttleReportsResponse(res, page);
      setReports(parsed.list);
      setPagination(parsed.pagination);
    } catch (e) {
      console.error("Failed to fetch shuttle reports", e);
    } finally {
      setIsLoading(false);
    }
  }, [company?.id]);

  const handleExport = async (format: ExportFormat) => {
    if (!company?.id || isExporting) return;
    setExportMenuOpen(false);
    setIsExporting(true);
    try {
      const allReports: ShuttleReport[] = [];
      let page = 1;
      let pages = 1;
      const exportLimit = 100;

      do {
        const res = await apiClient.getShuttleReports(company.id, {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          routeId: selectedRouteId,
          page,
          limit: exportLimit,
        });
        const parsed = parseShuttleReportsResponse(res, page);
        allReports.push(...parsed.list);
        pages = parsed.pagination.pages || 1;
        page += 1;
      } while (page <= pages);

      if (format === "pdf") {
        await exportShuttlePDF(allReports, company.name ?? "Company", startDate, endDate, selectedRouteName);
      } else {
        exportShuttleCSV(allReports, company.name ?? "Company", startDate, endDate, selectedRouteName);
      }
    } catch (e) {
      console.error("Failed to export shuttle reports", e);
    } finally {
      setIsExporting(false);
    }
  };

  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchReports(1, startDate, endDate, selectedRouteId);
    }, 400);
    return () => clearTimeout(timer);
  }, [startDate, endDate, selectedRouteId, fetchReports]);

  // Page change
  useEffect(() => {
    fetchReports(currentPage, startDate, endDate, selectedRouteId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    if (!exportMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [exportMenuOpen]);

  if (!company) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-[var(--text-muted)]">{tCommon("errors.noCompanySelected")}</div>
      </div>
    );
  }

  if (!company.services_enabled?.shuttle_enabled) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md text-center flex flex-col items-center justify-center py-12">
          <div className="text-lg font-medium text-[var(--text-primary)]">
            {t("shuttleDisabled")}
          </div>
          <div className="mt-2 text-sm text-[var(--text-muted)]">
            {t("shuttleDisabledDescription")}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      <PageHeader
        label={t("shuttleLabel")}
        title={t("shuttleTitle")}
        action={
          <>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="h-12 max-w-[240px] rounded-full border-0 bg-[var(--bg-card)] ps-5 pe-4 text-[15px] text-[var(--text-primary)] shadow-[var(--shadow-card)] outline-none focus:ring-2 focus:ring-[var(--cort-orange)]/30"
              aria-label={t("route")}
            >
              <option value="">{t("allRoutes")}</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </select>
            <div className="flex h-12 items-center gap-1 rounded-full bg-[var(--bg-card)] ps-2 pe-3 shadow-[var(--shadow-card)]">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--tile-bg)] text-[var(--text-primary)]">
                <CalendarDays size={16} strokeWidth={1.6} />
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 rounded-full border-0 bg-transparent px-2 text-sm text-[var(--text-primary)] outline-none focus:ring-0"
                placeholder={t("startDate")}
              />
              <span className="text-[var(--text-muted)]">/</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 rounded-full border-0 bg-transparent px-2 text-sm text-[var(--text-primary)] outline-none focus:ring-0"
                placeholder={t("endDate")}
              />
            </div>
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                disabled={isExporting}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                className={pillClasses("primary", "md", true, "disabled:opacity-60")}
                onClick={() => setExportMenuOpen((open) => !open)}
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/25 text-white">
                  <Download size={16} strokeWidth={2} />
                </span>
                {isExporting ? t("exporting") : t("export")}
                <ChevronDown className={`w-4 h-4 transition-transform ${exportMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {exportMenuOpen && !isExporting && (
                <div
                  role="menu"
                  className="absolute end-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl bg-[var(--bg-elevated)] p-1.5 shadow-[var(--shadow-modal)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-xl px-3 py-2.5 text-start text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    onClick={() => handleExport("csv")}
                  >
                    {t("exportAsCsv")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-xl px-3 py-2.5 text-start text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    onClick={() => handleExport("pdf")}
                  >
                    {t("exportAsPdf")}
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      <Card className={`min-h-[500px] ${TABLE_CARD_CLASS}`}>
        <div className={TABLE_TOP_BAR_CLASS}>
          <div className="text-[15px] text-[var(--text-secondary)]">
            {t("shuttleTableDescription")}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-start">
            <thead>
              <tr className="border-b border-[var(--divider)]">
                <th className={TABLE_HEADER_CELL_CLASS}>{t("tripDate")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("direction")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("tripId")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("route")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("vehicle")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("driver")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("boarded")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("absent")}</th>
                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("assigned")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("startedAt")}</th>
                <th className={TABLE_HEADER_CELL_CLASS}>{t("completedAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {isLoading && reports.length === 0 ? (
                <TableSkeleton columns={11} rows={8} />
              ) : reports.length === 0 && !isLoading ? (
                <TableEmptyState illustration="bus" message={t("noShuttleReports")} />
              ) : (
                reports.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="group transition-colors border-b border-transparent hover:bg-[var(--row-hover)] cursor-pointer"
                  >
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-[var(--text-primary)] font-medium font-mono text-xs`}>
                      {report.trip_date
                        ? new Date(report.trip_date).toLocaleDateString("en-PK", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <DirectionBadge direction={report.direction} />
                    </td>
                    <td className={`${TABLE_CELL_CLASS} font-medium text-[var(--text-primary)]`}>
                      #{report.id}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="font-semibold text-[var(--text-primary)] text-sm">
                        {report.route?.name || "—"}
                      </div>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      {report.vehicle ? (
                        <>
                          <div className="text-[var(--text-primary)] font-medium">
                            {report.vehicle.make} {report.vehicle.model}
                          </div>
                          <div className="text-xs text-[var(--text-muted)] font-mono">
                            {report.vehicle.plate_number}
                          </div>
                        </>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="text-[var(--text-primary)] font-medium text-sm">
                        {report.driver?.full_name || "—"}
                      </div>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end font-mono text-[var(--tone-success-ink)] font-semibold`}>
                      {report.passengers.boarded}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end font-mono text-[var(--tone-danger-ink)] font-semibold`}>
                      {report.passengers.absent}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end font-mono text-[var(--text-primary)]`}>
                      {report.passengers.total}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-xs text-[var(--text-muted)] font-mono`}>
                      {formatDateTime(report.started_at)}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-xs text-[var(--text-muted)] font-mono`}>
                      {formatDateTime(report.completed_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--divider)]">
            <div className="text-xs text-[var(--text-muted)]">
              {t("showingTrips", { shown: reports.length, total: pagination.total })}
            </div>
            <div className="flex gap-1">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`h-9 w-9 rounded-full text-sm tabular-nums transition-colors ${
 page === pagination.page
 ? "bg-[var(--cort-navy)] text-white"
 : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
 }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Trip Detail Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={selectedReport ? t("shuttleTrip", { id: selectedReport.id }) : t("tripDetails")}
      >
        {selectedReport && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">{t("date")}</div>
                <div className="font-semibold text-[var(--text-primary)]">
                  {selectedReport.trip_date
                    ? new Date(selectedReport.trip_date).toLocaleDateString("en-PK", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">{t("direction")}</div>
                <DirectionBadge direction={selectedReport.direction} />
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">{t("route")}</div>
                <div className="font-semibold text-[var(--text-primary)]">
                  {selectedReport.route?.name || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">{t("driver")}</div>
                <div className="font-semibold text-[var(--text-primary)]">
                  {selectedReport.driver?.full_name || "—"}
                </div>
              </div>
              {selectedReport.vehicle && (
                <div className="col-span-2">
                  <div className="text-xs text-[var(--text-muted)] mb-1">{t("vehicle")}</div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {selectedReport.vehicle.make} {selectedReport.vehicle.model}{" "}
                    <span className="font-mono text-xs text-[var(--text-muted)]">
                      ({selectedReport.vehicle.plate_number})
                    </span>
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">{t("startedAt")}</div>
                <div className="font-semibold text-[var(--text-primary)] font-mono text-sm">
                  {formatDateTime(selectedReport.started_at)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">{t("completedAt")}</div>
                <div className="font-semibold text-[var(--text-primary)] font-mono text-sm">
                  {formatDateTime(selectedReport.completed_at)}
                </div>
              </div>
            </div>

            {/* Boarding Summary */}
            <div>
              <div className="text-sm text-[var(--text-muted)] mb-3">
                {t("boardingSummary")}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[var(--radius-tile)] bg-[var(--tile-bg)] px-4 py-3 text-center">
                  <div className="text-2xl font-medium text-[var(--text-primary)]">
                    {selectedReport.passengers.total}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t("assigned")}</div>
                </div>
                <div className="rounded-[var(--radius-tile)] bg-[var(--tone-success-soft)] px-4 py-3 text-center">
                  <div className="text-2xl font-medium text-[var(--tone-success-ink)]">
                    {selectedReport.passengers.boarded}
                  </div>
                  <div className="text-xs text-[var(--tone-success-ink)] mt-1">{t("boarded")}</div>
                </div>
                <div className="rounded-[var(--radius-tile)] bg-[var(--tone-danger-soft)] px-4 py-3 text-center">
                  <div className="text-2xl font-medium text-[var(--tone-danger-ink)]">
                    {selectedReport.passengers.absent}
                  </div>
                  <div className="text-xs text-[var(--tone-danger-ink)] mt-1">{t("absent")}</div>
                </div>
              </div>
            </div>

            {selectedReport.passengers.details.length > 0 && (
              <div>
                <div className="text-sm text-[var(--text-muted)] mb-2">
                  {t("passengerDetails")}
                </div>
                <div className="max-h-72 overflow-y-auto rounded-[var(--radius-tile)] border border-[var(--divider)] divide-y divide-[var(--divider)]">
                  {selectedReport.passengers.details.map((log, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-[var(--text-primary)]">
                          {log.employee?.full_name || tCommon("status.unknown")}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {log.employee?.department || ""}{" "}
                          {log.employee?.employee_id
                            ? `· ID: ${log.employee.employee_id}`
                            : ""}
                        </div>
                        {(log.status === "BOARDED" || log.status === "DROPPED_OFF") && log.scanned_at && (
                          <div className="text-xs text-[var(--tone-success-ink)] mt-0.5 font-mono">
                            {t("boardedAt")} {formatTimeOnly(log.scanned_at)}
                          </div>
                        )}
                        {log.drop_off_at && (
                          <div className="text-xs text-[var(--tone-info-ink)] mt-0.5 font-mono">
                            {t("dropoffTime")} {formatTimeOnly(log.drop_off_at)}
                          </div>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
 log.status === "BOARDED"
 ? "bg-[var(--tone-success-soft)] text-[var(--tone-success-ink)]"
 : log.status === "DROPPED_OFF"
 ? "bg-[var(--tone-info-soft)] text-[var(--tone-info-ink)]"
 : "bg-[var(--tone-danger-soft)] text-[var(--tone-danger-ink)]"
 }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-sm text-[var(--text-muted)] mb-2">
                {t("stopLogs")}
              </div>
              <div className="rounded-[var(--radius-tile)] border border-[var(--divider)] overflow-hidden">
                {selectedReport.route?.stops && selectedReport.route.stops.length > 0 ? (
                  <div className="divide-y divide-[var(--divider)]">
                    {selectedReport.route.stops.map((stop, index) => {
                      const log = selectedReport.stop_logs?.find((item) => item.stop_id === stop.id);
                      const isEvening = selectedReport.direction === "EVENING";
                      const isLastStop =
                        index === (selectedReport.route?.stops?.length ?? 0) - 1;
                      const isFinalMorningStop = !isEvening && isLastStop;
                      const arrivedAt = isFinalMorningStop
                        ? formatDateTime(
                            selectedReport.completed_at ?? log?.arrived_at ?? null,
                          )
                        : formatDateTime(log?.arrived_at ?? null);
                      const boardedAt = formatDateTime(log?.boarded_at ?? null);
                      const isFirstEveningStop = isEvening && index === 0;
                      const dropOffAt = isFirstEveningStop
                        ? formatDateTime(selectedReport.started_at)
                        : formatDateTime(log?.drop_off_at ?? null);

                      return (
                        <div
                          key={stop.id}
                          className="grid grid-cols-[auto,1fr,auto] items-start gap-3 px-4 py-3"
                        >
                          <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--tile-bg)] px-2 text-xs font-semibold text-[var(--text-primary)]">
                            {stop.sequence ?? "—"}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">
                              {stop.name}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {isEvening
                                ? t("dropoffFromLogs")
                                : isFinalMorningStop
                                  ? t("tripCompletionTime")
                                  : t("arrivalFromLogs")}
                            </div>
                          </div>
                          <div className="text-end text-sm font-mono text-[var(--text-primary)]">
                            {isEvening ? (
                              <div>
                                <div className="text-xs text-[var(--text-muted)]">
                                  {isFirstEveningStop ? t("tripStartedAt") : t("dropoffTime")}
                                </div>
                                <div>{dropOffAt}</div>
                              </div>
                            ) : isFinalMorningStop ? (
                              <div>
                                <div className="text-xs text-[var(--text-muted)]">{t("arrivedAt")}</div>
                                <div>{arrivedAt}</div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div>
                                  <div className="text-xs text-[var(--text-muted)]">{t("arrivedAt")}</div>
                                  <div>{arrivedAt}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-[var(--text-muted)]">{t("boardedAt")}</div>
                                  <div>{boardedAt}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-sm text-[var(--text-muted)]">
                    {t("noStopLogs")}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
