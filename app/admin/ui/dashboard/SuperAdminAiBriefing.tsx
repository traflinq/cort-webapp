"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  Fuel,
  Landmark,
  RefreshCw,
  Sparkles,
  TrendingDown,
  Truck,
  Wallet,
} from "lucide-react";
import { apiClient } from "@/app/lib/services/api-client";
import { toast } from "sonner";

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

function severityClasses(severity: string) {
  const s = severity.toLowerCase();
  if (s === "high" || s === "critical")
    return "bg-rose-500/10 text-[var(--danger-text)] border-rose-500/25";
  if (s === "medium" || s === "watch")
    return "bg-amber-500/10 text-[var(--warning-text)] border-amber-500/25";
  return "bg-emerald-500/10 text-[var(--success-text)] border-emerald-500/25";
}

function categoryIcon(category: string) {
  switch (category) {
    case "margin":
    case "revenue":
    case "pnl":
      return <TrendingDown className="h-5 w-5 text-[#fe8503]" />;
    case "receivables":
    case "cash":
    case "collections":
      return <Wallet className="h-5 w-5 text-amber-600" />;
    case "dispatch":
      return <Truck className="h-5 w-5 text-rose-600" />;
    case "expenses":
    case "costs":
      return <Fuel className="h-5 w-5 text-orange-600" />;
    case "unit_economics":
      return <CircleDollarSign className="h-5 w-5 text-navy" />;
    default:
      return <Sparkles className="h-5 w-5 text-navy" />;
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
      const emptyGeneral =
        mode === "general" &&
        (result.briefing?.length ?? 0) === 0 &&
        (result.companies?.length ?? 0) === 0;
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
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)] space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#fe8503]/10 border border-[#fe8503]/20">
            {mode === "finance" ? (
              <Landmark className="w-3.5 h-3.5 text-[#fe8503]" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[#fe8503]" />
            )}
            <span className="text-[11px] font-bold text-[#fe8503] uppercase tracking-wider">
              {mode === "finance" ? "AI CFO" : "Platform AI"}
            </span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            {mode === "finance" ? "Financial Consultancy Brief" : "Operations Summary"}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {mode === "finance"
              ? "Interim CFO read of P&L, cash, and unit economics for the selected period."
              : "Ops signals and companies that need attention for the selected period."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1">
            <button
              type="button"
              onClick={() => setMode("finance")}
              disabled={generating}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === "finance"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Finance
            </button>
            <button
              type="button"
              onClick={() => setMode("general")}
              disabled={generating}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === "general"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              General
            </button>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={generating}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--cort-orange)] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[var(--cort-orange-hover)] active:scale-[0.98] transition-all disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Generating…" : "Run AI Analysis"}
          </button>
        </div>
      </div>

      {!hasRun && !generating && (
        <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-6 py-10 text-center">
          {mode === "finance" ? (
            <Landmark className="h-7 w-7 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
          ) : (
            <Sparkles className="h-7 w-7 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
          )}
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {mode === "finance"
              ? "Select Finance and click Run AI Analysis for a CFO-style brief."
              : "Select General and click Run AI Analysis for ops signals and company attention."}
          </p>
        </div>
      )}

      {generating && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] px-6 py-10 text-center">
          <RefreshCw className="h-6 w-6 text-[#fe8503] mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-[var(--text-muted)]">
            {mode === "finance" ? "Preparing financial brief…" : "Analyzing platform ops…"}
          </p>
        </div>
      )}

      {showFinance && !generating && financialBrief && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              CFO brief
            </h3>
            <span
              className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${severityClasses(financialBrief.health)}`}
            >
              {financialBrief.health}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <TrendingDown className="h-3.5 w-3.5 text-[#fe8503]" />
                P&amp;L
              </div>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                {financialBrief.plNarrative}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <Wallet className="h-3.5 w-3.5 text-amber-600" />
                Cash
              </div>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                {financialBrief.cashRisks}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <CircleDollarSign className="h-3.5 w-3.5 text-navy" />
                Unit economics
              </div>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                {financialBrief.unitEconomics}
              </p>
            </div>
          </div>

          {financialBrief.actions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Priority CFO actions
              </h4>
              <div className="grid gap-3 sm:grid-cols-3">
                {financialBrief.actions.map((action) => (
                  <div
                    key={`${action.priority}-${action.title}`}
                    className="rounded-xl border border-[var(--border-default)] p-4 bg-[var(--bg-card)]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy text-white text-[11px] font-bold">
                        {action.priority}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                        {action.category.replace(/_/g, " ")}
                      </span>
                    </div>
                    <h5 className="text-sm font-bold text-[var(--text-primary)]">{action.title}</h5>
                    <p className="text-xs mt-1.5 text-[var(--text-secondary)] leading-relaxed">
                      {action.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showGeneral && !generating && (
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
              Ops signals
            </h3>
            {briefing.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No ops briefing cards for this period.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {briefing.map((card) => (
                  <div
                    key={card.id}
                    className={`rounded-xl border p-4 ${severityClasses(card.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      {categoryIcon(card.category)}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wide">
                            {card.category}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[var(--bg-card)]/70">
                            {card.severity}
                          </span>
                          {card.relatedMetric && (
                            <span className="text-[10px] font-medium opacity-80">{card.relatedMetric}</span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold">{card.title}</h4>
                        <p className="text-sm mt-1 opacity-90">{card.summary}</p>
                        <p className="text-xs mt-2 font-medium opacity-80">{card.recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
              Companies needing attention
            </h3>
            {companies.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No elevated company signals right now.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {companies.map((c) => (
                  <Link
                    key={c.companyId}
                    href={c.href}
                    className={`group rounded-xl border p-4 transition-all hover:shadow-md ${severityClasses(c.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="font-bold text-sm truncate">{c.companyName}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[var(--bg-card)]/70 shrink-0">
                        {c.severity}
                      </span>
                    </div>
                    <p className="text-sm opacity-90">{c.reason}</p>
                    <p className="text-xs mt-2 font-medium opacity-80 flex items-center gap-1">
                      {c.suggestedAction}
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
