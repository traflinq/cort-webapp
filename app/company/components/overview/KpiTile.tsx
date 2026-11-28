"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Figure, focusRing } from "@/app/admin/ui";

/** One headline figure. Label, value, one line of context. No decorative icon. */
export function KpiTile({
  label,
  value,
  sub,
  valueTone = "default",
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueTone?: "default" | "muted" | "success" | "danger";
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <p className="truncate text-[13px] font-medium text-fg-muted">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
          valueTone === "muted" ? "text-fg-muted" : valueTone === "success" ? "text-success-ink" : valueTone === "danger" ? "text-danger-ink" : "text-fg",
        )}
      >
        <Figure value={value} />
      </p>
      {sub && <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">{sub}</div>}
    </>
  );
  const cls = cn("flex min-w-0 flex-col rounded-[14px] border border-line bg-card p-4 shadow-[var(--shadow-card)]", className);
  if (href) {
    return (
      <Link href={href} className={cn(cls, "transition-colors hover:bg-[var(--bg-card-hover)]", focusRing)}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
