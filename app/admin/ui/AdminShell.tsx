"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "../../lib/contexts/auth-context";
import type { PermissionKey } from "../../lib/types/auth-types";
import { BookingNotificationProvider } from "../components/BookingNotificationProvider";
import { BenchmarkChangeRequestAlertProvider } from "../components/BenchmarkChangeRequestAlertProvider";
import { useAdminTheme } from "../lib/theme-context";
import { activeNavItem, visibleNavGroups, type NavViewer } from "../lib/nav";
import { Drawer, DrawerContent } from "./Drawer";
import { Sidebar } from "./shell/Sidebar";
import { TopBar } from "./shell/TopBar";
import { CommandPalette } from "./shell/CommandPalette";
import { useSidebarCollapsed } from "./shell/useSidebarCollapsed";
import { BreadcrumbProvider } from "./shell/breadcrumbs-context";

const SHOW_DESIGN_SYSTEM = process.env.NODE_ENV !== "production";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  return (
    <BreadcrumbProvider>
      <ShellFrame pathname={pathname ?? "/admin"}>{children}</ShellFrame>
    </BreadcrumbProvider>
  );
}

function ShellFrame({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { logout, user, isSuperAdmin, isInternalStaff, hasPermission } = useAuth();
  const { theme, toggle } = useAdminTheme();
  // Desktop sidebar: open by default; the collapse button shrinks it to the icon rail (remembered).
  const [collapsed, setCollapsed] = useSidebarCollapsed("admin-sidebar-collapsed");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  // On desktop the content panel is the scroll container, so start each page at its top.
  const panelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  const viewer = React.useMemo<NavViewer>(
    () => ({
      isSuperAdmin,
      isInternalStaff,
      email: user?.email,
      hasPermission: (key: PermissionKey) => hasPermission(key),
    }),
    [isSuperAdmin, isInternalStaff, user?.email, hasPermission],
  );

  const groups = React.useMemo(() => visibleNavGroups(viewer), [viewer]);
  const items = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const active = React.useMemo(() => activeNavItem(pathname, items), [pathname, items]);

  // ⌘K / Ctrl+K opens the palette from anywhere in the portal.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const account = user as { email?: string | null; full_name?: string | null; name?: string | null } | null;

  return (
    <div className="min-h-screen bg-[var(--bg-sidebar)] text-fg">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop: sidebar on the frame colour, content in a rounded panel that scrolls on its own. */}
      <div className="flex min-h-screen md:h-dvh md:min-h-0 md:overflow-hidden">
        <aside
          aria-label="Sidebar"
          className={cn(
            "hidden shrink-0 overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)] md:block",
            collapsed ? "w-16" : "w-60",
          )}
        >
          <div className="h-full w-60">
            <Sidebar
              groups={groups}
              activeHref={active?.href}
              collapsed={collapsed}
              onToggleCollapsed={() => setCollapsed(!collapsed)}
              theme={theme}
              isSuperAdmin={isSuperAdmin}
            />
          </div>
        </aside>

        <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
          <DrawerContent side="left" size="sm" flush hideHeader title="Navigation" className="max-w-[18rem]">
            <Sidebar groups={groups} activeHref={active?.href} mobile onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} theme={theme} isSuperAdmin={isSuperAdmin} />
          </DrawerContent>
        </Drawer>

        <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
          <div
            ref={panelRef}
            data-admin-main
            className="flex min-h-screen flex-1 flex-col bg-page md:min-h-0 md:overflow-y-auto md:rounded-2xl md:border md:border-line"
          >
            <TopBar
              onOpenMenu={() => setMobileOpen(true)}
              onOpenPalette={() => setPaletteOpen(true)}
              theme={theme}
              onToggleTheme={toggle}
              user={account ? { email: account.email, name: account.full_name ?? account.name } : null}
              isSuperAdmin={isSuperAdmin}
              onLogout={() => logout()}
              showDesignSystemLink={SHOW_DESIGN_SYSTEM && isSuperAdmin}
            />
            <BookingNotificationProvider />
            <BenchmarkChangeRequestAlertProvider />
            <main id="main" tabIndex={-1} className="flex-1 px-4 py-5 outline-none md:px-6 lg:px-8">
              <div className="mx-auto w-full max-w-[1600px]">{children}</div>
            </main>
          </div>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={items} viewer={viewer} />
    </div>
  );
}
