"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "../styles";
import { IconButton } from "../IconButton";
import { useUiLabels } from "../lib/labels";
import type { PortalNavGroup, PortalNavItem } from "./nav-types";

export interface SidebarProps {
  groups: PortalNavGroup[];
  activeHref?: string;
  /** Desktop rail only: true while hovered/focused, which reveals the labels. */
  expanded?: boolean;
  /** Rendered inside the mobile drawer: always fully shown, closes on navigate. */
  mobile?: boolean;
  onNavigate?: () => void;
  /** Mobile only: close button in the header. */
  onClose?: () => void;
  theme: "light" | "dark";
  /** Where the logo links to. */
  homeHref: string;
  /** Accessible name of the logo link, e.g. "Traflinq dashboard". */
  homeLabel: string;
  /** Small caption in the footer, e.g. "Super Admin Portal". */
  footerLabel?: React.ReactNode;
}

/**
 * Layout is identical in rail and expanded states (icon in a fixed 40px slot, label beside it),
 * so expanding is just the container widening and the labels fading in. Nothing jumps.
 */
function NavLink({ item, active, show, onNavigate }: { item: PortalNavItem; active: boolean; show: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={show ? undefined : item.label}
      title={show ? undefined : item.label}
      onClick={onNavigate}
      className={cn(
        "group relative flex h-9 items-center overflow-hidden whitespace-nowrap rounded-lg text-sm font-medium transition-colors duration-150",
        active ? "bg-brand-soft text-brand-ink" : "text-fg-secondary hover:bg-subtle hover:text-fg",
        focusRing,
      )}
    >
      {active && <span aria-hidden="true" className="absolute start-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-e-full bg-brand" />}
      <span className="flex size-10 shrink-0 items-center justify-center">
        <Icon size={18} strokeWidth={active ? 2 : 1.75} aria-hidden="true" />
      </span>
      <span className={cn("truncate pe-3 transition-opacity duration-150", show ? "opacity-100 delay-75" : "opacity-0")}>{item.label}</span>
    </Link>
  );
}

export function Sidebar({ groups, activeHref, expanded = false, mobile = false, onNavigate, onClose, theme, homeHref, homeLabel, footerLabel }: SidebarProps) {
  const L = useUiLabels();
  const show = mobile || expanded;
  const logoSrc = theme === "light" ? "/traflinq_light_no_tagline-Photoroom.png" : "/traflinq_dark_no_tagline-Photoroom.png";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between overflow-hidden border-b border-line ps-3 pe-2">
        <Link href={homeHref} aria-label={homeLabel} className={cn("relative flex h-8 items-center rounded-md", focusRing)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/app_icon.png" alt="" className="size-8 shrink-0 rounded-md" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="Traflinq"
            className={cn("ms-2 h-7 w-auto max-w-none transition-opacity duration-150", show ? "opacity-100 delay-75" : "opacity-0")}
          />
        </Link>
        {mobile && onClose && (
          <IconButton label={L.closeNavigation} size="icon-sm" onClick={onClose} tooltip={false}>
            <X />
          </IconButton>
        )}
      </div>

      <nav aria-label={L.mainNavigation} className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 [scrollbar-width:thin]">
        {groups.map((group, gi) => (
          <div key={group.id} className={cn(gi > 0 && "mt-3")}>
            <div className="relative mb-1 h-4">
              {group.label && (
                <p
                  className={cn(
                    "absolute inset-x-0 top-0 truncate px-2.5 text-[11px] font-semibold uppercase leading-4 tracking-wider text-fg-muted transition-opacity duration-150",
                    show ? "opacity-100 delay-75" : "opacity-0",
                  )}
                >
                  {group.label}
                </p>
              )}
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

      {footerLabel && (
        <div className="flex h-10 shrink-0 items-center overflow-hidden border-t border-line px-4">
          <span className={cn("truncate text-[11px] text-fg-muted transition-opacity duration-150", show ? "opacity-100 delay-75" : "opacity-0")}>
            {footerLabel}
          </span>
        </div>
      )}
    </div>
  );
}
