"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../../lib/services/api-client";
import type { InvoiceProfitabilityRow, InvoiceProfitabilityTotals } from "../../../lib/services/types";
import type { DateRange } from "../../ui";
import { errorMessage, type PaginationMeta } from "../types";

export const PROFITABILITY_PAGE_SIZE = 20;

const EMPTY_TOTALS: InvoiceProfitabilityTotals = {
  invoiceCount: 0,
  amount: 0,
  sstAmount: 0,
  amountExcludingSst: 0,
  cogs: 0,
  profit: 0,
  marginPercentage: 0,
};

/**
 * Invoice-level profit for the chosen company and period. Loading is derived from the
 * request key (requested ≠ loaded) so no state is set synchronously inside the effect,
 * and a stale response can never overwrite a newer one.
 */
export function useProfitability(enabled = true) {
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [range, setRange] = useState<DateRange | null>(null);
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);

  const [rows, setRows] = useState<InvoiceProfitabilityRow[]>([]);
  const [totals, setTotals] = useState<InvoiceProfitabilityTotals>(EMPTY_TOTALS);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pages: 1, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const start = range?.start || undefined;
  const end = range?.end || undefined;
  const key = `${companyId ?? ""}|${start ?? ""}|${end ?? ""}|${page}|${nonce}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Nothing is requested until the tab is actually open, so opening Invoicing costs one request, not two.
  const isLoading = enabled && loadedKey !== key;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getInvoiceProfitability({
          page,
          limit: PROFITABILITY_PAGE_SIZE,
          company_id: companyId,
          startDate: start,
          endDate: end,
        });
        if (cancelled) return;
        const payload = res.data;
        setRows(payload?.data ?? []);
        setTotals(payload?.totals ?? EMPTY_TOTALS);
        setPagination({
          page: payload?.pagination?.page ?? page,
          pages: payload?.pagination?.pages ?? 1,
          total: payload?.pagination?.total ?? 0,
        });
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setRows([]);
        setTotals(EMPTY_TOTALS);
        setError(errorMessage(e, "Could not load invoice profitability."));
      } finally {
        if (!cancelled) setLoadedKey(key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, start, end, page, key, enabled]);

  // Changing a filter always goes back to the first page.
  const applyCompany = useCallback((id: number | undefined) => {
    setCompanyId(id);
    setPage(1);
  }, []);
  const applyRange = useCallback((next: DateRange | null) => {
    setRange(next);
    setPage(1);
  }, []);
  const clearFilters = useCallback(() => {
    setCompanyId(undefined);
    setRange(null);
    setPage(1);
  }, []);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return {
    companyId, applyCompany,
    range, applyRange,
    clearFilters, refetch,
    rows, totals, pagination, page, setPage, isLoading, error,
  };
}

export type ProfitabilityController = ReturnType<typeof useProfitability>;
