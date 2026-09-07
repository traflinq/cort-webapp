"use client";

import React, { useEffect, useState, memo } from "react";
import {
    CreateVehicleRequest,
    Vehicle,
    VehicleCategory,
    OwnershipType,
    DriverType,
} from "../../../lib/services/api-client";
import { useAppDispatch, useAppSelector } from "../../../lib/store/hooks";
import { fetchAdminVendors, selectAdminVendors } from "../../../lib/store/slices/adminVendorsSlice";
import {
    getPhoneValidationError,
    PHONE_MAX_LENGTH,
    PHONE_PLACEHOLDER,
    sanitizePhoneInput,
} from "../../../lib/utils/phone";

export type VehicleFormData = CreateVehicleRequest;

export const initialVehicleFormData: VehicleFormData = {
    make: "",
    model: "",
    year: new Date().getFullYear(),
    color: "",
    plate_number: "",
    category: VehicleCategory.SEDAN,
    ownership: OwnershipType.OWNED,
    fuel_avg_city: 0,
    fuel_avg_highway: 0,
    seat_capacity: 0,
    rent_per_day_city: 0,
    rent_per_day_outstation: 0,
    vendor_id: undefined,
    vendor_overtime_rate: 0,
    vendor_rent_5hr: 0,
    vendor_rent_10hr: 0,
    driver_full_name: "",
    driver_email: "",
    driver_phone: "",
    driver_password: "",
    driver_cnic_number: "",
    driver_license_number: "",
    driver_type: undefined,
};

function generatePassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
}

export const VehicleFormInline = memo(function VehicleFormInline({
    vehicle,
    onSave,
    onCancel,
    isSaving,
    saveDisabled = false,
}: {
    vehicle: Vehicle | null;
    onSave: (data: VehicleFormData) => void;
    onCancel: () => void;
    isSaving: boolean;
    /** When true, Save is disabled (e.g. missing CRUD permission). */
    saveDisabled?: boolean;
}) {
    const [formData, setFormData] = useState<VehicleFormData>(() => {
        if (!vehicle) {
            return initialVehicleFormData;
        }

        const driver = vehicle.drivers_profile?.[0];
        const driverUser = driver?.users;

        return {
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            color: vehicle.color || "",
            plate_number: vehicle.plate_number,
            category: vehicle.category,
            ownership: vehicle.ownership,
            fuel_avg_city: vehicle.fuel_avg_city,
            fuel_avg_highway: vehicle.fuel_avg_highway,
            seat_capacity: vehicle.seat_capacity || 0,
            owner_company_id: vehicle.owner_company_id || undefined,
            rent_per_day_city: vehicle.rent_per_day_city || 0,
            rent_per_day_outstation: vehicle.rent_per_day_outstation || 0,
            vendor_overtime_rate: vehicle.vendor_overtime_rate || 0,
            vendor_rent_5hr: vehicle.vendor_rent_5hr || 0,
            vendor_rent_10hr: vehicle.vendor_rent_10hr || 0,
            vendor_id: vehicle.vendor_id || vehicle.vendors?.id || undefined,
            driver_full_name: driverUser?.full_name || "",
            driver_email: driverUser?.email || "",
            driver_phone: driverUser?.phone || "",
            driver_password: "",
            driver_cnic_number: driver?.cnic_number || "",
            driver_license_number: driver?.license_number || "",
            driver_type: driver?.driver_type || undefined,
        };
    });

    const [showPassword, setShowPassword] = useState(false);

    const dispatch = useAppDispatch();
    const vendors = useAppSelector(selectAdminVendors);

    useEffect(() => {
        dispatch(fetchAdminVendors({ limit: 100 }));
    }, [dispatch]);

    const handleChange = (field: keyof VehicleFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleGeneratePassword = () => {
        const newPassword = generatePassword();
        handleChange("driver_password", newPassword);
    };

    const handleSave = () => {
        if (formData.ownership === OwnershipType.PARTNER) {
            const isEditMode = vehicle !== null;

            if (!formData.driver_full_name || !formData.driver_email || !formData.driver_type) {
                alert("Please fill in all required driver fields (Full Name, Email, and Driver Type) for partner vehicles.");
                return;
            }

            if (!isEditMode && !formData.driver_password) {
                alert("Please provide a password for the driver.");
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.driver_email)) {
                alert("Please enter a valid email address for the driver.");
                return;
            }

            if (formData.driver_password && formData.driver_password.length < 6) {
                alert("Driver password must be at least 6 characters long.");
                return;
            }

            const phoneError = getPhoneValidationError(formData.driver_phone || "");
            if (phoneError) {
                alert(phoneError);
                return;
            }
        }
        onSave(formData);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Make</label>
                    <input
                        type="text"
                        value={formData.make}
                        onChange={(e) => handleChange("make", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                        placeholder="Toyota"
                        disabled={isSaving}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Model</label>
                    <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => handleChange("model", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                        placeholder="Corolla"
                        disabled={isSaving}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Year</label>
                    <input
                        type="number"
                        value={formData.year}
                        onChange={(e) => handleChange("year", parseInt(e.target.value) || new Date().getFullYear())}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                        disabled={isSaving}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Color</label>
                    <input
                        type="text"
                        value={formData.color || ""}
                        onChange={(e) => handleChange("color", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                        placeholder="White"
                        disabled={isSaving}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Plate Number</label>
                    <input
                        type="text"
                        value={formData.plate_number}
                        onChange={(e) => handleChange("plate_number", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                        placeholder="ABC-123"
                        disabled={isSaving}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Seat Capacity</label>
                    <input
                        type="number"
                        value={formData.seat_capacity}
                        onChange={(e) => handleChange("seat_capacity", parseInt(e.target.value) || 0)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                        placeholder="4"
                        disabled={isSaving}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Fuel Avg (City)</label>
                    <input
                        type="number"
                        value={formData.fuel_avg_city}
                        onChange={(e) => handleChange("fuel_avg_city", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                        disabled={isSaving}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Fuel Avg (Highway)</label>
                    <input
                        type="number"
                        value={formData.fuel_avg_highway}
                        onChange={(e) => handleChange("fuel_avg_highway", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                        disabled={isSaving}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Category</label>
                    <select
                        value={formData.category}
                        onChange={(e) => handleChange("category", e.target.value as VehicleCategory)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none bg-[var(--bg-card)]"
                        disabled={isSaving}
                    >
                        {Object.values(VehicleCategory).map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Ownership</label>
                    <select
                        value={formData.ownership}
                        onChange={(e) => handleChange("ownership", e.target.value as OwnershipType)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none bg-[var(--bg-card)]"
                        disabled={isSaving}
                    >
                        {Object.values(OwnershipType).map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
            </div>

            {formData.ownership === OwnershipType.PARTNER && (
                <div className="space-y-4 border-t border-[var(--border-default)] pt-4 mt-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Vendor</label>
                        <select
                            value={formData.vendor_id || ""}
                            onChange={(e) => handleChange("vendor_id", parseInt(e.target.value) || undefined)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none bg-[var(--bg-card)]"
                            disabled={isSaving}
                        >
                            <option value="">Select Vendor</option>
                            {vendors.map((vendor) => (
                                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Rent 24 Hrs (City)</label>
                            <input
                                type="number"
                                value={formData.rent_per_day_city || 0}
                                onChange={(e) => handleChange("rent_per_day_city", parseFloat(e.target.value) || 0)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Rent 24 Hrs (Outstation)</label>
                            <input
                                type="number"
                                value={formData.rent_per_day_outstation || 0}
                                onChange={(e) => handleChange("rent_per_day_outstation", parseFloat(e.target.value) || 0)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                                disabled={isSaving}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Vendor Overtime Rate (PKR/hr)</label>
                            <input
                                type="number"
                                min="0"
                                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={formData.vendor_overtime_rate}
                                onChange={(e) => setFormData(prev => ({ ...prev, vendor_overtime_rate: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--text-secondary)]">Vendor 5h Rent (Fixed)</label>
                        <input
                            type="number"
                            min="0"
                            className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={formData.vendor_rent_5hr}
                            onChange={(e) => setFormData(prev => ({ ...prev, vendor_rent_5hr: parseFloat(e.target.value) || 0 }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--text-secondary)]">Vendor 10h Rent (Fixed)</label>
                        <input
                            type="number"
                            min="0"
                            className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={formData.vendor_rent_10hr}
                            onChange={(e) => setFormData(prev => ({ ...prev, vendor_rent_10hr: parseFloat(e.target.value) || 0 }))}
                        />
                    </div>
                </div>
            )}

            {/* Driver Details Section - Only for PARTNER vehicles */}
            {formData.ownership === OwnershipType.PARTNER && (
                <div className="space-y-4 border-t border-[var(--border-default)] pt-4 mt-4">
                    <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">Driver Details</h4>

                    <div>
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Driver Type <span className="text-red-500">*</span></label>
                        <select
                            value={formData.driver_type || ""}
                            onChange={(e) => handleChange("driver_type", e.target.value as any)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none bg-[var(--bg-card)]"
                            disabled={isSaving}
                            required
                        >
                            <option value="">Select Driver Type</option>
                            <option value="CHAUFFEUR">CHAUFFEUR</option>
                            <option value="SHUTTLE">SHUTTLE</option>
                            <option value="BOTH">BOTH (shuttle + chauffeur)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Driver Full Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={formData.driver_full_name || ""}
                            onChange={(e) => handleChange("driver_full_name", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                            placeholder="John Driver"
                            disabled={isSaving}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Driver Email <span className="text-red-500">*</span></label>
                        <input
                            type="email"
                            value={formData.driver_email || ""}
                            onChange={(e) => handleChange("driver_email", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                            placeholder="driver@example.com"
                            disabled={isSaving}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Driver Phone</label>
                        <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={PHONE_MAX_LENGTH}
                            value={formData.driver_phone || ""}
                            onChange={(e) => handleChange("driver_phone", sanitizePhoneInput(e.target.value))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                            placeholder={PHONE_PLACEHOLDER}
                            disabled={isSaving}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Driver Password <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={formData.driver_password || ""}
                                    onChange={(e) => handleChange("driver_password", e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-[#f47f00] outline-none"
                                    placeholder="Min 6 characters"
                                    disabled={isSaving}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                                    disabled={isSaving}
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={handleGeneratePassword}
                                className="rounded-lg bg-slate-200 hover:bg-slate-300 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors"
                                disabled={isSaving}
                            >
                                Generate
                            </button>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Minimum 6 characters</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Driver CNIC</label>
                            <input
                                type="text"
                                value={formData.driver_cnic_number || ""}
                                onChange={(e) => handleChange("driver_cnic_number", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                                placeholder="12345-6789012-3"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Driver License Number</label>
                            <input
                                type="text"
                                value={formData.driver_license_number || ""}
                                onChange={(e) => handleChange("driver_license_number", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] outline-none"
                                placeholder="ABC123456"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-default)] mt-6">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    disabled={isSaving}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="rounded-lg bg-[#f47f00] px-4 py-2 text-sm font-bold text-white hover:bg-[#d97000] shadow-md shadow-orange-500/10 disabled:opacity-50"
                    disabled={isSaving || saveDisabled}
                >
                    {isSaving ? "Saving..." : "Save Vehicle"}
                </button>
            </div>
        </div >
    );
});
