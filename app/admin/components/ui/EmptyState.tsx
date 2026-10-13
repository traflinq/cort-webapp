import type { LucideIcon } from "lucide-react";
import { cx } from "./cx";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-muted)]">
          <Icon size={20} strokeWidth={1.6} />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        {description && <p className="max-w-sm text-xs text-[var(--text-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
