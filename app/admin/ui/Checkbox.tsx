"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "./styles";

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const reactId = React.useId();
    const checkboxId = id ?? `cb-${reactId}`;

    const box = (
      <CheckboxPrimitive.Root
        ref={ref}
        id={checkboxId}
        className={cn(
          "peer size-4 shrink-0 cursor-pointer rounded border border-line-strong bg-[var(--bg-input)] transition-colors",
          "data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand",
          "disabled:cursor-not-allowed disabled:opacity-50",
          focusRing,
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
          {props.checked === "indeterminate" ? (
            <Minus className="size-3" strokeWidth={3} aria-hidden="true" />
          ) : (
            <Check className="size-3" strokeWidth={3} aria-hidden="true" />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );

    if (!label) return box;

    return (
      <div className="flex items-start gap-2.5">
        <span className="flex h-5 items-center">{box}</span>
        <div className="grid gap-0.5">
          <label htmlFor={checkboxId} className="cursor-pointer text-sm leading-5 text-fg peer-disabled:opacity-60">
            {label}
          </label>
          {description && <p className="text-xs text-fg-muted">{description}</p>}
        </div>
      </div>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
