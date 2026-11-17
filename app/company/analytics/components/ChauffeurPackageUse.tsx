"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CarFront, Clock, Package, TrendingDown } from "lucide-react";
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

const TH = "px-5 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted";

/** How much of each booked chauffeur package was used, and what a smaller package could save. */
export function ChauffeurPackageUse({ data }: { data: ChauffeurUtilization }) {
  const t = useTranslations("company.fleetAnalytics");
  const tA = useTranslations("company.analytics");
  const tFleet = useTranslations("company.fleet");
  const s = data.summary;
  const under = data.bookings.filter((b) => (b.utilization_pct ?? 100) < 70);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title={tA("packageUseTitle")} description={tA("packageUseDescription")} badge={tA("last30Days")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label={t("totalBookings")} value={s.total_bookings.toLocaleString()} icon={<CarFront />} />
        <KpiTile
          label={tFleet("avgUtilization")}
          value={s.avg_utilization_pct != null ? `${s.avg_utilization_pct}%` : "—"}
          icon={<Clock />}
          tone={s.avg_utilization_pct != null && s.avg_utilization_pct < 70 ? "warning" : undefined}
        />
        <KpiTile
          label={t("underutilizedBookings")}
          value={s.underutilized_count.toLocaleString()}
          icon={<AlertTriangle />}
          tone={s.underutilized_count > 0 ? "warning" : undefined}
        />
        <KpiTile
          label={t("colEstSaving")}
          value={s.total_estimated_saving_pkr > 0 ? `PKR ${s.total_estimated_saving_pkr.toLocaleString()}` : "—"}
          icon={<TrendingDown />}
        />
      </div>

      {under.length > 0 && (
        <Panel>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
            <Package className="size-4 text-teal-400" />
            <span className="text-sm font-semibold text-fg">{t("underutilizedBookings")}</span>
            <span className="text-xs text-fg-muted">{t("underutilizedHint")}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle/60">
                  <th className={`${TH} text-start`}>{t("colBooking")}</th>
                  <th className={`${TH} text-start`}>{t("colPackage")}</th>
                  <th className={`${TH} text-start`}>{t("date")}</th>
                  <th className={`${TH} text-end`}>{t("colUsed")}</th>
                  <th className={`${TH} min-w-[160px] text-end`}>{t("colUtilization")}</th>
                  <th className={`${TH} text-end`}>{t("colEstSaving")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {under.slice(0, 10).map((b) => (
                  <tr key={b.booking_id}>
                    <td className="px-5 py-3 font-semibold text-fg">#{b.booking_id}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-xs font-semibold text-teal-500">
                        {b.package_selected?.replace("HOURS_", "") ?? "—"}h
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-fg-muted">{b.scheduled_for ? new Date(b.scheduled_for).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-3 text-end text-fg">{b.used_minutes != null ? `${(b.used_minutes / 60).toFixed(1)}h` : "—"}</td>
                    <td className="min-w-[160px] px-5 py-3">{b.utilization_pct != null ? <UtilizationBar pct={b.utilization_pct} /> : "—"}</td>
                    <td className="px-5 py-3 text-end font-semibold text-success-ink">
                      {b.estimated_saving_pkr != null && b.estimated_saving_pkr > 0 ? `PKR ${b.estimated_saving_pkr.toLocaleString()}` : "—"}
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
