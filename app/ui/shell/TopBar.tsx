"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "../styles";
import { IconButton } from "../IconButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../DropdownMenu";
import { initials } from "../lib/format";
import { useUiLabels } from "../lib/labels";

export interface TopBarProps {
  onOpenMenu: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  user: { email?: string | null; name?: string | null } | null;
  /** Caption under the name in the account menu, e.g. "Super admin" or the company name. */
  roleLabel?: React.ReactNode;
  /** Avatar override (e.g. company logo URL). Falls back to initials. */
  avatarUrl?: string | null;
  homeHref: string;
  homeLabel: string;
  onLogout: () => void;
  /** Optional ⌘K search affordance. */
  search?: { onOpen: () => void };
  /** Extra controls before the theme toggle (bells, locale switch). */
  actions?: React.ReactNode;
  /** Extra items in the account menu, between the theme item and sign-out. */
  menuItems?: React.ReactNode;
  /** Content shown in the middle (breadcrumbs). */
  children?: React.ReactNode;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar({ onOpenMenu, theme, onToggleTheme, user, roleLabel, avatarUrl, homeHref, homeLabel, onLogout, search, actions, menuItems, children }: TopBarProps) {
  const L = useUiLabels();
  const displayName = user?.name || user?.email || L.account;
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-card/85 px-3 backdrop-blur md:px-5">
      <IconButton label={L.openNavigation} className="md:hidden" onClick={onOpenMenu}>
        <Menu />
      </IconButton>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link href={homeHref} aria-label={homeLabel} className={cn("inline-flex shrink-0 rounded-md", focusRing)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={theme === "light" ? "/traflinq_light_no_tagline-Photoroom.png" : "/traflinq_dark_no_tagline-Photoroom.png"}
            alt="Traflinq"
            className="h-8 w-auto"
          />
        </Link>
        {children && <div className="hidden min-w-0 md:block">{children}</div>}
      </div>

      <div className="flex items-center gap-1">
        {search && (
          <>
            <button
              type="button"
              onClick={search.onOpen}
              className={cn(
                "hidden h-8 w-56 cursor-pointer items-center gap-2 rounded-lg border border-line bg-subtle px-2.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg lg:flex",
                focusRing,
              )}
            >
              <Search className="size-3.5" aria-hidden="true" />
              <span className="flex-1 text-start">{L.search}</span>
              <kbd className="rounded border border-line bg-card px-1 font-mono text-[10px] text-fg-muted">{isMac ? "⌘" : "Ctrl"} K</kbd>
            </button>
            <IconButton label={L.search} className="lg:hidden" onClick={search.onOpen}>
              <Search />
            </IconButton>
          </>
        )}

        {actions}

        <IconButton label={theme === "dark" ? L.switchToLight : L.switchToDark} onClick={onToggleTheme}>
          {theme === "dark" ? <Sun /> : <Moon />}
        </IconButton>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={L.accountMenuFor(displayName)}
              className={cn("ms-1 flex h-9 cursor-pointer items-center gap-2 rounded-lg ps-1 pe-1.5 text-sm hover:bg-subtle", focusRing)}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="size-7 rounded-full object-cover" />
              ) : (
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink">
                  {initials(user?.name || user?.email || "?")}
                </span>
              )}
              <span className="hidden max-w-[12rem] truncate text-fg md:inline">{displayName}</span>
              <ChevronDown className="hidden size-3.5 text-fg-muted md:inline" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="normal-case tracking-normal">
              <span className="block truncate text-sm font-medium text-fg">{displayName}</span>
              {user?.name && user?.email && <span className="block truncate text-xs font-normal text-fg-muted">{user.email}</span>}
              {roleLabel && <span className="mt-1 block text-[11px] font-normal text-fg-muted">{roleLabel}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onToggleTheme}>
              {theme === "dark" ? <Sun /> : <Moon />}
              {theme === "dark" ? L.lightTheme : L.darkTheme}
            </DropdownMenuItem>
            {menuItems}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onLogout}>
              <LogOut />
              {L.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
