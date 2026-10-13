"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import { useId } from "react";

export type SegmentedTab = { value: string; label: string; icon?: React.ReactNode; content: React.ReactNode };

/** Radix tabs styled as a segmented control; the active thumb glides between segments. */
export function SegmentedTabs({
  tabs,
  value,
  onValueChange,
  trailing,
}: {
  tabs: SegmentedTab[];
  value: string;
  onValueChange: (value: string) => void;
  trailing?: React.ReactNode;
}) {
  const id = useId();
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs.List className="inline-flex rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1">
          {tabs.map((t) => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              className="relative inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-[var(--text-muted)] outline-none transition-colors data-[state=active]:text-[var(--text-primary)] hover:text-[var(--text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--cort-orange)]"
            >
              {value === t.value && (
                <motion.span
                  layoutId={`seg-${id}`}
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  className="absolute inset-0 rounded-lg bg-[var(--bg-card)] shadow-[var(--shadow-card)] ring-1 ring-[var(--border-default)]"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-2">
                {t.icon}
                {t.label}
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {trailing}
      </div>
      {tabs.map((t) => (
        <Tabs.Content key={t.value} value={t.value} className="outline-none data-[state=active]:admin-pop-in">
          {t.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
