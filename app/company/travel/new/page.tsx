"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClient } from "../../../lib/services/api-client";
import { useAuth } from "../../../lib/contexts/auth-context";
import { Card } from "../../components/DashboardComponents";
import { PageHeader } from "../../components/PageLayout";
import { TravelPlaceField } from "../TravelPlaceField";

export default function NewTravelBookingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [scope, setScope] = useState("DOMESTIC");
  const [transportType, setTransportType] = useState("BUS");
  const [tripDirection, setTripDirection] = useState<"ONE_WAY" | "ROUND_TRIP">("ONE_WAY");
  const [bags, setBags] = useState("1");
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [offerId, setOfferId] = useState("");
  const [packageFilter, setPackageFilter] = useState("ALL");
  const [wantFirst, setWantFirst] = useState(false);
  const [wantLast, setWantLast] = useState(false);
  const [firstProvider, setFirstProvider] = useState("BYKEA");
  const [lastProvider, setLastProvider] = useState("BYKEA");
  const [mileOptions, setMileOptions] = useState<any>(null);
  const [traveler, setTraveler] = useState({ first_name: "", last_name: "", email: "", passport_number: "", cnic_number: "", phone: "", nationality: "" });
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!user?.company_id) return;
    apiClient.getCompanyEmployeeTravelWallets(user.company_id).then((res) => setEmployees(res.data || []));
  }, [user?.company_id]);

  const search = async () => {
    if (!user?.company_id) return;
    setSearching(true);
    try {
      const res = await apiClient.searchCompanyTravel(user.company_id, {
        origin,
        destination,
        travel_date: travelDate,
        scope,
        bag_count: Number(bags),
        transport_type: transportType,
        ...(transportType === "CAR" ? { trip_direction: tripDirection } : {}),
      });
      setQuoteId(res.data.quote_id);
      setOffers(res.data.offers || []);
      if (transportType !== "CAR") {
        const miles = await apiClient.getTravelMileOptions(user.company_id, Number(bags));
        setMileOptions(miles.data);
      } else {
        setMileOptions(null);
        setWantFirst(false);
        setWantLast(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const mile = (want: boolean, provider: string) => {
    if (!want) return { type: "NONE" };
    if (provider === "BYKEA") return { type: "RIDE_HAIL", provider: "BYKEA" };
    const rental = (mileOptions?.rentals || []).find((r: any) => r.provider === provider);
    return { type: "RENTAL", provider, vendor_link_id: rental?.vendor_link_id };
  };

  const submit = async () => {
    if (!user?.company_id || !quoteId) return;
    try {
      await apiClient.createCompanyTravelBooking(user.company_id, {
        quote_id: quoteId,
        offer_id: offerId,
        account_mode: "COMPANY",
        employee_id: employeeId,
        package_filter: packageFilter,
        bag_count: Number(bags),
        first_mile: mile(transportType === "CAR" ? false : wantFirst, firstProvider),
        last_mile: mile(transportType === "CAR" ? false : wantLast, lastProvider),
        traveler,
      });
      toast.success("Travel booking created");
      router.push("/company/travel");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const field = "w-full border rounded-lg px-3 py-2 bg-transparent";

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <PageHeader label="Travel" title="Book travel for an employee" />
      <Card className="space-y-4">
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={field}>
          <option value="">Select employee</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <TravelPlaceField
          value={origin}
          onChange={setOrigin}
          placeholder="From"
          country={scope === "DOMESTIC" ? "pk" : undefined}
        />
        <TravelPlaceField
          value={destination}
          onChange={setDestination}
          placeholder="Destination"
          country={scope === "DOMESTIC" ? "pk" : undefined}
        />
        <input className={field} type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
        <select className={field} value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="DOMESTIC">Domestic</option>
          <option value="INTERNATIONAL">International</option>
        </select>
        <select className={field} value={transportType} onChange={(e) => setTransportType(e.target.value)}>
          <option value="BUS">Bus</option>
          <option value="FLIGHT">Flight</option>
          <option value="TRAIN">Train</option>
          <option value="CAR">Car</option>
        </select>
        {transportType === "CAR" && (
          <select className={field} value={tripDirection} onChange={(e) => setTripDirection(e.target.value as "ONE_WAY" | "ROUND_TRIP")}>
            <option value="ONE_WAY">One way</option>
            <option value="ROUND_TRIP">Round trip</option>
          </select>
        )}
        <input className={field} placeholder="Bags" value={bags} onChange={(e) => setBags(e.target.value)} />
        <button onClick={search} disabled={searching} className="bg-[#f47f00] text-white px-4 py-2 rounded-lg font-bold">{searching ? "Searching..." : "Search"}</button>
        {offers.length > 0 && (
          <div className="space-y-2">
            <select className={field} value={packageFilter} onChange={(e) => setPackageFilter(e.target.value)}>
              <option value="ALL">All</option>
              <option value="WITH_MEAL">With meal</option>
              <option value="WITHOUT_MEAL">Without meal</option>
              <option value="BAGS">Bags</option>
            </select>
            {offers.filter((o) => {
              if (packageFilter === "WITH_MEAL") return o.meal_included;
              if (packageFilter === "WITHOUT_MEAL") return !o.meal_included;
              if (packageFilter === "BAGS") return o.bag_allowance >= Number(bags);
              return true;
            }).map((o) => (
              <label key={o.offer_id} className="flex gap-2 items-center border rounded-lg p-3">
                <input type="radio" name="offer" checked={offerId === o.offer_id} onChange={() => setOfferId(o.offer_id)} />
                <span>
                  {o.mode} {o.class} - {o.operator} - PKR {o.price}
                  {o.mode === "CAR"
                    ? ` | ${o.trip_direction === "ROUND_TRIP" ? "Round trip" : "One way"} ${o.distance_km ?? 0} km | Rental ${o.rental_amount ?? 0} | Fuel ${o.fuel_amount ?? 0} (${o.distance_km ?? 0} km x ${o.cost_per_km ?? 0}) | Estimated toll ${o.estimated_toll ?? 0}`
                    : ""}
                </span>
              </label>
            ))}
            {transportType !== "CAR" && (
              <>
            <label className="flex gap-2"><input type="checkbox" checked={wantFirst} onChange={(e) => setWantFirst(e.target.checked)} /> First mile</label>
            {wantFirst && (
              <select className={field} value={firstProvider} onChange={(e) => setFirstProvider(e.target.value)}>
                <option value="BYKEA">Bykea (ride-hailing, quality not guaranteed)</option>
                <option value="CORT">CORT rental</option>
                <option value="COMPANY_VENDOR">Company vendor</option>
                <option value="SHORT_RENTAL">Short rental</option>
              </select>
            )}
            <label className="flex gap-2"><input type="checkbox" checked={wantLast} onChange={(e) => setWantLast(e.target.checked)} /> Last mile</label>
            {wantLast && (
              <select className={field} value={lastProvider} onChange={(e) => setLastProvider(e.target.value)}>
                <option value="BYKEA">Bykea</option>
                <option value="CORT">CORT</option>
                <option value="COMPANY_VENDOR">Company vendor</option>
                <option value="SHORT_RENTAL">Short rental</option>
              </select>
            )}
              </>
            )}
            {Object.keys(traveler).map((key) => (
              <input key={key} className={field} placeholder={key.replace("_", " ")} value={(traveler as any)[key]} onChange={(e) => setTraveler((t) => ({ ...t, [key]: e.target.value }))} />
            ))}
            <button onClick={submit} className="bg-[#0c225e] text-white px-4 py-2 rounded-lg font-bold">Confirm booking</button>
          </div>
        )}
      </Card>
    </div>
  );
}
