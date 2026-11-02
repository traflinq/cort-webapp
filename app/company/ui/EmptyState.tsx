import * as React from "react";
import { cn } from "@/lib/utils";
import { Illustration, type IllustrationName } from "./Illustration";

/** Empty / zero-data state: 3D illustration, message, optional next action. */
export function EmptyState({
  illustration = "clipboard",
  title,
  description,
  action,
  className,
  compact = false,
}: {
  illustration?: IllustrationName;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 py-8" : "gap-3 py-14", className)}>
      <Illustration name={illustration} size={compact ? 72 : 104} />
      <div className={cn("font-medium text-[var(--text-primary)]", compact ? "text-base" : "text-lg")}>{title}</div>
      {description && <p className="max-w-sm text-sm text-[var(--text-muted)]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
