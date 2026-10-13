"use client";

import { useEffect } from "react";
import { Command } from "cmdk";
import { CornerDownLeft, Search } from "lucide-react";
import type { NavGroup } from "../../ui/nav/nav-config";

/** ⌘K / Ctrl+K jump-to-page palette built from the (permission-filtered) nav groups. */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NavGroup[];
  onSelect: (href: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Jump to page"
      overlayClassName="admin-portal admin-fade-in fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
      contentClassName="admin-portal admin-pop-in fixed left-1/2 top-[18vh] z-[91] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-modal)]"
    >
      <div className="flex items-center gap-3 border-b border-[var(--border-default)] px-4">
        <Search size={16} className="shrink-0 text-[var(--text-muted)]" />
        <Command.Input
          placeholder="Jump to a page…"
          className="input-bare h-12 w-full text-sm placeholder:text-[var(--text-placeholder)]"
        />
        <kbd className="rounded border border-[var(--border-default)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
          ESC
        </kbd>
      </div>
      <Command.List className="max-h-[340px] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
          No pages found.
        </Command.Empty>
        {groups.map((group) => (
          <Command.Group
            key={group.id}
            heading={group.label}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-[var(--nav-group-label)]"
          >
            {group.items.map((item) => (
              <Command.Item
                key={item.href}
                value={`${group.label} ${item.label}`}
                onSelect={() => {
                  onOpenChange(false);
                  onSelect(item.href);
                }}
                className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-[var(--text-secondary)] data-[selected=true]:bg-[var(--nav-hover-bg)] data-[selected=true]:text-[var(--text-primary)]"
              >
                <item.icon size={16} strokeWidth={1.7} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
                <CornerDownLeft size={13} className="opacity-0 group-data-[selected=true]:opacity-60" />
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
