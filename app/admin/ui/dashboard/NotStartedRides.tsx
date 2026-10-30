"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ChevronDown, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, CardHeader } from "..";
import type { NotStartedShuttleRide } from "../../../lib/types/admin-dashboard";
import { initials } from "../../lib/format";

function late(min: number) {
  if (min < 60) return `${min} min late`;
  return `${Math.floor(min / 60)}h ${min % 60}m late`;
}

const COLLAPSED_COUNT = 5;

/**
 * Today's shuttle rides whose departure time passed without the driver starting.
 * Always rendered so ops knows where to look; latest-running first.
 */
export function NotStartedRides({ rides }: { rides: NotStartedShuttleRide[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const sorted = React.useMemo(() => [...rides].sort((a, b) => b.minutesLate - a.minutesLate), [rides]);
  const visible = expanded ? sorted : sorted.slice(0, COLLAPSED_COUNT);
  const hidden = sorted.length - COLLAPSED_COUNT;
  const hasLate = sorted.length > 0;

  return (
    <Card id="late-rides" className={cn("scroll-mt-20 overflow-hidden", hasLate && "border-danger-line")}>
      <CardHeader
        flush={!hasLate}
        title={
          <span className="inline-flex items-center gap-2">
            <span className="relative flex size-2" aria-hidden="true">
              {hasLate && <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60 motion-reduce:hidden" />}
              <span className={cn("relative inline-flex size-2 rounded-full", hasLate ? "bg-danger" : "bg-success")} />
            </span>
            Drivers not started
            {hasLate && (
              <Badge tone="danger" size="sm">
                {sorted.length}
              </Badge>
            )}
          </span>
        }
        description={hasLate ? "Today's shuttle rides past departure time that the driver hasn't started." : undefined}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/ops/shuttle">
              Live ops
              <ArrowUpRight />
            </Link>
          </Button>
        }
      >
        {!hasLate && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
            <CheckCircle2 className="size-3.5 text-success-ink" aria-hidden="true" />
            Every shuttle ride due so far today has started.
          </p>
        )}
      </CardHeader>

      {hasLate && (
        <>
          <ul className="divide-y divide-line">
            {visible.map((r) => (
              <li key={r.tripId} className="grid grid-cols-1 items-center gap-x-6 gap-y-2 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold text-fg">
                    {r.driverName ? initials(r.driverName) : "?"}
                  </span>
                  <div className="min-w-0">
                    <p className={cn("truncate font-medium", r.driverName ? "text-fg" : "text-danger-ink")}>{r.driverName ?? "No driver assigned"}</p>
                    {r.driverPhone ? (
                      <a
                        href={`tel:${r.driverPhone}`}
                        className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg hover:underline"
                        aria-label={`Call ${r.driverName ?? "driver"} on ${r.driverPhone}`}
                      >
                        <Phone className="size-3" aria-hidden="true" />
                        {r.driverPhone}
                      </a>
                    ) : (
                      <p className="text-xs text-fg-muted">No phone on file</p>
                    )}
                  </div>
                </div>
                <div className="min-w-0 pl-11 sm:pl-0">
                  <p className="truncate text-fg">{r.routeName}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {[r.companyName, r.vehiclePlate].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3 pl-11 sm:justify-end sm:pl-0">
                  <span className="whitespace-nowrap text-xs text-fg-muted">
                    {r.direction === "MORNING" ? "Morning" : "Evening"} · due {r.scheduledTime}
                  </span>
                  <Badge tone="danger">{late(r.minutesLate)}</Badge>
                </div>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-center gap-1.5 border-t border-line px-4 py-2 text-xs font-medium text-fg-muted hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {expanded ? "Show less" : `Show ${hidden} more`}
              <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </Card>
  );
}
