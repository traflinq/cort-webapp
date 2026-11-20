import * as React from "react";
import { cn } from "@/lib/utils";

/** The one surface: white, hairline border, 8px corners, no shadow. */
export function Card({
  padded = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div {...props} className={cn("rounded-lg border border-line bg-card", padded && "p-4 sm:p-5", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 shrink-0 text-fg-muted [&_svg]:size-[18px]">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}

/** A titled block of page content that is not a card (e.g. a group of stat cards). */
export function Section({
  title,
  description,
  actions,
  badge,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-fg">
            {title}
            {badge}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Label / value pairs in a detail view. */
export function DescriptionList({
  items,
  cols = 2,
  className,
}: {
  items: { label: React.ReactNode; value: React.ReactNode; span?: boolean }[];
  cols?: 1 | 2 | 3;
  className?: string;
}) {
  const grid = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" }[cols];
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4", grid, className)}>
      {items.map((item, i) => (
        <div key={i} className={cn("min-w-0", item.span && "sm:col-span-full")}>
          <dt className="text-xs text-fg-muted">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium text-fg">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
