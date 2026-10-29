"use client";

import type { ChauffeurBooking } from "../../../../lib/services/api-client";
import { TripType } from "../../../../lib/services/api-client";
import { Checkbox, Field, Input } from "../../../ui";

/** Mirrors the text the backend auto-generates for the invoice particulars. */
export function defaultInvoiceParticulars(booking: ChauffeurBooking): string {
  if (booking.trip_type === TripType.OUT_STATION && booking.destination_cities?.length) {
    return `(Outstation) ${booking.vehicle_model} - Outstation Trip to ${booking.destination_cities.join(", ")}`;
  }
  const place = booking.city ? `In ${booking.city}` : "In City";
  return `(${place}) ${booking.vehicle_model} - ${booking.pickup_address || "Pickup"} & Return`;
}

type Props = {
  booking: ChauffeurBooking;
  /** `null` = keep the auto-generated particulars; a string = edited text for this invoice. */
  value: string | null;
  onChange: (value: string | null) => void;
};

export function InvoiceParticularsField({ booking, value, onChange }: Props) {
  const editing = value !== null;
  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <Checkbox
        label="Edit invoice particulars"
        description="Particulars are filled in automatically. Tick to change the text printed on this invoice."
        checked={editing}
        onCheckedChange={(c) => onChange(c === true ? defaultInvoiceParticulars(booking) : null)}
      />
      {editing && (
        <Field label="Particulars" hint="Day-type labels such as “- Rent (Full Day)” are still added after this text.">
          <Input maxLength={255} value={value} onChange={(e) => onChange(e.target.value)} />
        </Field>
      )}
    </div>
  );
}
