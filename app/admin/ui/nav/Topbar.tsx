"use client";

import { ChevronRight, Menu, Moon, PanelLeft, Search, Sun } from "lucide-react";
import { Tooltip } from "../../components/ui/Tooltip";
import type { NavGroup, NavItem } from "./nav-config";

export function Topbar({
  active,
  theme,
  sidebarCollapsed,
  onToggleTheme,
  onToggleSidebar,
  onOpenMenu,
  onOpenSearch,
}: {
  active: { group: NavGroup; item: NavItem } | null;
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}) {
  const iconBtn =
    "flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-primary)]";

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] shrink-0 items-center gap-2 bg-[var(--bg-header)] px-4 backdrop-blur-md md:px-6">
      <button type="button" onClick={onOpenMenu} className={`${iconBtn} md:hidden`} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <Tooltip label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} side="bottom">
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`${iconBtn} hidden md:flex`}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeft size={18} />
        </button>
      </Tooltip>
      <div className="mx-1 hidden h-5 w-px bg-[var(--border-default)] md:block" />

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {active ? (
          <>
            <span className="hidden truncate text-[var(--text-muted)] sm:inline">{active.group.label}</span>
            <ChevronRight size={13} className="hidden shrink-0 text-[var(--text-light)] sm:block" />
            <span className="truncate font-medium text-[var(--text-primary)]">{active.item.label}</span>
          </>
        ) : (
          <span className="font-medium text-[var(--text-primary)]">Admin</span>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 text-[13px] text-[var(--text-muted)] shadow-[var(--shadow-card)] transition-colors hover:border-[var(--border-strong)] md:flex"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Jump to…</span>
          <kbd className="rounded border border-[var(--border-default)] px-1.5 py-0.5 font-sans text-[10px]">⌘K</kbd>
        </button>
        <button type="button" onClick={onOpenSearch} className={`${iconBtn} md:hidden`} aria-label="Search pages">
          <Search size={18} />
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className={iconBtn}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
}
