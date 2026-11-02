import * as React from "react";
import { cn } from "@/lib/utils";

/** Orange gradient card ("Premium+ Plan"): chip, white title, big figure, CTA. */
export function PromoCard({
  chip,
  title,
  value,
  suffix,
  icon,
  action,
  children,
  className,
}: {
  chip?: React.ReactNode;
  title: React.ReactNode;
  value?: React.ReactNode;
  suffix?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[var(--radius-card)] p-6 text-white",
        "bg-[radial-gradient(120%_120%_at_85%_10%,#f7b27a_0%,rgba(247,178,122,0)_45%),linear-gradient(135deg,#f58c4a_0%,#f06a22_50%,#e2551b_100%)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {chip ? (
          <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium uppercase tracking-wide">{chip}</span>
        ) : <span />}
        {icon && <span className="text-white/90 [&_svg]:size-8">{icon}</span>}
      </div>
      <div className="mt-5 text-2xl font-semibold leading-tight">{title}</div>
      {value != null && (
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-medium tracking-tight tabular-nums">{value}</span>
          {suffix && <span className="text-lg text-white/90">{suffix}</span>}
        </div>
      )}
      {children}
      {action && <div className="mt-auto pt-5">{action}</div>}
    </div>
  );
}
