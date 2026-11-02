"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Trash2 } from "lucide-react";
import { Card } from "../../components/DashboardComponents";
import { PillButton } from "../../ui";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "../../../lib/store/hooks";
import { selectCompany, fetchCompanyFeatures, selectCompanyFeatures, selectCompanyFeaturesStatus } from "../../../lib/store/slices/companySlice";
import { useAuth } from "../../../lib/contexts/auth-context";
import { apiClient, canServeShuttle } from "../../../lib/services/api-client";
import { PoolDriver, PoolVehicle } from "../../../lib/services/types/multi-mode";
import StopAddressSearch from "@/app/admin/ui/StopAddressSearch";
import type { MapMarker, MapPolyline } from "@/app/admin/ui/Map";

const Map = dynamic(() => import("@/app/admin/ui/Map"), { ssr: false });

type PinMode = "pickup" | "office";

interface Stop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    morningEta: string;
    eveningEta: string;
}

const inputCls = "w-full h-11 rounded-full border border-[var(--border-input)] bg-[var(--bg-card)] px-4 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--cort-orange)]";
const labelCls = "block text-[13px] text-[var(--text-muted)] mb-1.5 px-1";

function makeStop(
    name: string,
    lat: number,
    lng: number,
    morningEta: string,
    eveningEta: string,
): Stop {
    return { id: crypto.randomUUID(), name, lat, lng, morningEta, eveningEta };
}

export default function CompanyCreateRoutePage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const company = useAppSelector(selectCompany);
    const features = useAppSelector(selectCompanyFeatures);
    const featuresStatus = useAppSelector(selectCompanyFeaturesStatus);
    const { user } = useAuth();
    const isTrialUser = !!user?.is_trial;
    const companyId = Number(company?.id);

    const canManageShuttle = isTrialUser
        || (features.find((f) => f.feature_key === "shuttle_self_managed")?.is_enabled ?? false);

    useEffect(() => {
        if (companyId) dispatch(fetchCompanyFeatures(companyId));
    }, [companyId, dispatch]);

    useEffect(() => {
        if (!companyId || isTrialUser || featuresStatus !== "succeeded" || canManageShuttle) return;
        router.replace("/company/routes");
    }, [companyId, isTrialUser, featuresStatus, canManageShuttle, router]);

    const [name, setName] = useState("");
    const [assignedVehicleId, setAssignedVehicleId] = useState("");
    const [assignedDriverId, setAssignedDriverId] = useState("");
    /** A route may have multiple company office stops (multi-office shuttle support). */
    const [officeStops, setOfficeStops] = useState<Stop[]>([]);
    const [pickupStops, setPickupStops] = useState<Stop[]>([]);
    const [pinMode, setPinMode] = useState<PinMode>("office");
    const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
    const [saving, setSaving] = useState(false);
    const [vehicles, setVehicles] = useState<PoolVehicle[]>([]);
    const [drivers, setDrivers] = useState<PoolDriver[]>([]);

    const polylineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const orderedStops = useMemo(
        () => [...pickupStops, ...officeStops],
        [pickupStops, officeStops],
    );

    useEffect(() => {
        if (!companyId) return;
        apiClient.getPoolVehicles(companyId).then((r) => setVehicles(r.data)).catch(() => {});
        apiClient.getPoolDrivers(companyId).then((r) => {
            setDrivers(r.data.filter((d) => canServeShuttle(d.driver_type)));
        }).catch(() => {});
    }, [companyId]);

    const fetchPreviewPolyline = useCallback(async (currentStops: Stop[]) => {
        if (currentStops.length < 2) {
            setRoutePolyline([]);
            return;
        }
        try {
            const data = await apiClient.previewCompanyRoutePolyline(
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

    const applyOffice = useCallback((stop: Stop) => {
        setOfficeStops((prev) => {
            const next = [...prev, stop];
            schedulePolylineUpdate([...pickupStops, ...next]);
            return next;
        });
        toast.success("Company office added");
    }, [pickupStops, schedulePolylineUpdate]);

    const applyPickup = useCallback((stop: Stop) => {
        setPickupStops((prev) => {
            const updated = [...prev, stop];
            schedulePolylineUpdate([...updated, ...officeStops]);
            return updated;
        });
        toast.success(`Pickup "${stop.name}" added`);
    }, [officeStops, schedulePolylineUpdate]);

    const handleAddressSelect = useCallback(
        ({ name: stopName, lat, lng }: { name: string; lat: number; lng: number }) => {
            if (pinMode === "office") {
                applyOffice(makeStop(stopName, lat, lng, "09:00", "18:00"));
            } else {
                applyPickup(makeStop(stopName, lat, lng, "08:00", "18:30"));
            }
        },
        [pinMode, applyOffice, applyPickup],
    );

    const handleMapClick = useCallback(
        (lat: number, lng: number) => {
            if (pinMode === "office") {
                applyOffice(makeStop(`Office ${officeStops.length + 1}`, lat, lng, "09:00", "18:00"));
            } else {
                applyPickup(makeStop(`Pickup ${pickupStops.length + 1}`, lat, lng, "08:00", "18:30"));
            }
        },
        [pinMode, pickupStops.length, officeStops.length, applyOffice, applyPickup],
    );

    const handleRemovePickup = (id: string) => {
        setPickupStops((prev) => {
            const updated = prev.filter((s) => s.id !== id);
            schedulePolylineUpdate([...updated, ...officeStops]);
            return updated;
        });
    };

    const handleRemoveOffice = (id: string) => {
        setOfficeStops((prev) => {
            const updated = prev.filter((s) => s.id !== id);
            schedulePolylineUpdate([...pickupStops, ...updated]);
            return updated;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyId) {
            toast.error("Company not loaded");
            return;
        }
        if (!name.trim()) {
            toast.error("Route name is required");
            return;
        }
        if (officeStops.length < 1) {
            toast.error("Set at least one company office — it is required");
            return;
        }
        if (pickupStops.length < 1) {
            toast.error("Add at least one employee pickup stop");
            return;
        }
        setSaving(true);
        try {
            await apiClient.createCompanyRoute({
                name: name.trim(),
                company_id: companyId,
                assigned_vehicle_id: assignedVehicleId ? Number(assignedVehicleId) : undefined,
                assigned_driver_id: assignedDriverId || undefined,
                stops: [
                    ...pickupStops.map((stop, index) => ({
                        name: stop.name,
                        lat: stop.lat,
                        lng: stop.lng,
                        morning_eta: stop.morningEta,
                        evening_eta: stop.eveningEta,
                        sequence_order: index + 1,
                        stop_type: "PICKUP" as const,
                    })),
                    ...officeStops.map((stop, index) => ({
                        name: stop.name,
                        lat: stop.lat,
                        lng: stop.lng,
                        morning_eta: stop.morningEta,
                        evening_eta: stop.eveningEta,
                        sequence_order: pickupStops.length + index + 1,
                        stop_type: "OFFICE" as const,
                    })),
                ],
            });
            toast.success("Route created successfully!");
            router.push("/company/routes");
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to create route");
        } finally {
            setSaving(false);
        }
    };

    const mapMarkers: MapMarker[] = [
        ...pickupStops.map((s, index) => ({
            id: s.id,
            position: [s.lat, s.lng] as [number, number],
            label: `${index + 1}. ${s.name}`,
            color: "#6366f1",
        })),
        ...officeStops.map((s) => ({
            id: s.id,
            position: [s.lat, s.lng] as [number, number],
            label: `Office · ${s.name}`,
            color: "#ef4444",
        })),
    ];

    const mapPolylines: MapPolyline[] =
        routePolyline.length >= 2
            ? [{ positions: routePolyline, color: "#1c1b4d" }]
            : orderedStops.length > 1
            ? [{ positions: orderedStops.map((s) => [s.lat, s.lng] as [number, number]), color: "#2563eb" }]
            : [];

    const mapCenter: [number, number] | undefined = officeStops[0]
        ? [officeStops[0].lat, officeStops[0].lng]
        : pickupStops[0]
        ? [pickupStops[0].lat, pickupStops[0].lng]
        : undefined;

    if (!company?.services_enabled?.shuttle_enabled) {
        return (
            <div className="p-6 text-center text-sm text-[var(--text-muted)]">
                Shuttle service is not enabled for your company.
            </div>
        );
    }

    if (!canManageShuttle) {
        if (featuresStatus === "loading" || featuresStatus === "idle") {
            return (
                <div className="p-6 text-center text-sm text-[var(--text-muted)]">
                    Loading…
                </div>
            );
        }
        return (
            <div className="p-6 text-center text-sm text-[var(--text-muted)]">
                Route creation is not available for your account. Contact Traflinq to enable self-managed shuttle.
            </div>
        );
    }

    return (
        <div className="gap-6 lg:h-[calc(100vh-200px)] flex flex-col max-w-[1600px] mx-auto">
            <div className="flex flex-wrap justify-between items-end gap-4 shrink-0">
                <div>
                    <h1 className="text-[2rem] font-medium leading-[1.1] tracking-[-0.02em] text-[var(--text-primary)] sm:text-[2.5rem]">Create Shuttle Route</h1>
                    <p className="text-[15px] text-[var(--text-muted)] mt-3">
                        Add one company office, or more if this route serves multiple offices.
                    </p>
                </div>
                <div className="flex gap-3">
                    <PillButton variant="outline" onClick={() => router.back()}>Cancel</PillButton>
                    <PillButton onClick={handleSubmit} disabled={saving} loading={saving}>
                        {saving ? "Saving…" : "Save Route"}
                    </PillButton>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                <Card className="flex flex-col gap-5 overflow-y-auto">
                    <div>
                        <label className={labelCls}>Route name *</label>
                        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Gulshan — Office" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className={labelCls}>Vehicle</label>
                            <select className={inputCls} value={assignedVehicleId} onChange={(e) => setAssignedVehicleId(e.target.value)}>
                                <option value="">Select…</option>
                                {vehicles.map((v) => (
                                    <option key={v.id} value={v.id}>{v.plate_number}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Driver</label>
                            <select className={inputCls} value={assignedDriverId} onChange={(e) => setAssignedDriverId(e.target.value)}>
                                <option value="">Select…</option>
                                {drivers.map((d) => (
                                    <option key={d.user_id} value={d.user_id}>{d.users?.full_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Pin mode */}
                    <div className="flex rounded-full p-1 bg-[var(--tile-bg)]">
                        <button
                            type="button"
                            onClick={() => setPinMode("office")}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-full h-9 text-sm transition-colors ${
 pinMode === "office"
 ? "bg-[var(--cort-navy)] text-white"
 : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
 }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            Set office
                        </button>
                        <button
                            type="button"
                            onClick={() => setPinMode("pickup")}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-full h-9 text-sm transition-colors ${
 pinMode === "pickup"
 ? "bg-[var(--cort-navy)] text-white"
 : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
 }`}
                        >
                            <MapPin className="w-3.5 h-3.5" />
                            Add pickup
                        </button>
                    </div>

                    <div>
                        <label className={labelCls}>
                            {pinMode === "office" ? "Search company office address" : "Search employee pickup"}
                        </label>
                        <StopAddressSearch
                            onSelect={handleAddressSelect}
                            placeholder={
                                pinMode === "office"
                                    ? "Search office / HQ address…"
                                    : "Search pickup location…"
                            }
                            clearOnSelect
                        />
                        <p className="text-xs text-[var(--text-muted)] mt-1.5 px-1">
                            Or click the map to pin the {pinMode === "office" ? "office" : "pickup"}.
                        </p>
                    </div>

                    {/* Office — prominent */}
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-[var(--tone-danger-ink)]" />
                            <h3 className="font-medium text-[15px] text-[var(--text-primary)]">
                                Company Office{officeStops.length !== 1 ? "s" : ""}
                                {officeStops.length > 0 && (
                                    <span className="ms-1.5 text-xs text-[var(--text-muted)] font-normal">({officeStops.length})</span>
                                )}
                            </h3>
                            <span className="text-xs bg-[var(--tone-danger-soft)] text-[var(--tone-danger-ink)] px-2.5 py-0.5 rounded-full">
                                At least 1 required
                            </span>
                        </div>

                        {officeStops.length === 0 ? (
                            <div className="rounded-[20px] border border-dashed border-[var(--tone-danger-line)] bg-[var(--tone-danger-soft)] p-4 text-center">
                                <Building2 className="w-8 h-8 text-[var(--tone-danger-ink)] opacity-60 mx-auto mb-2" />
                                <p className="text-sm font-medium text-[var(--text-primary)]">No office set yet</p>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                    Switch to <strong>Set office</strong>, then search or click the map.
                                </p>
                                <p className="text-[11px] text-[var(--tone-danger-ink)] mt-2">
                                    Add one office, or more if this route serves multiple offices.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {officeStops.map((stop) => (
                                    <div key={stop.id} className="rounded-[20px] border border-[var(--tone-danger-line)] bg-[var(--tile-bg)] p-3">
                                        <div className="flex items-start gap-2 mb-2">
                                            <span className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
                                                <Building2 className="w-3.5 h-3.5" />
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <input
                                                    className={`${inputCls} font-semibold`}
                                                    value={stop.name}
                                                    onChange={(e) =>
                                                        setOfficeStops((prev) =>
                                                            prev.map((s) =>
                                                                s.id === stop.id ? { ...s, name: e.target.value } : s,
                                                            ),
                                                        )
                                                    }
                                                />
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    <span className="text-xs bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)] px-2.5 py-0.5 rounded-full">
                                                        Office stop
                                                    </span>
                                                    <span className="text-xs bg-[var(--tone-neutral-soft)] text-[var(--tone-neutral-ink)] px-2.5 py-0.5 rounded-full">
                                                        No employee assignment
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveOffice(stop.id)}
                                                className="inline-flex size-8 items-center justify-center rounded-full text-[var(--tone-danger-ink)] hover:bg-[var(--tone-danger-soft)]"
                                                title="Remove office"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-1 ps-9">
                                            <div>
                                                <label className="text-xs text-[var(--text-muted)] px-1">AM arrival</label>
                                                <input
                                                    type="time"
                                                    className={inputCls}
                                                    value={stop.morningEta}
                                                    onChange={(e) =>
                                                        setOfficeStops((prev) =>
                                                            prev.map((s) =>
                                                                s.id === stop.id ? { ...s, morningEta: e.target.value } : s,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-[var(--text-muted)] px-1">PM departure</label>
                                                <input
                                                    type="time"
                                                    className={inputCls}
                                                    value={stop.eveningEta}
                                                    onChange={(e) =>
                                                        setOfficeStops((prev) =>
                                                            prev.map((s) =>
                                                                s.id === stop.id ? { ...s, eveningEta: e.target.value } : s,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Pickups */}
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-[var(--tone-info-ink)]" />
                            <h3 className="font-medium text-[15px] text-[var(--text-primary)]">
                                Employee pickups
                                <span className="ms-1.5 text-xs text-[var(--text-muted)] font-normal">
                                    ({pickupStops.length})
                                </span>
                            </h3>
                        </div>

                        {pickupStops.length === 0 ? (
                            <p className="text-sm text-[var(--text-muted)] text-center py-4 border border-dashed border-[var(--border-strong)] rounded-[20px]">
                                No pickups yet — use <strong>Add pickup</strong> or the map.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {pickupStops.map((stop, index) => (
                                    <div
                                        key={stop.id}
                                        className="flex items-start gap-2 rounded-[20px] p-3 bg-[var(--tile-bg)]"
                                    >
                                        <span className="w-7 h-7 mt-2 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0 bg-indigo-500">
                                            {index + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <input
                                                className={inputCls}
                                                value={stop.name}
                                                onChange={(e) =>
                                                    setPickupStops((prev) =>
                                                        prev.map((s) =>
                                                            s.id === stop.id
                                                                ? { ...s, name: e.target.value }
                                                                : s,
                                                        ),
                                                    )
                                                }
                                            />
                                            <div className="grid grid-cols-2 gap-1 mt-1">
                                                <div>
                                                    <label className="text-xs text-[var(--text-muted)] px-1">AM pickup</label>
                                                    <input
                                                        type="time"
                                                        className={inputCls}
                                                        value={stop.morningEta}
                                                        onChange={(e) =>
                                                            setPickupStops((prev) =>
                                                                prev.map((s) =>
                                                                    s.id === stop.id
                                                                        ? { ...s, morningEta: e.target.value }
                                                                        : s,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-[var(--text-muted)] px-1">PM dropoff</label>
                                                    <input
                                                        type="time"
                                                        className={inputCls}
                                                        value={stop.eveningEta}
                                                        onChange={(e) =>
                                                            setPickupStops((prev) =>
                                                                prev.map((s) =>
                                                                    s.id === stop.id
                                                                        ? { ...s, eveningEta: e.target.value }
                                                                        : s,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemovePickup(stop.id)}
                                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--tone-danger-ink)] hover:bg-[var(--tone-danger-soft)]"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {officeStops.length > 0 && pickupStops.length > 0 && (
                        <section className="rounded-[20px] bg-[var(--tile-bg)] p-4 text-xs space-y-2">
                            <p className="font-medium text-sm text-[var(--text-primary)]">Route order on save</p>
                            <div>
                                <span className="font-medium text-[var(--tone-warning-ink)]">Morning → </span>
                                <span className="text-[var(--text-secondary)]">
                                    {pickupStops.map((s) => s.name).join(" → ")}
                                    {" → "}
                                    <span className="font-medium text-[var(--tone-danger-ink)]">
                                        {officeStops.map((s) => s.name).join(", ")}
                                    </span>
                                </span>
                            </div>
                            <div>
                                <span className="font-medium text-[var(--tone-purple-ink)]">Evening → </span>
                                <span className="text-[var(--text-secondary)]">
                                    <span className="font-medium text-[var(--tone-danger-ink)]">
                                        {officeStops.map((s) => s.name).join(", ")}
                                    </span>
                                    {" → "}
                                    {[...pickupStops].reverse().map((s) => s.name).join(" → ")}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)]">
                                Pickup order is auto-optimized on save; evening is the reverse of morning.
                                {officeStops.length > 1 && " Multiple offices are placed after pickups — adjust exact positions from Manage Stops after creating the route."}
                            </p>
                        </section>
                    )}
                </Card>

                <div className="lg:col-span-2 rounded-[var(--radius-card)] overflow-hidden min-h-[400px] relative shadow-[var(--shadow-card)]">
                    <div className="absolute top-4 start-4 z-[500] flex gap-2 pointer-events-none">
                        <span className="bg-[var(--bg-card)] text-[var(--text-primary)] text-xs px-3 py-1.5 rounded-full shadow-[var(--shadow-card)] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500" /> Office
                        </span>
                        <span className="bg-[var(--bg-card)] text-[var(--text-primary)] text-xs px-3 py-1.5 rounded-full shadow-[var(--shadow-card)] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" /> Pickups
                        </span>
                    </div>
                    <Map
                        markers={mapMarkers}
                        polylines={mapPolylines}
                        onMapClick={handleMapClick}
                        center={mapCenter}
                        height="100%"
                    />
                </div>
            </div>
        </div>
    );
}
