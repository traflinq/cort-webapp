"use client";

import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartCard, ChartLegend, ChartTooltip, useChartTheme } from "@/app/ui";

export interface ServiceSplitDatum {
  key: "chauffeur" | "shuttle";
  label: string;
  value: number;
}

/** Donut of chauffeur bookings vs shuttle trips this month; the centre shows the real total. */
export function ServiceSplitCard({ data }: { data: ServiceSplitDatum[] }) {
  const t = useTranslations("company.dashboard");
  const chart = useChartTheme();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const colored = data.map((d, i) => ({ ...d, color: chart.colors[i % chart.colors.length] }));

  return (
    <ChartCard
      title={t("serviceSplit")}
      description={t("serviceSplitDescription")}
      height={220}
      empty={total === 0}
      emptyTitle={t("insightStartUsing")}
      legend={<ChartLegend items={colored.map((d) => ({ label: `${d.label} · ${total ? Math.round((d.value / total) * 100) : 0}%`, color: d.color }))} />}
      table={
        <table className="w-full text-sm">
          <thead>
            <tr className="text-start text-xs text-fg-muted">
              <th className="py-1 text-start font-medium">{t("serviceSplit")}</th>
              <th className="py-1 text-end font-medium">{t("totalRides")}</th>
            </tr>
          </thead>
          <tbody>
            {colored.map((d) => (
              <tr key={d.key}>
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-end tabular-nums">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="relative h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={colored} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke={chart.surface} strokeWidth={2}>
              {colored.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-fg">{total}</span>
          <span className="text-[11px] uppercase tracking-wider text-fg-muted">{t("totalRides")}</span>
        </div>
      </div>
    </ChartCard>
  );
}
