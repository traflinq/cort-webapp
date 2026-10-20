"use client";

import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

type DriverAvgRatingProps = {
  avgRating?: number | null;
  reviewCount?: number;
  className?: string;
};

export function DriverAvgRating({ avgRating, reviewCount = 0, className }: DriverAvgRatingProps) {
  if (avgRating == null || reviewCount === 0) {
    return <span className={cn("text-xs text-fg-muted", className)}>No ratings yet</span>;
  }

  const fullStars = Math.floor(avgRating);
  const hasHalf = avgRating - fullStars >= 0.25 && avgRating - fullStars < 0.75;
  const roundUp = avgRating - fullStars >= 0.75;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => {
            const filled = i < fullStars || (i === fullStars && roundUp);
            const half = i === fullStars && hasHalf && !roundUp;
            if (half) {
              return (
                <span key={i} className="relative size-3.5">
                  <Star className="absolute inset-0 size-3.5 text-line-strong" fill="currentColor" />
                  <StarHalf className="absolute inset-0 size-3.5 text-warning" fill="currentColor" />
                </span>
              );
            }
            return <Star key={i} className={cn("size-3.5", filled ? "text-warning" : "text-line-strong")} fill="currentColor" />;
          })}
        </div>
        <span className="text-sm font-semibold tabular-nums text-fg">
          {avgRating.toFixed(1)}
          <span className="sr-only"> out of 5</span>
        </span>
      </div>
      <span className="text-[11px] text-fg-muted">
        {reviewCount} review{reviewCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}
