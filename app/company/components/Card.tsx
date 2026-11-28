import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Company-portal surface. Flat by default: 1px border, 14px radius, no resting shadow.
 * `withLeftBorder` is accepted for older call sites but no longer draws an accent stripe.
 */
export function Card({
  children,
  className,
  withLeftBorder,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { withLeftBorder?: boolean }) {
  void withLeftBorder;
  return (
    <div
      className={cn(
        "h-full min-w-0 rounded-[14px] border border-line bg-card p-4 text-fg shadow-[var(--shadow-card)] sm:p-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-fg [&_svg]:size-4 [&_svg]:text-fg-muted">
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </h3>
  );
}
