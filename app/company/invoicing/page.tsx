"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Download, Eye, FileText } from "lucide-react";
import { Button, ErrorState, StatusBadge, TableSkeletonRows, type StatusEntry } from "@/app/admin/ui";
import { apiClient, Invoice } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { Card } from "../components/Card";
import { PageHeader, TableEmptyState, TABLE_CARD_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../components/PageLayout";
import { COMPANY_PAGE_SIZE, TablePagination } from "../components/TablePagination";
import { formatLocaleDate, formatLocaleNumber } from "@/app/lib/i18n/format";
import type { Locale } from "@/i18n/config";

interface PaginationMeta {
    page: number;
    pages: number;
    total: number;
}

const MONTH_SHORT_KEYS = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
] as const;

type InvoiceStatus = "PAID" | "UNPAID" | "PARTIALLY_PAID" | "OVERDUE" | "DRAFT" | "CANCELLED";

/** Unpaid is awaiting payment, not a failure: only overdue reads as danger. A cancelled invoice is void, not an error. */
const INVOICE_STATUS_TONES: Record<string, StatusEntry> = {
    UNPAID: { tone: "warning" },
    CANCELLED: { tone: "neutral" },
};

function formatBillingMonth(
    value: string,
    getMonthShort: (index: number) => string,
): string {
    if (!value) return "—";

    const weeklyMatch = value.match(/^(\d+)\/(\d{4})\s+W(\d{2})(\d{2})-(\d{2})(\d{2})$/);
    if (weeklyMatch) {
        const year = weeklyMatch[2];
        const startMonth = parseInt(weeklyMatch[3], 10) - 1;
        const startDay = parseInt(weeklyMatch[4], 10);
        const endMonth = parseInt(weeklyMatch[5], 10) - 1;
        const endDay = parseInt(weeklyMatch[6], 10);

        const startStr = `${getMonthShort(startMonth)} ${startDay}`;
        const endStr = startMonth === endMonth
            ? `${endDay}`
            : `${getMonthShort(endMonth)} ${endDay}`;

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
    const locale = useLocale() as Locale;
    const { user } = useAuth();

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pages: 1, total: 0 });
    const [errorState, setErrorState] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [viewingId, setViewingId] = useState<number | null>(null);
    const [page, setPage] = useState(1);

    const getMonthShort = useCallback(
        (index: number) => t(`monthsShort.${MONTH_SHORT_KEYS[index]}`),
        [t],
    );

    const formatStatus = useCallback(
        (status: string | undefined) => {
            const key = (status || "DRAFT") as InvoiceStatus;
            // Unknown future statuses fall back to the badge's humanized label instead of a raw key.
            return t.has(`statusLabels.${key}`) ? t(`statusLabels.${key}`) : undefined;
        },
        [t],
    );

    /** Full PKR amount: "PKR 1,240,500", or "PKR 7,528.10" when there are paisa (always 2 decimals then). */
    const money = (value: number) => {
        const digits = Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2;
        return `${tCommon("currency.pkr")} ${formatLocaleNumber(value, locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
    };

    // Bumped by "Try again" to refetch the same page.
    const [reloadKey, setReloadKey] = useState(0);
    // The view on screen lags the one asked for while a request is out: that gap is "loading".
    const requestKey = JSON.stringify([user?.company_id, page, reloadKey]);
    const [loadedKey, setLoadedKey] = useState<string | null>(null);
    const isLoading = !!user?.company_id && loadedKey !== requestKey;

    useEffect(() => {
        const companyId = user?.company_id;
        if (!companyId) return;
        // Cleared when the page moves on, so a slower earlier response can't overwrite a newer one.
        let current = true;
        apiClient
            .getCompanyInvoices(companyId, { page, limit: COMPANY_PAGE_SIZE })
            .then((res) => {
                if (!current) return;
                const raw = ((res as { data?: unknown })?.data ?? res) as {
                    data?: Invoice[];
                    pagination?: Partial<PaginationMeta>;
                };
                const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? (raw as Invoice[]) : [];
                const meta = raw?.pagination ?? {};
                setInvoices(list);
                setPagination({ page: meta.page ?? page, pages: meta.pages ?? 1, total: meta.total ?? list.length });
                setErrorState(null);
            })
            .catch((e: unknown) => {
                if (current) setErrorState(e instanceof Error ? e.message : tCommon("errors.failedToLoadInvoices"));
            })
            .finally(() => {
                if (current) setLoadedKey(requestKey);
            });
        return () => {
            current = false;
        };
    }, [user?.company_id, page, reloadKey, requestKey, tCommon]);

    const downloadPdf = async (id: number, invoiceNumber: string) => {
        if (downloadingId) return;
        setDownloadingId(id);
        try {
            await apiClient.downloadInvoicePdf(id, invoiceNumber);
        } catch (e) {
            console.error("Failed to download PDF", e);
            alert(t("failedToDownloadPdf"));
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
            alert(t("failedToViewPdf"));
        } finally {
            setViewingId(null);
        }
    };

    if (errorState) {
        return (
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12">
                <PageHeader label={t("label")} title={t("title")} description={t("description")} />
                <Card>
                    <ErrorState
                        title={tCommon("errors.failedToLoadInvoices")}
                        message={errorState}
                        onRetry={() => {
                            setErrorState(null);
                            setReloadKey((k) => k + 1);
                        }}
                        retryLabel={tCommon("actions.tryAgain")}
                        compact
                    />
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12">
            <PageHeader
                label={t("label")}
                title={t("title")}
                description={t("description")}
            />

            <Card className={TABLE_CARD_CLASS}>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-start text-sm">
                        <thead>
                            <tr className="border-b border-line text-start">
                                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("invoiceNumber")}</th>
                                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("billingMonth")}</th>
                                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("generatedAt")}</th>
                                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("totalAmount")}</th>
                                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("amountPaid")}</th>
                                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("amountPayable")}</th>
                                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-start`}>{t("status")}</th>
                                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("actions")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {isLoading && invoices.length === 0 ? (
                                <TableSkeletonRows columns={8} rows={8} />
                            ) : invoices.length === 0 && !isLoading ? (
                                <TableEmptyState message={t("noInvoices")} icon={FileText} />
                            ) : (
                                invoices.map((inv) => {
                                    const total = Number(inv.total_amount);
                                    const paid = Number(inv.amount_paid ?? 0);
                                    const payable = Math.max(0, total - paid);
                                    const isOverdue = inv.status === "OVERDUE";
                                    const isCancelled = inv.status === "CANCELLED";
                                    return (
                                        <tr key={inv.id} className="transition-colors hover:bg-row-hover">
                                            <td className={`${TABLE_CELL_CLASS} whitespace-nowrap font-medium text-fg`}>#{inv.invoice_number}</td>
                                            <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-fg`}>
                                                {formatBillingMonth(inv.billing_month, getMonthShort)}
                                            </td>
                                            <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-fg-muted`}>
                                                {formatLocaleDate(inv.generated_at, locale)}
                                            </td>
                                            <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-end font-medium ${isCancelled ? "text-fg-muted line-through" : "text-fg"}`}>
                                                {money(total)}
                                            </td>
                                            <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-end text-fg-secondary`}>
                                                {inv.amount_paid != null && paid > 0 ? (
                                                    money(paid)
                                                ) : (
                                                    <span className="text-fg-muted">—</span>
                                                )}
                                            </td>
                                            <td className={`${TABLE_CELL_CLASS} whitespace-nowrap text-end`}>
                                                {isCancelled ? (
                                                    <span className="text-fg-muted">—</span>
                                                ) : inv.status === "PAID" ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted">
                                                        <Check className="size-3.5 text-success-ink" aria-hidden="true" />
                                                        {t("fullyPaid")}
                                                    </span>
                                                ) : (
                                                    <span className={`font-semibold ${isOverdue ? "text-danger-ink" : "text-fg"}`}>
                                                        {money(payable)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className={TABLE_CELL_CLASS}>
                                                <StatusBadge
                                                    status={inv.status || "DRAFT"}
                                                    label={formatStatus(inv.status)}
                                                    overrides={INVOICE_STATUS_TONES}
                                                />
                                            </td>
                                            <td className={`${TABLE_CELL_CLASS} text-end`}>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => viewPdf(inv.id)}
                                                        loading={viewingId === inv.id}
                                                        leftIcon={<Eye aria-hidden="true" />}
                                                    >
                                                        {viewingId === inv.id ? t("viewing") : t("viewInvoice")}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => downloadPdf(inv.id, inv.invoice_number)}
                                                        loading={downloadingId === inv.id}
                                                        leftIcon={<Download aria-hidden="true" />}
                                                    >
                                                        {downloadingId === inv.id ? t("downloading") : t("downloadPdf")}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <TablePagination
                    page={page}
                    totalPages={pagination.pages}
                    total={invoices.length === 0 ? 0 : pagination.total}
                    pageSize={COMPANY_PAGE_SIZE}
                    onPageChange={setPage}
                    summary={(range) => t("showingRange", range)}
                />
            </Card>
        </div>
    );
}
