"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";
import { dialogZ, type DialogPriority } from "./Dialog";
import { useUiLabels } from "./lib/labels";

const Drawer = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerClose = DialogPrimitive.Close;

export type DrawerSize = "sm" | "md" | "lg" | "xl";

const sizes: Record<DrawerSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
};

export interface DrawerContentProps extends Omit<
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  "title"
> {
  size?: DrawerSize;
  /** `start`/`end` follow the reading direction (RTL-aware); `left`/`right` are physical. */
  side?: "left" | "right" | "start" | "end";
  priority?: DialogPriority;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Extra header content under the title (badges, meta). */
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  flush?: boolean;
  /** No header row (content renders its own, e.g. the mobile sidebar). sr-only title kept. */
  hideHeader?: boolean;
}

const sideCls: Record<NonNullable<DrawerContentProps["side"]>, string> = {
  right:
    "right-0 border-l data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
  left: "left-0 border-r data-[state=open]:animate-sheet-in-left data-[state=closed]:animate-sheet-out-left",
  end: "end-0 border-s data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out rtl:data-[state=open]:animate-sheet-in-left rtl:data-[state=closed]:animate-sheet-out-left",
  start:
    "start-0 border-e data-[state=open]:animate-sheet-in-left data-[state=closed]:animate-sheet-out-left rtl:data-[state=open]:animate-sheet-in rtl:data-[state=closed]:animate-sheet-out",
};

/** Slide-over for detail views (default: trailing edge). Same a11y guarantees as Dialog. */
const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(
  (
    {
      size = "md",
      side = "end",
      priority = "default",
      title,
      description,
      headerExtra,
      footer,
      flush = false,
      hideHeader = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const L = useUiLabels();
    return (
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
            "fixed inset-y-0 flex h-full w-full flex-col bg-card text-fg shadow-[var(--shadow-modal)] outline-none",
            "border-line",
            sideCls[side],
            sizes[size],
            dialogZ[priority],
            className,
          )}
          {...props}
        >
          {hideHeader ? (
            <DialogPrimitive.Title className="sr-only">
              {typeof title === "string" ? title : L.panel}
            </DialogPrimitive.Title>
          ) : (
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                {title ? (
                  <DialogPrimitive.Title className="text-base font-semibold leading-6 text-fg">
                    {title}
                  </DialogPrimitive.Title>
                ) : (
                  <DialogPrimitive.Title className="sr-only">
                    Panel
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="mt-0.5 text-sm text-fg-muted">
                    {description}
                  </DialogPrimitive.Description>
                )}
                {headerExtra && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {headerExtra}
                  </div>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <IconButton
                  label={L.close}
                  size="icon-sm"
                  tooltip={false}
                  className="-me-1.5 -mt-1"
                >
                  <X />
                </IconButton>
              </DialogPrimitive.Close>
            </div>
          )}
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              !flush && "px-5 py-4",
            )}
          >
            {children}
          </div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
DrawerContent.displayName = "DrawerContent";

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent };
