"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "./styles";

export interface SwitchProps extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, "children"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  loading?: boolean;
  size?: "sm" | "md";
}

/** Toggle with a visible focus ring and an accessible name (label or aria-label). */
const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  ({ className, label, description, loading = false, disabled, size = "md", id, ...props }, ref) => {
    const reactId = React.useId();
    const switchId = id ?? `sw-${reactId}`;

    const control = (
      <SwitchPrimitive.Root
        ref={ref}
        id={switchId}
        disabled={disabled || loading}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          "data-[state=checked]:bg-brand data-[state=unchecked]:bg-line-strong disabled:cursor-not-allowed disabled:opacity-60",
          size === "sm" ? "h-5 w-9" : "h-6 w-11",
          focusRing,
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "pointer-events-none flex items-center justify-center rounded-full bg-white shadow-sm transition-transform",
            size === "sm" ? "size-4 data-[state=checked]:translate-x-4" : "size-5 data-[state=checked]:translate-x-5",
          )}
        >
          {loading && <Loader2 className="size-3 animate-spin text-brand" aria-hidden="true" />}
        </SwitchPrimitive.Thumb>
      </SwitchPrimitive.Root>
    );

    if (!label) return control;

    return (
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-0.5">
          <label htmlFor={switchId} className="cursor-pointer text-sm font-medium text-fg">
            {label}
          </label>
          {description && <p className="text-xs text-fg-muted">{description}</p>}
        </div>
        {control}
      </div>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
