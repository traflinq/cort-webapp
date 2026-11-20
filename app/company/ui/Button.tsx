"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "./styles";
import { Tooltip } from "./Tooltip";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "icon" | "icon-sm";

const VARIANT: Record<Variant, string> = {
  /** Navy — the default action. */
  primary: "bg-action text-on-action hover:bg-action-hover",
  /** Orange — at most one per page: the key action (New booking, Create route…). */
  accent: "bg-highlight text-on-highlight hover:bg-highlight-hover",
  secondary: "border border-line-strong bg-card text-fg hover:bg-subtle",
  ghost: "text-fg-secondary hover:bg-subtle hover:text-fg",
  danger: "bg-danger-ink text-card hover:opacity-90",
  link: "h-auto px-0 text-action underline-offset-4 hover:underline",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm sm:h-9",
  icon: "size-10 sm:size-9",
  "icon-sm": "size-8",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Render the child (e.g. a link) with button styling. */
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function buttonClass({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-md font-semibold transition-colors",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    focusRing,
    VARIANT[variant],
    variant === "link" ? "" : SIZE[size],
    className,
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, asChild, loading, leftIcon, rightIcon, className, children, disabled, type, ...props },
  ref,
) {
  const cls = buttonClass({ variant, size, className });
  if (asChild) {
    return (
      <Slot ref={ref as React.Ref<HTMLElement>} className={cls} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button ref={ref} type={type ?? "button"} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "leftIcon" | "rightIcon" | "children" | "size"> {
  /** Accessible name; also shown as the tooltip. */
  label: string;
  icon: React.ReactNode;
  size?: "md" | "sm";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = "md", variant = "ghost", ...props },
  ref,
) {
  return (
    <Tooltip content={label}>
      <Button ref={ref} aria-label={label} variant={variant} size={size === "sm" ? "icon-sm" : "icon"} {...props}>
        {icon}
      </Button>
    </Tooltip>
  );
});
