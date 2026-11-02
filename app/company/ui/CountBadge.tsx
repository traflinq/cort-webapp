import { cn } from "@/lib/utils";

/** Small navy pill with a white number (thumbnail corner badges). */
export function CountBadge({ value, className, tone = "navy" }: { value: number | string; className?: string; tone?: "navy" | "orange" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-medium text-white tabular-nums ring-2 ring-[var(--bg-card)]",
        tone === "navy" ? "bg-[var(--cort-navy)]" : "bg-[var(--cort-orange)]",
        className,
      )}
    >
      {value}
    </span>
  );
}
