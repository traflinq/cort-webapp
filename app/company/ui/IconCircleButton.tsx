"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type IconCircleVariant = "white" | "outline" | "navy" | "ghost";

const variants: Record<IconCircleVariant, string> = {
  white: "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-card)] hover:bg-[var(--bg-card-hover)]",
  outline: "border border-[var(--pill-line)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--nav-hover-bg)]",
  navy: "bg-[var(--cort-navy)] text-white hover:bg-[var(--cort-navy-hover)]",
  ghost: "bg-transparent text-[var(--text-primary)] hover:bg-[var(--nav-hover-bg)]",
};

const sizes = {
  lg: "size-14 [&_svg]:size-5",
  md: "size-12 [&_svg]:size-5",
  sm: "size-10 [&_svg]:size-4",
  xs: "size-8 [&_svg]:size-4",
};

export interface IconCircleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name (also used as the tooltip title). */
  label: string;
  variant?: IconCircleVariant;
  size?: keyof typeof sizes;
  href?: string;
}

/** Round icon button: white (header), outline (card toolbars) or navy (call / expand). */
export const IconCircleButton = React.forwardRef<HTMLButtonElement, IconCircleButtonProps>(
  ({ label, variant = "white", size = "md", href, className, children, type = "button", ...props }, ref) => {
    const classes = cn(
      "relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]",
      "disabled:pointer-events-none disabled:opacity-50",
      variants[variant],
      sizes[size],
      className,
    );
    if (href) {
      return (
        <Link href={href} aria-label={label} title={label} className={classes}>
          {children}
        </Link>
      );
    }
    return (
      <button ref={ref} type={type} aria-label={label} title={label} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
IconCircleButton.displayName = "IconCircleButton";
