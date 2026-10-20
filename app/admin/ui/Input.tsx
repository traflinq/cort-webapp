"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { inputBase } from "./styles";
import { useFieldContext } from "./Field";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Monospace: IDs, plates, codes, amounts in tables. */
  mono?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, leftIcon, rightIcon, mono, id, ...props }, ref) => {
    const field = useFieldContext();
    const resolvedId = id ?? field?.id;
    const ariaInvalid = invalid ?? field?.invalid ?? props["aria-invalid"];
    const describedBy = [props["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;

    const input = (
      <input
        ref={ref}
        id={resolvedId}
        aria-invalid={ariaInvalid ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          inputBase,
          "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60",
          leftIcon && "pl-9",
          rightIcon && "pr-9",
          mono && "font-mono tabular-nums",
          className,
        )}
        {...props}
      />
    );

    if (!leftIcon && !rightIcon) return input;

    return (
      <div className="relative w-full">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted [&_svg]:size-4">
            {leftIcon}
          </span>
        )}
        {input}
        {rightIcon && (
          <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center text-fg-muted [&_svg]:size-4">
            {rightIcon}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
