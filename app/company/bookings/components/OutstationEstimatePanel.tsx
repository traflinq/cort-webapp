"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, Calculator, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Spinner, useFormatters } from "@/app/ui";
import { useOutstationEstimate, type LegDistance, type ContractRateForEstimate } from "@/app/hooks/useOutstationEstimate";

interface OutstationEstimatePanelProps {
  originCity: string;
  destinationCities: string[];
  noOfDays: number;
  packageType: "5hr" | "10hr" | "24hr" | "monthly_10hr" | "monthly_24hr";
  contractRate: ContractRateForEstimate | null;
  outstationAllowancePerDay: number;
  accommodationAllowancePerNight: number;
}

export default function OutstationEstimatePanel(props: OutstationEstimatePanelProps) {
  const t = useTranslations("company.bookings");
  const { formatCurrency, formatNumber } = useFormatters();
  const { estimate, isLoading, error } = useOutstationEstimate(props);

  if (!props.destinationCities.length) return null;

  const nights = Math.max(0, props.noOfDays - 1);
  const daysLabel = String(props.noOfDays);

  return (
    <section aria-label={t("estimatedCost")} className="overflow-hidden rounded-xl border border-brand-line bg-brand-soft/30">
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-line px-4 py-2.5">
        <Calculator className="size-4 text-brand-ink" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">{t("estimatedCost")}</span>
        <span className="text-xs text-fg-muted">{t("roundTripLabel")}</span>
        <span className="ms-auto text-xs text-fg-muted">{t("viaGoogleMaps")}</span>
      </div>

      <div className="px-4 py-3 text-sm">
        {isLoading && (
          <div className="flex items-center gap-2 py-2 text-xs text-fg-muted">
            <Spinner size="sm" /> {t("calculatingDistances")}
          </div>
        )}

        {!isLoading && error && (
          <div role="alert" className="flex items-center gap-2 py-1 text-xs text-danger-ink">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t("distanceError")}
          </div>
        )}

        {!isLoading && !error && !props.contractRate && <p className="py-1 text-xs text-fg-muted">{t("selectVehicleForEstimate")}</p>}

        {!isLoading && !error && props.contractRate && !props.originCity.trim() && <p className="py-1 text-xs text-fg-muted">{t("enterBookingCity")}</p>}

        {!isLoading && !error && estimate && (
          <div className="space-y-4">
            {/* Route legs */}
            <ol className="space-y-2">
              {estimate.legs.map((leg: LegDistance, i: number) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={cn("size-2 shrink-0 rounded-full", leg.isReturn ? "bg-fg-muted" : i === 0 ? "bg-brand" : "bg-line-strong")}
                    />
                    <span className="truncate font-medium text-fg">{leg.from}</span>
                    <ArrowRight className="size-3 shrink-0 text-fg-muted rtl:-scale-x-100" aria-hidden="true" />
                    <span className="truncate font-medium text-fg">{leg.to}</span>
                    {leg.isReturn && (
                      <Badge tone="neutral" size="sm" icon={<CornerDownLeft aria-hidden="true" />}>
                        {t("returnLeg")}
                      </Badge>
                    )}
                  </div>
                  <div className="shrink-0 text-end">
                    <span className="font-medium text-brand-ink">{leg.distanceKm > 0 ? t("kmUnit", { distance: leg.distanceKm }) : "—"}</span>
                    {leg.durationText && leg.durationText !== "N/A" && <span className="ms-1.5 text-xs text-fg-muted">({leg.durationText})</span>}
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between border-t border-brand-line pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{t("totalRoundTripDistance")}</span>
              <span className="font-semibold text-fg">{t("kmUnit", { distance: estimate.totalKm })}</span>
            </div>

            {/* Cost breakdown */}
            <dl className="space-y-2 rounded-lg border border-line bg-card p-3">
              <CostRow label={t("basePackageCost")} value={formatCurrency(estimate.basePackageCost)} sub={t("daysRate", { days: daysLabel })} />
              {estimate.outstationAllowance > 0 && <CostRow label={t("outstationAllowance")} value={formatCurrency(estimate.outstationAllowance)} sub={daysLabel} />}
              {estimate.accommodationAllowance > 0 && (
                <CostRow label={t("accommodation")} value={formatCurrency(estimate.accommodationAllowance)} sub={t("nightsCount", { nights: String(nights) })} />
              )}
              <div className="border-t border-dashed border-line pt-2">
                <CostRow label={t("sstOnService")} value={formatCurrency(estimate.sst)} muted />
              </div>
              <div className="border-t border-dashed border-line pt-2">
                <CostRow
                  label={t("fuelCost")}
                  value={formatCurrency(estimate.fuelCost)}
                  sub={t("fuelCostSub", { km: formatNumber(estimate.totalKm), rate: formatNumber(Number(props.contractRate?.cost_per_km || 0)) })}
                  accent
                />
                <p className="mt-1 text-xs text-fg-muted">{t("tollParkingNote")}</p>
              </div>
              <div className="flex items-center justify-between border-t-2 border-line pt-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-fg">{t("estimatedTotal")}</dt>
                <dd className="text-base font-semibold text-brand-ink">{formatCurrency(estimate.total)}</dd>
              </div>
            </dl>

            <p className="text-xs leading-relaxed text-fg-muted">{t("estimateDisclaimer")}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function CostRow({ label, value, sub, muted, accent }: { label: string; value: string; sub?: string; muted?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-baseline gap-1.5">
        <span className={cn("text-sm", muted ? "text-fg-muted" : "text-fg-secondary")}>{label}</span>
        {sub && <span className="text-xs text-fg-muted">{sub}</span>}
      </dt>
      <dd className={cn("text-sm font-medium", muted ? "text-fg-muted" : accent ? "text-brand-ink" : "text-fg")}>{value}</dd>
    </div>
  );
}
