import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Smaller padding for inside tables/cards. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, compact = false, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-10" : "px-6 py-16", className)}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-subtle text-fg-muted [&_svg]:size-5">
        {icon ?? <Inbox aria-hidden="true" />}
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-4 flex items-center gap-2">{action}</div>}
    </div>
  );
}
