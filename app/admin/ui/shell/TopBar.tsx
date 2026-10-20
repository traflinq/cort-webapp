"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Menu, Moon, Palette, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "../styles";
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
  onToggleTheme: () => void;
  user: { email?: string | null; name?: string | null } | null;
  isSuperAdmin: boolean;
  onLogout: () => void;
  showDesignSystemLink?: boolean;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar({ onOpenMenu, onOpenPalette, theme, onToggleTheme, user, isSuperAdmin, onLogout, showDesignSystemLink }: TopBarProps) {
  const displayName = user?.name || user?.email || "Account";
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-card/85 px-3 backdrop-blur md:px-5">
      <IconButton label="Open navigation" className="md:hidden" onClick={onOpenMenu}>
        <Menu />
      </IconButton>

      <div className="min-w-0 flex-1">
        <Link href="/admin" aria-label="Traflinq dashboard" className={cn("inline-flex rounded-md", focusRing)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={theme === "light" ? "/traflinq_light_no_tagline-Photoroom.png" : "/traflinq_dark_no_tagline-Photoroom.png"}
            alt="Traflinq"
            className="h-8 w-auto"
          />
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenPalette}
          className={cn(
            "hidden h-8 w-56 cursor-pointer items-center gap-2 rounded-lg border border-line bg-subtle px-2.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg lg:flex",
            focusRing,
          )}
        >
          <Search className="size-3.5" aria-hidden="true" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-line bg-card px-1 font-mono text-[10px] text-fg-muted">{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>
        <IconButton label="Search" className="lg:hidden" onClick={onOpenPalette}>
          <Search />
        </IconButton>

        <DeleteRequestsBell variant="icon" />

        <IconButton label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={onToggleTheme}>
          {theme === "dark" ? <Sun /> : <Moon />}
        </IconButton>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Account menu for ${displayName}`}
              className={cn("ml-1 flex h-9 cursor-pointer items-center gap-2 rounded-lg pl-1 pr-1.5 text-sm hover:bg-subtle", focusRing)}
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink">
                {initials(user?.name || user?.email || "?")}
              </span>
              <span className="hidden max-w-[12rem] truncate text-fg md:inline">{displayName}</span>
              <ChevronDown className="hidden size-3.5 text-fg-muted md:inline" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="normal-case tracking-normal">
              <span className="block truncate text-sm font-medium text-fg">{displayName}</span>
              {user?.name && user?.email && <span className="block truncate text-xs font-normal text-fg-muted">{user.email}</span>}
              <span className="mt-1 block text-[11px] font-normal text-fg-muted">{isSuperAdmin ? "Super admin" : "Internal staff"}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onToggleTheme}>
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
