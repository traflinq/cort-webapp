"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { TABLE_HEADER_CELL_CLASS } from "../../components/PageLayout";
import { useFmt } from "../cost/hooks";
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

const TH = `${TABLE_HEADER_CELL_CLASS} px-5`;

/**
 * Hours each pool car was booked (last 30 days, 10 working hours a day). Pool size and idle cars
 * are shown with the month's figures above, so only utilization is repeated here.
 */
export function PoolCarUtilization({ data }: { data: PoolUtilization }) {
  const t = useTranslations("company.fleet");
  const tA = useTranslations("company.analytics");
  const fmt = useFmt();
  const s = data.summary;
  const columns: { label: string; numeric?: boolean }[] = [
    { label: t("vehicle") },
    { label: t("category") },
    { label: t("trips"), numeric: true },
    { label: t("hoursUsed"), numeric: true },
    { label: t("utilization") },
  ];
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title={tA("carUtilizationTitle")} description={tA("carUtilizationDescription")} badge={tA("last30Days")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiTile label={t("avgUtilization")} value={`${fmt.n(s.avg_utilization_pct, 1)}%`} tone={s.avg_utilization_pct < 30 ? "warning" : undefined} />
        <KpiTile label={t("underutilized")} value={fmt.n(s.underutilized_count)} tone={s.underutilized_count > 0 ? "warning" : undefined} />
      </div>
      {data.vehicles.length > 0 && (
        <Panel>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  {columns.map((c) => (
                    <th key={c.label} scope="col" className={cn(TH, c.numeric ? "text-end" : "text-start")}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.vehicles.map((v) => (
                  <tr key={v.vehicle_id} className="hover:bg-row-hover">
                    <td className="px-5 py-3">
                      <div className="font-medium text-fg">{v.plate_number}</div>
                      {(v.make || v.model) && <div className="text-xs text-fg-muted">{[v.make, v.model].filter(Boolean).join(" ")}</div>}
                    </td>
                    <td className="px-5 py-3">
                      {v.category ? (
                        <Badge tone="neutral" size="sm">
                          {v.category}
                        </Badge>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-end text-fg tabular-nums">{fmt.n(v.trips_count)}</td>
                    <td className="px-5 py-3 text-end text-fg tabular-nums">{fmt.n(v.total_hours_booked, 1)}h</td>
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
