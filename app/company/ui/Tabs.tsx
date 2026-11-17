"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { focusRingInset } from "./styles";

export interface TabItem<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}

/**
 * Controlled tabs. `underline` for page-level sections, `segmented` for compact view switches.
 * The active panel should carry `role="tabpanel"`, `id={tabPanelId(id)}` and `aria-labelledby={tabId(id)}`.
 */
export const tabId = (id: string) => `co-tab-${id}`;
export const tabPanelId = (id: string) => `co-tabpanel-${id}`;

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  variant = "underline",
  className,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  variant?: "underline" | "segmented";
  className?: string;
}) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: React.KeyboardEvent) => {
    const rtl = document.documentElement.dir === "rtl";
    const idx = tabs.findIndex((x) => x.id === value);
    let next = -1;
    if (e.key === "ArrowRight") next = idx + (rtl ? -1 : 1);
    else if (e.key === "ArrowLeft") next = idx + (rtl ? 1 : -1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    const target = tabs[(next + tabs.length) % tabs.length];
    onChange(target.id);
    refs.current[target.id]?.focus();
  };

  const underline = variant === "underline";
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "flex max-w-full overflow-x-auto",
        underline ? "gap-5 border-b border-line" : "w-fit gap-0.5 rounded-md border border-line bg-subtle p-0.5",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            aria-selected={active}
            aria-controls={tabPanelId(tab.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors [&_svg]:size-4",
              focusRingInset,
              underline
                ? cn("-mb-px border-b-2 px-0.5 pb-2.5 pt-1", active ? "border-action text-fg" : "border-transparent text-fg-muted hover:text-fg")
                : cn("h-8 rounded px-3", active ? "bg-card text-fg shadow-[var(--shadow-card-hover)]" : "text-fg-muted hover:text-fg"),
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-neutral-soft text-fg" : "bg-neutral-soft text-fg-muted")}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
