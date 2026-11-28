import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedProgressProps {
  /** Amount reached so far (solid segments). */
  value: number;
  /** Scale end. */
  max: number;
  /** Optional second amount past `value`, e.g. a projection (light segments). */
  secondary?: number | null;
  /** Optional target drawn as a dark segment, e.g. a budget. */
  marker?: number | null;
  /** Number of segments across the bar. */
  segments?: number;
  className?: string;
  /** Accessible description of what the bar shows. */
  "aria-label": string;
}

/**
 * Progress as a row of thin segments (the reference's "project progress" bar). Solid segments ramp
 * up in strength towards the current value; follows the reading direction, so it mirrors in RTL.
 */
export function SegmentedProgress({ value, max, secondary, marker, segments = 40, className, "aria-label": ariaLabel }: SegmentedProgressProps) {
  const scale = max > 0 ? max : 1;
  const step = scale / segments;
  const filled = Math.min(segments, Math.round(value / step));
  const second = secondary != null ? Math.min(segments, Math.round(secondary / step)) : filled;
  const markerAt = marker != null ? Math.min(segments - 1, Math.max(0, Math.round(marker / step) - 1)) : -1;

  return (
    <div role="img" aria-label={ariaLabel} className={cn("flex h-8 items-stretch gap-[3px]", className)}>
      {Array.from({ length: segments }, (_, i) => {
        if (i === markerAt) return <span key={i} className="-my-1 flex-1 rounded-[3px] bg-fg" />;
        if (i < filled) {
          const strength = filled > 1 ? 0.45 + (i / (filled - 1)) * 0.55 : 1;
          return <span key={i} className="flex-1 rounded-[3px] bg-brand" style={{ opacity: strength }} />;
        }
        if (i < second) return <span key={i} className="flex-1 rounded-[3px] bg-brand/25" />;
        return <span key={i} className="flex-1 rounded-[3px] bg-line" />;
      })}
    </div>
  );
}
