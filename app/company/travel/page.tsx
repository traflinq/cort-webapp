"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { Card } from "../components/DashboardComponents";
import { PageHeader, TABLE_CARD_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from "../components/PageLayout";

export default function TravelBookingsPage() {
  const t = useTranslations("company.travel");
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.company_id) return;
    apiClient.getCompanyTravelBookings(user.company_id, { limit: 50 })
      .then((res) => setRows(res.data?.data || []))
      .finally(() => setLoading(false));
  }, [user?.company_id]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
        action={
          <Link href="/company/travel/new" className="bg-[#f47f00] text-white px-4 py-2 rounded-xl text-sm font-bold">
            {t("newBooking")}
          </Link>
        }
      />
      <Card className={TABLE_CARD_CLASS}>
        <table className="w-full text-left">
          <thead>
            <tr>
              {[t("employee"), t("bookingDate"), t("from"), t("to"), t("travelDate"), t("firstMile"), t("lastMile"), t("type"), t("status")].map((h) => (
                <th key={h} className={TABLE_HEADER_CELL_CLASS}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr><td className={`${TABLE_CELL_CLASS} text-[var(--text-muted)]`} colSpan={9}>{t("empty")}</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border-light)]">
                <td className={TABLE_CELL_CLASS}>
                  <Link href={`/company/travel/${row.id}`} className="text-[#f47f00] font-semibold">{row.employee?.full_name}</Link>
                </td>
                <td className={TABLE_CELL_CLASS}>{String(row.created_at).slice(0, 10)}</td>
                <td className={TABLE_CELL_CLASS}>{row.origin}</td>
                <td className={TABLE_CELL_CLASS}>{row.destination}</td>
                <td className={TABLE_CELL_CLASS}>{String(row.travel_date).slice(0, 10)}</td>
                <td className={TABLE_CELL_CLASS}>{row.first_mile_type}{row.first_mile_provider ? ` / ${row.first_mile_provider}` : ""}</td>
                <td className={TABLE_CELL_CLASS}>{row.last_mile_type}{row.last_mile_provider ? ` / ${row.last_mile_provider}` : ""}</td>
                <td className={TABLE_CELL_CLASS}>{row.transport_type}</td>
                <td className={TABLE_CELL_CLASS}>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
