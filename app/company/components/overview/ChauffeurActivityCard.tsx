"use client";

import { useTranslations } from "next-intl";
import { CardDescription, CardTitle } from "@/app/admin/ui";
import { Card } from "../Card";
import { useOverviewFormat } from "./format";
import { Delta, FigureRow } from "./Delta";

export interface ChauffeurActivityData {
  completedRides: number;
  completedDelta?: number;
  upcoming: number;
  unassigned: number;
  completedAllTime: number;
}

/**
 * Chauffeur activity for companies whose rides aren't billed through Cort (own drivers or external
 * vendors). Those rides carry no Cort invoice, so a spend figure would always read zero.
 */
export function ChauffeurActivityCard({ data }: { data: ChauffeurActivityData }) {
  const t = useTranslations("company.overview.activity");
  const tOverview = useTranslations("company.overview");
  const f = useOverviewFormat();

  return (
    <Card className="flex flex-col gap-5 p-0 sm:p-0">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <CardTitle as="h2">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </div>

      <div className="px-4 sm:px-5">
        <p className="text-xs text-fg-muted">{t("completed")}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-fg tabular-nums">{f.num(data.completedRides)}</p>
        <div className="mt-1.5 text-xs text-fg-muted">
          {data.completedDelta !== undefined ? <Delta value={data.completedDelta} label={tOverview("vsLastMonth")} /> : t("monthToDate")}
        </div>
      </div>

      <FigureRow
        className="mt-auto"
        items={[
          { key: "upcoming", label: t("upcoming"), value: f.num(data.upcoming), sub: t("next7Days") },
          { key: "unassigned", label: t("unassigned"), value: f.num(data.unassigned), sub: t("unassignedSub") },
          { key: "allTime", label: t("allTime"), value: f.num(data.completedAllTime), sub: t("allTimeSub") },
        ]}
      />
    </Card>
  );
}
