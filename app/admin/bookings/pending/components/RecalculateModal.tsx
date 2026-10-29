"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { ChauffeurBooking, TripType } from "../../../../lib/services/api-client";
import { cn } from "@/lib/utils";
import { Button, Dialog, DialogContent, Field, FormGrid, Input, Select, focusRing } from "../../../ui";
import { formatCurrency } from "../../../lib/format";
import { ChauffeurFuelBillingSection, type ChauffeurFuelMode } from "./ChauffeurFuelBillingSection";
import { InvoiceParticularsField } from "./InvoiceParticularsField";
import { DailyLogTable, type DailyLogRow } from "./DailyLogTable";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RecalculatePayload, mode: "info" | "recalculate") => void;
  booking: ChauffeurBooking | null;
  loading?: boolean;
};

export interface RecalculatePayload {
  package_selected?: string;
  booking_type?: string;
  no_of_days?: number;
  total_duration_minutes?: number;
  total_distance_km?: number;
  expense_toll?: number;
  expense_parking?: number;
  vendor_cost?: number;
  daily_logs?: Array<{
    date: string;
    trip_type: TripType;
    is_full_day: boolean;
    hours_used?: number;
    apply_accommodation?: boolean;
  }>;
  discount_type?: "NONE" | "PERCENTAGE" | "FLAT";
  discount_value?: number;
  fuelMode?: ChauffeurFuelMode;
  selectedFuelPrice?: number;
  invoice_particulars?: string;
}

const PACKAGES = [
  { value: "HOURS_5", label: "5 hours" },
  { value: "HOURS_10", label: "10 hours" },
  { value: "HOURS_24", label: "24 hours (full day)" },
];

const BOOKING_TYPES = [
  { value: "SPOT", label: "Spot" },
  { value: "MONTHLY", label: "Monthly" },
];

type Mode = "info" | "recalculate";
type DiscountType = "NONE" | "PERCENTAGE" | "FLAT";

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{children}</h3>
      {action}
    </div>
  );
}

export function RecalculateModal({ isOpen, onClose, onSubmit, booking, loading }: Props) {
  const [packageSelected, setPackageSelected] = useState("");
  const [bookingType, setBookingType] = useState("");
  const [noOfDays, setNoOfDays] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [toll, setToll] = useState("");
  const [parking, setParking] = useState("");
  const [vendorCost, setVendorCost] = useState("");
  const [showDailyLogs, setShowDailyLogs] = useState(false);
  const [dailyLogs, setDailyLogs] = useState<DailyLogRow[]>([]);
  const [mode, setMode] = useState<Mode>("recalculate");
  const [discountType, setDiscountType] = useState<DiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [fuelMode, setFuelMode] = useState<ChauffeurFuelMode>("CONTRACT");
  const [selectedFuelPrice, setSelectedFuelPrice] = useState("");
  const [invoiceParticulars, setInvoiceParticulars] = useState<string | null>(null);

  // Pre-fill from the booking each time the dialog opens (render-time adjustment).
  const seedKey = isOpen && booking ? String(booking.id) : null;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (seedKey !== seededKey) {
    setSeededKey(seedKey);
    if (seedKey && booking) {
      setPackageSelected(booking.package_selected ?? "");
      setBookingType(booking.booking_type ?? "");
      setNoOfDays(String(booking.no_of_days ?? 1));
      setDurationMinutes(String(booking.chauffeur_trip_logs?.total_duration_minutes ?? ""));
      setDistanceKm(String(booking.chauffeur_trip_logs?.total_distance_km ?? ""));
      setToll(String(booking.chauffeur_trip_logs?.expense_toll ?? "0"));
      setParking(String(booking.chauffeur_trip_logs?.expense_parking ?? "0"));
      setVendorCost(String(booking.chauffeur_trip_logs?.vendor_cost ?? ""));
      const existing = (booking.chauffeur_trip_daily_logs ?? []).map((l) => ({
        id: l.log_date,
        date: l.log_date.slice(0, 10),
        trip_type: l.trip_type as TripType,
        is_full_day: l.is_full_day,
        hours_used: String(l.hours_used ?? ""),
        apply_accommodation: l.apply_accommodation,
      }));
      setDailyLogs(existing);
      setShowDailyLogs(existing.length > 0);
      setMode("recalculate");
      setDiscountType("NONE");
      setDiscountValue("");
      setFuelMode("CONTRACT");
      setSelectedFuelPrice("");
      setInvoiceParticulars(null);
    }
  }

  const handleSubmit = () => {
    if (!booking) return;
    const payload: RecalculatePayload = {};

    if (packageSelected && packageSelected !== booking.package_selected) payload.package_selected = packageSelected;
    if (bookingType && bookingType !== booking.booking_type) payload.booking_type = bookingType;
    const parsedDays = parseInt(noOfDays, 10);
    if (!Number.isNaN(parsedDays) && parsedDays !== (booking.no_of_days ?? 1)) payload.no_of_days = parsedDays;

    const parsedDuration = parseInt(durationMinutes, 10);
    if (!Number.isNaN(parsedDuration)) payload.total_duration_minutes = parsedDuration;
    const parsedDist = parseFloat(distanceKm);
    if (!Number.isNaN(parsedDist)) payload.total_distance_km = parsedDist;
    const parsedToll = parseFloat(toll);
    if (!Number.isNaN(parsedToll)) payload.expense_toll = parsedToll;
    const parsedParking = parseFloat(parking);
    if (!Number.isNaN(parsedParking)) payload.expense_parking = parsedParking;
    const parsedVendorCost = parseFloat(vendorCost);
    if (booking.vehicles?.ownership === "PARTNER" && !Number.isNaN(parsedVendorCost) && parsedVendorCost >= 0) payload.vendor_cost = parsedVendorCost;

    if (showDailyLogs && dailyLogs.length > 0) {
      payload.daily_logs = dailyLogs.map((l) => ({
        date: l.date,
        trip_type: l.trip_type,
        is_full_day: l.is_full_day,
        hours_used: l.hours_used ? parseFloat(l.hours_used) : undefined,
        apply_accommodation: l.apply_accommodation,
      }));
    }

    if (mode === "recalculate") {
      if (discountType !== "NONE" && discountValue !== "" && parseFloat(discountValue) > 0) {
        payload.discount_type = discountType;
        payload.discount_value = parseFloat(discountValue);
      }
      if (invoiceParticulars !== null && invoiceParticulars.trim()) payload.invoice_particulars = invoiceParticulars.trim();
      if (fuelMode === "SELECTED") {
        const petrol = Number(selectedFuelPrice);
        if (!selectedFuelPrice || Number.isNaN(petrol) || petrol <= 0) {
          toast.error("Enter a petrol price to adjust fuel for this invoice.");
          return;
        }
        payload.fuelMode = "SELECTED";
        payload.selectedFuelPrice = petrol;
      } else {
        payload.fuelMode = "CONTRACT";
      }
    }

    onSubmit(payload, mode);
  };

  const tl = booking?.chauffeur_trip_logs;

  const modeOption = (value: Mode, title: string, text: string) => {
    const active = mode === value;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => setMode(value)}
        className={cn(
          "flex cursor-pointer flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors",
          active ? (value === "recalculate" ? "border-brand bg-brand-soft" : "border-info-line bg-info-soft") : "border-line hover:border-line-strong",
          focusRing,
        )}
      >
        <span className="text-sm font-semibold text-fg">{title}</span>
        <span className="text-xs text-fg-muted">{text}</span>
      </button>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent
        size="lg"
        priority="elevated"
        title="Override & recalculate"
        description={booking ? `Booking #${booking.id} · ${booking.companies?.name ?? ""} · ${booking.vehicle_model ?? ""}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant={mode === "recalculate" ? "danger" : "primary"} onClick={handleSubmit} loading={loading}>
              {mode === "recalculate" ? "Save & regenerate invoice" : "Save info only"}
            </Button>
          </>
        }
      >
        {booking && (
          <div className="space-y-6">
            {tl?.total_invoice_amount != null && (
              <div className="rounded-lg border border-warning-line bg-warning-soft px-4 py-3 text-sm">
                <span className="font-semibold text-warning-ink">Current invoice: {formatCurrency(tl.total_invoice_amount)}</span>
                <span className="ml-2 text-xs text-fg-muted">
                  Base {formatCurrency(tl.base_package_cost ?? 0)}
                  {Number(tl.overtime_charge ?? 0) > 0 && ` · OT ${formatCurrency(tl.overtime_charge ?? 0)}`}
                  {` · Fuel ${formatCurrency(tl.fuel_cost_calculated ?? 0)}`}
                  {` · SST ${formatCurrency(tl.sst_amount ?? 0)}`}
                </span>
              </div>
            )}

            <section>
              <SectionTitle>Booking parameters</SectionTitle>
              <FormGrid cols={3}>
                <Field label="Package">
                  <Select value={packageSelected} onChange={(e) => setPackageSelected(e.target.value)}>
                    {PACKAGES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Booking type">
                  <Select value={bookingType} onChange={(e) => setBookingType(e.target.value)}>
                    {BOOKING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="No. of days">
                  <Input type="number" min={1} value={noOfDays} onChange={(e) => setNoOfDays(e.target.value)} mono />
                </Field>
              </FormGrid>
            </section>

            <section>
              <SectionTitle>Trip data overrides</SectionTitle>
              <FormGrid cols={2}>
                <Field label="Duration (minutes)">
                  <Input type="number" min={0} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder={`Current: ${tl?.total_duration_minutes ?? "—"}`} mono />
                </Field>
                <Field label="Distance (km)">
                  <Input type="number" min={0} step={0.1} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder={`Current: ${tl?.total_distance_km ?? "—"}`} mono />
                </Field>
                <Field label="Toll (PKR)">
                  <Input type="number" min={0} value={toll} onChange={(e) => setToll(e.target.value)} mono />
                </Field>
                <Field label="Parking (PKR)">
                  <Input type="number" min={0} value={parking} onChange={(e) => setParking(e.target.value)} mono />
                </Field>
                {booking.vehicles?.ownership === "PARTNER" && (
                  <Field label="Vendor cost (lump sum, PKR)" className="sm:col-span-2">
                    <Input type="number" min={0} value={vendorCost} onChange={(e) => setVendorCost(e.target.value)} placeholder="Set or correct the manual vendor cost" mono />
                  </Field>
                )}
              </FormGrid>
            </section>

            <section>
              <SectionTitle
                action={
                  <Button variant="ghost" size="sm" onClick={() => setShowDailyLogs((v) => !v)} aria-expanded={showDailyLogs}>
                    {showDailyLogs ? "Hide daily logs" : "Edit daily logs"}
                  </Button>
                }
              >
                Daily log breakdown
              </SectionTitle>
              {showDailyLogs && <DailyLogTable rows={dailyLogs} onChange={setDailyLogs} allowFullDay editableDates />}
            </section>

            <section>
              <SectionTitle>What should happen after saving?</SectionTitle>
              <div role="radiogroup" aria-label="Save mode" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {modeOption("info", "Save info only", "Updates booking data and trip logs. The invoice stays unchanged.")}
                {modeOption("recalculate", "Save & regenerate invoice", "Recalculates all financials and replaces the invoice with the new values.")}
              </div>
            </section>

            {mode === "recalculate" && (
              <>
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-ink">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    This <strong>deletes the existing invoice</strong> and regenerates it with the new values. You will be asked to confirm.
                  </span>
                </div>

                <InvoiceParticularsField booking={booking} value={invoiceParticulars} onChange={setInvoiceParticulars} />

                <ChauffeurFuelBillingSection
                  companyId={booking.company_id}
                  vehicleModel={booking.vehicle_model}
                  distanceKm={distanceKm}
                  fuelMode={fuelMode}
                  selectedFuelPrice={selectedFuelPrice}
                  onFuelModeChange={setFuelMode}
                  onSelectedFuelPriceChange={setSelectedFuelPrice}
                />

                <section>
                  <SectionTitle>Invoice discount (optional)</SectionTitle>
                  <FormGrid cols={2}>
                    <Field label="Discount type">
                      <Select
                        value={discountType}
                        onChange={(e) => {
                          setDiscountType(e.target.value as DiscountType);
                          setDiscountValue("");
                        }}
                      >
                        <option value="NONE">No discount</option>
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FLAT">Flat amount (PKR)</option>
                      </Select>
                    </Field>
                    {discountType !== "NONE" && (
                      <Field label={discountType === "PERCENTAGE" ? "Discount %" : "Discount amount (PKR)"}>
                        <Input type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "PERCENTAGE" ? "e.g. 10" : "e.g. 5000"} mono />
                      </Field>
                    )}
                  </FormGrid>
                </section>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
