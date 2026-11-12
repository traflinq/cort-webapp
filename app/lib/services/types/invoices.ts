/** CORT = Cort's own invoices; EXTERNAL_VENDOR = issued by a company's own vendor (not Cort revenue). */
export type InvoiceIssuerType = 'CORT' | 'EXTERNAL_VENDOR';

export interface QueryInvoiceParams {
    page?: number;
    limit?: number;
    status?: string;
    company_id?: number;
    search?: string;
    /** Defaults to CORT on the server. */
    issuer?: InvoiceIssuerType;
    /** Vendor-issued invoices of one external vendor. */
    vendor_id?: number;
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
    include_sst?: boolean;
    show_stamp?: boolean;
    booking_id?: number | null;
    issuer_type?: InvoiceIssuerType;
    issuer_external_vendor_id?: number | null;
    issuer_external_vendors?: { id: number; name: string } | null;
    /** Vendor invoices only: the company's audit of what the vendor actually billed. */
    chauffeur_bookings?: {
        vendor_trip_audits?: {
            vendor_charged_amount: string | number;
            difference_amount: string | number;
            audited_at: string;
            vendor_invoice_reference: string | null;
        } | null;
    } | null;
    companies?: {
        name: string;
        prefix?: string | null;
    }
}

/** Why a completed EXTERNAL_VENDOR trip has no invoice yet. */
export type PendingVendorTripReason = 'NO_VENDOR_ASSIGNED' | 'NO_CONTRACT' | 'NO_RATE_FOR_MODEL' | 'READY';

/** GET /invoices/vendor-pending-trips */
export interface PendingVendorTrip {
    id: number;
    company_id: number;
    vehicle_model: string | null;
    scheduled_for: string | null;
    company_vendor_link_id: number | null;
    companies: { name: string } | null;
    chauffeur_trip_logs: { completed_at: string | null; total_distance_km: string | number | null; total_duration_minutes: number | null } | null;
    passenger_name: string | null;
    vendor: { id: number; name: string } | null;
    vendor_link_id: number | null;
    contract_id: number | null;
    reason: PendingVendorTripReason;
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
