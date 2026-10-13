import {
  LayoutDashboard,
  Building2,
  FileText,
  Car,
  Fuel,
  Wrench,
  Store,
  ClipboardList,
  Truck,
  Users,
  Calendar,
  Map,
  MapPin,
  Bus,
  ArrowLeftRight,
  BarChart3,
  Receipt,
  FileSpreadsheet,
  Shield,
  UserPlus,
  Smartphone,
  ScrollText,
  Compass,
  Handshake,
  Wallet,
  Settings2,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "../../../lib/types/auth-types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  allowInternalStaff?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

export const SHUTTLE_AUDIT_HREF = "/admin/routes/shuttle-audit";

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: Gauge,
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
      { href: "/admin/leads", label: "Leads", icon: UserPlus, permission: "dashboard" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Compass,
    items: [
      { href: "/admin/bookings/pending", label: "Bookings", icon: Calendar, permission: "bookings" },
      { href: "/admin/routes", label: "Routes", icon: Map, permission: "routes" },
      { href: "/admin/routes/daily-overrides", label: "Today's shuttle plan", icon: ArrowLeftRight, permission: "ops_shuttle" },
      { href: "/admin/routes/shuttle-trips", label: "Shuttle trip scheduling", icon: Bus, permission: "ops_shuttle" },
      { href: "/admin/ops/shuttle", label: "Ops: Shuttle", icon: Bus, permission: "ops_shuttle" },
      { href: "/admin/ops/chauffeur", label: "Ops: Chauffeur", icon: Car, permission: "ops_chauffeur" },
    ],
  },
  {
    id: "fleet",
    label: "Fleet",
    icon: Car,
    items: [
      { href: "/admin/vehicles", label: "Vehicles", icon: Car, permission: "vehicles" },
      { href: "/admin/vehicles/fueling", label: "Fuel Records", icon: Fuel, permission: "fuel_records" },
      { href: "/admin/vehicles/maintenance", label: "Maintenance", icon: Wrench, permission: "maintenance" },
      { href: "/admin/fixed-contracts", label: "Fixed-Term Cars", icon: Car, permission: "fixed_contracts" },
      { href: "/admin/drivers", label: "Drivers", icon: Users, permission: "drivers" },
    ],
  },
  {
    id: "partners",
    label: "Clients & Partners",
    icon: Handshake,
    items: [
      { href: "/admin/companies", label: "Companies", icon: Building2, permission: "companies" },
      { href: "/admin/vendors", label: "Vendors", icon: Store, permission: "vendors" },
      { href: "/admin/vendors/logs", label: "Trip Logs", icon: ClipboardList, permission: "vendor_logs" },
      { href: "/admin/external-vendors", label: "External Vendors", icon: Truck, permission: "external_vendors" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    items: [
      { href: "/admin/pricing", label: "Contracts & Pricing", icon: FileText, permission: "pricing" },
      { href: "/admin/invoicing", label: "Invoicing", icon: FileSpreadsheet, permission: "invoicing" },
      { href: "/admin/expenses", label: "Expenses", icon: Receipt, permission: "expenses" },
      { href: "/admin/reports", label: "Reports", icon: BarChart3, permission: "reports" },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Settings2,
    items: [
      { href: "/admin/permissions", label: "Staff & Permissions", icon: Shield },
      { href: "/admin/settings/app-config", label: "App Config", icon: Smartphone },
      { href: SHUTTLE_AUDIT_HREF, label: "Shuttle audit logs", icon: ScrollText, permission: "shuttle_audit" },
      { href: "/admin/tracker-test", label: "Tracker Test", icon: MapPin, allowInternalStaff: true },
    ],
  },
];

/** Longest-prefix match so nested routes (e.g. /admin/vendors/logs) pick the most specific item. */
export function findActiveItem(
  pathname: string | null,
  groups: NavGroup[],
): { group: NavGroup; item: NavItem } | null {
  if (!pathname) return null;
  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const matches =
        pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
      if (matches && (!best || item.href.length > best.item.href.length)) {
        best = { group, item };
      }
    }
  }
  return best;
}
