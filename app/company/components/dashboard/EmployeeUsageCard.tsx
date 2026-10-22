"use client";

import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, EmptyState } from "@/app/ui";

export interface EmployeeUsageData {
  activeEmployees: number;
  totalEmployees: number;
  avgRidesPerEmployee: number;
  topPassenger: { name: string; rides: number } | null;
  departmentUsage: Array<{ name: string; percentage: number }>;
}

export function EmployeeUsageCard({ data, hasChauffeur }: { data: EmployeeUsageData; hasChauffeur: boolean }) {
  const t = useTranslations("company.dashboard");
  const departments = data.departmentUsage.slice(0, 6);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title={t("employeeAdoption")} />
      <CardContent className="flex flex-1 flex-col gap-5">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-[13px] font-medium text-fg-muted">{t("activePassengers")}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-fg">
              {data.activeEmployees}
              <span className="text-sm font-normal text-fg-muted"> / {data.totalEmployees}</span>
            </dd>
          </div>
          {hasChauffeur && (
            <div>
              <dt className="text-[13px] font-medium text-fg-muted">{t("avgRidesEmp")}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-fg">{data.avgRidesPerEmployee}</dd>
            </div>
          )}
        </dl>

        {hasChauffeur && data.topPassenger && (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-subtle px-3 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
              <Star className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{t("topPassenger")}</p>
              <p className="truncate text-sm font-medium text-fg">
                {data.topPassenger.name} <span className="font-normal text-fg-muted">({t("ridesCount", { count: data.topPassenger.rides })})</span>
              </p>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{t("departmentBreakdown")}</p>
          {departments.length === 0 ? (
            <EmptyState compact title={t("noDepartmentData")} />
          ) : (
            <ul className="space-y-2.5">
              {departments.map((dept) => (
                <li key={dept.name}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-fg-secondary" title={dept.name}>
                      {dept.name}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-fg">{dept.percentage}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, dept.percentage))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
