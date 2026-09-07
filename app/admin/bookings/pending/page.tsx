"use client";

import { useState } from "react";
import { useAuth } from "../../../lib/contexts/auth-context";
import { AdminProtectedPage } from "../../components/AdminProtectedPage";
import { ADMIN_SUBJECTS } from "../../../lib/abilities/admin-subjects";
import { EndTripModal } from "./components/EndTripModal";
import { DailyLogsModal } from "./components/DailyLogsModal";
import { RecalculateModal } from "./components/RecalculateModal";
import { BookingStatsBar } from "./components/BookingStatsBar";
import { BookingFiltersBar } from "./components/BookingFiltersBar";
import { BookingList } from "./components/BookingList";
import { BookingDetailModal } from "./components/BookingDetailModal";
import { usePendingBookings } from "./hooks/usePendingBookings";
import { useBookingActions } from "./hooks/useBookingActions";

export default function BookingsPage() {
  return (
    <AdminProtectedPage permission="bookings" subject={ADMIN_SUBJECTS.bookings}>
      <BookingsPageContent />
    </AdminProtectedPage>
  );
}

function BookingsPageContent() {
  const { hasCrud } = useAuth();
  const canEditBookings =
    hasCrud("bookings", "create") ||
    hasCrud("bookings", "update") ||
    hasCrud("bookings", "delete");

  const bookingsState = usePendingBookings();
  const [showEndTripModal, setShowEndTripModal] = useState(false);
  const [showDailyLogsModal, setShowDailyLogsModal] = useState(false);
  const [showRecalculateModal, setShowRecalculateModal] = useState(false);

  const actions = useBookingActions({
    selectedBooking: bookingsState.selectedBooking,
    selectedCarId: bookingsState.selectedCarId,
    selectedDriverId: bookingsState.selectedDriverId,
    setSelectedBookingId: bookingsState.setSelectedBookingId,
    setSelectedCarId: bookingsState.setSelectedCarId,
    setSelectedDriverId: bookingsState.setSelectedDriverId,
    refreshList: bookingsState.refreshList,
    setShowEndTripModal,
    setShowDailyLogsModal,
    setShowRecalculateModal,
  });

  return (
    <div className="flex flex-col gap-6">
      <EndTripModal
        isOpen={showEndTripModal}
        onClose={() => setShowEndTripModal(false)}
        onSubmit={actions.handleEndTrip}
        booking={bookingsState.selectedBooking}
        loading={actions.isEndingTrip}
      />
      <DailyLogsModal
        isOpen={showDailyLogsModal}
        onClose={() => setShowDailyLogsModal(false)}
        onSubmit={actions.handleUpdateDailyLogs}
        booking={bookingsState.selectedBooking}
      />
      <RecalculateModal
        isOpen={showRecalculateModal}
        onClose={() => setShowRecalculateModal(false)}
        onSubmit={actions.handleRecalculate}
        booking={bookingsState.selectedBooking}
        loading={actions.isRecalculating}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-muted">Bookings Management</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy">All Bookings</h1>
        </div>
      </div>

      {bookingsState.stats && (
        <BookingStatsBar
          stats={bookingsState.stats}
          onFilterByStatus={(status) => bookingsState.setStatusFilter(status)}
        />
      )}

      <BookingFiltersBar
        searchQuery={bookingsState.searchQuery}
        onSearchChange={bookingsState.setSearchQuery}
        statusFilter={bookingsState.statusFilter}
        onStatusChange={bookingsState.setStatusFilter}
        companyFilter={bookingsState.companyFilter}
        onCompanyChange={bookingsState.setCompanyFilter}
        startDate={bookingsState.startDate}
        onStartDateChange={bookingsState.setStartDate}
        endDate={bookingsState.endDate}
        onEndDateChange={bookingsState.setEndDate}
        companies={bookingsState.companies}
      />

      <div className="flex flex-col gap-6">
        <BookingList
          bookings={bookingsState.bookings}
          isLoading={bookingsState.isLoading}
          selectedBookingId={bookingsState.selectedBookingId}
          currentPage={bookingsState.currentPage}
          totalPages={bookingsState.pagination.pages}
          canEditBookings={canEditBookings}
          isDeleting={actions.isDeleting}
          onSelectBooking={bookingsState.onOpenBookingModal}
          onPageChange={bookingsState.setCurrentPage}
          onStatusChange={actions.handleStatusChange}
          onDeleteBooking={actions.handleDeleteBooking}
          onGenerateInvoice={actions.handleGenerateInvoice}
        />

        {bookingsState.selectedBooking && (
          <BookingDetailModal
            booking={bookingsState.selectedBooking}
            onClose={bookingsState.closeBookingModal}
            canEditBookings={canEditBookings}
            selectedCarId={bookingsState.selectedCarId}
            setSelectedCarId={bookingsState.setSelectedCarId}
            selectedDriverId={bookingsState.selectedDriverId}
            setSelectedDriverId={bookingsState.setSelectedDriverId}
            availableCars={bookingsState.availableCars}
            availableDrivers={bookingsState.availableDrivers}
            paymentHistory={bookingsState.paymentHistory}
            paymentSummary={bookingsState.paymentSummary}
            loadPaymentData={bookingsState.loadPaymentData}
            isApproving={actions.isApproving}
            isStartingTrip={actions.isStartingTrip}
            onApprove={actions.handleApprove}
            onReject={actions.handleReject}
            onStartTrip={actions.handleStartTrip}
            onCompleteTrip={actions.handleCompleteTrip}
            onEndTripOpen={() => setShowEndTripModal(true)}
            onDailyLogsOpen={() => setShowDailyLogsModal(true)}
            onRecalculateOpen={() => setShowRecalculateModal(true)}
            onConfirmDriverRequest={actions.handleConfirmDriverRequest}
            onRejectDriverRequest={actions.handleRejectDriverRequest}
          />
        )}
      </div>
    </div>
  );
}
