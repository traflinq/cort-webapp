"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { IconButton, type IconButtonProps } from "./IconButton";

export interface RefreshButtonProps extends Omit<IconButtonProps, "children" | "label"> {
  /** Accessible name, e.g. "Refresh bookings". */
  label?: string;
  /** Spins the icon and disables the button while a refresh is running. */
  loading?: boolean;
}

/** The one refresh control used in page headers. */
export function RefreshButton({ label = "Refresh", loading = false, variant = "outline", disabled, ...props }: RefreshButtonProps) {
  return (
    <IconButton label={label} variant={variant} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      <RefreshCw className={loading ? "animate-spin" : undefined} />
    </IconButton>
  );
}
