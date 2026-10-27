"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Phone } from "lucide-react";
import { Badge, Button } from "..";
import type { NotStartedShuttleRide } from "../../../lib/types/admin-dashboard";

function late(min: number) {
  if (min < 60) return `${min} min late`;
  return `${Math.floor(min / 60)}h ${min % 60}m late`;
}

/** Highlighted daily alert: today's shuttle rides whose departure time passed without the driver starting. */
export function NotStartedRides({ rides }: { rides: NotStartedShuttleRide[] }) {
  if (rides.length === 0) return null;
  return (
    <section role="alert" className="overflow-hidden rounded-xl border border-danger-line bg-danger-soft">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger-ink" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-fg">
              {rides.length} shuttle {rides.length === 1 ? "ride has" : "rides have"} not started today
            </p>
            <p className="text-sm text-fg-secondary">Departure time has passed and the driver hasn&apos;t started the ride.</p>
          </div>
        </div>
        <Button variant="danger" size="sm" asChild>
          <Link href="/admin/ops/shuttle">
            Open live ops
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <ul className="divide-y divide-danger-line border-t border-danger-line bg-surface">
        {rides.map((r) => (
          <li key={r.tripId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-fg">{r.driverName ?? "No driver assigned"}</p>
              <p className="truncate text-fg-secondary">
                {r.routeName}
                {r.companyName ? ` · ${r.companyName}` : ""}
                {r.vehiclePlate ? ` · ${r.vehiclePlate}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-fg-secondary">
                {r.direction === "MORNING" ? "Morning" : "Evening"} · due {r.scheduledTime}
              </span>
              <Badge tone="danger">{late(r.minutesLate)}</Badge>
              {r.driverPhone && (
                <a href={`tel:${r.driverPhone}`} className="inline-flex items-center gap-1 text-brand hover:underline" aria-label={`Call ${r.driverName ?? "driver"}`}>
                  <Phone className="size-4" aria-hidden="true" />
                  {r.driverPhone}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
