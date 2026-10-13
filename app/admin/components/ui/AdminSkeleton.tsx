import { cx } from "./cx";

/** Shimmering placeholder block (styles live in admin-theme.css). */
export function AdminSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("admin-skeleton", className)} />;
}
