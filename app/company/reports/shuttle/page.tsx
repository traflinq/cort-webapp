"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, FileBarChart, FileText } from "lucide-react";
import {
  ActionMenu,
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
  FilterField,
  PageHeader,
  SectionHeader,
  Select,
  StatusBadge,
  useFormatters,
  type DateRange,
} from "@/app/ui";
import { toast } from "sonner";
import { useAppSelector } from "@/app/lib/store/hooks";
import { selectCompany } from "@/app/lib/store/slices/companySlice";
import { apiClient } from "@/app/lib/services/api-client";
import type { ShuttleReport } from "@/app/lib/services/types/reports";
import { shuttleColumns } from "../../components/reports/columns";
import { exportShuttleCSV, exportShuttlePdf } from "../../lib/reports-export";

const PAGE_SIZE = 20;

type PaginationMeta = { page: number; pages: number; total: number };

function parseShuttleReportsResponse(res: unknown, fallbackPage: number) {
  const raw = (res as { data?: unknown })?.data ?? res;
  const payload = raw as { data?: ShuttleReport[]; pagination?: PaginationMeta };
  const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(raw) ? (raw as ShuttleReport[]) : [];
  const meta: Partial<PaginationMeta> = payload?.pagination ?? {};
  return { list, pagination: { page: meta.page ?? fallbackPage, pages: meta.pages ?? 1, total: meta.total ?? list.length } };
}

export default function ShuttleReportsPage() {
  const t = useTranslations("company.reports");
  const tCommon = useTranslations("common");
  const fmt = useFormatters();
  const company = useAppSelector(selectCompany);
  const companyId = company?.id;

  const [reports, setReports] = useState<ShuttleReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ShuttleReport | null>(null);
  const [range, setRange] = useState<DateRange | null>(null);
  const [routeId, setRouteId] = useState<string>("");
  const [routes, setRoutes] = useState<Array<{ id: number; name: string }>>([]);

  const startDate = range?.start ?? "";
  const endDate = range?.end ?? "";
  const selectedRouteId = routeId ? Number(routeId) : undefined;
  const selectedRouteName = routes.find((r) => String(r.id) === routeId)?.name;

  useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;
    apiClient
      .request(`/routes?company_id=${company.id}`)
      .then((res) => {
        if (cancelled) return;
        const raw = (res as { data?: unknown })?.data ?? res;
        const list = Array.isArray(raw) ? raw : Array.isArray((raw as { data?: unknown })?.data) ? (raw as { data: unknown[] }).data : [];
        setRoutes(
          list
            .map((item) => {
              const route = item as { id?: number; name?: string };
              return route.id && route.name ? { id: route.id, name: route.name } : null;
            })
            .filter((r): r is { id: number; name: string } => r != null)
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

  // Filters reset to page 1 (render-time state adjustment; one fetch per change, no double effect).
  const [prevFilters, setPrevFilters] = useState({ startDate, endDate, selectedRouteId });
  if (prevFilters.startDate !== startDate || prevFilters.endDate !== endDate || prevFilters.selectedRouteId !== selectedRouteId) {
    setPrevFilters({ startDate, endDate, selectedRouteId });
    setPage(1);
  }

  const fetchReports = useCallback(
    async (p: number, start: string, end: string, route?: number) => {
      if (!companyId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.getShuttleReports(companyId, {
          startDate: start || undefined,
          endDate: end || undefined,
          routeId: route,
          page: p,
          limit: PAGE_SIZE,
        });
        const parsed = parseShuttleReportsResponse(res, p);
        setReports(parsed.list);
        setPagination(parsed.pagination);
      } catch (e) {
        setReports([]);
        setError(e instanceof Error ? e.message : tCommon("errors.failedToLoad"));
      } finally {
        setLoading(false);
      }
    },
    [companyId, tCommon],
  );

  // Debounced: one request per filter/page change.
  useEffect(() => {
    const timer = setTimeout(() => void fetchReports(page, startDate, endDate, selectedRouteId), 400);
    return () => clearTimeout(timer);
  }, [page, startDate, endDate, selectedRouteId, fetchReports, retryTick]);

  const handleExport = async (format: "csv" | "pdf") => {
    if (!company?.id || exporting) return;
    setExporting(true);
    try {
      const all: ShuttleReport[] = [];
      let p = 1;
      let pages = 1;
      do {
        const res = await apiClient.getShuttleReports(company.id, {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          routeId: selectedRouteId,
          page: p,
          limit: 100,
        });
        const parsed = parseShuttleReportsResponse(res, p);
        all.push(...parsed.list);
        pages = parsed.pagination.pages || 1;
        p += 1;
      } while (p <= pages);
      const meta = { companyName: company.name ?? "Company", startDate, endDate, routeName: selectedRouteName };
      if (format === "pdf") await exportShuttlePdf(all, meta);
      else exportShuttleCSV(all, meta);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo(() => shuttleColumns(t, fmt), [t, fmt]);
  const activeFilters = (range ? 1 : 0) + (routeId ? 1 : 0);

  if (!company) {
    return <EmptyState title={tCommon("errors.noCompanySelected")} />;
  }

  if (!company.services_enabled?.shuttle_enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("shuttleTitle")} />
        <Card>
          <EmptyState icon={<FileBarChart aria-hidden="true" />} title={t("shuttleDisabled")} description={t("shuttleDisabledDescription")} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("shuttleTitle")}
        description={t("shuttleTableDescription")}
        actions={
          <ActionMenu
            label={t("export")}
            variant="outline"
            size="md"
            trigger={
              <Button variant="outline" leftIcon={<Download />} loading={exporting} disabled={exporting}>
                {exporting ? t("exporting") : t("export")}
              </Button>
            }
            items={[
              { label: t("exportAsCsv"), icon: <FileText />, onSelect: () => void handleExport("csv") },
              { label: t("exportAsPdf"), icon: <FileText />, onSelect: () => void handleExport("pdf") },
            ]}
          />
        }
      />

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar
            activeCount={activeFilters}
            onClear={() => {
              setRange(null);
              setRouteId("");
            }}
          >
            <FilterField label={t("route")}>
              <Select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
                <option value="">{t("allRoutes")}</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </FilterField>
            <DateRangePicker value={range} onChange={setRange} allowClear label={t("tripDate")} />
          </FilterBar>
        </CardContent>
        <DataTable<ShuttleReport>
          caption={t("shuttleTitle")}
          rows={reports}
          rowKey={(r) => r.id}
          columns={columns}
          loading={loading}
          error={error}
          onRetry={() => setRetryTick((n) => n + 1)}
          empty={{ title: t("noShuttleReports") }}
          onRowClick={setSelected}
          pagination={{ page, totalPages: pagination.pages, total: pagination.total, pageSize: PAGE_SIZE, onPageChange: setPage }}
        />
      </Card>

      <Drawer open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DrawerContent size="lg" title={selected ? t("shuttleTrip", { id: selected.id }) : t("tripDetails")}>
          {selected && <ShuttleTripDetail report={selected} />}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function ShuttleTripDetail({ report }: { report: ShuttleReport }) {
  const t = useTranslations("company.reports");
  const tCommon = useTranslations("common");
  const fmt = useFormatters();
  const isEvening = report.direction === "EVENING";
  const stops = report.route?.stops ?? [];
  const dt = (v: string | null | undefined) => (v ? fmt.formatDateTime(v) : "—");
  const time = (v: string | null | undefined) => (v ? fmt.formatTime(v) : "—");

  const facts: Array<{ label: string; value: React.ReactNode; wide?: boolean }> = [
    { label: t("date"), value: fmt.formatDate(report.trip_date) },
    { label: t("direction"), value: <StatusBadge status={report.direction} /> },
    { label: t("route"), value: report.route?.name || "—" },
    { label: t("driver"), value: report.driver?.full_name || "—" },
    ...(report.vehicle
      ? [{ label: t("vehicle"), value: <>{report.vehicle.make} {report.vehicle.model} <span className="font-mono text-xs text-fg-muted">({report.vehicle.plate_number})</span></>, wide: true }]
      : []),
    { label: t("startedAt"), value: <span className="font-mono text-sm">{dt(report.started_at)}</span> },
    { label: t("completedAt"), value: <span className="font-mono text-sm">{dt(report.completed_at)}</span> },
  ];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.label} className={f.wide ? "sm:col-span-2" : undefined}>
            <dt className="mb-1 text-xs text-fg-muted">{f.label}</dt>
            <dd className="font-semibold text-fg">{f.value}</dd>
          </div>
        ))}
      </dl>

      <section>
        <SectionHeader title={t("boardingSummary")} className="mb-3" />
        <div className="grid grid-cols-3 gap-3">
          <Stat value={report.passengers.total} label={t("assigned")} />
          <Stat value={report.passengers.boarded} label={t("boarded")} tone="success" />
          <Stat value={report.passengers.absent} label={t("absent")} tone="danger" />
        </div>
      </section>

      {report.passengers.details.length > 0 && (
        <section>
          <SectionHeader title={t("passengerDetails")} className="mb-2" />
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {report.passengers.details.map((log, idx) => (
              <li key={idx} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{log.employee?.full_name || tCommon("status.unknown")}</p>
                  <p className="text-xs text-fg-muted">
                    {log.employee?.department || ""}
                    {log.employee?.employee_id ? ` · ID: ${log.employee.employee_id}` : ""}
                  </p>
                  {(log.status === "BOARDED" || log.status === "DROPPED_OFF") && log.scanned_at && (
                    <p className="mt-0.5 font-mono text-xs text-success-ink">
                      {t("boardedAt")} {time(log.scanned_at)}
                    </p>
                  )}
                  {log.drop_off_at && (
                    <p className="mt-0.5 font-mono text-xs text-info-ink">
                      {t("dropoffTime")} {time(log.drop_off_at)}
                    </p>
                  )}
                </div>
                <Badge tone={log.status === "BOARDED" ? "success" : log.status === "DROPPED_OFF" ? "info" : "danger"} size="sm">
                  {log.status}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeader title={t("stopLogs")} className="mb-2" />
        <div className="overflow-hidden rounded-xl border border-line">
          {stops.length > 0 ? (
            <ol className="divide-y divide-line">
              {stops.map((stop, index) => {
                const log = report.stop_logs?.find((item) => item.stop_id === stop.id);
                const isLastStop = index === stops.length - 1;
                const isFinalMorningStop = !isEvening && isLastStop;
                const arrivedAt = isFinalMorningStop ? dt(report.completed_at ?? log?.arrived_at ?? null) : dt(log?.arrived_at ?? null);
                const boardedAt = dt(log?.boarded_at ?? null);
                const isFirstEveningStop = isEvening && index === 0;
                const dropOffAt = isFirstEveningStop ? dt(report.started_at) : dt(log?.drop_off_at ?? null);
                return (
                  <li key={stop.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-subtle px-2 text-xs font-semibold text-fg">{stop.sequence ?? "—"}</span>
                    <div>
                      <p className="text-sm font-medium text-fg">{stop.name}</p>
                      <p className="text-xs text-fg-muted">{isEvening ? t("dropoffFromLogs") : isFinalMorningStop ? t("tripCompletionTime") : t("arrivalFromLogs")}</p>
                    </div>
                    <div className="text-end font-mono text-sm text-fg">
                      {isEvening ? (
                        <TimeCell label={isFirstEveningStop ? t("tripStartedAt") : t("dropoffTime")} value={dropOffAt} />
                      ) : isFinalMorningStop ? (
                        <TimeCell label={t("arrivedAt")} value={arrivedAt} />
                      ) : (
                        <div className="space-y-1">
                          <TimeCell label={t("arrivedAt")} value={arrivedAt} />
                          <TimeCell label={t("boardedAt")} value={boardedAt} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="px-4 py-6 text-sm text-fg-muted">{t("noStopLogs")}</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "success" | "danger" }) {
  const cls = tone === "success" ? "bg-success-soft text-success-ink" : tone === "danger" ? "bg-danger-soft text-danger-ink" : "bg-subtle text-fg";
  return (
    <div className={`rounded-xl px-4 py-3 text-center ${cls}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs opacity-80">{label}</p>
    </div>
  );
}

function TimeCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-fg-muted">{label}</p>
      <p>{value}</p>
    </div>
  );
}
