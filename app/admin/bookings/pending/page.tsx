"use client";

import { useState } from "react";
import { useAuth } from "../../../lib/contexts/auth-context";
import { AdminProtectedPage } from "../../components/AdminProtectedPage";
import { ADMIN_SUBJECTS } from "../../../lib/abilities/admin-subjects";
import { Card, CardContent, PageHeader } from "../../ui";
import { EndTripModal } from "./components/EndTripModal";
import { DailyLogsModal } from "./components/DailyLogsModal";
import { RecalculateModal } from "./components/RecalculateModal";
import { BookingStatsBar } from "./components/BookingStatsBar";
import { BookingFiltersBar } from "./components/BookingFiltersBar";
import { BookingList } from "./components/BookingList";
import { BookingDetailDrawer } from "./components/BookingDetailDrawer";
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
  const canEditBookings = hasCrud("bookings", "create") || hasCrud("bookings", "update") || hasCrud("bookings", "delete");

  const state = usePendingBookings();
  const [showEndTripModal, setShowEndTripModal] = useState(false);
  const [showDailyLogsModal, setShowDailyLogsModal] = useState(false);
  const [showRecalculateModal, setShowRecalculateModal] = useState(false);

  const actions = useBookingActions({
    selectedBooking: state.selectedBooking,
    selectedCarId: state.selectedCarId,
    selectedDriverId: state.selectedDriverId,
    setSelectedBookingId: state.setSelectedBookingId,
    setSelectedCarId: state.setSelectedCarId,
    setSelectedDriverId: state.setSelectedDriverId,
    refreshList: state.refreshList,
    setShowEndTripModal,
    setShowDailyLogsModal,
    setShowRecalculateModal,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="Chauffeur bookings across all companies: assign, track and invoice." />

      <BookingStatsBar stats={state.stats} loading={state.statsLoading} activeStatus={state.statusFilter} onFilterByStatus={state.setStatusFilter} />

      <Card>
        <CardContent className="border-b border-line py-3">
          <BookingFiltersBar
            searchQuery={state.searchQuery}
            onSearchChange={state.setSearchQuery}
            statusFilter={state.statusFilter}
            onStatusChange={state.setStatusFilter}
            companyFilter={state.companyFilter}
            onCompanyChange={state.setCompanyFilter}
            dateRange={state.dateRange}
            onDateRangeChange={state.setDateRange}
            companies={state.companies}
            activeCount={state.activeFilterCount}
            onClear={state.clearFilters}
          />
        </CardContent>
        <BookingList
          bookings={state.bookings}
          isLoading={state.isLoading}
          error={state.listError}
          onRetry={state.refreshList}
          selectedBookingId={state.selectedBookingId}
          currentPage={state.currentPage}
          totalPages={state.pagination.pages}
          total={state.pagination.total}
          canEditBookings={canEditBookings}
          isDeleting={actions.isDeleting}
          hasFilters={state.activeFilterCount > 0}
          onClearFilters={state.clearFilters}
          onSelectBooking={state.onOpenBookingModal}
          onPageChange={state.setCurrentPage}
          onStatusChange={actions.handleStatusChange}
          onDeleteBooking={actions.handleDeleteBooking}
          onGenerateInvoice={actions.handleGenerateInvoice}
        />
      </Card>

      <BookingDetailDrawer
        booking={state.selectedBooking}
        onClose={state.closeBookingModal}
        canEditBookings={canEditBookings}
        selectedCarId={state.selectedCarId}
        setSelectedCarId={state.setSelectedCarId}
        selectedDriverId={state.selectedDriverId}
        setSelectedDriverId={state.setSelectedDriverId}
        availableCars={state.availableCars}
        availableDrivers={state.availableDrivers}
        resourcesLoading={state.resourcesLoading}
        paymentHistory={state.paymentHistory}
        paymentSummary={state.paymentSummary}
        loadPaymentData={state.loadPaymentData}
        isApproving={actions.isApproving}
        isStartingTrip={actions.isStartingTrip}
        isCompleting={actions.isCompleting}
        onApprove={actions.handleApprove}
        onReject={actions.handleReject}
        onStartTrip={actions.handleStartTrip}
        onCompleteTrip={actions.handleCompleteTrip}
        onEndTripOpen={() => setShowEndTripModal(true)}
        onDailyLogsOpen={() => setShowDailyLogsModal(true)}
        onRecalculateOpen={() => setShowRecalculateModal(true)}
      />

      <EndTripModal isOpen={showEndTripModal} onClose={() => setShowEndTripModal(false)} onSubmit={actions.handleEndTrip} booking={state.selectedBooking} loading={actions.isEndingTrip} />
      <DailyLogsModal isOpen={showDailyLogsModal} onClose={() => setShowDailyLogsModal(false)} onSubmit={actions.handleUpdateDailyLogs} booking={state.selectedBooking} />
      <RecalculateModal isOpen={showRecalculateModal} onClose={() => setShowRecalculateModal(false)} onSubmit={actions.handleRecalculate} booking={state.selectedBooking} loading={actions.isRecalculating} />
    </div>
  );
}
