"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "../../lib/services/api-client";
import { VendorRoute } from "../../lib/services/types/multi-mode";
import { useVendorContext } from "../layout";
import { toast } from "sonner";
import { MapPin, Plus, Truck, ChevronRight } from "@/app/components/icons";

export default function VendorRoutesPage() {
    const { selectedLink } = useVendorContext();
    const [routes, setRoutes] = useState<VendorRoute[]>([]);
    const [loading, setLoading] = useState(true);

    const servesShuttle = selectedLink?.serves_shuttle ?? false;

    const load = useCallback(async () => {
        if (!selectedLink) return;
        setLoading(true);
        try {
            const res = await apiClient.getVendorRoutes(selectedLink.id);
            setRoutes(res.data);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load routes");
        } finally {
            setLoading(false);
        }
    }, [selectedLink]);

    useEffect(() => {
        load();
    }, [load]);

    if (!servesShuttle) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[50vh]">
                <div className="text-center max-w-sm">
                    <div className="text-4xl mb-4">🚌</div>
                    <h2 className="text-lg font-bold text-gray-800 mb-2">Shuttle Routes Unavailable</h2>
                    <p className="text-sm text-gray-500">
                        Your link to this company does not include shuttle service. Switch to a shuttle-enabled company link in the sidebar.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-[#0c225e]">Route Management</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {selectedLink
                            ? `Managing shuttle routes for: ${selectedLink.companies?.name ?? `Link #${selectedLink.id}`}`
                            : "Select a company link"}
                    </p>
                </div>
                <Link href="/vendor/routes/create">
                    <button className={saveBtnCls}>
                        <Plus className="w-4 h-4 mr-1 inline" />
                        Create New Route
                    </button>
                </Link>
            </div>

            {/* Loading */}
            {loading && (
                <div className="text-center py-12 text-gray-400">Loading routes...</div>
            )}

            {/* Empty state */}
            {!loading && routes.length === 0 && (
                <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No Routes Yet</h3>
                    <p className="text-sm text-gray-500 mb-4">Get started by creating your first shuttle route.</p>
                    <Link href="/vendor/routes/create">
                        <button className={saveBtnCls}>Create Route</button>
                    </Link>
                </div>
            )}

            {/* Route cards */}
            {!loading && routes.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {routes.map((route) => (
                        <div
                            key={route.id}
                            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="font-semibold text-lg text-gray-900 leading-tight">{route.name}</h3>
                                <span
                                    className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                        route.status === "ACTIVE"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-100 text-gray-500"
                                    }`}
                                >
                                    {route.status ?? "—"}
                                </span>
                            </div>

                            <div className="space-y-1.5 text-sm text-gray-600 mb-4">
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 shrink-0" />
                                    <span>{route.route_stops?.length ?? 0} Stops</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Truck className="w-4 h-4 shrink-0" />
                                    <span>
                                        {route.vehicles?.plate_number && route.vehicles?.model
                                            ? `${route.vehicles.model} (${route.vehicles.plate_number})`
                                            : "Unassigned Vehicle"}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end border-t pt-3">
                                <Link href={`/vendor/routes/${route.id}`}>
                                    <button className="flex items-center gap-1 text-sm text-[#0c225e] hover:text-[#f47f00] font-medium transition-colors">
                                        View Details
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const saveBtnCls =
    "inline-flex items-center bg-[#f47f00] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#d96e00] disabled:opacity-50";
