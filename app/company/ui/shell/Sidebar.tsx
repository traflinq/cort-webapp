"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { NavGroup } from "../../lib/nav";
import { Tooltip } from "../Tooltip";

/**
 * The navy rail. Same content on desktop (collapsible to icons) and inside the mobile drawer.
 * Colours come from the --co-rail-* tokens so it stays navy in both themes.
 */
export function SidebarNav({
  groups,
  activeHref,
  collapsed = false,
  hrefFor,
  onNavigate,
}: {
  groups: NavGroup[];
  activeHref: string | null;
  collapsed?: boolean;
  hrefFor: (href: string) => string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("company");
  const tUi = useTranslations("common.ui");
  return (
    <nav aria-label={tUi("navigation")} className={cn("flex-1 overflow-y-auto overflow-x-hidden py-3", collapsed ? "px-2" : "px-3")}>
      {groups.map((group, gi) => (
        <div key={group.titleKey ?? gi} className={cn(gi > 0 && "mt-5")}>
          {group.titleKey &&
            (collapsed ? (
              gi > 0 && <div className="mx-2 mb-3 border-t border-rail-line" aria-hidden="true" />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-rail-muted">{t(group.titleKey)}</p>
            ))}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              const label = t(item.labelKey);
              const link = (
                <Link
                  href={hrefFor(item.href)}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={cn(
                    "group relative flex h-10 items-center gap-3 rounded-md text-sm font-medium outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-rail-strong/70",
                    collapsed ? "justify-center px-0" : "px-3",
                    active ? "bg-rail-active text-rail-strong" : "text-rail-fg hover:bg-rail-hover hover:text-rail-strong",
                  )}
                >
                  {active && <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-highlight" aria-hidden="true" />}
                  <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              );
              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip content={label} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SidebarBrand({ collapsed = false, href }: { collapsed?: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={cn("flex h-14 shrink-0 items-center border-b border-rail-line outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rail-strong/70", collapsed ? "justify-center" : "px-5")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={collapsed ? "/app_icon.png" : "/traflinq_dark_no_tagline-Photoroom.png"}
        alt="Traflinq"
        className={cn("object-contain", collapsed ? "size-8 rounded-md" : "h-9 w-auto")}
      />
    </Link>
  );
}
