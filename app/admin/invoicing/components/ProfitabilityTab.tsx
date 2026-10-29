"use client";

import { Coins, Percent, Receipt, TrendingUp, Wallet } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  DataTable,
  DateRangePicker,
  FilterBar,
  FilterField,
  KpiCard,
  KpiGrid,
  RefreshButton,
  SectionHeader,
  Select,
  StatusBadge,
  type DataTableColumn,
} from "../../ui";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "../../lib/format";
import type { InvoiceProfitabilityRow } from "../../../lib/services/types";
import { PICKER_LIMIT } from "../hooks/useInvoices";
import { PROFITABILITY_PAGE_SIZE, type ProfitabilityController } from "../hooks/useProfitability";

type ProfitabilityTabProps = {
  profit: ProfitabilityController;
  companies: { id: number; name: string }[];
  companiesTruncated?: boolean;
};

/** Profit is the number that matters, so it is coloured: green when we made money, red when we didn't. */
function profitClass(value: number): string {
  if (value > 0) return "font-medium text-success-ink";
  if (value < 0) return "font-medium text-danger-ink";
  return "text-fg";
}

const columns: DataTableColumn<InvoiceProfitabilityRow>[] = [
  {
    key: "invoice",
    header: "Invoice",
    cell: (row) => (
      <div className="min-w-0">
        <div className="font-mono text-[13px] font-medium text-fg">{row.invoice_number}</div>
        <div className="text-xs text-fg-muted">ID {row.id}</div>
      </div>
    ),
  },
  {
    key: "company",
    header: "Company",
    cell: (row) => <span className="text-fg">{row.company_name || <span className="text-fg-muted">Unknown</span>}</span>,
  },
  {
    key: "service",
    header: "Service",
    hideBelow: "md",
    cell: (row) => (
      <Badge tone={row.service_type === "CHAUFFEUR" ? "purple" : "info"}>
        {row.service_type === "CHAUFFEUR" ? "Chauffeur" : "Shuttle"}
      </Badge>
    ),
  },
  {
    key: "date",
    header: "Invoice date",
    hideBelow: "lg",
    cell: (row) => <span className="whitespace-nowrap text-fg-secondary">{formatDate(row.invoice_date ?? row.generated_at)}</span>,
  },
  {
    key: "status",
    header: "Status",
    hideBelow: "xl",
    cell: (row) => (row.status ? <StatusBadge status={row.status} size="sm" /> : <span className="text-fg-muted">—</span>),
  },
  { key: "amount", header: "Amount", align: "right", mono: true, cell: (row) => formatCurrency(row.amount) },
  {
    key: "sst",
    header: "SST",
    align: "right",
    mono: true,
    hideBelow: "lg",
    cell: (row) => <span className="text-fg-muted">{formatCurrency(row.sst_amount)}</span>,
  },
  {
    key: "ex_sst",
    header: "Amount excl. SST",
    align: "right",
    mono: true,
    cell: (row) => formatCurrency(row.amount_excluding_sst),
  },
  { key: "cogs", header: "COGS", align: "right", mono: true, cell: (row) => formatCurrency(row.cogs) },
  {
    key: "profit",
    header: "Profit",
    align: "right",
    mono: true,
    cell: (row) => (
      <div className="whitespace-nowrap">
        <div className={profitClass(row.profit)}>{formatCurrency(row.profit)}</div>
        <div className="text-xs text-fg-muted">{formatPercent(row.margin_percentage, 1)}</div>
      </div>
    ),
  },
];

export function ProfitabilityTab({ profit, companies, companiesTruncated }: ProfitabilityTabProps) {
  const selectedCompany = companies.find((c) => c.id === profit.companyId);
  const activeFilters = (profit.companyId ? 1 : 0) + (profit.range ? 1 : 0);
  const totals = profit.totals;

  const scope = selectedCompany ? selectedCompany.name : "All companies";
  const periodLabel = profit.range ? `${formatDate(profit.range.start)} – ${formatDate(profit.range.end)}` : "All time";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar
            activeCount={activeFilters}
            onClear={profit.clearFilters}
            actions={<RefreshButton label="Refresh" onClick={profit.refetch} loading={profit.isLoading} />}
          >
            <FilterField label="Company">
              <Select
                value={profit.companyId ?? ""}
                onChange={(e) => profit.applyCompany(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="All companies"
                className="h-8 min-w-44 text-xs"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Invoice period">
              <DateRangePicker value={profit.range} onChange={profit.applyRange} allowClear />
            </FilterField>
            {companiesTruncated && <span className="text-xs text-fg-muted">Company list shows the first {PICKER_LIMIT} companies.</span>}
          </FilterBar>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <SectionHeader
          title={`${scope} · ${periodLabel}`}
          description={`${formatNumber(totals.invoiceCount)} ${totals.invoiceCount === 1 ? "invoice" : "invoices"} in this selection. Totals cover every matching invoice, not just this page.`}
        />
        <KpiGrid cols={4}>
          <KpiCard
            label="Amount billed"
            value={formatCurrency(totals.amount)}
            hint={`Includes ${formatCurrency(totals.sstAmount)} SST`}
            icon={<Receipt />}
            tone="brand"
            loading={profit.isLoading}
          />
          <KpiCard
            label="Amount excl. SST"
            value={formatCurrency(totals.amountExcludingSst)}
            hint="What we actually earn from"
            icon={<Wallet />}
            tone="info"
            loading={profit.isLoading}
          />
          <KpiCard
            label="Cost of goods sold"
            value={formatCurrency(totals.cogs)}
            hint="Vendor cost, tagged expenses and fuel"
            icon={<Coins />}
            tone="neutral"
            loading={profit.isLoading}
          />
          <KpiCard
            label="Profit"
            value={formatCurrency(totals.profit)}
            hint={`Margin ${formatPercent(totals.marginPercentage, 2)}`}
            icon={totals.profit < 0 ? <Percent /> : <TrendingUp />}
            tone={totals.profit < 0 ? "danger" : "success"}
            loading={profit.isLoading}
          />
        </KpiGrid>
      </section>

      <Card>
        <DataTable<InvoiceProfitabilityRow>
          caption="Invoice profitability"
          columns={columns}
          rows={profit.rows}
          rowKey={(row) => row.id}
          loading={profit.isLoading}
          error={profit.error}
          onRetry={profit.refetch}
          empty={{
            icon: <TrendingUp aria-hidden="true" />,
            title: activeFilters > 0 ? "No invoices match these filters" : "No invoices yet",
            description:
              activeFilters > 0
                ? "Try a wider period or another company."
                : "Profit appears here once invoices have been generated.",
          }}
          pagination={{
            page: profit.page,
            totalPages: profit.pagination.pages,
            total: profit.pagination.total,
            pageSize: PROFITABILITY_PAGE_SIZE,
            onPageChange: profit.setPage,
          }}
        />
      </Card>
    </div>
  );
}
