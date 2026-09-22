"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiClient } from "../../../lib/services/api-client";
import { useAuth } from "../../../lib/contexts/auth-context";
import { Card } from "../../components/DashboardComponents";
import { PageHeader, TABLE_CARD_CLASS, TABLE_CELL_CLASS, TABLE_HEADER_CELL_CLASS } from "../../components/PageLayout";

export default function TravelApprovalsPage() {
  const t = useTranslations("company.travel");
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  const load = () => {
    if (!user?.company_id) return;
    apiClient.getCompanyTravelBookings(user.company_id, { status: "APPROVAL", limit: 50 })
      .then((res) => setRows(res.data?.data || []));
  };

  useEffect(() => { load(); }, [user?.company_id]);

  const act = async (id: number, approve: boolean) => {
    if (!user?.company_id) return;
    try {
      if (approve) await apiClient.approveTravelBooking(user.company_id, id);
      else await apiClient.rejectTravelBooking(user.company_id, id);
      toast.success(approve ? "Approved" : "Rejected");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader label={t("label")} title={t("approvals")} />
      <Card className={TABLE_CARD_CLASS}>
        <table className="w-full text-left">
          <thead>
            <tr>
              {[t("employee"), t("from"), t("to"), t("travelDate"), t("status"), ""].map((h) => (
                <th key={h || "a"} className={TABLE_HEADER_CELL_CLASS}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td className={TABLE_CELL_CLASS} colSpan={6}>{t("empty")}</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border-light)]">
                <td className={TABLE_CELL_CLASS}>{row.employee?.full_name}</td>
                <td className={TABLE_CELL_CLASS}>{row.origin}</td>
                <td className={TABLE_CELL_CLASS}>{row.destination}</td>
                <td className={TABLE_CELL_CLASS}>{String(row.travel_date).slice(0, 10)}</td>
                <td className={TABLE_CELL_CLASS}>{row.status}</td>
                <td className={TABLE_CELL_CLASS}>
                  <button onClick={() => act(row.id, true)} className="text-green-600 font-bold mr-3">{t("approve")}</button>
                  <button onClick={() => act(row.id, false)} className="text-red-600 font-bold">{t("reject")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
