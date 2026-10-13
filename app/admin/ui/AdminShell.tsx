"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGroup } from "motion/react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useAuth } from "../../lib/contexts/auth-context";
import { BookingNotificationProvider } from "../components/BookingNotificationProvider";
import { DeleteRequestsBell } from "../components/DeleteRequestsBell";
import { cx } from "../components/ui/cx";
import { CommandPalette } from "../components/ui/CommandPalette";
import { Tooltip, TooltipProvider } from "../components/ui/Tooltip";
import { useAdminTheme } from "../lib/theme-context";
import { findActiveItem, NAV_GROUPS, SHUTTLE_AUDIT_HREF, type NavGroup } from "./nav/nav-config";
import { SidebarGroup } from "./nav/SidebarGroup";
import { navItemClass, NavHover, NavLabel } from "./nav/SidebarItem";
import { Topbar } from "./nav/Topbar";
import { UserMenu } from "./nav/UserMenu";

const SIDEBAR_COLLAPSED_KEY = "cort-admin-sidebar-collapsed";
const GROUPS_OPEN_KEY = "cort-admin-nav-groups";
const DEFAULT_OPEN: Record<string, boolean> = { overview: true };

// TODO: remove email allowlist — keep shuttle_audit permission as the real gate
const SHUTTLE_AUDIT_EMAIL = "hashir.ahmed@cort.com.pk";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode) — state simply won't persist
  }
}

function readOpenGroups(): Record<string, boolean> {
  const raw = readStorage(GROUPS_OPEN_KEY);
  if (!raw) return DEFAULT_OPEN;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : DEFAULT_OPEN;
  } catch {
    return DEFAULT_OPEN;
  }
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const { logout, user, isSuperAdmin, isInternalStaff, hasPermission } = useAuth();
  const { theme, toggle } = useAdminTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(DEFAULT_OPEN);

  // Storage is read after mount so the server and first client render agree.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readStorage(SIDEBAR_COLLAPSED_KEY) === "true");
    setOpenGroups(readOpenGroups());
  }, []);

  const setCollapsedPersisted = (value: boolean) => {
    setCollapsed(value);
    writeStorage(SIDEBAR_COLLAPSED_KEY, String(value));
  };

  const isLogin = pathname === "/admin/login";
  const email = user?.email?.trim().toLowerCase();

  const visibleGroups = useMemo<NavGroup[]>(() => {
    const canSee = (item: NavGroup["items"][number]) => {
      if (item.allowInternalStaff && isInternalStaff) return true;
      if (!item.permission) return isSuperAdmin;
      if (item.href === SHUTTLE_AUDIT_HREF && email !== SHUTTLE_AUDIT_EMAIL) return false;
      if (isSuperAdmin) return true;
      return hasPermission(item.permission);
    };
    return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter(canSee) })).filter(
      (group) => group.items.length > 0,
    );
  }, [isSuperAdmin, isInternalStaff, hasPermission, email]);

  const active = useMemo(() => findActiveItem(pathname, visibleGroups), [pathname, visibleGroups]);
  const activeHref = active?.item.href ?? null;
  const activeGroupId = active?.group.id ?? null;

  // When navigation lands in a group the user had collapsed, open it (adjusting state during render).
  const [seenGroupId, setSeenGroupId] = useState<string | null>(null);
  if (activeGroupId !== seenGroupId) {
    setSeenGroupId(activeGroupId);
    if (activeGroupId && !openGroups[activeGroupId]) {
      const next = { ...openGroups, [activeGroupId]: true };
      setOpenGroups(next);
      writeStorage(GROUPS_OPEN_KEY, JSON.stringify(next));
    }
  }

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeStorage(GROUPS_OPEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  // ⌘B / Ctrl+B toggles the sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((prev) => {
          writeStorage(SIDEBAR_COLLAPSED_KEY, String(!prev));
          return !prev;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lock page scroll while the drawer is open; close on Escape (links close it via onNavigate).
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsMobileMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isMobileMenuOpen]);

  const logoSrc =
    theme === "light"
      ? "/traflinq_light_no_tagline-Photoroom.png"
      : "/traflinq_dark_no_tagline-Photoroom.png";

  if (isLogin) return <>{children}</>;

  const renderSidebar = (isMobile: boolean) => {
    const rail = collapsed && !isMobile;
    let offset = 0;
    return (
      <LayoutGroup id={isMobile ? "mobile" : "desktop"}>
        <div
          className={cx(
            "flex h-[3.25rem] shrink-0 items-center transition-[padding] duration-300",
            rail ? "justify-center px-2" : "px-4",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={rail ? "/app_icon.png" : logoSrc}
            alt="TrafLinq"
            className={cx(
              "object-contain transition-all duration-300",
              rail ? "h-8 w-8 rounded-lg" : "h-8 w-auto",
            )}
          />
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-2">
          {visibleGroups.map((group) => {
            const groupOffset = offset;
            offset += group.items.length;
            return (
              <SidebarGroup
                key={group.id}
                group={group}
                open={!!openGroups[group.id]}
                rail={rail}
                activeHref={activeHref}
                hasActive={group.id === activeGroupId}
                onToggle={() => toggleGroup(group.id)}
                onNavigate={isMobile ? closeMobileMenu : undefined}
                animate={isMobile}
                indexOffset={groupOffset}
                layoutScope={isMobile ? "mobile" : "desktop"}
              />
            );
          })}
        </nav>

        {/* Pinned so the pending-count badge stays visible even when groups are collapsed. */}
        <div className="shrink-0 space-y-1 border-t border-[var(--nav-border)] p-2.5">
          {isSuperAdmin && <DeleteRequestsBell collapsed={rail} />}
          {!isMobile && (
            <Tooltip label={collapsed ? "Expand sidebar  ⌘B" : "Collapse sidebar  ⌘B"} disabled={!rail}>
              <button
                type="button"
                onClick={() => setCollapsedPersisted(!collapsed)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={navItemClass({ rail })}
              >
                <NavHover />
                {collapsed ? (
                  <PanelLeftOpen size={17} strokeWidth={1.6} className="relative z-10 shrink-0" />
                ) : (
                  <PanelLeftClose size={17} strokeWidth={1.6} className="relative z-10 shrink-0" />
                )}
                <NavLabel rail={rail}>Collapse sidebar</NavLabel>
                {!rail && (
                  <kbd className="relative z-10 ml-auto rounded border border-[var(--border-default)] px-1.5 py-0.5 font-sans text-[10px] text-[var(--text-muted)]">
                    ⌘B
                  </kbd>
                )}
              </button>
            </Tooltip>
          )}
          <UserMenu
            email={user?.email}
            roleLabel={isSuperAdmin ? "Super Admin" : "Staff"}
            rail={rail}
            theme={theme}
            onToggleTheme={toggle}
            onLogout={() => logout()}
          />
        </div>
      </LayoutGroup>
    );
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[var(--bg-page)] font-sans text-[var(--text-primary)]">
        <div className="flex min-h-screen">
          {/* Floating sidebar: an inset rounded panel rather than a full-height rail. */}
          <div
            className={cx(
              "sticky top-0 z-40 hidden h-screen shrink-0 p-2 md:block",
              "transition-[width] duration-300 ease-[var(--ease-smooth)]",
              collapsed ? "w-[calc(var(--sidebar-width-collapsed)+0.5rem)]" : "w-[calc(var(--sidebar-width)+0.5rem)]",
            )}
          >
            <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-sidebar)] shadow-[var(--shadow-card)]">
              {renderSidebar(false)}
            </aside>
          </div>

          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
              <div className="admin-fade-in fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMobileMenu} />
              <div className="admin-drawer-in relative m-2 flex w-full max-w-[18rem] flex-col rounded-2xl bg-[var(--bg-sidebar)] shadow-2xl">
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  aria-label="Close menu"
                  className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)]"
                >
                  <X size={18} />
                </button>
                {renderSidebar(true)}
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              active={active}
              theme={theme}
              sidebarCollapsed={collapsed}
              onToggleTheme={toggle}
              onToggleSidebar={() => setCollapsedPersisted(!collapsed)}
              onOpenMenu={() => setIsMobileMenuOpen(true)}
              onOpenSearch={() => setSearchOpen(true)}
            />
            <BookingNotificationProvider />
            <main
              key={pathname}
              className="admin-route-enter mx-auto w-full max-w-[1600px] flex-1 px-4 pb-8 pt-2 md:px-6"
            >
              {children}
            </main>
          </div>
        </div>
      </div>

      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        groups={visibleGroups}
        onSelect={(href) => router.push(href)}
      />
    </TooltipProvider>
  );
}
