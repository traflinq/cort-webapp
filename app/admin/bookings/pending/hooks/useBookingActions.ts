"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChauffeurBooking, apiClient } from "../../../../lib/services/api-client";
import { useConfirm } from "../../../../lib/hooks/useConfirm";

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

  async function handleApprove() {
    if (!selectedBooking || !selectedCarId || !selectedDriverId) {
      toast.error("Please select both a vehicle and a driver to assign");
      return;
    }

    setIsApproving(true);
    try {
      await apiClient.assignBooking(
        selectedBooking.id,
        parseInt(selectedCarId),
        selectedDriverId
      );
      toast.success("Booking assignment updated!");
      setSelectedBookingId(null);
      setSelectedCarId("");
      setSelectedDriverId("");
      refreshList();
    } catch (error: any) {
      console.error("Failed to approve booking", error);
      toast.error(error?.message || "Failed to approve booking");
    } finally {
      setIsApproving(false);
    }
  }

  async function handleStartTrip() {
    if (!selectedBooking) return;
    const ok = await confirm({ message: "Are you sure you want to START this trip?" });
    if (!ok) return;

    setIsStartingTrip(true);
    try {
      await apiClient.startTrip(selectedBooking.id);
      toast.success("Trip started successfully!");
      setSelectedBookingId(null);
      refreshList();
    } catch (error: any) {
      toast.error(error?.message || "Failed to start trip");
    } finally {
      setIsStartingTrip(false);
    }
  }

  async function handleEndTrip(data: any) {
    if (!selectedBooking) return;

    setIsEndingTrip(true);
    try {
      await apiClient.endTrip(selectedBooking.id, data);
      toast.success("Trip completed and invoice generated successfully!");
      setShowEndTripModal(false);
      setSelectedBookingId(null);
      refreshList();
    } catch (error: any) {
      toast.error(error?.message || "Failed to end trip");
    } finally {
      setIsEndingTrip(false);
    }
  }

  async function handleUpdateDailyLogs(data: any) {
    if (!selectedBooking) return;

    try {
      await apiClient.updateDailyLogs(selectedBooking.id, data);
      toast.success("Daily logs updated successfully!");
      setShowDailyLogsModal(false);
      refreshList();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update daily logs");
    }
  }

  async function handleCompleteTrip() {
    if (!selectedBooking) return;
    const ok = await confirm({
      message: "Are you sure you want to COMPLETE this trip? Financials will be calculated.",
    });
    if (!ok) return;

    try {
      const res: any = await apiClient.completeTrip(selectedBooking.id);
      const data = res?.data ?? res;
      toast.success(
        `Trip completed! Invoice Amount: ${data?.result?.invoice_amount ?? "Calculated"}`
      );
      setSelectedBookingId(null);
      refreshList();
    } catch (error: any) {
      toast.error("Failed to complete trip: " + (error?.message || error));
    }
  }

  async function handleReject() {
    if (!selectedBooking) return;
    const ok = await confirm({ message: "Are you sure you want to REJECT this booking?", destructive: true });
    if (!ok) return;

    try {
      await apiClient.updateBookingStatus(selectedBooking.id, "CANCELLED");
      toast.success("Booking rejected.");
      setSelectedBookingId(null);
      refreshList();
    } catch (error: any) {
      toast.error(error?.message || "Failed to reject booking");
    }
  }

  async function handleDeleteBooking(bookingId: number) {
    const ok = await confirm({
      message: `Are you sure you want to permanently delete booking #${bookingId}? This action cannot be undone.`,
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;

    setIsDeleting(true);
    try {
      await apiClient.deleteBooking(bookingId);
      toast.success("Booking deleted successfully.");
      setSelectedBookingId(null);
      refreshList();
    } catch (error: any) {
      console.error("Failed to delete booking", error);
      toast.error(error?.message || "Failed to delete booking");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleConfirmDriverRequest(bookingId: number) {
    const ok = await confirm({ message: "Confirm this driver's request and assign them to the booking?" });
    if (!ok) return;
    try {
      await apiClient.confirmDriverRequest(bookingId);
      toast.success("Driver request confirmed — booking assigned.");
      refreshList();
    } catch (error: any) {
      toast.error(error?.message || "Failed to confirm driver request");
    }
  }

  async function handleRejectDriverRequest(bookingId: number) {
    const ok = await confirm({
      message: "Reject this driver's request? The booking will reopen to nearby drivers.",
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiClient.rejectDriverRequest(bookingId);
      toast.success("Driver request rejected — reopened to nearby drivers.");
      refreshList();
    } catch (error: any) {
      toast.error(error?.message || "Failed to reject driver request");
    }
  }

  async function handleGenerateInvoice(id: number) {
    const ok = await confirm({ message: "Generate invoice for this trip?" });
    if (!ok) return;
    try {
      await apiClient.generateTripInvoice(id);
      toast.success("Invoice generated successfully");
      refreshList();
    } catch (e: any) {
      toast.error("Failed to generate invoice: " + (e?.message || e));
    }
  }

  async function handleRecalculate(data: any, mode: "info" | "recalculate") {
    if (!selectedBooking) return;
    setIsRecalculating(true);
    try {
      if (mode === "info") {
        await apiClient.updateBookingInfo(selectedBooking.id, data);
        toast.success("Booking info updated. Invoice was not changed.");
      } else {
        const res: any = await apiClient.recalculateBooking(selectedBooking.id, data);
        const result = res?.data ?? res;
        toast.success(
          `Invoice regenerated! New Invoice #${result?.invoice_number ?? ""} — PKR ${Number(result?.invoice_amount ?? 0).toLocaleString()}`
        );
      }
      setShowRecalculateModal(false);
      refreshList();
    } catch (e: any) {
      toast.error("Failed: " + (e?.message || e));
    } finally {
      setIsRecalculating(false);
    }
  }

  const handleStatusChange = async (b: ChauffeurBooking, newStatus: string) => {
    if (newStatus === "ASSIGNED") {
      toast.error(
        "Cannot manually switch to ASSIGNED. Open the booking row and assign a vehicle and driver."
      );
      refreshList();
      return;
    }

    if (newStatus === "IN_PROGRESS") {
      const ok = await confirm({ message: "Start this trip? This will create a trip log." });
      if (!ok) return;
      try {
        await apiClient.startTrip(b.id);
        refreshList();
      } catch (e: any) {
        toast.error("Failed: " + (e?.message || e));
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
        toast.error("Trip must be ENDED before it can be COMPLETED. Set status to ENDED first.");
        refreshList();
        return;
      }
      const ok = await confirm({
        message: "Complete this trip? This will calculate financials and generate the invoice.",
      });
      if (!ok) return;
      try {
        await apiClient.completeTrip(b.id);
        refreshList();
      } catch (e: any) {
        toast.error("Failed: " + (e?.message || e));
      }
      return;
    }

    if (newStatus === "CANCELLED") {
      const ok = await confirm({
        message:
          "Cancel this booking? This only updates status and does not send a cancellation email to the customer.",
        destructive: true,
      });
      if (!ok) return;
      try {
        await apiClient.updateBookingStatus(b.id, newStatus);
        refreshList();
      } catch (e: any) {
        toast.error("Failed: " + (e?.message || e));
      }
      return;
    }

    const confirmMessage =
      newStatus === "ARRIVED"
        ? "Mark driver as ARRIVED at pickup location?"
        : `Change status to ${newStatus}?`;

    const ok = await confirm({ message: confirmMessage });
    if (!ok) return;
    try {
      await apiClient.updateBookingStatus(b.id, newStatus);
      refreshList();
    } catch (e: any) {
      toast.error("Failed: " + (e?.message || e));
    }
  };

  return {
    isApproving,
    isStartingTrip,
    isEndingTrip,
    isRecalculating,
    isDeleting,
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
    handleConfirmDriverRequest,
    handleRejectDriverRequest,
  };
}
