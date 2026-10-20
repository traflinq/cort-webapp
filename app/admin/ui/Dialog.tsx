"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";
export type DialogPriority = "default" | "elevated" | "high" | "top";

const sizes: Record<DialogSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-[calc(100vw-3rem)]",
};

/** Stacking: default < elevated (modal over modal) < high < top (confirm dialogs). */
export const dialogZ: Record<DialogPriority, string> = {
  default: "z-50",
  elevated: "z-[60]",
  high: "z-[70]",
  top: "z-[80]",
};

export interface DialogContentProps extends Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "title"> {
  size?: DialogSize;
  priority?: DialogPriority;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned actions in a sticky footer. */
  footer?: React.ReactNode;
  hideClose?: boolean;
  /** Body scrolls inside the dialog (default). Set false for content that manages its own scroll. */
  scrollable?: boolean;
  /** Remove body padding (e.g. full-bleed tables). */
  flush?: boolean;
  /** No header row at all (command palettes). An sr-only title is still rendered. */
  hideHeader?: boolean;
}

/**
 * Accessible modal: focus trap, Esc, scroll lock, aria-modal, labelled title.
 * Mobile: full-width sheet with 1rem gutters; desktop: centred card.
 */
const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  (
    { size = "md", priority = "default", title, description, footer, hideClose = false, scrollable = true, flush = false, hideHeader = false, className, children, ...props },
    ref,
  ) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
          dialogZ[priority],
        )}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-line bg-card text-fg shadow-[var(--shadow-modal)] outline-none",
          "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          sizes[size],
          dialogZ[priority],
          className,
        )}
        {...props}
      >
        {hideHeader ? (
          <DialogPrimitive.Title className="sr-only">{typeof title === "string" ? title : "Dialog"}</DialogPrimitive.Title>
        ) : (
          <div className={cn("flex items-start justify-between gap-4 px-5 py-4", (title || description) && "border-b border-line")}>
            <div className="min-w-0 flex-1">
              {title ? (
                <DialogPrimitive.Title className="text-base font-semibold leading-6 text-fg">{title}</DialogPrimitive.Title>
              ) : (
                <DialogPrimitive.Title className="sr-only">Dialog</DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-fg-muted">{description}</DialogPrimitive.Description>
              )}
            </div>
            {!hideClose && (
              <DialogPrimitive.Close asChild>
                <IconButton label="Close" size="icon-sm" tooltip={false} className="-mr-1.5 -mt-1">
                  <X />
                </IconButton>
              </DialogPrimitive.Close>
            )}
          </div>
        )}
        <div className={cn("min-h-0 flex-1", scrollable && "overflow-y-auto", !flush && "px-5 py-4")}>{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
            {footer}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
DialogContent.displayName = "DialogContent";

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription };
