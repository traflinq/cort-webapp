"use client";

import { memo, useState } from "react";
import { ChauffeurBooking, TripType } from "../../../../lib/services/api-client";
import { Button, Dialog, DialogContent } from "../../../ui";
import { DailyLogTable, ymdLocal, type DailyLogRow } from "./DailyLogTable";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void | Promise<void>;
  booking: ChauffeurBooking | null;
};

function seedLogs(booking: ChauffeurBooking): DailyLogRow[] {
  if (booking.chauffeur_trip_daily_logs && booking.chauffeur_trip_daily_logs.length > 0) {
    return booking.chauffeur_trip_daily_logs.map((log) => ({
      id: String(log.id),
      date: ymdLocal(new Date(log.log_date)),
      trip_type: log.trip_type as TripType,
      is_full_day: log.is_full_day,
      apply_accommodation: log.apply_accommodation,
      hours_used: log.hours_used ? log.hours_used.toString() : "",
    }));
  }
  const startDate = booking.chauffeur_trip_logs?.start_time ? new Date(booking.chauffeur_trip_logs.start_time) : new Date(booking.scheduled_for);
  const isOutstation = booking.trip_type === TripType.OUT_STATION;
  const defaultHours = booking.package_selected === "HOURS_24" ? 0 : booking.package_selected === "HOURS_5" ? 5 : 10;
  const days: DailyLogRow[] = [];
  const cursor = new Date(startDate);
  const loopEnd = new Date();
  cursor.setHours(0, 0, 0, 0);
  loopEnd.setHours(0, 0, 0, 0);
  while (cursor <= loopEnd) {
    const dateStr = ymdLocal(cursor);
    days.push({
      id: dateStr,
      date: dateStr,
      trip_type: isOutstation ? TripType.OUT_STATION : TripType.IN_CITY,
      is_full_day: booking.package_selected === "HOURS_24",
      apply_accommodation: false,
      hours_used: defaultHours > 0 ? String(defaultHours) : "",
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export const DailyLogsModal = memo(function DailyLogsModal({ isOpen, onClose, onSubmit, booking }: Props) {
  const [dailyLogs, setDailyLogs] = useState<DailyLogRow[]>([]);
  const [saving, setSaving] = useState(false);

  const seedKey = isOpen && booking ? String(booking.id) : null;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (seedKey !== seededKey) {
    setSeededKey(seedKey);
    if (seedKey && booking) setDailyLogs(seedLogs(booking));
  }

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSubmit({
        daily_logs: dailyLogs.map((log) => ({
          date: log.date,
          trip_type: log.trip_type,
          is_full_day: log.is_full_day,
          apply_accommodation: log.apply_accommodation || false,
          hours_used: log.hours_used ? parseFloat(log.hours_used) : 0,
        })),
      });
    } catch {
      /* error toast shown by the action */
    } finally {
      setSaving(false);
    }
  };

  const allowFullDay = booking?.package_selected === "HOURS_24" || booking?.package_selected === "HOURS_10";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        size="lg"
        priority="elevated"
        title="Manage daily logs"
        description={booking ? `Booking #${booking.id} · ${booking.companies?.name ?? ""}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <DailyLogTable rows={dailyLogs} onChange={setDailyLogs} allowFullDay={allowFullDay} />
      </DialogContent>
    </Dialog>
  );
});
