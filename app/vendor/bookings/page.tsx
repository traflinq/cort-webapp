"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../../lib/services/api-client";
import { ChauffeurBooking } from "../../lib/services/types/bookings";
import { useVendorContext } from "../layout";
import { toast } from "sonner";

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

const STATUS_COLORS: Record<string, string> = {
    PENDING:     "bg-yellow-50 text-yellow-700 border-yellow-200",
    ASSIGNED:    "bg-blue-50 text-blue-700 border-blue-200",
    OTW:         "bg-indigo-50 text-indigo-700 border-indigo-200",
    ARRIVED:     "bg-purple-50 text-purple-700 border-purple-200",
    IN_PROGRESS: "bg-orange-50 text-orange-700 border-orange-200",
    DROPPED_OFF: "bg-teal-50 text-teal-700 border-teal-200",
    ENDED:       "bg-gray-100 text-gray-600 border-gray-200",
    COMPLETED:   "bg-green-50 text-green-700 border-green-200",
    CANCELLED:   "bg-red-50 text-red-600 border-red-200",
};

const STATUS_TABS = ["All", "ASSIGNED", "OTW", "ARRIVED", "IN_PROGRESS", "ENDED", "COMPLETED"];

interface EndTripForm {
    total_distance_km: string;
    expense_toll: string;
    expense_parking: string;
    end_time: string;
}

export default function VendorBookingsPage() {
    const { selectedLink } = useVendorContext();

    const [bookings, setBookings] = useState<ChauffeurBooking[]>([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 1 });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);

    // Detail modal
    const [selectedBooking, setSelectedBooking] = useState<ChauffeurBooking | null>(null);

    // End trip modal
    const [showEndModal, setShowEndModal] = useState(false);
    const [endTripTarget, setEndTripTarget] = useState<ChauffeurBooking | null>(null);
    const [endForm, setEndForm] = useState<EndTripForm>({
        total_distance_km: "",
        expense_toll: "",
        expense_parking: "",
        end_time: "",
    });
    const [isEnding, setIsEnding] = useState(false);
    const [isStarting, setIsStarting] = useState<number | null>(null);
    const [isUpdating, setIsUpdating] = useState<number | null>(null);
    const [travelRequests, setTravelRequests] = useState<any[]>([]);

    const load = useCallback(async (page: number) => {
        if (!selectedLink) return;
        setLoading(true);
        try {
            const res = await apiClient.getVendorBookings({
                link_id: selectedLink.id,
                status: statusFilter === "All" ? undefined : statusFilter,
                page,
                limit: 15,
            }) as any;
            const raw = res?.data ?? res;
            setBookings(raw?.data ?? []);
            setPagination(raw?.pagination ?? { page: 1, total: 0, total_pages: 1 });
            const travel = await apiClient.getVendorTravelRequests({
                link_id: selectedLink.id,
                limit: 20,
            });
            setTravelRequests(travel.data?.data ?? []);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load bookings");
        } finally {
            setLoading(false);
        }
    }, [selectedLink, statusFilter]);

    useEffect(() => {
        setCurrentPage(1);
        load(1);
    }, [load]);

    // Poll every 30s when viewing ASSIGNED
    useEffect(() => {
        if (statusFilter !== "ASSIGNED") return;
        const timer = setInterval(() => load(currentPage), 30_000);
        return () => clearInterval(timer);
    }, [statusFilter, currentPage, load]);

    const handleUpdateStatus = async (booking: ChauffeurBooking, status: 'OTW' | 'ARRIVED') => {
        setIsUpdating(booking.id);
        try {
            await apiClient.vendorUpdateStatus(booking.id, status);
            toast.success(`Status updated to ${status}`);
            load(currentPage);
            if (selectedBooking?.id === booking.id) setSelectedBooking((b) => b ? { ...b, status: status as ChauffeurBooking['status'] } : b);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : `Failed to update status`);
        } finally {
            setIsUpdating(null);
        }
    };

    const handleStartTrip = async (booking: ChauffeurBooking) => {
        if (!confirm(`Start trip for Booking #${booking.id}?`)) return;
        setIsStarting(booking.id);
        try {
            await apiClient.vendorStartTrip(booking.id);
            toast.success("Trip started — status is now IN_PROGRESS");
            if (selectedBooking?.id === booking.id) setSelectedBooking((b) => b ? { ...b, status: 'IN_PROGRESS' as ChauffeurBooking['status'] } : b);
            load(currentPage);
            setSelectedBooking(null);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to start trip");
        } finally {
            setIsStarting(null);
        }
    };

    const openEndModal = (booking: ChauffeurBooking) => {
        setEndTripTarget(booking);
        setEndForm({ total_distance_km: "", expense_toll: "", expense_parking: "", end_time: "" });
        setShowEndModal(true);
    };

    const handleEndTrip = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!endTripTarget) return;
        const km = parseFloat(endForm.total_distance_km);
        if (isNaN(km) || km < 0) {
            toast.error("Please enter a valid distance in km");
            return;
        }
        setIsEnding(true);
        try {
            await apiClient.vendorEndTrip(endTripTarget.id, {
                total_distance_km: km,
                expense_toll: endForm.expense_toll ? parseFloat(endForm.expense_toll) : undefined,
                expense_parking: endForm.expense_parking ? parseFloat(endForm.expense_parking) : undefined,
                end_time: endForm.end_time || undefined,
            });
            toast.success("Trip completed successfully");
            setShowEndModal(false);
            setEndTripTarget(null);
            setSelectedBooking(null);
            load(currentPage);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to end trip");
        } finally {
            setIsEnding(false);
        }
    };

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleString("en-US", {
            timeZone: "Asia/Karachi",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-[#0c225e]">Bookings</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {selectedLink
                            ? `Confirmed bookings for: ${selectedLink.companies?.name ?? `Link #${selectedLink.id}`}`
                            : "Select a company from the sidebar"}
                    </p>
                </div>
                <button
                    onClick={() => load(currentPage)}
                    className="text-xs text-[#0c225e] border border-[#0c225e]/20 px-3 py-1.5 rounded-lg hover:bg-[#0c225e]/5 transition-colors"
                >
                    Refresh
                </button>
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
                                <th className="px-4 py-2">Driver / vehicle</th>
                                <th className="px-4 py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {travelRequests.map((req) => (
                                <tr key={req.id} className="border-t">
                                    <td className="px-4 py-3">{req.travel_booking?.employee?.full_name}</td>
                                    <td className="px-4 py-3">{req.travel_booking?.quote?.origin} - {req.travel_booking?.quote?.destination}</td>
                                    <td className="px-4 py-3">{req.mile}</td>
                                    <td className="px-4 py-3">{req.assigned_driver?.full_name || "—"} {req.assigned_vehicle?.plate_number || ""}</td>
                                    <td className="px-4 py-3">{req.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Status Tabs */}
            <div className="flex gap-2 flex-wrap">
                {STATUS_TABS.map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={cx(
                            "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                            statusFilter === s
                                ? "bg-[#0c225e] text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        {s === "All" ? "All" : s.replace("_", " ")}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            {["#", "Date", "Pickup", "Passenger", "Driver", "Vehicle", "Package", "Status", "Actions"].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                                    Loading…
                                </td>
                            </tr>
                        ) : bookings.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                                    No {statusFilter === "All" ? "" : statusFilter.replace("_", " ").toLowerCase() + " "}bookings found
                                </td>
                            </tr>
                        ) : (
                            bookings.map((b) => (
                                <tr
                                    key={b.id}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => setSelectedBooking(b)}
                                >
                                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">#{b.id}</td>
                                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                                        {b.scheduled_for ? formatDate(b.scheduled_for) : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate text-xs">
                                        {b.pickup_address ?? "—"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 text-xs">
                                        {b.users_chauffeur_bookings_passenger_idTousers?.full_name ?? "—"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 text-xs">
                                        {b.users_chauffeur_bookings_driver_idTousers?.full_name ?? (
                                            <span className="text-gray-400 italic">Unassigned</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 text-xs">
                                        {b.vehicles ? `${b.vehicles.plate_number}` : (
                                            <span className="text-gray-400 italic">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 text-xs">
                                        {b.package_selected ?? "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={cx(
                                            "inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                                            STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-500 border-gray-200"
                                        )}>
                                            {b.status.replace("_", " ")}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex flex-col gap-1">
                                            {b.status === "ASSIGNED" && (
                                                <button
                                                    onClick={() => handleUpdateStatus(b, 'OTW')}
                                                    disabled={isUpdating === b.id}
                                                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                                                >
                                                    {isUpdating === b.id ? "Updating…" : "Mark OTW"}
                                                </button>
                                            )}
                                            {b.status === "OTW" && (
                                                <button
                                                    onClick={() => handleUpdateStatus(b, 'ARRIVED')}
                                                    disabled={isUpdating === b.id}
                                                    className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
                                                >
                                                    {isUpdating === b.id ? "Updating…" : "Mark Arrived"}
                                                </button>
                                            )}
                                            {b.status === "ARRIVED" && (
                                                <button
                                                    onClick={() => handleStartTrip(b)}
                                                    disabled={isStarting === b.id}
                                                    className="text-xs bg-[#0c225e] text-white px-3 py-1.5 rounded-lg font-medium hover:bg-[#0a1a4a] disabled:opacity-50 whitespace-nowrap"
                                                >
                                                    {isStarting === b.id ? "Starting…" : "Start Trip"}
                                                </button>
                                            )}
                                            {b.status === "IN_PROGRESS" && (
                                                <button
                                                    onClick={() => openEndModal(b)}
                                                    className="text-xs bg-[#f47f00] text-white px-3 py-1.5 rounded-lg font-medium hover:bg-[#d96e00] whitespace-nowrap"
                                                >
                                                    End Trip
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {pagination.total_pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                        <span>{pagination.total} total bookings</span>
                        <div className="flex gap-1">
                            <button
                                disabled={currentPage <= 1}
                                onClick={() => { setCurrentPage(p => p - 1); load(currentPage - 1); }}
                                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                            >
                                ←
                            </button>
                            <span className="px-2 py-1">
                                {currentPage} / {pagination.total_pages}
                            </span>
                            <button
                                disabled={currentPage >= pagination.total_pages}
                                onClick={() => { setCurrentPage(p => p + 1); load(currentPage + 1); }}
                                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                            >
                                →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedBooking(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h2 className="text-lg font-bold text-[#0c225e]">Booking #{selectedBooking.id}</h2>
                                <span className={cx(
                                    "inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border mt-1",
                                    STATUS_COLORS[selectedBooking.status] ?? "bg-gray-100 text-gray-500 border-gray-200"
                                )}>
                                    {selectedBooking.status.replace("_", " ")}
                                </span>
                            </div>
                            <button onClick={() => setSelectedBooking(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {/* Booking Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Scheduled For</p>
                                    <p className="font-medium text-gray-800">
                                        {selectedBooking.scheduled_for ? formatDate(selectedBooking.scheduled_for) : "—"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Trip Type</p>
                                    <p className="font-medium text-gray-800">{selectedBooking.trip_type ?? "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Package</p>
                                    <p className="font-medium text-gray-800">{selectedBooking.package_selected ?? "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Days</p>
                                    <p className="font-medium text-gray-800">{selectedBooking.no_of_days ?? 1}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs text-gray-400 mb-0.5">Pickup Address</p>
                                    <p className="font-medium text-gray-800">{selectedBooking.pickup_address ?? "—"}</p>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Passenger</p>
                                    <p className="font-medium text-gray-800">
                                        {selectedBooking.users_chauffeur_bookings_passenger_idTousers?.full_name ?? "—"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Passenger Phone</p>
                                    <p className="font-medium text-gray-800">
                                        {selectedBooking.users_chauffeur_bookings_passenger_idTousers?.phone ?? "—"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Assigned Driver</p>
                                    <p className="font-medium text-gray-800">
                                        {selectedBooking.users_chauffeur_bookings_driver_idTousers?.full_name ?? (
                                            <span className="text-gray-400 italic">Not yet assigned</span>
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Driver Phone</p>
                                    <p className="font-medium text-gray-800">
                                        {selectedBooking.users_chauffeur_bookings_driver_idTousers?.phone ?? "—"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Vehicle</p>
                                    <p className="font-medium text-gray-800">
                                        {selectedBooking.vehicles
                                            ? `${selectedBooking.vehicles.plate_number} · ${selectedBooking.vehicles.model}`
                                            : "—"}
                                    </p>
                                </div>
                            </div>

                            {/* Trip Log (if started) */}
                            {selectedBooking.chauffeur_trip_logs && (
                                <div className="border-t border-gray-100 pt-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Trip Log</p>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-xs text-gray-400 mb-0.5">Start Time</p>
                                            <p className="font-medium text-gray-800">
                                                {selectedBooking.chauffeur_trip_logs.start_time
                                                    ? formatDate(selectedBooking.chauffeur_trip_logs.start_time as unknown as string)
                                                    : "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-0.5">End Time</p>
                                            <p className="font-medium text-gray-800">
                                                {selectedBooking.chauffeur_trip_logs.end_time
                                                    ? formatDate(selectedBooking.chauffeur_trip_logs.end_time as unknown as string)
                                                    : <span className="text-gray-400 italic">In progress</span>}
                                            </p>
                                        </div>
                                        {selectedBooking.chauffeur_trip_logs.total_distance_km != null && (
                                            <div>
                                                <p className="text-xs text-gray-400 mb-0.5">Distance</p>
                                                <p className="font-medium text-gray-800">
                                                    {Number(selectedBooking.chauffeur_trip_logs.total_distance_km).toFixed(1)} km
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="px-6 pb-5 flex justify-end gap-3 flex-wrap">
                            {selectedBooking.status === "ASSIGNED" && (
                                <button
                                    onClick={() => handleUpdateStatus(selectedBooking, 'OTW')}
                                    disabled={isUpdating === selectedBooking.id}
                                    className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {isUpdating === selectedBooking.id ? "Updating…" : "Mark OTW"}
                                </button>
                            )}
                            {selectedBooking.status === "OTW" && (
                                <button
                                    onClick={() => handleUpdateStatus(selectedBooking, 'ARRIVED')}
                                    disabled={isUpdating === selectedBooking.id}
                                    className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
                                >
                                    {isUpdating === selectedBooking.id ? "Updating…" : "Mark Arrived"}
                                </button>
                            )}
                            {selectedBooking.status === "ARRIVED" && (
                                <button
                                    onClick={() => handleStartTrip(selectedBooking)}
                                    disabled={isStarting === selectedBooking.id}
                                    className="bg-[#0c225e] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a1a4a] disabled:opacity-50"
                                >
                                    {isStarting === selectedBooking.id ? "Starting…" : "Start Trip"}
                                </button>
                            )}
                            {selectedBooking.status === "IN_PROGRESS" && (
                                <button
                                    onClick={() => { setSelectedBooking(null); openEndModal(selectedBooking); }}
                                    className="bg-[#f47f00] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#d96e00]"
                                >
                                    End Trip
                                </button>
                            )}
                            <button onClick={() => setSelectedBooking(null)} className="text-gray-600 border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* End Trip Modal */}
            {showEndModal && endTripTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h2 className="text-lg font-bold text-[#0c225e]">End Trip</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Booking #{endTripTarget.id} · {endTripTarget.pickup_address}</p>
                            </div>
                            <button onClick={() => { setShowEndModal(false); setEndTripTarget(null); }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
                        </div>

                        <form onSubmit={handleEndTrip} className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Total Distance (km) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    required
                                    value={endForm.total_distance_km}
                                    onChange={(e) => setEndForm((f) => ({ ...f, total_distance_km: e.target.value }))}
                                    placeholder="e.g. 45.5"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0c225e]/20 focus:border-[#0c225e]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Toll Expenses (PKR)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={endForm.expense_toll}
                                        onChange={(e) => setEndForm((f) => ({ ...f, expense_toll: e.target.value }))}
                                        placeholder="0"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0c225e]/20 focus:border-[#0c225e]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Parking Expenses (PKR)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={endForm.expense_parking}
                                        onChange={(e) => setEndForm((f) => ({ ...f, expense_parking: e.target.value }))}
                                        placeholder="0"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0c225e]/20 focus:border-[#0c225e]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    End Time Override <span className="text-gray-400 text-xs font-normal">(optional — defaults to now)</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={endForm.end_time}
                                    onChange={(e) => setEndForm((f) => ({ ...f, end_time: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0c225e]/20 focus:border-[#0c225e]"
                                />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="submit"
                                    disabled={isEnding}
                                    className="flex-1 bg-[#f47f00] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#d96e00] disabled:opacity-50"
                                >
                                    {isEnding ? "Ending Trip…" : "Confirm End Trip"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowEndModal(false); setEndTripTarget(null); }}
                                    className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
