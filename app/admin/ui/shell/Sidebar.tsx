"use client";

import * as React from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "../styles";
import { Tooltip } from "../Tooltip";
import { IconButton } from "../IconButton";
import type { NavGroup, NavItem } from "../../lib/nav";

export interface SidebarProps {
  groups: NavGroup[];
  activeHref?: string;
  /** Icon-rail mode (desktop only). */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Rendered inside the mobile drawer: never collapsed, closes on navigate. */
  mobile?: boolean;
  onNavigate?: () => void;
  /** Mobile only: close button in the header. */
  onClose?: () => void;
  theme: "light" | "dark";
  isSuperAdmin: boolean;
}

function NavLink({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150",
        collapsed ? "h-9 w-9 justify-center" : "h-9 px-2.5",
        active ? "bg-brand-soft text-brand-ink" : "text-fg-secondary hover:bg-subtle hover:text-fg",
        focusRing,
      )}
    >
      {active && !collapsed && <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand" />}
      <Icon size={18} strokeWidth={active ? 2 : 1.75} className="shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  );
}

export function Sidebar({ groups, activeHref, collapsed = false, onToggleCollapsed, mobile = false, onNavigate, onClose, theme, isSuperAdmin }: SidebarProps) {
  const isRail = collapsed && !mobile;
  const logoSrc = theme === "light" ? "/traflinq_light_no_tagline-Photoroom.png" : "/traflinq_dark_no_tagline-Photoroom.png";

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 shrink-0 items-center border-b border-line", isRail ? "justify-center px-2" : "justify-between px-4")}>
        <Link href="/admin" aria-label="Traflinq dashboard" className={cn("flex items-center rounded-md", focusRing)}>
          {isRail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/app_icon.png" alt="" className="h-8 w-8 rounded-md" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="Traflinq" className="h-8 w-auto" />
          )}
        </Link>
        {mobile && onClose && (
          <IconButton label="Close navigation" size="icon-sm" onClick={onClose} tooltip={false}>
            <X />
          </IconButton>
        )}
      </div>

      <nav aria-label="Main" className={cn("flex-1 overflow-y-auto overflow-x-hidden py-3", isRail ? "px-2" : "px-3")}>
        {groups.map((group, gi) => (
          <div key={group.id} className={cn(gi > 0 && "mt-3")}>
            {isRail ? (
              gi > 0 && <div aria-hidden="true" className="mx-1 mb-3 h-px bg-line" />
            ) : (
              <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{group.label}</p>
            )}
            <ul className={cn("flex flex-col gap-0.5", isRail && "items-center")}>
              {group.items.map((item) => (
                <li key={item.href} className={cn(!isRail && "w-full")}>
                  <NavLink item={item} active={item.href === activeHref} collapsed={isRail} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("flex shrink-0 items-center border-t border-line p-2", isRail ? "justify-center" : "justify-between")}>
        {!isRail && (
          <span className="truncate px-2 text-[11px] text-fg-muted">{isSuperAdmin ? "Super Admin Portal" : "Staff Portal"}</span>
        )}
        {!mobile && onToggleCollapsed && (
          <IconButton label={collapsed ? "Expand sidebar" : "Collapse sidebar"} size="icon-sm" onClick={onToggleCollapsed} tooltipSide="right" aria-expanded={!collapsed}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </IconButton>
        )}
      </div>
    </div>
  );
}
