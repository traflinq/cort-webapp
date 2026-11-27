import {
  BarChart2,
  Building2,
  Calendar,
  Car,
  FileBarChart,
  FileSpreadsheet,
  LayoutDashboard,
  Map,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CompanyAccess } from "./access";

/**
 * The company portal's pages: who may open each one and its sidebar entry.
 * The sidebar and the page guard both read this table, so they cannot disagree.
 * A new page that depends on a service or feature gets one entry here.
 */

export type NavGroup = "main" | "operations" | "administration";

export interface CompanyPage {
  /** Path without the Saudi prefix. Matches the pages under it too, unless `exact`. */
  path: string;
  exact?: boolean;
  allow: (a: CompanyAccess) => boolean;
  /** Sidebar entry. `trialRank` places it in the trial sidebar, which is one list in its own order. */
  nav?: { labelKey: string; icon: LucideIcon; group: NavGroup; trialRank?: number };
}

const regular = (rule: (a: CompanyAccess) => boolean) => (a: CompanyAccess) => !a.trial && rule(a);

export const COMPANY_PAGES: readonly CompanyPage[] = [
  {
    path: "/company",
    exact: true,
    allow: () => true,
    nav: { labelKey: "nav.dashboard", icon: LayoutDashboard, group: "main", trialRank: 0 },
  },
  {
    path: "/company/routes",
    allow: (a) => a.services.shuttle && (!a.trial || a.trial.shuttle),
    nav: { labelKey: "nav.routeRoster", icon: Map, group: "operations", trialRank: 3 },
  },
  {
    path: "/company/routes/create",
    allow: (a) => a.services.shuttle && a.can.selfManageShuttle,
  },
  {
    path: "/company/bookings",
    allow: (a) => (a.trial ? a.trial.pool : a.services.chauffeur),
    nav: { labelKey: "nav.bookings", icon: Calendar, group: "operations", trialRank: 2 },
  },
  {
    path: "/company/reports/shuttle",
    allow: regular((a) => a.services.shuttle),
    nav: { labelKey: "nav.shuttleReports", icon: FileBarChart, group: "operations" },
  },
  {
    path: "/company/reports/chauffeur",
    allow: regular((a) => a.services.chauffeur),
    nav: { labelKey: "nav.chauffeurReports", icon: FileSpreadsheet, group: "operations" },
  },
  {
    path: "/company/fleet",
    allow: (a) => a.can.poolFleet,
    nav: { labelKey: "nav.poolFleet", icon: Car, group: "operations", trialRank: 1 },
  },
  {
    path: "/company/analytics",
    allow: (a) => a.can.analytics,
    nav: { labelKey: "nav.analytics", icon: BarChart2, group: "operations" },
  },
  {
    path: "/company/employees",
    allow: (a) => !a.trial || a.trial.shuttle,
    nav: { labelKey: "nav.employees", icon: Users, group: "administration", trialRank: 4 },
  },
  {
    path: "/company/vendors",
    allow: regular((a) => a.hasVendors),
    nav: { labelKey: "nav.vendors", icon: Building2, group: "administration" },
  },
  {
    path: "/company/invoicing",
    allow: (a) => a.can.invoicing,
    nav: { labelKey: "nav.invoices", icon: Receipt, group: "administration" },
  },
];

const matches = (page: CompanyPage, path: string) => path === page.path || (!page.exact && path.startsWith(`${page.path}/`));

/** The most specific table entry for a path (Saudi prefix already removed). */
export function findCompanyPage(path: string): CompanyPage | undefined {
  return COMPANY_PAGES.filter((p) => matches(p, path)).sort((a, b) => b.path.length - a.path.length)[0];
}

/**
 * Whether the company may open a path. Paths outside the table (legacy redirects, demo pages) are
 * open to regular companies; a trial account may only open the pages listed for it.
 */
export function canOpenCompanyPath(path: string, access: CompanyAccess): boolean {
  const page = findCompanyPage(path);
  return page ? page.allow(access) : !access.trial;
}

const GROUP_TITLES: Record<NavGroup, string> = { main: "", operations: "nav.operations", administration: "nav.administration" };

/** Sidebar groups for this company, in table order; a trial account gets one untitled list. */
export function companyNav(access: CompanyAccess): { titleKey: string; pages: CompanyPage[] }[] {
  const visible = COMPANY_PAGES.filter((p) => p.nav && p.allow(access));
  if (access.trial) {
    const pages = visible.filter((p) => p.nav!.trialRank !== undefined).sort((a, b) => a.nav!.trialRank! - b.nav!.trialRank!);
    return [{ titleKey: "", pages }];
  }
  return (Object.keys(GROUP_TITLES) as NavGroup[])
    .map((group) => ({ titleKey: GROUP_TITLES[group], pages: visible.filter((p) => p.nav!.group === group) }))
    .filter((g) => g.pages.length > 0);
}
