"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Download, FileSpreadsheet, FileText, CalendarDays, Moon, Sun } from "lucide-react";
import { Badge, Button, Input, Select, StatusBadge, TableSkeletonRows, focusRing, focusRingInset, type StatusEntry } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { formatLocaleDate, formatLocaleTime } from "@/app/lib/i18n/format";
import type { Locale } from "@/i18n/config";
import { useCompanyAccess } from "../../lib/access-context";
import { useCompanyLocale } from "../../lib/locale-context";
import { ShuttleReport, apiClient } from "../../../lib/services/api-client";
import { Card } from "../../components/Card";
import {
  PageHeader,
  TableEmptyState,
  TABLE_CARD_CLASS,
  TABLE_TOP_BAR_CLASS,
  TABLE_HEADER_CELL_CLASS,
  TABLE_CELL_CLASS,
} from "../../components/PageLayout";
import Modal from "../../bookings/components/Modal";

type ExportFormat = "csv" | "pdf";

/** Direction is a category, not a status: neutral badge, icon plus translated text. */
function DirectionBadge({ direction }: { direction: string }) {
  const tRoutes = useTranslations("company.routes");
  const isEvening = direction === "EVENING";
  const isMorning = direction === "MORNING";
  return (
    <Badge tone="neutral" icon={isEvening ? <Moon aria-hidden="true" /> : isMorning ? <Sun aria-hidden="true" /> : undefined}>
      {isEvening ? tRoutes("evening") : isMorning ? tRoutes("morning") : direction}
    </Badge>
  );
}

/** Boarding-log statuses. Absent is flagged calmly (warning), not as a failure. */
const BOARDING_STATUS_TONES: Record<string, StatusEntry> = {
  BOARDED: { tone: "success" },
  DROPPED_OFF: { tone: "info" },
  ABSENT: { tone: "warning" },
};

interface PaginationMeta {
  page: number;
  pages: number;
  total: number;
}

function formatDateTime(value: string | null | undefined, locale: Locale) {
  if (!value) return "—";
  return formatLocaleDate(value, locale, {
    timeZone: "Asia/Karachi",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTimeOnly(value: string | null | undefined, locale: Locale) {
  if (!value) return "—";
  return formatLocaleTime(value, locale, {
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
    ].join("   ·   "),
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
  const { company } = useCompanyAccess();
  const { locale } = useCompanyLocale();

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

  // Deep link from analytics (?trip=ID&date=YYYY-MM-DD&route=ID): narrow the list to that day and
  // route, then open the trip's details once it has loaded.
  const pendingTrip = useRef<number | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const trip = Number(q.get("trip"));
    if (!Number.isInteger(trip) || trip <= 0) return;
    pendingTrip.current = trip;
    const date = q.get("date") ?? "";
    const route = q.get("route") ?? "";
    // Applied after mount (the URL is not known while the page renders on the server).
    const timer = setTimeout(() => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setStartDate(date);
        setEndDate(date);
      }
      if (/^\d+$/.test(route)) setRouteId(route);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (pendingTrip.current === null) return;
    const match = reports.find((r) => r.id === pendingTrip.current);
    if (!match) return;
    pendingTrip.current = null;
    setSelectedReport(match);
  }, [reports]);

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


  const tripDate = (value: string | null | undefined, month: "short" | "long") =>
    value ? formatLocaleDate(value, locale, { year: "numeric", month, day: "numeric" }) : "—";
  const menuItem = cn(
    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm text-fg transition-colors hover:bg-subtle [&_svg]:size-4 [&_svg]:text-fg-muted",
    focusRingInset,
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12">
      <PageHeader
        label={t("shuttleLabel")}
        title={t("shuttleTitle")}
        action={
          <>
            <Select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              width="auto"
              className="max-w-[220px]"
              aria-label={t("route")}
            >
              <option value="">{t("allRoutes")}</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </Select>
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
            <div className="relative" ref={exportMenuRef}>
              <Button
                type="button"
                loading={isExporting}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                leftIcon={<Download aria-hidden="true" />}
                rightIcon={<ChevronDown aria-hidden="true" className={cn("transition-transform", exportMenuOpen && "rotate-180")} />}
                onClick={() => setExportMenuOpen((open) => !open)}
              >
                {isExporting ? t("exporting") : t("export")}
              </Button>
              {exportMenuOpen && !isExporting && (
                <div
                  role="menu"
                  className="absolute end-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-popover p-1 shadow-[var(--shadow-modal)]"
                >
                  <button type="button" role="menuitem" className={menuItem} onClick={() => handleExport("csv")}>
                    <FileSpreadsheet aria-hidden="true" />
                    {t("exportAsCsv")}
                  </button>
                  <button type="button" role="menuitem" className={menuItem} onClick={() => handleExport("pdf")}>
                    <FileText aria-hidden="true" />
                    {t("exportAsPdf")}
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      <Card className={TABLE_CARD_CLASS}>
        <div className={TABLE_TOP_BAR_CLASS}>
          <p className="text-sm text-fg-secondary">{t("shuttleTableDescription")}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-start text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("tripDate")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("direction")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("tripId")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("route")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("vehicle")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("driver")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("boarded")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("absent")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("assigned")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("startedAt")}</th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("completedAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading && reports.length === 0 ? (
                <TableSkeletonRows columns={11} rows={8} />
              ) : reports.length === 0 && !isLoading ? (
                <TableEmptyState message={t("noShuttleReports")} icon={CalendarDays} />
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
                      {tripDate(report.trip_date, "short")}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <DirectionBadge direction={report.direction} />
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap font-medium text-fg`}>
                      #{report.id}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="font-medium text-fg">
                        {report.route?.name || "—"}
                      </div>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      {report.vehicle ? (
                        <>
                          <div className="whitespace-nowrap text-fg">
                            {report.vehicle.make} {report.vehicle.model}
                          </div>
                          <div className="text-xs text-fg-muted">
                            {report.vehicle.plate_number}
                          </div>
                        </>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="text-fg">
                        {report.driver?.full_name || "—"}
                      </div>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end font-medium text-fg`}>
                      {report.passengers.boarded}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end ${report.passengers.absent > 0 ? "text-fg" : "text-fg-muted"}`}>
                      {report.passengers.absent}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-end text-fg-secondary`}>
                      {report.passengers.total}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-xs text-fg-muted`}>
                      {formatDateTime(report.started_at, locale)}
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-xs text-fg-muted`}>
                      {formatDateTime(report.completed_at, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <nav aria-label="Pagination" className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-fg-muted tabular-nums">
              {t("showingTrips", { shown: reports.length, total: pagination.total })}
            </p>
            <ul className="flex flex-wrap gap-1">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
                (page) => (
                  <li key={page}>
                    <button
                      type="button"
                      onClick={() => handlePageChange(page)}
                      aria-current={page === pagination.page ? "page" : undefined}
                      className={cn(
                        "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-medium tabular-nums transition-colors",
                        page === pagination.page ? "bg-fg text-page" : "text-fg-secondary hover:bg-subtle hover:text-fg",
                        focusRing,
                      )}
                    >
                      {page}
                    </button>
                  </li>
                )
              )}
            </ul>
          </nav>
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
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="mb-1 text-xs text-fg-muted">{t("date")}</dt>
                <dd className="text-sm font-medium text-fg">{tripDate(selectedReport.trip_date, "long")}</dd>
              </div>
              <div>
                <dt className="mb-1 text-xs text-fg-muted">{t("direction")}</dt>
                <dd><DirectionBadge direction={selectedReport.direction} /></dd>
              </div>
              <div>
                <dt className="mb-1 text-xs text-fg-muted">{t("route")}</dt>
                <dd className="text-sm font-medium text-fg">{selectedReport.route?.name || "—"}</dd>
              </div>
              <div>
                <dt className="mb-1 text-xs text-fg-muted">{t("driver")}</dt>
                <dd className="text-sm font-medium text-fg">{selectedReport.driver?.full_name || "—"}</dd>
              </div>
              {selectedReport.vehicle && (
                <div className="col-span-2">
                  <dt className="mb-1 text-xs text-fg-muted">{t("vehicle")}</dt>
                  <dd className="text-sm font-medium text-fg">
                    {selectedReport.vehicle.make} {selectedReport.vehicle.model}{" "}
                    <span className="text-xs font-normal text-fg-muted">
                      ({selectedReport.vehicle.plate_number})
                    </span>
                  </dd>
                </div>
              )}
              <div>
                <dt className="mb-1 text-xs text-fg-muted">{t("startedAt")}</dt>
                <dd className="text-sm font-medium text-fg tabular-nums">{formatDateTime(selectedReport.started_at, locale)}</dd>
              </div>
              <div>
                <dt className="mb-1 text-xs text-fg-muted">{t("completedAt")}</dt>
                <dd className="text-sm font-medium text-fg tabular-nums">{formatDateTime(selectedReport.completed_at, locale)}</dd>
              </div>
            </dl>

            {/* Boarding Summary */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-fg">{t("boardingSummary")}</h4>
              <dl className="grid grid-cols-3 gap-3">
                {[
                  { key: "assigned", label: t("assigned"), value: selectedReport.passengers.total },
                  { key: "boarded", label: t("boarded"), value: selectedReport.passengers.boarded },
                  { key: "absent", label: t("absent"), value: selectedReport.passengers.absent },
                ].map((s) => (
                  <div key={s.key} className="rounded-lg border border-line px-4 py-3">
                    <dt className="text-xs text-fg-muted">{s.label}</dt>
                    <dd className="mt-1 text-2xl font-semibold tracking-tight text-fg tabular-nums">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {selectedReport.passengers.details.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-fg">{t("passengerDetails")}</h4>
                <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                  {selectedReport.passengers.details.map((log, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-fg">
                          {log.employee?.full_name || tCommon("status.unknown")}
                        </div>
                        <div className="text-xs text-fg-muted">
                          {log.employee?.department || ""}{" "}
                          {log.employee?.employee_id
                            ? `· ID: ${log.employee.employee_id}`
                            : ""}
                        </div>
                        {(log.status === "BOARDED" || log.status === "DROPPED_OFF") && log.scanned_at && (
                          <div className="mt-0.5 text-xs text-fg-secondary tabular-nums">
                            {t("boardedAt")} {formatTimeOnly(log.scanned_at, locale)}
                          </div>
                        )}
                        {log.drop_off_at && (
                          <div className="mt-0.5 text-xs text-fg-secondary tabular-nums">
                            {t("dropoffTime")} {formatTimeOnly(log.drop_off_at, locale)}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={log.status} overrides={BOARDING_STATUS_TONES} className="shrink-0" />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="mb-2 text-sm font-semibold text-fg">{t("stopLogs")}</h4>
              <div className="overflow-hidden rounded-lg border border-line">
                {selectedReport.route?.stops && selectedReport.route.stops.length > 0 ? (
                  <ol className="divide-y divide-line">
                    {selectedReport.route.stops.map((stop, index) => {
                      const log = selectedReport.stop_logs?.find((item) => item.stop_id === stop.id);
                      const isEvening = selectedReport.direction === "EVENING";
                      const isLastStop =
                        index === (selectedReport.route?.stops?.length ?? 0) - 1;
                      const isFinalMorningStop = !isEvening && isLastStop;
                      const arrivedAt = isFinalMorningStop
                        ? formatDateTime(
                            selectedReport.completed_at ?? log?.arrived_at ?? null,
                            locale,
                          )
                        : formatDateTime(log?.arrived_at ?? null, locale);
                      const boardedAt = formatDateTime(log?.boarded_at ?? null, locale);
                      const isFirstEveningStop = isEvening && index === 0;
                      const dropOffAt = isFirstEveningStop
                        ? formatDateTime(selectedReport.started_at, locale)
                        : formatDateTime(log?.drop_off_at ?? null, locale);

                      return (
                        <li
                          key={stop.id}
                          className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3"
                        >
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-subtle px-2 text-xs font-medium text-fg-secondary tabular-nums">
                            {stop.sequence ?? "—"}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-fg">
                              {stop.name}
                            </div>
                            <div className="text-xs text-fg-muted">
                              {isEvening
                                ? t("dropoffFromLogs")
                                : isFinalMorningStop
                                  ? t("tripCompletionTime")
                                  : t("arrivalFromLogs")}
                            </div>
                          </div>
                          <div className="text-end text-sm text-fg tabular-nums">
                            {isEvening ? (
                              <div>
                                <div className="text-xs text-fg-muted">
                                  {isFirstEveningStop ? t("tripStartedAt") : t("dropoffTime")}
                                </div>
                                <div>{dropOffAt}</div>
                              </div>
                            ) : isFinalMorningStop ? (
                              <div>
                                <div className="text-xs text-fg-muted">{t("arrivedAt")}</div>
                                <div>{arrivedAt}</div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div>
                                  <div className="text-xs text-fg-muted">{t("arrivedAt")}</div>
                                  <div>{arrivedAt}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-fg-muted">{t("boardedAt")}</div>
                                  <div>{boardedAt}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="px-4 py-6 text-sm text-fg-muted">
                    {t("noStopLogs")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
