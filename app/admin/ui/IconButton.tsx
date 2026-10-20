"use client";

import * as React from "react";
import { Button, type ButtonProps } from "./Button";
import { Tooltip } from "./Tooltip";

export interface IconButtonProps extends Omit<ButtonProps, "children" | "leftIcon" | "rightIcon" | "aria-label"> {
  /** Accessible name. Rendered as aria-label and (by default) as a tooltip. */
  label: string;
  /** The icon element. */
  children: React.ReactNode;
  /** Set false to suppress the tooltip (e.g. inside dialogs' close button). */
  tooltip?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

/** Icon-only button that is always labelled. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tooltip = true, tooltipSide, size = "icon", variant = "ghost", children, ...props }, ref) => {
    const button = (
      <Button ref={ref} aria-label={label} size={size} variant={variant} {...props}>
        {children}
      </Button>
    );
    if (!tooltip) return button;
    return (
      <Tooltip content={label} side={tooltipSide}>
        {button}
      </Tooltip>
    );
  },
);
IconButton.displayName = "IconButton";
