import type { StatusEntry } from "../../ui/StatusBadge";

export type VendorLogType = "CHAUFFEUR" | "SHUTTLE";

/** Flattened row returned by GET /vendors/logs (see backend vendors.service.ts). */
export interface VendorLogRow {
  id: number | string;
  type: VendorLogType;
  date: string;
  settled_at?: string | null;
  vehicle?: string | null;
  vendor_name?: string | null;
  passenger?: string | null;
  driver?: string | null;
  details?: string | null;
  booking_id?: number | null;
  invoice_id?: number | null;
  distance?: number | null;
  cost: number;
  amount_paid?: number | null;
  amount_remaining?: number | null;
  status?: string | null;
}

export const PAYMENT_STATUS_OVERRIDES: Record<string, StatusEntry> = {
  FULLY_PAID: { tone: "success", label: "Paid" },
  PAID: { tone: "success", label: "Paid" },
  PARTIALLY_PAID: { tone: "warning", label: "Partially paid" },
  UNPAID: { tone: "danger", label: "Unpaid" },
};

export const PAYMENT_STATUS_OPTIONS = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "FULLY_PAID", label: "Paid" },
] as const;

export function isPaidStatus(status: string | null | undefined): boolean {
  return ["FULLY_PAID", "PAID"].includes(String(status ?? "").toUpperCase());
}

export type PaymentTarget = {
  type: VendorLogType;
  id: number;
  cost: number;
  paid: number;
};

/** What a "Settle" / "Pay advance" action pays against, or null when nothing is payable. */
export function paymentTargetFor(log: VendorLogRow): PaymentTarget | null {
  const isShuttle = log.type === "SHUTTLE";
  const id = isShuttle ? log.invoice_id : log.booking_id;
  if (!id) return null;
  return { type: isShuttle ? "SHUTTLE" : "CHAUFFEUR", id, cost: Number(log.cost), paid: Number(log.amount_paid || 0) };
}

export function referenceLabel(log: VendorLogRow): string | null {
  if (log.invoice_id) return `Invoice #${log.invoice_id}`;
  if (log.booking_id) return `Booking #${log.booking_id}`;
  return null;
}
