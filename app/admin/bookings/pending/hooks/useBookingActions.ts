"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChauffeurBooking, apiClient } from "../../../../lib/services/api-client";
import { useConfirm } from "../../../../lib/hooks/useConfirm";
import { formatCurrency } from "../../../lib/format";
import { errorMessage } from "../components/booking-status";
import type { RecalculatePayload } from "../components/RecalculateModal";

type UseBookingActionsParams = {
  selectedBooking: ChauffeurBooking | null;
  selectedCarId: string;
  selectedDriverId: string;
  setSelectedBookingId: (id: number | null) => void;
  setSelectedCarId: (id: string) => void;
  setSelectedDriverId: (id: string) => void;
  refreshList: () => void;
  setShowEndTripModal: (open: boolean) => void;
  setShowDailyLogsModal: (open: boolean) => void;
  setShowRecalculateModal: (open: boolean) => void;
};

export function useBookingActions({
  selectedBooking,
  selectedCarId,
  selectedDriverId,
  setSelectedBookingId,
  setSelectedCarId,
  setSelectedDriverId,
  refreshList,
  setShowEndTripModal,
  setShowDailyLogsModal,
  setShowRecalculateModal,
}: UseBookingActionsParams) {
  const confirm = useConfirm();
  const [isApproving, setIsApproving] = useState(false);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [isEndingTrip, setIsEndingTrip] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const label = (b: ChauffeurBooking | null | undefined, id?: number) => `booking #${b?.id ?? id ?? ""}`;

  async function handleApprove() {
    if (!selectedBooking || !selectedCarId || !selectedDriverId) {
      toast.error("Select both a vehicle and a driver to assign");
      return;
    }
    setIsApproving(true);
    try {
      await apiClient.assignBooking(selectedBooking.id, parseInt(selectedCarId, 10), selectedDriverId);
      toast.success("Assignment updated");
      setSelectedBookingId(null);
      setSelectedCarId("");
      setSelectedDriverId("");
      refreshList();
    } catch (error) {
      console.error("Failed to approve booking", error);
      toast.error(errorMessage(error, "Failed to update assignment"));
    } finally {
      setIsApproving(false);
    }
  }

  async function handleStartTrip() {
    if (!selectedBooking) return;
    const ok = await confirm({
      title: "Start this trip?",
      message: `Start ${label(selectedBooking)} now?`,
      consequences: ["A trip log is created and the booking moves to In progress"],
      confirmLabel: "Start trip",
    });
    if (!ok) return;
    setIsStartingTrip(true);
    try {
      await apiClient.startTrip(selectedBooking.id);
      toast.success("Trip started");
      setSelectedBookingId(null);
      refreshList();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to start trip"));
    } finally {
      setIsStartingTrip(false);
    }
  }

  async function handleEndTrip(data: Record<string, unknown>) {
    if (!selectedBooking) return;
    setIsEndingTrip(true);
    try {
      await apiClient.endTrip(selectedBooking.id, data as Parameters<typeof apiClient.endTrip>[1]);
      toast.success("Trip ended and invoice generated");
      setShowEndTripModal(false);
      setSelectedBookingId(null);
      refreshList();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to end trip"));
    } finally {
      setIsEndingTrip(false);
    }
  }

  async function handleUpdateDailyLogs(data: Record<string, unknown>) {
    if (!selectedBooking) return;
    try {
      await apiClient.updateDailyLogs(selectedBooking.id, data as Parameters<typeof apiClient.updateDailyLogs>[1]);
      toast.success("Daily logs updated");
      setShowDailyLogsModal(false);
      refreshList();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update daily logs"));
      throw error;
    }
  }

  async function handleCompleteTrip() {
    if (!selectedBooking) return;
    const ok = await confirm({
      title: "Complete this trip?",
      message: `Complete ${label(selectedBooking)}?`,
      consequences: ["Financials are calculated from the trip log", "An invoice is generated for the company"],
      confirmLabel: "Complete trip",
    });
    if (!ok) return;
    setIsCompleting(true);
    try {
      const res = await apiClient.completeTrip(selectedBooking.id);
      const data = (res as { data?: { result?: { invoice_amount?: number } } })?.data ?? (res as { result?: { invoice_amount?: number } });
      const amount = data?.result?.invoice_amount;
      toast.success(amount != null ? `Trip completed · invoice ${formatCurrency(amount)}` : "Trip completed and invoice calculated");
      setSelectedBookingId(null);
      refreshList();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to complete trip"));
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleReject() {
    if (!selectedBooking) return;
    const ok = await confirm({
      title: "Reject this booking?",
      message: `Reject ${label(selectedBooking)} for ${selectedBooking.companies?.name ?? "this company"}?`,
      consequences: ["The booking is marked Cancelled", "No email is sent to the passenger"],
      destructive: true,
      confirmLabel: "Reject booking",
    });
    if (!ok) return;
    try {
      await apiClient.updateBookingStatus(selectedBooking.id, "CANCELLED");
      toast.success("Booking rejected");
      setSelectedBookingId(null);
      refreshList();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to reject booking"));
    }
  }

  async function handleDeleteBooking(bookingId: number) {
    const ok = await confirm({
      title: "Delete this booking?",
      message: `Permanently delete booking #${bookingId}?`,
      consequences: ["The booking, its trip log and daily logs are removed", "This cannot be undone"],
      destructive: true,
      confirmLabel: "Delete booking",
    });
    if (!ok) return;
    setIsDeleting(true);
    try {
      await apiClient.deleteBooking(bookingId);
      toast.success("Booking deleted");
      setSelectedBookingId(null);
      refreshList();
    } catch (error) {
      console.error("Failed to delete booking", error);
      toast.error(errorMessage(error, "Failed to delete booking"));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleGenerateInvoice(id: number) {
    const ok = await confirm({
      title: "Generate invoice?",
      message: `Generate the invoice for booking #${id}?`,
      consequences: ["An invoice is created from the completed trip's financials"],
      confirmLabel: "Generate invoice",
    });
    if (!ok) return;
    try {
      await apiClient.generateTripInvoice(id);
      toast.success("Invoice generated");
      refreshList();
    } catch (e) {
      toast.error(errorMessage(e, "Failed to generate invoice"));
    }
  }

  async function handleRecalculate(data: RecalculatePayload, mode: "info" | "recalculate") {
    if (!selectedBooking) return;

    if (mode === "recalculate") {
      const ok = await confirm({
        title: "Regenerate the invoice?",
        message: `Save these overrides for ${label(selectedBooking)} and regenerate its invoice?`,
        consequences: ["The existing invoice is deleted", "A new invoice is generated from the new values", "This cannot be undone"],
        destructive: true,
        confirmLabel: "Regenerate invoice",
      });
      if (!ok) return;
    }

    setIsRecalculating(true);
    try {
      if (mode === "info") {
        await apiClient.updateBookingInfo(selectedBooking.id, data as Parameters<typeof apiClient.updateBookingInfo>[1]);
        toast.success("Booking info updated. Invoice unchanged.");
      } else {
        const res = await apiClient.recalculateBooking(selectedBooking.id, data as Parameters<typeof apiClient.recalculateBooking>[1]);
        const result = ((res as { data?: unknown })?.data ?? res) as { invoice_number?: string; invoice_amount?: number } | undefined;
        toast.success(`Invoice regenerated · #${result?.invoice_number ?? ""} ${formatCurrency(result?.invoice_amount ?? 0)}`);
      }
      setShowRecalculateModal(false);
      refreshList();
    } catch (e) {
      toast.error(errorMessage(e, "Failed to save changes"));
    } finally {
      setIsRecalculating(false);
    }
  }

  const handleStatusChange = async (b: ChauffeurBooking, newStatus: string) => {
    if (newStatus === "ASSIGNED") {
      toast.error("Open the booking and assign a vehicle and driver instead of setting Assigned manually.");
      refreshList();
      return;
    }

    if (newStatus === "IN_PROGRESS") {
      const ok = await confirm({
        title: "Start this trip?",
        message: `Start ${label(b)} now?`,
        consequences: ["A trip log is created"],
        confirmLabel: "Start trip",
      });
      if (!ok) return;
      try {
        await apiClient.startTrip(b.id);
        toast.success("Trip started");
        refreshList();
      } catch (e) {
        toast.error(errorMessage(e, "Failed to start trip"));
      }
      return;
    }

    if (newStatus === "ENDED") {
      setSelectedBookingId(b.id);
      setShowEndTripModal(true);
      return;
    }

    if (newStatus === "COMPLETED") {
      if (b.status !== "ENDED") {
        toast.error("End the trip before completing it.");
        refreshList();
        return;
      }
      const ok = await confirm({
        title: "Complete this trip?",
        message: `Complete ${label(b)}?`,
        consequences: ["Financials are calculated", "An invoice is generated"],
        confirmLabel: "Complete trip",
      });
      if (!ok) return;
      try {
        await apiClient.completeTrip(b.id);
        toast.success("Trip completed");
        refreshList();
      } catch (e) {
        toast.error(errorMessage(e, "Failed to complete trip"));
      }
      return;
    }

    if (newStatus === "CANCELLED") {
      const ok = await confirm({
        title: "Cancel this booking?",
        message: `Cancel ${label(b)}?`,
        consequences: ["Only the status changes", "No cancellation email is sent to the customer"],
        destructive: true,
        confirmLabel: "Cancel booking",
        cancelLabel: "Keep booking",
      });
      if (!ok) return;
      try {
        await apiClient.updateBookingStatus(b.id, newStatus);
        toast.success("Booking cancelled");
        refreshList();
      } catch (e) {
        toast.error(errorMessage(e, "Failed to cancel booking"));
      }
      return;
    }

    const ok = await confirm({
      title: newStatus === "ARRIVED" ? "Mark driver as arrived?" : "Change status?",
      message: newStatus === "ARRIVED" ? `Mark the driver as arrived at the pickup for ${label(b)}?` : `Change ${label(b)} to ${newStatus.replace(/_/g, " ").toLowerCase()}?`,
      confirmLabel: "Confirm",
    });
    if (!ok) return;
    try {
      await apiClient.updateBookingStatus(b.id, newStatus);
      toast.success("Status updated");
      refreshList();
    } catch (e) {
      toast.error(errorMessage(e, "Failed to update status"));
    }
  };

  return {
    isApproving,
    isStartingTrip,
    isEndingTrip,
    isRecalculating,
    isDeleting,
    isCompleting,
    handleApprove,
    handleStartTrip,
    handleEndTrip,
    handleUpdateDailyLogs,
    handleCompleteTrip,
    handleReject,
    handleDeleteBooking,
    handleGenerateInvoice,
    handleRecalculate,
    handleStatusChange,
  };
}
