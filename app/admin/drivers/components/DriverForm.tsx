"use client";

import React, { useState, memo } from "react";
import { CreateDriverRequest, DriverType, DriverStatus } from "../../../lib/services/api-client";
import {
    getPhoneValidationError,
    PHONE_MAX_LENGTH,
    PHONE_PLACEHOLDER,
    sanitizePhoneInput,
} from "../../../lib/utils/phone";

const initialFormData: CreateDriverRequest = {
    full_name: "",
    email: "",
    password: "",
    phone: "",
    driver_type: DriverType.SHUTTLE,
    cnic_number: "",
    license_number: "",
};

export const DriverForm = memo(function DriverForm({
    driver,
    onSave,
    onCancel,
    onZoomImage,
    isSaving,
}: {
    driver: any | null;
    onSave: (data: CreateDriverRequest) => void;
    onCancel: () => void;
    onZoomImage?: (url: string, name: string) => void;
    isSaving: boolean;
}) {
    const [phoneError, setPhoneError] = useState<string | null>(null);

    const [formData, setFormData] = useState<CreateDriverRequest>(
        driver
            ? {
                full_name: driver.full_name,
                email: driver.email,
                password: "",
                phone: driver.phone || "",
                driver_type: driver.drivers_profile?.driver_type || DriverType.SHUTTLE,
                cnic_number: driver.drivers_profile?.cnic_number || "",
                license_number: driver.drivers_profile?.license_number || "",
                status: driver.status as any,
            }
            : initialFormData
    );

    const handleChange = (field: keyof CreateDriverRequest, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let pass = "";
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        handleChange("password", pass);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Full Name</label>
                    <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => handleChange("full_name", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                        placeholder="John Doe"
                        disabled={isSaving}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Email</label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                        placeholder="driver@example.com"
                        disabled={isSaving || !!driver}
                    />
                </div>

                {!driver && (
                    <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                            Password <span className="text-slate-400 font-normal">(Optional, auto-generated if empty)</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={formData.password || ""}
                                onChange={(e) => handleChange("password", e.target.value)}
                                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none font-mono"
                                placeholder="Leave empty to auto-generate"
                                disabled={isSaving}
                            />
                            <button
                                type="button"
                                onClick={generatePassword}
                                className="px-3 py-2 text-xs font-bold text-[#f47f00] border border-[#f47f00] rounded-lg hover:bg-orange-50 disabled:opacity-50"
                                disabled={isSaving}
                            >
                                Generate
                            </button>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Driver Type</label>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="driver_type"
                                value={DriverType.SHUTTLE}
                                checked={formData.driver_type === DriverType.SHUTTLE}
                                onChange={() => handleChange("driver_type", DriverType.SHUTTLE)}
                                className="accent-[#f47f00]"
                                disabled={isSaving}
                            />
                            <span className="text-sm">Shuttle Driver</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="driver_type"
                                value={DriverType.CHAUFFEUR}
                                checked={formData.driver_type === DriverType.CHAUFFEUR}
                                onChange={() => handleChange("driver_type", DriverType.CHAUFFEUR)}
                                className="accent-[#f47f00]"
                                disabled={isSaving}
                            />
                            <span className="text-sm">Chauffeur</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="driver_type"
                                value={DriverType.BOTH}
                                checked={formData.driver_type === DriverType.BOTH}
                                onChange={() => handleChange("driver_type", DriverType.BOTH)}
                                className="accent-[#f47f00]"
                                disabled={isSaving}
                            />
                            <span className="text-sm">Both (shuttle + chauffeur)</span>
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Phone</label>
                        <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={PHONE_MAX_LENGTH}
                            value={formData.phone}
                            onChange={(e) => {
                                handleChange("phone", sanitizePhoneInput(e.target.value));
                                setPhoneError(null);
                            }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                            placeholder={PHONE_PLACEHOLDER}
                            disabled={isSaving}
                        />
                        {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">CNIC (Optional)</label>
                        <input
                            type="text"
                            value={formData.cnic_number}
                            onChange={(e) => handleChange("cnic_number", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                            placeholder="12345-6789012-3"
                            disabled={isSaving}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">License Number (Optional)</label>
                    <input
                        type="text"
                        value={formData.license_number}
                        onChange={(e) => handleChange("license_number", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                        placeholder="ABC123456"
                        disabled={isSaving}
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Profile Picture (Optional)</label>
                    {driver?.profile_picture_url && (
                        <div className="mb-2">
                            <img
                                src={driver.profile_picture_url}
                                alt="Current profile"
                                className="w-16 h-16 rounded-full object-cover border border-slate-200 cursor-zoom-in hover:opacity-80 transition-opacity"
                                onClick={() => onZoomImage?.(driver.profile_picture_url, driver.full_name)}
                            />
                        </div>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleChange("profile_picture", file);
                        }}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-[#f47f00] hover:file:bg-orange-100"
                        disabled={isSaving}
                    />
                </div>

                {driver && (
                    <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => handleChange("status", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none bg-white"
                            disabled={isSaving}
                        >
                            <option value={DriverStatus.ACTIVE}>Active</option>
                            <option value={DriverStatus.INACTIVE}>Inactive</option>
                            <option value={DriverStatus.SUSPENDED}>Suspended</option>
                            <option value={DriverStatus.PENDING}>Pending</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                    disabled={isSaving}
                >
                    Cancel
                </button>
                <button
                    onClick={() => {
                        const error = getPhoneValidationError(formData.phone || "");
                        if (error) {
                            setPhoneError(error);
                            return;
                        }
                        onSave(formData);
                    }}
                    className="rounded-lg bg-[#f47f00] px-4 py-2 text-sm font-bold text-white hover:bg-[#d97000] shadow-md shadow-orange-500/10 disabled:opacity-50"
                    disabled={isSaving}
                >
                    {isSaving ? "Saving..." : "Save Driver"}
                </button>
            </div>
        </div>
    );
});
