export interface QueryInvoiceParams {
    page?: number;
    limit?: number;
    status?: string;
    company_id?: number;
    search?: string;
}

export interface Invoice {
    id: number;
    invoice_number: string;
    billing_month: string;
    total_amount: number;
    pdf_url?: string;
    generated_at: string;
    status: string;
    shuttle_contract_id?: number | null;
    amount_paid?: number | string | null;
    amount_remaining?: number | string | null;
    payment_status?: string | null;
    companies?: {
        name: string;
    }
}

export interface QueryInvoiceProfitabilityParams {
    page?: number;
    limit?: number;
    company_id?: number;
    startDate?: string;
    endDate?: string;
}

/** One invoice with the trip cost behind it, as returned by GET /invoices/profitability. */
export interface InvoiceProfitabilityRow {
    id: number;
    invoice_number: string;
    company_id: number | null;
    company_name: string | null;
    service_type: 'CHAUFFEUR' | 'SHUTTLE';
    booking_id: number | null;
    status: string | null;
    generated_at: string | null;
    period_start: string | null;
    period_end: string | null;
    billing_month: string | null;
    invoice_date: string | null;
    /** Billed to the client, SST included. */
    amount: number;
    sst_amount: number;
    amount_excluding_sst: number;
    cogs: number;
    /** amount_excluding_sst − cogs. */
    profit: number;
    margin_percentage: number;
}

/** Aggregated over every invoice matching the filters, not just the current page. */
export interface InvoiceProfitabilityTotals {
    invoiceCount: number;
    amount: number;
    sstAmount: number;
    amountExcludingSst: number;
    cogs: number;
    profit: number;
    marginPercentage: number;
}

export interface InvoiceProfitabilityResponse {
    data: InvoiceProfitabilityRow[];
    totals: InvoiceProfitabilityTotals;
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
