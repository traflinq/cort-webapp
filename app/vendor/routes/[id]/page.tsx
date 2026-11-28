"use client";

import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
    ChevronLeft,
    Edit,
    Info,
    MapPin,
    Plus,
    Save,
    Trash,
    X,
} from "@/app/components/icons";
import { apiClient } from "@/app/lib/services/api-client";
import { VendorRoute, VendorVehicle, VendorDriver } from "@/app/lib/services/types/multi-mode";
import { useVendorContext } from "../../layout";
import StopAddressSearch from "@/app/admin/ui/StopAddressSearch";
import type { MapMarker, MapPolyline } from "@/app/admin/ui/Map";

const Map = dynamic(() => import("@/app/admin/ui/Map"), { ssr: false });

type PolylineResponse = { points: { lat: number; lng: number }[] };

interface StopForm {
    name: string;
    lat: string;
    lng: string;
    morning_eta: string;
    evening_eta: string;
    sequence_order: string;
}

export default function VendorRouteDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const { selectedLink } = useVendorContext();

    const [route, setRoute] = useState<VendorRoute | null>(null);
    const [loading, setLoading] = useState(true);
    const [vehicles, setVehicles] = useState<VendorVehicle[]>([]);
    const [drivers, setDrivers] = useState<VendorDriver[]>([]);

    // Edit route details
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        assigned_vehicle_id: "",
        assigned_driver_id: "",
    });

    // Stop form
    const [editingStopId, setEditingStopId] = useState<number | null>(null);
    const [isAddingStop, setIsAddingStop] = useState(false);
    const [stopForm, setStopForm] = useState<StopForm>({
        name: "",
        lat: "",
        lng: "",
        morning_eta: "",
        evening_eta: "",
        sequence_order: "",
    });

    // Polyline
    const [savedPolyline, setSavedPolyline] = useState<[number, number][]>([]);
    const polylineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Load route ───────────────────────────────────────────────────────────

    const loadRoute = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.getVendorRoute(parseInt(id));
            setRoute(res.data);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load route");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadRoute();
    }, [loadRoute]);

    useEffect(() => {
        if (!selectedLink) return;
        apiClient.getVendorVehicles(selectedLink.id).then((r) => setVehicles(r.data)).catch(() => {});
        apiClient.getVendorDrivers(selectedLink.id).then((r) => setDrivers(r.data)).catch(() => {});
    }, [selectedLink]);

    useEffect(() => {
        if (route) {
            setEditForm({
                name: route.name,
                assigned_vehicle_id: route.assigned_vehicle_id?.toString() ?? "",
                assigned_driver_id: route.assigned_driver_id ?? "",
            });
            fetchSavedPolyline();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route?.id]);

    // ─── Polyline ─────────────────────────────────────────────────────────────

    const fetchSavedPolyline = useCallback(async () => {
        try {
            const data = await apiClient.getVendorRoutePolyline(parseInt(id));
            setSavedPolyline(data.points.map((p) => [p.lat, p.lng] as [number, number]));
        } catch {
            setSavedPolyline([]);
        }
    }, [id]);

    const schedulePolylineRefresh = useCallback(() => {
        if (polylineDebounceRef.current) clearTimeout(polylineDebounceRef.current);
        polylineDebounceRef.current = setTimeout(fetchSavedPolyline, 800);
    }, [fetchSavedPolyline]);

    // ─── Route edit helpers ───────────────────────────────────────────────────

    const handleSaveDetails = async () => {
        if (!route) return;
        try {
            await apiClient.updateVendorRoute(route.id, {
                name: editForm.name,
                assigned_vehicle_id: editForm.assigned_vehicle_id
                    ? parseInt(editForm.assigned_vehicle_id)
                    : null,
                assigned_driver_id: editForm.assigned_driver_id || null,
            });
            toast.success("Route updated");
            setIsEditing(false);
            loadRoute();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update route");
        }
    };

    // ─── Stop form helpers ────────────────────────────────────────────────────

    const resetStopForm = () => {
        setStopForm({ name: "", lat: "", lng: "", morning_eta: "", evening_eta: "", sequence_order: "" });
        setEditingStopId(null);
        setIsAddingStop(false);
    };

    const handleStopEditClick = (stop: NonNullable<VendorRoute["route_stops"]>[number]) => {
        setStopForm({
            name: stop.name,
            lat: stop.lat?.toString() ?? "",
            lng: stop.lng?.toString() ?? "",
            morning_eta: stop.morning_eta ?? "",
            evening_eta: stop.evening_eta ?? "",
            sequence_order: stop.sequence_order.toString(),
        });
        setEditingStopId(stop.id);
        setIsAddingStop(false);
    };

    const handleStopAddClick = () => {
        resetStopForm();
        const maxOrder =
            route?.route_stops?.reduce((max, s) => Math.max(max, s.sequence_order), 0) ?? 0;
        setStopForm((prev) => ({ ...prev, sequence_order: (maxOrder + 1).toString() }));
        setIsAddingStop(true);
    };

    const handleAddressSelect = useCallback(
        ({ name, lat, lng }: { name: string; lat: number; lng: number }) => {
            setStopForm((prev) => ({
                ...prev,
                name,
                lat: lat.toFixed(6),
                lng: lng.toFixed(6),
            }));
        },
        [],
    );

    const handleStopSubmit = async () => {
        if (!route) return;
        if (!stopForm.name || !stopForm.lat || !stopForm.lng || !stopForm.sequence_order) {
            toast.error("Name, location, and sequence order are required");
            return;
        }
        const data = {
            name: stopForm.name,
            lat: parseFloat(stopForm.lat),
            lng: parseFloat(stopForm.lng),
            morning_eta: stopForm.morning_eta || undefined,
            evening_eta: stopForm.evening_eta || undefined,
            sequence_order: parseInt(stopForm.sequence_order),
        };
        try {
            if (isAddingStop) {
                await apiClient.addVendorRouteStop(route.id, data);
                toast.success("Stop added");
            } else if (editingStopId) {
                await apiClient.updateVendorRouteStop(editingStopId, data);
                toast.success("Stop updated");
            }
            resetStopForm();
            loadRoute();
            schedulePolylineRefresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save stop");
        }
    };

    const handleStopDelete = async (stopId: number) => {
        if (!confirm("Delete this stop?")) return;
        try {
            await apiClient.deleteVendorRouteStop(stopId);
            toast.success("Stop deleted");
            if (editingStopId === stopId) resetStopForm();
            loadRoute();
            schedulePolylineRefresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete stop");
        }
    };

    const handleMarkerClick = (markerId: string) => {
        const stop = route?.route_stops?.find((s) => s.id === parseInt(markerId));
        if (stop) handleStopEditClick(stop);
    };

    const handleMapClick = (lat: number, lng: number) => {
        if (isAddingStop || editingStopId) {
            setStopForm((prev) => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
            toast.info("Coordinates updated from map click");
        }
    };

    // ─── Vehicles for select (include currently assigned even if not in list) ─

    const vehiclesForSelect = useMemo(() => {
        if (!route?.assigned_vehicle_id) return vehicles;
        const exists = vehicles.some((v) => v.id === route.assigned_vehicle_id);
        if (exists) return vehicles;
        // Try to find it in route.vehicles
        const current = route.vehicles;
        if (current && (current as any).id) {
            return [...vehicles, { ...(current as any), id: route.assigned_vehicle_id }];
        }
        return vehicles;
    }, [vehicles, route]);

    // ─── Map data ─────────────────────────────────────────────────────────────

    const mapMarkers: MapMarker[] = (() => {
        const base: MapMarker[] = (route?.route_stops ?? [])
            .filter((s) => s.lat != null && s.lng != null)
            .map((s) => {
                if (editingStopId === s.id && stopForm.lat && stopForm.lng) {
                    return {
                        id: s.id.toString(),
                        position: [parseFloat(stopForm.lat), parseFloat(stopForm.lng)] as [number, number],
                        label: stopForm.name || s.name,
                        color: "#f59e0b",
                    };
                }
                return {
                    id: s.id.toString(),
                    position: [s.lat!, s.lng!] as [number, number],
                    label: `${s.sequence_order}. ${s.name}`,
                    color: "#6366f1",
                };
            });

        if (isAddingStop && stopForm.lat && stopForm.lng) {
            base.push({
                id: "new-temp",
                position: [parseFloat(stopForm.lat), parseFloat(stopForm.lng)],
                label: stopForm.name || "New Stop",
                color: "#22c55e",
            });
        }
        return base;
    })();

    const mapPolylines: MapPolyline[] =
        savedPolyline.length >= 2
            ? [{ positions: savedPolyline, color: "#0C225E" }]
            : (() => {
                  const stops = (route?.route_stops ?? []).filter(
                      (s) => s.lat != null && s.lng != null,
                  );
                  return stops.length > 1
                      ? [{ positions: stops.map((s) => [s.lat!, s.lng!] as [number, number]), color: "#6366f1" }]
                      : [];
              })();

    // ─── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading route details…</div>;
    }
    if (!route) {
        return <div className="p-8 text-center text-gray-500">Route not found.</div>;
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-sm text-gray-600 hover:text-[#0c225e] transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </button>
                <div className="flex-1">
                    {isEditing ? (
                        <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xl font-bold max-w-md focus:outline-none focus:ring-1 focus:ring-[#f47f00]"
                        />
                    ) : (
                        <h1 className="text-2xl font-bold text-[#0c225e] flex items-center gap-2">
                            {route.name}
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-gray-400 hover:text-[#f47f00]"
                            >
                                <Edit className="w-4 h-4" />
                            </button>
                        </h1>
                    )}
                    <div className="text-gray-500 text-sm mt-1">
                        Route ID: {route.id} · {route.route_stops?.length ?? 0} stops
                    </div>
                </div>
                {isEditing && (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditing(false)} className={cancelBtnCls}>
                            Cancel
                        </button>
                        <button onClick={handleSaveDetails} className={saveBtnCls}>
                            Save Changes
                        </button>
                    </div>
                )}
            </div>

            {/* Overview tab content */}
            <div className="space-y-4">
                {/* Route meta */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Info className="w-4 h-4 text-gray-400" />
                        Route Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                            <span className="text-gray-500">Company:</span>{" "}
                            <span className="font-medium">
                                {route.companies?.name ?? "N/A"}
                            </span>
                        </div>
                        {!isEditing ? (
                            <>
                                <div>
                                    <span className="text-gray-500">Vehicle:</span>{" "}
                                    <span className="font-medium">
                                        {route.vehicles?.model && route.vehicles?.plate_number
                                            ? `${route.vehicles.model} (${route.vehicles.plate_number})`
                                            : "Unassigned"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Driver:</span>{" "}
                                    <span className="font-medium">
                                        {route.users?.full_name ?? "Unassigned"}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 text-xs">Assigned Vehicle</span>
                                    <select
                                        className={selectCls}
                                        value={editForm.assigned_vehicle_id}
                                        onChange={(e) =>
                                            setEditForm({ ...editForm, assigned_vehicle_id: e.target.value })
                                        }
                                    >
                                        <option value="">None</option>
                                        {vehiclesForSelect.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.plate_number}
                                                {v.model ? ` · ${v.model}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 text-xs">Assigned Driver</span>
                                    <select
                                        className={selectCls}
                                        value={editForm.assigned_driver_id}
                                        onChange={(e) =>
                                            setEditForm({ ...editForm, assigned_driver_id: e.target.value })
                                        }
                                    >
                                        <option value="">None</option>
                                        {drivers.map((d) => (
                                            <option key={d.user_id} value={d.user_id}>
                                                {d.users.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Map + Stops */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Map */}
                    <div
                        className="bg-white rounded-xl border border-gray-200 overflow-hidden col-span-2"
                        style={{ height: "520px" }}
                    >
                        <Map
                            height="100%"
                            markers={mapMarkers}
                            polylines={mapPolylines}
                            onMarkerClick={handleMarkerClick}
                            onMapClick={handleMapClick}
                        />
                    </div>

                    {/* Stops Sidebar */}
                    <div
                        className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col"
                        style={{ maxHeight: "520px" }}
                    >
                        <div className="flex justify-between items-center mb-3 shrink-0">
                            <h3 className="font-semibold flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                Stops ({route.route_stops?.length ?? 0})
                            </h3>
                            {!isAddingStop && !editingStopId && (
                                <button onClick={handleStopAddClick} className={saveBtnCls}>
                                    <Plus className="w-4 h-4 mr-1 inline" /> Add
                                </button>
                            )}
                        </div>

                        {/* Stop form */}
                        {(isAddingStop || editingStopId !== null) && (
                            <div className="bg-gray-50 rounded-lg border border-blue-100 p-3 mb-3 shrink-0 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-medium text-sm text-blue-800">
                                        {isAddingStop ? "New Stop" : "Edit Stop"}
                                    </h4>
                                    <button onClick={resetStopForm}>
                                        <X className="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>

                                <div>
                                    <label className={labelXsCls}>Search Location</label>
                                    <StopAddressSearch
                                        onSelect={handleAddressSelect}
                                        defaultValue={stopForm.name}
                                        placeholder="Search address…"
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <label className={labelXsCls}>Stop Name</label>
                                    <input
                                        className={inputSmCls}
                                        value={stopForm.name}
                                        onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                                        placeholder="e.g. Disco Bakery"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelXsCls}>Lat</label>
                                        <input
                                            className={inputSmCls}
                                            type="number"
                                            step="any"
                                            value={stopForm.lat}
                                            onChange={(e) => setStopForm({ ...stopForm, lat: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelXsCls}>Lng</label>
                                        <input
                                            className={inputSmCls}
                                            type="number"
                                            step="any"
                                            value={stopForm.lng}
                                            onChange={(e) => setStopForm({ ...stopForm, lng: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className={labelXsCls}>Seq</label>
                                        <input
                                            className={inputSmCls}
                                            type="number"
                                            value={stopForm.sequence_order}
                                            onChange={(e) =>
                                                setStopForm({ ...stopForm, sequence_order: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className={labelXsCls}>AM</label>
                                        <input
                                            className={inputSmCls}
                                            type="time"
                                            value={stopForm.morning_eta}
                                            onChange={(e) =>
                                                setStopForm({ ...stopForm, morning_eta: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className={labelXsCls}>PM</label>
                                        <input
                                            className={inputSmCls}
                                            type="time"
                                            value={stopForm.evening_eta}
                                            onChange={(e) =>
                                                setStopForm({ ...stopForm, evening_eta: e.target.value })
                                            }
                                        />
                                    </div>
                                </div>

                                {stopForm.lat && stopForm.lng && (
                                    <p className="text-[10px] text-gray-400">
                                        📍 {parseFloat(stopForm.lat).toFixed(5)},{" "}
                                        {parseFloat(stopForm.lng).toFixed(5)}
                                        <span className="ml-2 text-gray-300">·</span>
                                        <span className="ml-2">or click map to adjust</span>
                                    </p>
                                )}

                                <button onClick={handleStopSubmit} className={`${saveBtnCls} w-full`}>
                                    <Save className="w-3 h-3 mr-2 inline" /> Save Stop
                                </button>
                            </div>
                        )}

                        {/* Stops list */}
                        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                            {(route.route_stops ?? []).map((stop) => (
                                <div
                                    key={stop.id}
                                    className="relative pl-6 border-l-2 border-gray-200 pb-3 last:pb-0 group"
                                >
                                    <div className="absolute -left-2.25 top-0 w-4 h-4 rounded-full bg-[#6366f1] border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">
                                        {stop.sequence_order}
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <div
                                            className="cursor-pointer hover:text-[#f47f00]"
                                            onClick={() => handleStopEditClick(stop)}
                                        >
                                            <div className="text-sm font-medium">{stop.name}</div>
                                            <div className="text-xs text-gray-400">
                                                AM: {stop.morning_eta ?? "—"} · PM:{" "}
                                                {stop.evening_eta ?? "—"}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleStopEditClick(stop)}
                                                className="p-1 hover:bg-gray-100 rounded text-blue-500"
                                            >
                                                <Edit className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => handleStopDelete(stop.id)}
                                                className="p-1 hover:bg-gray-100 rounded text-red-500"
                                            >
                                                <Trash className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const labelXsCls = "block text-xs font-medium text-gray-600 mb-0.5";
const inputSmCls =
    "w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#f47f00]";
const selectCls =
    "w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#f47f00]";
const saveBtnCls =
    "inline-flex items-center bg-[#f47f00] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#d96e00] disabled:opacity-50";
const cancelBtnCls =
    "border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50";
