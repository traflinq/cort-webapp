/**
 * The single navigation config for the Super Admin portal.
 * Consumed by: Sidebar, TopBar breadcrumbs, CommandPalette, the login redirect,
 * and the Staff & Permissions labels. Add a page here and it appears everywhere.
 */
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  Bus,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Car,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Fuel,
  LayoutDashboard,
  MapPin,
  Navigation,
  Palette,
  Receipt,
  Route,
  ScrollText,
  Shield,
  Smartphone,
  Store,
  Truck,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { UserRole, type PermissionKey } from "../../lib/types/auth-types";
import { normalizeStaffPermissions, staffHasCrud } from "../../lib/utils/staff-permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Read permission that gates the item for internal staff. Omit = super admin only. */
  permission?: PermissionKey;
  /** Internal staff can see this even without a permission key (e.g. tracker test). */
  allowInternalStaff?: boolean;
  /** Only rendered outside production builds. */
  devOnly?: boolean;
  /** Not a sensible landing page after login (dev tools, audit). */
  utility?: boolean;
  description?: string;
  keywords?: string[];
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const SHUTTLE_AUDIT_HREF = "/admin/routes/shuttle-audit";

export const adminNav: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard", description: "Revenue, cost and fleet KPIs", keywords: ["home", "kpi", "stats"] },
      { href: "/admin/leads", label: "Leads", icon: UserPlus, permission: "dashboard", description: "Landing-page and trial sign-ups", keywords: ["signups", "trial"] },
    ],
  },
  {
    id: "clients",
    label: "Clients",
    items: [
      { href: "/admin/companies", label: "Companies", icon: Building2, permission: "companies", description: "Client accounts, employees and services", keywords: ["clients", "accounts", "tenants"] },
      { href: "/admin/pricing", label: "Contracts & Pricing", icon: FileText, permission: "pricing", description: "Chauffeur and shuttle rates, fuel prices", keywords: ["rates", "fuel price", "contract"] },
      { href: "/admin/fixed-contracts", label: "Fixed-Term Cars", icon: CalendarClock, permission: "fixed_contracts", description: "Monthly car contracts and settlements", keywords: ["monthly", "contract", "settle"] },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/admin/bookings/pending", label: "Bookings", icon: CalendarCheck, permission: "bookings", description: "Chauffeur bookings lifecycle", keywords: ["rides", "trips", "assign"] },
      { href: "/admin/routes", label: "Routes", icon: Route, permission: "routes", description: "Shuttle routes, stops and rosters", keywords: ["stops", "roster", "shuttle"] },
      { href: "/admin/routes/daily-overrides", label: "Today's Plan", icon: ArrowLeftRight, permission: "ops_shuttle", description: "Move passengers and crew for one day", keywords: ["overrides", "daily", "plan"] },
      { href: "/admin/routes/shuttle-trips", label: "Trip Scheduling", icon: CalendarDays, permission: "ops_shuttle", description: "Generate and manage scheduled shuttle trips", keywords: ["schedule", "generate", "trips"] },
      { href: "/admin/ops/shuttle", label: "Live: Shuttle", icon: Bus, permission: "ops_shuttle", description: "Track today's shuttle trips live", keywords: ["tracking", "live", "map"] },
      { href: "/admin/ops/chauffeur", label: "Live: Chauffeur", icon: Navigation, permission: "ops_chauffeur", description: "Active chauffeur bookings and driver locations", keywords: ["tracking", "live", "map"] },
    ],
  },
  {
    id: "fleet",
    label: "Fleet",
    items: [
      { href: "/admin/vehicles", label: "Vehicles", icon: Car, permission: "vehicles", description: "Owned and partner vehicles", keywords: ["cars", "fleet", "plates"] },
      { href: "/admin/vehicles/fueling", label: "Fuel Records", icon: Fuel, permission: "fuel_records", description: "Fuel purchases and mileage", keywords: ["petrol", "diesel", "fueling"] },
      { href: "/admin/vehicles/maintenance", label: "Maintenance", icon: Wrench, permission: "maintenance", description: "Service records and due alerts", keywords: ["repair", "service"] },
      { href: "/admin/drivers", label: "Drivers", icon: Users, permission: "drivers", description: "Driver roster and chauffeur applications", keywords: ["chauffeurs", "applications"] },
    ],
  },
  {
    id: "partners",
    label: "Partners",
    items: [
      { href: "/admin/vendors", label: "Vendors", icon: Store, permission: "vendors", description: "Partner vehicle vendors", keywords: ["partners", "suppliers"] },
      { href: "/admin/vendors/logs", label: "Trip Logs", icon: ClipboardList, permission: "vendor_logs", description: "Vendor trips and settlements", keywords: ["settlement", "payouts"] },
      { href: "/admin/external-vendors", label: "External Vendors", icon: Truck, permission: "external_vendors", description: "Third-party vendor accounts", keywords: ["third party"] },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { href: "/admin/invoicing", label: "Invoicing", icon: FileSpreadsheet, permission: "invoicing", description: "Invoice ledger, payments and PDFs", keywords: ["invoice", "ledger", "billing"] },
      { href: "/admin/expenses", label: "Expenses", icon: Receipt, permission: "expenses", description: "General expenses and COGS tags", keywords: ["cost", "spend"] },
      { href: "/admin/reports", label: "Reports", icon: BarChart3, permission: "reports", description: "Chauffeur and shuttle reports", keywords: ["analytics", "export"] },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/admin/permissions", label: "Staff & Permissions", icon: Shield, description: "Internal staff accounts and access", keywords: ["users", "roles", "access"] },
      { href: "/admin/settings/app-config", label: "App Config", icon: Smartphone, description: "Mobile maintenance mode and versions", keywords: ["settings", "maintenance mode"] },
      { href: SHUTTLE_AUDIT_HREF, label: "Shuttle Audit", icon: ScrollText, permission: "shuttle_audit", utility: true, description: "Audit log of shuttle changes", keywords: ["log", "history"] },
      { href: "/admin/tracker-test", label: "Tracker Test", icon: MapPin, allowInternalStaff: true, utility: true, description: "Tracker API test harness", keywords: ["gps", "debug"] },
      { href: "/admin/design-system", label: "Design System", icon: Palette, devOnly: true, utility: true, description: "Component gallery (dev only)" },
    ],
  },
];

export type NavViewer = {
  isSuperAdmin: boolean;
  isInternalStaff: boolean;
  email?: string | null;
  hasPermission: (key: PermissionKey) => boolean;
};

const IS_PROD = process.env.NODE_ENV === "production";

/** Mirrors the visibility rules the old sidebar applied, now in one place. */
export function isNavItemVisible(item: NavItem, viewer: NavViewer): boolean {
  if (item.devOnly && IS_PROD) return false;
  if (item.allowInternalStaff && viewer.isInternalStaff) return true;
  if (!item.permission) return viewer.isSuperAdmin;
  if (viewer.isSuperAdmin) return true;
  return viewer.hasPermission(item.permission);
}

export function visibleNavGroups(viewer: NavViewer): NavGroup[] {
  return adminNav
    .map((g) => ({ ...g, items: g.items.filter((i) => isNavItemVisible(i, viewer)) }))
    .filter((g) => g.items.length > 0);
}

export function allNavItems(): NavItem[] {
  return adminNav.flatMap((g) => g.items);
}

export function navGroupFor(item: NavItem): NavGroup | undefined {
  return adminNav.find((g) => g.items.includes(item));
}

/** Longest-prefix match; "/admin" only matches exactly. */
export function activeNavItem(pathname: string | null, items: NavItem[]): NavItem | undefined {
  if (!pathname) return undefined;
  const exact = items.find((i) => i.href === pathname);
  if (exact) return exact;
  return items
    .filter((i) => i.href !== "/admin" && (pathname === i.href || pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Labels for the permission matrix, derived from the nav so they never drift. */
export const PERMISSION_LABELS: Record<PermissionKey, string> = (() => {
  // Keys that gate several nav items keep their broader hand-written name.
  const shared: PermissionKey[] = ["ops_shuttle", "dashboard"];
  const fromNav = Object.fromEntries(
    allNavItems()
      .filter((i) => i.permission && !shared.includes(i.permission))
      .map((i) => [i.permission as PermissionKey, i.label]),
  ) as Partial<Record<PermissionKey, string>>;
  return {
    dashboard: "Dashboard",
    companies: "Companies",
    pricing: "Contracts & Pricing",
    vehicles: "Vehicles",
    fuel_records: "Fuel Records",
    maintenance: "Maintenance",
    vendors: "Vendors",
    vendor_logs: "Vendor Trip Logs",
    drivers: "Drivers",
    bookings: "Bookings",
    routes: "Routes",
    ops_shuttle: "Ops: Shuttle",
    shuttle_audit: "Shuttle Audit Logs",
    ops_chauffeur: "Ops: Chauffeur",
    reports: "Reports",
    expenses: "Expenses",
    invoicing: "Invoicing",
    fixed_contracts: "Fixed-Term Contracts",
    external_vendors: "External Vendors",
    company_features: "Company Features",
    vendor_fleet: "Vendor Fleet",
    ...fromNav,
  };
})();

type RedirectUser = {
  role?: string | null;
  email?: string | null;
  permissions?: unknown;
} | null | undefined;

/**
 * Landing page after login: super admins go to the dashboard; internal staff go to the
 * first page they can read, in nav order (utility pages excluded); no access → stay on login.
 */
export function firstAccessibleRoute(user: RedirectUser): string {
  if (!user) return "/admin/login";
  if (user.role === UserRole.SUPER_ADMIN) return "/admin";
  if (user.role === UserRole.INTERNAL_STAFF) {
    const permissions = normalizeStaffPermissions((user.permissions as Parameters<typeof normalizeStaffPermissions>[0]) ?? null);
    const viewer: NavViewer = {
      isSuperAdmin: false,
      isInternalStaff: true,
      email: user.email,
      hasPermission: (key) => staffHasCrud(permissions, key, "read"),
    };
    const first = allNavItems().find((i) => !i.utility && !i.devOnly && !i.allowInternalStaff && isNavItemVisible(i, viewer));
    return first?.href ?? "/admin/login";
  }
  return "/";
}
