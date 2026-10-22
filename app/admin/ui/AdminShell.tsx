"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palette } from "lucide-react";
import { useAuth } from "../../lib/contexts/auth-context";
import type { PermissionKey } from "../../lib/types/auth-types";
import { BookingNotificationProvider } from "../components/BookingNotificationProvider";
import { DeleteRequestsBell } from "../components/DeleteRequestsBell";
import { useAdminTheme } from "../lib/theme-context";
import { activeNavItem, visibleNavGroups, type NavViewer } from "../lib/nav";
import { PortalShell } from "@/app/ui/shell/PortalShell";
import { DropdownMenuItem } from "@/app/ui/DropdownMenu";
import { CommandPalette } from "./shell/CommandPalette";

const SHOW_DESIGN_SYSTEM = process.env.NODE_ENV !== "production";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  return <ShellFrame pathname={pathname ?? "/admin"}>{children}</ShellFrame>;
}

function ShellFrame({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { logout, user, isSuperAdmin, isInternalStaff, hasPermission } = useAuth();
  const { theme, toggle } = useAdminTheme();
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
    <PortalShell
      pathname={pathname}
      groups={groups}
      activeHref={active?.href}
      theme={theme}
      onToggleTheme={toggle}
      user={account ? { email: account.email, name: account.full_name ?? account.name } : null}
      roleLabel={isSuperAdmin ? "Super admin" : "Internal staff"}
      footerLabel={isSuperAdmin ? "Super Admin Portal" : "Staff Portal"}
      homeHref="/admin"
      homeLabel="Traflinq dashboard"
      onLogout={() => logout()}
      search={{ onOpen: () => setPaletteOpen(true) }}
      actions={<DeleteRequestsBell variant="icon" />}
      menuItems={
        SHOW_DESIGN_SYSTEM && isSuperAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/design-system">
              <Palette />
              Design system
            </Link>
          </DropdownMenuItem>
        ) : null
      }
      aside={
        <>
          <BookingNotificationProvider />
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={items} viewer={viewer} />
        </>
      }
    >
      {children}
    </PortalShell>
  );
}
