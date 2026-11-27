"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bus,
  Car,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Lock,
  MapPin,
  Minus,
  Settings2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Button, focusRing } from "@/app/admin/ui";
import { formatLocaleNumber } from "@/app/lib/i18n/format";
import type { Locale } from "@/i18n/config";
import type {
  ChauffeurSection,
  Comparison,
  FuelFlag,
  PoolFueling,
  PoolSection,
  SavingsDashboardFull,
  SavingsDashboardLocked,
  ShuttleSection,
  LockedShuttleSection,
} from "./types";
import { monthKey, shiftMonth } from "./types";

const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

const CARD = "rounded-xl border border-line bg-card";

// ── Formatting ────────────────────────────────────────────────────────────────

function useFormat() {
  const locale = useLocale() as Locale;
  const tCommon = useTranslations("common");
  const t = useTranslations("company.savings.dashboard");
  const n = useCallback(
    (v: number | null | undefined, dp = 0) =>
      v == null ? "—" : formatLocaleNumber(v, locale, { maximumFractionDigits: dp, minimumFractionDigits: 0 }),
    [locale],
  );
  return {
    n,
    pkr: (v: number | null | undefined) => (v == null ? "—" : `${tCommon("currency.pkr")} ${n(Math.round(v))}`),
    km: (v: number | null | undefined) => (v == null ? "—" : t("unitKm", { value: n(v, v < 100 ? 1 : 0) })),
    min: (v: number | null | undefined) => (v == null ? "—" : t("unitMin", { value: n(v) })),
    pct: (v: number | null | undefined) => (v == null ? "—" : `${n(v, 1)}%`),
  };
}

function useMonthLabel() {
  const t = useTranslations("company.savings");
  return useCallback(
    (month: string) => {
      const [y, m] = month.split("-").map(Number);
      return `${t(`months.${MONTH_KEYS[m - 1]}`)} ${y}`;
    },
    [t],
  );
}

// ── Month picker ──────────────────────────────────────────────────────────────

export function SavingsMonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const t = useTranslations("company.savings.dashboard");
  const label = useMonthLabel();
  const isCurrent = month === monthKey();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-card px-1.5 py-1">
      <button
        type="button"
        aria-label={t("prevMonth")}
        onClick={() => onChange(shiftMonth(month, -1))}
        className={cn("rounded-md p-1.5 text-fg-muted transition-colors hover:bg-subtle hover:text-fg", focusRing)}
      >
        <ChevronLeft className="size-4 rtl-flip" />
      </button>
      <span className="min-w-[8.5rem] text-center text-sm font-semibold text-fg tabular-nums">{label(month)}</span>
      <button
        type="button"
        aria-label={t("nextMonth")}
        disabled={isCurrent}
        onClick={() => onChange(shiftMonth(month, 1))}
        className={cn("rounded-md p-1.5 text-fg-muted transition-colors hover:bg-subtle hover:text-fg disabled:cursor-not-allowed disabled:opacity-30", focusRing)}
      >
        <ChevronRight className="size-4 rtl-flip" />
      </button>
    </div>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────────

/** Leading icon for a notice; coloured only when the tone carries meaning (connected, needs action). */
function IconTile({ children, tone = "neutral" }: { children: ReactNode; tone?: "success" | "info" | "warning" | "neutral" }) {
  const cls = { success: "text-success-ink", info: "text-info-ink", warning: "text-warning-ink", neutral: "text-fg-muted" }[tone];
  return (
    <span aria-hidden="true" className={cn("mt-0.5 shrink-0 [&_svg]:size-4", cls)}>
      {children}
    </span>
  );
}

function Delta({ delta, invert, label }: { delta: number | null; invert?: boolean; label: string }) {
  const locale = useLocale() as Locale;
  if (delta == null) return <span className="text-fg-muted">{label}</span>;
  const good = invert ? delta < 0 : delta > 0;
  const bad = invert ? delta > 0 : delta < 0;
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", good ? "text-success-ink" : bad ? "text-danger-ink" : "text-fg-muted")}>
      <Icon className="size-3.5" aria-hidden="true" />
      {formatLocaleNumber(Math.abs(delta), locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
      <span className="ms-1 font-normal text-fg-muted">{label}</span>
    </span>
  );
}

function Kpi({
  label,
  value,
  cmp,
  format,
  invert,
  hint,
}: {
  label: string;
  value?: ReactNode;
  cmp?: Comparison;
  format: (v: number | null) => string;
  /** A decrease is good (km, duration, cost). */
  invert?: boolean;
  hint?: ReactNode;
}) {
  const t = useTranslations("company.savings.dashboard");
  return (
    <div className={cn(CARD, "flex min-w-0 flex-col p-4")}>
      <p className="truncate text-xs font-medium text-fg-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-fg tabular-nums">{value ?? format(cmp?.current ?? null)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {cmp && <Delta delta={cmp.delta_pct} invert={invert} label={t("prevValue", { value: format(cmp.previous) })} />}
        {hint && <span className="text-fg-muted">{hint}</span>}
      </div>
    </div>
  );
}

function SectionTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Related figures side by side in one panel (stacked on phones), divided by hairlines. */
function SplitPanel({ items }: { items: { title: string; amount: string; detail: ReactNode; warn?: boolean }[] }) {
  return (
    <div className={cn(CARD, "grid grid-cols-1 divide-y divide-line lg:grid-cols-3 lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse")}>
      {items.map((x) => (
        <div key={x.title} className="flex min-w-0 flex-col gap-1.5 p-5">
          <p className="text-sm font-medium text-fg-secondary">{x.title}</p>
          <p className={cn("text-2xl font-semibold tracking-tight tabular-nums", x.warn ? "text-warning-ink" : "text-fg")}>{x.amount}</p>
          <div className="text-xs leading-relaxed text-fg-muted">{x.detail}</div>
        </div>
      ))}
    </div>
  );
}

function Table({ head, rows, empty }: { head: { label: string; numeric?: boolean }[]; rows: ReactNode[][]; empty: string }) {
  return (
    <div className={cn(CARD, "overflow-hidden")}>
      {rows.length === 0 ? (
        <p className="p-6 text-sm text-fg-muted">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line">
                {head.map((h) => (
                  <th key={h.label} scope="col" className={cn("whitespace-nowrap px-4 py-3 text-xs font-medium text-fg-muted", h.numeric ? "text-end" : "text-start")}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((cells, i) => (
                <tr key={i} className="transition-colors hover:bg-row-hover">
                  {cells.map((c, j) => (
                    <td key={j} className={cn("px-4 py-3 text-fg", head[j]?.numeric ? "whitespace-nowrap text-end tabular-nums" : "min-w-36")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// ── Hero ──────────────────────────────────────────────────────────────────────

export function SavingsHero({
  total,
  periodLabel,
  analysisReady,
  chips,
}: {
  total: number;
  periodLabel: string;
  analysisReady: boolean;
  chips?: { label: string; value: string; icon: ReactNode }[];
}) {
  const t = useTranslations("company.savings.dashboard");
  const f = useFormat();
  const positive = total >= 0;
  return (
    <div className={cn(CARD, "p-5 sm:p-6")}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-fg-secondary">{t("totalSavings")}</p>
            {!analysisReady && <Badge tone="warning">{t("provisional")}</Badge>}
          </div>
          <p className={cn("mt-1 text-3xl font-semibold tracking-tight tabular-nums", positive ? "text-success-ink" : "text-danger-ink")}>
            {f.pkr(Math.abs(total))}
          </p>
          <p className="mt-1 text-sm text-fg-muted">
            {positive ? t("totalSavingsSub", { period: periodLabel }) : t("totalExtraCostSub", { period: periodLabel })}
          </p>
          {!analysisReady && <p className="mt-1 text-xs text-fg-muted">{t("provisionalHint")}</p>}
        </div>
        {chips && chips.length > 0 && (
          <dl className="flex flex-wrap gap-x-6 gap-y-3">
            {chips.map((c) => (
              <div key={c.label} className="flex items-start gap-2">
                <span className="mt-0.5 text-fg-muted [&_svg]:size-4" aria-hidden="true">{c.icon}</span>
                <div>
                  <dt className="text-xs text-fg-muted">{c.label}</dt>
                  <dd className="text-sm font-semibold text-fg tabular-nums">{c.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

export function usePeriodLabel(period: { month: string; is_mtd: boolean; from?: string; to?: string }) {
  const t = useTranslations("company.savings.dashboard");
  const monthLabel = useMonthLabel();
  return period.is_mtd ? t("periodMtd", { month: monthLabel(period.month) }) : monthLabel(period.month);
}

// ── Locked (company not yet unlocked) ─────────────────────────────────────────

export function SavingsLockedView({ data }: { data: SavingsDashboardLocked }) {
  const t = useTranslations("company.savings.dashboard");
  const periodLabel = usePeriodLabel(data.period);
  return (
    <div className="flex flex-col gap-5">
      <SavingsHero total={data.total_savings_pkr} periodLabel={periodLabel} analysisReady={data.analysis_ready} />
      <div className={cn(CARD, "flex items-start gap-3 p-5")}>
        <IconTile>
          <Lock />
        </IconTile>
        <div className="flex-1">
          <p className="text-sm font-semibold text-fg">{t("lockedTitle")}</p>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("lockedDescription")}</p>
        </div>
      </div>
    </div>
  );
}

// ── Full dashboard ────────────────────────────────────────────────────────────

type Tab = "shuttle" | "pool" | "chauffeur";

export function SavingsDashboard({
  data,
  auditHref,
  onManageBenchmarks,
}: {
  data: SavingsDashboardFull;
  /** Company portal: link to Chauffeur Reports where trips are audited. */
  auditHref?: string;
  /** Company portal: opens the vendor cost (benchmark) modal. */
  onManageBenchmarks?: () => void;
}) {
  const t = useTranslations("company.savings.dashboard");
  const periodLabel = usePeriodLabel(data.period);

  const tabs = useMemo(
    () =>
      (
        [
          { id: "shuttle", label: t("tabShuttle"), icon: <Bus />, show: !!data.shuttle },
          { id: "pool", label: t("tabPool"), icon: <Car />, show: !!data.pool },
          { id: "chauffeur", label: t("tabChauffeur"), icon: <UserRound />, show: !!data.chauffeur },
        ] as const
      ).filter((x) => x.show),
    [data.shuttle, data.pool, data.chauffeur, t],
  );
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? "shuttle");
  const active = tabs.some((x) => x.id === tab) ? tab : tabs[0]?.id;


  return (
    <div className="flex flex-col gap-6">
      <SavingsHero total={data.total_savings_pkr} periodLabel={periodLabel} analysisReady={data.analysis_ready} />

      {tabs.length === 0 ? (
        <div className={cn(CARD, "p-6 text-sm text-fg-muted")}>{t("noServices")}</div>
      ) : (
        <>
          <div role="tablist" aria-label={t("servicesLabel")} className="flex w-full gap-1 overflow-x-auto rounded-lg border border-line bg-card p-1 sm:w-fit">
            {tabs.map((x) => (
              <button
                key={x.id}
                role="tab"
                type="button"
                aria-selected={active === x.id}
                onClick={() => setTab(x.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors sm:flex-none [&_svg]:size-4",
                  focusRing,
                  active === x.id ? "bg-subtle text-fg" : "text-fg-muted hover:bg-subtle hover:text-fg",
                )}
              >
                {x.icon}
                {x.label}
              </button>
            ))}
          </div>
          <p className="-mt-3 text-xs text-fg-muted">
            {data.period.is_mtd
              ? t("comparisonMtd", { days: data.period.current.days })
              : t("comparisonMonth")}
          </p>

          {active === "shuttle" && data.shuttle && <ShuttleTab s={data.shuttle} onManageBenchmarks={onManageBenchmarks} />}
          {active === "pool" && data.pool && <PoolTab p={data.pool} />}
          {active === "chauffeur" && data.chauffeur && <ChauffeurTab c={data.chauffeur} auditHref={auditHref} />}
        </>
      )}
    </div>
  );
}

// ── Shuttle ───────────────────────────────────────────────────────────────────

/** Shuttle figures for the month. `s.savings` is null while the company's savings are locked. */
export function ShuttleTab({ s, onManageBenchmarks }: { s: ShuttleSection | LockedShuttleSection; onManageBenchmarks?: () => void }) {
  const t = useTranslations("company.savings.dashboard");
  const f = useFormat();
  const k = s.kpis;
  const sv = s.savings;
  // Optional so the page still renders if the backend deploy lags behind.
  const rv = s.route_variance;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label={t("occupancy")}
          cmp={k.occupancy_pct}
          format={f.pct}
          hint={t("seatsUsedOfOffered", { used: f.n(k.seats_used.current), offered: f.n(k.seats_offered.current) })}
        />
        <Kpi label={t("totalKm")} cmp={k.total_km} format={f.km} invert hint={t("tripsCount", { count: k.trips.current ?? 0 })} />
        <Kpi label={t("avgTripDuration")} cmp={k.avg_trip_duration_min} format={f.min} invert />
        <Kpi label={t("kmPerVehicle")} cmp={k.km_per_vehicle} format={f.km} invert />
      </div>

      <SectionTitle
        title={t("shuttleSavingsTitle")}
        description={t("shuttleSavingsDescription")}
        action={
          onManageBenchmarks && (
            <Button variant="outline" size="sm" onClick={onManageBenchmarks} leftIcon={<Settings2 aria-hidden="true" />}>
              {t("manageVendorCost")}
            </Button>
          )
        }
      />

      {sv === null ? (
        <div className={cn(CARD, "flex items-start gap-3 p-5")}>
          <IconTile>
            <Lock />
          </IconTile>
          <div className="flex-1">
            <p className="text-sm font-semibold text-fg">{t("lockedTitle")}</p>
            <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("lockedDescription")}</p>
          </div>
        </div>
      ) : !sv.has_benchmarks ? (
        <div className={cn(CARD, "flex flex-col items-start gap-2 p-6")}>
          <p className="text-sm font-semibold text-fg">{t("noBenchmarkTitle")}</p>
          <p className="max-w-2xl text-sm text-fg-muted">{t("noBenchmarkDescription")}</p>
        </div>
      ) : (
        <>
          {!sv.analysis_ready && (
            <p className="alert-banner-warning text-xs">{t("analysisProgress", { days: sv.analysed_days, required: 20 })}</p>
          )}
          <SplitPanel
            items={[
              {
                title: t("vehiclesReduced"),
                amount: f.pkr(sv.vehicles_reduced_pkr),
                detail: t("vehiclesReducedDetail", { count: f.n(sv.vehicles_reduced, 1) }),
              },
              { title: t("kmReduced"), amount: f.pkr(sv.km_reduced_pkr), detail: t("kmReducedDetail", { km: f.km(sv.km_reduced) }) },
              {
                title: t("routeVariance"),
                amount: rv?.ratio_pct == null ? "—" : f.pct(rv.ratio_pct),
                warn: rv?.ratio_pct != null && rv.ratio_pct > 110,
                detail:
                  rv?.ratio_pct == null
                    ? t("routeVarianceEmpty")
                    : t("routeVarianceDetail", {
                        actual: f.km(rv.actual_km),
                        planned: f.km(rv.planned_km),
                        flagged: rv.flagged_vehicles,
                      }),
              },
            ]}
          />
          <Table
            head={[
              { label: t("colCategory") },
              { label: t("colBenchmarkVehicles"), numeric: true },
              { label: t("colActiveVehicles"), numeric: true },
              { label: t("colVehiclesSaving"), numeric: true },
              { label: t("colBenchmarkKm"), numeric: true },
              { label: t("colActualKm"), numeric: true },
              { label: t("colKmSaving"), numeric: true },
            ]}
            rows={sv.rows.map((r) => [
              <div key="c">
                <p className="font-medium">{titleCase(r.vehicle_category)}</p>
                {r.vendor_name && <p className="text-xs text-fg-muted">{t("previousVendor", { name: r.vendor_name })}</p>}
              </div>,
              f.n(r.benchmark_vehicles),
              f.n(r.active_vehicles, 1),
              f.pkr(r.vehicles_reduced_pkr),
              r.status === "OK" ? f.km(r.benchmark_km) : "—",
              f.km(r.actual_km),
              r.status === "OK" ? f.pkr(r.km_reduced_pkr) : <span className="text-xs text-fg-muted">{t("noFuelData")}</span>,
            ])}
            empty={t("noRows")}
          />
          {sv.fuel_price_pkr != null && <p className="-mt-3 text-xs text-fg-muted">{t("fuelPriceNote", { price: f.pkr(sv.fuel_price_pkr) })}</p>}
        </>
      )}

      <SectionTitle title={t("distancePerVehicle")} />
      <Table
        head={[
          { label: t("colVehicle") },
          { label: t("colTrips"), numeric: true },
          { label: t("colKm"), numeric: true },
          { label: t("occupancy"), numeric: true },
          { label: t("avgTripDuration"), numeric: true },
        ]}
        rows={s.vehicles.map((v) => [
          <div key="v">
            <p className="font-medium">{v.plate_number}</p>
            <p className="text-xs text-fg-muted">{titleCase(v.category)}</p>
          </div>,
          f.n(v.trips),
          f.km(v.km),
          f.pct(v.occupancy_pct),
          f.min(v.avg_duration_min),
        ])}
        empty={t("noTrips")}
      />
    </div>
  );
}

// ── Pool cars ─────────────────────────────────────────────────────────────────

export function PoolTab({ p }: { p: PoolSection }) {
  const t = useTranslations("company.savings.dashboard");
  const f = useFormat();
  const k = p.kpis;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label={t("tripsPerCar")}
          cmp={k.trips_per_vehicle}
          format={(v) => f.n(v, 1)}
          hint={t("tripsOnCars", { trips: f.n(k.trips.current), cars: k.pool_vehicles })}
        />
        <Kpi label={t("totalKm")} cmp={k.total_km} format={f.km} invert />
        <Kpi label={t("avgTripDuration")} cmp={k.avg_trip_duration_min} format={f.min} invert />
        <Kpi label={t("idleCars")} cmp={k.idle_vehicles} format={(v) => f.n(v)} invert />
      </div>

      {p.fueling.status === "CONNECTED" ? (
        <PoolFuelingConnected fu={p.fueling} />
      ) : (
        <div className={cn(CARD, "flex items-start gap-3 p-5")}>
          <IconTile tone="warning">
            <CreditCard />
          </IconTile>
          <div className="flex-1">
            <p className="text-sm font-semibold text-fg">{t("fuelCardTitle")}</p>
            <p className="mt-1 max-w-3xl text-sm text-fg-muted">{t("fuelCardDescription")}</p>
          </div>
        </div>
      )}

      <SectionTitle title={t("kmPerCar")} />
      <Table
        head={[
          { label: t("colVehicle") },
          { label: t("colTrips"), numeric: true },
          { label: t("colKm"), numeric: true },
          { label: t("avgTripDuration"), numeric: true },
        ]}
        rows={p.vehicles.map((v) => [
          <div key="v">
            <p className="font-medium">{v.plate_number}</p>
            <p className="text-xs text-fg-muted">{`${v.make} ${v.model}`}</p>
          </div>,
          f.n(v.trips),
          f.km(v.km),
          f.min(v.avg_duration_min),
        ])}
        empty={t("noPoolCars")}
      />
    </div>
  );
}

type ConnectedFueling = Extract<PoolFueling, { status: "CONNECTED" }>;

function useDateTime() {
  const locale = useLocale();
  return useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Karachi",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );
}

function PoolFuelingConnected({ fu }: { fu: ConnectedFueling }) {
  const t = useTranslations("company.savings.dashboard");
  const f = useFormat();
  const dt = useDateTime();
  const k = fu.kpis;
  const litres = (v: number | null) => (v == null ? "—" : t("unitLitres", { value: f.n(v, v < 100 ? 1 : 0) }));
  const kmpl = (v: number | null) => (v == null ? "—" : t("unitKmpl", { value: f.n(v, 1) }));

  const flagText = (x: FuelFlag) => {
    switch (x.type) {
      case "LOW_KM_PER_LITRE":
        return t("flagLowKmplDetail", { kmpl: kmpl(x.km_per_litre), rated: kmpl(x.rated_km_per_litre), km: f.km(x.odometer_km) });
      case "UNTRACKED_KM":
        return t("flagUntrackedDetail", {
          odo: f.km(x.odometer_km),
          trips: f.km(x.trip_km),
          gap: f.km(x.odometer_km != null && x.trip_km != null ? x.odometer_km - x.trip_km : null),
        });
      case "RAPID_REFILL":
        return t("flagRapidDetail", { hours: f.n(x.hours_since_previous, 1) });
      case "OFF_HOURS":
        return t("flagOffHoursDetail");
      case "LOCATION_MISMATCH":
        return t("flagLocationDetail", {
          km: f.km(x.distance_km ?? null),
          place: x.vehicle_location?.label ?? "—",
        });
    }
  };
  const flagLabel: Record<FuelFlag["type"], string> = {
    LOW_KM_PER_LITRE: t("flagLowKmpl"),
    UNTRACKED_KM: t("flagUntracked"),
    RAPID_REFILL: t("flagRapid"),
    OFF_HOURS: t("flagOffHours"),
    LOCATION_MISMATCH: t("flagLocation"),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className={cn(CARD, "flex items-start gap-3 p-5")}>
        <IconTile tone="success">
          <CreditCard />
        </IconTile>
        <div className="flex-1">
          <p className="text-sm font-semibold text-fg">{t("fuelCardsConnectedTitle", { providers: fu.providers.join(", ") })}</p>
          <p className="mt-1 max-w-3xl text-sm text-fg-muted">
            {t("fuelCardsConnectedDescription", { count: fu.cards.length })}
            {fu.last_synced_at && <> · {t("lastSynced", { time: dt.format(new Date(fu.last_synced_at)) })}</>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t("fuelLitres")} cmp={k.litres} format={litres} invert />
        <Kpi label={t("fuelSpend")} cmp={k.spend_pkr} format={f.pkr} invert />
        <Kpi label={t("kmPerLitre")} cmp={k.km_per_litre} format={kmpl} />
        <Kpi label={t("fuelingErrors")} cmp={k.flagged_fuelings} format={(v) => f.n(v)} invert />
      </div>

      <SectionTitle title={t("fuelPerCar")} description={t("fuelPerCarDescription")} />
      <Table
        head={[
          { label: t("colVehicle") },
          { label: t("colLitres"), numeric: true },
          { label: t("colFuelSpend"), numeric: true },
          { label: t("colOdometerKm"), numeric: true },
          { label: t("colTripKm"), numeric: true },
          { label: t("kmPerLitre"), numeric: true },
          { label: t("colFlags"), numeric: true },
        ]}
        rows={fu.vehicles.map((v) => {
          const low = v.km_per_litre != null && v.rated_km_per_litre != null && v.km_per_litre < v.rated_km_per_litre * 0.85;
          return [
            <div key="v">
              <p className="font-medium">{v.plate_number}</p>
              <p className="text-xs text-fg-muted">{`${v.make} ${v.model}`}</p>
            </div>,
            litres(v.litres),
            f.pkr(v.spend_pkr),
            f.km(v.odometer_km),
            f.km(v.trip_km),
            <div key="k">
              <p className={cn("font-medium", low && "text-danger-ink")}>{kmpl(v.km_per_litre)}</p>
              <p className="text-xs text-fg-muted">{t("ratedKmpl", { value: kmpl(v.rated_km_per_litre) })}</p>
            </div>,
            v.flags ? <span key="f" className="font-medium text-danger-ink">{f.n(v.flags)}</span> : f.n(0),
          ];
        })}
        empty={t("noFuelings")}
      />

      <SectionTitle title={t("fuelingErrorsTitle")} description={t("fuelingErrorsDescription")} />
      <Table
        head={[
          { label: t("colWhen") },
          { label: t("colVehicle") },
          { label: t("colIssue") },
          { label: t("colLitres"), numeric: true },
          { label: t("colAmount"), numeric: true },
        ]}
        rows={fu.flags.map((x) => [
          <div key="w">
            <p className="font-medium">{dt.format(new Date(x.transacted_at))}</p>
            <p className="text-xs text-fg-muted">{x.station_name}</p>
          </div>,
          x.plate_number ?? "—",
          <div key="i" className="max-w-sm">
            <Badge tone="danger">{flagLabel[x.type]}</Badge>
            <p className="mt-1 text-xs text-fg-muted">{flagText(x)}</p>
            {x.pump_location && x.vehicle_location && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${x.vehicle_location.lat},${x.vehicle_location.lng}&destination=${x.pump_location.lat},${x.pump_location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("mt-1 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-brand-ink underline-offset-2 hover:underline", focusRing)}
              >
                <MapPin className="size-3.5" aria-hidden="true" />
                {t("flagLocationMap")}
              </a>
            )}
          </div>,
          litres(x.litres),
          f.pkr(x.amount_pkr),
        ])}
        empty={t("noFuelingErrors")}
      />

      <SectionTitle title={t("fuelCardsTitle")} />
      <Table
        head={[
          { label: t("colCard") },
          { label: t("colVehicle") },
          { label: t("colDriver") },
          { label: t("colFuelings"), numeric: true },
          { label: t("colSpentVsLimit"), numeric: true },
        ]}
        rows={fu.cards.map((c) => {
          const over = c.monthly_limit_pkr != null && c.spent_pkr > c.monthly_limit_pkr;
          return [
            <div key="c">
              <p className="font-medium tabular-nums">•••• {c.card_last4}</p>
              <p className="text-xs text-fg-muted">
                {c.provider} · {titleCase(c.fuel_type)}
                {c.status !== "ACTIVE" && <> · {titleCase(c.status)}</>}
              </p>
            </div>,
            c.plate_number ?? "—",
            c.driver_name ?? "—",
            f.n(c.fuelings),
            <div key="s">
              <p className={cn("font-medium", over && "text-danger-ink")}>{f.pkr(c.spent_pkr)}</p>
              <p className="text-xs text-fg-muted">{c.monthly_limit_pkr != null ? t("ofLimit", { limit: f.pkr(c.monthly_limit_pkr) }) : t("noLimit")}</p>
            </div>,
          ];
        })}
        empty={t("noFuelCards")}
      />
    </div>
  );
}

// ── Chauffeur ─────────────────────────────────────────────────────────────────

export function ChauffeurTab({ c, auditHref }: { c: ChauffeurSection; auditHref?: string }) {
  const t = useTranslations("company.savings.dashboard");
  const f = useFormat();
  const k = c.kpis;
  // Fallback keeps the tab rendering if the web app deploys before the backend.
  const b = c.cost_breakdown ?? { rental: 0, fuel: 0, overtime: 0, parking: 0, toll: 0 };
  const parts = [
    { key: "rental", label: t("costRental"), value: b.rental },
    { key: "fuel", label: t("costFuel"), value: b.fuel },
    { key: "overtime", label: t("costOvertime"), value: b.overtime },
    { key: "parking", label: t("costParking"), value: b.parking },
    { key: "toll", label: t("costToll"), value: b.toll },
  ];
  const partsTotal = parts.reduce((s, x) => s + x.value, 0);
  const a = c.audit;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t("rides")} cmp={k.rides} format={(v) => f.n(v)} />
        <Kpi label={t("totalKm")} cmp={k.total_km} format={f.km} invert />
        <Kpi label={t("avgTripDuration")} cmp={k.avg_trip_duration_min} format={f.min} invert />
        <Kpi
          label={t("avgCostPerRide")}
          cmp={k.avg_cost_per_ride}
          format={f.pkr}
          invert
          hint={c.external_vendor_rides > 0 ? t("excludesVendorRides", { count: c.external_vendor_rides }) : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cn(CARD, "flex flex-col gap-4 p-5")}>
          <div>
            <p className="text-sm font-semibold text-fg">{t("costBreakdown")}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{t("costBreakdownDescription")}</p>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-fg tabular-nums">{f.pkr(partsTotal)}</p>
          <div className="mt-1 flex flex-col gap-2">
            {partsTotal === 0 ? (
              <p className="text-sm text-fg-muted">{t("noRides")}</p>
            ) : (
              parts.map((x) => (
                <div key={x.key} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-fg-muted">{x.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(x.value / partsTotal) * 100}%` }} />
                  </div>
                  <span className="w-32 shrink-0 text-end font-medium text-fg tabular-nums">{f.pkr(x.value)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={cn(CARD, "flex flex-col gap-4 p-5")}>
          <div>
            <p className="text-sm font-semibold text-fg">{t("auditTitle")}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{t("auditDescription")}</p>
          </div>
          {a.external_vendor_trips === 0 ? (
            <p className="text-sm text-fg-muted">{t("auditNone")}</p>
          ) : (
            <>
              <dl className="flex flex-col text-sm">
                {[
                  { k: "audited", label: t("auditedTrips"), value: t("auditedOf", { audited: a.audited_trips, total: a.external_vendor_trips }) },
                  {
                    k: "caught",
                    label: t("overchargeCaught"),
                    value: f.pkr(a.overcharge_caught_pkr),
                    cls: a.overcharge_caught_pkr > 0 ? "text-danger-ink" : undefined,
                  },
                  { k: "charged", label: t("vendorCharged"), value: f.pkr(a.vendor_charged_pkr) },
                  { k: "expected", label: t("systemAmount"), value: f.pkr(a.expected_pkr) },
                ].map((row) => (
                  <div key={row.k} className="flex items-baseline justify-between gap-4 py-1.5">
                    <dt className="text-fg-secondary">{row.label}</dt>
                    <dd className={cn("whitespace-nowrap font-medium tabular-nums text-fg", row.cls)}>{row.value}</dd>
                  </div>
                ))}
                {a.audited_trips > 0 && a.net_difference_pkr != null && (
                  <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-3">
                    <dt>
                      <span className="block font-semibold text-fg">{t("auditNet")}</span>
                      <span className="block text-xs text-fg-muted">{a.net_difference_pkr >= 0 ? t("auditNetPositive") : t("auditNetNegative")}</span>
                    </dt>
                    <dd className={cn("whitespace-nowrap font-semibold tabular-nums", a.net_difference_pkr < 0 ? "text-danger-ink" : "text-success-ink")}>
                      {a.net_difference_pkr < 0 ? "−" : "+"}
                      {f.pkr(Math.abs(a.net_difference_pkr))}
                    </dd>
                  </div>
                )}
              </dl>
              {a.unaudited_trips > 0 && (
                <p className="text-sm text-fg-muted">
                  {t("unaudited", { count: a.unaudited_trips })}{" "}
                  {auditHref && (
                    <Link href={auditHref} className={cn("rounded-sm font-medium text-brand-ink underline-offset-2 hover:underline", focusRing)}>
                      {t("auditNow")}
                    </Link>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
