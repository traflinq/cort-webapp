"use client";

import React, { useState, memo } from "react";
import { Upload, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Company, CreateCompanyRequest } from "../../../lib/services/api-client";
import { uploadFile } from "../../../lib/supabase";
import { Field, FormGrid } from "../../ui/Field";
import { Input } from "../../ui/Input";
import { Checkbox } from "../../ui/Checkbox";
import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { generatePassword } from "../../lib/format";

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
};

const AUTH_DOMAIN = "@cort.com.pk";

export const CompanyForm = memo(function CompanyForm({
  company,
  onSave,
  onCancel,
  isSaving,
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
          prefix: company.prefix || "",
        }
      : initialFormData,
  );

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(company?.logo_url || null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [touched, setTouched] = useState(false);

  const handleChange = <K extends keyof CompanyFormData>(field: K, value: CompanyFormData[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "prefix" && !company) {
        const currentAuthPrefix = (prev.auth_email || "").replace(AUTH_DOMAIN, "");
        if (!prev.auth_email || currentAuthPrefix === prev.prefix) {
          next.auth_email = value ? `${value}${AUTH_DOMAIN}` : "";
        }
      }
      return next;
    });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    handleChange("logo_url", "");
  };

  const nameMissing = touched && !formData.name.trim();
  const emailMissing = touched && !formData.email.trim();
  const busy = isSaving || isUploadingLogo;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Company name and email are required");
      return;
    }
    try {
      const finalData: CompanyFormData = { ...formData };
      if (!finalData.auth_email || company) delete finalData.auth_email;
      if (!finalData.password || company) delete finalData.password;
      if (logoFile) {
        setIsUploadingLogo(true);
        const fileName = `${Date.now()}-${logoFile.name}`;
        finalData.logo_url = await uploadFile("company-logos", fileName, logoFile);
      }
      onSave(finalData);
    } catch (error) {
      console.error("Failed to upload logo:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormGrid cols={2}>
        <Field label="Company name" required error={nameMissing ? "Company name is required." : undefined}>
          <Input value={formData.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="e.g. Acme Corp" disabled={busy} autoFocus />
        </Field>
        <Field label="Prefix" hint="Short name; pre-fills the login ID.">
          <Input value={formData.prefix || ""} onChange={(e) => handleChange("prefix", e.target.value)} placeholder="e.g. acme" disabled={busy} mono />
        </Field>
      </FormGrid>

      <FormGrid cols={2}>
        <Field label="Company email" required hint="Notifications and invoices are sent here." error={emailMissing ? "Company email is required." : undefined}>
          <Input type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="admin@acmecorp.com" disabled={busy} />
        </Field>
        <Field
          label="Login ID"
          hint={formData.auth_email ? `Signs in as ${formData.auth_email}` : company ? "Cannot be changed after creation." : "Defaults to the company email if empty."}
        >
          <div className="flex">
            <Input
              type="text"
              mono
              className="rounded-r-none"
              value={(formData.auth_email || "").replace(AUTH_DOMAIN, "")}
              onChange={(e) => handleChange("auth_email", e.target.value ? `${e.target.value}${AUTH_DOMAIN}` : "")}
              placeholder="admin-name"
              disabled={busy || !!company}
            />
            <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-r-lg border border-l-0 border-input bg-subtle px-3 text-sm text-fg-muted">
              {AUTH_DOMAIN}
            </span>
          </div>
        </Field>
      </FormGrid>

      {!company && (
        <Field label="Password" hint="Optional. A password is generated if left empty.">
          <div className="flex gap-2">
            <Input
              type="text"
              mono
              value={formData.password || ""}
              onChange={(e) => handleChange("password", e.target.value)}
              placeholder="Leave empty to auto-generate"
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="button" variant="outline" onClick={() => handleChange("password", generatePassword())} disabled={busy} leftIcon={<Wand2 />}>
              Generate
            </Button>
          </div>
        </Field>
      )}

      <FormGrid cols={2}>
        <Field label="Contact person">
          <Input value={formData.contact_person || ""} onChange={(e) => handleChange("contact_person", e.target.value)} placeholder="Full name" disabled={busy} />
        </Field>
        <Field label="NTN">
          <Input value={formData.ntn_number || ""} onChange={(e) => handleChange("ntn_number", e.target.value)} placeholder="1234567-8" disabled={busy} mono />
        </Field>
      </FormGrid>

      <Field label="Address">
        <Input value={formData.address || ""} onChange={(e) => handleChange("address", e.target.value)} placeholder="123 Business Rd, City" disabled={busy} />
      </Field>

      <Field label="Company logo" hint="PNG or JPG, up to 2MB.">
        {logoPreview ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoPreview} alt="Company logo preview" className="size-24 rounded-lg border border-line object-cover" />
            <IconButton
              label="Remove logo"
              variant="danger"
              size="icon-xs"
              className="absolute -right-2 -top-2 rounded-full"
              onClick={handleRemoveLogo}
              disabled={busy}
            >
              <X />
            </IconButton>
          </div>
        ) : (
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3.5 text-sm font-medium text-fg shadow-xs hover:bg-subtle h-9 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-page">
            <input type="file" accept="image/*" onChange={handleLogoChange} className="sr-only" disabled={busy} />
            <Upload className="size-4" aria-hidden="true" />
            Upload logo
          </label>
        )}
      </Field>

      <fieldset className="space-y-2 border-t border-line pt-4">
        <legend className="mb-2 text-[13px] font-medium text-fg-secondary">Services</legend>
        <div className="flex flex-wrap gap-4">
          <Checkbox label="Shuttle" checked={formData.is_shuttle_enabled} onCheckedChange={(c) => handleChange("is_shuttle_enabled", c === true)} disabled={busy} />
          <Checkbox label="Chauffeur" checked={formData.is_chauffeur_enabled} onCheckedChange={(c) => handleChange("is_chauffeur_enabled", c === true)} disabled={busy} />
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {isUploadingLogo ? "Uploading logo…" : company ? "Save changes" : "Create company"}
        </Button>
      </div>
    </form>
  );
});
