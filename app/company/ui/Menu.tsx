"use client";

import * as React from "react";
import Link from "next/link";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={6}
        {...props}
        className={cn("z-[80] min-w-44 rounded-lg border border-line bg-elevated p-1 shadow-[var(--shadow-modal)] outline-none animate-menu-in", className)}
      />
    </DropdownPrimitive.Portal>
  );
}

const ITEM =
  "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-sm text-fg outline-none transition-colors " +
  "data-[highlighted]:bg-subtle data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted";

export function DropdownMenuItem({
  destructive,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { destructive?: boolean }) {
  return <DropdownPrimitive.Item {...props} className={cn(ITEM, destructive && "text-danger-ink [&_svg]:text-danger-ink", className)} />;
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label {...props} className={cn("px-2.5 py-1.5 text-xs text-fg-muted", className)} />;
}

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-line" />;
}

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  separatorBefore?: boolean;
}

/** "⋯" overflow menu for row / card actions. Renders nothing when every item is hidden. */
export function ActionMenu({ items, label }: { items: ActionMenuItem[]; label?: string }) {
  const t = useTranslations("common.ui");
  const visible = items.filter((i) => !i.hidden);
  if (visible.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label ?? t("moreActions")}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {visible.map((item, i) => (
          <React.Fragment key={i}>
            {item.separatorBefore && i > 0 && <DropdownMenuSeparator />}
            {item.href ? (
              <DropdownMenuItem asChild destructive={item.destructive} disabled={item.disabled}>
                <Link href={item.href}>
                  {item.icon}
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem destructive={item.destructive} disabled={item.disabled} onSelect={item.onSelect}>
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            )}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
