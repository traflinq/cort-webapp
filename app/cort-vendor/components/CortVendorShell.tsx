"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, LayoutDashboard, LogOut, Map, Moon, Route, Sun, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "../../lib/contexts/auth-context";
import { useAdminTheme } from "../../admin/lib/theme-context";
import { IconButton, focusRing } from "../../admin/ui";

const NAV = [
  { href: "/cort-vendor", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/cort-vendor/trips", label: "Trips", icon: Route },
  { href: "/cort-vendor/routes", label: "Routes", icon: Map },
  { href: "/cort-vendor/vehicles", label: "Vehicles", icon: Car },
  { href: "/cort-vendor/drivers", label: "Drivers", icon: Users },
] as const;

export function CortVendorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/cort-vendor";
  const { user, logout } = useAuth();
  const { theme, toggle } = useAdminTheme();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
  const vendorName = user?.vendor_name ?? user?.full_name ?? "Vendor";
  const logoSrc = theme === "light" ? "/traflinq_light_no_tagline-Photoroom.png" : "/traflinq_dark_no_tagline-Photoroom.png";

  return (
    <div className="min-h-screen bg-page text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4 md:px-6 lg:px-8">
          <Link href="/cort-vendor" aria-label="Vendor dashboard" className={cn("inline-flex shrink-0 rounded-md", focusRing)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="Traflinq" className="h-8 w-auto" />
          </Link>
          <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
          <span className="hidden truncate text-sm font-medium text-fg-secondary sm:block">Vendor portal · {vendorName}</span>

          <nav aria-label="Vendor portal" className="ml-auto hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, "exact" in item ? item.exact : false)} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-2">
            <IconButton
              label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
              }}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </IconButton>
            <IconButton label="Sign out" onClick={() => logout()}>
              <LogOut />
            </IconButton>
          </div>
        </div>

        {/* Narrow screens: scrollable tab row instead of the inline nav. */}
        <nav aria-label="Vendor portal" className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 lg:hidden">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href, "exact" in item ? item.exact : false)} />
          ))}
        </nav>
      </header>

      <main id="main" className="px-4 py-5 md:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}

function NavLink({ item, active }: { item: (typeof NAV)[number]; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
        active ? "bg-brand-soft text-brand-ink" : "text-fg-secondary hover:bg-subtle hover:text-fg",
        focusRing,
      )}
    >
      <Icon size={16} aria-hidden="true" />
      {item.label}
    </Link>
  );
}
