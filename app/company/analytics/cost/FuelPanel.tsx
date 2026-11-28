"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import { Button, focusRing } from "@/app/admin/ui";
import { SectionHeading } from "../components/ui";
import { useCostFetch, useFmt, filterQuery, type CostFilters } from "./hooks";
import { BasisBadge, Drawer, EmptyNote, ErrorNote, FigureValue, MethodNote, Skeleton, StatBlock, Tag } from "./ui";
import type { FuelReport, FuelStatus, FuelTrips, FuelVehicleReport, Recommendation } from "./types";

const STATUS_TONE: Record<FuelStatus, "success" | "warning" | "neutral" | "danger"> = {
  WITHIN_TOLERANCE: "success",
  POTENTIAL_DISCREPANCY: "warning",
  INSUFFICIENT_DATA: "neutral",
  NO_CONTRACT_FIGURE: "neutral",
};

type FuelComparison = FuelVehicleReport["comparison"];

/** Only a vendor figure above the estimate (beyond tolerance) is a saving to claim. */
const isOverClaim = (c: FuelComparison) => c.status === "POTENTIAL_DISCREPANCY" && c.direction === "OVER";
const isUnderClaim = (c: FuelComparison) => c.status === "POTENTIAL_DISCREPANCY" && c.direction === "UNDER";

function FuelStatusTag({ c }: { c: FuelComparison }) {
  const t = useTranslations("company.costOptimization.fuel");
  if (isOverClaim(c)) return <Tag tone="warning">{t("overClaim")}</Tag>;
  if (isUnderClaim(c)) return <Tag>{t("underClaim")}</Tag>;
  return <Tag tone={STATUS_TONE[c.status]}>{t(`status.${c.status}` as never)}</Tag>;
}

export function FuelPanel({ filters, recommendations, onOpenRecommendation }: { filters: CostFilters; recommendations: Recommendation[]; onOpenRecommendation: (id: number) => void }) {
  const t = useTranslations("company.costOptimization.fuel");
  const tc = useTranslations("company.costOptimization");
  const fmt = useFmt();
  const report = useCostFetch<FuelReport>(`/company/cost-optimization/fuel?${filterQuery(filters)}`);
  const [selected, setSelected] = useState<FuelVehicleReport | null>(null);

  if (report.error) return <ErrorNote message={tc("loadFailed")} detail={report.error} onRetry={report.reload} />;
  if (!report.data) return <Skeleton className="h-72" />;
  const r = report.data;
  const recFor = (vehicleId: number) => recommendations.find((x) => x.type === "FUEL_DISCREPANCY" && x.vehicle_ids.includes(vehicleId));

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={t("title")} description={t("description", { tolerance: r.tolerance_pct })} badge={`${fmt.date(r.window.from)} – ${fmt.date(r.window.to)}`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatBlock label={t("contracted")} figure={r.totals.contracted_litres} />
        <StatBlock label={t("estimated")} figure={r.totals.estimated_litres} />
        <StatBlock label={t("difference")} figure={r.totals.litres_difference} hint={t("flaggedOf", { flagged: r.totals.flagged, total: r.totals.vehicles })} />
        <StatBlock label={t("savingToClaim")} figure={r.totals.cost_difference} hint={t("claimHint")} />
      </div>

      {r.vehicles.length === 0 ? (
        <EmptyNote>{t("empty")}</EmptyNote>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line text-start text-xs text-fg-muted">
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("colVehicle")}</th>
                <th scope="col" className="px-3 py-3 text-start font-medium">{t("colRoutes")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("colKm")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("colKmpl")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("colEstimated")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("colContracted")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("colDiff")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("colVariance")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("colCostDiff")}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.vehicles.map((v) => {
                const c = v.comparison;
                return (
                  <tr key={v.vehicle.id} className="cursor-pointer hover:bg-row-hover" onClick={() => setSelected(v)}>
                    <td className="px-4 py-3">
                      <button type="button" className={cn("rounded-sm text-start font-medium text-fg hover:underline", focusRing)} onClick={() => setSelected(v)}>
                        {v.vehicle.plate}
                      </button>
                      <p className="text-xs text-fg-muted">
                        {v.vehicle.category}
                        {v.vehicle.vendor ? ` · ${v.vehicle.vendor}` : ""}
                      </p>
                    </td>
                    <td className="max-w-48 truncate px-3 py-3 text-fg-muted" title={v.routes.map((x) => x.name).join(", ")}>
                      {v.routes.map((x) => x.name).join(", ")}
                    </td>
                    <td className="px-3 py-3 text-end tabular-nums">{fmt.n(v.km, 1)}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{fmt.n(v.vehicle.rated_kmpl, 1)}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{fmt.fig(c.estimated_litres)}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{fmt.fig(c.contracted_litres)}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{fmt.fig(c.litres_difference)}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{fmt.fig(c.variance_pct)}</td>
                    <td className="px-3 py-3 text-end tabular-nums">
                      {c.cost_difference.locked ? (
                        <span className="text-xs text-fg-muted">{fmt.locked}</span>
                      ) : isOverClaim(c) ? (
                        <span className="tabular-nums">{fmt.fig(c.cost_difference)}</span>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <FuelStatusTag c={c} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MethodNote lines={r.method} />

      <FuelVehicleDrawer vehicle={selected} filters={filters} onClose={() => setSelected(null)} recommendation={selected ? recFor(selected.vehicle.id) : undefined} onOpenRecommendation={onOpenRecommendation} />
    </div>
  );
}

function FuelVehicleDrawer({
  vehicle,
  filters,
  onClose,
  recommendation,
  onOpenRecommendation,
}: {
  vehicle: FuelVehicleReport | null;
  filters: CostFilters;
  onClose: () => void;
  recommendation?: Recommendation;
  onOpenRecommendation: (id: number) => void;
}) {
  const t = useTranslations("company.costOptimization.fuel");
  const tc = useTranslations("company.costOptimization");
  const fmt = useFmt();
  const trips = useCostFetch<FuelTrips>(vehicle ? `/company/cost-optimization/fuel/vehicles/${vehicle.vehicle.id}/trips?${filterQuery(filters, { withScope: false })}` : null);
  if (!vehicle) return null;
  const c = vehicle.comparison;
  const rows: Array<[string, typeof c.estimated_litres]> = [
    [t("estimated"), c.estimated_litres],
    [t("contracted"), c.contracted_litres],
    [t("litresDifference"), c.litres_difference],
    [t("variance"), c.variance_pct],
    [t("fuelPrice"), c.fuel_price],
    [t("estimatedCost"), c.estimated_fuel_cost],
    [t("contractedCost"), c.contracted_fuel_cost],
    [isOverClaim(c) ? t("savingToClaim") : t("costDifference"), c.cost_difference],
  ];
  return (
    <Drawer
      open
      onClose={onClose}
      title={`${vehicle.vehicle.plate} · ${t("drawerTitle")}`}
      subtitle={`${vehicle.vehicle.label} · ${vehicle.vehicle.fuel_type}${vehicle.vehicle.fuel_type_explicit ? "" : ` (${t("fuelTypeInferred")})`}${vehicle.vehicle.vendor ? ` · ${vehicle.vehicle.vendor}` : ""}`}
      footer={
        recommendation ? (
          <Button variant="outline" size="sm" onClick={() => onOpenRecommendation(recommendation.id)} rightIcon={<ArrowRight className="rtl-flip" aria-hidden="true" />}>
            {t("openRecommendation")}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <FuelStatusTag c={c} />
          {vehicle.fuel_inclusive && <Tag>{t("fuelInclusive")}</Tag>}
          <span className="text-xs text-fg-muted tabular-nums">{t("coverage", { pct: c.km_coverage_pct, trips: vehicle.trips, days: vehicle.operating_days })}</span>
        </div>
        {isOverClaim(c) && <p className="rounded-lg border border-warning-line bg-warning-soft p-3 text-sm text-warning-ink">{t("discrepancyNote")}</p>}
        {isUnderClaim(c) && <p className="rounded-lg border border-line bg-subtle p-3 text-sm text-fg-muted">{t("underClaimNote")}</p>}
        {c.reasons.length > 0 && (
          <ul className="list-disc space-y-1 ps-5 text-sm text-fg-muted" dir="auto">
            {c.reasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        <div className="divide-y divide-line rounded-lg border border-line bg-card">
          {rows.map(([label, f]) => (
            <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm text-fg-muted">
                {label}
                {!f.locked && <BasisBadge basis={f.basis} />}
              </span>
              <FigureValue figure={f} />
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-fg">{t("tripsTitle")}</h3>
          {trips.error ? (
            <ErrorNote message={tc("loadFailed")} detail={trips.error} onRetry={trips.reload} />
          ) : !trips.data ? (
            <Skeleton className="h-32" />
          ) : trips.data.trips.length === 0 ? (
            <EmptyNote>{t("noTrips")}</EmptyNote>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-card">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-muted">
                    <th scope="col" className="px-3 py-2 text-start font-medium">{t("colDate")}</th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">{t("colRoute")}</th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">{t("colKm")}</th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">{t("colPlannedKm")}</th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">{t("colEstimated")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {trips.data.trips.map((x) => (
                    <tr key={x.trip_id} className="hover:bg-row-hover">
                      <td className="px-3 py-2 tabular-nums">
                        {fmt.date(x.date)} <span className="text-xs text-fg-muted">· {t(`dir.${x.direction}` as never)} {x.started_at ? fmt.time(x.started_at) : ""}</span>
                      </td>
                      <td className="px-3 py-2 text-fg-muted">{x.route.name}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{x.km === null ? <span className="text-warning-ink">{t("noGps")}</span> : fmt.n(x.km, 1)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{fmt.n(x.planned_km, 1)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{fmt.n(x.estimated_litres, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
