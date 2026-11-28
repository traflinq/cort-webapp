"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { GripVertical, Trash2 } from "@/app/components/icons";
import { toast } from "sonner";
import { apiClient } from "@/app/lib/services/api-client";
import { VendorVehicle, VendorDriver } from "@/app/lib/services/types/multi-mode";
import { useVendorContext } from "../../layout";
import StopAddressSearch from "@/app/admin/ui/StopAddressSearch";
import type { MapMarker, MapPolyline } from "@/app/admin/ui/Map";

const Map = dynamic(() => import("@/app/admin/ui/Map"), { ssr: false });

interface Stop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    morningEta: string;
    eveningEta: string;
}

type PolylineResponse = { points: { lat: number; lng: number }[] };

export default function VendorCreateRoutePage() {
    const router = useRouter();
    const { selectedLink } = useVendorContext();

    const [name, setName] = useState("");
    const [assignedVehicleId, setAssignedVehicleId] = useState("");
    const [assignedDriverId, setAssignedDriverId] = useState("");
    const [stops, setStops] = useState<Stop[]>([]);
    const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
    const [saving, setSaving] = useState(false);

    const [vehicles, setVehicles] = useState<VendorVehicle[]>([]);
    const [drivers, setDrivers] = useState<VendorDriver[]>([]);

    const polylineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Guard
    const servesShuttle = selectedLink?.serves_shuttle ?? false;

    useEffect(() => {
        if (!selectedLink) return;
        apiClient.getVendorVehicles(selectedLink.id)
            .then((r) => setVehicles(r.data))
            .catch(() => {});
        apiClient.getVendorDrivers(selectedLink.id)
            .then((r) => setDrivers(r.data))
            .catch(() => {});
    }, [selectedLink]);

    // Polyline preview
    const fetchPreviewPolyline = useCallback(async (currentStops: Stop[]) => {
        if (currentStops.length < 2) {
            setRoutePolyline([]);
            return;
        }
        try {
            const data = await apiClient.previewVendorRoutePolyline(
                currentStops.map((s) => ({ lat: s.lat, lng: s.lng })),
            );
            setRoutePolyline(data.points.map((p) => [p.lat, p.lng] as [number, number]));
        } catch {
            setRoutePolyline(currentStops.map((s) => [s.lat, s.lng] as [number, number]));
        }
    }, []);

    const schedulePolylineUpdate = useCallback(
        (updatedStops: Stop[]) => {
            if (polylineDebounceRef.current) clearTimeout(polylineDebounceRef.current);
            polylineDebounceRef.current = setTimeout(() => fetchPreviewPolyline(updatedStops), 600);
        },
        [fetchPreviewPolyline],
    );

    // Add stop from address search
    const handleAddressSelect = useCallback(
        ({ name: stopName, lat, lng }: { name: string; lat: number; lng: number }) => {
            const newStop: Stop = {
                id: crypto.randomUUID(),
                name: stopName,
                lat,
                lng,
                morningEta: "08:00",
                eveningEta: "18:00",
            };
            setStops((prev) => {
                const updated = [...prev, newStop];
                schedulePolylineUpdate(updated);
                return updated;
            });
            toast.success(`Stop "${stopName}" added`);
        },
        [schedulePolylineUpdate],
    );

    // Add stop from map click
    const handleMapClick = useCallback(
        (lat: number, lng: number) => {
            const newStop: Stop = {
                id: crypto.randomUUID(),
                name: `Stop ${stops.length + 1}`,
                lat,
                lng,
                morningEta: "08:00",
                eveningEta: "18:00",
            };
            setStops((prev) => {
                const updated = [...prev, newStop];
                schedulePolylineUpdate(updated);
                return updated;
            });
        },
        [stops.length, schedulePolylineUpdate],
    );

    const handleRemoveStop = useCallback(
        (id: string) => {
            setStops((prev) => {
                const updated = prev.filter((s) => s.id !== id);
                schedulePolylineUpdate(updated);
                return updated;
            });
        },
        [schedulePolylineUpdate],
    );

    const handleStopChange = useCallback((id: string, field: keyof Stop, value: string) => {
        setStops((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLink) {
            toast.error("No company link selected");
            return;
        }
        if (!name.trim()) {
            toast.error("Route name is required");
            return;
        }
        if (stops.length < 2) {
            toast.error("A route must have at least 2 stops");
            return;
        }
        setSaving(true);
        try {
            await apiClient.createVendorRoute({
                name: name.trim(),
                company_vendor_link_id: selectedLink.id,
                assigned_vehicle_id: assignedVehicleId ? Number(assignedVehicleId) : undefined,
                assigned_driver_id: assignedDriverId || undefined,
                stops: stops.map((stop, index) => ({
                    name: stop.name,
                    lat: stop.lat,
                    lng: stop.lng,
                    morning_eta: stop.morningEta,
                    evening_eta: stop.eveningEta,
                    sequence_order: index + 1,
                })),
            });
            toast.success("Route created successfully!");
            router.push("/vendor/routes");
        } catch (err: any) {
            toast.error(err?.message ?? "Failed to create route");
        } finally {
            setSaving(false);
        }
    };

    // Map data
    const mapMarkers: MapMarker[] = stops.map((s, index) => ({
        id: s.id,
        position: [s.lat, s.lng],
        label: `${index + 1}. ${s.name}`,
        color: index === 0 ? "#22c55e" : index === stops.length - 1 ? "#ef4444" : "#6366f1",
    }));

    const mapPolylines: MapPolyline[] =
        routePolyline.length >= 2
            ? [{ positions: routePolyline, color: "#0C225E" }]
            : stops.length > 1
            ? [{ positions: stops.map((s) => [s.lat, s.lng] as [number, number]), color: "#2563eb" }]
            : [];

    if (!servesShuttle) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[50vh]">
                <div className="text-center max-w-sm">
                    <div className="text-4xl mb-4">🚌</div>
                    <h2 className="text-lg font-bold text-gray-800 mb-2">Shuttle Routes Unavailable</h2>
                    <p className="text-sm text-gray-500">
                        Your link to this company does not include shuttle service.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col p-6">
            {/* Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-[#0c225e]">Create New Route</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Company:{" "}
                        <span className="font-medium">
                            {selectedLink?.companies?.name ?? `Link #${selectedLink?.id}`}
                        </span>
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className={cancelBtnCls}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className={saveBtnCls}
                    >
                        {saving ? "Saving…" : "Save Route"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Left Panel */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col h-full overflow-hidden gap-4">
                    {/* Route Details */}
                    <div className="space-y-3 shrink-0">
                        <div>
                            <label className={labelCls}>Route Name *</label>
                            <input
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={inputCls}
                                placeholder="e.g., Route 1 — Gulshan to DHA"
                            />
                        </div>

                        {/* Company — read-only from selectedLink */}
                        <div>
                            <label className={labelCls}>Company</label>
                            <input
                                readOnly
                                value={selectedLink?.companies?.name ?? (selectedLink ? `Link #${selectedLink.id}` : "")}
                                className={`${inputCls} bg-gray-50 text-gray-500 cursor-default`}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className={labelCls}>Vehicle</label>
                                <select
                                    className={selectCls}
                                    value={assignedVehicleId}
                                    onChange={(e) => setAssignedVehicleId(e.target.value)}
                                >
                                    <option value="">None</option>
                                    {vehicles.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.plate_number}{v.model ? ` · ${v.model}` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Driver</label>
                                <select
                                    className={selectCls}
                                    value={assignedDriverId}
                                    onChange={(e) => setAssignedDriverId(e.target.value)}
                                >
                                    <option value="">None</option>
                                    {drivers.map((d) => (
                                        <option key={d.user_id} value={d.user_id}>
                                            {d.users.full_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Stop Search */}
                    <div className="shrink-0">
                        <label className={labelCls}>Add Stop by Address</label>
                        <StopAddressSearch
                            onSelect={handleAddressSelect}
                            placeholder="Search for a location…"
                            clearOnSelect
                            className="mt-1"
                        />
                        <p className="text-xs text-gray-400 mt-1.5">
                            Or click anywhere on the map to pin a stop.
                        </p>
                    </div>

                    {/* Stops List */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm">
                                Stops
                                <span className="ml-1.5 text-xs text-gray-400 font-normal">
                                    ({stops.length})
                                </span>
                            </h3>
                        </div>

                        {stops.length === 0 && (
                            <p className="text-sm text-gray-400 italic text-center py-6">
                                No stops yet — search above or click the map.
                            </p>
                        )}

                        <div className="space-y-2">
                            {stops.map((stop, index) => (
                                <div
                                    key={stop.id}
                                    className="border border-gray-200 rounded-lg p-3 bg-gray-50 group"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                                        <span
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                            style={{
                                                backgroundColor:
                                                    index === 0
                                                        ? "#22c55e"
                                                        : index === stops.length - 1
                                                        ? "#ef4444"
                                                        : "#6366f1",
                                            }}
                                        >
                                            {index + 1}
                                        </span>
                                        <input
                                            value={stop.name}
                                            onChange={(e) => handleStopChange(stop.id, "name", e.target.value)}
                                            className="border border-gray-200 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-[#f47f00]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveStop(stop.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 p-0.5 shrink-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs pl-10">
                                        <div>
                                            <label className="block text-gray-500 mb-0.5">AM pickup</label>
                                            <input
                                                type="time"
                                                value={stop.morningEta}
                                                onChange={(e) => handleStopChange(stop.id, "morningEta", e.target.value)}
                                                className="border border-gray-200 rounded px-1.5 py-0.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-[#f47f00]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-500 mb-0.5">PM dropoff</label>
                                            <input
                                                type="time"
                                                value={stop.eveningEta}
                                                onChange={(e) => handleStopChange(stop.id, "eveningEta", e.target.value)}
                                                className="border border-gray-200 rounded px-1.5 py-0.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-[#f47f00]"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 pl-10 mt-1">
                                        {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {stops.length >= 2 && (
                        <div className="shrink-0 flex items-center gap-2 text-xs text-gray-400 border-t pt-2">
                            <div className="w-2 h-2 rounded-full bg-[#0C225E]" />
                            Road-following route via Google Maps
                        </div>
                    )}
                </div>

                {/* Map Panel */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:col-span-2 h-full">
                    <Map
                        height="100%"
                        onMapClick={handleMapClick}
                        markers={mapMarkers}
                        polylines={mapPolylines}
                        center={stops.length > 0 ? [stops[0].lat, stops[0].lng] : undefined}
                    />
                </div>
            </div>
        </div>
    );
}

const labelCls = "block text-xs font-medium text-gray-700 mb-1";
const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#f47f00]";
const selectCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#f47f00]";
const saveBtnCls =
    "bg-[#f47f00] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#d96e00] disabled:opacity-50";
const cancelBtnCls =
    "border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50";
