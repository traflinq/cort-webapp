import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-line", className)} {...props} />;
}

/** Table body rows for loading states (use inside <tbody>). */
export function TableSkeletonRows({ columns = 5, rows = 5, cellClassName = "px-4 py-3" }: { columns?: number; rows?: number; cellClassName?: string }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className={cellClassName}>
              <Skeleton className="h-4" style={{ width: `${55 + ((r * 7 + c * 13) % 35)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Stand-alone skeleton for a card/panel. */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-card p-5", className)}>
      <Skeleton className="mb-4 h-4 w-1/3" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: `${90 - i * 15}%` }} />
        ))}
      </div>
    </div>
  );
}

/** KPI card skeleton. */
export function KpiSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-card p-4", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

/** Full-page skeleton for route transitions. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      <div className="rounded-xl border border-line bg-card">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <table className="w-full">
          <tbody className="divide-y divide-line">
            <TableSkeletonRows columns={5} rows={6} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
