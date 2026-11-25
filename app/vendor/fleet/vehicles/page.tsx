"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../../../lib/services/api-client";
import { VendorVehicle } from "../../../lib/services/types/multi-mode";
import { VehicleCategory } from "../../../lib/services/types/vehicles";
import { useVendorContext } from "../../layout";
import { toast } from "sonner";

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

const VEHICLE_CATEGORIES = Object.values(VehicleCategory);

const formatVehicleCategory = (category: string) =>
    category.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

const getDefaultForm = () => ({
    plate_number: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    color: "",
    category: VehicleCategory.SEDAN,
    fuel_avg_city: 10,
    fuel_avg_highway: 13,
    /** passenger seats — needed for occupancy and route recommendations */
    seat_capacity: 0,
    /** "" = infer from category */
    fuel_type: "" as "" | "PETROL" | "DIESEL",
    /** "" = not set (idling CO2 then uses the AC-off rate) */
    ac_on: "" as "" | "on" | "off",
});

const acValue = (v: boolean | null | undefined): "" | "on" | "off" => (v === true ? "on" : v === false ? "off" : "");

export default function VendorVehiclesPage() {
    const { selectedLink } = useVendorContext();
    const [vehicles, setVehicles] = useState<VendorVehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<VendorVehicle | null>(null);
    const [form, setForm] = useState(getDefaultForm);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!selectedLink) return;
        setLoading(true);
        try {
            const res = await apiClient.getVendorVehicles(selectedLink.id) as any;
            setVehicles(res?.data?.data ?? res?.data ?? []);
        } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load vehicles"); }
        finally { setLoading(false); }
    }, [selectedLink]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLink) return;
        setSaving(true);
        try {
            await apiClient.createVendorVehicle({
                company_vendor_link_id: selectedLink.id,
                ...form,
                color: form.color || undefined,
                fuel_type: form.fuel_type || undefined,
                ac_on: form.ac_on ? form.ac_on === "on" : undefined,
            });
            toast.success("Vehicle added");
            setShowAdd(false);
            resetForm();
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to add vehicle");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVehicle) return;
        setSaving(true);
        try {
            await apiClient.updateVendorVehicle(editingVehicle.id, {
                plate_number: form.plate_number,
                make: form.make,
                model: form.model,
                year: form.year,
                color: form.color || undefined,
                category: form.category,
                fuel_avg_city: form.fuel_avg_city,
                fuel_avg_highway: form.fuel_avg_highway,
                seat_capacity: form.seat_capacity,
                ...(form.fuel_type ? { fuel_type: form.fuel_type } : {}),
                ac_on: form.ac_on ? form.ac_on === "on" : null,
            });
            toast.success("Vehicle updated");
            setEditingVehicle(null);
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update vehicle");
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (id: number) => {
        if (!confirm("Remove this vehicle from your fleet?")) return;
        try {
            await apiClient.removeVendorVehicle(id);
            toast.success("Vehicle removed");
            load();
        } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to remove vehicle"); }
    };

    const openEdit = (v: VendorVehicle) => {
        setEditingVehicle(v);
        setForm({ plate_number: v.plate_number, make: v.make, model: v.model, year: v.year, color: v.color ?? "", category: v.category as VehicleCategory, fuel_avg_city: v.fuel_avg_city, fuel_avg_highway: v.fuel_avg_highway, seat_capacity: v.seat_capacity ?? 0, fuel_type: (v.fuel_type === "PETROL" || v.fuel_type === "DIESEL" ? v.fuel_type : ""), ac_on: acValue(v.ac_on) });
    };

    const resetForm = () => setForm(getDefaultForm());

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#0c225e]">Fleet — Vehicles</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your vendor fleet vehicles</p>
                </div>
                <button onClick={() => { resetForm(); setShowAdd(true); }} className={saveBtnCls}>+ Add Vehicle</button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            {["Plate", "Make / Model", "Year", "Category", "Seats", "Status", "Actions"].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
                        ) : vehicles.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No vehicles in your fleet yet</td></tr>
                        ) : vehicles.map((v) => (
                            <tr key={v.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs font-medium">{v.plate_number}</td>
                                <td className="px-4 py-3">{v.make} {v.model}</td>
                                <td className="px-4 py-3">{v.year}</td>
                                <td className="px-4 py-3">{formatVehicleCategory(v.category)}</td>
                                <td className="px-4 py-3">
                                    {v.seat_capacity ? v.seat_capacity : (
                                        <button onClick={() => openEdit(v)} className="text-xs font-medium text-amber-700 hover:underline" title="Seats are needed for occupancy and route recommendations">Add seats</button>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={cx("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", v.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                                        {v.status ?? "—"}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(v)} className="text-xs text-blue-600 hover:underline">Edit</button>
                                        <button onClick={() => handleDeactivate(v.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {(showAdd || editingVehicle) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">{editingVehicle ? "Edit Vehicle" : "Add Vehicle"}</h2>
                            <button onClick={() => { setShowAdd(false); setEditingVehicle(null); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                        </div>
                        <form onSubmit={editingVehicle ? handleEdit : handleAdd} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Plate Number *"><input required value={form.plate_number} onChange={(e) => setForm((f) => ({ ...f, plate_number: e.target.value }))} className={inputCls} /></Field>
                                <Field label="Category">
                                    <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as VehicleCategory }))} className={inputCls}>
                                        {VEHICLE_CATEGORIES.map((c) => (
                                            <option key={c} value={c}>{formatVehicleCategory(c)}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Make *"><input required value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} className={inputCls} /></Field>
                                <Field label="Model *"><input required value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className={inputCls} /></Field>
                                <Field label="Year *"><input required type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} className={inputCls} /></Field>
                                <Field label="Color"><input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className={inputCls} /></Field>
                                <Field label="Passenger Seats *"><input required type="number" min={1} max={100} value={form.seat_capacity || ""} onChange={(e) => setForm((f) => ({ ...f, seat_capacity: Number(e.target.value) }))} className={inputCls} /></Field>
                                <Field label="Fuel Type">
                                    <select value={form.fuel_type} onChange={(e) => setForm((f) => ({ ...f, fuel_type: e.target.value as "" | "PETROL" | "DIESEL" }))} className={inputCls}>
                                        <option value="">Auto (from category)</option>
                                        <option value="PETROL">Petrol</option>
                                        <option value="DIESEL">Diesel</option>
                                    </select>
                                </Field>
                                <Field label="AC">
                                    <select value={form.ac_on} onChange={(e) => setForm((f) => ({ ...f, ac_on: e.target.value as "" | "on" | "off" }))} className={inputCls}>
                                        <option value="">Not set (AC-off idle rate)</option>
                                        <option value="on">AC on</option>
                                        <option value="off">AC off</option>
                                    </select>
                                </Field>
                                <Field label="Fuel City (km/L) *"><input required type="number" step="0.1" min={1} value={form.fuel_avg_city} onChange={(e) => setForm((f) => ({ ...f, fuel_avg_city: Number(e.target.value) }))} className={inputCls} /></Field>
                                <Field label="Fuel Highway (km/L)"><input type="number" step="0.1" value={form.fuel_avg_highway} onChange={(e) => setForm((f) => ({ ...f, fuel_avg_highway: Number(e.target.value) }))} className={inputCls} /></Field>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => { setShowAdd(false); setEditingVehicle(null); }} className={cancelBtnCls}>Cancel</button>
                                <button type="submit" disabled={saving} className={saveBtnCls}>{saving ? "Saving…" : editingVehicle ? "Update" : "Add"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
            {children}
        </div>
    );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#f47f00]";
const saveBtnCls = "bg-[#f47f00] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#d96e00] disabled:opacity-50";
const cancelBtnCls = "border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50";
