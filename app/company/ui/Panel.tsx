import * as React from "react";
import { cn } from "@/lib/utils";

/** White rounded card from the reference (radius 24, soft shadow, no border). */
export function Panel({
  className,
  children,
  as: Tag = "div",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" }) {
  return (
    <Tag
      className={cn(
        "relative min-w-0 rounded-[var(--radius-card)] bg-[var(--bg-card)] p-5 text-[var(--text-primary)] shadow-[var(--shadow-card)] sm:p-6",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** Card title (20px/500) + grey subtitle, with optional actions on the end side. */
export function PanelHeading({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-medium leading-tight text-[var(--text-primary)]">{title}</h2>
        {subtitle && <div className="mt-1.5 text-sm text-[var(--text-muted)]">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
