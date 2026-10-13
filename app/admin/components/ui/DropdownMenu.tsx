"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { cx } from "./cx";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      {/* Portals escape .admin-portal, so re-scope it to keep the theme tokens. */}
      <div className="admin-portal">
        <Menu.Content
          sideOffset={sideOffset}
          className={cx(
            "z-[80] min-w-[220px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1.5 text-[var(--text-primary)] shadow-[var(--shadow-modal)]",
            "data-[state=open]:animate-[admin-pop-in_160ms_var(--ease-smooth)]",
            className,
          )}
          {...props}
        />
      </div>
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof Menu.Item> & { danger?: boolean }) {
  return (
    <Menu.Item
      className={cx(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors",
        danger
          ? "text-[var(--danger-text)] data-[highlighted]:bg-rose-500/10"
          : "text-[var(--text-secondary)] data-[highlighted]:bg-[var(--nav-hover-bg)] data-[highlighted]:text-[var(--text-primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cx("px-2.5 py-2", className)} {...props} />;
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="-mx-1.5 my-1.5 h-px bg-[var(--border-default)]" />;
}
