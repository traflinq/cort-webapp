"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputBase } from "./styles";
import { useFieldContext } from "./Field";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  /** Rendered as the first, empty option. */
  placeholder?: string;
  /** Visual width hint for filter bars (default: full width of parent). */
  width?: "auto" | "full";
}

/**
 * Native <select>, styled. Native keeps keyboard, screen-reader and mobile behaviour for free.
 * For searchable lists use SearchableSelect.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, placeholder, width = "full", id, children, ...props }, ref) => {
    const field = useFieldContext();
    const resolvedId = id ?? field?.id;
    const ariaInvalid = invalid ?? field?.invalid ?? props["aria-invalid"];
    const describedBy = [props["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
    return (
      <div className={cn("relative", width === "full" ? "w-full" : "w-auto")}>
        <select
          ref={ref}
          id={resolvedId}
          aria-invalid={ariaInvalid ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputBase, "cursor-pointer appearance-none pr-9", width === "auto" && "w-auto", className)}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
        />
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
