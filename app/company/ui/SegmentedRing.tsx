import * as React from "react";

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

function Ring({ radius, segments, fraction, color, length, width }: {
  radius: number;
  segments: number;
  fraction: number;
  color: string;
  length: number;
  width: number;
}) {
  const filled = Math.round(clamp(fraction) * segments);
  return (
    <>
      {Array.from({ length: segments }, (_, i) => {
        const angle = (i / segments) * 360;
        return (
          <rect
            key={i}
            x={100 - width / 2}
            y={100 - radius - length / 2}
            width={width}
            height={length}
            rx={width / 2}
            transform={`rotate(${angle} 100 100)`}
            fill={i < filled ? color : "var(--ring-track, var(--tile-bg))"}
          />
        );
      })}
    </>
  );
}

/**
 * Dashed dual ring from the "Speed Tracking" card: orange outer ring and navy inner ring,
 * each filled clockwise from the top by a 0–1 fraction.
 */
export function SegmentedRing({
  outer,
  inner,
  children,
  className,
  label,
}: {
  outer: number;
  inner?: number;
  children?: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className={className} style={{ position: "relative", aspectRatio: "1 / 1" }}>
      <svg viewBox="0 0 200 200" role="img" aria-label={label} className="size-full">
        <Ring radius={86} segments={40} fraction={outer} color="var(--cort-orange)" length={18} width={7} />
        {inner != null && (
          <Ring radius={62} segments={32} fraction={inner} color="var(--cort-navy-ring, var(--cort-navy))" length={12} width={6} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
