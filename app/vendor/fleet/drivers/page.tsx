"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../../../lib/services/api-client";
import { VendorDriver } from "../../../lib/services/types/multi-mode";
import { useVendorContext } from "../../layout";
import { toast } from "sonner";
import {
    getPhoneValidationError,
    PHONE_MAX_LENGTH,
    PHONE_PLACEHOLDER,
    sanitizePhoneInput,
} from "../../../lib/utils/phone";

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

/** Derive allowed driver types from the link's service flags */
function getDriverTypes(link: { serves_chauffeur?: boolean; serves_shuttle?: boolean } | null): string[] {
    if (!link) return ["CHAUFFEUR", "SHUTTLE", "BOTH"];
    const types: string[] = [];
    if (link.serves_chauffeur) types.push("CHAUFFEUR");
    if (link.serves_shuttle) types.push("SHUTTLE");
    if (link.serves_chauffeur && link.serves_shuttle) types.push("BOTH");
    return types.length > 0 ? types : ["CHAUFFEUR", "SHUTTLE", "BOTH"];
}

export default function VendorDriversPage() {
    const { selectedLink } = useVendorContext();
    const [drivers, setDrivers] = useState<VendorDriver[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);

    const availableDriverTypes = getDriverTypes(selectedLink);
    const defaultDriverType = availableDriverTypes[0];

    const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", driver_type: defaultDriverType, cnic_number: "", license_number: "" });
    const [saving, setSaving] = useState(false);

    // Reset driver_type default when selectedLink changes
    useEffect(() => {
        setForm((f) => ({ ...f, driver_type: getDriverTypes(selectedLink)[0] }));
    }, [selectedLink]);

    const load = useCallback(async () => {
        if (!selectedLink) return;
        setLoading(true);
        try {
            const res = await apiClient.getVendorDrivers(selectedLink.id) as any;
            setDrivers(res?.data?.data ?? res?.data ?? []);
        } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load drivers"); }
        finally { setLoading(false); }
    }, [selectedLink]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLink) return;
        const phoneError = getPhoneValidationError(form.phone);
        if (phoneError) {
            toast.error(phoneError);
            return;
        }
        setSaving(true);
        try {
            await apiClient.createVendorDriver({
                company_vendor_link_id: selectedLink.id,
                email: form.email,
                password: form.password,
                full_name: form.full_name,
                phone: form.phone || undefined,
                driver_type: form.driver_type,
                cnic_number: form.cnic_number || undefined,
                license_number: form.license_number || undefined,
            });
            toast.success("Driver added");
            setShowAdd(false);
            setForm({ email: "", password: "", full_name: "", phone: "", driver_type: getDriverTypes(selectedLink)[0], cnic_number: "", license_number: "" });
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to add driver");
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (userId: string) => {
        if (!confirm("Remove this driver from your fleet?")) return;
        try {
            await apiClient.removeVendorDriver(userId);
            toast.success("Driver removed");
            load();
        } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to remove driver"); }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#0c225e]">Fleet — Drivers</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your vendor fleet drivers</p>
                </div>
                <button onClick={() => setShowAdd(true)} className={saveBtnCls}>+ Add Driver</button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            {["Name", "Email", "Phone", "Type", "Status", "Actions"].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr key="loading"><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
                        ) : drivers.length === 0 ? (
                            <tr key="empty"><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No drivers in your fleet yet</td></tr>
                        ) : drivers.map((d) => (
                            <tr key={d.user_id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">{d.users.full_name}</td>
                                <td className="px-4 py-3 text-gray-600">{d.users.email}</td>
                                <td className="px-4 py-3 text-gray-600">{d.users.phone ?? "—"}</td>
                                <td className="px-4 py-3 text-gray-600">{d.driver_type ?? "—"}</td>
                                <td className="px-4 py-3">
                                    <span className={cx("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", d.users.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                                        {d.users.status ?? "—"}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <button onClick={() => handleRemove(d.user_id)} className="text-xs text-red-500 hover:underline">Remove</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add Driver Modal */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Add Driver</h2>
                            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                        </div>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Full Name *"><input required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className={inputCls} /></Field>
                                <Field label="Phone"><input type="tel" inputMode="numeric" maxLength={PHONE_MAX_LENGTH} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: sanitizePhoneInput(e.target.value) }))} placeholder={PHONE_PLACEHOLDER} className={inputCls} /></Field>
                                <Field label="Email *"><input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} /></Field>
                                <Field label="Password *"><input required type="password" minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} /></Field>
                                <Field label="Driver Type *">
                                    <select value={form.driver_type} onChange={(e) => setForm((f) => ({ ...f, driver_type: e.target.value }))} className={inputCls}>
                                        {availableDriverTypes.map((t) => (
                                            <option key={t} value={t}>
                                                {t === "CHAUFFEUR" ? "Chauffeur" : t === "SHUTTLE" ? "Shuttle / Bus Driver" : t === "BOTH" ? "Both (shuttle + chauffeur)" : t}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="CNIC"><input value={form.cnic_number} onChange={(e) => setForm((f) => ({ ...f, cnic_number: e.target.value }))} className={inputCls} /></Field>
                                <Field label="License No." className="col-span-2"><input value={form.license_number} onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))} className={inputCls} /></Field>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowAdd(false)} className={cancelBtnCls}>Cancel</button>
                                <button type="submit" disabled={saving} className={saveBtnCls}>{saving ? "Adding…" : "Add Driver"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
            {children}
        </div>
    );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#f47f00]";
const saveBtnCls = "bg-[#f47f00] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#d96e00] disabled:opacity-50";
const cancelBtnCls = "border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50";
