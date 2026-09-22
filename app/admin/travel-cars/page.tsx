"use client";

import { apiClient, TravelCarInput } from "../../lib/services/api-client";
import { TravelCarsManager } from "../../components/travel/TravelCarsManager";

export default function AdminTravelCarsPage() {
  return (
    <TravelCarsManager
      title="Travel cars"
      description="Public CORT vehicles for employee car search. Enter a flat rental, a fuel cost per km, and an estimated toll. Fuel is calculated from the trip distance at search time."
      load={async () => (await apiClient.getAdminTravelCars()).data}
      save={async (body: TravelCarInput, id?: number) => {
        if (id) await apiClient.updateAdminTravelCar(id, body);
        else await apiClient.createAdminTravelCar(body);
      }}
      remove={async (id) => {
        await apiClient.deleteAdminTravelCar(id);
      }}
    />
  );
}
