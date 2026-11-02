"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type PillVariant = "primary" | "secondary" | "outline" | "navy" | "white";
export type PillSize = "md" | "sm";

const variants: Record<PillVariant, { base: string; icon: string }> = {
  primary: {
    base: "bg-[var(--cort-orange)] text-white hover:bg-[var(--cort-orange-hover)] shadow-[0_6px_16px_rgba(240,106,34,0.28)]",
    icon: "bg-white/25 text-white",
  },
  secondary: {
    base: "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-card)] hover:bg-[var(--bg-card-hover)]",
    icon: "bg-[var(--tile-bg)] text-[var(--text-primary)]",
  },
  outline: {
    base: "border border-[var(--pill-line)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--nav-hover-bg)]",
    icon: "bg-[var(--tile-bg)] text-[var(--text-primary)]",
  },
  navy: {
    base: "bg-[var(--cort-navy)] text-white hover:bg-[var(--cort-navy-hover)]",
    icon: "bg-white/15 text-white",
  },
  white: {
    base: "bg-white text-[#1c1b4d] hover:bg-white/90",
    icon: "bg-[#f3f4f8] text-[#1c1b4d]",
  },
};

const sizes: Record<PillSize, { base: string; withIcon: string; icon: string }> = {
  md: { base: "h-12 px-6 text-[15px]", withIcon: "ps-2 pe-6", icon: "size-8 [&_svg]:size-4" },
  sm: { base: "h-10 px-4 text-sm", withIcon: "ps-1.5 pe-4", icon: "size-7 [&_svg]:size-3.5" },
};

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillVariant;
  size?: PillSize;
  /** Icon shown inside a tinted circle at the start of the pill. */
  icon?: React.ReactNode;
  /** Render as a Next link instead of a button. */
  href?: string;
  loading?: boolean;
}

export function pillClasses(variant: PillVariant = "primary", size: PillSize = "md", withIcon = false, className?: string) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-2.5 whitespace-nowrap rounded-full font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]",
    "disabled:pointer-events-none disabled:opacity-50",
    sizes[size].base,
    withIcon && sizes[size].withIcon,
    variants[variant].base,
    className,
  );
}

/** Rounded pill button from the reference ("Add New Shipment", "Get Fleetly+", "Edit"). */
export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ variant = "primary", size = "md", icon, href, loading, className, children, type = "button", disabled, ...props }, ref) => {
    const content = (
      <>
        {icon && (
          <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full", sizes[size].icon, variants[variant].icon)}>
            {loading ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
          </span>
        )}
        {!icon && loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {children}
      </>
    );
    const classes = pillClasses(variant, size, !!icon, className);
    if (href) {
      return (
        <Link href={href} className={classes}>
          {content}
        </Link>
      );
    }
    return (
      <button ref={ref} type={type} disabled={disabled || loading} className={classes} {...props}>
        {content}
      </button>
    );
  },
);
PillButton.displayName = "PillButton";
