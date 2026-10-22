import type { LucideIcon } from "lucide-react";

/** The shape the shared shell (Sidebar, breadcrumbs) needs. Portals extend it with their own gating fields. */
export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only rendered outside production builds. */
  devOnly?: boolean;
  /** Not a sensible landing page after login (dev tools, audit). */
  utility?: boolean;
  description?: string;
  keywords?: string[];
};

export type PortalNavGroup<I extends PortalNavItem = PortalNavItem> = {
  id: string;
  label: string;
  items: I[];
};

/** Longest-prefix match: "/company/routes/12" → the "/company/routes" item (never the portal root unless exact). */
export function activePortalItem<I extends PortalNavItem>(pathname: string, items: I[], root: string): I | undefined {
  const exact = items.find((i) => i.href === pathname);
  if (exact) return exact;
  return items
    .filter((i) => i.href !== root && pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
