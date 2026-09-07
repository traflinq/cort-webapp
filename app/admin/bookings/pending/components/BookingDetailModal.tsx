"use client";

import { useMemo } from "react";
import { ChauffeurBooking } from "../../../../lib/services/api-client";
import { displayDriverEmail } from "../../../../lib/utils/driverEmailDisplay";
import { SearchableSelect } from "../../../../components/SearchableSelect";
import { Modal } from "../../../components/ui/Modal";
import { cx } from "../../../components/ui/cx";
import { formatDateTime } from "../utils/formatDateTime";
import { PaymentForm } from "./PaymentForm";
import { PaymentSummaryCard } from "./PaymentSummaryCard";
import { PaymentHistoryList } from "./PaymentHistoryList";

export type BookingDetailModalProps = {
  booking: ChauffeurBooking;
  onClose: () => void;
  canEditBookings: boolean;
  selectedCarId: string;
  setSelectedCarId: (v: string) => void;
  selectedDriverId: string;
  setSelectedDriverId: (v: string) => void;
  availableCars: any[];
  availableDrivers: any[];
  paymentHistory: any[];
  paymentSummary: any;
  loadPaymentData: (id: number) => void;
  isApproving: boolean;
  isStartingTrip: boolean;
  onApprove: () => void;
  onReject: () => void;
  onStartTrip: () => void;
  onCompleteTrip: () => void;
  onEndTripOpen: () => void;
  onDailyLogsOpen: () => void;
  onRecalculateOpen: () => void;
  /** Marketplace: approve the driver currently ACCEPTED (pending approval) for this booking. */
  onConfirmDriverRequest: (bookingId: number) => void;
  /** Marketplace: reject that driver's request — reopens the booking to broadcast. */
  onRejectDriverRequest: (bookingId: number) => void;
};

export function BookingDetailModal({
  booking,
  onClose,
  canEditBookings,
  selectedCarId,
  setSelectedCarId,
  selectedDriverId,
  setSelectedDriverId,
  availableCars,
  availableDrivers,
  paymentHistory,
  paymentSummary,
  onConfirmDriverRequest,
  onRejectDriverRequest,
  loadPaymentData,
  isApproving,
  isStartingTrip,
  onApprove,
  onReject,
  onStartTrip,
  onCompleteTrip,
  onEndTripOpen,
  onDailyLogsOpen,
  onRecalculateOpen,
}: BookingDetailModalProps) {
  const vehicleOptions = useMemo(
    () =>
      availableCars.map((car) => ({
        value: String(car.id),
        label: `${car.make} ${car.model} (${car.plate_number})`,
        searchText: `${car.make} ${car.model} ${car.plate_number}`,
      })),
    [availableCars]
  );

  return (

          <Modal
            isOpen
            onClose={onClose}
            title={`Booking Details #${booking.id}`}
          >
            <div className="flex flex-col gap-6">
              {/* Status Header */}
              <div className="flex items-center justify-between bg-surface p-4 rounded-lg border border-border">
                <div>
                  <div className="text-xs text-muted uppercase tracking-wider font-semibold">Current Status</div>
                  <div className={cx(
                    "mt-1 text-sm font-bold px-2 py-0.5 rounded-full inline-block",
                    booking.status === 'PENDING' ? "bg-yellow/10 text-yellow" :
                      booking.status === 'COMPLETED' ? "bg-green/10 text-green-600" :
                        booking.status === 'CANCELLED' ? "bg-red/10 text-red-600" :
                          "bg-blue/10 text-blue"
                  )}>
                    {booking.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted uppercase tracking-wider font-semibold">Scheduled For</div>
                  <div className="mt-1 text-sm font-medium text-ink">{formatDateTime(booking.scheduled_for)}</div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Trip & Vehicle Request */}
                <div>
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 border-b border-border pb-1">Trip Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-muted uppercase">Trip Type</div>
                      <div className="text-sm font-medium text-ink">{booking.trip_type.replace(/_/g, " ")}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted uppercase">Package</div>
                      <div className="text-sm font-medium text-ink">{booking.package_selected.replace(/_/g, " ")}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted uppercase">Requested Model</div>
                      <div className="text-sm font-medium text-ink">{booking.vehicle_model || "Any"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted uppercase">City</div>
                      <div className="text-sm font-medium text-ink">{booking.city || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted uppercase">Duration (Days)</div>
                      <div className="text-sm font-medium text-ink">{booking.no_of_days || 1}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[10px] text-muted uppercase">Pickup Address</div>
                      <div className="text-sm font-medium text-ink">{booking.pickup_address || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Passenger Info */}
                <div>
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 border-b border-border pb-1">Passenger & Company</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-muted uppercase">Passenger Name</div>
                      <div className="text-sm font-medium text-ink">{booking.users_chauffeur_bookings_passenger_idTousers?.full_name || "—"}</div>
                      {booking.users_chauffeur_bookings_passenger_idTousers?.email && (
                        <div className="text-xs text-muted">{booking.users_chauffeur_bookings_passenger_idTousers.email}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] text-muted uppercase">Company</div>
                      <div className="text-sm font-medium text-ink">{booking.companies?.name || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Assignment Details (if active) */}
                {booking.status !== 'PENDING' && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 border-b border-border pb-1">Assignment Details</h4>
                    <div className="grid grid-cols-2 gap-4 bg-surface/30 p-3 rounded-md">
                      <div>
                        <div className="text-[10px] text-muted uppercase">Assigned Driver</div>
                        <div className="text-sm font-medium text-ink mt-0.5">
                          {booking.users_chauffeur_bookings_driver_idTousers?.full_name || "—"}
                        </div>
                        {booking.users_chauffeur_bookings_driver_idTousers?.phone && (
                          <div className="text-xs text-muted">{booking.users_chauffeur_bookings_driver_idTousers.phone}</div>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] text-muted uppercase">Assigned Vehicle</div>
                        <div className="text-sm font-medium text-ink mt-0.5">
                          {booking.vehicles ? booking.vehicles.model : "—"}
                        </div>
                        {booking.vehicles && (
                          <div className="text-xs font-mono text-muted">{booking.vehicles.plate_number}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Marketplace Broadcast — which nearby drivers this was offered to */}
                {booking.fulfillment_type === 'CORT_MANAGED' &&
                  booking.chauffeur_booking_driver_responses &&
                  booking.chauffeur_booking_driver_responses.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 border-b border-border pb-1">
                        Marketplace Broadcast
                      </h4>
                      <div className="border border-border rounded-lg bg-white shadow-sm overflow-x-auto">
                        <table className="w-full min-w-[560px] text-left text-xs">
                          <thead className="bg-surface font-bold text-muted uppercase tracking-tight">
                            <tr>
                              <th className="px-3 py-2 border-b border-border whitespace-nowrap">Driver</th>
                              <th className="px-3 py-2 border-b border-border whitespace-nowrap">Distance</th>
                              <th className="px-3 py-2 border-b border-border whitespace-nowrap">Status</th>
                              <th className="px-3 py-2 border-b border-border whitespace-nowrap">Responded</th>
                              <th className="px-3 py-2 border-b border-border whitespace-nowrap">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {booking.chauffeur_booking_driver_responses.map((r) => (
                              <tr key={r.id} className="hover:bg-surface/50 transition-colors">
                                <td className="px-3 py-2">
                                  <div className="font-medium text-ink">{r.users.full_name}</div>
                                  {r.users.phone && (
                                    <div className="text-[10px] text-muted">{r.users.phone}</div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-muted">
                                  {r.distance_km != null ? `${Number(r.distance_km).toFixed(1)} km` : "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={cx(
                                      "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                                      r.status === 'ACCEPTED' ? "bg-green/10 text-green-600" :
                                        r.status === 'REJECTED' ? "bg-red/10 text-red-600" :
                                          r.status === 'EXPIRED' ? "bg-surface text-muted" :
                                            "bg-yellow/10 text-yellow"
                                    )}
                                  >
                                    {r.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-muted">
                                  {r.responded_at ? formatDateTime(r.responded_at) : "—"}
                                </td>
                                <td className="px-3 py-2">
                                  {/* Only the ACCEPTED row (at most one, enforced at the DB level)
                                      is awaiting an admin decision — while the booking is still PENDING. */}
                                  {r.status === 'ACCEPTED' && booking.status === 'PENDING' && canEditBookings && (
                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => onConfirmDriverRequest(booking.id)}
                                        className="h-7 px-2.5 rounded-md bg-green-600 text-white text-[11px] font-semibold hover:opacity-90"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onRejectDriverRequest(booking.id)}
                                        className="h-7 px-2.5 rounded-md border border-danger/30 text-danger text-[11px] font-semibold hover:bg-danger/5"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Daily Breakdown (Transparency) */}
                {booking.chauffeur_trip_daily_logs && booking.chauffeur_trip_daily_logs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 border-b border-border pb-1">Trip Breakdown</h4>
                    <div className="border border-border rounded-lg overflow-hidden bg-white shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface font-bold text-muted uppercase tracking-tight">
                          <tr>
                            <th className="px-3 py-2 border-b border-border">Date</th>
                            <th className="px-3 py-2 border-b border-border">Type</th>
                            <th className="px-3 py-2 border-b border-border text-center">Hours</th>
                            <th className="px-3 py-2 border-b border-border text-center">Full Day</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {[...booking.chauffeur_trip_daily_logs].sort((a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime()).map((log) => (
                            <tr key={log.id} className="hover:bg-surface/50 transition-colors">
                              <td className="px-3 py-2 font-medium text-ink">
                                {new Date(log.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                              </td>
                              <td className="px-3 py-2 text-muted">
                                {log.trip_type === 'OUT_STATION' ? (
                                  <span className="text-orange font-semibold">Outstation</span>
                                ) : (
                                  <span className="text-blue/80">In City</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center font-mono text-ink">
                                {log.hours_used ? parseFloat(log.hours_used.toString()).toFixed(1) : (log.is_full_day ? "24.0" : "0.0")}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {log.is_full_day ? (
                                  <span className="text-green-600 text-[10px] font-bold">YES</span>
                                ) : (
                                  <span className="text-muted text-[10px]">NO</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Trip Images (Meter readings, Parking, Tolls) */}
                {booking.chauffeur_trip_logs && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 border-b border-border pb-1">Trip Evidence / Images</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {booking.chauffeur_trip_logs.meter_reading_start_image_url && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted uppercase font-semibold">Start Meter</span>
                          <a 
                            href={booking.chauffeur_trip_logs.meter_reading_start_image_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="block aspect-square rounded-lg overflow-hidden border border-border bg-surface hover:ring-2 hover:ring-blue/30 transition-all shadow-sm"
                          >
                            <img 
                              src={booking.chauffeur_trip_logs.meter_reading_start_image_url} 
                              alt="Start Meter" 
                              className="w-full h-full object-cover" 
                            />
                          </a>
                        </div>
                      )}
                      {booking.chauffeur_trip_logs.meter_reading_end_image_url && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted uppercase font-semibold">End Meter</span>
                          <a 
                            href={booking.chauffeur_trip_logs.meter_reading_end_image_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="block aspect-square rounded-lg overflow-hidden border border-border bg-surface hover:ring-2 hover:ring-blue/30 transition-all shadow-sm"
                          >
                            <img 
                              src={booking.chauffeur_trip_logs.meter_reading_end_image_url} 
                              alt="End Meter" 
                              className="w-full h-full object-cover" 
                            />
                          </a>
                        </div>
                      )}
                      {booking.chauffeur_trip_logs.expense_parking_image_url && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted uppercase font-semibold">Parking</span>
                          <a 
                            href={booking.chauffeur_trip_logs.expense_parking_image_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="block aspect-square rounded-lg overflow-hidden border border-border bg-surface hover:ring-2 hover:ring-blue/30 transition-all shadow-sm"
                          >
                            <img 
                              src={booking.chauffeur_trip_logs.expense_parking_image_url} 
                              alt="Parking Receipt" 
                              className="w-full h-full object-cover" 
                            />
                          </a>
                        </div>
                      )}
                      {booking.chauffeur_trip_logs.expense_toll_image_url && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted uppercase font-semibold">Toll</span>
                          <a 
                            href={booking.chauffeur_trip_logs.expense_toll_image_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="block aspect-square rounded-lg overflow-hidden border border-border bg-surface hover:ring-2 hover:ring-blue/30 transition-all shadow-sm"
                          >
                            <img 
                              src={booking.chauffeur_trip_logs.expense_toll_image_url} 
                              alt="Toll Receipt" 
                              className="w-full h-full object-cover" 
                            />
                          </a>
                        </div>
                      )}
                    </div>
                    {!(booking.chauffeur_trip_logs.meter_reading_start_image_url || 
                       booking.chauffeur_trip_logs.meter_reading_end_image_url || 
                       booking.chauffeur_trip_logs.expense_parking_image_url || 
                       booking.chauffeur_trip_logs.expense_toll_image_url) && (
                      <div className="text-xs text-muted italic">No images uploaded for this trip yet.</div>
                    )}
                  </div>
                )}
              </div>

              {(booking.status === 'PENDING' || booking.status === 'ASSIGNED' || booking.status === 'ARRIVED') && (
                <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                  <div className="text-xs font-semibold tracking-wider text-muted">
                    {booking.status === 'PENDING' ? 'ASSIGN DRIVER & VEHICLE' : 'EDIT VEHICLE & DRIVER'}
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-ink">Select Vehicle</span>
                      <SearchableSelect
                        value={selectedCarId}
                        onChange={setSelectedCarId}
                        options={vehicleOptions}
                        placeholder="Search by plate, make, or model..."
                        emptyMessage="No vehicles match your search."
                        disabled={availableCars.length === 0}
                      />
                      {availableCars.length === 0 && (
                        <div className="mt-1 text-xs text-muted">No available vehicles found.</div>
                      )}
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-ink">Select Driver</span>
                      <select
                        value={selectedDriverId}
                        onChange={(e) => setSelectedDriverId(e.target.value)}
                        className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue/40"
                      >
                        <option value="">Select a driver</option>
                        {availableDrivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.full_name} ({displayDriverEmail(driver.email)})
                          </option>
                        ))}
                      </select>
                      {availableDrivers.length === 0 && (
                        <div className="mt-1 text-xs text-muted">No available drivers found.</div>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {booking.status === 'PENDING' && (
                <div className="flex items-center gap-3 justify-end pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={canEditBookings ? onReject : undefined}
                    disabled={!canEditBookings}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-danger/30 bg-white px-4 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={canEditBookings ? onApprove : undefined}
                    disabled={!canEditBookings || !selectedCarId || !selectedDriverId || isApproving}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-orange px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 gap-2"
                  >
                    {isApproving && (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isApproving ? "Approving..." : "Approve & Assign"}
                  </button>
                </div>
              )}

              {(booking.status === 'ASSIGNED' || booking.status === 'ARRIVED') && (
                <div className="flex items-center justify-end pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={canEditBookings ? onApprove : undefined}
                    disabled={!canEditBookings || !selectedCarId || !selectedDriverId || isApproving}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-orange px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 gap-2"
                  >
                    {isApproving && (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isApproving ? "Updating..." : "Update Assignment"}
                  </button>
                </div>
              )}


              {/* Payment Tracking Section - Only show for active/completed trips */}
              {booking.status !== 'PENDING' && booking.status !== 'CANCELLED' && (
                <div className="space-y-4 mt-6">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider border-b border-border pb-1">
                    Payment Tracking
                  </h4>

                  {booking.status === 'COMPLETED' && paymentSummary && (
                    <PaymentSummaryCard summary={paymentSummary} />
                  )}

                  {(booking.status === 'IN_PROGRESS' ||
                    booking.status === 'ENDED' ||
                    booking.status === 'COMPLETED') &&
                    paymentSummary?.payment_status !== 'FULLY_PAID' &&
                    canEditBookings && (
                      <PaymentForm
                        bookingId={booking.id}
                        onSuccess={() => loadPaymentData(booking.id)}
                      />
                    )}

                  {paymentHistory.length > 0 && (
                    <PaymentHistoryList payments={paymentHistory} />
                  )}
                </div>
              )}

              {(booking.status === 'ASSIGNED' || booking.status === 'ARRIVED') && (
                <div className="flex items-center gap-3 justify-end pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={canEditBookings ? onStartTrip : undefined}
                    disabled={!canEditBookings || isStartingTrip}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-blue px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 gap-2"
                  >
                    {isStartingTrip && (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isStartingTrip ? "Starting..." : "Start Trip"}
                  </button>
                </div>
              )}

              {booking.status === 'IN_PROGRESS' && (
                <div className="flex items-center gap-3 justify-end pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={canEditBookings ? onEndTripOpen : undefined}
                    disabled={!canEditBookings}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-navy px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                  >
                    End Trip
                  </button>
                  <button
                    type="button"
                    onClick={canEditBookings ? onDailyLogsOpen : undefined}
                    disabled={!canEditBookings}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-blue/10 text-blue px-4 text-sm font-semibold hover:bg-blue/20 disabled:opacity-50"
                  >
                    Manage Daily Logs
                  </button>
                </div>
              )}

              {booking.status === 'ENDED' && (
                <div className="flex items-center gap-3 justify-end pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={canEditBookings ? onCompleteTrip : undefined}
                    disabled={!canEditBookings}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-green-600 px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                  >
                    Complete Trip (Generate Invoice)
                  </button>
                </div>
              )}

              {booking.status === 'COMPLETED' && (
                <div className="flex items-center gap-3 justify-end pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={canEditBookings ? onRecalculateOpen : undefined}
                    disabled={!canEditBookings}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-orange/40 bg-orange/10 px-4 text-sm font-semibold text-orange hover:bg-orange/20 disabled:opacity-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Override &amp; Recalculate Invoice
                  </button>
                </div>
              )}
            </div>
          </Modal>
  );
}
