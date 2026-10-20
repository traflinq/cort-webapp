export interface Invoice {
  id: number;
  invoice_number: string;
  billing_month: string;
  billing_period?: "MONTHLY" | "WEEKLY" | null;
  period_start?: string | null;
  period_end?: string | null;
  generated_at: string;
  total_amount: number | string;
  status: string;
  companies?: { name: string } | null;
  shuttle_contract_id?: number | null;
  amount_paid?: number | string | null;
  amount_remaining?: number | string | null;
  payment_status?: string | null;
}

export interface InvoiceStats {
  totalCollectable: number;
  totalCollected: number;
  totalOverdue: number;
}

export interface PaginationMeta {
  page: number;
  pages: number;
  total: number;
}

/** Statuses the backend accepts on PATCH /invoices/:id/status (unchanged from the old inline select). */
export const INVOICE_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]["value"];

export interface InvoicePayment {
  id: number;
  payment_date: string;
  amount: number | string;
  payment_method?: string | null;
  notes?: string | null;
  users?: { full_name?: string | null } | null;
}

export interface InvoicePaymentLogs {
  invoice_number?: string;
  shuttle_invoice_payments?: InvoicePayment[];
}

/** Extract a human-readable message from an unknown thrown value. */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}
