"use client";

import React, { useState, memo } from "react";
import { Company, CreateCompanyRequest } from "../../../lib/services/api-client";
import { uploadFile } from "../../../lib/supabase";

export type CompanyFormData = CreateCompanyRequest;

export const initialFormData: CompanyFormData = {
    name: "",
    prefix: "",
    email: "",
    auth_email: "",
    password: "",
    contact_person: "",
    ntn_number: "",
    address: "",
    logo_url: "",
    is_shuttle_enabled: false,
    is_chauffeur_enabled: false,
    is_travel_enabled: false,
};

export const CompanyForm = memo(function CompanyForm({
    company,
    onSave,
    onCancel,
    isSaving
}: {
    company: Company | null;
    onSave: (data: CompanyFormData) => void;
    onCancel: () => void;
    isSaving: boolean;
}) {
    const [formData, setFormData] = useState<CompanyFormData>(
        company
            ? {
                name: company.name,
                email: company.email,
                auth_email: "",
                contact_person: company.contact_person || "",
                ntn_number: company.ntn_number || "",
                address: company.address || "",
                logo_url: company.logo_url || "",
                is_shuttle_enabled: company.is_shuttle_enabled,
                is_chauffeur_enabled: company.is_chauffeur_enabled,
                is_travel_enabled: company.is_travel_enabled ?? false,
                prefix: company.prefix || "",
            }
            : initialFormData
    );

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(company?.logo_url || null);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    const handleChange = (field: keyof CompanyFormData, value: any) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value };
            if (field === "prefix" && !company) {
                const currentAuthPrefix = (prev.auth_email || "").replace("@cort.com.pk", "");
                if (!prev.auth_email || currentAuthPrefix === prev.prefix) {
                    next.auth_email = value ? `${value}@cort.com.pk` : "";
                }
            }
            return next;
        });
    };

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let pass = "";
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        handleChange("password", pass);
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                alert('File size must be less than 2MB');
                return;
            }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setLogoFile(null);
        setLogoPreview(null);
        handleChange("logo_url", "");
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="col-span-1">
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Company Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleChange("name", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                            placeholder="e.g. Acme Corp"
                            disabled={isSaving}
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">
                            Prefix <span className="text-[var(--text-muted)] font-normal">(Short Name)</span>
                        </label>
                        <input
                            type="text"
                            value={formData.prefix || ""}
                            onChange={(e) => handleChange("prefix", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                            placeholder="e.g. acme"
                            disabled={isSaving}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">
                            Company Email <span className="text-[var(--text-muted)] font-normal"></span>
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange("email", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                            placeholder="admin@acmecorp.com"
                            disabled={isSaving}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">
                            Auth Email <span className="text-[var(--text-muted)] font-normal"></span>
                        </label>
                        <div className="flex">
                            <input
                                type="text"
                                value={(formData.auth_email || "").replace("@cort.com.pk", "")}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    handleChange("auth_email", val ? `${val}@cort.com.pk` : "");
                                }}
                                className="flex-1 min-w-0 rounded-l-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                                placeholder="e.g. admin-name"
                                disabled={isSaving || !!company}
                            />
                            <span className="flex-shrink-0 inline-flex items-center px-3 rounded-r-lg border border-l-0 border-slate-300 bg-[var(--bg-subtle)] text-[var(--text-muted)] text-sm font-medium whitespace-nowrap">
                                @cort.com.pk
                            </span>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">
                            Final Login ID: {formData.auth_email || "(Defaults to Notification Email if empty)"}
                        </p>
                    </div>
                </div>

                {!company && (
                    <div>
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">
                            Password <span className="text-[var(--text-muted)] font-normal">(Optional, auto-generated if empty)</span>
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

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Contact Person</label>
                        <input
                            type="text"
                            value={formData.contact_person}
                            onChange={(e) => handleChange("contact_person", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                            placeholder="John Doe"
                            disabled={isSaving}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">NTN</label>
                        <input
                            type="text"
                            value={formData.ntn_number}
                            onChange={(e) => handleChange("ntn_number", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                            placeholder="1234567-8"
                            disabled={isSaving}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Address</label>
                    <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => handleChange("address", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                        placeholder="123 Business Rd, City"
                        disabled={isSaving}
                    />
                </div>

                {/* Logo Upload */}
                <div>
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-1">Company Logo</label>
                    <div className="space-y-3">
                        {logoPreview ? (
                            <div className="relative inline-block">
                                <img
                                    src={logoPreview}
                                    alt="Company logo preview"
                                    className="h-24 w-24 object-cover rounded-lg border-2 border-[var(--border-default)]"
                                />
                                <button
                                    type="button"
                                    onClick={handleRemoveLogo}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                    disabled={isSaving || isUploadingLogo}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoChange}
                                        className="hidden"
                                        disabled={isSaving || isUploadingLogo}
                                    />
                                    <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#f47f00] border border-[#f47f00] rounded-lg hover:bg-orange-50 disabled:opacity-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="17 8 12 3 7 8"></polyline>
                                            <line x1="12" y1="3" x2="12" y2="15"></line>
                                        </svg>
                                        Upload Logo
                                    </div>
                                </label>
                                <span className="text-xs text-[var(--text-muted)]">Max 2MB, PNG/JPG</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-default)]">
                    <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">Services</label>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer bg-[var(--bg-subtle)] px-3 py-2 rounded-lg border border-[var(--border-default)] hover:bg-slate-100">
                            <input
                                type="checkbox"
                                checked={formData.is_shuttle_enabled}
                                onChange={(e) => handleChange('is_shuttle_enabled', e.target.checked)}
                                className="accent-[#f47f00] w-4 h-4"
                                disabled={isSaving}
                            />
                            <span className="text-sm font-medium text-[var(--text-secondary)]">Shuttle</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-[var(--bg-subtle)] px-3 py-2 rounded-lg border border-[var(--border-default)] hover:bg-slate-100">
                            <input
                                type="checkbox"
                                checked={formData.is_chauffeur_enabled}
                                onChange={(e) => handleChange('is_chauffeur_enabled', e.target.checked)}
                                className="accent-[#f47f00] w-4 h-4"
                                disabled={isSaving}
                            />
                            <span className="text-sm font-medium text-[var(--text-secondary)]">Chauffeur</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-[var(--bg-subtle)] px-3 py-2 rounded-lg border border-[var(--border-default)] hover:bg-slate-100">
                            <input
                                type="checkbox"
                                checked={formData.is_travel_enabled}
                                onChange={(e) => handleChange('is_travel_enabled', e.target.checked)}
                                className="accent-[#f47f00] w-4 h-4"
                                disabled={isSaving}
                            />
                            <span className="text-sm font-medium text-[var(--text-secondary)]">Travel</span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-[var(--border-default)] pt-4">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    disabled={isSaving || isUploadingLogo}
                >
                    Cancel
                </button>
                <button
                    onClick={async () => {
                        try {
                            let finalData = { ...formData };
                            if (!finalData.auth_email || company) {
                                delete (finalData as any).auth_email;
                            }
                            if (!finalData.password || company) {
                                delete (finalData as any).password;
                            }
                            if (logoFile) {
                                setIsUploadingLogo(true);
                                const fileName = `${Date.now()}-${logoFile.name}`;
                                const logoUrl = await uploadFile('company-logos', fileName, logoFile);
                                finalData.logo_url = logoUrl;
                            }
                            onSave(finalData);
                        } catch (error: any) {
                            console.error('Failed to upload logo:', error);
                            alert(error.message || 'Failed to upload logo');
                        } finally {
                            setIsUploadingLogo(false);
                        }
                    }}
                    className="rounded-lg bg-[#f47f00] px-4 py-2 text-sm font-bold text-white hover:bg-[#d97000] shadow-md shadow-orange-500/10 disabled:opacity-50"
                    disabled={isSaving || isUploadingLogo}
                >
                    {isUploadingLogo ? "Uploading Logo..." : isSaving ? "Saving..." : "Save Company"}
                </button>
            </div>
        </div>
    );
});
