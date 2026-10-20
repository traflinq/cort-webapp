"use client";

import { memo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { ChauffeurBooking, TripType } from "../../../../lib/services/api-client";
import { uploadFile } from "../../../../lib/supabase";
import { Button, Checkbox, Dialog, DialogContent, Field, FormGrid, Input, Select } from "../../../ui";
import { cn } from "@/lib/utils";
import { ChauffeurFuelBillingSection, type ChauffeurFuelMode } from "./ChauffeurFuelBillingSection";
import { DailyLogTable, ymdLocal, type DailyLogRow } from "./DailyLogTable";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  booking: ChauffeurBooking | null;
  loading?: boolean;
};

type DiscountType = "NONE" | "PERCENTAGE" | "FLAT";

/** Days between the trip start and end that don't already have a daily log. */
function seedDays(booking: ChauffeurBooking, manualStart: string | null, manualEnd: string | null): DailyLogRow[] {
  const startDate = manualStart
    ? new Date(manualStart)
    : booking.chauffeur_trip_logs?.start_time
      ? new Date(booking.chauffeur_trip_logs.start_time)
      : new Date(booking.scheduled_for);
  const endDate = manualEnd ? new Date(manualEnd) : new Date();

  const existing = new Set((booking.chauffeur_trip_daily_logs || []).map((log) => ymdLocal(new Date(log.log_date))));
  const isOutstation = booking.trip_type === TripType.OUT_STATION;
  const defaultHours = booking.package_selected === "HOURS_24" ? 0 : booking.package_selected === "HOURS_5" ? 5 : 10;

  const days: DailyLogRow[] = [];
  const cursor = new Date(startDate);
  const loopEnd = new Date(endDate);
  cursor.setHours(0, 0, 0, 0);
  loopEnd.setHours(0, 0, 0, 0);
  while (cursor <= loopEnd) {
    const dateStr = ymdLocal(cursor);
    if (!existing.has(dateStr)) {
      days.push({
        id: dateStr,
        date: dateStr,
        trip_type: isOutstation ? TripType.OUT_STATION : TripType.IN_CITY,
        is_full_day: booking.package_selected === "HOURS_24",
        apply_accommodation: false,
        hours_used: defaultHours > 0 ? String(defaultHours) : "",
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

const fileInputCls = "h-auto py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-subtle file:px-3 file:py-1 file:text-xs file:font-medium file:text-fg";

export const EndTripModal = memo(function EndTripModal({ isOpen, onClose, onSubmit, booking, loading }: Props) {
  const [distance, setDistance] = useState("0");
  const [toll, setToll] = useState("0");
  const [parking, setParking] = useState("0");
  const [vendorCost, setVendorCost] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [fuelMode, setFuelMode] = useState<ChauffeurFuelMode>("CONTRACT");
  const [selectedFuelPrice, setSelectedFuelPrice] = useState("");
  const [useManualStartTime, setUseManualStartTime] = useState(false);
  const [manualStartTime, setManualStartTime] = useState("");
  const [useManualEndTime, setUseManualEndTime] = useState(false);
  const [manualEndTime, setManualEndTime] = useState("");
  const [dailyLogs, setDailyLogs] = useState<DailyLogRow[]>([]);
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(false);
  const [tollImage, setTollImage] = useState<File | null>(null);
  const [parkingImage, setParkingImage] = useState<File | null>(null);
  const [startMeterImage, setStartMeterImage] = useState<File | null>(null);
  const [endMeterImage, setEndMeterImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const isPartnerVehicle = booking?.vehicles?.ownership === "PARTNER";

  // Re-seed the day list whenever the dialog opens or the manual times change (render-time adjustment).
  const effectiveStart = useManualStartTime && manualStartTime ? manualStartTime : null;
  const effectiveEnd = useManualEndTime && manualEndTime ? manualEndTime : null;
  const seedKey = isOpen && booking ? `${booking.id}|${effectiveStart ?? ""}|${effectiveEnd ?? ""}` : null;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (seedKey !== seededKey) {
    setSeededKey(seedKey);
    if (seedKey && booking) {
      setDailyLogs(seedDays(booking, effectiveStart, effectiveEnd));
      setFuelMode("CONTRACT");
      setSelectedFuelPrice("");
    }
  }

  const handleSubmit = async () => {
    if (!booking) return;
    if (fuelMode === "SELECTED") {
      const petrol = parseFloat(selectedFuelPrice);
      if (!selectedFuelPrice || Number.isNaN(petrol) || petrol <= 0) {
        toast.error("Enter a petrol price to adjust fuel for this invoice.");
        return;
      }
    }

    setIsUploading(true);
    try {
      let tollImageUrl = "";
      let parkingImageUrl = "";
      let startMeterImageUrl = "";
      let endMeterImageUrl = "";
      if (tollImage) tollImageUrl = await uploadFile("company-logos", `receipts/toll/${booking.id}_${Date.now()}_${tollImage.name}`, tollImage);
      if (parkingImage) parkingImageUrl = await uploadFile("company-logos", `receipts/parking/${booking.id}_${Date.now()}_${parkingImage.name}`, parkingImage);
      if (startMeterImage) startMeterImageUrl = await uploadFile("company-logos", `receipts/meter/${booking.id}_start_${Date.now()}_${startMeterImage.name}`, startMeterImage);
      if (endMeterImage) endMeterImageUrl = await uploadFile("company-logos", `receipts/meter/${booking.id}_end_${Date.now()}_${endMeterImage.name}`, endMeterImage);

      const data: Record<string, unknown> = {
        total_distance_km: parseFloat(distance),
        expense_toll: parseFloat(toll),
        expense_parking: parseFloat(parking),
        expense_toll_image_url: tollImageUrl || undefined,
        expense_parking_image_url: parkingImageUrl || undefined,
        meter_reading_start_image_url: startMeterImageUrl || undefined,
        meter_reading_end_image_url: endMeterImageUrl || undefined,
      };

      if (isPartnerVehicle && vendorCost !== "" && parseFloat(vendorCost) >= 0) data.vendor_cost = parseFloat(vendorCost);

      if (discountType !== "NONE" && discountValue !== "" && parseFloat(discountValue) > 0) {
        data.discount_type = discountType;
        data.discount_value = parseFloat(discountValue);
      }

      if (fuelMode === "SELECTED") {
        data.fuelMode = "SELECTED";
        data.selectedFuelPrice = parseFloat(selectedFuelPrice);
      } else {
        data.fuelMode = "CONTRACT";
      }

      if (useManualEndTime && manualEndTime) data.end_time = new Date(manualEndTime).toISOString();
      if (useManualStartTime && manualStartTime) data.start_time = new Date(manualStartTime).toISOString();

      const existingLogs = (booking.chauffeur_trip_daily_logs || []).map((log) => ({
        date: ymdLocal(new Date(log.log_date)),
        trip_type: log.trip_type,
        is_full_day: log.is_full_day,
        apply_accommodation: log.apply_accommodation,
        hours_used: log.hours_used ? parseFloat(log.hours_used.toString()) : 0,
      }));
      const newLogs = dailyLogs.map((log) => ({
        date: log.date,
        trip_type: log.trip_type,
        is_full_day: log.is_full_day,
        apply_accommodation: log.apply_accommodation || false,
        hours_used: log.hours_used ? parseFloat(log.hours_used) : 0,
      }));
      data.daily_logs = [...existingLogs, ...newLogs];

      onSubmit(data);
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Failed to upload images. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const busy = !!loading || isUploading;
  const allowFullDay = booking?.package_selected === "HOURS_24" || booking?.package_selected === "HOURS_10";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        size="lg"
        priority="elevated"
        title="End trip"
        description={booking ? `Booking #${booking.id} · ${booking.companies?.name ?? ""} · ${booking.vehicle_model ?? ""}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={busy}>
              {isUploading ? "Uploading images…" : loading ? "Ending trip…" : "End trip & generate invoice"}
            </Button>
          </>
        }
      >
        {booking && (
          <div className="space-y-6">
            <FormGrid cols={2}>
              <div className="space-y-4">
                <Field label="Total distance (km)" required>
                  <Input type="number" min={0} step={0.1} value={distance} onChange={(e) => setDistance(e.target.value)} mono />
                </Field>
                <Field label="Toll expenses (PKR)">
                  <Input type="number" min={0} value={toll} onChange={(e) => setToll(e.target.value)} mono />
                </Field>
                <Field label="Parking expenses (PKR)">
                  <Input type="number" min={0} value={parking} onChange={(e) => setParking(e.target.value)} mono />
                </Field>
                {isPartnerVehicle && (
                  <div className="rounded-lg border border-warning-line bg-warning-soft p-3">
                    <Field label="Vendor cost (lump sum, PKR)" hint="Overrides the auto-calculated vendor cost for this partner vehicle.">
                      <Input type="number" min={0} placeholder="Agreed vendor cost" value={vendorCost} onChange={(e) => setVendorCost(e.target.value)} mono />
                    </Field>
                  </div>
                )}
                <div className="space-y-3 rounded-lg border border-line p-3">
                  <Field label="Invoice discount (optional)">
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
                      <Input type="number" min={0} placeholder={discountType === "PERCENTAGE" ? "e.g. 10" : "e.g. 5000"} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} mono />
                    </Field>
                  )}
                </div>
                <ChauffeurFuelBillingSection
                  companyId={booking.company_id}
                  vehicleModel={booking.vehicle_model}
                  distanceKm={distance}
                  fuelMode={fuelMode}
                  selectedFuelPrice={selectedFuelPrice}
                  onFuelModeChange={setFuelMode}
                  onSelectedFuelPriceChange={setSelectedFuelPrice}
                />
              </div>

              <div className="space-y-4">
                <Field label="Toll receipt (optional)" hint={tollImage ? tollImage.name : undefined}>
                  <Input type="file" accept="image/*" className={fileInputCls} onChange={(e) => setTollImage(e.target.files?.[0] || null)} />
                </Field>
                <Field label="Parking receipt (optional)" hint={parkingImage ? parkingImage.name : undefined}>
                  <Input type="file" accept="image/*" className={fileInputCls} onChange={(e) => setParkingImage(e.target.files?.[0] || null)} />
                </Field>
                <Field label="Start meter photo (optional)" hint={startMeterImage ? startMeterImage.name : undefined}>
                  <Input type="file" accept="image/*" className={fileInputCls} onChange={(e) => setStartMeterImage(e.target.files?.[0] || null)} />
                </Field>
                <Field label="End meter photo (optional)" hint={endMeterImage ? endMeterImage.name : undefined}>
                  <Input type="file" accept="image/*" className={fileInputCls} onChange={(e) => setEndMeterImage(e.target.files?.[0] || null)} />
                </Field>

                <div className="space-y-3 rounded-lg border border-line p-3">
                  <Checkbox label="Set manual start time" checked={useManualStartTime} onCheckedChange={(c) => setUseManualStartTime(c === true)} />
                  {useManualStartTime && (
                    <Field label="Start time" hint="Leave empty to use the recorded trip start time.">
                      <Input type="datetime-local" value={manualStartTime} onChange={(e) => setManualStartTime(e.target.value)} />
                    </Field>
                  )}
                  <Checkbox label="Set manual end time" checked={useManualEndTime} onCheckedChange={(c) => setUseManualEndTime(c === true)} />
                  {useManualEndTime && (
                    <Field label="End time" hint="Leave empty to use the current time.">
                      <Input type="datetime-local" value={manualEndTime} onChange={(e) => setManualEndTime(e.target.value)} />
                    </Field>
                  )}
                </div>
              </div>
            </FormGrid>

            <div>
              <button
                type="button"
                onClick={() => setShowDailyBreakdown((v) => !v)}
                aria-expanded={showDailyBreakdown}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded text-sm font-medium text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showDailyBreakdown ? "Hide" : "Show"} daily breakdown ({dailyLogs.length} new day{dailyLogs.length === 1 ? "" : "s"})
                <ChevronDown className={cn("size-4 transition-transform", showDailyBreakdown && "rotate-180")} aria-hidden="true" />
              </button>
              {showDailyBreakdown && (
                <div className="mt-3">
                  <DailyLogTable rows={dailyLogs} onChange={setDailyLogs} allowFullDay={allowFullDay} emptyText="All days already have logs." />
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
