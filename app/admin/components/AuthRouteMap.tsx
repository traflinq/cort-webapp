"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The sign-in visual: a night-time city map with the route Traflinq replaces (grey, dashed, full of
 * detours) and the optimised route (coral) it runs instead, with the branded shuttle from the live map
 * travelling on it. It is the product's own story (route optimisation, live tracking) told with the
 * product's own vehicle art (public/login/bus_birdeye.webp, resized from public/bus_birdeye.png).
 *
 * Purely decorative (aria-hidden). The shuttle moves slowly along the route; with reduced motion it
 * holds still at a fixed point. The map is a night scene in both themes, so its colours are fixed.
 */

// Layout (viewBox 600 x 800): everything that matters sits in x 70-530 (safe from side cropping on tall
// panels) and y 90-470 (above the copy at the bottom of the panel).
// Optimised shuttle route: pickups along a clean line to the office.
const AFTER = "M -20 560 C 60 520, 110 470, 150 430 S 230 350, 290 330 S 390 290, 430 250 S 470 180, 500 150";
// The route it replaced: same start and end, with detours and doubling back.
const BEFORE =
  "M -20 560 C 30 500, 70 470, 110 480 S 170 520, 200 470 S 170 380, 230 370 S 320 420, 340 360 S 330 280, 380 270 S 450 300, 470 250 S 440 170, 500 150";
// The avenue across the top.
const AVENUE = "M -40 210 C 90 220, 190 180, 270 160 S 430 120, 660 70";

const STOPS: [number, number][] = [
  [150, 430],
  [290, 330],
  [430, 250],
];
const OFFICE: [number, number] = [500, 150];

function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

/** A bird's-eye vehicle that follows `path`. The art faces up, so it is turned to face along the route. */
function Vehicle({ href, path, size, dur, begin, still, reduced }: { href: string; path: string; size: number; dur: string; begin: string; still: number; reduced: boolean }) {
  return (
    <g>
      {reduced ? (
        <animateMotion dur="1s" fill="freeze" rotate="auto" keyPoints={`${still};${still}`} keyTimes="0;1" calcMode="linear" path={path} />
      ) : (
        <animateMotion dur={dur} begin={begin} repeatCount="indefinite" rotate="auto" path={path} />
      )}
      <image href={href} x={-size / 2} y={-size / 2} width={size} height={size} transform="rotate(90)" />
    </g>
  );
}

/**
 * `framing` picks the part of the map to show: "panel" fills a tall desktop panel; "band" is a wide strip
 * of the routes for the phone header.
 */
export function AuthRouteMap({ className, animate = true, framing = "panel" }: { className?: string; animate?: boolean; framing?: "panel" | "band" }) {
  const reduced = usePrefersReducedMotion() || !animate;
  const id = React.useId().replace(/:/g, "");

  return (
    <svg
      aria-hidden="true"
      className={cn("block h-full w-full", className)}
      viewBox={framing === "band" ? "0 110 600 330" : "0 0 600 800"}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <defs>
        <radialGradient id={`${id}-glow`} cx="62%" cy="38%" r="70%">
          <stop offset="0" stopColor="#1f1f1f" />
          <stop offset="1" stopColor="#111111" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect width="600" height="800" fill={`url(#${id}-glow)`} />

      {/* City blocks: a slightly irregular street grid. */}
      <g stroke="#ffffff" strokeOpacity="0.045" strokeWidth="1">
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`v${i}`} x1={i * 44 - 10} y1="-10" x2={i * 44 + 34} y2="810" />
        ))}
        {Array.from({ length: 20 }, (_, i) => (
          <line key={`h${i}`} x1="-10" y1={i * 44 + 8} x2="610" y2={i * 44 - 22} />
        ))}
      </g>

      {/* Arterial roads. */}
      <g stroke="#ffffff" strokeOpacity="0.07" strokeLinecap="round">
        <path d="M -20 380 C 160 360, 320 400, 620 330" strokeWidth="14" />
        <path d={AVENUE} strokeWidth="16" />
        <path d="M 360 -20 C 380 200, 330 460, 400 820" strokeWidth="12" />
      </g>

      {/* Before: the replaced route. */}
      <path d={BEFORE} stroke="#ffffff" strokeOpacity="0.28" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />

      {/* After: the optimised route, with a soft halo. */}
      <path d={AFTER} stroke="#e8692e" strokeOpacity="0.35" strokeWidth="10" filter={`url(#${id}-soft)`} />
      <path d={AFTER} stroke="#e8692e" strokeWidth="3" strokeLinecap="round" />

      {/* Pickup stops and the office. */}
      {STOPS.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="7" fill="#111111" stroke="#e8692e" strokeWidth="2.5" />
        </g>
      ))}
      <g transform={`translate(${OFFICE[0]} ${OFFICE[1]})`}>
        <circle r="18" fill="#e8692e" fillOpacity="0.16" />
        <circle r="9" fill="#e8692e" />
        <circle r="3.5" fill="#111111" />
      </g>

      <Vehicle href="/login/bus_birdeye.webp" path={AFTER} size={104} dur="22s" begin="0s" still={0.55} reduced={reduced} />

    </svg>
  );
}
