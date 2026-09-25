"use client";

import { apiClient, MileVehicleInput } from "../../lib/services/api-client";
import { MileVehiclesManager } from "../../components/travel/MileVehiclesManager";

export default function AdminTravelMileVehiclesPage() {
  return (
    <MileVehiclesManager
      title="Airport transfer and rentals"
      description="CORT default vehicles for first and last mile. Airport transfer is a fixed price for both legs. Rental 10 hours is last mile only, with fuel calculated from drop-off distance."
      load={async () => (await apiClient.getAdminMileVehicles()).data}
      save={async (body: MileVehicleInput, id?: number) => {
        if (id) await apiClient.updateAdminMileVehicle(id, body);
        else await apiClient.createAdminMileVehicle(body);
      }}
      remove={async (id) => {
        await apiClient.deleteAdminMileVehicle(id);
      }}
    />
  );
}
