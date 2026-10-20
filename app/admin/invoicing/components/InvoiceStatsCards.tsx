"use client";

import { AlertTriangle, CircleDollarSign, Wallet } from "lucide-react";
import type { InvoiceStats } from "../types";
import { KpiCard, KpiGrid } from "../../ui";
import { formatCurrency } from "../../lib/format";

export function InvoiceStatsCards({ stats, error }: { stats: InvoiceStats; error?: string | null }) {
  return (
    <KpiGrid cols={3}>
      <KpiCard
        label="Unpaid / collectable"
        value={formatCurrency(stats.totalCollectable)}
        hint={error ?? "Pending payments"}
        icon={<Wallet />}
        tone="warning"
      />
      <KpiCard
        label="Total collected"
        value={formatCurrency(stats.totalCollected)}
        hint={error ?? "Recognised revenue"}
        icon={<CircleDollarSign />}
        tone="success"
      />
      <KpiCard
        label="Overdue"
        value={formatCurrency(stats.totalOverdue)}
        hint={error ?? "Included in collectable"}
        icon={<AlertTriangle />}
        tone="danger"
        emphasis={stats.totalOverdue > 0 ? "danger" : "none"}
      />
    </KpiGrid>
  );
}
