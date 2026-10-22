"use client";

import { useMemo } from "react";
import { ClipboardList, Flag, Pencil, Play, Square } from "lucide-react";
import { ChauffeurBooking, type PaymentSummary, type PaymentTransaction } from "../../../../lib/services/api-client";
import { displayDriverEmail } from "../../../../lib/utils/driverEmailDisplay";
import { SearchableSelect } from "../../../../components/SearchableSelect";
import { Badge, Button, Drawer, DrawerContent, FormGrid, Label, Spinner, StatusBadge } from "../../../ui";
import { formatDate, formatDateTime, humanize } from "../../../lib/format";
import { BOOKING_STATUS_OVERRIDES } from "./booking-status";
import { PaymentForm } from "./PaymentForm";
import { PaymentSummaryCard } from "./PaymentSummaryCard";
import { PaymentHistoryList } from "./PaymentHistoryList";
import type { AssignableDriver, AssignableVehicle } from "../hooks/usePendingBookings";

export type BookingDetailDrawerProps = {
  booking: ChauffeurBooking | null;
  onClose: () => void;
  canEditBookings: boolean;
  selectedCarId: string;
  setSelectedCarId: (v: string) => void;
  selectedDriverId: string;
  setSelectedDriverId: (v: string) => void;
  availableCars: AssignableVehicle[];
  availableDrivers: AssignableDriver[];
  resourcesLoading: boolean;
  paymentHistory: unknown[];
  paymentSummary: unknown;
  loadPaymentData: (id: number) => void;
  isApproving: boolean;
  isStartingTrip: boolean;
  isCompleting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onStartTrip: () => void;
  onCompleteTrip: () => void;
  onEndTripOpen: () => void;
  onDailyLogsOpen: () => void;
  onRecalculateOpen: () => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{title}</h3>
      {children}
    </section>
  );
}

function Item({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children}</dd>
    </div>
  );
}

const EVIDENCE: { key: "meter_reading_start_image_url" | "meter_reading_end_image_url" | "expense_parking_image_url" | "expense_toll_image_url"; label: string }[] = [
  { key: "meter_reading_start_image_url", label: "Start meter" },
  { key: "meter_reading_end_image_url", label: "End meter" },
  { key: "expense_parking_image_url", label: "Parking receipt" },
  { key: "expense_toll_image_url", label: "Toll receipt" },
];

/** Booking detail as a right-hand drawer; actions depend on the lifecycle status. */
export function BookingDetailDrawer({
  booking,
  onClose,
  canEditBookings,
  selectedCarId,
  setSelectedCarId,
  selectedDriverId,
  setSelectedDriverId,
  availableCars,
  availableDrivers,
  resourcesLoading,
  paymentHistory,
  paymentSummary,
  loadPaymentData,
  isApproving,
  isStartingTrip,
  isCompleting,
  onApprove,
  onReject,
  onStartTrip,
  onCompleteTrip,
  onEndTripOpen,
  onDailyLogsOpen,
  onRecalculateOpen,
}: BookingDetailDrawerProps) {
  const driverOptions = useMemo(
    () =>
      availableDrivers.map((driver) => ({
        value: driver.id,
        label: `${driver.full_name} (${displayDriverEmail(driver.email)})${driver.drivers_profile?.driver_type ? ` · ${humanize(driver.drivers_profile.driver_type)}` : ""}`,
        searchText: `${driver.full_name} ${driver.email}`,
      })),
    [availableDrivers],
  );
  const vehicleOptions = useMemo(
    () =>
      availableCars.map((car) => ({
        value: String(car.id),
        label: `${car.make} ${car.model} (${car.plate_number})`,
        searchText: `${car.make} ${car.model} ${car.plate_number}`,
      })),
    [availableCars],
  );

  const status = booking?.status;
  const canAssign = status === "PENDING" || status === "ASSIGNED" || status === "ARRIVED";
  const summary = paymentSummary as PaymentSummary | null;
  const logs = booking?.chauffeur_trip_logs;
  const evidence = logs ? EVIDENCE.filter((e) => logs[e.key]) : [];

  const footer = booking && (
    <>
      {status === "PENDING" && (
        <Button variant="danger-outline" onClick={onReject} disabled={!canEditBookings}>
          Reject
        </Button>
      )}
      {canAssign && (
        <Button onClick={onApprove} loading={isApproving} disabled={!canEditBookings || !selectedCarId || !selectedDriverId}>
          {status === "PENDING" ? "Approve & assign" : "Update assignment"}
        </Button>
      )}
      {(status === "ASSIGNED" || status === "ARRIVED") && (
        <Button variant="secondary" onClick={onStartTrip} loading={isStartingTrip} disabled={!canEditBookings} leftIcon={<Play />}>
          Start trip
        </Button>
      )}
      {status === "IN_PROGRESS" && (
        <>
          <Button variant="outline" onClick={onDailyLogsOpen} disabled={!canEditBookings} leftIcon={<ClipboardList />}>
            Daily logs
          </Button>
          <Button onClick={onEndTripOpen} disabled={!canEditBookings} leftIcon={<Square />}>
            End trip
          </Button>
        </>
      )}
      {status === "ENDED" && (
        <Button onClick={onCompleteTrip} loading={isCompleting} disabled={!canEditBookings} leftIcon={<Flag />}>
          Complete trip & generate invoice
        </Button>
      )}
      {status === "COMPLETED" && (
        <Button variant="outline" onClick={onRecalculateOpen} disabled={!canEditBookings} leftIcon={<Pencil />}>
          Override & recalculate invoice
        </Button>
      )}
    </>
  );

  return (
    <Drawer open={!!booking} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        size="xl"
        title={booking ? `Booking #${booking.id}` : "Booking"}
        description={booking ? `Scheduled ${formatDateTime(booking.scheduled_for)}` : undefined}
        headerExtra={
          booking && (
            <>
              <StatusBadge status={booking.status} overrides={BOOKING_STATUS_OVERRIDES} />
              {booking.companies?.name && <Badge tone="info">{booking.companies.name}</Badge>}
              {booking.is_special_request && <Badge tone="brand">Special request</Badge>}
            </>
          )
        }
        footer={footer}
      >
        {booking && (
          <div className="space-y-8">
            <Section title="Trip details">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Item label="Trip type">{humanize(booking.trip_type)}</Item>
                <Item label="Package">{humanize(booking.package_selected)}</Item>
                <Item label="Requested model">
                  {booking.vehicle_model || "Any"}
                  {booking.is_special_request && <span className="ml-2 text-xs text-brand-ink">Not from the contract list</span>}
                </Item>
                <Item label="City">{booking.city || "—"}</Item>
                <Item label="Duration">{booking.no_of_days || 1} day(s)</Item>
                <Item label="Pickup address" span>
                  {booking.pickup_address || "—"}
                </Item>
              </dl>
            </Section>

            <Section title="Passenger & company">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Item label="Passenger">
                  {booking.users_chauffeur_bookings_passenger_idTousers?.full_name || "—"}
                  {booking.users_chauffeur_bookings_passenger_idTousers?.email && (
                    <span className="block text-xs text-fg-muted">{booking.users_chauffeur_bookings_passenger_idTousers.email}</span>
                  )}
                </Item>
                <Item label="Company">{booking.companies?.name || "—"}</Item>
              </dl>
            </Section>

            {status !== "PENDING" && (
              <Section title="Assignment">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg bg-subtle p-3 sm:grid-cols-2">
                  <Item label="Driver">
                    {booking.users_chauffeur_bookings_driver_idTousers?.full_name || "—"}
                    {booking.users_chauffeur_bookings_driver_idTousers?.phone && (
                      <span className="block font-mono text-xs text-fg-muted">{booking.users_chauffeur_bookings_driver_idTousers.phone}</span>
                    )}
                  </Item>
                  <Item label="Vehicle">
                    {booking.vehicles?.model || "—"}
                    {booking.vehicles && <span className="block font-mono text-xs text-fg-muted">{booking.vehicles.plate_number}</span>}
                  </Item>
                </dl>
              </Section>
            )}

            {booking.chauffeur_trip_daily_logs && booking.chauffeur_trip_daily_logs.length > 0 && (
              <Section title="Trip breakdown">
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-xs">
                    <thead className="bg-subtle text-left text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                      <tr>
                        <th scope="col" className="px-3 py-2">
                          Date
                        </th>
                        <th scope="col" className="px-3 py-2">
                          Type
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          Hours
                        </th>
                        <th scope="col" className="px-3 py-2 text-center">
                          Full day
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {[...booking.chauffeur_trip_daily_logs]
                        .sort((a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime())
                        .map((log) => (
                          <tr key={log.id}>
                            <td className="px-3 py-2 text-fg">{formatDate(log.log_date)}</td>
                            <td className="px-3 py-2">
                              <StatusBadge
                                status={log.trip_type}
                                size="sm"
                                dot={false}
                                overrides={{ OUT_STATION: { tone: "brand", label: "Outstation" }, IN_CITY: { tone: "info", label: "In city" } }}
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-fg">
                              {log.hours_used ? parseFloat(log.hours_used.toString()).toFixed(1) : log.is_full_day ? "24.0" : "0.0"}
                            </td>
                            <td className="px-3 py-2 text-center text-fg-secondary">{log.is_full_day ? "Yes" : "No"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {logs && (
              <Section title="Trip evidence">
                {evidence.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {evidence.map((e) => (
                      <a
                        key={e.key}
                        href={logs[e.key] as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block overflow-hidden rounded-lg border border-line bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logs[e.key] as string} alt={e.label} className="aspect-square w-full object-cover transition-opacity group-hover:opacity-90" />
                        <span className="block px-2 py-1 text-[11px] text-fg-muted">{e.label}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-fg-muted">No images uploaded for this trip yet.</p>
                )}
              </Section>
            )}

            {canAssign && (
              <Section title={status === "PENDING" ? "Assign driver & vehicle" : "Edit vehicle & driver"}>
                {resourcesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-fg-muted">
                    <Spinner size="sm" label="Loading available vehicles and drivers" /> Loading available vehicles and drivers…
                  </div>
                ) : (
                  <FormGrid cols={2}>
                    <div className="flex flex-col gap-1.5">
                      <Label>Vehicle</Label>
                      <SearchableSelect
                        value={selectedCarId}
                        onChange={setSelectedCarId}
                        options={vehicleOptions}
                        placeholder="Search by plate, make or model…"
                        emptyMessage="No vehicles match your search."
                        disabled={availableCars.length === 0}
                        placement="top"
                      />
                      {availableCars.length === 0 && <p className="text-xs text-fg-muted">No available vehicles found.</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Driver</Label>
                      <SearchableSelect
                        value={selectedDriverId}
                        onChange={setSelectedDriverId}
                        options={driverOptions}
                        placeholder="Search by name or email…"
                        emptyMessage="No drivers match your search."
                        disabled={availableDrivers.length === 0}
                        placement="top"
                      />
                      {availableDrivers.length === 0 && <p className="text-xs text-fg-muted">No available drivers found.</p>}
                    </div>
                  </FormGrid>
                )}
              </Section>
            )}

            {status !== "PENDING" && status !== "CANCELLED" && (
              <Section title="Payment tracking">
                <div className="space-y-4">
                  {status === "COMPLETED" && summary && <PaymentSummaryCard summary={summary} />}
                  {(status === "IN_PROGRESS" || status === "ENDED" || status === "COMPLETED") && summary?.payment_status !== "FULLY_PAID" && canEditBookings && (
                    <PaymentForm bookingId={booking.id} onSuccess={() => loadPaymentData(booking.id)} />
                  )}
                  <PaymentHistoryList payments={paymentHistory as PaymentTransaction[]} />
                </div>
              </Section>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
