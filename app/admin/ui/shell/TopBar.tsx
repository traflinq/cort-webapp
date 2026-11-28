"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Menu, Moon, Palette, Search, Sun } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import { focusRing, roundIconButton } from "../styles";
import { IconButton } from "../IconButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../DropdownMenu";
import { DeleteRequestsBell } from "../../components/DeleteRequestsBell";
import { initials } from "../../lib/format";

export interface TopBarProps {
  onOpenMenu: () => void;
  onOpenPalette: () => void;
  theme: "light" | "dark";
  onToggleTheme: (origin?: { x: number; y: number }) => void;
  user: { email?: string | null; name?: string | null } | null;
  isSuperAdmin: boolean;
  onLogout: () => void;
  showDesignSystemLink?: boolean;
}

/** Viewport center of an element — the origin of the theme switch's circular reveal. */
function centerOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar({ onOpenMenu, onOpenPalette, theme, onToggleTheme, user, isSuperAdmin, onLogout, showDesignSystemLink }: TopBarProps) {
  const displayName = user?.name || user?.email || "Account";
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-page/85 px-3 backdrop-blur md:px-5">
      <IconButton label="Open navigation" className="md:hidden" onClick={onOpenMenu}>
        <Menu />
      </IconButton>
      {/* Mobile only: on desktop the logo lives in the sidebar. */}
      <Link href="/admin" aria-label="Traflinq dashboard" className={cn("inline-flex rounded-md md:hidden", focusRing)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={theme === "light" ? "/traflinq_light_no_tagline-Photoroom.png" : "/traflinq_dark_no_tagline-Photoroom.png"}
          alt="Traflinq"
          className="h-7 w-auto"
        />
      </Link>
      <button
        type="button"
        onClick={onOpenPalette}
        className={cn(
          "hidden h-9 w-80 cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-card px-3 text-sm text-fg-muted shadow-xs transition-colors hover:border-line-strong hover:text-fg md:flex",
          focusRing,
        )}
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="flex-1 text-left">Search pages, bookings, drivers…</span>
        <kbd className="rounded-md border border-line bg-subtle px-1.5 font-mono text-[10px] text-fg-muted">{isMac ? "⌘" : "Ctrl"} K</kbd>
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <IconButton label="Search" className={cn("md:hidden", roundIconButton)} onClick={onOpenPalette}>
          <Search />
        </IconButton>
        <DeleteRequestsBell variant="icon" />
        <IconButton
          label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className={roundIconButton}
          onClick={(e) => onToggleTheme(centerOf(e.currentTarget))}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </IconButton>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Account menu for ${displayName}`}
              className={cn("ml-1 flex h-10 cursor-pointer items-center gap-2.5 rounded-full py-1 pl-1 pr-2 text-left hover:bg-subtle", focusRing)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink">
                {initials(user?.name || user?.email || "?")}
              </span>
              <span className="hidden min-w-0 flex-col leading-tight md:flex">
                <span className="max-w-[12rem] truncate text-sm font-medium text-fg">{displayName}</span>
                <span className="text-xs text-fg-muted">{isSuperAdmin ? "Super admin" : "Internal staff"}</span>
              </span>
              <ChevronDown className="hidden size-4 text-fg-muted md:inline" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="normal-case tracking-normal">
              <span className="block truncate text-sm font-medium text-fg">{displayName}</span>
              {user?.name && user?.email && <span className="block truncate text-xs font-normal text-fg-muted">{user.email}</span>}
              <span className="mt-1 block text-[11px] font-normal text-fg-muted">{isSuperAdmin ? "Super admin" : "Internal staff"}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => onToggleTheme(e.target instanceof Element ? centerOf(e.target) : undefined)}>
              {theme === "dark" ? <Sun /> : <Moon />}
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </DropdownMenuItem>
            {showDesignSystemLink && (
              <DropdownMenuItem asChild>
                <Link href="/admin/design-system">
                  <Palette />
                  Design system
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onLogout}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
