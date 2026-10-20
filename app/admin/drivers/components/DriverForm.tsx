"use client";

import React, { useState, memo } from "react";
import { KeyRound, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateDriverRequest, Driver, DriverType, DriverStatus } from "../../../lib/services/api-client";
import { getPhoneValidationError, PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, sanitizePhoneInput } from "../../../lib/utils/phone";
import { generatePassword } from "../../lib/format";
import { Button, Field, FormGrid, Input, Select } from "../../ui";
import { focusRing } from "../../ui/styles";

const initialFormData: CreateDriverRequest = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  driver_type: DriverType.SHUTTLE,
  cnic_number: "",
  license_number: "",
};

const DRIVER_TYPES: { value: DriverType; label: string }[] = [
  { value: DriverType.SHUTTLE, label: "Shuttle" },
  { value: DriverType.CHAUFFEUR, label: "Chauffeur" },
  { value: DriverType.BOTH, label: "Both" },
];

type Errors = Partial<Record<"full_name" | "email" | "phone" | "password", string>>;

export const DriverForm = memo(function DriverForm({
  driver,
  onSave,
  onCancel,
  onZoomImage,
  isSaving,
}: {
  driver: Driver | null;
  onSave: (data: CreateDriverRequest) => void;
  onCancel: () => void;
  onZoomImage?: (url: string, name: string) => void;
  isSaving: boolean;
}) {
  const [errors, setErrors] = useState<Errors>({});
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
          status: driver.status as CreateDriverRequest["status"],
        }
      : initialFormData,
  );

  const handleChange = <K extends keyof CreateDriverRequest>(field: K, value: CreateDriverRequest[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field in errors) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = () => {
    const next: Errors = {};
    if (!formData.full_name.trim()) next.full_name = "Full name is required.";
    if (!formData.email.trim()) next.email = "Email is required.";
    const phoneError = getPhoneValidationError(formData.phone || "");
    if (phoneError) next.phone = phoneError;
    if (!driver && formData.password && formData.password.length < 6) next.password = "Password must be at least 6 characters.";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    onSave(formData);
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <FormGrid cols={2}>
        <Field label="Full name" required error={errors.full_name}>
          <Input value={formData.full_name} onChange={(e) => handleChange("full_name", e.target.value)} placeholder="John Doe" disabled={isSaving} autoComplete="off" />
        </Field>
        <Field label="Email" required error={errors.email} hint={driver ? "Email can't be changed after creation." : undefined}>
          <Input type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="driver@example.com" disabled={isSaving || !!driver} autoComplete="off" />
        </Field>

        {!driver && (
          <Field label="Password" hint="Leave empty to auto-generate a password." error={errors.password} className="sm:col-span-2">
            <div className="flex gap-2">
              <Input mono value={formData.password || ""} onChange={(e) => handleChange("password", e.target.value)} placeholder="Auto-generated if empty" disabled={isSaving} autoComplete="new-password" />
              <Button type="button" variant="outline" leftIcon={<KeyRound />} onClick={() => handleChange("password", generatePassword(12))} disabled={isSaving} className="shrink-0">
                Generate
              </Button>
            </div>
          </Field>
        )}

        <fieldset className="sm:col-span-2">
          <legend className="text-[13px] font-medium leading-none text-fg-secondary">Driver type</legend>
          <div className="mt-2 inline-flex rounded-lg bg-subtle p-1" role="radiogroup">
            {DRIVER_TYPES.map((t) => {
              const active = formData.driver_type === t.value;
              return (
                <label
                  key={t.value}
                  className={cn(
                    "relative flex h-8 cursor-pointer items-center rounded-md px-3 text-sm font-medium transition-colors",
                    active ? "bg-card text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                    isSaving && "pointer-events-none opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="driver_type"
                    value={t.value}
                    checked={active}
                    onChange={() => handleChange("driver_type", t.value)}
                    disabled={isSaving}
                    className={cn("peer sr-only", focusRing)}
                  />
                  <span className="peer-focus-visible:ring-2 peer-focus-visible:ring-ring absolute inset-0 rounded-md" aria-hidden="true" />
                  {t.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field label="Phone" error={errors.phone}>
          <Input type="tel" inputMode="numeric" maxLength={PHONE_MAX_LENGTH} value={formData.phone} onChange={(e) => handleChange("phone", sanitizePhoneInput(e.target.value))} placeholder={PHONE_PLACEHOLDER} disabled={isSaving} />
        </Field>
        <Field label="CNIC" hint="Optional">
          <Input mono value={formData.cnic_number} onChange={(e) => handleChange("cnic_number", e.target.value)} placeholder="12345-6789012-3" disabled={isSaving} />
        </Field>
        <Field label="License number" hint="Optional">
          <Input mono value={formData.license_number} onChange={(e) => handleChange("license_number", e.target.value)} placeholder="ABC123456" disabled={isSaving} />
        </Field>

        {driver && (
          <Field label="Status">
            <Select value={formData.status} onChange={(e) => handleChange("status", e.target.value as CreateDriverRequest["status"])} disabled={isSaving}>
              <option value={DriverStatus.ACTIVE}>Active</option>
              <option value={DriverStatus.INACTIVE}>Inactive</option>
              <option value={DriverStatus.SUSPENDED}>Suspended</option>
              <option value={DriverStatus.PENDING}>Pending</option>
            </Select>
          </Field>
        )}

        <Field label="Profile picture" hint="Optional. JPG or PNG." className="sm:col-span-2">
          <div className="flex items-center gap-3">
            {driver?.profile_picture_url && (
              <button
                type="button"
                onClick={() => onZoomImage?.(driver.profile_picture_url!, driver.full_name)}
                aria-label={`View current photo of ${driver.full_name}`}
                className={cn("group relative size-14 shrink-0 cursor-zoom-in overflow-hidden rounded-full border border-line", focusRing)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={driver.profile_picture_url} alt="" className="size-full object-cover transition-opacity group-hover:opacity-80" />
                <ZoomIn className="absolute inset-0 m-auto size-4 text-white opacity-0 drop-shadow group-hover:opacity-100" aria-hidden="true" />
              </button>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleChange("profile_picture", file);
              }}
              disabled={isSaving}
              className={cn(
                "w-full cursor-pointer rounded-lg text-sm text-fg-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-fg hover:file:bg-subtle",
                focusRing,
              )}
            />
          </div>
        </Field>
      </FormGrid>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" loading={isSaving}>
          {driver ? "Save changes" : "Create driver"}
        </Button>
      </div>
    </form>
  );
});
