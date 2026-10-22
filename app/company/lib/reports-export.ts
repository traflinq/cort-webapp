/**
 * CSV / PDF export helpers shared by the company report pages.
 * Column headers and row builders stay with the page; this file owns the file plumbing.
 */
import type { ShuttleReport } from "@/app/lib/services/types/reports";

export type CsvCell = string | number | null | undefined;

export function escapeCSV(value: CsvCell): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Comment lines (prefixed with "# "), a header row and data rows → CSV text. */
export function toCSV(headers: CsvCell[], rows: CsvCell[][], commentLines: string[] = []): string {
  return [
    ...commentLines.map((l) => `# ${l}`),
    ...(commentLines.length ? [""] : []),
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(content: string, filename: string) {
  downloadBlob(new Blob([content], { type: "text/csv;charset=utf-8;" }), filename);
}

/** `cort_shuttle_report[_route][_dates]` */
export function exportBasename(prefix: string, startDate: string, endDate: string, routeName?: string) {
  const dateLabel = startDate && endDate ? `_${startDate}_to_${endDate}` : startDate ? `_from_${startDate}` : "";
  const routeLabel = routeName ? `_${routeName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40)}` : "";
  return `${prefix}${routeLabel}${dateLabel}`;
}

const EXPORT_LOCALE = "en-PK";
const EXPORT_TZ = "Asia/Karachi";

export function formatExportDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(EXPORT_LOCALE, { timeZone: EXPORT_TZ, year: "numeric", month: "short", day: "numeric" });
}

export function formatExportDateTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString(EXPORT_LOCALE, {
    timeZone: EXPORT_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export const SHUTTLE_EXPORT_HEADERS = [
  "Trip Date", "Direction", "Trip ID", "Route",
  "Vehicle", "Plate Number", "Driver",
  "Boarded", "Absent", "Total Assigned", "Started At", "Completed At",
];

export const BOARDING_LOG_HEADERS = [
  "Trip Date", "Direction", "Trip ID", "Route",
  "Passenger", "Employee ID", "Department",
  "Status", "Boarded At", "Drop-off At",
];

export function buildShuttleExportRows(reports: ShuttleReport[]): string[][] {
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

export function buildBoardingLogRows(reports: ShuttleReport[]): string[][] {
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

export type ShuttleExportMeta = { companyName: string; startDate: string; endDate: string; routeName?: string };

export function exportShuttleCSV(reports: ShuttleReport[], meta: ShuttleExportMeta) {
  const rows = buildShuttleExportRows(reports);
  const boardingRows = buildBoardingLogRows(reports);
  const totalBoarded = reports.reduce((s, r) => s + (r.passengers?.boarded ?? 0), 0);
  const content = [
    `# CORT - Shuttle Report`,
    `# Company: ${meta.companyName}`,
    `# Route: ${meta.routeName || "All"}`,
    `# Period: ${meta.startDate || "All"} to ${meta.endDate || "All"}`,
    `# Generated: ${new Date().toLocaleString(EXPORT_LOCALE)}`,
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
  downloadCSV(content, `${exportBasename("cort_shuttle_report", meta.startDate, meta.endDate, meta.routeName)}.csv`);
}

/** Landscape A4 PDF with the trips table and a boarding-log table (jsPDF + autotable, loaded on demand). */
export async function exportShuttlePdf(reports: ShuttleReport[], meta: ShuttleExportMeta) {
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
  doc.text(meta.companyName, margin, 40);

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  doc.text(
    [
      `Route: ${meta.routeName || "All"}`,
      `Period: ${meta.startDate || "All"} to ${meta.endDate || "All"}`,
      `Generated: ${new Date().toLocaleString(EXPORT_LOCALE)}`,
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
    columnStyles: { 7: { halign: "right" }, 8: { halign: "right" }, 9: { halign: "right" } },
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
    body: boardingRows.length > 0 ? boardingRows : [[{ content: "No boarding logs for the selected filters", colSpan: BOARDING_LOG_HEADERS.length }]],
    startY: boardingStartY + 10,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [254, 133, 3], textColor: [20, 20, 20], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 247, 244] },
  });

  doc.save(`${exportBasename("cort_shuttle_report", meta.startDate, meta.endDate, meta.routeName)}.pdf`);
}
