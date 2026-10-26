"use client";

import { Eye, FileText, Trash2 } from "lucide-react";
import { ChauffeurBooking } from "../../../../lib/services/api-client";
import { Badge, DataTable, Select, StatusBadge, type DataTableColumn } from "../../../ui";
import { formatDateTime, humanize } from "../../../lib/format";
import { BOOKING_STATUS_OPTIONS, BOOKING_STATUS_OVERRIDES, selectableStatus } from "./booking-status";
import { BOOKINGS_PAGE_SIZE } from "../hooks/usePendingBookings";

type BookingListProps = {
  bookings: ChauffeurBooking[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedBookingId: number | null;
  currentPage: number;
  totalPages: number;
  total: number;
  canEditBookings: boolean;
  isDeleting: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
  onSelectBooking: (booking: ChauffeurBooking) => void;
  onPageChange: (page: number) => void;
  onStatusChange: (booking: ChauffeurBooking, status: string) => void;
  onDeleteBooking: (id: number) => void;
  onGenerateInvoice: (id: number) => void;
};

export function BookingList({
  bookings,
  isLoading,
  error,
  onRetry,
  selectedBookingId,
  currentPage,
  totalPages,
  total,
  canEditBookings,
  isDeleting,
  hasFilters,
  onClearFilters,
  onSelectBooking,
  onPageChange,
  onStatusChange,
  onDeleteBooking,
  onGenerateInvoice,
}: BookingListProps) {
  const columns: DataTableColumn<ChauffeurBooking>[] = [
    {
      key: "company",
      header: "Company",
      cell: (b) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">{b.companies?.name || "Unknown company"}</div>
          <div className="font-mono text-[11px] text-fg-muted">#{b.id}</div>
        </div>
      ),
    },
    {
      key: "passenger",
      header: "Passenger",
      cell: (b) => (
        <div className="min-w-0">
          <div className="truncate text-fg">{b.users_chauffeur_bookings_passenger_idTousers?.full_name || "Unknown passenger"}</div>
          <div className="truncate text-xs text-fg-muted">{b.users_chauffeur_bookings_passenger_idTousers?.email}</div>
        </div>
      ),
    },
    {
      key: "request",
      header: "Request",
      cell: (b) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-fg">{b.vehicle_model || "Any model"}</span>
            {b.is_special_request && (
              <Badge tone="brand" size="sm">
                Special request
              </Badge>
            )}
          </div>
          <div className="text-xs text-fg-muted">{humanize(b.package_selected)}</div>
        </div>
      ),
    },
    { key: "city", header: "City", hideBelow: "lg", cell: (b) => <span className="text-fg">{b.city || "—"}</span> },
    {
      key: "driver",
      header: "Driver",
      hideBelow: "md",
      cell: (b) => {
        const driver = b.users_chauffeur_bookings_driver_idTousers;
        if (!driver) return <span className="text-fg-muted">—</span>;
        return (
          <div className="min-w-0">
            <div className="truncate text-fg">{driver.full_name}</div>
            {driver.phone && <div className="font-mono text-xs text-fg-muted">{driver.phone}</div>}
          </div>
        );
      },
    },
    {
      key: "vehicle",
      header: "Vehicle",
      hideBelow: "md",
      cell: (b) => {
        const v = b.vehicles;
        if (!v) return <span className="text-fg-muted">—</span>;
        return (
          <div className="min-w-0">
            <div className="truncate text-fg">{v.model}</div>
            <div className="font-mono text-xs text-fg-muted">{v.plate_number}</div>
          </div>
        );
      },
    },
    { key: "scheduled", header: "Scheduled", cell: (b) => <span className="whitespace-nowrap text-fg-secondary">{formatDateTime(b.scheduled_for)}</span> },
    { key: "days", header: "Days", align: "center", mono: true, hideBelow: "lg", cell: (b) => b.no_of_days || 1 },
    {
      key: "status",
      header: "Status",
      cell: (b) => (
        <div className="flex flex-col items-start gap-1.5">
          <StatusBadge status={b.status} overrides={BOOKING_STATUS_OVERRIDES} />
          {canEditBookings && (
            <Select
              width="auto"
              aria-label={`Change status of booking #${b.id}`}
              value={selectableStatus(b.status)}
              onChange={(e) => onStatusChange(b, e.target.value)}
              className="h-7 py-0 pr-7 text-xs"
            >
              {BOOKING_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
          {b.invoices && <span className="text-[11px] text-success-ink">Invoice #{b.invoices.invoice_number}</span>}
        </div>
      ),
    },
  ];

  return (
    <DataTable<ChauffeurBooking>
      caption="Chauffeur bookings"
      columns={columns}
      rows={bookings}
      rowKey={(b) => b.id}
      loading={isLoading}
      error={error}
      onRetry={onRetry}
      minWidth={880}
      empty={{
        title: hasFilters ? "No bookings match these filters" : "No bookings yet",
        description: hasFilters ? "Try widening the date range or clearing a filter." : "New chauffeur bookings appear here as companies request them.",
        action: hasFilters ? (
          <button type="button" onClick={onClearFilters} className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            Clear filters
          </button>
        ) : undefined,
      }}
      onRowClick={onSelectBooking}
      rowClassName={(b) => (b.id === selectedBookingId ? "bg-brand-soft/40" : undefined)}
      rowActions={(b) => [
        { label: "View details", icon: <Eye />, onSelect: () => onSelectBooking(b) },
        {
          label: "Generate invoice",
          icon: <FileText />,
          hidden: !(b.status === "COMPLETED" && !b.invoices),
          disabled: !canEditBookings,
          onSelect: () => onGenerateInvoice(b.id),
        },
        {
          label: "Delete booking",
          icon: <Trash2 />,
          destructive: true,
          separatorBefore: true,
          hidden: !canEditBookings,
          disabled: isDeleting,
          onSelect: () => onDeleteBooking(b.id),
        },
      ]}
      pagination={{ page: currentPage, totalPages, total, pageSize: BOOKINGS_PAGE_SIZE, onPageChange }}
    />
  );
}
