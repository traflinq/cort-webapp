"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DriverType, apiClient } from "../../lib/services/api-client";

function dateLabel(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function mileLabel(mile?: string) {
  if (mile === "FIRST") return "First mile";
  if (mile === "LAST") return "Last mile";
  return mile || "-";
}

function typeLabel(type?: string) {
  if (type === "AIRPORT_TRANSFER") return "Airport transfer";
  if (type === "RENTAL") return "Rental 10hr";
  return type || "-";
}

export default function AdminTravelBookingsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [assigning, setAssigning] = useState<any | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [assignForm, setAssignForm] = useState({ vehicle_id: 0, driver_id: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getAdminTravelMiles({ page: 1, limit: 50, unassigned: unassignedOnly });
      setRows(res.data?.data ?? res.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load travel bookings");
    } finally {
      setLoading(false);
    }
  }, [unassignedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const openAssign = async (row: any) => {
    setAssigning(row);
    setAssignForm({ vehicle_id: 0, driver_id: "" });
    try {
      const [carsRes, driversRes] = await Promise.all([
        apiClient.getAvailableVehicles({ limit: 100 }) as any,
        apiClient.getAvailableDrivers({ limit: 100, driver_type: DriverType.CHAUFFEUR }) as any,
      ]);
      const carsRaw = carsRes?.data ?? carsRes;
      const driversRaw = driversRes?.data ?? driversRes;
      setVehicles(carsRaw?.data ?? carsRaw ?? []);
      setDrivers(driversRaw?.data ?? driversRaw ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load CORT fleet");
    }
  };

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!assigning || !assignForm.vehicle_id || !assignForm.driver_id) {
      toast.error("Select a CORT vehicle and driver");
      return;
    }
    setSaving(true);
    try {
      await apiClient.assignAdminTravelMile(assigning.travel_booking_id, {
        mile: assigning.mile,
        vehicle_id: assignForm.vehicle_id,
        driver_id: assignForm.driver_id,
      });
      toast.success("Driver and vehicle assigned");
      setAssigning(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-muted">Travel</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Travel bookings
          </h1>
          <p className="mt-2 text-sm text-muted max-w-2xl">
            Assign a CORT fleet driver and vehicle to CORT-managed first and last mile legs. Vendor-managed legs are assigned by the vendor.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUnassignedOnly(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              unassignedOnly ? "bg-[#0c225e] text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            Needs assignment
          </button>
          <button
            type="button"
            onClick={() => setUnassignedOnly(false)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              !unassignedOnly ? "bg-[#0c225e] text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            All CORT miles
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-[var(--bg-card)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Travel date</th>
                <th className="px-4 py-3">Mile</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    {unassignedOnly ? "No CORT miles waiting for a driver and vehicle" : "No CORT-managed travel miles"}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const booking = row.travel_booking;
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{booking?.employee?.full_name ?? "-"}</td>
                      <td className="px-4 py-3">{booking?.companies?.name ?? "-"}</td>
                      <td className="px-4 py-3">
                        {booking?.quote?.origin} - {booking?.quote?.destination}
                      </td>
                      <td className="px-4 py-3">{dateLabel(booking?.quote?.travel_date)}</td>
                      <td className="px-4 py-3">
                        {mileLabel(row.mile)} / {typeLabel(row.type)}
                      </td>
                      <td className="px-4 py-3">{row.driver || "-"}</td>
                      <td className="px-4 py-3">{row.vehicle || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void openAssign(row)}
                          className="inline-flex items-center rounded-lg bg-[#f47f00] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#d97000]"
                        >
                          {row.driver || row.vehicle ? "Reassign" : "Assign"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {assigning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Assign CORT fleet</h2>
              <button type="button" onClick={() => setAssigning(null)} className="text-gray-400 hover:text-gray-600 text-xl">
                x
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {assigning.travel_booking?.employee?.full_name} - {mileLabel(assigning.mile)} / {typeLabel(assigning.type)}
            </p>
            <form onSubmit={handleAssign} className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Vehicle
                <select
                  value={assignForm.vehicle_id}
                  onChange={(e) => setAssignForm((f) => ({ ...f, vehicle_id: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value={0}>Select vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.make} {v.model} {v.plate_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Driver
                <select
                  value={assignForm.driver_id}
                  onChange={(e) => setAssignForm((f) => ({ ...f, driver_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Select driver</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAssigning(null)} className="px-4 py-2 text-sm rounded-lg border">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-[#f47f00] text-white font-medium disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Assign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
