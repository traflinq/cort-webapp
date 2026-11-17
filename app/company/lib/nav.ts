import type { LucideIcon } from "lucide-react";
import { BarChart3, Building2, CalendarDays, Car, FileBarChart, FileSpreadsheet, LayoutDashboard, Receipt, Route, Users } from "lucide-react";
import type { TrialModules } from "@/app/lib/types/auth-types";
import { stripSaudiPrefix } from "@/app/lib/i18n/saudi-route";

/** Company portal navigation. The only place nav entries are defined. */

export type NavItem = { href: string; labelKey: string; icon: LucideIcon };
export type NavGroup = { titleKey: string | null; items: NavItem[] };

type FeatureLike = { feature_key: string; is_enabled: boolean };

/** Company IDs for which the Invoices entry is temporarily hidden. */
const HIDE_INVOICING_COMPANY_IDS = new Set<number>([2]);

const TRIAL_FLEET_PREFIXES = ["/company/fleet"];
const TRIAL_POOL_PREFIXES = ["/company/bookings"];
const TRIAL_SHUTTLE_PREFIXES = ["/company/routes", "/company/employees"];

export function trialHasPool(modules?: TrialModules): boolean {
  return modules === "pool" || modules === "both" || !modules;
}

export function trialHasShuttle(modules?: TrialModules): boolean {
  return modules === "shuttle" || modules === "both";
}

/** Trial accounts may only open the dashboard, the fleet and their module's pages. */
export function isTrialAllowedPath(pathname: string, modules?: TrialModules): boolean {
  const normalized = stripSaudiPrefix(pathname);
  if (normalized === "/company") return true;
  const prefixes: string[] = [...TRIAL_FLEET_PREFIXES];
  if (trialHasPool(modules)) prefixes.push(...TRIAL_POOL_PREFIXES);
  if (trialHasShuttle(modules)) prefixes.push(...TRIAL_SHUTTLE_PREFIXES);
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

const ITEMS = {
  dashboard: { href: "/company", labelKey: "nav.dashboard", icon: LayoutDashboard },
  analytics: { href: "/company/analytics", labelKey: "nav.analytics", icon: BarChart3 },
  bookings: { href: "/company/bookings", labelKey: "nav.bookings", icon: CalendarDays },
  routes: { href: "/company/routes", labelKey: "nav.routes", icon: Route },
  fleet: { href: "/company/fleet", labelKey: "nav.poolFleet", icon: Car },
  shuttleReports: { href: "/company/reports/shuttle", labelKey: "nav.shuttleReports", icon: FileBarChart },
  chauffeurReports: { href: "/company/reports/chauffeur", labelKey: "nav.chauffeurReports", icon: FileSpreadsheet },
  employees: { href: "/company/employees", labelKey: "nav.employees", icon: Users },
  vendors: { href: "/company/vendors", labelKey: "nav.vendors", icon: Building2 },
  invoices: { href: "/company/invoicing", labelKey: "nav.invoices", icon: Receipt },
} satisfies Record<string, NavItem>;

export function buildCompanyNav({
  servicesEnabled,
  features,
  hasVendors,
  isTrial,
  trialModules,
  companyId,
}: {
  servicesEnabled: { shuttle_enabled: boolean; chauffeur_enabled: boolean };
  features: FeatureLike[];
  hasVendors: boolean;
  isTrial: boolean;
  trialModules?: TrialModules;
  companyId?: number | null;
}): NavGroup[] {
  if (isTrial) {
    const items: NavItem[] = [ITEMS.dashboard];
    if (trialHasPool(trialModules) || trialHasShuttle(trialModules)) items.push(ITEMS.fleet);
    if (trialHasPool(trialModules)) items.push(ITEMS.bookings);
    if (trialHasShuttle(trialModules)) items.push(ITEMS.routes, ITEMS.employees);
    return [{ titleKey: null, items }];
  }

  const has = (key: string) => features.find((f) => f.feature_key === key)?.is_enabled ?? false;
  const { shuttle_enabled: shuttle, chauffeur_enabled: chauffeur } = servicesEnabled;
  const anyService = shuttle || chauffeur;

  const overview: NavItem[] = [ITEMS.dashboard];
  if (anyService) overview.push(ITEMS.analytics);

  const operations: NavItem[] = [];
  if (chauffeur) operations.push(ITEMS.bookings);
  if (shuttle) operations.push(ITEMS.routes);
  if ((chauffeur && has("chauffeur_self_managed")) || (shuttle && has("shuttle_self_managed"))) operations.push(ITEMS.fleet);

  const reports: NavItem[] = [];
  if (shuttle) reports.push(ITEMS.shuttleReports);
  if (chauffeur) reports.push(ITEMS.chauffeurReports);

  const administration: NavItem[] = [ITEMS.employees];
  if (hasVendors) administration.push(ITEMS.vendors);
  const hideInvoicing = companyId != null && HIDE_INVOICING_COMPANY_IDS.has(companyId);
  if (!hideInvoicing && (has("chauffeur_cort_managed") || has("shuttle_cort_managed"))) administration.push(ITEMS.invoices);

  return [
    { titleKey: "nav.overview", items: overview },
    { titleKey: "nav.operations", items: operations },
    { titleKey: "nav.reportsGroup", items: reports },
    { titleKey: "nav.administration", items: administration },
  ].filter((g) => g.items.length > 0);
}

/** The nav item for the current path: exact match first, then the longest matching prefix. */
export function activeNavItem(groups: NavGroup[], pathname: string): { item: NavItem; group: NavGroup } | null {
  const path = stripSaudiPrefix(pathname);
  let best: { item: NavItem; group: NavGroup } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      if (path === item.href) return { item, group };
      if (item.href !== "/company" && path.startsWith(`${item.href}/`) && (!best || item.href.length > best.item.href.length)) {
        best = { item, group };
      }
    }
  }
  return best;
}
