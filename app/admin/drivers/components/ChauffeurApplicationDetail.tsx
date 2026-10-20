"use client";

import { ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Driver } from "../../../lib/services/types/drivers";
import { displayDriverEmail } from "../../../lib/utils/driverEmailDisplay";
import { formatDateTime } from "../../lib/format";
import { focusRing } from "../../ui/styles";

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{display}</dd>
    </div>
  );
}

function ApplicationPhotoTile({ label, url, onZoom }: { label: string; url?: string | null; onZoom: (url: string, name: string) => void }) {
  if (!url) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-subtle p-4 text-center">
        <div className="text-xs font-medium text-fg-secondary">{label}</div>
        <div className="mt-1 text-xs text-fg-muted">Not uploaded</div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onZoom(url, label)}
      aria-label={`Enlarge ${label}`}
      className={cn("group block w-full cursor-zoom-in overflow-hidden rounded-lg border border-line bg-card text-left transition-colors hover:border-brand", focusRing)}
    >
      <div className="flex items-center justify-between border-b border-line bg-subtle px-2 py-1.5 text-xs font-medium text-fg-secondary">
        {label}
        <ZoomIn className="size-3.5 text-fg-muted" aria-hidden="true" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-44 w-full bg-subtle object-contain" />
    </button>
  );
}

type ChauffeurApplicationDetailProps = {
  driver: Driver;
  onZoomImage: (url: string, name: string) => void;
};

export function ChauffeurApplicationDetail({ driver, onZoomImage }: ChauffeurApplicationDetailProps) {
  const profile = driver.drivers_profile;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-muted">Applicant</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Full name" value={driver.full_name} />
          <DetailRow label="Email" value={displayDriverEmail(driver.email)} />
          <DetailRow label="Phone" value={driver.phone} />
          <DetailRow label="CNIC" value={profile?.cnic_number} />
          <DetailRow label="License number" value={profile?.license_number} />
          <DetailRow label="Submitted" value={driver.created_at ? formatDateTime(driver.created_at) : undefined} />
        </dl>
      </section>
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-muted">Vehicle</h3>
        <dl className="grid gap-4 sm:grid-cols-3">
          <DetailRow label="Make" value={profile?.vehicle_make} />
          <DetailRow label="Model" value={profile?.vehicle_model} />
          <DetailRow label="Model year" value={profile?.vehicle_year ?? undefined} />
        </dl>
      </section>
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-muted">Photos &amp; documents</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ApplicationPhotoTile label="Profile" url={driver.profile_picture_url} onZoom={onZoomImage} />
          <ApplicationPhotoTile label="Driving license (front)" url={profile?.license_front_image_url} onZoom={onZoomImage} />
          <ApplicationPhotoTile label="Driving license (back)" url={profile?.license_back_image_url} onZoom={onZoomImage} />
          <ApplicationPhotoTile label="CNIC (front)" url={profile?.cnic_front_image_url} onZoom={onZoomImage} />
          <ApplicationPhotoTile label="CNIC (back)" url={profile?.cnic_back_image_url} onZoom={onZoomImage} />
          <ApplicationPhotoTile label="Car" url={profile?.vehicle_photo_url} onZoom={onZoomImage} />
          <ApplicationPhotoTile label="Car registration" url={profile?.vehicle_registration_doc_url} onZoom={onZoomImage} />
        </div>
      </section>
    </div>
  );
}
