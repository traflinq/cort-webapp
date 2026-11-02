"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface UnderlineTabItem<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  count?: number;
}

/** Text tabs with an orange underline on the active one ("Truck / Van / Car"). */
export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
  size = "lg",
  className,
  ariaLabel,
}: {
  items: UnderlineTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "lg" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("flex min-w-0 items-end gap-6 overflow-x-auto", className)}>
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-2 pb-3 transition-colors focus-visible:outline-none focus-visible:text-[var(--cort-orange)]",
              size === "lg" ? "text-xl" : "text-[15px]",
              active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
          >
            {Icon && <Icon size={size === "lg" ? 20 : 17} strokeWidth={1.6} />}
            <span>{item.label}</span>
            {item.count != null && (
              <span className="rounded-full bg-[var(--tile-bg)] px-2 py-0.5 text-xs text-[var(--text-secondary)] tabular-nums">{item.count}</span>
            )}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--cort-orange)] transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
