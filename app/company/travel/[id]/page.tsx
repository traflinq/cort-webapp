"use client";

import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "../../../../lib/services/api-client";
import { useAuth } from "../../../../lib/contexts/auth-context";
import { Card } from "../../../components/DashboardComponents";
import { PageHeader } from "../../../components/PageLayout";

export default function TravelBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [driver, setDriver] = useState({ first_mile_driver: "", first_mile_vehicle: "", last_mile_driver: "", last_mile_vehicle: "" });

  useEffect(() => {
    if (!user?.company_id) return;
    apiClient.getCompanyTravelBooking(user.company_id, Number(id)).then((res) => {
      setBooking(res.data);
      setDriver({
        first_mile_driver: res.data.first_mile_driver || "",
        first_mile_vehicle: res.data.first_mile_vehicle || "",
        last_mile_driver: res.data.last_mile_driver || "",
        last_mile_vehicle: res.data.last_mile_vehicle || "",
      });
    });
  }, [user?.company_id, id]);

  const save = async () => {
    if (!user?.company_id) return;
    await apiClient.patchTravelBooking(user.company_id, Number(id), driver);
    toast.success("Updated");
  };

  if (!booking) return null;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <PageHeader label="Travel" title={`${booking.origin} ? ${booking.destination}`} description={booking.status} />
      <Card className="space-y-3">
        <p>Employee: {booking.employee?.full_name}</p>
        <p>Date: {String(booking.travel_date).slice(0, 10)}</p>
        <p>Transport: {booking.transport_type} {booking.travel_class} - {booking.operator_name}</p>
        <p>Traveler: {booking.traveler_first_name} {booking.traveler_last_name} - {booking.traveler_email}</p>
        <p>First mile: {booking.first_mile_type} {booking.first_mile_provider}</p>
        <p>Last mile: {booking.last_mile_type} {booking.last_mile_provider}</p>
        <input className="w-full border rounded-lg px-3 py-2 bg-transparent" placeholder="First mile driver" value={driver.first_mile_driver} onChange={(e) => setDriver((d) => ({ ...d, first_mile_driver: e.target.value }))} />
        <input className="w-full border rounded-lg px-3 py-2 bg-transparent" placeholder="First mile vehicle" value={driver.first_mile_vehicle} onChange={(e) => setDriver((d) => ({ ...d, first_mile_vehicle: e.target.value }))} />
        <input className="w-full border rounded-lg px-3 py-2 bg-transparent" placeholder="Last mile driver" value={driver.last_mile_driver} onChange={(e) => setDriver((d) => ({ ...d, last_mile_driver: e.target.value }))} />
        <input className="w-full border rounded-lg px-3 py-2 bg-transparent" placeholder="Last mile vehicle" value={driver.last_mile_vehicle} onChange={(e) => setDriver((d) => ({ ...d, last_mile_vehicle: e.target.value }))} />
        <button onClick={save} className="bg-[#f47f00] text-white px-4 py-2 rounded-lg font-bold">Save itinerary</button>
      </Card>
    </div>
  );
}
