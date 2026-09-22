"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../../lib/services/api-client";
import { BookingVendorRequest, VendorVehicle, VendorDriver } from "../../lib/services/types/multi-mode";
import { useVendorContext } from "../layout";
import { toast } from "sonner";

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    ACCEPTED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    EXPIRED: "bg-gray-100 text-gray-500",
};

export default function VendorRequestsPage() {
    const { selectedLink } = useVendorContext();
    const [requests, setRequests] = useState<BookingVendorRequest[]>([]);
    const [travelRequests, setTravelRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>("PENDING");

    // Assign modal state
    const [assigningReq, setAssigningReq] = useState<BookingVendorRequest | null>(null);
    const [assigningTravel, setAssigningTravel] = useState<any | null>(null);
    const [vehicles, setVehicles] = useState<VendorVehicle[]>([]);
    const [drivers, setDrivers] = useState<VendorDriver[]>([]);
    const [assignForm, setAssignForm] = useState({ vehicle_id: 0, driver_user_id: "" });
    const [assigning, setAssigning] = useState(false);

    const load = useCallback(async () => {
        if (!selectedLink) return;
        setLoading(true);
        try {
            const res = await apiClient.getVendorRequests({ link_id: selectedLink.id, status: statusFilter || undefined });
            setRequests(res.data.data ?? []);
            const travel = await apiClient.getVendorTravelRequests({ link_id: selectedLink.id, status: statusFilter || undefined });
            setTravelRequests(travel.data?.data ?? []);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load requests");
        } finally {
            setLoading(false);
        }
    }, [selectedLink, statusFilter]);

    useEffect(() => { load(); }, [load]);

    // Poll every 30s when viewing PENDING
    useEffect(() => {
        if (statusFilter !== "PENDING") return;
        const timer = setInterval(load, 30_000);
        return () => clearInterval(timer);
    }, [statusFilter, load]);

    const openAssign = async (req: BookingVendorRequest) => {
        setAssigningReq(req);
        setAssignForm({ vehicle_id: 0, driver_user_id: "" });
        if (selectedLink) {
            try {
                const [vRes, dRes] = await Promise.all([
                    apiClient.getVendorVehicles(selectedLink.id),
                    apiClient.getVendorDrivers(selectedLink.id),
                ]);
                setVehicles(vRes?.data ?? []);
                setDrivers(dRes?.data ?? []);
            } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load fleet"); }
        }
    };

    const openTravelAssign = async (req: any) => {
        setAssigningTravel(req);
        setAssigningReq(null);
        setAssignForm({ vehicle_id: 0, driver_user_id: "" });
        if (selectedLink) {
            try {
                const [vRes, dRes] = await Promise.all([
                    apiClient.getVendorVehicles(selectedLink.id),
                    apiClient.getVendorDrivers(selectedLink.id),
                ]);
                setVehicles(vRes?.data ?? []);
                setDrivers(dRes?.data ?? []);
            } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load fleet"); }
        }
    };

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignForm.vehicle_id || !assignForm.driver_user_id) {
            toast.error("Please select both a vehicle and driver");
            return;
        }
        setAssigning(true);
        try {
            if (assigningTravel) {
                await apiClient.assignVendorTravelRequest(assigningTravel.id, {
                    vehicle_id: assignForm.vehicle_id,
                    driver_user_id: assignForm.driver_user_id,
                });
                toast.success("Travel rental request accepted");
                setAssigningTravel(null);
            } else if (assigningReq) {
                await apiClient.assignVendorRequest(assigningReq.id, {
                    vehicle_id: assignForm.vehicle_id,
                    driver_user_id: assignForm.driver_user_id,
                });
                toast.success("Booking request accepted");
                setAssigningReq(null);
            }
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to assign");
        } finally {
            setAssigning(false);
        }
    };

    const handleReject = async (req: BookingVendorRequest) => {
        if (!confirm("Reject this booking request?")) return;
        try {
            await apiClient.rejectVendorRequest(req.id);
            toast.success("Request rejected");
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to reject request");
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-[#0c225e]">Booking Requests</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {selectedLink ? `For: ${selectedLink.companies?.name ?? `Link #${selectedLink.id}`}` : "Select a company from the sidebar"}
                    </p>
                </div>
                <div className="flex gap-2">
                    {["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={cx(
                                "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                                statusFilter === s ? "bg-[#0c225e] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                            {["Booking Date", "Pickup", "Package", "Passenger", "Status", "Actions"].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
                        ) : requests.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No {statusFilter.toLowerCase()} requests</td></tr>
                        ) : requests.map((req) => {
                            const booking = req.chauffeur_bookings;
                            return (
                                <tr key={req.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                        {booking?.scheduled_for ? new Date(booking.scheduled_for).toLocaleDateString() : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">
                                        {booking?.pickup_address ?? "—"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {booking?.package_selected ?? "—"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {booking?.users_chauffeur_bookings_passenger_idTousers?.full_name ?? "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={cx("inline-flex px-2 py-0.5 rounded-full text-xs font-semibold", STATUS_COLORS[req.status] ?? "bg-gray-100 text-gray-500")}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {req.status === "PENDING" && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openAssign(req)}
                                                    className="text-xs bg-[#f47f00] text-white px-3 py-1.5 rounded-lg font-medium hover:bg-[#d96e00]"
                                                >
                                                    Assign & Accept
                                                </button>
                                                <button
                                                    onClick={() => handleReject(req)}
                                                    className="text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded-lg font-medium hover:bg-red-50"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {travelRequests.length > 0 && (
                <div className="bg-white rounded-xl border overflow-hidden">
                    <h2 className="px-4 py-3 font-bold text-[#0c225e]">Travel rental requests</h2>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-left">
                                <th className="px-4 py-2">Employee</th>
                                <th className="px-4 py-2">Route</th>
                                <th className="px-4 py-2">Mile</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {travelRequests.map((req) => (
                                <tr key={req.id} className="border-t">
                                    <td className="px-4 py-3">{req.travel_booking?.employee?.full_name}</td>
                                    <td className="px-4 py-3">{req.travel_booking?.quote?.origin} - {req.travel_booking?.quote?.destination}</td>
                                    <td className="px-4 py-3">{req.mile}</td>
                                    <td className="px-4 py-3">{req.status}</td>
                                    <td className="px-4 py-3">
                                        {req.status === "PENDING" && (
                                            <button onClick={() => openTravelAssign(req)} className="text-xs bg-[#f47f00] text-white px-3 py-1.5 rounded-lg font-medium">Assign & Accept</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Assign Modal */}
            {(assigningReq || assigningTravel) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Assign & Accept Request</h2>
                            <button onClick={() => { setAssigningReq(null); setAssigningTravel(null); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            {assigningTravel
                              ? `Travel #${assigningTravel.travel_booking_id} · ${assigningTravel.mile}`
                              : `Booking #${assigningReq?.booking_id} · ${assigningReq?.chauffeur_bookings?.pickup_address ?? ""}`}
                        </p>
                        <form onSubmit={handleAssign} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Select Vehicle *</label>
                                <select required value={assignForm.vehicle_id} onChange={(e) => setAssignForm((f) => ({ ...f, vehicle_id: Number(e.target.value) }))} className={inputCls}>
                                    <option value={0}>— Choose Vehicle —</option>
                                    {vehicles.map((v) => (
                                        <option key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Select Driver *</label>
                                <select required value={assignForm.driver_user_id} onChange={(e) => setAssignForm((f) => ({ ...f, driver_user_id: e.target.value }))} className={inputCls}>
                                    <option value="">— Choose Driver —</option>
                                    {drivers.map((d) => (
                                        <option key={d.user_id} value={d.user_id}>{d.users.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => { setAssigningReq(null); setAssigningTravel(null); }} className={cancelBtnCls}>Cancel</button>
                                <button type="submit" disabled={assigning} className={saveBtnCls}>{assigning ? "Assigning…" : "Confirm Assignment"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#f47f00]";
const saveBtnCls = "bg-[#f47f00] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#d96e00] disabled:opacity-50";
const cancelBtnCls = "border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50";
