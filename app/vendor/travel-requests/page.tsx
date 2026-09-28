"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../lib/services/api-client";
import { VendorVehicle, VendorDriver } from "../../lib/services/types/multi-mode";
import { useVendorContext } from "../layout";
import { toast } from "sonner";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  ACCEPTED: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function VendorTravelRequestsPage() {
  const { selectedLink } = useVendorContext();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [assigning, setAssigning] = useState<any | null>(null);
  const [vehicles, setVehicles] = useState<VendorVehicle[]>([]);
  const [drivers, setDrivers] = useState<VendorDriver[]>([]);
  const [assignForm, setAssignForm] = useState({ vehicle_id: 0, driver_user_id: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!selectedLink) return;
    setLoading(true);
    try {
      const res = await apiClient.getVendorTravelRequests({
        link_id: selectedLink.id,
        status: statusFilter || undefined,
      });
      setRequests(res.data?.data ?? res.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load travel requests");
    } finally {
      setLoading(false);
    }
  }, [selectedLink, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openAssign = async (req: any) => {
    setAssigning(req);
    setAssignForm({ vehicle_id: 0, driver_user_id: "" });
    if (!selectedLink) return;
    try {
      const [vRes, dRes] = await Promise.all([
        apiClient.getVendorVehicles(selectedLink.id),
        apiClient.getVendorDrivers(selectedLink.id),
      ]);
      setVehicles(vRes?.data ?? []);
      setDrivers(dRes?.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load fleet");
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigning || !assignForm.vehicle_id || !assignForm.driver_user_id) {
      toast.error("Please select both a vehicle and driver");
      return;
    }
    setSaving(true);
    try {
      await apiClient.assignVendorTravelRequest(assigning.id, assignForm);
      toast.success("Travel request accepted");
      setAssigning(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm("Reject this travel request?")) return;
    try {
      await apiClient.rejectVendorTravelRequest(id);
      toast.success("Request rejected");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await apiClient.completeVendorTravelRequest(id);
      toast.success("Request marked completed");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0c225e]">Travel requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            {selectedLink ? `For: ${selectedLink.companies?.name ?? `Link #${selectedLink.id}`}` : "Select a company from the sidebar"}
          </p>
        </div>
        <div className="flex gap-2">
          {["PENDING", "ACCEPTED", "COMPLETED", "REJECTED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cx(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                statusFilter === s ? "bg-[#0c225e] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Employee", "Route", "Travel date", "Mile", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No {statusFilter.toLowerCase()} travel requests</td></tr>
            ) : requests.map((req) => (
              <tr key={req.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{req.travel_booking?.employee?.full_name ?? "-"}</td>
                <td className="px-4 py-3">{req.travel_booking?.quote?.origin} - {req.travel_booking?.quote?.destination}</td>
                <td className="px-4 py-3 text-gray-600">
                  {req.travel_booking?.quote?.travel_date ? new Date(req.travel_booking.quote.travel_date).toLocaleDateString() : "-"}
                </td>
                <td className="px-4 py-3">{req.mile}</td>
                <td className="px-4 py-3">
                  <span className={cx("inline-flex px-2 py-0.5 rounded-full text-xs font-semibold", STATUS_COLORS[req.status] ?? "bg-gray-100 text-gray-500")}>
                    {req.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {req.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button onClick={() => openAssign(req)} className="text-xs bg-[#f47f00] text-white px-3 py-1.5 rounded-lg font-medium hover:bg-[#d96e00]">
                        Assign & Accept
                      </button>
                      <button onClick={() => handleReject(req.id)} className="text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded-lg font-medium hover:bg-red-50">
                        Reject
                      </button>
                    </div>
                  )}
                  {req.status === "ACCEPTED" && (
                    <button onClick={() => handleComplete(req.id)} className="text-xs bg-[#0c225e] text-white px-3 py-1.5 rounded-lg font-medium">
                      Mark completed
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Assign & Accept Request</h2>
              <button onClick={() => setAssigning(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
            </div>
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
                    <option key={v.id} value={v.id}>{v.make} {v.model} {v.plate_number}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Driver
                <select
                  value={assignForm.driver_user_id}
                  onChange={(e) => setAssignForm((f) => ({ ...f, driver_user_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Select driver</option>
                  {drivers.map((d) => (
                    <option key={d.user_id} value={d.user_id}>{d.users.full_name}</option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAssigning(null)} className="px-4 py-2 text-sm rounded-lg border">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-[#f47f00] text-white font-medium disabled:opacity-50">
                  {saving ? "Saving..." : "Accept"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
