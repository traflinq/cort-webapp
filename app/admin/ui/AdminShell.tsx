"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "../../lib/contexts/auth-context";
import type { PermissionKey } from "../../lib/types/auth-types";
import { BookingNotificationProvider } from "../components/BookingNotificationProvider";
import { useAdminTheme } from "../lib/theme-context";
import { activeNavItem, visibleNavGroups, type NavViewer } from "../lib/nav";
import { Drawer, DrawerContent } from "./Drawer";
import { Sidebar } from "./shell/Sidebar";
import { TopBar } from "./shell/TopBar";
import { CommandPalette } from "./shell/CommandPalette";
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
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);
  const expanded = hovered || focused;

  const asideRef = React.useRef<HTMLElement>(null);
  // After navigating, the pointer is still over the rail; ignore it until it leaves and comes back.
  const suppressed = React.useRef(false);

  const openRail = () => {
    if (suppressed.current) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setHovered(true);
  };
  // Short grace period so brushing past the edge doesn't make the rail flicker shut.
  const closeRail = () => {
    suppressed.current = false;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setHovered(false), 120);
  };

  // Collapse on every route change and drop focus from the clicked link.
  const [prevPath, setPrevPath] = React.useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setHovered(false);
    setFocused(false);
  }
  React.useEffect(() => {
    suppressed.current = true;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    const el = document.activeElement;
    if (el instanceof HTMLElement && asideRef.current?.contains(el)) el.blur();
  }, [pathname]);
  React.useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

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
    <div className="min-h-screen bg-page text-fg">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <div className="flex min-h-screen">
        {/* Reserves the rail's width in the layout; the real sidebar overlays content when expanded. */}
        <div className="relative hidden w-16 shrink-0 md:block">
          <aside
            ref={asideRef}
            onMouseEnter={openRail}
            onMouseLeave={closeRail}
            onFocus={(e) => {
              // Only keyboard focus expands the rail; a mouse click on a link must not pin it open.
              if (e.target instanceof HTMLElement && e.target.matches(":focus-visible")) setFocused(true);
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
            }}
            className={cn(
              "fixed inset-y-0 left-0 z-40 overflow-hidden border-r border-line bg-card transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)]",
              expanded ? "w-60 shadow-[var(--shadow-modal)]" : "w-16",
            )}
          >
            <div className="h-full w-60">
              <Sidebar groups={groups} activeHref={active?.href} expanded={expanded} theme={theme} isSuperAdmin={isSuperAdmin} />
            </div>
          </aside>
        </div>

        <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
          <DrawerContent side="left" size="sm" flush hideHeader title="Navigation" className="max-w-[18rem]">
            <Sidebar groups={groups} activeHref={active?.href} mobile onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} theme={theme} isSuperAdmin={isSuperAdmin} />
          </DrawerContent>
        </Drawer>

        <div className="flex min-w-0 flex-1 flex-col">
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
          <main id="main" tabIndex={-1} className="flex-1 px-4 py-5 outline-none md:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={items} viewer={viewer} />
    </div>
  );
}
