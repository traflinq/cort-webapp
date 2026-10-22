"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, ExternalLink, FileBarChart } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  DateRangePicker,
  Drawer,
  DrawerContent,
  EmptyState,
  FilterBar,
  PageHeader,
  SectionHeader,
  useFormatters,
  type DateRange,
} from "@/app/ui";
import { useAppSelector } from "@/app/lib/store/hooks";
import { selectCompany } from "@/app/lib/store/slices/companySlice";
import { apiClient } from "@/app/lib/services/api-client";
import type { ChauffeurReport } from "@/app/lib/services/types/reports";
import { chauffeurColumns } from "../../components/reports/columns";
import { downloadCSV, escapeCSV, exportBasename, formatExportDateTime } from "../../lib/reports-export";

const PAGE_SIZE = 25;

const CSV_HEADERS = [
  "Date", "City", "Booking ID", "Passenger", "Employee ID",
  "Vehicle", "Plate Number", "Driver",
  "Pickup", "Dropoff",
  "Duration (min)", "Distance (km)",
  "Service Charge (PKR)", "Fuel Cost (PKR)", "Toll (PKR)", "Parking (PKR)", "Accommodation (PKR)", "Outstation Allowance (PKR)", "Total (PKR)",
];

function exportChauffeurCSV(reports: ChauffeurReport[], companyName: string, startDate: string, endDate: string) {
  const rows = reports.map((r) => [
    formatExportDateTime(r.completed_at),
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
  const content = [
    `# CORT - Chauffeur Report`,
    `# Company: ${companyName}`,
    `# Period: ${startDate || "All"} to ${endDate || "All"}`,
    `# Generated: ${new Date().toLocaleString("en-PK")}`,
    `# Total Trips: ${reports.length}`,
    `# Total Cost: PKR ${reports.reduce((s, r) => s + Number(r.total_cost ?? 0), 0).toLocaleString()}`,
    "",
    CSV_HEADERS.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");
  downloadCSV(content, `${exportBasename("cort_chauffeur_report", startDate, endDate)}.csv`);
}

export default function ChauffeurReportsPage() {
  const t = useTranslations("company.reports");
  const tCommon = useTranslations("common");
  const fmt = useFormatters();
  const company = useAppSelector(selectCompany);
  const companyId = company?.id;

  const [reports, setReports] = useState<ChauffeurReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [selected, setSelected] = useState<ChauffeurReport | null>(null);
  const [range, setRange] = useState<DateRange | null>(null);
  const [page, setPage] = useState(1);

  const startDate = range?.start ?? "";
  const endDate = range?.end ?? "";

  const fetchReports = useCallback(
    async (start: string, end: string) => {
      if (!companyId) return;
      setLoading(true);
      setError(null);
      try {
        const res = (await apiClient.getChauffeurReports(companyId, { startDate: start || undefined, endDate: end || undefined })) as unknown;
        const raw = (res as { data?: unknown })?.data ?? res;
        const list = (raw as { data?: ChauffeurReport[] })?.data ?? raw;
        setReports(Array.isArray(list) ? list : []);
        setPage(1);
      } catch (e) {
        setReports([]);
        setError(e instanceof Error ? e.message : tCommon("errors.failedToLoad"));
      } finally {
        setLoading(false);
      }
    },
    [companyId, tCommon],
  );

  // Debounce filter changes and re-fetch.
  useEffect(() => {
    const timer = setTimeout(() => void fetchReports(startDate, endDate), 400);
    return () => clearTimeout(timer);
  }, [startDate, endDate, fetchReports, retryTick]);

  const columns = useMemo(() => chauffeurColumns(t, fmt), [t, fmt]);
  const pageRows = useMemo(() => reports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [reports, page]);
  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));

  if (!company) {
    return <EmptyState title={tCommon("errors.noCompanySelected")} />;
  }

  if (!company.services_enabled?.chauffeur_enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("chauffeurTitle")} />
        <Card>
          <EmptyState icon={<FileBarChart aria-hidden="true" />} title={t("chauffeurDisabled")} description={t("chauffeurDisabledDescription")} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("chauffeurTitle")}
        description={t("chauffeurTableDescription")}
        actions={
          <Button variant="outline" leftIcon={<Download />} disabled={reports.length === 0} onClick={() => exportChauffeurCSV(reports, company.name ?? "Company", startDate, endDate)}>
            {t("exportCsv")}
          </Button>
        }
      />

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar activeCount={range ? 1 : 0} onClear={() => setRange(null)}>
            <DateRangePicker value={range} onChange={setRange} allowClear label={t("date")} />
          </FilterBar>
        </CardContent>
        <DataTable<ChauffeurReport>
          caption={t("chauffeurTitle")}
          rows={pageRows}
          rowKey={(r) => r.id}
          columns={columns}
          loading={loading}
          error={error}
          onRetry={() => setRetryTick((n) => n + 1)}
          empty={{ title: t("noReports") }}
          onRowClick={setSelected}
          pagination={{ page, totalPages, total: reports.length, pageSize: PAGE_SIZE, onPageChange: setPage }}
        />
      </Card>

      <Drawer open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DrawerContent size="lg" title={selected ? `${t("tripDetails")} #${selected.id}` : t("tripDetails")}>
          {selected && <ChauffeurTripDetail report={selected} />}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function ChauffeurTripDetail({ report }: { report: ChauffeurReport }) {
  const t = useTranslations("company.reports");
  const fmt = useFormatters();
  const b = report.breakdown;
  const costRows: Array<{ label: string; value: number; sub?: boolean }> = [
    { label: t("serviceChargeBase"), value: Number(b.service_charge) },
    { label: t("fuelSurcharge"), value: Number(b.fuel_cost) },
    ...(Number(b.toll) > 0 ? [{ label: t("tollCharges"), value: Number(b.toll), sub: true }] : []),
    ...(Number(b.parking) > 0 ? [{ label: t("parkingFees"), value: Number(b.parking), sub: true }] : []),
    ...(Number(b.outstation_allowance) > 0 ? [{ label: t("outstationAllowance"), value: Number(b.outstation_allowance), sub: true }] : []),
    ...(Number(b.accommodation) > 0 ? [{ label: t("accommodation"), value: Number(b.accommodation), sub: true }] : []),
  ];
  const dailyLogs = [...(report.daily_logs ?? [])].sort((a, c) => new Date(a.log_date).getTime() - new Date(c.log_date).getTime());

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-subtle p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{t("passenger")}</p>
          <p className="font-semibold text-fg">{report.passenger?.full_name || t("guest")}</p>
          <p className="mt-0.5 font-mono text-xs text-fg-muted">{report.passenger?.employee_id || "—"}</p>
        </div>
        <div className="rounded-xl border border-line bg-subtle p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{t("vehicleAndDriver")}</p>
          <p className="font-semibold text-fg">{report.vehicle?.make} {report.vehicle?.model}</p>
          <p className="mt-0.5 font-mono text-xs text-fg-muted">{report.vehicle?.plate_number}</p>
          <p className="mt-1 text-xs text-fg-muted">{t("driver")}: {report.driver?.full_name || t("assignedDriver")}</p>
        </div>
      </div>

      <section className="rounded-xl border border-line p-4">
        <SectionHeader title={t("routeJourney")} className="mb-3" />
        <ol className="relative space-y-3">
          <span aria-hidden="true" className="absolute start-[11px] top-2 bottom-2 w-0.5 bg-line" />
          <li className="relative flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success-ink ring-4 ring-card">A</span>
            <div>
              <p className="text-sm font-medium text-fg">{report.route.pickup}</p>
              <p className="text-xs text-fg-muted">{t("pickupLocation")}</p>
            </div>
          </li>
          <li className="relative flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-danger-soft text-xs font-bold text-danger-ink ring-4 ring-card">B</span>
            <div>
              <p className="text-sm font-medium text-fg">{report.route.dropoff}</p>
              <p className="text-xs text-fg-muted">{t("dropoffLocation")}</p>
            </div>
          </li>
        </ol>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
          <div>
            <dt className="text-xs text-fg-muted">{t("duration")}</dt>
            <dd className="font-semibold text-fg">{t("mins", { count: report.total_duration_minutes })}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">{t("distance")}</dt>
            <dd className="font-semibold text-fg">{t("km", { count: report.total_distance_km })}</dd>
          </div>
        </dl>
      </section>

      {dailyLogs.length > 0 && (
        <section>
          <SectionHeader title={t("tripBreakdown")} className="mb-3" />
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-xs">
              <thead className="bg-subtle text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="px-3 py-2 text-start">{t("date")}</th>
                  <th className="px-3 py-2 text-start">{t("tripType")}</th>
                  <th className="px-3 py-2 text-end">{t("hours")}</th>
                  <th className="px-3 py-2 text-end">{t("fullDay")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {dailyLogs.map((log, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-medium text-fg">{fmt.formatDate(log.log_date)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={log.trip_type === "OUT_STATION" ? "brand" : "info"} size="sm">
                        {log.trip_type === "OUT_STATION" ? t("outstation") : t("inCity")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-end font-mono text-fg">
                      {log.hours_used ? parseFloat(log.hours_used.toString()).toFixed(1) : log.is_full_day ? "24.0" : "0.0"}
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Badge tone={log.is_full_day ? "success" : "neutral"} size="sm">
                        {log.is_full_day ? t("yes") : t("no")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <SectionHeader title={t("costBreakdown")} className="mb-3" />
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {costRows.map((row) => (
                <tr key={row.label} className={row.sub ? "bg-subtle" : undefined}>
                  <td className={row.sub ? "px-4 py-2 ps-8 text-xs text-fg-muted" : "px-4 py-3 text-fg"}>{row.label}</td>
                  <td className={row.sub ? "px-4 py-2 text-end text-xs text-fg" : "px-4 py-3 text-end font-medium text-fg"}>{fmt.formatCurrency(row.value)}</td>
                </tr>
              ))}
              <tr className="bg-subtle font-semibold">
                <td className="px-4 py-3 text-fg">{t("totalTripCost")}</td>
                <td className="px-4 py-3 text-end text-brand-ink">{fmt.formatCurrency(report.total_cost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {(b.expense_toll_image_url || b.expense_parking_image_url) && (
        <section>
          <SectionHeader title={t("expenseReceipts")} className="mb-3" />
          <div className="grid grid-cols-2 gap-4">
            {b.expense_toll_image_url && <Receipt label={t("tollReceipt")} href={b.expense_toll_image_url} />}
            {b.expense_parking_image_url && <Receipt label={t("parkingReceipt")} href={b.expense_parking_image_url} />}
          </div>
        </section>
      )}
    </div>
  );
}

function Receipt({ label, href }: { label: string; href: string }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{label}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="group relative block aspect-[4/3] overflow-hidden rounded-lg border border-line transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt="" className="size-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-overlay opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ExternalLink className="size-5 text-white" aria-hidden="true" />
        </span>
      </a>
    </div>
  );
}
