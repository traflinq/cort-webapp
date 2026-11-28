"use client";

import { useTranslations } from "next-intl";
import { Users } from "@/app/components/icons";
import { CardDescription, CardTitle } from "@/app/admin/ui";
import { Card } from "../Card";
import { useOverviewFormat } from "./format";

function Meter({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-subtle" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
      <div className="h-full rounded-full bg-brand" style={{ width: `${v}%` }} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <dt className="min-w-0 truncate text-fg-muted">{label}</dt>
      <dd className="shrink-0 font-medium text-fg tabular-nums">{value}</dd>
    </div>
  );
}

export interface AdoptionData {
  active: number;
  total: number;
  avgRidesPerActive: number | null;
  topPassenger: { name: string; rides: number } | null;
  peakDay: string | null;
  quietDay: string | null;
  /** Trips this month per service; only shown when both services are on. */
  serviceMix: { chauffeur: number; shuttle: number } | null;
}

export function AdoptionCard({ data }: { data: AdoptionData }) {
  const t = useTranslations("company.overview.adoption");
  const f = useOverviewFormat();
  const pct = data.total > 0 ? (data.active / data.total) * 100 : 0;
  const mixTotal = data.serviceMix ? data.serviceMix.chauffeur + data.serviceMix.shuttle : 0;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle as="h2">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xl font-semibold tracking-tight text-fg tabular-nums">
            {f.num(data.active)}
            <span className="ms-1 text-sm font-normal text-fg-muted">{t("ofTotal", { total: f.num(data.total) })}</span>
          </p>
          <span className="text-sm font-medium text-fg-secondary tabular-nums">{f.pct(pct)}</span>
        </div>
        <div className="mt-2">
          <Meter value={pct} label={t("activeShare")} />
        </div>
        <p className="mt-1.5 text-xs text-fg-muted">{t("activeHint")}</p>
      </div>

      <dl className="divide-y divide-line border-t border-line">
        {data.avgRidesPerActive !== null && <Row label={t("avgRides")} value={f.num(data.avgRidesPerActive, 1)} />}
        {data.topPassenger && <Row label={t("topPassenger")} value={t("topPassengerValue", { name: data.topPassenger.name, count: data.topPassenger.rides })} />}
        {data.peakDay && <Row label={t("peakDay")} value={data.peakDay} />}
        {data.quietDay && <Row label={t("quietDay")} value={data.quietDay} />}
      </dl>

      {data.serviceMix && mixTotal > 0 && (
        <div>
          <p className="text-xs font-medium text-fg-muted">{t("serviceMix")}</p>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-subtle" aria-hidden="true">
            <div className="h-full bg-chart-1" style={{ width: `${(data.serviceMix.chauffeur / mixTotal) * 100}%` }} />
            <div className="h-full bg-chart-2" style={{ width: `${(data.serviceMix.shuttle / mixTotal) * 100}%` }} />
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-secondary">
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-1" aria-hidden="true" />{t("chauffeurTrips", { count: data.serviceMix.chauffeur })}</li>
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-2" aria-hidden="true" />{t("shuttleTrips", { count: data.serviceMix.shuttle })}</li>
          </ul>
        </div>
      )}
    </Card>
  );
}

export function DepartmentsCard({ departments }: { departments: { name: string; percentage: number }[] }) {
  const t = useTranslations("company.overview.departments");
  const f = useOverviewFormat();
  const rows = [...departments].sort((a, b) => b.percentage - a.percentage).slice(0, 8);
  const max = Math.max(...rows.map((r) => r.percentage), 1);

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle as="h2">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <Users className="size-5 text-fg-muted" aria-hidden="true" />
          <p className="text-sm text-fg-muted">{t("empty")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((d) => (
            <li key={d.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-fg-secondary" title={d.name}>{d.name}</span>
                <span className="shrink-0 font-medium text-fg tabular-nums">{f.pct(d.percentage)}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                <div className="h-full rounded-full bg-chart-2" style={{ width: `${(d.percentage / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export interface ShuttleSummaryData {
  tripsMtd: number;
  tripsLifetime: number;
  routes: number;
  added: number;
  removed: number;
  topRoute: { route_id: number; route_name: string; added_count: number } | null;
  /** Estimated cost this month (contracted fixed + estimated fuel); null when there's no cost data. */
  costMtd?: number | null;
}

export function ShuttleSummaryCard({ data }: { data: ShuttleSummaryData }) {
  const t = useTranslations("company.overview.shuttle");
  const f = useOverviewFormat();
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle as="h2">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-fg-muted">{t("tripsMtd")}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-fg tabular-nums">{f.num(data.tripsMtd)}</p>
        </div>
        <div>
          <p className="text-xs text-fg-muted">{t("routes")}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-fg tabular-nums">{f.num(data.routes)}</p>
        </div>
      </div>
      <dl className="divide-y divide-line border-t border-line">
        {data.costMtd != null && <Row label={t("costMtd")} value={f.money(data.costMtd)} />}
        <Row label={t("added")} value={f.num(data.added)} />
        <Row label={t("removed")} value={f.num(data.removed)} />
        <Row label={t("tripsLifetime")} value={f.num(data.tripsLifetime)} />
      </dl>
      {(data.topRoute || data.costMtd != null) && (
        <div className="space-y-1 text-xs text-fg-muted">
          {data.topRoute && <p>{t("topRoute", { name: data.topRoute.route_name, count: data.topRoute.added_count })}</p>}
          {data.costMtd != null && <p>{t("costHint")}</p>}
        </div>
      )}
    </Card>
  );
}
