"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CircleDollarSign, Fuel, Landmark, Sparkles, TrendingDown, Truck, Wallet } from "lucide-react";
import { apiClient } from "@/app/lib/services/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { focusRing } from "../styles";
import { Badge, Button, Card, CardContent, CardHeader, LoadingBlock, Tabs, TabsList, TabsTrigger, type BadgeTone } from "..";
import { humanize } from "../../lib/format";

export type SuperAdminInsightCard = {
  id: string;
  severity: "high" | "medium" | "low";
  category: string;
  title: string;
  summary: string;
  recommendation: string;
  relatedMetric?: string;
};

export type SuperAdminCompanyAttention = {
  companyId: number;
  companyName: string;
  severity: "high" | "medium" | "low";
  reason: string;
  suggestedAction: string;
  href: string;
};

export type SuperAdminCfoAction = {
  priority: number;
  title: string;
  detail: string;
  category: string;
};

export type SuperAdminFinancialBrief = {
  health: "healthy" | "watch" | "critical";
  plNarrative: string;
  cashRisks: string;
  unitEconomics: string;
  actions: SuperAdminCfoAction[];
};

type InsightsMode = "finance" | "general";

type Props = {
  startDate?: string;
  endDate?: string;
};

function severityTone(severity: string): BadgeTone {
  const s = severity.toLowerCase();
  if (s === "high" || s === "critical") return "danger";
  if (s === "medium" || s === "watch") return "warning";
  return "success";
}

const toneBorder: Record<BadgeTone, string> = {
  danger: "border-danger-line",
  warning: "border-warning-line",
  success: "border-success-line",
  info: "border-info-line",
  brand: "border-brand-line",
  purple: "border-purple-line",
  neutral: "border-line",
};

function categoryIcon(category: string) {
  const cls = "size-4 shrink-0";
  switch (category) {
    case "margin":
    case "revenue":
    case "pnl":
      return <TrendingDown className={cn(cls, "text-brand-ink")} aria-hidden="true" />;
    case "receivables":
    case "cash":
    case "collections":
      return <Wallet className={cn(cls, "text-warning-ink")} aria-hidden="true" />;
    case "dispatch":
      return <Truck className={cn(cls, "text-danger-ink")} aria-hidden="true" />;
    case "expenses":
    case "costs":
      return <Fuel className={cn(cls, "text-brand-ink")} aria-hidden="true" />;
    case "unit_economics":
      return <CircleDollarSign className={cn(cls, "text-info-ink")} aria-hidden="true" />;
    default:
      return <Sparkles className={cn(cls, "text-fg-muted")} aria-hidden="true" />;
  }
}

export function SuperAdminAiBriefing({ startDate, endDate }: Props) {
  const [mode, setMode] = useState<InsightsMode>("finance");
  const [activeMode, setActiveMode] = useState<InsightsMode | null>(null);
  const [financialBrief, setFinancialBrief] = useState<SuperAdminFinancialBrief | null>(null);
  const [briefing, setBriefing] = useState<SuperAdminInsightCard[]>([]);
  const [companies, setCompanies] = useState<SuperAdminCompanyAttention[]>([]);
  const [generating, setGenerating] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  async function runAnalysis() {
    setGenerating(true);
    try {
      const result = await apiClient.generateSuperAdminAiInsights(startDate, endDate, mode);
      setActiveMode(mode);
      if (mode === "finance") {
        setFinancialBrief(result.financialBrief ?? null);
        setBriefing([]);
        setCompanies([]);
      } else {
        setFinancialBrief(null);
        setBriefing(result.briefing ?? []);
        setCompanies(result.companies ?? []);
      }
      setHasRun(true);

      const emptyFinance = mode === "finance" && !result.financialBrief?.plNarrative;
      const emptyGeneral = mode === "general" && (result.briefing?.length ?? 0) === 0 && (result.companies?.length ?? 0) === 0;
      if (emptyFinance || emptyGeneral) {
        toast.message("AI returned no insights for this period");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate AI insights");
    } finally {
      setGenerating(false);
    }
  }

  const showFinance = hasRun && activeMode === "finance";
  const showGeneral = hasRun && activeMode === "general";

  return (
    <Card>
      <CardHeader
        flush={!hasRun && !generating}
        title={
          <span className="inline-flex items-center gap-2">
            {mode === "finance" ? <Landmark className="size-4 text-brand-ink" aria-hidden="true" /> : <Sparkles className="size-4 text-brand-ink" aria-hidden="true" />}
            {mode === "finance" ? "AI financial brief" : "AI operations summary"}
          </span>
        }
        description={
          mode === "finance"
            ? "Interim CFO read of P&L, cash and unit economics for the selected period."
            : "Ops signals and companies that need attention for the selected period."
        }
        actions={
          <>
            <Tabs value={mode} onValueChange={(v) => setMode(v as InsightsMode)}>
              <TabsList variant="pills" aria-label="Analysis mode">
                <TabsTrigger value="finance" disabled={generating}>
                  Finance
                </TabsTrigger>
                <TabsTrigger value="general" disabled={generating}>
                  General
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={runAnalysis} loading={generating} leftIcon={<Sparkles />}>
              {generating ? "Generating…" : hasRun ? "Run again" : "Run analysis"}
            </Button>
          </>
        }
      />
      {(hasRun || generating) && (
      <CardContent className="space-y-6">
        {generating && <LoadingBlock label={mode === "finance" ? "Preparing financial brief…" : "Analysing platform operations…"} />}

        {showFinance && !generating && financialBrief && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-fg">CFO brief</h3>
              <Badge tone={severityTone(financialBrief.health)} dot>
                {humanize(financialBrief.health)}
              </Badge>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {[
                { label: "P&L", icon: <TrendingDown className="size-3.5 text-brand-ink" aria-hidden="true" />, text: financialBrief.plNarrative },
                { label: "Cash", icon: <Wallet className="size-3.5 text-warning-ink" aria-hidden="true" />, text: financialBrief.cashRisks },
                { label: "Unit economics", icon: <CircleDollarSign className="size-3.5 text-info-ink" aria-hidden="true" />, text: financialBrief.unitEconomics },
              ].map((block) => (
                <div key={block.label} className="rounded-lg border border-line bg-subtle p-4">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                    {block.icon}
                    {block.label}
                  </div>
                  <p className="text-sm leading-relaxed text-fg">{block.text}</p>
                </div>
              ))}
            </div>

            {financialBrief.actions.length > 0 && (
              <div>
                <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Priority actions</h4>
                <ol className="grid gap-3 sm:grid-cols-3">
                  {financialBrief.actions.map((action) => (
                    <li key={`${action.priority}-${action.title}`} className="rounded-lg border border-line bg-card p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-fg text-[11px] font-semibold text-page">{action.priority}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{humanize(action.category)}</span>
                      </div>
                      <h5 className="text-sm font-semibold text-fg">{action.title}</h5>
                      <p className="mt-1.5 text-xs leading-relaxed text-fg-secondary">{action.detail}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {showGeneral && !generating && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-fg">Ops signals</h3>
              {briefing.length === 0 ? (
                <p className="text-sm text-fg-muted">No ops briefing cards for this period.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {briefing.map((card) => {
                    const tone = severityTone(card.severity);
                    return (
                      <div key={card.id} className={cn("rounded-lg border bg-card p-4", toneBorder[tone])}>
                        <div className="flex items-start gap-3">
                          {categoryIcon(card.category)}
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{humanize(card.category)}</span>
                              <Badge tone={tone} size="sm">
                                {humanize(card.severity)}
                              </Badge>
                              {card.relatedMetric && <span className="text-[11px] text-fg-muted">{card.relatedMetric}</span>}
                            </div>
                            <h4 className="text-sm font-semibold text-fg">{card.title}</h4>
                            <p className="mt-1 text-sm text-fg-secondary">{card.summary}</p>
                            <p className="mt-2 text-xs font-medium text-fg">{card.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-fg">Companies needing attention</h3>
              {companies.length === 0 ? (
                <p className="text-sm text-fg-muted">No elevated company signals right now.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {companies.map((c) => {
                    const tone = severityTone(c.severity);
                    return (
                      <Link
                        key={c.companyId}
                        href={c.href}
                        className={cn("group rounded-lg border bg-card p-4 transition-shadow hover:shadow-[var(--shadow-card-hover)]", toneBorder[tone], focusRing)}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <Building2 className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                            <span className="truncate text-sm font-semibold text-fg">{c.companyName}</span>
                          </span>
                          <Badge tone={tone} size="sm">
                            {humanize(c.severity)}
                          </Badge>
                        </div>
                        <p className="text-sm text-fg-secondary">{c.reason}</p>
                        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-fg">
                          {c.suggestedAction}
                          <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}
