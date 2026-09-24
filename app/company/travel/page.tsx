"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { Card } from "../components/DashboardComponents";
import {
  PageHeader,
  TABLE_CARD_CLASS,
  TABLE_HEADER_CELL_CLASS,
  TABLE_CELL_CLASS,
  TableEmptyState,
} from "../components/PageLayout";
import TableSkeleton from "@/app/components/ui/TableSkeleton";
import Modal, { ModalTrigger } from "../bookings/components/Modal";
import NewTravelBookingForm from "./NewTravelBookingForm";
import TravelBookingDetailModal from "./TravelBookingDetailModal";
import {
  PRIMARY_BUTTON_CLASS,
  StatusChip,
  bookingMileLabel,
  bookingTrip,
  parseTravelRows,
  shortDate,
} from "./travel-ui";

const TRAVEL_BOOK_LAYOUT_ID = "travel-book-form";

const STATUS_KEYS: Record<string, "statusReview" | "statusApproval" | "statusConfirmed" | "statusRejected"> = {
  REVIEW: "statusReview",
  APPROVAL: "statusApproval",
  CONFIRMED: "statusConfirmed",
  REJECTED: "statusRejected",
};

export default function TravelBookingsPage() {
  const t = useTranslations("company.travel");
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getCompanyTravelBookings(user.company_id, { limit: 50 });
      setRows(parseTravelRows(res));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("loadFailed");
      setError(message);
      toast.error(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.company_id, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
        action={
          bookingOpen ? (
            <span className={`${PRIMARY_BUTTON_CLASS} invisible pointer-events-none`}>{t("newBooking")}</span>
          ) : (
            <ModalTrigger
              layoutId={TRAVEL_BOOK_LAYOUT_ID}
              onClick={() => setBookingOpen(true)}
              className={PRIMARY_BUTTON_CLASS}
            >
              {t("newBooking")}
            </ModalTrigger>
          )
        }
      />
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
      ) : null}
      <Card className={TABLE_CARD_CLASS}>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-full">
            <thead className="bg-[var(--surface-subtle)]/50">
              <tr>
                {[t("employee"), t("bookingDate"), t("from"), t("to"), t("travelDate"), t("firstMile"), t("lastMile"), t("type"), t("status")].map((h) => (
                  <th key={h} className={TABLE_HEADER_CELL_CLASS}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton columns={9} rows={8} />
              ) : rows.length === 0 ? (
                <TableEmptyState message={t("empty")} />
              ) : (
                rows.map((row) => {
                  const trip = bookingTrip(row);
                  return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className="border-t border-[var(--border-light)] cursor-pointer hover:bg-[var(--surface-subtle)]/80 transition-colors"
                  >
                    <td className={`${TABLE_CELL_CLASS} font-semibold text-[var(--text-primary)]`}>
                      {row.employee?.full_name || "-"}
                    </td>
                    <td className={TABLE_CELL_CLASS}>{shortDate(row.created_at)}</td>
                    <td className={TABLE_CELL_CLASS}>{trip.origin}</td>
                    <td className={TABLE_CELL_CLASS}>{trip.destination}</td>
                    <td className={TABLE_CELL_CLASS}>{shortDate(trip.travel_date)}</td>
                    <td className={TABLE_CELL_CLASS}>{bookingMileLabel(row, "FIRST")}</td>
                    <td className={TABLE_CELL_CLASS}>{bookingMileLabel(row, "LAST")}</td>
                    <td className={TABLE_CELL_CLASS}>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-primary)] text-[10px] font-bold border border-[var(--border-input)] uppercase tracking-tight">
                        {trip.transport_type || "-"}
                      </span>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <StatusChip status={row.status} label={t(STATUS_KEYS[row.status] || "status")} />
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        title={t("newTitle")}
        layoutId={TRAVEL_BOOK_LAYOUT_ID}
        panelClassName="!max-w-4xl"
      >
        <NewTravelBookingForm
          onSuccess={() => {
            setBookingOpen(false);
            load();
          }}
        />
      </Modal>

      <TravelBookingDetailModal
        bookingId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />
    </div>
  );
}
