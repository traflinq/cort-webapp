"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bus,
  Car,
  ChevronUp,
  FileBarChart,
  List,
  Pencil,
  RefreshCw,
  Route as RouteIcon,
  Users,
  Wallet,
  Sparkles,
} from "lucide-react";
import { useCompanyLocale } from "../lib/locale-context";
import { formatLocaleNumber } from "../../lib/i18n/format";
import { CountBadge, IconCircleButton, Illustration, IllustrationTile, Panel, PanelHeading, PillButton, PromoCard, SegmentedRing, StatTile, UnderlineTabs, type IllustrationName } from "../ui";
import type { DashboardData } from "../types";
import type { DashboardStats } from "../../lib/store/slices/dashboardSlice";

type RosterChanges = {
  added_count: number;
  removed_count: number;
  top_route: { route_id: number; route_name: string; added_count: number } | null;
};

function useCompact() {
  const { locale } = useCompanyLocale();
  return (value: number) =>
    formatLocaleNumber(value, locale, { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/* ── Live mobility ("Active Delivery") ─────────────────────────────────── */

export function LiveMobilityCard({
  mobility,
  hasChauffeur,
  hasShuttle,
  topPassenger,
  rosterChanges,
  bookingsHref,
  routeHref,
}: {
  mobility: DashboardData["mobility"];
  hasChauffeur: boolean;
  hasShuttle: boolean;
  topPassenger: DashboardData["employeeUsage"]["topPassenger"];
  rosterChanges: RosterChanges;
  bookingsHref: string;
  routeHref: (id: number) => string;
}) {
  const t = useTranslations("company.overview");
  const tm = useTranslations("company.mobility");
  const fmt = useCompact();

  const tiles = [
    { value: fmt(mobility.activeRides), label: tm("activeRidesLabel") },
    { value: fmt(mobility.employeesTraveling), label: tm("employeesTravelingLabel") },
    hasShuttle
      ? { value: fmt(mobility.shuttlesRunning), label: tm("shuttlesRunningLabel") }
      : { value: fmt(mobility.upcomingBookings), label: tm("upcomingRidesLabel") },
  ];

  const showPassenger = hasChauffeur && topPassenger.rides > 0;
  const topRoute = hasShuttle ? rosterChanges.top_route : null;

  return (
    <Panel className="flex h-full flex-col gap-6">
      <PanelHeading title={t("liveMobility")} subtitle={t("rightNow")} />
      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((tile) => (
          <StatTile key={tile.label} value={tile.value} label={tile.label} />
        ))}
      </div>

      <div className="mt-auto">
        <div className="mb-3 text-[15px] font-medium text-[var(--text-primary)]">
          {showPassenger ? t("topPassenger") : topRoute ? t("topRoute") : t("upcoming")}
        </div>
        {showPassenger ? (
          <div className="flex items-center gap-4">
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--tone-brand-soft)] text-lg font-medium text-[var(--cort-orange)]">
              {initials(topPassenger.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg text-[var(--text-primary)]">{topPassenger.name}</div>
              <div className="text-[15px] text-[var(--text-muted)]">{t("ridesThisMonth", { count: topPassenger.rides })}</div>
            </div>
            <IconCircleButton label={t("viewBookings")} variant="navy" size="lg" href={bookingsHref}>
              <Car strokeWidth={1.8} />
            </IconCircleButton>
          </div>
        ) : topRoute ? (
          <div className="flex items-center gap-4">
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--tone-brand-soft)] text-[var(--cort-orange)]">
              <RouteIcon size={22} strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg text-[var(--text-primary)]">{topRoute.route_name}</div>
              <div className="text-[15px] text-[var(--text-muted)]">{t("peopleAdded", { count: topRoute.added_count })}</div>
            </div>
            <IconCircleButton label={t("openRoute")} variant="navy" size="lg" href={routeHref(topRoute.route_id)}>
              <RouteIcon strokeWidth={1.8} />
            </IconCircleButton>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <IllustrationTile name="calendar" size="md" className="rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="text-lg text-[var(--text-primary)] tabular-nums">{fmt(mobility.upcomingBookings)}</div>
              <div className="text-[15px] text-[var(--text-muted)]">{tm("upcomingRidesLabel")}</div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ── Budget pace ring ("Speed Tracking") ───────────────────────────────── */

export function BudgetPaceCard({
  spend,
  budget,
  activeEmployees,
  totalEmployees,
  hasChauffeur,
}: {
  spend: number;
  budget: number;
  activeEmployees: number;
  totalEmployees: number;
  hasChauffeur: boolean;
}) {
  const t = useTranslations("company.overview");
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthElapsed = now.getDate() / daysInMonth;

  if (hasChauffeur) {
    const used = budget > 0 ? spend / budget : 0;
    return (
      <Panel className="flex h-full flex-col">
        <PanelHeading title={t("budgetPace")} />
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[15px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-[var(--cort-orange)]" />{t("spent")}</span>
          <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-[var(--cort-navy-ring,var(--cort-navy))]" />{t("monthElapsed")}</span>
        </div>
        <SegmentedRing
          outer={used}
          inner={monthElapsed}
          label={t("budgetPaceAria", { used: Math.round(used * 100), elapsed: Math.round(monthElapsed * 100) })}
          className="mx-auto mt-4 w-full max-w-[220px]"
        >
          <span className="text-[2.5rem] font-medium leading-none text-[var(--text-primary)] tabular-nums">{Math.round(used * 100)}%</span>
          <span className="mt-1.5 text-sm text-[var(--text-muted)]">{t("ofBudget")}</span>
        </SegmentedRing>
      </Panel>
    );
  }

  const adoption = totalEmployees > 0 ? activeEmployees / totalEmployees : 0;
  return (
    <Panel className="flex h-full flex-col">
      <PanelHeading title={t("employeeAdoption")} />
      <div className="mt-2 flex items-center gap-2 text-[15px] text-[var(--text-muted)]">
        <span className="size-2.5 rounded-full bg-[var(--cort-orange)]" />
        {t("activeOfTotal", { active: activeEmployees, total: totalEmployees })}
      </div>
      <SegmentedRing outer={adoption} label={t("employeeAdoption")} className="mx-auto mt-4 w-full max-w-[220px]">
        <span className="text-[2.5rem] font-medium leading-none text-[var(--text-primary)] tabular-nums">{Math.round(adoption * 100)}%</span>
        <span className="mt-1.5 text-sm text-[var(--text-muted)]">{t("active")}</span>
      </SegmentedRing>
    </Panel>
  );
}

/* ── Balance / savings promo ("Premium+ Plan") ─────────────────────────── */

export function BalancePromoCard({
  outstandingAmount,
  invoiceCount,
  estimatedSavings,
  invoicesHref,
}: {
  outstandingAmount: number;
  invoiceCount: number;
  estimatedSavings: number;
  invoicesHref: string | null;
}) {
  const t = useTranslations("company.overview");
  const tCurrency = useTranslations("common.currency");
  const fmt = useCompact();
  const hasOutstanding = outstandingAmount > 0;

  return (
    <PromoCard
      className="h-full min-h-[260px]"
      chip={hasOutstanding ? t("outstanding") : t("allClear")}
      icon={
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur-sm">
          {hasOutstanding ? <Wallet strokeWidth={1.6} className="!size-6" /> : <Sparkles strokeWidth={1.6} className="!size-6" />}
        </span>
      }
      title={hasOutstanding ? t("unpaidInvoices", { count: invoiceCount }) : t("estimatedSavings")}
      value={fmt(hasOutstanding ? outstandingAmount : estimatedSavings)}
      suffix={tCurrency("pkr")}
      action={
        invoicesHref ? (
          <PillButton variant="white" className="w-full" href={invoicesHref}>
            {hasOutstanding ? t("viewInvoices") : t("invoices")}
          </PillButton>
        ) : undefined
      }
    />
  );
}

/* ── Service tabs ("Truck / Van / Car") ────────────────────────────────── */

type ServiceTab = "chauffeur" | "shuttle" | "employees";

export function ServiceTabsCard({
  data,
  stats,
  rosterChanges,
  hasChauffeur,
  hasShuttle,
  onRefresh,
  refreshing,
  hrefs,
}: {
  data: Pick<DashboardData, "takingCare" | "valueDelivered" | "cost" | "employeeUsage">;
  stats: DashboardStats;
  rosterChanges: RosterChanges;
  hasChauffeur: boolean;
  hasShuttle: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  hrefs: { bookings: string; routes: string; employees: string };
}) {
  const t = useTranslations("company.overview");
  const tCurrency = useTranslations("common.currency");
  const fmt = useCompact();

  const tabs = useMemo(() => {
    const list: { value: ServiceTab; label: string; icon: typeof Car }[] = [];
    if (hasChauffeur) list.push({ value: "chauffeur", label: t("chauffeur"), icon: Car });
    if (hasShuttle) list.push({ value: "shuttle", label: t("shuttle"), icon: Bus });
    list.push({ value: "employees", label: t("employees"), icon: Users });
    return list;
  }, [hasChauffeur, hasShuttle, t]);

  const [tab, setTab] = useState<ServiceTab>(tabs[0].value);
  const current = tabs.some((item) => item.value === tab) ? tab : tabs[0].value;
  const pkr = (value: number) => `${tCurrency("pkr")} ${fmt(value)}`;

  const view = {
    chauffeur: {
      href: hrefs.bookings,
      image: "car" as IllustrationName,
      metrics: [
        { value: fmt(data.takingCare.ridesCompleted), label: t("completedThisMonth") },
        { value: fmt(data.valueDelivered.activeRides), label: t("activeNow") },
        { value: pkr(data.valueDelivered.avgTripCost), label: t("avgTripCost") },
      ],
      code: t("chauffeurThisMonth"),
      primary: t("ridesCount", { count: data.takingCare.ridesCompleted }),
      secondary: pkr(data.cost.totalSpendMTD),
      secondaryTotal: pkr(data.cost.budget),
    },
    shuttle: {
      href: hrefs.routes,
      image: "bus" as IllustrationName,
      metrics: [
        { value: fmt(stats.shuttle.monthlyTrips), label: t("tripsThisMonth") },
        { value: fmt(stats.shuttle.totalRoutes), label: t("routes") },
        { value: `+${fmt(rosterChanges.added_count)}`, label: t("addedToRoutes") },
      ],
      code: t("shuttleThisMonth"),
      primary: t("tripsCount", { count: stats.shuttle.monthlyTrips }),
      secondary: fmt(stats.shuttle.totalTripsAllTime),
      secondaryTotal: t("lifetime"),
    },
    employees: {
      href: hrefs.employees,
      image: "people" as IllustrationName,
      metrics: [
        { value: fmt(data.employeeUsage.activeEmployees), label: t("activeEmployees") },
        { value: fmt(data.employeeUsage.totalEmployees), label: t("registered") },
        hasChauffeur
          ? { value: formatAvg(data.employeeUsage.avgRidesPerEmployee), label: t("avgRidesPerEmployee") }
          : { value: fmt(data.employeeUsage.departmentUsage.length), label: t("departments") },
      ],
      code: t("workforce"),
      primary: data.employeeUsage.departmentUsage[0]?.name ?? "—",
      secondary: fmt(data.employeeUsage.activeEmployees),
      secondaryTotal: fmt(data.employeeUsage.totalEmployees),
    },
  }[current];

  return (
    <Panel className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <UnderlineTabs items={tabs} value={current} onChange={setTab} ariaLabel={t("services")} />
        <div className="flex items-center gap-2.5">
          <IconCircleButton label={t("refresh")} variant="outline" size="md" onClick={onRefresh}>
            <RefreshCw className={refreshing ? "animate-spin" : ""} strokeWidth={1.6} />
          </IconCircleButton>
          <IconCircleButton label={t("openList")} variant="outline" size="md" href={view.href}>
            <List strokeWidth={1.6} />
          </IconCircleButton>
        </div>
      </div>

      <div className="grid min-h-[180px] flex-1 grid-cols-1 items-center gap-5 sm:grid-cols-[1fr_auto]">
        <div className="flex h-full min-h-[160px] items-center justify-center">
          <div className="relative flex items-center justify-center">
            <Illustration key={current} name={view.image} size={188} className="animate-fade-in" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:w-36 sm:grid-cols-1">
          {view.metrics.map((metric) => (
            <StatTile key={metric.label} value={metric.value} label={metric.label} className="py-3" />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-[var(--divider)] pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <Pencil size={20} strokeWidth={1.6} className="shrink-0 text-[var(--text-muted)]" />
          <span className="truncate text-2xl font-medium text-[var(--text-primary)]">{view.code}</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[17px] tabular-nums">
          <span className="text-[var(--text-primary)]">{view.primary}</span>
          <span>
            <span className="text-[var(--text-primary)]">{view.secondary}</span>
            <span className="text-[var(--text-muted)]"> / {view.secondaryTotal}</span>
          </span>
        </div>
      </div>
    </Panel>
  );
}

function formatAvg(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "0";
}

/* ── Insights list ("Additional Items") ────────────────────────────────── */

type InsightItem = { id: string; title: string; lines: string[]; severity?: string; illustration: IllustrationName };

/** Pick a 3D illustration from an insight's type/label. */
function insightIllustration(text: string): IllustrationName {
  const s = text.toLowerCase();
  if (s.includes("detour") || s.includes("route")) return "motorway";
  if (s.includes("package")) return "package";
  if (s.includes("fuel")) return "fuel";
  if (s.includes("spend") || s.includes("saving") || s.includes("cost")) return "moneybag";
  if (s.includes("shuttle")) return "bus";
  if (s.includes("department") || s.includes("passenger")) return "people";
  return "bulb";
}

export function InsightsPanel({
  stats,
  insights,
  onEditBudget,
  reportsHref,
}: {
  stats: DashboardStats;
  insights: string[];
  onEditBudget: (() => void) | null;
  reportsHref: string | null;
}) {
  const t = useTranslations("company.overview");
  const tCurrency = useTranslations("common.currency");
  const fmt = useCompact();
  const [open, setOpen] = useState(true);

  const items: InsightItem[] = useMemo(() => {
    const leakage = stats.costLeakage;
    const generated: InsightItem[] = insights.map((text, i) => ({ id: `insight-${i}`, title: text, lines: [], illustration: insightIllustration(text) }));
    if (leakage?.aiInsightsEnabled && leakage.insights.length > 0) {
      const ai: InsightItem[] = leakage.insights.map((insight) => ({
        id: `ai-${insight.id}`,
        title: insight.label,
        lines: [
          insight.data.summary,
          insight.estimated_saving_pkr > 0 ? t("saveUpTo", { amount: `${tCurrency("pkr")} ${fmt(insight.estimated_saving_pkr)}` }) : "",
        ].filter(Boolean),
        severity: insight.severity,
        illustration: insightIllustration(`${insight.insight_type} ${insight.label}`),
      }));
      return [...ai, ...generated];
    }
    return generated;
  }, [stats.costLeakage, insights, t, tCurrency, fmt]);


  return (
    <Panel className="flex h-full flex-col gap-5">
      <PanelHeading
        title={t("insights")}
        subtitle={
          <span className="inline-flex items-center gap-2.5 text-[15px]">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-[var(--tile-bg)] text-xs text-[var(--text-primary)] tabular-nums">{items.length}</span>
            {t("insightsSubtitle")}
          </span>
        }
        actions={
          <IconCircleButton label={open ? t("collapse") : t("expand")} variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <ChevronUp className={open ? "" : "rotate-180"} strokeWidth={1.8} />
          </IconCircleButton>
        }
      />

      {open && (
        <ul className="-mx-1 flex max-h-[560px] flex-1 flex-col gap-2 overflow-y-auto px-1">
          {items.map((item, i) => (
            <li key={item.id} className={`flex items-center gap-4 rounded-[20px] p-3 ${i === 0 ? "bg-[var(--tile-bg)]" : ""}`}>
              <IllustrationTile
                name={item.illustration}
                size="lg"
                className={i === 0 ? "bg-[var(--bg-card)]" : ""}
                badge={<CountBadge value={i + 1} />}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[17px] leading-snug text-[var(--text-primary)]">{item.title}</div>
                {item.lines.map((line) => (
                  <div key={line} className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{line}</div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(onEditBudget || reportsHref) && (
        <div className="mt-auto flex flex-wrap gap-3">
          {reportsHref && (
            <PillButton variant="primary" icon={<FileBarChart strokeWidth={1.8} />} href={reportsHref}>
              {t("viewReports")}
            </PillButton>
          )}
          {onEditBudget && (
            <PillButton variant="outline" onClick={onEditBudget}>
              {t("editBudget")}
            </PillButton>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ── Demand pattern (seasonality) ─────────────────────────────────────── */

export function DemandPatternCard({ seasonality }: { seasonality: DashboardData["seasonality"] }) {
  const t = useTranslations("company.overview");
  const td = useTranslations("company.dashboard");
  const days = [
    { label: td("peakDay"), value: seasonality.highDemandDay, tone: "orange" as const, icon: "trend" as IllustrationName },
    { label: td("quietDay"), value: seasonality.lowDemandDay, tone: "navy" as const, icon: "calendar" as IllustrationName },
  ];
  return (
    <Panel className="flex h-full flex-col gap-5">
      <PanelHeading title={t("demandPattern")} subtitle={t("demandPatternSubtitle")} />
      <div className="flex flex-1 flex-col justify-center gap-3">
        {days.map((day) => (
          <div key={day.label} className="flex items-center gap-4 rounded-[var(--radius-tile)] bg-[var(--tile-bg)] p-3">
            <IllustrationTile name={day.icon} tone={day.tone} className="bg-[var(--bg-card)]" />
            <div className="min-w-0">
              <div className="text-sm text-[var(--text-muted)]">{day.label}</div>
              <div className="truncate text-lg font-medium text-[var(--text-primary)]">{day.value}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
