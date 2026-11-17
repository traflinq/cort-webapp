"use client";

import * as React from "react";
import { ChevronRight, Languages, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { IconButton } from "../Button";
import { CompanyLink } from "../link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../Menu";
import { focusRing } from "../styles";
import { usePageCrumbs, type Crumb } from "./breadcrumbs";

export interface TopBarProps {
  /** Nav section of the current page, e.g. { label: "Bookings", href: "/company/bookings" }. */
  section: Crumb | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobileNav: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  /** Language switch is only offered on the Saudi (/sa) portal. */
  locale?: { current: string; nextLabel: string; onToggle: () => void } | null;
  user: { email?: string | null; companyName?: string | null; logoUrl?: string | null };
  onSignOut: () => void;
}

export function TopBar({ section, collapsed, onToggleCollapsed, onOpenMobileNav, theme, onToggleTheme, locale, user, onSignOut }: TopBarProps) {
  const t = useTranslations("common.ui");
  const pageCrumbs = usePageCrumbs();
  const crumbs: Crumb[] = [...(section ? [section] : []), ...pageCrumbs];
  const initial = (user.companyName ?? user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-[var(--bg-header)] px-3 sm:px-5">
      <IconButton label={t("openMenu")} icon={<Menu />} onClick={onOpenMobileNav} className="md:hidden" />
      <IconButton
        label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
        icon={collapsed ? <PanelLeftOpen className="rtl:-scale-x-100" /> : <PanelLeftClose className="rtl:-scale-x-100" />}
        onClick={onToggleCollapsed}
        size="sm"
        className="hidden md:inline-flex"
      />

      <nav aria-label={t("breadcrumb")} className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={i} className={cn("flex min-w-0 items-center gap-1.5", !last && "hidden sm:flex")}>
                {i > 0 && <ChevronRight className="hidden size-3.5 shrink-0 text-fg-muted rtl:-scale-x-100 sm:block" aria-hidden="true" />}
                {crumb.href && !last ? (
                  <CompanyLink href={crumb.href} className={cn("truncate rounded text-fg-muted hover:text-fg", focusRing)}>
                    {crumb.label}
                  </CompanyLink>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={cn("truncate", last ? "font-medium text-fg" : "text-fg-muted")}>
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex shrink-0 items-center gap-1">
        {locale && (
          <button
            type="button"
            onClick={locale.onToggle}
            className={cn("hidden h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-fg-secondary hover:bg-subtle hover:text-fg sm:inline-flex", focusRing)}
          >
            <Languages className="size-4" aria-hidden="true" />
            {locale.nextLabel}
          </button>
        )}
        <IconButton
          label={theme === "dark" ? t("switchToLight") : t("switchToDark")}
          icon={theme === "dark" ? <Sun /> : <Moon />}
          onClick={onToggleTheme}
          size="sm"
          className="hidden sm:inline-flex"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("account")}
              className={cn("ms-1 flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-action text-[13px] font-semibold text-on-action", focusRing)}
            >
              {user.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                initial
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60">
            <DropdownMenuLabel>
              <span className="block truncate text-sm font-semibold text-fg">{user.companyName ?? t("companyAccount")}</span>
              {user.email && <span className="ltr-content block truncate">{user.email}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onToggleTheme}>
              {theme === "dark" ? <Sun /> : <Moon />}
              {theme === "dark" ? t("switchToLight") : t("switchToDark")}
            </DropdownMenuItem>
            {locale && (
              <DropdownMenuItem onSelect={locale.onToggle}>
                <Languages />
                {t("language")}: {locale.nextLabel}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onSignOut}>
              <LogOut />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
