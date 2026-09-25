"use client";

import { apiClient, MileVehicleInput } from "../../lib/services/api-client";
import { MileVehiclesManager } from "../../components/travel/MileVehiclesManager";

export default function VendorTravelMileVehiclesPage() {
  return (
    <div className="p-4 md:p-8">
      <MileVehiclesManager
        title="Airport transfer and rentals"
        description="Vehicles your company can offer for first and last mile. Airport transfer is a fixed price. Rental 10 hours is last mile only, with fuel calculated from drop-off distance."
        load={async () => (await apiClient.getVendorMileVehicles()).data}
        save={async (body: MileVehicleInput, id?: number) => {
          if (id) await apiClient.updateVendorMileVehicle(id, body);
          else await apiClient.createVendorMileVehicle(body);
        }}
        remove={async (id) => {
          await apiClient.deleteVendorMileVehicle(id);
        }}
      />
    </div>
  );
}
