"use client";

import { ChevronsUpDown, LogOut, Moon, Sun } from "lucide-react";
import { cx } from "../../components/ui/cx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/DropdownMenu";

export function UserMenu({
  email,
  roleLabel,
  rail,
  theme,
  onToggleTheme,
  onLogout,
}: {
  email?: string;
  roleLabel: string;
  rail: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  const initials = (email ?? "?").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cx(
            "flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-[var(--nav-hover-bg)] data-[state=open]:bg-[var(--nav-hover-bg)]",
            rail && "justify-center",
          )}
          aria-label="Account menu"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--cort-orange)] to-[#ff5e00] text-[11px] font-semibold text-white">
            {initials}
          </span>
          {!rail && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{email}</span>
                <span className="block text-[11px] text-[var(--text-muted)]">{roleLabel}</span>
              </span>
              <ChevronsUpDown size={14} className="shrink-0 text-[var(--text-muted)]" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={rail ? "right" : "top"} align="start">
        <DropdownMenuLabel>
          <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{email}</span>
          <span className="block text-[11px] text-[var(--text-muted)]">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onToggleTheme}>
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem danger onSelect={onLogout}>
          <LogOut size={15} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
