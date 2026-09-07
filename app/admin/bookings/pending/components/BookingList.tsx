"use client";

import { ChauffeurBooking } from "../../../../lib/services/api-client";
import Pagination from "../../../../components/ui/Pagination";
import { cx } from "../../../components/ui/cx";
import { formatDateTime } from "../utils/formatDateTime";
import { Trash2 } from "lucide-react";

type BookingListProps = {
  bookings: ChauffeurBooking[];
  isLoading: boolean;
  selectedBookingId: number | null;
  currentPage: number;
  totalPages: number;
  canEditBookings: boolean;
  isDeleting: boolean;
  onSelectBooking: (booking: ChauffeurBooking) => void;
  onPageChange: (page: number) => void;
  onStatusChange: (booking: ChauffeurBooking, status: string) => void;
  onDeleteBooking: (id: number) => void;
  onGenerateInvoice: (id: number) => void;
};

export function BookingList({
  bookings,
  isLoading,
  selectedBookingId,
  currentPage,
  totalPages,
  canEditBookings,
  isDeleting,
  onSelectBooking,
  onPageChange,
  onStatusChange,
  onDeleteBooking,
  onGenerateInvoice,
}: BookingListProps) {
  return (
    <section className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border bg-surface/30">
        <div className="text-sm font-semibold text-navy">Booking List</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface text-xs font-semibold tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 text-left">Company</th>
              <th className="px-4 py-3 text-left">Passenger</th>
              <th className="px-4 py-3 text-left">Request</th>
              <th className="px-4 py-3 text-left">City</th>
              <th className="px-4 py-3 text-left">Pickup Address</th>
              <th className="px-4 py-3 text-left">Assigned Driver</th>
              <th className="px-4 py-3 text-left">Assigned Vehicle</th>
              <th className="px-4 py-3 text-left">Scheduled At</th>
              <th className="px-4 py-3 text-center">Days</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && bookings.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : (
              bookings.map((b) => {
                const isSelected = selectedBookingId === b.id;
                const driver = b.users_chauffeur_bookings_driver_idTousers;
                const vehicle = b.vehicles;

                return (
                  <tr
                    key={b.id}
                    onClick={() => onSelectBooking(b)}
                    className={cx(
                      "cursor-pointer transition-colors group",
                      isSelected ? "bg-blue/5" : "hover:bg-surface"
                    )}
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold text-ink group-hover:text-blue transition-colors">
                        {b.companies?.name || "Unknown Company"}
                      </div>
                      <div className="text-[10px] text-muted font-mono">{b.id}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-ink">
                        {b.users_chauffeur_bookings_passenger_idTousers?.full_name || "Unknown Passenger"}
                      </div>
                      <div className="text-[11px] text-muted">
                        {b.users_chauffeur_bookings_passenger_idTousers?.email}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-ink font-medium">{b.vehicle_model || "Any Model"}</div>
                      <div className="text-[11px] text-muted">{b.package_selected.replace(/_/g, " ")}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-ink">{b.city || "—"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div
                        className="max-w-[150px] truncate text-sm text-ink"
                        title={b.pickup_address || "No address"}
                      >
                        {b.pickup_address || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {driver ? (
                        <div>
                          <div className="text-sm font-medium text-ink">{driver.full_name}</div>
                          {driver.phone && (
                            <div className="text-[11px] text-muted mt-0.5">{driver.phone}</div>
                          )}
                        </div>
                      ) : (() => {
                        if (b.status !== "PENDING") {
                          return <span className="text-muted text-xs italic">—</span>;
                        }
                        const responses = b.chauffeur_booking_driver_responses ?? [];
                        // At most one ACCEPTED row exists at a time (DB-enforced) — a driver
                        // requested it and is waiting on an admin decision. Surface that above
                        // the plain "still broadcasting" state since it needs action.
                        const requestedBy = responses.find((r) => r.status === "ACCEPTED");
                        if (requestedBy) {
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-600/10 px-2 py-0.5 rounded-full">
                              {requestedBy.users.full_name} requested — needs approval
                            </span>
                          );
                        }
                        const nearbyPending = responses.filter((r) => r.status === "PENDING").length;
                        return nearbyPending > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange bg-orange/10 px-2 py-0.5 rounded-full">
                            Broadcasting · {nearbyPending} nearby
                          </span>
                        ) : (
                          <span className="text-muted text-xs italic">—</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      {vehicle ? (
                        <div>
                          <div className="text-sm font-medium text-ink">{vehicle.model}</div>
                          <div className="text-[11px] text-muted font-mono mt-0.5">{vehicle.plate_number}</div>
                        </div>
                      ) : (
                        <span className="text-muted text-xs italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-muted">{formatDateTime(b.scheduled_for)}</td>
                    <td className="px-4 py-4 text-center font-medium text-ink">{b.no_of_days || 1}</td>
                    <td className="px-4 py-4 text-center">
                      <div onClick={(e) => e.stopPropagation()}>
                        <select
                          value={
                            b.status === "DROPPED_OFF"
                              ? "IN_PROGRESS"
                              : b.status === "OTW"
                                ? "ASSIGNED"
                                : b.status
                          }
                          onChange={(e) => {
                            if (!canEditBookings) return;
                            onStatusChange(b, e.target.value);
                          }}
                          disabled={!canEditBookings}
                          className={cx(
                            "h-7 rounded-full px-2 text-[11px] font-semibold border-none outline-none cursor-pointer appearance-none text-center min-w-[100px]",
                            b.status === "PENDING"
                              ? "bg-yellow/10 text-yellow"
                              : b.status === "COMPLETED"
                                ? "bg-green/10 text-green-600"
                                : b.status === "CANCELLED"
                                  ? "bg-red/10 text-red-600"
                                  : "bg-blue/10 text-blue"
                          )}
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="ASSIGNED">ASSIGNED</option>
                          <option value="ARRIVED">ARRIVED</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="ENDED">ENDED</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      </div>

                      {canEditBookings && (
                        <div className="mt-2 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            aria-label={`Delete booking #${b.id}`}
                            title={`Delete booking #${b.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteBooking(b.id);
                            }}
                            disabled={isDeleting}
                            className="text-danger hover:text-danger/80 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {b.status === "COMPLETED" && !b.invoices && (
                        <div className="mt-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => canEditBookings && onGenerateInvoice(b.id)}
                            disabled={!canEditBookings}
                            className="text-[10px] bg-navy text-white px-2 py-1 rounded hover:opacity-90 disabled:opacity-50"
                          >
                            Generate Invoice
                          </button>
                        </div>
                      )}
                      {b.invoices && (
                        <div className="mt-2 text-center text-[10px] text-green-600 font-medium">
                          Invoiced #{b.invoices.invoice_number}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!isLoading && bookings.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-sm text-muted">No bookings found matching criteria.</div>
          </div>
        ) : null}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
    </section>
  );
}
