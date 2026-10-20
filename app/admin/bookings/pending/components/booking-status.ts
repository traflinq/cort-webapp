import type { StatusEntry } from "../../../ui";

/** Booking-specific statuses not in the shared registry, plus ENDED styled distinctly from COMPLETED. */
export const BOOKING_STATUS_OVERRIDES: Record<string, StatusEntry> = {
  ARRIVED: { tone: "info", label: "Arrived" },
  OTW: { tone: "brand", label: "On the way" },
  DROPPED_OFF: { tone: "brand", label: "Dropped off" },
  ENDED: { tone: "purple", label: "Ended" },
  FULLY_PAID: { tone: "success", label: "Fully paid" },
  PARTIALLY_PAID: { tone: "warning", label: "Partially paid" },
};

/** Statuses an admin can set from the list. Order matches the lifecycle. */
export const BOOKING_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "ENDED", label: "Ended" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** Sub-states collapse onto the option the select can show. */
export function selectableStatus(status: string): string {
  if (status === "DROPPED_OFF") return "IN_PROGRESS";
  if (status === "OTW") return "ASSIGNED";
  return status;
}

export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return fallback;
}
