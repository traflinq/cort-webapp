"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { cx } from "../../components/ui/cx";
import { Tooltip } from "../../components/ui/Tooltip";
import type { NavItem } from "./nav-config";

/** Shared look for anything that sits in the sidebar list (links and action buttons). */
export function navItemClass({ active, rail }: { active?: boolean; rail?: boolean }) {
  return cx(
    "group relative flex w-full items-center gap-3 rounded-lg py-2 text-[13px] font-medium",
    "transition-[color,padding] duration-200 ease-out",
    rail ? "justify-center px-0" : "px-3",
    active
      ? "text-[var(--nav-active-text)]"
      : "text-[var(--nav-inactive-text)] hover:text-[var(--text-primary)]",
  );
}

export function NavLabel({ rail, children }: { rail?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "relative z-10 overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity] duration-300 ease-out",
        rail ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100",
      )}
    >
      {children}
    </span>
  );
}

/** Hover wash; sits behind the content so the active pill can slide under it. */
export function NavHover() {
  return (
    <span
      aria-hidden
      className="absolute inset-0 rounded-lg bg-[var(--nav-hover-bg)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
    />
  );
}

export function SidebarItem({
  item,
  active,
  rail,
  onNavigate,
  index,
  animate,
  layoutScope,
}: {
  item: NavItem;
  active: boolean;
  rail: boolean;
  onNavigate?: () => void;
  index?: number;
  animate?: boolean;
  /** Distinguishes the desktop and mobile sidebars so their active pills don't share a layout id. */
  layoutScope: string;
}) {
  const Icon = item.icon;
  return (
    <Tooltip label={item.label} disabled={!rail}>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        style={animate ? { animationDelay: `${(index ?? 0) * 25 + 80}ms` } : undefined}
        className={cx(navItemClass({ active, rail }), animate && "admin-item-in")}
      >
        <NavHover />
        {active && (
          <motion.span
            layoutId={`nav-active-${layoutScope}`}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="absolute inset-0 rounded-lg bg-[var(--nav-active-bg)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--cort-orange)_18%,transparent)]"
          >
            {!rail && (
              <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--cort-orange)]" />
            )}
          </motion.span>
        )}
        <Icon size={17} strokeWidth={active ? 2 : 1.6} className="relative z-10 shrink-0" />
        <NavLabel rail={rail}>{item.label}</NavLabel>
      </Link>
    </Tooltip>
  );
}
