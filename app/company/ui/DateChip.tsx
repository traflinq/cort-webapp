import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/** White pill with a calendar icon circle and a date ("Mon, 06 May"). */
export function DateChip({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-12 shrink-0 items-center gap-3 rounded-full bg-[var(--bg-card)] ps-2 pe-6 text-[15px] text-[var(--text-primary)] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--tile-bg)]">
        <CalendarDays size={16} strokeWidth={1.6} />
      </span>
      {label}
    </span>
  );
}
