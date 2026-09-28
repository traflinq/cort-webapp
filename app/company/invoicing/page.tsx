"use client";

import { useCallback, useEffect, useState, Fragment } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiClient, Invoice } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { Card } from "../components/DashboardComponents";
import { PageHeader, TABLE_CARD_CLASS, TABLE_TOP_BAR_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS, TABLE_PAGINATION_WRAPPER_CLASS } from "../components/PageLayout";
import TableSkeleton from "@/app/components/ui/TableSkeleton";
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

    const [travelInvoices, setTravelInvoices] = useState<any[]>([]);
    const [vendorTravelInvoices, setVendorTravelInvoices] = useState<any[]>([]);
    const [expandedTravelId, setExpandedTravelId] = useState<number | null>(null);
    const [travelPdfBusy, setTravelPdfBusy] = useState<string | null>(null);

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
        if (!user?.company_id) return;
        apiClient.getCompanyTravelInvoices(user.company_id, 1, 20)
          .then((res) => setTravelInvoices(res.data?.data || []))
          .catch(() => setTravelInvoices([]));
        apiClient.getCompanyTravelVendorInvoices(user.company_id, 1, 20)
          .then((res) => setVendorTravelInvoices(res.data?.data || []))
          .catch(() => setVendorTravelInvoices([]));
    }, [page, fetchInvoices, user?.company_id]);

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
        return <div className="p-12 text-center text-rose-500 bg-rose-50 rounded-2xl m-6 border border-rose-200">{errorState}</div>;
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
                        <thead className="bg-[var(--surface-subtle)]/50">
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
                        <tbody className="divide-y divide-[var(--border-light)]/50">
                            {isLoading && invoices.length === 0 ? (
                                <TableSkeleton columns={8} rows={8} />
                            ) : invoices.length === 0 && !isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center align-top">
                                        <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
                                            <span className="bg-[var(--surface-subtle)] p-4 rounded-full mb-3">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </span>
                                            <span>{t("noInvoices")}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((inv) => (
                                    <tr key={inv.id} className="group hover:bg-[var(--surface-subtle)]/80 transition-colors border-b border-transparent">
                                        <td className={`${TABLE_CELL_CLASS} font-bold text-[var(--text-primary)] font-mono`}>#{inv.invoice_number}</td>
                                        <td className={`${TABLE_CELL_CLASS} font-medium text-[var(--text-primary)]`}>
                                            {formatBillingMonth(inv.billing_month, getMonthShort)}
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-[var(--text-muted)]`}>
                                            {formatLocaleDate(inv.generated_at, locale)}
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-end font-bold text-[var(--text-primary)] text-base`}>
                                            <span className="text-[var(--text-muted)] text-xs font-normal me-1">{tCommon("currency.pkr")}</span>
                                            {formatLocaleNumber(Number(inv.total_amount), locale)}
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-end`}>
                                            {inv.amount_paid != null && Number(inv.amount_paid) > 0 ? (
                                                <span className="font-semibold text-emerald-600">
                                                    <span className="text-emerald-400 text-xs font-normal me-1">{tCommon("currency.pkr")}</span>
                                                    {formatLocaleNumber(Number(inv.amount_paid), locale)}
                                                </span>
                                            ) : (
                                                <span className="text-[var(--text-muted)]">—</span>
                                            )}
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-end`}>
                                            {inv.status === 'PAID' ? (
                                                <span className="text-emerald-600 font-semibold text-xs">{t("fullyPaid")}</span>
                                            ) : (
                                                <span className="font-semibold text-rose-600">
                                                    <span className="text-rose-400 text-xs font-normal me-1">{tCommon("currency.pkr")}</span>
                                                    {formatLocaleNumber(Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid ?? 0)), locale)}
                                                </span>
                                            )}
                                        </td>
                                        <td className={TABLE_CELL_CLASS}>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                inv.status === 'UNPAID' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                inv.status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                inv.status === 'OVERDUE' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                    'bg-[var(--surface-subtle)] text-[var(--text-muted)] border-[var(--border-light)]'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full me-1.5 ${inv.status === 'PAID' ? 'bg-emerald-400' :
                                                    inv.status === 'UNPAID' ? 'bg-rose-400' :
                                                    inv.status === 'PARTIALLY_PAID' ? 'bg-amber-400' :
                                                    inv.status === 'OVERDUE' ? 'bg-orange-400' :
                                                        'bg-[var(--text-muted)]'
                                                    }`}></span>
                                                {formatStatus(inv.status)}
                                            </span>
                                        </td>
                                        <td className={`${TABLE_CELL_CLASS} text-end`}>
                                            <div className="flex items-center justify-end gap-4">
                                                <button
                                                    onClick={() => viewPdf(inv.id)}
                                                    disabled={viewingId === inv.id}
                                                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-sm disabled:opacity-50 disabled:cursor-wait inline-flex items-center gap-1.5"
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
                                                    className="text-[var(--cort-orange)] hover:text-[var(--cort-orange-hover)] font-medium text-sm disabled:opacity-50 disabled:cursor-wait inline-flex items-center gap-1.5"
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
            <Card className={`${TABLE_CARD_CLASS} mt-6`}>
              <div className={TABLE_TOP_BAR_CLASS}><h2 className="font-bold">{t("travelInvoices")}</h2></div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-start text-sm">
                  <thead className="bg-[var(--surface-subtle)]/50">
                    <tr className="border-b border-[var(--border-light)]">
                      <th className={TABLE_HEADER_CELL_CLASS}>{t("invoiceNumber")}</th>
                      <th className={TABLE_HEADER_CELL_CLASS}>{t("employee")}</th>
                      <th className={TABLE_HEADER_CELL_CLASS}>{t("route")}</th>
                      <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("totalAmount")}</th>
                      <th className={TABLE_HEADER_CELL_CLASS}>{t("status")}</th>
                      <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]/50">
                    {travelInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-[var(--text-muted)]">{t("noTravelInvoices")}</td>
                      </tr>
                    ) : travelInvoices.map((inv) => (
                      <Fragment key={inv.id}>
                        <tr className="hover:bg-[var(--surface-subtle)]/80">
                          <td className={`${TABLE_CELL_CLASS} font-mono`}>
                            <button
                              type="button"
                              onClick={() => setExpandedTravelId(expandedTravelId === inv.id ? null : inv.id)}
                              className="text-start font-bold text-[var(--text-primary)]"
                            >
                              #{inv.invoice_number}
                            </button>
                          </td>
                          <td className={TABLE_CELL_CLASS}>{inv.travel_booking?.employee?.full_name}</td>
                          <td className={TABLE_CELL_CLASS}>{inv.travel_booking?.quote?.origin} - {inv.travel_booking?.quote?.destination}</td>
                          <td className={`${TABLE_CELL_CLASS} text-end font-semibold`}>
                            {tCommon("currency.pkr")} {formatLocaleNumber(Number(inv.total_amount), locale)}
                          </td>
                          <td className={TABLE_CELL_CLASS}>{formatStatus(inv.status)}</td>
                          <td className={`${TABLE_CELL_CLASS} text-end`}>
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={async () => {
                                  if (!user?.company_id) return;
                                  setTravelPdfBusy(`view-${inv.id}`);
                                  try {
                                    await apiClient.viewCompanyTravelInvoicePdf(user.company_id, inv.id);
                                  } catch {
                                    alert(t("failedToViewPdf"));
                                  } finally {
                                    setTravelPdfBusy(null);
                                  }
                                }}
                                disabled={travelPdfBusy === `view-${inv.id}`}
                                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-sm"
                              >
                                {t("viewInvoice")}
                              </button>
                              <button
                                onClick={async () => {
                                  if (!user?.company_id) return;
                                  setTravelPdfBusy(`dl-${inv.id}`);
                                  try {
                                    await apiClient.downloadCompanyTravelInvoicePdf(user.company_id, inv.id, inv.invoice_number);
                                  } catch {
                                    alert(t("failedToDownloadPdf"));
                                  } finally {
                                    setTravelPdfBusy(null);
                                  }
                                }}
                                disabled={travelPdfBusy === `dl-${inv.id}`}
                                className="text-[var(--cort-orange)] hover:text-[var(--cort-orange-hover)] font-medium text-sm"
                              >
                                {t("downloadPdf")}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedTravelId === inv.id && (
                          <tr>
                            <td colSpan={6} className="px-6 py-3 bg-[var(--surface-subtle)]/40">
                              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">{t("lineItems")}</p>
                              <ul className="space-y-1 text-sm">
                                {(inv.line_items ?? []).map((item: any) => (
                                  <li key={item.id} className="flex justify-between gap-4">
                                    <span>{item.description}</span>
                                    <span className="font-medium">{tCommon("currency.pkr")} {formatLocaleNumber(Number(item.total_price), locale)}</span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className={`${TABLE_CARD_CLASS} mt-6`}>
              <div className={TABLE_TOP_BAR_CLASS}><h2 className="font-bold">{t("vendorTravelInvoices")}</h2></div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-start text-sm">
                  <thead className="bg-[var(--surface-subtle)]/50">
                    <tr className="border-b border-[var(--border-light)]">
                      <th className={TABLE_HEADER_CELL_CLASS}>{t("invoiceNumber")}</th>
                      <th className={TABLE_HEADER_CELL_CLASS}>{t("vendor")}</th>
                      <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("totalAmount")}</th>
                      <th className={TABLE_HEADER_CELL_CLASS}>{t("status")}</th>
                      <th className={`${TABLE_HEADER_CELL_CLASS} text-end`}>{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]/50">
                    {vendorTravelInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-[var(--text-muted)]">{t("noVendorTravelInvoices")}</td>
                      </tr>
                    ) : vendorTravelInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className={`${TABLE_CELL_CLASS} font-mono font-bold`}>#{inv.invoice_number}</td>
                        <td className={TABLE_CELL_CLASS}>{inv.company_vendor_links?.external_vendors?.name ?? "—"}</td>
                        <td className={`${TABLE_CELL_CLASS} text-end font-semibold`}>
                          {tCommon("currency.pkr")} {formatLocaleNumber(Number(inv.total_amount), locale)}
                        </td>
                        <td className={TABLE_CELL_CLASS}>{formatStatus(inv.status)}</td>
                        <td className={`${TABLE_CELL_CLASS} text-end`}>
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={async () => {
                                if (!user?.company_id) return;
                                try {
                                  await apiClient.viewCompanyTravelVendorInvoicePdf(user.company_id, inv.id);
                                } catch {
                                  alert(t("failedToViewPdf"));
                                }
                              }}
                              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-sm"
                            >
                              {t("viewInvoice")}
                            </button>
                            <button
                              onClick={async () => {
                                if (!user?.company_id) return;
                                try {
                                  await apiClient.downloadCompanyTravelVendorInvoicePdf(user.company_id, inv.id, inv.invoice_number);
                                } catch {
                                  alert(t("failedToDownloadPdf"));
                                }
                              }}
                              className="text-[var(--cort-orange)] font-medium text-sm"
                            >
                              {t("downloadPdf")}
                            </button>
                            {inv.status !== "PAID" && (
                              <button
                                onClick={async () => {
                                  if (!user?.company_id) return;
                                  try {
                                    await apiClient.updateCompanyTravelVendorInvoiceStatus(user.company_id, inv.id, "PAID");
                                    setVendorTravelInvoices((rows) =>
                                      rows.map((row) => (row.id === inv.id ? { ...row, status: "PAID" } : row)),
                                    );
                                  } catch {
                                    alert(tCommon("errors.failedToLoadInvoices"));
                                  }
                                }}
                                className="text-emerald-700 font-medium text-sm"
                              >
                                {t("markPaid")}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
        </div>
    );
}
