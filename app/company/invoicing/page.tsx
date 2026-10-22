"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, Eye, FileText } from "lucide-react";
import { apiClient, type Invoice } from "@/app/lib/services/api-client";
import { useAuth } from "@/app/lib/contexts/auth-context";
import { Badge, Card, DataTable, PageHeader, StatusBadge, useFormatters, type ActionMenuItem, type DataTableColumn } from "@/app/ui";

interface PaginationMeta {
  page: number;
  pages: number;
  total: number;
}

const MONTH_SHORT_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

const PAGE_SIZE = 10;

function formatBillingMonth(value: string, getMonthShort: (index: number) => string): string {
  if (!value) return "—";

  const weeklyMatch = value.match(/^(\d+)\/(\d{4})\s+W(\d{2})(\d{2})-(\d{2})(\d{2})$/);
  if (weeklyMatch) {
    const year = weeklyMatch[2];
    const startMonth = parseInt(weeklyMatch[3], 10) - 1;
    const startDay = parseInt(weeklyMatch[4], 10);
    const endMonth = parseInt(weeklyMatch[5], 10) - 1;
    const endDay = parseInt(weeklyMatch[6], 10);

    const startStr = `${getMonthShort(startMonth)} ${startDay}`;
    const endStr = startMonth === endMonth ? `${endDay}` : `${getMonthShort(endMonth)} ${endDay}`;

    return `${startStr} – ${endStr}, ${year}`;
  }

  const monthlyMatch = value.match(/^(\d+)\/(\d{4})$/);
  if (monthlyMatch) {
    const month = parseInt(monthlyMatch[1], 10) - 1;
    const year = monthlyMatch[2];
    return `${getMonthShort(month) ?? monthlyMatch[1]} ${year}`;
  }

  return value;
}

export default function CompanyInvoicingPage() {
  const t = useTranslations("company.invoicing");
  const tCommon = useTranslations("common");
  const { formatCurrency, formatDate } = useFormatters();
  const { user } = useAuth();

  const companyId = user?.company_id;
  const [page, setPage] = useState(1);
  // A request is identified by (page, attempt); loading is derived from whether its result has landed.
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; invoices: Invoice[]; pagination: PaginationMeta } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);

  const requestKey = `${companyId ?? ""}:${page}:${attempt}`;
  const invoices = result?.invoices ?? [];
  const pagination = result?.pagination ?? { page: 1, pages: 1, total: 0 };
  const error = failure?.key === requestKey ? failure.message : null;
  const isLoading = !!companyId && result?.key !== requestKey && !error;

  const getMonthShort = useCallback((index: number) => t(`monthsShort.${MONTH_SHORT_KEYS[index]}`), [t]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const key = requestKey;
    apiClient
      .getCompanyInvoices(companyId, { page, limit: PAGE_SIZE })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res: any) => {
        if (cancelled) return;
        const raw = res?.data ?? res;
        const meta = raw?.pagination ?? {};
        setResult({ key, invoices: raw?.data ?? raw ?? [], pagination: { page: meta.page ?? page, pages: meta.pages ?? 1, total: meta.total ?? 0 } });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setFailure({ key, message: e instanceof Error ? e.message : tCommon("errors.failedToLoadInvoices") });
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, page, requestKey, tCommon]);

  const retry = () => setAttempt((a) => a + 1);

  const downloadPdf = async (id: number, invoiceNumber: string) => {
    if (downloadingId) return;
    setDownloadingId(id);
    try {
      await apiClient.downloadInvoicePdf(id, invoiceNumber);
    } catch (e) {
      console.error("Failed to download PDF", e);
      toast.error(t("failedToDownloadPdf"));
    } finally {
      setDownloadingId(null);
    }
  };

  const viewPdf = async (id: number) => {
    if (viewingId) return;
    setViewingId(id);
    try {
      await apiClient.viewInvoicePdf(id);
    } catch (e) {
      console.error("Failed to view PDF", e);
      toast.error(t("failedToViewPdf"));
    } finally {
      setViewingId(null);
    }
  };

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: "invoice",
      header: t("invoiceNumber"),
      mono: true,
      cell: (row) => <span className="font-medium text-fg">#{row.invoice_number}</span>,
    },
    {
      key: "period",
      header: t("billingMonth"),
      cell: (row) => <span className="text-fg">{formatBillingMonth(row.billing_month, getMonthShort)}</span>,
    },
    {
      key: "generated",
      header: t("generatedAt"),
      hideBelow: "lg",
      cell: (row) => <span className="text-fg-secondary">{formatDate(row.generated_at)}</span>,
    },
    {
      key: "total",
      header: t("totalAmount"),
      align: "right",
      mono: true,
      cell: (row) => <span className="font-medium text-fg">{formatCurrency(Number(row.total_amount))}</span>,
    },
    {
      key: "paid",
      header: t("amountPaid"),
      align: "right",
      mono: true,
      hideBelow: "sm",
      cell: (row) =>
        row.amount_paid != null && Number(row.amount_paid) > 0 ? (
          <span className="text-success-ink">{formatCurrency(Number(row.amount_paid))}</span>
        ) : (
          <span className="text-fg-muted">—</span>
        ),
    },
    {
      key: "payable",
      header: t("amountPayable"),
      align: "right",
      mono: true,
      hideBelow: "sm",
      cell: (row) =>
        row.status === "PAID" ? (
          <Badge tone="success" size="sm">
            {t("fullyPaid")}
          </Badge>
        ) : (
          <span className="text-danger-ink">{formatCurrency(Math.max(0, Number(row.total_amount) - Number(row.amount_paid ?? 0)))}</span>
        ),
    },
    {
      key: "status",
      header: t("status"),
      cell: (row) => <StatusBadge status={row.status || "DRAFT"} label={t(`statusLabels.${(row.status || "DRAFT") as "PAID"}`)} />,
    },
  ];

  const rowActions = (row: Invoice): ActionMenuItem[] => [
    {
      label: viewingId === row.id ? t("viewing") : t("viewInvoice"),
      icon: <Eye />,
      disabled: viewingId === row.id,
      onSelect: () => void viewPdf(row.id),
    },
    {
      label: downloadingId === row.id ? t("downloading") : t("downloadPdf"),
      icon: <Download />,
      disabled: downloadingId === row.id,
      onSelect: () => void downloadPdf(row.id, row.invoice_number),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Card>
        <DataTable<Invoice>
          caption={t("title")}
          columns={columns}
          rows={invoices}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={error}
          onRetry={retry}
          empty={{ icon: <FileText aria-hidden="true" />, title: t("noInvoices") }}
          rowActions={rowActions}
          pagination={{
            page,
            totalPages: pagination.pages,
            total: pagination.total,
            pageSize: PAGE_SIZE,
            onPageChange: setPage,
          }}
        />
      </Card>
    </div>
  );
}
