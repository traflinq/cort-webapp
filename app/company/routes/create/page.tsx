"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCompanyAccess } from "../../lib/access-context";
import { apiClient, canServeShuttle } from "../../../lib/services/api-client";
import { PoolDriver, PoolVehicle } from "../../../lib/services/types/multi-mode";
import StopAddressSearch from "@/app/admin/ui/StopAddressSearch";
import type { MapMarker, MapPolyline } from "@/app/admin/ui/Map";
import { Badge, Button, Field, IconButton, Input, Label, PageHeader, Select, focusRing } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { Card } from "../../components/Card";

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

/** Google Maps pin colours; the legend dots reuse them so the two always match. */
const OFFICE_PIN_COLOR = "#ef4444";
const PICKUP_PIN_COLOR = "#6e7ff0";

function PinDot({ color }: { color: string }) {
    return <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

/** Stop names in travel order, separated by direction-aware chevrons. */
function StopPath({ names }: { names: { label: string; strong?: boolean }[] }) {
    return (
        <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
            {names.map((n, i) => (
                <span key={`${n.label}-${i}`} className="inline-flex items-center gap-1">
                    {i > 0 && <ChevronRight className="size-3 shrink-0 text-fg-muted rtl:rotate-180" aria-hidden="true" />}
                    <span className={n.strong ? "font-medium text-fg" : "text-fg-secondary"}>{n.label}</span>
                </span>
            ))}
        </span>
    );
}

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
    // The page guard opens this page only for companies that run their own shuttles.
    const { company } = useCompanyAccess();
    const companyId = company.id;

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
            color: PICKUP_PIN_COLOR,
        })),
        ...officeStops.map((s) => ({
            id: s.id,
            position: [s.lat, s.lng] as [number, number],
            label: `Office · ${s.name}`,
            color: OFFICE_PIN_COLOR,
        })),
    ];

    const mapPolylines: MapPolyline[] =
        routePolyline.length >= 2
            ? [{ positions: routePolyline, color: "#0C225E" }]
            : orderedStops.length > 1
            ? [{ positions: orderedStops.map((s) => [s.lat, s.lng] as [number, number]), color: "#2563eb" }]
            : [];

    const mapCenter: [number, number] | undefined = officeStops[0]
        ? [officeStops[0].lat, officeStops[0].lng]
        : pickupStops[0]
        ? [pickupStops[0].lat, pickupStops[0].lng]
        : undefined;

    const segmentCls = (active: boolean) =>
        cn(
            "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors [&_svg]:size-3.5",
            focusRing,
            active ? "bg-card text-fg shadow-xs" : "text-fg-muted hover:text-fg",
        );

    const updateOffice = (id: string, patch: Partial<Stop>) =>
        setOfficeStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const updatePickup = (id: string, patch: Partial<Stop>) =>
        setPickupStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

    const officeNames = officeStops.map((s) => s.name).join(", ");

    return (
        <div className="mx-auto flex h-[calc(100vh-100px)] w-full min-w-0 max-w-[1600px] flex-col gap-6">
            <PageHeader
                className="shrink-0"
                title="Create Shuttle Route"
                description="Add one company office, or more if this route serves multiple offices."
                actions={
                    <>
                        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                        <Button type="button" onClick={handleSubmit} loading={saving}>
                            {saving ? "Saving…" : "Save Route"}
                        </Button>
                    </>
                }
            />

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="flex flex-col gap-5 overflow-y-auto">
                    <Field label="Route name" required>
                        <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gulshan — Office" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Vehicle">
                            <Select value={assignedVehicleId} onChange={(e) => setAssignedVehicleId(e.target.value)} placeholder="Select…">
                                {vehicles.map((v) => (
                                    <option key={v.id} value={v.id}>{v.plate_number}</option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Driver">
                            <Select value={assignedDriverId} onChange={(e) => setAssignedDriverId(e.target.value)} placeholder="Select…">
                                {drivers.map((d) => (
                                    <option key={d.user_id} value={d.user_id}>{d.users?.full_name}</option>
                                ))}
                            </Select>
                        </Field>
                    </div>

                    {/* Pin mode */}
                    <div className="flex gap-1 rounded-lg bg-subtle p-0.5">
                        <button
                            type="button"
                            aria-pressed={pinMode === "office"}
                            onClick={() => setPinMode("office")}
                            className={segmentCls(pinMode === "office")}
                        >
                            <PinDot color={OFFICE_PIN_COLOR} />
                            Set office
                        </button>
                        <button
                            type="button"
                            aria-pressed={pinMode === "pickup"}
                            onClick={() => setPinMode("pickup")}
                            className={segmentCls(pinMode === "pickup")}
                        >
                            <PinDot color={PICKUP_PIN_COLOR} />
                            Add pickup
                        </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label>
                            {pinMode === "office" ? "Search company office address" : "Search employee pickup"}
                        </Label>
                        <StopAddressSearch
                            onSelect={handleAddressSelect}
                            placeholder={
                                pinMode === "office"
                                    ? "Search office / HQ address…"
                                    : "Search pickup location…"
                            }
                            clearOnSelect
                        />
                        <p className="text-xs text-fg-muted">
                            Or click the map to pin the {pinMode === "office" ? "office" : "pickup"}.
                        </p>
                    </div>

                    {/* Offices */}
                    <section className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <Building2 className="size-4 text-fg-muted" aria-hidden="true" />
                            <h3 className="text-sm font-semibold text-fg">
                                Company Office{officeStops.length !== 1 ? "s" : ""}
                                {officeStops.length > 0 && (
                                    <span className="ms-1.5 font-normal text-fg-muted tabular-nums">({officeStops.length})</span>
                                )}
                            </h3>
                            <Badge tone={officeStops.length === 0 ? "warning" : "neutral"} dot={officeStops.length === 0}>
                                At least 1 required
                            </Badge>
                        </div>

                        {officeStops.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-line-strong p-4 text-center">
                                <p className="text-sm font-medium text-fg">No office set yet</p>
                                <p className="mt-1 text-xs text-fg-muted">
                                    Switch to <strong className="font-medium text-fg-secondary">Set office</strong>, then search or click the map.
                                </p>
                                <p className="mt-1 text-xs text-fg-muted">
                                    Add one office, or more if this route serves multiple offices.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {officeStops.map((stop) => (
                                    <div key={stop.id} className="rounded-lg border border-line p-3">
                                        <div className="flex items-start gap-2">
                                            <span className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-subtle text-fg-secondary">
                                                <Building2 className="size-3.5" aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <Input
                                                    aria-label="Office name"
                                                    className="font-medium"
                                                    value={stop.name}
                                                    onChange={(e) => updateOffice(stop.id, { name: e.target.value })}
                                                />
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    <Badge tone="neutral">Office stop</Badge>
                                                    <Badge tone="neutral">No employee assignment</Badge>
                                                </div>
                                            </div>
                                            <IconButton
                                                size="icon-sm"
                                                label="Remove office"
                                                onClick={() => handleRemoveOffice(stop.id)}
                                                className="hover:text-danger-ink"
                                            >
                                                <Trash2 />
                                            </IconButton>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 ps-8">
                                            <Field label="AM arrival">
                                                <Input
                                                    type="time"
                                                    className="tabular-nums"
                                                    value={stop.morningEta}
                                                    onChange={(e) => updateOffice(stop.id, { morningEta: e.target.value })}
                                                />
                                            </Field>
                                            <Field label="PM departure">
                                                <Input
                                                    type="time"
                                                    className="tabular-nums"
                                                    value={stop.eveningEta}
                                                    onChange={(e) => updateOffice(stop.id, { eveningEta: e.target.value })}
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Pickups */}
                    <section className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <MapPin className="size-4 text-fg-muted" aria-hidden="true" />
                            <h3 className="text-sm font-semibold text-fg">
                                Employee pickups
                                <span className="ms-1.5 font-normal text-fg-muted tabular-nums">({pickupStops.length})</span>
                            </h3>
                        </div>

                        {pickupStops.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-line-strong py-4 text-center text-sm text-fg-muted">
                                No pickups yet — use <strong className="font-medium text-fg-secondary">Add pickup</strong> or the map.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {pickupStops.map((stop, index) => (
                                    <div key={stop.id} className="flex items-start gap-2 rounded-lg border border-line p-3">
                                        <span className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-medium text-fg-secondary tabular-nums">
                                            {index + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <Input
                                                aria-label="Pickup name"
                                                value={stop.name}
                                                onChange={(e) => updatePickup(stop.id, { name: e.target.value })}
                                            />
                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                <Field label="AM pickup">
                                                    <Input
                                                        type="time"
                                                        className="tabular-nums"
                                                        value={stop.morningEta}
                                                        onChange={(e) => updatePickup(stop.id, { morningEta: e.target.value })}
                                                    />
                                                </Field>
                                                <Field label="PM dropoff">
                                                    <Input
                                                        type="time"
                                                        className="tabular-nums"
                                                        value={stop.eveningEta}
                                                        onChange={(e) => updatePickup(stop.id, { eveningEta: e.target.value })}
                                                    />
                                                </Field>
                                            </div>
                                        </div>
                                        <IconButton
                                            size="icon-sm"
                                            label="Remove pickup"
                                            onClick={() => handleRemovePickup(stop.id)}
                                            className="hover:text-danger-ink"
                                        >
                                            <Trash2 />
                                        </IconButton>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {officeStops.length > 0 && pickupStops.length > 0 && (
                        <section className="flex flex-col gap-2 rounded-lg border border-line bg-subtle p-3 text-xs">
                            <p className="text-sm font-semibold text-fg">Route order on save</p>
                            <div className="flex flex-col gap-1">
                                <span className="font-medium text-fg-muted">Morning</span>
                                <StopPath
                                    names={[
                                        ...pickupStops.map((s) => ({ label: s.name })),
                                        { label: officeNames, strong: true },
                                    ]}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="font-medium text-fg-muted">Evening</span>
                                <StopPath
                                    names={[
                                        { label: officeNames, strong: true },
                                        ...[...pickupStops].reverse().map((s) => ({ label: s.name })),
                                    ]}
                                />
                            </div>
                            <p className="text-fg-muted">
                                Pickup order is auto-optimized on save; evening is the reverse of morning.
                                {officeStops.length > 1 && " Multiple offices are placed after pickups — adjust exact positions from Manage Stops after creating the route."}
                            </p>
                        </section>
                    )}
                </Card>

                <div className="relative min-h-[400px] overflow-hidden rounded-xl border border-line lg:col-span-2">
                    <div className="pointer-events-none absolute start-3 top-3 z-[500] flex gap-2">
                        <span className="flex items-center gap-1.5 rounded-md border border-line bg-card px-2 py-1 text-xs font-medium text-fg">
                            <PinDot color={OFFICE_PIN_COLOR} /> Office
                        </span>
                        <span className="flex items-center gap-1.5 rounded-md border border-line bg-card px-2 py-1 text-xs font-medium text-fg">
                            <PinDot color={PICKUP_PIN_COLOR} /> Pickups
                        </span>
                    </div>
                    <Map
                        markers={mapMarkers}
                        polylines={mapPolylines}
                        onMapClick={handleMapClick}
                        center={mapCenter}
                        height="100%"
                        className="!rounded-none !border-0 !shadow-none"
                    />
                </div>
            </div>
        </div>
    );
}
