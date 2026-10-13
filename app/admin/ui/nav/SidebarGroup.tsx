"use client";

import { ChevronDown } from "lucide-react";
import { cx } from "../../components/ui/cx";
import type { NavGroup } from "./nav-config";
import { SidebarItem } from "./SidebarItem";

export function SidebarGroup({
  group,
  open,
  rail,
  activeHref,
  hasActive,
  onToggle,
  onNavigate,
  animate,
  indexOffset,
  layoutScope,
}: {
  group: NavGroup;
  open: boolean;
  rail: boolean;
  activeHref: string | null;
  hasActive: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  animate?: boolean;
  indexOffset: number;
  layoutScope: string;
}) {
  // The icon rail has no room for headers, so every group is expanded and headed by a divider.
  const expanded = rail || open;
  const panelId = `nav-group-${group.id}`;

  return (
    <div className="pt-1">
      {rail ? (
        <div className="mx-3 mb-1 mt-2 h-px bg-[var(--nav-border)]" aria-hidden />
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="group/header flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left"
        >
          <span
            className={cx(
              "text-[10.5px] font-semibold uppercase tracking-[0.08em] transition-colors duration-200",
              hasActive && !open
                ? "text-[var(--nav-active-text)]"
                : "text-[var(--nav-group-label)] group-hover/header:text-[var(--text-secondary)]",
            )}
          >
            {group.label}
          </span>
          <ChevronDown
            size={14}
            className={cx(
              "text-[var(--nav-group-label)] transition-transform duration-300 ease-out",
              !open && "-rotate-90",
            )}
          />
        </button>
      )}

      <div
        id={panelId}
        className={cx(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden" {...(expanded ? {} : { inert: true })}>
          <div className="space-y-0.5 pb-1 pt-0.5">
            {group.items.map((item, i) => (
              <SidebarItem
                key={item.href}
                item={item}
                active={item.href === activeHref}
                rail={rail}
                onNavigate={onNavigate}
                animate={animate}
                index={indexOffset + i}
                layoutScope={layoutScope}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
