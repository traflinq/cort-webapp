"use client";

import * as React from "react";
import Link from "next/link";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";
import type { ButtonProps } from "./Button";

const DropdownMenu = DM.Root;
const DropdownMenuTrigger = DM.Trigger;
const DropdownMenuGroup = DM.Group;
const DropdownMenuSub = DM.Sub;
const DropdownMenuSubTrigger = DM.SubTrigger;
const DropdownMenuRadioGroup = DM.RadioGroup;

const menuSurface =
  "z-[90] min-w-[11rem] overflow-hidden rounded-lg border border-line bg-popover p-1 text-fg shadow-[var(--shadow-modal)] animate-menu-in";

const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof DM.Content>, React.ComponentPropsWithoutRef<typeof DM.Content>>(
  ({ className, sideOffset = 6, align = "end", ...props }, ref) => (
    <DM.Portal>
      <DM.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        // Don't hand focus back to the trigger: an item often opens a dialog, which must keep focus.
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={cn(menuSurface, className)}
        {...props}
      />
    </DM.Portal>
  ),
);
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuSubContent = React.forwardRef<React.ElementRef<typeof DM.SubContent>, React.ComponentPropsWithoutRef<typeof DM.SubContent>>(
  ({ className, ...props }, ref) => <DM.SubContent ref={ref} className={cn(menuSurface, className)} {...props} />,
);
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

export interface DropdownMenuItemProps extends React.ComponentPropsWithoutRef<typeof DM.Item> {
  destructive?: boolean;
  inset?: boolean;
}

const itemBase =
  "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg outline-none transition-colors data-[highlighted]:bg-subtle data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted";

const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof DM.Item>, DropdownMenuItemProps>(
  ({ className, destructive, inset, ...props }, ref) => (
    <DM.Item
      ref={ref}
      className={cn(
        itemBase,
        destructive && "text-danger-ink data-[highlighted]:bg-danger-soft [&_svg]:text-danger-ink",
        inset && "ps-8",
        className,
      )}
      {...props}
    />
  ),
);
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuCheckboxItem = React.forwardRef<React.ElementRef<typeof DM.CheckboxItem>, React.ComponentPropsWithoutRef<typeof DM.CheckboxItem>>(
  ({ className, children, ...props }, ref) => (
    <DM.CheckboxItem ref={ref} className={cn(itemBase, "ps-8", className)} {...props}>
      <span className="absolute start-2 flex size-4 items-center justify-center">
        <DM.ItemIndicator>
          <Check className="size-3.5" />
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.CheckboxItem>
  ),
);
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

const DropdownMenuRadioItem = React.forwardRef<React.ElementRef<typeof DM.RadioItem>, React.ComponentPropsWithoutRef<typeof DM.RadioItem>>(
  ({ className, children, ...props }, ref) => (
    <DM.RadioItem ref={ref} className={cn(itemBase, "ps-8", className)} {...props}>
      <span className="absolute start-2 flex size-4 items-center justify-center">
        <DM.ItemIndicator>
          <span className="block size-2 rounded-full bg-brand" />
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.RadioItem>
  ),
);
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

const DropdownMenuLabel = React.forwardRef<React.ElementRef<typeof DM.Label>, React.ComponentPropsWithoutRef<typeof DM.Label>>(
  ({ className, ...props }, ref) => (
    <DM.Label ref={ref} className={cn("px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted", className)} {...props} />
  ),
);
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<React.ElementRef<typeof DM.Separator>, React.ComponentPropsWithoutRef<typeof DM.Separator>>(
  ({ className, ...props }, ref) => <DM.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-line", className)} {...props} />,
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("ms-auto text-xs tracking-widest text-fg-muted", className)} {...props} />
);

/* ── ActionMenu: the row-overflow menu used by DataTable and cards ─────── */

export type ActionMenuItem = {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
  /** Skip rendering (permission-gated actions). */
  hidden?: boolean;
  separatorBefore?: boolean;
};

export interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Accessible name of the trigger. */
  label?: string;
  /** Custom trigger element (must accept a ref). */
  trigger?: React.ReactElement;
  align?: "start" | "center" | "end";
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}

export function ActionMenu({ items, label = "More actions", trigger, align = "end", size = "icon-sm", variant = "ghost", className }: ActionMenuProps) {
  const visible = items.filter((i) => !i.hidden);
  if (visible.length === 0) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <IconButton label={label} size={size} variant={variant} className={className}>
            <MoreHorizontal />
          </IconButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {visible.map((item, i) => (
          <React.Fragment key={`${item.label}-${i}`}>
            {item.separatorBefore && i > 0 && <DropdownMenuSeparator />}
            {item.href && !item.disabled ? (
              <DropdownMenuItem asChild destructive={item.destructive}>
                <Link href={item.href}>
                  {item.icon}
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem destructive={item.destructive} disabled={item.disabled} onSelect={() => item.onSelect?.()}>
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

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
