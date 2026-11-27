"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/app/admin/ui";
import { TABLE_HEADER_CELL_CLASS } from "../../components/PageLayout";
import { useFmt } from "../cost/hooks";
import { KpiTile, Panel, SectionHeading, UtilizationBar } from "./ui";

export type ChauffeurUtilizationRow = {
  booking_id: number;
  package_selected: string;
  package_hours: number | null;
  used_minutes: number | null;
  utilization_pct: number | null;
  scheduled_for: string | null;
  trip_type: string;
  base_package_cost: number | null;
  estimated_saving_pkr: number | null;
};

export type ChauffeurUtilization = {
  summary: {
    total_bookings: number;
    avg_utilization_pct: number | null;
    underutilized_count: number;
    total_estimated_saving_pkr: number;
  };
  bookings: ChauffeurUtilizationRow[];
};

const TH = `${TABLE_HEADER_CELL_CLASS} px-5`;

/** How much of each booked chauffeur package was used, and what a smaller package could save. */
export function ChauffeurPackageUse({ data }: { data: ChauffeurUtilization }) {
  const t = useTranslations("company.fleetAnalytics");
  const tA = useTranslations("company.analytics");
  const tFleet = useTranslations("company.fleet");
  const fmt = useFmt();
  const s = data.summary;
  const under = data.bookings.filter((b) => (b.utilization_pct ?? 100) < 70);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title={tA("packageUseTitle")} description={tA("packageUseDescription")} badge={tA("last30Days")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label={t("totalBookings")} value={fmt.n(s.total_bookings)} />
        <KpiTile
          label={tFleet("avgUtilization")}
          value={s.avg_utilization_pct != null ? `${fmt.n(s.avg_utilization_pct, 1)}%` : "—"}
          tone={s.avg_utilization_pct != null && s.avg_utilization_pct < 70 ? "warning" : undefined}
        />
        <KpiTile
          label={t("underutilizedBookings")}
          value={fmt.n(s.underutilized_count)}
          tone={s.underutilized_count > 0 ? "warning" : undefined}
        />
        <KpiTile label={t("colEstSaving")} value={s.total_estimated_saving_pkr > 0 ? fmt.pkr(s.total_estimated_saving_pkr) : "—"} />
      </div>

      {under.length > 0 && (
        <Panel>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line px-5 py-4">
            <span className="text-sm font-semibold text-fg">{t("underutilizedBookings")}</span>
            <span className="text-xs text-fg-muted">{t("underutilizedHint")}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={`${TH} text-start`}>{t("colBooking")}</th>
                  <th className={`${TH} text-start`}>{t("colPackage")}</th>
                  <th className={`${TH} text-start`}>{t("date")}</th>
                  <th className={`${TH} text-end`}>{t("colUsed")}</th>
                  <th className={`${TH} min-w-[160px] text-start`}>{t("colUtilization")}</th>
                  <th className={`${TH} text-end`}>{t("colEstSaving")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {under.slice(0, 10).map((b) => (
                  <tr key={b.booking_id} className="hover:bg-row-hover">
                    <td className="px-5 py-3 font-medium text-fg tabular-nums">#{b.booking_id}</td>
                    <td className="px-5 py-3">
                      <Badge tone="neutral" size="sm">
                        {b.package_selected?.replace("HOURS_", "") ?? "—"}h
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-fg-muted tabular-nums whitespace-nowrap">{b.scheduled_for ? fmt.date(b.scheduled_for) : "—"}</td>
                    <td className="px-5 py-3 text-end text-fg tabular-nums">{b.used_minutes != null ? `${fmt.n(b.used_minutes / 60, 1)}h` : "—"}</td>
                    <td className="min-w-[160px] px-5 py-3">{b.utilization_pct != null ? <UtilizationBar pct={b.utilization_pct} /> : "—"}</td>
                    <td className="px-5 py-3 text-end font-semibold text-fg tabular-nums whitespace-nowrap">
                      {b.estimated_saving_pkr != null && b.estimated_saving_pkr > 0 ? fmt.pkr(b.estimated_saving_pkr) : "—"}
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
