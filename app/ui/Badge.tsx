"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "purple";
export type BadgeVariant = "soft" | "outline" | "solid";

const soft: Record<BadgeTone, string> = {
  neutral: "border-neutral-line bg-neutral-soft text-neutral-ink",
  brand: "border-brand-line bg-brand-soft text-brand-ink",
  success: "border-success-line bg-success-soft text-success-ink",
  warning: "border-warning-line bg-warning-soft text-warning-ink",
  danger: "border-danger-line bg-danger-soft text-danger-ink",
  info: "border-info-line bg-info-soft text-info-ink",
  purple: "border-purple-line bg-purple-soft text-purple-ink",
};

const outline: Record<BadgeTone, string> = {
  neutral: "border-neutral-line bg-transparent text-neutral-ink",
  brand: "border-brand-line bg-transparent text-brand-ink",
  success: "border-success-line bg-transparent text-success-ink",
  warning: "border-warning-line bg-transparent text-warning-ink",
  danger: "border-danger-line bg-transparent text-danger-ink",
  info: "border-info-line bg-transparent text-info-ink",
  purple: "border-purple-line bg-transparent text-purple-ink",
};

const solid: Record<BadgeTone, string> = {
  neutral: "border-transparent bg-fg text-page",
  brand: "border-transparent bg-brand text-white",
  success: "border-transparent bg-success text-white",
  warning: "border-transparent bg-warning text-black/85",
  danger: "border-transparent bg-danger text-white",
  info: "border-transparent bg-info text-white",
  purple: "border-transparent bg-purple-solid text-white",
};

export const toneDot: Record<BadgeTone, string> = {
  neutral: "bg-fg-muted",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  purple: "bg-purple-solid",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  /** Leading status dot (adds a non-colour cue when paired with text). */
  dot?: boolean;
  icon?: React.ReactNode;
}

export function Badge({ tone = "neutral", variant = "soft", size = "md", dot = false, icon, className, children, ...props }: BadgeProps) {
  const toneCls = variant === "solid" ? solid[tone] : variant === "outline" ? outline[tone] : soft[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border font-medium leading-none",
        size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs",
        toneCls,
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", variant === "solid" ? "bg-current opacity-80" : toneDot[tone])} />}
      {icon && <span className="[&_svg]:size-3">{icon}</span>}
      {children}
    </span>
  );
}
