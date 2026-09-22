"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import {
  PRIMARY_BUTTON_CLASS,
  StatusChip,
  mileLabel,
  parseTravelRows,
  shortDate,
} from "./travel-ui";

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

  useEffect(() => {
    if (!user?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    apiClient.getCompanyTravelBookings(user.company_id, { limit: 50 })
      .then((res) => setRows(parseTravelRows(res)))
      .catch((err) => {
        const message = err instanceof Error ? err.message : t("loadFailed");
        setError(message);
        toast.error(message);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [user?.company_id, t]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
        action={
          <Link href="/company/travel/new" className={PRIMARY_BUTTON_CLASS}>
            {t("newBooking")}
          </Link>
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
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border-light)]">
                    <td className={TABLE_CELL_CLASS}>
                      <Link href={`/company/travel/${row.id}`} className="text-[#f47f00] font-semibold">
                        {row.employee?.full_name || "-"}
                      </Link>
                    </td>
                    <td className={TABLE_CELL_CLASS}>{shortDate(row.created_at)}</td>
                    <td className={TABLE_CELL_CLASS}>{row.origin}</td>
                    <td className={TABLE_CELL_CLASS}>{row.destination}</td>
                    <td className={TABLE_CELL_CLASS}>{shortDate(row.travel_date)}</td>
                    <td className={TABLE_CELL_CLASS}>{mileLabel(row.first_mile_type, row.first_mile_provider, row.transport_type)}</td>
                    <td className={TABLE_CELL_CLASS}>{mileLabel(row.last_mile_type, row.last_mile_provider, row.transport_type)}</td>
                    <td className={TABLE_CELL_CLASS}>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-primary)] text-[10px] font-bold border border-[var(--border-input)] uppercase tracking-tight">
                        {row.transport_type}
                      </span>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <StatusChip status={row.status} label={t(STATUS_KEYS[row.status] || "status")} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
