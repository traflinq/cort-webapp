"use client";

import React, { useEffect, useState, memo } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { CreateVehicleRequest, Vehicle, VehicleCategory, OwnershipType, DriverType } from "../../../lib/services/api-client";
import { useAppDispatch, useAppSelector } from "../../../lib/store/hooks";
import { fetchAdminVendors, selectAdminVendors } from "../../../lib/store/slices/adminVendorsSlice";
import { getPhoneValidationError, PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, sanitizePhoneInput } from "../../../lib/utils/phone";
import { generatePassword, humanize } from "../../lib/format";
import { Button, Field, FormGrid, IconButton, Input, Select } from "../../ui";

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

type Errors = Partial<Record<"make" | "model" | "plate_number" | "driver_full_name" | "driver_email" | "driver_type" | "driver_password" | "driver_phone", string>>;

const num = (v: string, parser: (s: string) => number = parseFloat) => {
  const n = parser(v);
  return Number.isNaN(n) ? 0 : n;
};

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
    if (!vehicle) return initialVehicleFormData;
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
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);

  const dispatch = useAppDispatch();
  const vendors = useAppSelector(selectAdminVendors);

  useEffect(() => {
    dispatch(fetchAdminVendors({ limit: 100 }));
  }, [dispatch]);

  const handleChange = <K extends keyof VehicleFormData>(field: K, value: VehicleFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field in errors) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const isPartner = formData.ownership === OwnershipType.PARTNER;
  const isEditMode = vehicle !== null;

  const submit = () => {
    const next: Errors = {};
    if (!formData.make.trim()) next.make = "Make is required.";
    if (!formData.model.trim()) next.model = "Model is required.";
    if (!formData.plate_number.trim()) next.plate_number = "Plate number is required.";
    if (isPartner) {
      if (!formData.driver_full_name) next.driver_full_name = "Driver name is required for partner vehicles.";
      if (!formData.driver_email) next.driver_email = "Driver email is required for partner vehicles.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.driver_email)) next.driver_email = "Enter a valid email address.";
      if (!formData.driver_type) next.driver_type = "Select a driver type.";
      if (!isEditMode && !formData.driver_password) next.driver_password = "A password is required for the new driver.";
      else if (formData.driver_password && formData.driver_password.length < 6) next.driver_password = "Password must be at least 6 characters.";
      const phoneError = getPhoneValidationError(formData.driver_phone || "");
      if (phoneError) next.driver_phone = phoneError;
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    onSave(formData);
  };

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <FormGrid cols={2}>
        <Field label="Make" required error={errors.make}>
          <Input value={formData.make} onChange={(e) => handleChange("make", e.target.value)} placeholder="Toyota" disabled={isSaving} />
        </Field>
        <Field label="Model" required error={errors.model}>
          <Input value={formData.model} onChange={(e) => handleChange("model", e.target.value)} placeholder="Corolla" disabled={isSaving} />
        </Field>
        <Field label="Plate number" required error={errors.plate_number}>
          <Input mono value={formData.plate_number} onChange={(e) => handleChange("plate_number", e.target.value)} placeholder="ABC-123" disabled={isSaving} />
        </Field>
        <Field label="Color">
          <Input value={formData.color || ""} onChange={(e) => handleChange("color", e.target.value)} placeholder="White" disabled={isSaving} />
        </Field>
        <Field label="Year">
          <Input type="number" inputMode="numeric" value={formData.year} onChange={(e) => handleChange("year", num(e.target.value, (s) => parseInt(s, 10)) || new Date().getFullYear())} disabled={isSaving} />
        </Field>
        <Field label="Seat capacity">
          <Input type="number" inputMode="numeric" min={0} value={formData.seat_capacity} onChange={(e) => handleChange("seat_capacity", num(e.target.value, (s) => parseInt(s, 10)))} placeholder="4" disabled={isSaving} />
        </Field>
        <Field label="Fuel average (city)" hint="km per litre">
          <Input type="number" step="0.1" min={0} value={formData.fuel_avg_city} onChange={(e) => handleChange("fuel_avg_city", num(e.target.value))} disabled={isSaving} />
        </Field>
        <Field label="Fuel average (highway)" hint="km per litre">
          <Input type="number" step="0.1" min={0} value={formData.fuel_avg_highway} onChange={(e) => handleChange("fuel_avg_highway", num(e.target.value))} disabled={isSaving} />
        </Field>
        <Field label="Category">
          <Select value={formData.category} onChange={(e) => handleChange("category", e.target.value as VehicleCategory)} disabled={isSaving}>
            {Object.values(VehicleCategory).map((cat) => (
              <option key={cat} value={cat}>
                {humanize(cat)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ownership">
          <Select value={formData.ownership} onChange={(e) => handleChange("ownership", e.target.value as OwnershipType)} disabled={isSaving}>
            {Object.values(OwnershipType).map((type) => (
              <option key={type} value={type}>
                {humanize(type)}
              </option>
            ))}
          </Select>
        </Field>
      </FormGrid>

      {isPartner && (
        <section className="space-y-4 border-t border-line pt-5">
          <h4 className="text-sm font-semibold text-fg">Vendor &amp; rates</h4>
          <FormGrid cols={2}>
            <Field label="Vendor" className="sm:col-span-2">
              <Select value={formData.vendor_id || ""} onChange={(e) => handleChange("vendor_id", parseInt(e.target.value, 10) || undefined)} disabled={isSaving} placeholder="Select vendor">
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rent per 24h (city)" hint="PKR">
              <Input type="number" min={0} value={formData.rent_per_day_city || 0} onChange={(e) => handleChange("rent_per_day_city", num(e.target.value))} disabled={isSaving} />
            </Field>
            <Field label="Rent per 24h (outstation)" hint="PKR">
              <Input type="number" min={0} value={formData.rent_per_day_outstation || 0} onChange={(e) => handleChange("rent_per_day_outstation", num(e.target.value))} disabled={isSaving} />
            </Field>
            <Field label="Vendor overtime rate" hint="PKR per hour">
              <Input type="number" min={0} value={formData.vendor_overtime_rate ?? 0} onChange={(e) => handleChange("vendor_overtime_rate", num(e.target.value))} disabled={isSaving} />
            </Field>
            <Field label="Vendor 5h rent (fixed)" hint="PKR">
              <Input type="number" min={0} value={formData.vendor_rent_5hr ?? 0} onChange={(e) => handleChange("vendor_rent_5hr", num(e.target.value))} disabled={isSaving} />
            </Field>
            <Field label="Vendor 10h rent (fixed)" hint="PKR">
              <Input type="number" min={0} value={formData.vendor_rent_10hr ?? 0} onChange={(e) => handleChange("vendor_rent_10hr", num(e.target.value))} disabled={isSaving} />
            </Field>
          </FormGrid>
        </section>
      )}

      {isPartner && (
        <section className="space-y-4 border-t border-line pt-5">
          <div>
            <h4 className="text-sm font-semibold text-fg">Driver details</h4>
            <p className="mt-0.5 text-xs text-fg-muted">Partner vehicles come with their own driver account.</p>
          </div>
          <FormGrid cols={2}>
            <Field label="Driver type" required error={errors.driver_type}>
              <Select value={formData.driver_type || ""} onChange={(e) => handleChange("driver_type", (e.target.value || undefined) as DriverType | undefined)} disabled={isSaving} placeholder="Select driver type">
                <option value={DriverType.CHAUFFEUR}>Chauffeur</option>
                <option value={DriverType.SHUTTLE}>Shuttle</option>
                <option value={DriverType.BOTH}>Both (shuttle + chauffeur)</option>
              </Select>
            </Field>
            <Field label="Driver full name" required error={errors.driver_full_name}>
              <Input value={formData.driver_full_name || ""} onChange={(e) => handleChange("driver_full_name", e.target.value)} placeholder="John Driver" disabled={isSaving} />
            </Field>
            <Field label="Driver email" required error={errors.driver_email}>
              <Input type="email" value={formData.driver_email || ""} onChange={(e) => handleChange("driver_email", e.target.value)} placeholder="driver@example.com" disabled={isSaving} autoComplete="off" />
            </Field>
            <Field label="Driver phone" error={errors.driver_phone}>
              <Input type="tel" inputMode="numeric" maxLength={PHONE_MAX_LENGTH} value={formData.driver_phone || ""} onChange={(e) => handleChange("driver_phone", sanitizePhoneInput(e.target.value))} placeholder={PHONE_PLACEHOLDER} disabled={isSaving} />
            </Field>
            <Field label="Driver password" required={!isEditMode} hint={isEditMode ? "Leave empty to keep the current password." : "Minimum 6 characters."} error={errors.driver_password} className="sm:col-span-2">
              <div className="flex gap-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  mono
                  value={formData.driver_password || ""}
                  onChange={(e) => handleChange("driver_password", e.target.value)}
                  placeholder="Min 6 characters"
                  disabled={isSaving}
                  autoComplete="new-password"
                  rightIcon={
                    <IconButton label={showPassword ? "Hide password" : "Show password"} size="icon-xs" tooltip={false} onClick={() => setShowPassword((s) => !s)} disabled={isSaving}>
                      {showPassword ? <EyeOff /> : <Eye />}
                    </IconButton>
                  }
                />
                <Button type="button" variant="outline" leftIcon={<KeyRound />} onClick={() => handleChange("driver_password", generatePassword(12))} disabled={isSaving} className="shrink-0">
                  Generate
                </Button>
              </div>
            </Field>
            <Field label="Driver CNIC">
              <Input mono value={formData.driver_cnic_number || ""} onChange={(e) => handleChange("driver_cnic_number", e.target.value)} placeholder="12345-6789012-3" disabled={isSaving} />
            </Field>
            <Field label="Driver license number">
              <Input mono value={formData.driver_license_number || ""} onChange={(e) => handleChange("driver_license_number", e.target.value)} placeholder="ABC123456" disabled={isSaving} />
            </Field>
          </FormGrid>
        </section>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" loading={isSaving} disabled={saveDisabled}>
          {isEditMode ? "Save changes" : "Add vehicle"}
        </Button>
      </div>
    </form>
  );
});
