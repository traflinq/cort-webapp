export enum ExpenseCategory {
    MARKETING = 'MARKETING',
    INTEREST = 'INTEREST',
    RENT = 'RENT',
    LOGISTICS = 'LOGISTICS',
    OFFICE_ACCESSORIES = 'OFFICE_ACCESSORIES',
    TRAVELLING = 'TRAVELLING',
    BANK_CHARGES = 'BANK_CHARGES',
    ENTERTAINMENT = 'ENTERTAINMENT',
    SUBSCRIPTION = 'SUBSCRIPTION',
    MISC = 'MISC',
    TOLL = 'TOLL',
    PARKING = 'PARKING',
    COURIER = 'COURIER',
}

export interface Expense {
    id: number;
    category: ExpenseCategory;
    amount: number;
    date: string;
    description: string | null;
    payment_status: string | null;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
    booking_id: number | null;
    /** Shuttle invoice this cost is tagged to (e.g. courier fee). Exclusive with booking_id. */
    invoice_id?: number | null;
    invoice_number?: string | null;
    invoice_label?: string | null;
    created_by?: string | null;
    added_by_name?: string | null;
}

export interface CreateExpenseRequest {
    category: ExpenseCategory;
    amount: number;
    date: string;
    description?: string;
    /** Optional booking tag — any category. Counts toward Chauffeur COGS only. */
    booking_id?: number | null;
    /** Optional shuttle-invoice tag. Counts toward that invoice's COGS only; cannot be combined with booking_id. */
    invoice_id?: number | null;
}

/** A shuttle invoice an expense can be tagged to. */
export interface TaggableInvoice {
    id: number;
    invoice_number: string;
    billing_month: string | null;
    period_start: string | null;
    period_end: string | null;
    total_amount: number | string | null;
    company_name: string | null;
}

export type UpdateExpenseRequest = Partial<CreateExpenseRequest>;

export interface ExpenseFilterParams {
    startDate?: string;
    endDate?: string;
    category?: ExpenseCategory;
    page?: number;
    limit?: number;
}

export interface ExpensesListResult {
    data: Expense[];
    pagination: {
        page: number;
        pages: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    totalAmount: number;
}
