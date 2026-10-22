/**
 * The single navigation config for the company portal. Pure functions: the shell feeds in
 * services, feature flags, vendor links, trial state and the Saudi base path, and gets groups
 * the shared PortalShell can render. Labels are resolved here so the shell only sees strings.
 */
import { BarChart2, Building2, Calendar, Car, FileBarChart, FileSpreadsheet, LayoutDashboard, Map, Receipt, Users } from "lucide-react";
import type { PortalNavGroup, PortalNavItem } from "@/app/ui/shell/nav-types";
import type { TrialModules } from "@/app/lib/types/auth-types";
import { stripSaudiPrefix, withSaudiBase } from "@/app/lib/i18n/saudi-route";
import { HIDE_INVOICING_COMPANY_IDS } from "./constants";

export type ServicesEnabled = { shuttle_enabled: boolean; chauffeur_enabled: boolean };
export type FeatureLike = { feature_key: string; is_enabled: boolean };

export type CompanyNavInput = {
  servicesEnabled: ServicesEnabled;
  features: FeatureLike[];
  hasVendors: boolean;
  isTrial: boolean;
  trialModules?: TrialModules;
  companyId?: number | null;
  /** "" or "/sa". */
  basePath: string;
  /** useTranslations("company") */
  t: (key: string) => string;
};

const TRIAL_FLEET_PREFIXES = ["/company/fleet"];
const TRIAL_POOL_PREFIXES = ["/company/bookings"];
const TRIAL_SHUTTLE_PREFIXES = ["/company/routes", "/company/employees"];

export function trialHasPool(modules?: TrialModules): boolean {
  return modules === "pool" || modules === "both" || !modules;
}

export function trialHasShuttle(modules?: TrialModules): boolean {
  return modules === "shuttle" || modules === "both";
}

/** Trial accounts may only open the pages their modules unlock; the shell redirects everything else home. */
export function isTrialAllowedPath(pathname: string, modules?: TrialModules): boolean {
  const normalized = stripSaudiPrefix(pathname);
  if (normalized === "/company") return true;
  const prefixes: string[] = [...TRIAL_FLEET_PREFIXES];
  if (trialHasPool(modules)) prefixes.push(...TRIAL_POOL_PREFIXES);
  if (trialHasShuttle(modules)) prefixes.push(...TRIAL_SHUTTLE_PREFIXES);
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export function buildCompanyNav({ servicesEnabled, features, hasVendors, isTrial, trialModules, companyId, basePath, t }: CompanyNavInput): PortalNavGroup[] {
  const item = (path: string, labelKey: string, icon: PortalNavItem["icon"]): PortalNavItem => ({
    href: withSaudiBase(path, basePath),
    label: t(labelKey),
    icon,
  });

  if (isTrial) {
    const items: PortalNavItem[] = [item("/company", "nav.dashboard", LayoutDashboard)];
    if (trialHasPool(trialModules) || trialHasShuttle(trialModules)) items.push(item("/company/fleet", "nav.poolFleet", Car));
    if (trialHasPool(trialModules)) items.push(item("/company/bookings", "nav.bookings", Calendar));
    if (trialHasShuttle(trialModules)) {
      items.push(item("/company/routes", "nav.routeRoster", Map));
      items.push(item("/company/employees", "nav.employees", Users));
    }
    return [{ id: "trial", label: "", items }];
  }

  const hasFeature = (key: string) => features.find((f) => f.feature_key === key)?.is_enabled ?? false;
  const hideInvoicing = companyId != null && HIDE_INVOICING_COMPANY_IDS.has(companyId);

  const operations: PortalNavItem[] = [];
  if (servicesEnabled.shuttle_enabled) operations.push(item("/company/routes", "nav.routeRoster", Map));
  if (servicesEnabled.chauffeur_enabled) operations.push(item("/company/bookings", "nav.bookings", Calendar));
  if (servicesEnabled.shuttle_enabled) operations.push(item("/company/reports/shuttle", "nav.shuttleReports", FileBarChart));
  if (servicesEnabled.chauffeur_enabled) operations.push(item("/company/reports/chauffeur", "nav.chauffeurReports", FileSpreadsheet));
  if (
    (servicesEnabled.chauffeur_enabled && hasFeature("chauffeur_self_managed")) ||
    (servicesEnabled.shuttle_enabled && hasFeature("shuttle_self_managed"))
  ) {
    operations.push(item("/company/fleet", "nav.poolFleet", Car));
  }
  if (servicesEnabled.shuttle_enabled || servicesEnabled.chauffeur_enabled) {
    operations.push(item("/company/fleet-analytics", "nav.fleetAnalytics", BarChart2));
  }

  const administration: PortalNavItem[] = [item("/company/employees", "nav.employees", Users)];
  if (hasVendors) administration.push(item("/company/vendors", "nav.vendors", Building2));
  if (!hideInvoicing && (hasFeature("chauffeur_cort_managed") || hasFeature("shuttle_cort_managed"))) {
    administration.push(item("/company/invoicing", "nav.invoices", Receipt));
  }

  const groups: PortalNavGroup[] = [
    { id: "overview", label: "", items: [item("/company", "nav.dashboard", LayoutDashboard)] },
    { id: "operations", label: t("nav.operations"), items: operations },
    { id: "administration", label: t("nav.administration"), items: administration },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** Exact match first, then the longest non-root prefix; falls back to the dashboard. */
export function activeCompanyHref(pathname: string, groups: PortalNavGroup[], basePath: string): string {
  const normalizedPath = stripSaudiPrefix(pathname);
  const items = groups.flatMap((g) => g.items);
  const exact = items.find((n) => normalizedPath === stripSaudiPrefix(n.href));
  if (exact) return exact.href;
  const prefix = items
    .filter((n) => stripSaudiPrefix(n.href) !== "/company" && normalizedPath.startsWith(`${stripSaudiPrefix(n.href)}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return prefix?.href ?? withSaudiBase("/company", basePath);
}
