"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiClient, Invoice } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { Card } from "../components/DashboardComponents";
import { PageHeader, TableEmptyState, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS, TABLE_PAGINATION_WRAPPER_CLASS } from "../components/PageLayout";
import TableSkeleton from "@/app/components/ui/TableSkeleton";
import { IllustrationTile } from "../ui";
import Pagination from "@/app/components/ui/Pagination";
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

type InvoiceStatus = "PAID" | "UNPAID" | "PARTIALLY_PAID" | "OVERDUE" | "DRAFT";

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
    const [isLoading, setIsLoading] = useState(false);
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
            return t(`statusLabels.${key}`);
        },
        [t],
    );

    const fetchInvoices = useCallback(async (p: number) => {
        if (!user?.company_id) return;
        setIsLoading(true);
        try {
            const res = await apiClient.getCompanyInvoices(user.company_id, { page: p, limit: 10 }) as any;
            const raw = res?.data ?? res;
            setInvoices(raw?.data ?? raw ?? []);
            const meta = raw?.pagination ?? {};
            setPagination({ page: meta.page ?? p, pages: meta.pages ?? 1, total: meta.total ?? 0 });
        } catch (e: any) {
            setErrorState(e?.message ?? tCommon("errors.failedToLoadInvoices"));
        } finally {
            setIsLoading(false);
        }
    }, [user?.company_id, tCommon]);

    useEffect(() => {
        fetchInvoices(page);
    }, [page, fetchInvoices]);

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
        return <div className="p-12 text-center text-[var(--tone-danger-ink)] bg-[var(--tone-danger-soft)] rounded-[var(--radius-card)] m-6">{errorState}</div>;
    }

    return (
        <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
            <PageHeader
                label={t("label")}
                title={t("title")}
                description={t("description")}
            />

            <Card className={`min-h-[500px] ${TABLE_CARD_CLASS}`}>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-start text-sm">
                        <thead>
                            <tr className="border-b border-[var(--border-light)]">
                                <th className={TABLE_HEADER_CELL_CLASS}>{t("invoiceNumber")}</th>
                                <th className={TABLE_HEADER_CELL_CLASS}>{t("billingMonth")}</th>
                                <th className={TABLE_HEADER_CELL_CLASS}>{t("generatedAt")}</th>
                                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("totalAmount")}</th>
                                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("amountPaid")}</th>
                                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("amountPayable")}</th>
                                <th className={TABLE_HEADER_CELL_CLASS}>{t("status")}</th>
                                <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("actions")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--divider)]">
                            {isLoading && invoices.length === 0 ? (
                                <TableSkeleton columns={8} rows={8} />
                            ) : invoices.length === 0 && !isLoading ? (
                                <TableEmptyState illustration="receipt" message={t("noInvoices")} />
                            ) : (
                                invoices.map((inv) => (
                                    <tr key={inv.id} className="group hover:bg-[var(--row-hover)] transition-colors">
                                        <td className={TABLE_CELL_CLASS}>
                                            <span className="inline-flex items-center gap-3 font-medium text-[var(--text-primary)] font-mono">
                                                <IllustrationTile name="receipt" size="sm" />
                                                #{inv.invoice_number}
                                            </span>
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} font-medium text-[var(--text-primary)]`}>
                                            {formatBillingMonth(inv.billing_month, getMonthShort)}
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-[var(--text-muted)]`}>
                                            {formatLocaleDate(inv.generated_at, locale)}
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-end font-medium text-[var(--text-primary)] text-base`}>
                                            <span className="text-[var(--text-muted)] text-xs font-normal me-1">{tCommon("currency.pkr")}</span>
                                            {formatLocaleNumber(Number(inv.total_amount), locale)}
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-end`}>
                                            {inv.amount_paid != null && Number(inv.amount_paid) > 0 ? (
                                                <span className="font-semibold text-[var(--tone-success-ink)]">
                                                    <span className="text-[var(--tone-success-ink)] text-xs font-normal me-1">{tCommon("currency.pkr")}</span>
                                                    {formatLocaleNumber(Number(inv.amount_paid), locale)}
                                                </span>
                                            ) : (
                                                <span className="text-[var(--text-muted)]">—</span>
                                            )}
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-end`}>
                                            {inv.status === 'PAID' ? (
                                                <span className="text-[var(--tone-success-ink)] font-semibold text-xs">{t("fullyPaid")}</span>
                                            ) : (
                                                <span className="font-semibold text-[var(--tone-danger-ink)]">
                                                    <span className="text-[var(--tone-danger-ink)] text-xs font-normal me-1">{tCommon("currency.pkr")}</span>
                                                    {formatLocaleNumber(Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid ?? 0)), locale)}
                                                </span>
                                            )}
                                        </td>
                                        <td className={TABLE_CELL_CLASS}>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${inv.status === 'PAID' ? 'bg-[var(--tone-success-soft)] text-[var(--tone-success-ink)] border-[var(--tone-success-line)]' :
 inv.status === 'UNPAID' ? 'bg-[var(--tone-danger-soft)] text-[var(--tone-danger-ink)] border-[var(--tone-danger-line)]' :
 inv.status === 'PARTIALLY_PAID' ? 'bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)] border-[var(--tone-warning-line)]' :
 inv.status === 'OVERDUE' ? 'bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)] border-[var(--tone-warning-line)]' :
 'bg-[var(--tile-bg)] text-[var(--text-muted)] border-transparent'
 }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full me-1.5 ${inv.status === 'PAID' ? 'bg-[var(--tone-success-ink)]' :
 inv.status === 'UNPAID' ? 'bg-[var(--tone-danger-ink)]' :
 inv.status === 'PARTIALLY_PAID' ? 'bg-[var(--tone-warning-ink)]' :
 inv.status === 'OVERDUE' ? 'bg-[var(--tone-warning-ink)]' :
 'bg-[var(--text-muted)]'
 }`}></span>
                                                {formatStatus(inv.status)}
                                            </span>
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-end`}>
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => viewPdf(inv.id)}
                                                    disabled={viewingId === inv.id}
                                                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--pill-line)] px-4 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-50 disabled:cursor-wait"
                                                >
                                                    {viewingId === inv.id ? (
                                                        <>
                                                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            {t("viewing")}
                                                        </>
                                                    ) : t("viewInvoice")}
                                                </button>
                                                <button
                                                    onClick={() => downloadPdf(inv.id, inv.invoice_number)}
                                                    disabled={downloadingId === inv.id}
                                                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--cort-orange)] px-4 text-sm text-white hover:bg-[var(--cort-orange-hover)] transition-colors disabled:opacity-50 disabled:cursor-wait"
                                                >
                                                    {downloadingId === inv.id ? (
                                                        <>
                                                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            {t("downloading")}
                                                        </>
                                                    ) : t("downloadPdf")}
                                                </button>
                                            </div>
                                        </td>

                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {pagination?.pages > 1 && (
                    <div className={TABLE_PAGINATION_WRAPPER_CLASS}>
                        <Pagination
                            currentPage={page}
                            totalPages={pagination.pages}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
}
