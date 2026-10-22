"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent } from "../Drawer";
import { useUiLabels } from "../lib/labels";
import { Sidebar } from "./Sidebar";
import { TopBar, type TopBarProps } from "./TopBar";
import { BreadcrumbProvider } from "./breadcrumbs-context";
import type { PortalNavGroup } from "./nav-types";

export interface PortalShellProps extends Omit<TopBarProps, "onOpenMenu" | "children"> {
  /** Current route; the rail collapses whenever it changes. */
  pathname: string;
  groups: PortalNavGroup[];
  activeHref?: string;
  /** Sidebar footer caption. */
  footerLabel?: React.ReactNode;
  /** Rendered in the top bar's middle slot (breadcrumbs). */
  topBarContent?: React.ReactNode;
  /** Rendered above the page content inside <main> (trial / impersonation banners). */
  banner?: React.ReactNode;
  /** Siblings of the frame: toasters, palettes, notification providers. */
  aside?: React.ReactNode;
  mainProps?: React.HTMLAttributes<HTMLElement>;
  maxWidth?: string;
  children: React.ReactNode;
}

/**
 * The portal frame shared by admin and company: hover/focus-to-expand icon rail that overlays
 * the page, mobile drawer, top bar, skip link and breadcrumb context. Portals build the nav
 * groups and account props; this component only lays them out.
 */
export function PortalShell(props: PortalShellProps) {
  return (
    <BreadcrumbProvider>
      <ShellFrame {...props} />
    </BreadcrumbProvider>
  );
}

function ShellFrame({ pathname, groups, activeHref, footerLabel, topBarContent, banner, aside, mainProps, maxWidth = "max-w-[1600px]", children, theme, homeHref, homeLabel, ...topBar }: PortalShellProps) {
  const L = useUiLabels();
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);
  const expanded = hovered || focused;

  const asideRef = React.useRef<HTMLElement>(null);
  // After navigating, the pointer is still over the rail; ignore it until it leaves and comes back.
  const suppressed = React.useRef(false);
  const pointerInside = React.useRef(false);
  const mounted = React.useRef(false);

  const openRail = () => {
    pointerInside.current = true;
    if (suppressed.current) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setHovered(true);
  };
  // Short grace period so brushing past the edge doesn't make the rail flicker shut.
  const closeRail = () => {
    pointerInside.current = false;
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
    // Only swallow hover when the pointer is already over the rail (i.e. the user just clicked a link there).
    // Otherwise (first load, or navigating from the page content) the first hover must open it.
    suppressed.current = mounted.current && pointerInside.current;
    mounted.current = true;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    const el = document.activeElement;
    if (el instanceof HTMLElement && asideRef.current?.contains(el)) el.blur();
  }, [pathname]);
  React.useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const sidebarProps = { groups, activeHref, theme, homeHref, homeLabel, footerLabel };

  return (
    <div className="min-h-screen bg-page text-fg">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        {L.skipToContent}
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
              "fixed inset-y-0 start-0 z-40 overflow-hidden border-e border-line bg-card transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)]",
              expanded ? "w-60 shadow-[var(--shadow-modal)]" : "w-16",
            )}
          >
            <div className="h-full w-60">
              <Sidebar {...sidebarProps} expanded={expanded} />
            </div>
          </aside>
        </div>

        <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
          <DrawerContent side="start" size="sm" flush hideHeader title={L.mainNavigation} className="max-w-[18rem]">
            <Sidebar {...sidebarProps} mobile onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
          </DrawerContent>
        </Drawer>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenMenu={() => setMobileOpen(true)} theme={theme} homeHref={homeHref} homeLabel={homeLabel} {...topBar}>
            {topBarContent}
          </TopBar>
          {aside}
          <main id="main" tabIndex={-1} {...mainProps} className={cn("flex-1 px-4 py-5 outline-none md:px-6 lg:px-8", mainProps?.className)}>
            <div className={cn("mx-auto w-full", maxWidth)}>
              {banner}
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
