"use client";

import * as React from "react";
import Link from "next/link";
import { PanelLeft, X } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import { focusRing } from "../styles";
import { IconButton } from "../IconButton";
import type { NavGroup, NavItem } from "../../lib/nav";

export interface SidebarProps {
  groups: NavGroup[];
  activeHref?: string;
  /** Desktop only: collapsed to the 64px icon rail. */
  collapsed?: boolean;
  /** Desktop only: collapse or expand the sidebar. */
  onToggleCollapsed?: () => void;
  /** Rendered inside the mobile drawer: always fully shown, closes on navigate. */
  mobile?: boolean;
  onNavigate?: () => void;
  /** Mobile only: close button in the header. */
  onClose?: () => void;
  theme: "light" | "dark";
  isSuperAdmin: boolean;
}

/** Fades labels out while the rail collapses; the icon keeps a fixed 40px slot so nothing jumps. */
function fade(show: boolean) {
  return cn("transition-opacity duration-150", show ? "opacity-100 delay-75" : "pointer-events-none opacity-0");
}

function NavLink({ item, active, show, onNavigate }: { item: NavItem; active: boolean; show: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={show ? undefined : item.label}
      title={show ? undefined : item.label}
      onClick={onNavigate}
      className={cn(
        "group flex h-9 items-center overflow-hidden whitespace-nowrap rounded-[10px] text-sm font-medium transition-colors duration-150",
        active
          ? "bg-nav-active text-nav-active-fg shadow-[var(--nav-active-shadow)]"
          : "text-fg-secondary hover:bg-subtle hover:text-fg",
        focusRing,
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center", active ? "text-brand" : "text-fg-muted group-hover:text-fg-secondary")}>
        <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className={cn("truncate pr-3", fade(show))}>{item.label}</span>
    </Link>
  );
}

export function Sidebar({ groups, activeHref, collapsed = false, onToggleCollapsed, mobile = false, onNavigate, onClose, theme, isSuperAdmin }: SidebarProps) {
  const show = mobile || !collapsed;
  const logoSrc = theme === "light" ? "/traflinq_light_no_tagline-Photoroom.png" : "/traflinq_dark_no_tagline-Photoroom.png";
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 overflow-hidden pl-3 pr-2">
        {show ? (
          <Link href="/admin" aria-label="Traflinq dashboard" className={cn("flex h-8 min-w-0 items-center rounded-md", focusRing)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/app_icon.png" alt="" className="size-8 shrink-0 rounded-lg" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="Traflinq" className={cn("ml-2 h-7 w-auto max-w-none", fade(show))} />
          </Link>
        ) : (
          // Collapsed: the mark doubles as the expand button (shows the panel icon on hover/focus).
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className={cn("group relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-subtle", focusRing)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/app_icon.png" alt="" className="size-8 rounded-lg transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0" />
            <PanelLeft className="absolute size-[18px] text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
          </button>
        )}
        {mobile && onClose && (
          <IconButton label="Close navigation" size="icon-sm" onClick={onClose} tooltip={false}>
            <X />
          </IconButton>
        )}
        {!mobile && show && onToggleCollapsed && (
          <IconButton label="Collapse sidebar" size="icon-sm" onClick={onToggleCollapsed} tooltipSide="right" className="shrink-0 text-fg-muted hover:text-fg">
            <PanelLeft strokeWidth={1.75} />
          </IconButton>
        )}
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 [scrollbar-width:thin]">
        {groups.map((group, gi) => (
          <div key={group.id} className={cn(gi > 0 && "mt-4")}>
            <div className="relative mb-1 h-5">
              <p className={cn("absolute inset-x-0 top-0 truncate px-2.5 text-xs font-medium leading-5 text-fg-muted", fade(show))}>
                {group.label}
              </p>
              {gi > 0 && (
                <span
                  aria-hidden="true"
                  className={cn("absolute inset-x-1 top-1/2 h-px bg-line transition-opacity duration-150", show ? "opacity-0" : "opacity-100")}
                />
              )}
            </div>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={item.href === activeHref} show={show} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="mx-3 flex h-11 shrink-0 items-center overflow-hidden border-t border-line px-2.5">
        <span className={cn("truncate text-xs text-fg-muted", fade(show))}>
          {isSuperAdmin ? "Super Admin portal" : "Staff portal"}
        </span>
      </div>
    </div>
  );
}
