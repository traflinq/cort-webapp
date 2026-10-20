"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiClient } from "../../../lib/services/api-client";
import { Button, Dialog, DialogContent, Field, InlineError, Input } from "../../ui";
import type { VendorLogRow } from "./types";

export interface VendorDistanceDialogProps {
  log: VendorLogRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Override the vendor distance used for a chauffeur trip's fuel cost
 * (PATCH /vendors/logs/:bookingId). Replaces the unreachable "cost breakdown" modal.
 */
export function VendorDistanceDialog({ log, open, onOpenChange, onSaved }: VendorDistanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Edit vendor distance" description={log ? `Booking #${log.booking_id} · ${log.vehicle || "—"}` : undefined}>
        {log && <DistanceForm key={String(log.booking_id)} log={log} onCancel={() => onOpenChange(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function DistanceForm({ log, onCancel, onSaved }: { log: VendorLogRow; onCancel: () => void; onSaved: () => void }) {
  const [km, setKm] = React.useState(log.distance != null ? String(Number(log.distance)) : "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!log.booking_id) return;
    const value = parseFloat(km);
    if (Number.isNaN(value) || value < 0) {
      setError("Enter a valid distance in kilometres.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.updateVendorTripLog(log.booking_id, value);
      toast.success("Vendor distance updated");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Vendor distance (km)" hint="Overrides the GPS distance used to compute the vendor's fuel cost." required>
        <Input type="number" min={0} step="0.1" required mono value={km} onChange={(e) => setKm(e.target.value)} autoFocus />
      </Field>
      {error && <InlineError>{error}</InlineError>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save distance
        </Button>
      </div>
    </form>
  );
}
