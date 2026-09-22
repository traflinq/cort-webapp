"use client";

import { apiClient, TravelCarInput } from "../../lib/services/api-client";
import { TravelCarsManager } from "../../components/travel/TravelCarsManager";

export default function VendorTravelCarsPage() {
  return (
    <div className="p-4 md:p-8">
      <TravelCarsManager
        title="Travel rentals"
        description="Vehicles your company can offer on car search. Enter a flat rental, a fuel cost per km, and an estimated toll. Fuel is calculated from the trip distance at search time."
        load={async () => (await apiClient.getVendorTravelCars()).data}
        save={async (body: TravelCarInput, id?: number) => {
          if (id) await apiClient.updateVendorTravelCar(id, body);
          else await apiClient.createVendorTravelCar(body);
        }}
        remove={async (id) => {
          await apiClient.deleteVendorTravelCar(id);
        }}
      />
    </div>
  );
}
