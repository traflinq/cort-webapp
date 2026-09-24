"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiClient } from "../../../lib/services/api-client";
import { useAuth } from "../../../lib/contexts/auth-context";
import { Card } from "../../components/DashboardComponents";
import {
  PageHeader,
  TABLE_CARD_CLASS,
  TABLE_CELL_CLASS,
  TABLE_HEADER_CELL_CLASS,
  TableEmptyState,
} from "../../components/PageLayout";
import TableSkeleton from "@/app/components/ui/TableSkeleton";
import TravelBookingDetailModal from "../TravelBookingDetailModal";
import { StatusChip, bookingTrip, parseTravelRows, shortDate } from "../travel-ui";

const STATUS_KEYS: Record<string, "statusReview" | "statusApproval" | "statusConfirmed" | "statusRejected"> = {
  REVIEW: "statusReview",
  APPROVAL: "statusApproval",
  CONFIRMED: "statusConfirmed",
  REJECTED: "statusRejected",
};

export default function TravelApprovalsPage() {
  const t = useTranslations("company.travel");
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getCompanyTravelBookings(user.company_id, { status: "APPROVAL", limit: 50 });
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

  const act = async (id: number, approve: boolean) => {
    if (!user?.company_id) return;
    setActingId(id);
    try {
      if (approve) await apiClient.approveTravelBooking(user.company_id, id);
      else await apiClient.rejectTravelBooking(user.company_id, id);
      toast.success(approve ? t("approved") : t("rejectedLabel"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader label={t("label")} title={t("approvals")} />
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
      ) : null}
      <Card className={TABLE_CARD_CLASS}>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-full">
            <thead className="bg-[var(--surface-subtle)]/50">
              <tr>
                {[t("employee"), t("from"), t("to"), t("travelDate"), t("status"), t("actions")].map((h) => (
                  <th key={h} className={TABLE_HEADER_CELL_CLASS}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton columns={6} rows={6} />
              ) : rows.length === 0 ? (
                <TableEmptyState message={t("emptyApprovals")} />
              ) : (
                rows.map((row) => {
                  const trip = bookingTrip(row);
                  return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className="border-t border-[var(--border-light)] cursor-pointer hover:bg-[var(--surface-subtle)]/80 transition-colors"
                  >
                    <td className={`${TABLE_CELL_CLASS} font-semibold text-[var(--text-primary)]`}>{row.employee?.full_name || "-"}</td>
                    <td className={TABLE_CELL_CLASS}>{trip.origin}</td>
                    <td className={TABLE_CELL_CLASS}>{trip.destination}</td>
                    <td className={TABLE_CELL_CLASS}>{shortDate(trip.travel_date)}</td>
                    <td className={TABLE_CELL_CLASS}>
                      <StatusChip status={row.status} label={t(STATUS_KEYS[row.status] || "status")} />
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          act(row.id, true);
                        }}
                        disabled={actingId === row.id}
                        className="text-emerald-600 font-bold mr-3 disabled:opacity-50"
                      >
                        {t("approve")}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          act(row.id, false);
                        }}
                        disabled={actingId === row.id}
                        className="text-rose-600 font-bold disabled:opacity-50"
                      >
                        {t("reject")}
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <TravelBookingDetailModal
        bookingId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />
    </div>
  );
}
