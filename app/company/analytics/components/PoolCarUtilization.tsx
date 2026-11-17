"use client";

import { useTranslations } from "next-intl";
import { Clock, TrendingDown } from "lucide-react";
import { KpiTile, Panel, SectionHeading, UtilizationBar } from "./ui";

export type PoolUtilization = {
  summary: {
    total_pool_vehicles: number;
    avg_utilization_pct: number;
    idle_vehicle_count: number;
    underutilized_count: number;
  };
  vehicles: {
    vehicle_id: number;
    plate_number: string;
    make: string | null;
    model: string | null;
    category: string | null;
    trips_count: number;
    total_hours_booked: number;
    utilization_pct: number;
  }[];
};

const TH = "px-5 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted text-start";

/**
 * Hours each pool car was booked (last 30 days, 10 working hours a day). Pool size and idle cars
 * are shown with the month's figures above, so only utilization is repeated here.
 */
export function PoolCarUtilization({ data }: { data: PoolUtilization }) {
  const t = useTranslations("company.fleet");
  const tA = useTranslations("company.analytics");
  const s = data.summary;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title={tA("carUtilizationTitle")} description={tA("carUtilizationDescription")} badge={tA("last30Days")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiTile label={t("avgUtilization")} value={`${s.avg_utilization_pct}%`} icon={<Clock />} tone={s.avg_utilization_pct < 30 ? "warning" : undefined} />
        <KpiTile label={t("underutilized")} value={s.underutilized_count.toLocaleString()} icon={<TrendingDown />} tone={s.underutilized_count > 0 ? "warning" : undefined} />
      </div>
      {data.vehicles.length > 0 && (
        <Panel>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle/60">
                  {[t("vehicle"), t("category"), t("trips"), t("hoursUsed"), t("utilization")].map((h) => (
                    <th key={h} className={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.vehicles.map((v) => (
                  <tr key={v.vehicle_id}>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-fg">{v.plate_number}</div>
                      {(v.make || v.model) && <div className="text-xs text-fg-muted">{[v.make, v.model].filter(Boolean).join(" ")}</div>}
                    </td>
                    <td className="px-5 py-3">
                      {v.category ? (
                        <span className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-500">{v.category}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-fg">{v.trips_count}</td>
                    <td className="px-5 py-3 text-fg">{v.total_hours_booked}h</td>
                    <td className="min-w-[160px] px-5 py-3">
                      <UtilizationBar pct={v.utilization_pct} lowBelow={30} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </section>
  );
}
