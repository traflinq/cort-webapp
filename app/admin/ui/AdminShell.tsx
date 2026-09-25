"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
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
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../lib/contexts/auth-context";
import { PermissionKey } from "../../lib/types/auth-types";
import { BookingNotificationProvider } from "../components/BookingNotificationProvider";
import { DeleteRequestsBell } from "../components/DeleteRequestsBell";
import { cx } from "../components/ui/cx";
import { useAdminTheme } from "../lib/theme-context";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  allowInternalStaff?: boolean;
};

const nav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { href: "/admin/companies", label: "Companies", icon: Building2, permission: "companies" },
  { href: "/admin/pricing", label: "Contracts & Pricing", icon: FileText, permission: "pricing" },
  { href: "/admin/fixed-contracts", label: "Fixed-Term Cars", icon: Car, permission: "fixed_contracts" },
  { href: "/admin/vehicles", label: "Vehicles", icon: Car, permission: "vehicles" },
  { href: "/admin/travel-cars", label: "Travel cars", icon: Car },
  { href: "/admin/travel-mile-vehicles", label: "Travel miles", icon: Car },
  { href: "/admin/vehicles/fueling", label: "Fuel Records", icon: Fuel, permission: "fuel_records" },
  { href: "/admin/vehicles/maintenance", label: "Maintenance", icon: Wrench, permission: "maintenance" },
  { href: "/admin/settings/app-config", label: "App Config", icon: Smartphone },
  { href: "/admin/vendors", label: "Vendors", icon: Store, permission: "vendors" },
  { href: "/admin/vendors/logs", label: "Trip Logs", icon: ClipboardList, permission: "vendor_logs" },
  { href: "/admin/external-vendors", label: "External Vendors", icon: Truck, permission: "external_vendors" },
  { href: "/admin/drivers", label: "Drivers", icon: Users, permission: "drivers" },
  { href: "/admin/bookings/pending", label: "Bookings", icon: Calendar, permission: "bookings" },
  { href: "/admin/routes", label: "Routes", icon: Map, permission: "routes" },
  // Utilities
  { href: "/admin/tracker-test", label: "Tracker Test", icon: MapPin, allowInternalStaff: true },
  { href: "/admin/routes/daily-overrides", label: "Today's shuttle plan", icon: ArrowLeftRight, permission: "ops_shuttle" },
  { href: "/admin/routes/shuttle-trips", label: "Shuttle trip scheduling", icon: Bus, permission: "ops_shuttle" },
  { href: "/admin/routes/shuttle-audit", label: "Shuttle audit logs", icon: ScrollText, permission: "shuttle_audit" },
  { href: "/admin/ops/shuttle", label: "Ops: Shuttle", icon: Bus, permission: "ops_shuttle" },
  { href: "/admin/ops/chauffeur", label: "Ops: Chauffeur", icon: Car, permission: "ops_chauffeur" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, permission: "reports" },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt, permission: "expenses" },
  { href: "/admin/invoicing", label: "Invoicing", icon: FileSpreadsheet, permission: "invoicing" },
  { href: "/admin/permissions", label: "Staff & Permissions", icon: Shield },
  { href: "/admin/leads", label: "Leads", icon: UserPlus, permission: "dashboard" },
];

const SIDEBAR_COLLAPSED_KEY = "cort-admin-sidebar-collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, user, isSuperAdmin, isInternalStaff, hasPermission } = useAuth();
  const { theme, toggle } = useAdminTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const setCollapsedPersisted = (value: boolean) => {
    setCollapsed(value);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(value));
  };

  const isLogin = pathname === "/admin/login";

  const visibleNav = useMemo(() => {
    return nav.filter((item) => {
      if (item.allowInternalStaff && isInternalStaff) return true;
      if (!item.permission) return isSuperAdmin;
      if (isSuperAdmin) {
        // TODO: remove email allowlist — keep shuttle_audit permission as the real gate
        if (item.href === "/admin/routes/shuttle-audit") {
          return user?.email?.trim().toLowerCase() === "hashir.ahmed@cort.com.pk";
        }
        return true;
      }
      if (item.href === "/admin/routes/shuttle-audit") {
        return (
          hasPermission(item.permission) &&
          user?.email?.trim().toLowerCase() === "hashir.ahmed@cort.com.pk"
        );
      }
      return hasPermission(item.permission);
    });
  }, [isSuperAdmin, isInternalStaff, hasPermission, user?.email]);

  const activeHref = useMemo(() => {
    if (!pathname) return "/admin";
    const found = visibleNav.find((n) => pathname === n.href);
    if (found) return found.href;
    const prefix = visibleNav.find((n) => n.href !== "/admin" && pathname.startsWith(n.href));
    return prefix?.href ?? "/admin";
  }, [pathname, visibleNav]);

  const logoSrc =
    theme === "light"
      ? "/traflinq_light_no_tagline-Photoroom.png"
      : "/traflinq_dark_no_tagline-Photoroom.png";

  if (isLogin) return <>{children}</>;

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className={cx(
            "flex flex-col items-center justify-center transition-all duration-300",
            collapsed && !isMobile ? "px-2 py-6" : "px-6 py-8",
          )}
        >
          <img
            src={collapsed && !isMobile ? "/app_icon.png" : logoSrc}
            alt="TrafLinq"
            className={cx(
              "object-contain transition-all duration-300",
              collapsed && !isMobile ? "h-9 w-9 rounded-lg" : "h-14 w-auto",
            )}
          />
        </div>

        <nav className="px-3 pb-6 space-y-1">
          {visibleNav.map((item, index) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            const isSubItem =
              item.href.includes("/fueling") ||
              item.href.includes("/maintenance") ||
              item.href.includes("/logs") ||
              item.href.includes("/shuttle-trips") ||
              item.href.includes("/shuttle-audit") ||
              item.href.includes("/daily-overrides") ||
              item.href === "/admin/fixed-contracts";

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed && !isMobile ? item.label : undefined}
                onClick={() => isMobile && setIsMobileMenuOpen(false)}
                style={isMobile ? { animationDelay: `${(index + 1) * 50}ms` } : undefined}
                className={cx(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative",
                  isMobile && "animate-fade-slide-up opacity-0",
                  !collapsed || isMobile ? (isSubItem ? "pl-5" : "") : "justify-center px-2",
                  active
                    ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
                    : "text-[var(--nav-inactive-text)] hover:text-[var(--text-primary)] hover:bg-[var(--nav-hover-bg)]",
                )}
              >
                {active && (!collapsed || isMobile) && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-[var(--cort-orange)]" />
                )}
                <Icon
                  size={18}
                  strokeWidth={active ? 2 : 1.5}
                  className={cx(
                    "shrink-0",
                    active ? "text-[var(--nav-active-text)]" : "group-hover:text-[var(--text-primary)]",
                  )}
                />
                <span
                  className={cx(
                    "whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden",
                    collapsed && !isMobile ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
          <div className="my-2 border-t border-[var(--nav-border)]" />
          <DeleteRequestsBell collapsed={collapsed && !isMobile} />
        </nav>
      </div>

      <div className="border-t border-[var(--nav-border)] p-3 mt-auto bg-[var(--nav-footer-bg)]">
        <div
          className={cx(
            "flex items-center gap-2 rounded-lg p-2 transition-all duration-300",
            collapsed && !isMobile ? "flex-col justify-center" : "justify-between",
          )}
        >
          <div
            className={cx(
              "flex flex-col overflow-hidden transition-all duration-300",
              collapsed && !isMobile ? "max-w-0 opacity-0 h-0" : "max-w-[150px] opacity-100",
            )}
          >
            <span className="truncate text-xs font-medium text-[var(--text-secondary)]">
              {user?.email}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {isSuperAdmin ? "Super Admin Portal" : "Staff Portal"}
            </span>
          </div>

          <div className={cx("flex shrink-0 items-center gap-1", collapsed && !isMobile && "flex-col")}>
            <button
              type="button"
              onClick={toggle}
              className="rounded-md p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--nav-hover-bg)] transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-md p-1.5 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] font-sans">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--nav-border)] bg-[var(--bg-header)] px-4 md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
        >
          <Menu size={24} />
        </button>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <img src={logoSrc} alt="TrafLinq" className="h-10 w-auto" />
        </div>
        <div className="w-10" />
      </header>

      <div className="flex min-h-screen">
        <aside
          className={cx(
            "sticky top-0 h-screen hidden shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-sidebar)] text-[var(--text-primary)] md:flex md:flex-col transition-all duration-300 ease-in-out relative",
            collapsed ? "w-[4.5rem]" : "w-72",
          )}
        >
          <button
            type="button"
            onClick={() => setCollapsedPersisted(!collapsed)}
            className="absolute -right-3 top-9 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-input)] text-[var(--text-muted)] shadow-sm hover:text-[var(--text-primary)] hover:scale-105 transition-all focus:outline-none"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <SidebarContent />
        </aside>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative flex w-full max-w-xs flex-1 flex-col bg-[var(--bg-sidebar)] animate-slide-in-left">
              <div className="absolute right-2 top-2">
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                >
                  <X size={20} />
                </button>
              </div>
              <SidebarContent isMobile />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <BookingNotificationProvider />
          <main className="mx-auto w-full max-w-full flex-1 px-4 py-6 md:px-6 bg-[var(--bg-page)]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
