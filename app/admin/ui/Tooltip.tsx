"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/** Mount once near the root of the admin tree (done in app/admin/layout.tsx). */
export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  className?: string;
}

/**
 * Tooltip for supplementary info only. Never the sole label of a control —
 * pair with aria-label (IconButton does this for you).
 */
export function Tooltip({ content, children, side = "top", align = "center", delayDuration = 300, className }: TooltipProps) {
  if (content === null || content === undefined || content === false) return children;
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "z-[100] max-w-xs select-none rounded-md bg-fg px-2.5 py-1.5 text-xs font-medium text-page shadow-md animate-menu-in",
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-fg" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
