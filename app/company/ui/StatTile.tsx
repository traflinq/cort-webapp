import * as React from "react";
import { cn } from "@/lib/utils";

/** Soft grey tile with a value over a small label ("28 kg / Weight"). */
export function StatTile({
  value,
  label,
  className,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-tile)] bg-[var(--tile-bg)] px-2 py-4 text-center",
        className,
      )}
    >
      <span className="max-w-full truncate text-base font-medium text-[var(--text-primary)] tabular-nums">{value}</span>
      <span className="max-w-full text-xs leading-tight text-[var(--text-muted)] [overflow-wrap:anywhere]">{label}</span>
    </div>
  );
}
