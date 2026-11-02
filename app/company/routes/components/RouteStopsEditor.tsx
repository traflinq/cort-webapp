"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  ArrowLeftRight,
  Building2,
  Edit,
  Plus,
  Save,
  Sunrise,
  Sunset,
  Trash2,
  X,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "../../ui";
import { Button } from "@/app/admin/ui/Button";
import { Card } from "../../components/DashboardComponents";
import StopAddressSearch from "@/app/admin/ui/StopAddressSearch";
import { apiClient } from "../../../lib/services/api-client";
import type { MapMarker } from "@/app/admin/ui/Map";
import { isOfficeStop, getOfficeStops } from "../../../lib/utils/routeStops";

const Map = dynamic(() => import("@/app/admin/ui/Map"), { ssr: false });

export type CompanyRouteStop = {
  id: number;
  route_id: number;
  name: string;
  sequence_order: number;
  morning_sequence?: number | null;
  evening_sequence?: number | null;
  morning_eta?: string | null;
  evening_eta?: string | null;
  lat?: number | null;
  lng?: number | null;
  stop_type?: "PICKUP" | "OFFICE";
};

type StopDirection = "MORNING" | "EVENING" | "BOTH";
type StopType = "PICKUP" | "OFFICE";

type RouteStopsEditorProps = {
  routeId: number;
  stops: CompanyRouteStop[];
  onUpdated: () => void;
};

const inputCls =
  "w-full h-11 rounded-full border border-[var(--border-input)] bg-[var(--bg-input)] px-4 text-sm text-[var(--text-primary)] focus:border-[var(--cort-orange)] focus:ring-1 focus:ring-[var(--cort-orange)] outline-none disabled:opacity-60";
const labelCls = "block text-[13px] text-[var(--text-muted)] mb-1.5 px-1";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  try {
    const date = new Date(timeStr.includes("T") ? timeStr : `1970-01-01T${timeStr}Z`);
    if (isNaN(date.getTime())) return timeStr;
    return date.toISOString().substring(11, 16);
  } catch {
    return timeStr;
  }
}

function deriveDirection(stop: CompanyRouteStop): StopDirection {
  if (stop.morning_sequence != null && stop.evening_sequence != null) return "BOTH";
  if (stop.morning_sequence != null) return "MORNING";
  if (stop.evening_sequence != null) return "EVENING";
  return "BOTH";
}

function DirectionBadge({ direction, t }: { direction: StopDirection; t: (key: string) => string }) {
  if (direction === "MORNING") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)] border border-[var(--tone-warning-line)]">
        <Sunrise className="w-3 h-3" /> {t("morningOnly")}
      </span>
    );
  }
  if (direction === "EVENING") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--tone-info-soft)] text-[var(--tone-info-ink)] border border-[var(--tone-info-line)]">
        <Sunset className="w-3 h-3" /> {t("eveningOnly")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--tone-success-soft)] text-[var(--tone-success-ink)] border border-[var(--tone-success-line)]">
      <ArrowLeftRight className="w-3 h-3" /> {t("bothDirections")}
    </span>
  );
}

function SequenceInput({
  label,
  value,
  onChange,
  icon,
  colorClass,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  colorClass: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={cx("inline-flex items-center gap-1 text-xs font-medium", colorClass)}>
        {icon} {label}
      </span>
      <input
        type="number"
        min={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 h-9 px-2 border border-[var(--border-input)] rounded-full text-sm text-center bg-[var(--bg-input)] focus:outline-none focus:ring-1 focus:ring-[var(--cort-orange)] disabled:opacity-60"
        placeholder="#"
      />
    </div>
  );
}

export function RouteStopsEditor({ routeId, stops, onUpdated }: RouteStopsEditorProps) {
  const t = useTranslations("company.routes");
  const tCommon = useTranslations("common");

  const [isSaving, setIsSaving] = useState(false);
  const [editingStopId, setEditingStopId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [originalDirection, setOriginalDirection] = useState<StopDirection | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    lat: "",
    lng: "",
    morning_eta: "",
    evening_eta: "",
    direction: "BOTH" as StopDirection,
    morning_sequence: "",
    evening_sequence: "",
    stopType: "PICKUP" as StopType,
  });

  const officeStops = getOfficeStops(stops);
  const officeStopIds = new Set(officeStops.map((s) => s.id));
  // Reference office used only to pre-fill sensible default positions when adding a new stop.
  const primaryOfficeStop = officeStops[0] ?? null;
  const editingStop = editingStopId != null
    ? stops.find((s) => s.id === editingStopId) ?? null
    : null;
  const isEditingOffice = editingStop != null && isOfficeStop(editingStop);
  // True while the form (add or edit) represents an OFFICE-type stop.
  const isOfficeForm = isAdding ? formData.stopType === "OFFICE" : isEditingOffice;

  const resetForm = () => {
    setFormData({
      name: "",
      lat: "",
      lng: "",
      morning_eta: "",
      evening_eta: "",
      direction: "BOTH",
      morning_sequence: "",
      evening_sequence: "",
      stopType: "PICKUP",
    });
    setEditingStopId(null);
    setIsAdding(false);
    setOriginalDirection(null);
  };

  const handleEditClick = (stop: CompanyRouteStop) => {
    const dir = deriveDirection(stop);
    setOriginalDirection(dir);
    setFormData({
      name: stop.name,
      lat: stop.lat?.toString() || "",
      lng: stop.lng?.toString() || "",
      morning_eta: stop.morning_eta ? formatTime(stop.morning_eta) : "",
      evening_eta: stop.evening_eta ? formatTime(stop.evening_eta) : "",
      direction: dir,
      morning_sequence: stop.morning_sequence?.toString() ?? "",
      evening_sequence: stop.evening_sequence?.toString() ?? "",
      stopType: isOfficeStop(stop) ? "OFFICE" : "PICKUP",
    });
    setEditingStopId(stop.id);
    setIsAdding(false);
  };

  const handleAddClick = () => {
    // Insert new pickup BEFORE the (primary) office so office stays AM last / PM first
    const officeMorning = primaryOfficeStop?.morning_sequence ?? null;
    const insertMorning =
      officeMorning != null
        ? officeMorning
        : Math.max(0, ...stops.map((s) => s.morning_sequence ?? 0)) + 1;
    const insertEvening =
      primaryOfficeStop?.evening_sequence != null
        ? primaryOfficeStop.evening_sequence + 1
        : Math.max(0, ...stops.map((s) => s.evening_sequence ?? 0)) + 1;
    resetForm();
    setOriginalDirection(null);
    setFormData((f) => ({
      ...f,
      morning_sequence: insertMorning.toString(),
      evening_sequence: insertEvening.toString(),
    }));
    setIsAdding(true);
  };

  // When marking the stop being added as an office (or back to a pickup),
  // office stops are always BOTH-direction.
  const handleStopTypeChange = (stopType: StopType) => {
    setFormData((f) => ({
      ...f,
      stopType,
      direction: stopType === "OFFICE" ? "BOTH" : f.direction,
    }));
  };

  const handleDirectionChange = (dir: StopDirection) => {
    if (isOfficeForm) return;
    const nextMorning = Math.max(0, ...stops.map((s) => s.morning_sequence ?? 0)) + 1;
    const nextEvening = Math.max(0, ...stops.map((s) => s.evening_sequence ?? 0)) + 1;

    setFormData((f) => ({
      ...f,
      direction: dir,
      morning_sequence:
        dir === "EVENING"
          ? ""
          : dir === "BOTH"
            ? (f.morning_sequence || nextMorning.toString())
            : f.morning_sequence,
      evening_sequence:
        dir === "MORNING"
          ? ""
          : dir === "BOTH"
            ? (f.evening_sequence || nextEvening.toString())
            : f.evening_sequence,
    }));
  };

  const handleAddressSelect = useCallback(({ name, lat, lng }: { name: string; lat: number; lng: number }) => {
    setFormData((f) => ({ ...f, name, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setFormData((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
    toast.message(t("coordinatesUpdatedFromMap"));
  }, [t]);

  const buildPayload = () => {
    if (!isEditingOffice && formData.direction === "BOTH" && (!formData.morning_sequence || !formData.evening_sequence)) {
      if (editingStopId && originalDirection && originalDirection !== "BOTH") {
        toast.error(t("bothSequencesRequiredWhenChangingDirection"));
      } else {
        toast.error(t("bothSequencesRequired"));
      }
      return null;
    }

    const data: Record<string, unknown> = {
      name: formData.name,
      lat: parseFloat(formData.lat),
      lng: parseFloat(formData.lng),
      morning_eta: formData.morning_eta || null,
      evening_eta: formData.evening_eta || null,
      direction: isOfficeForm ? "BOTH" : formData.direction,
      sequence_order: 0,
      stop_type: isOfficeForm ? "OFFICE" : "PICKUP",
    };

    // An existing office stop's position is locked — keep its current AM last / PM first sequences
    if (isEditingOffice && editingStop) {
      data.morning_sequence = editingStop.morning_sequence;
      data.evening_sequence = editingStop.evening_sequence;
    } else {
      if (formData.morning_sequence !== "" && formData.direction !== "EVENING") {
        data.morning_sequence = parseInt(formData.morning_sequence, 10);
      }
      if (formData.evening_sequence !== "" && formData.direction !== "MORNING") {
        data.evening_sequence = parseInt(formData.evening_sequence, 10);
      }
    }

    return data;
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.lat || !formData.lng) {
      toast.error(t("stopLocationRequired"));
      return;
    }

    const data = buildPayload();
    if (!data) return;

    try {
      setIsSaving(true);
      if (isAdding) {
        await apiClient.addCompanyRouteStop(routeId, data as Parameters<typeof apiClient.addCompanyRouteStop>[1]);
        toast.success(t("stopAddedSuccess"));
      } else if (editingStopId) {
        await apiClient.updateCompanyRouteStop(editingStopId, data);
        toast.success(t("stopUpdatedSuccess"));
      }
      resetForm();
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedSaveStop"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (officeStopIds.has(id)) {
      toast.error("Cannot delete the company office stop. Edit its location instead.");
      return;
    }
    if (!confirm(t("confirmDeleteStop"))) return;
    try {
      await apiClient.deleteCompanyRouteStop(id);
      toast.success(t("stopDeletedSuccess"));
      if (editingStopId === id) resetForm();
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedDeleteStop"));
    }
  };

  const morningStops = stops
    .filter((s) => s.morning_sequence != null)
    .sort((a, b) => (a.morning_sequence ?? 0) - (b.morning_sequence ?? 0));

  const eveningStops = stops
    .filter((s) => s.evening_sequence != null)
    .sort((a, b) => (a.evening_sequence ?? 0) - (b.evening_sequence ?? 0));

  const renderFormFields = () => {
    const mapMarkers: MapMarker[] =
      formData.lat && formData.lng
        ? [{
          id: "form-pin",
          position: [parseFloat(formData.lat), parseFloat(formData.lng)],
          label: formData.name || t("newStop"),
          color: isOfficeForm ? "#ef4444" : "#6366f1",
        }]
        : [];

    return (
      <div className="space-y-4">
        {isAdding && (
          <div>
            <label className={labelCls}>Stop Type</label>
            <div className="mt-1 flex rounded-full p-1 bg-[var(--tile-bg)] w-fit">
              <button
                type="button"
                onClick={() => handleStopTypeChange("PICKUP")}
                className={cx(
                  "flex items-center justify-center gap-1.5 rounded-full h-8 px-3.5 text-xs transition-colors",
                  formData.stopType === "PICKUP"
                    ? "bg-[var(--cort-navy)] text-white"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-card)]",
                )}
              >
                <MapPin className="w-3.5 h-3.5" /> Pickup
              </button>
              <button
                type="button"
                onClick={() => handleStopTypeChange("OFFICE")}
                className={cx(
                  "flex items-center justify-center gap-1.5 rounded-full h-8 px-3.5 text-xs transition-colors",
                  formData.stopType === "OFFICE"
                    ? "bg-red-500 text-white"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-card)]",
                )}
              >
                <Building2 className="w-3.5 h-3.5" /> Office
              </button>
            </div>
          </div>
        )}

        {isOfficeForm && (
          <div className="rounded-[20px] bg-[var(--tone-danger-soft)] p-4 flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--tone-danger-ink)]">Company Office</p>
              <p className="text-xs text-[var(--tone-danger-ink)] mt-0.5">
                Employees cannot be assigned to this stop as a pickup.
                {isEditingOffice && " Morning last stop · Evening first stop."}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {isEditingOffice && (
                  <>
                    <span className="text-xs font-medium bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)] px-2 py-0.5 rounded-full">
                      AM last
                    </span>
                    <span className="text-xs font-medium bg-[var(--tone-purple-soft)] text-[var(--tone-purple-ink)] px-2 py-0.5 rounded-full">
                      PM first
                    </span>
                  </>
                )}
                <span className="text-xs bg-[var(--tone-neutral-soft)] text-[var(--tone-neutral-ink)] px-2.5 py-0.5 rounded-full">
                  No employee assignment
                </span>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>{t("searchLocation")} *</label>
          <StopAddressSearch
            onSelect={handleAddressSelect}
            defaultValue={formData.name}
            placeholder={t("searchLocationPlaceholder")}
            className="mt-1"
          />
        </div>

        <div className="rounded-[20px] overflow-hidden bg-[var(--tile-bg)]" style={{ height: 200 }}>
          <Map
            height="100%"
            markers={mapMarkers}
            onMapClick={handleMapClick}
            center={
              formData.lat && formData.lng
                ? [parseFloat(formData.lat), parseFloat(formData.lng)]
                : undefined
            }
          />
        </div>

        {formData.lat && formData.lng && (
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {parseFloat(formData.lat).toFixed(5)}, {parseFloat(formData.lng).toFixed(5)} · {t("clickMapToAdjust")}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>{t("stopName")} *</label>
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputCls}
              placeholder={t("stopNamePlaceholder")}
            />
          </div>

          <div>
            <label className={labelCls}>{t("direction")}</label>
            <select
              value={isOfficeForm ? "BOTH" : formData.direction}
              onChange={(e) => handleDirectionChange(e.target.value as StopDirection)}
              disabled={isOfficeForm}
              className={inputCls}
            >
              <option value="BOTH">{t("bothDirections")}</option>
              <option value="MORNING">{t("morningOnly")}</option>
              <option value="EVENING">{t("eveningOnly")}</option>
            </select>
          </div>

          {(formData.direction === "MORNING" || formData.direction === "BOTH" || isOfficeForm) && (
            <div>
              <label className={labelCls}>{isOfficeForm ? "Morning arrival" : t("morningEta")}</label>
              <input
                type="time"
                value={formData.morning_eta}
                onChange={(e) => setFormData({ ...formData, morning_eta: e.target.value })}
                className={inputCls}
              />
            </div>
          )}

          {(formData.direction === "EVENING" || formData.direction === "BOTH" || isOfficeForm) && (
            <div>
              <label className={labelCls}>{isOfficeForm ? "Evening departure" : t("eveningEta")}</label>
              <input
                type="time"
                value={formData.evening_eta}
                onChange={(e) => setFormData({ ...formData, evening_eta: e.target.value })}
                className={inputCls}
              />
            </div>
          )}
        </div>

        <div className={cx(
          "flex flex-wrap items-end gap-6 p-4 rounded-[20px]",
          isOfficeForm ? "bg-[var(--tone-danger-soft)]" : "bg-[var(--tile-bg)]",
        )}>
          <span className="text-[13px] text-[var(--text-muted)] w-full -mb-2">
            {isEditingOffice ? "Office position (locked)" : isOfficeForm ? "Office position" : t("stopPositionInRoute")}
          </span>
          {(formData.direction === "MORNING" || formData.direction === "BOTH" || isOfficeForm) && (
            <SequenceInput
              label={t("morningPosition")}
              value={formData.morning_sequence}
              onChange={(v) => setFormData({ ...formData, morning_sequence: v })}
              icon={<Sunrise className="w-3 h-3" />}
              colorClass="text-[var(--tone-warning-ink)]"
              disabled={isEditingOffice}
            />
          )}
          {(formData.direction === "EVENING" || formData.direction === "BOTH" || isOfficeForm) && (
            <SequenceInput
              label={t("eveningPosition")}
              value={formData.evening_sequence}
              onChange={(v) => setFormData({ ...formData, evening_sequence: v })}
              icon={<Sunset className="w-3 h-3" />}
              colorClass="text-[var(--tone-info-ink)]"
              disabled={isEditingOffice}
            />
          )}
          <p className="text-xs text-[var(--text-muted)] italic self-end pb-0.5">
            {isEditingOffice
              ? "Position is fixed so this office stays last in morning and first in evening."
              : isOfficeForm
                ? "Set where this office stop falls in the morning/evening order."
                : t("stopSequenceHint")}
          </p>
        </div>
      </div>
    );
  };

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-[var(--divider)]">
        <div>
          <h3 className="text-xl font-medium text-[var(--text-primary)]">
            {t("manageStops")} ({stops.length})
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t("manageStopsDescription")}</p>
        </div>
        {!isAdding && !editingStopId && (
          <PillButton onClick={handleAddClick} icon={<Plus strokeWidth={2} />}>
            {t("addStop")}
          </PillButton>
        )}
      </div>

      <div className="p-6 space-y-4">
        {isAdding && (
          <div className="rounded-[20px] bg-[var(--tile-bg)] p-5">
            <h4 className="font-medium mb-3 text-[var(--text-primary)] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[var(--cort-orange)]" /> {t("newStop")}
            </h4>
            {renderFormFields()}
            <div className="flex justify-end gap-2 mt-4">
              <Button className="rounded-full h-11 px-5" variant="outline" onClick={resetForm}>
                <X className="w-4 h-4 me-1" /> {tCommon("actions.cancel")}
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving} className="rounded-full h-11 px-5">
                {isSaving ? t("savingStop") : t("saveStop")}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {stops.length === 0 && !isAdding && (
            <div className="py-10 text-center text-sm text-[var(--text-muted)]">{t("noStopsConfigured")}</div>
          )}

          {stops.map((stop) => {
            const dir = deriveDirection(stop);
            const isEditingThisStop = editingStopId === stop.id;
            const isOffice = officeStopIds.has(stop.id);

            if (isEditingThisStop) {
              return (
                <div key={stop.id} className={cx(
                  "rounded-[20px] border p-5",
                  isOffice
                    ? "border-[var(--tone-danger-line)] bg-[var(--tone-danger-soft)]"
                    : "border-[var(--cort-orange)]/30 bg-[var(--cort-orange)]/5",
                )}>
                  <h4 className="font-medium mb-3 text-[var(--text-primary)] flex items-center gap-2">
                    {isOffice ? <Building2 className="w-4 h-4 text-[var(--tone-danger-ink)]" /> : <Edit className="w-4 h-4" />}
                    {isOffice ? `Editing office: ${stop.name}` : t("editingStop", { name: stop.name })}
                  </h4>
                  {renderFormFields()}
                  <div className="flex justify-end gap-2 mt-4">
                    <Button className="rounded-full h-9 px-4" variant="outline" size="sm" onClick={resetForm}>
                      <X className="w-4 h-4 me-1" /> {tCommon("actions.cancel")}
                    </Button>
                    <Button size="sm" onClick={handleSubmit} disabled={isSaving} className="rounded-full h-9 px-4">
                      {isSaving ? t("updatingStop") : t("updateStop")}
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={stop.id}
                className={cx(
                  "flex items-center justify-between gap-3 p-3 rounded-[20px] transition-colors",
                  isOffice
                    ? "bg-[var(--tone-danger-soft)]"
                    : "bg-[var(--bg-card)] hover:bg-[var(--tile-bg)]",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isOffice ? (
                      <div className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-full">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <>
                        {stop.morning_sequence != null && (
                          <div className="w-8 h-8 flex items-center justify-center bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)] rounded-full font-medium text-sm">
                            {stop.morning_sequence}
                          </div>
                        )}
                        {stop.evening_sequence != null && (
                          <div className="w-8 h-8 flex items-center justify-center bg-[var(--tone-info-soft)] text-[var(--tone-info-ink)] rounded-full font-medium text-sm">
                            {stop.evening_sequence}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[var(--text-primary)]">{stop.name}</span>
                      {isOffice ? (
                        <>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-card)] text-[var(--tone-danger-ink)]">
                            <Building2 className="w-3 h-3" /> Office
                          </span>
                          <span className="text-xs font-medium bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)] px-2 py-0.5 rounded-full">
                            AM last
                          </span>
                          <span className="text-xs font-medium bg-[var(--tone-purple-soft)] text-[var(--tone-purple-ink)] px-2 py-0.5 rounded-full">
                            PM first
                          </span>
                          <span className="text-xs bg-[var(--tone-neutral-soft)] text-[var(--tone-neutral-ink)] px-2.5 py-0.5 rounded-full">
                            No assignment
                          </span>
                        </>
                      ) : (
                        <DirectionBadge direction={dir} t={t} />
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {stop.lat != null && stop.lng != null && `${Number(stop.lat).toFixed(5)}, ${Number(stop.lng).toFixed(5)}`}
                      {stop.morning_eta && dir !== "EVENING" && ` · AM: ${formatTime(stop.morning_eta)}`}
                      {stop.evening_eta && dir !== "MORNING" && ` · PM: ${formatTime(stop.evening_eta)}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditClick(stop)}
                    className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--pill-line)] text-[var(--text-primary)] hover:bg-[var(--nav-hover-bg)] transition-colors"
                    title={tCommon("actions.edit")}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(stop.id)}
                    disabled={isOffice}
                    className={cx(
                      "inline-flex size-9 items-center justify-center rounded-full border border-[var(--pill-line)] transition-colors",
                      isOffice
                        ? "text-[var(--text-light)] cursor-not-allowed"
                        : "text-[var(--text-primary)] hover:text-[var(--tone-danger-ink)] hover:bg-[var(--tone-danger-soft)]",
                    )}
                    title={isOffice ? "Office cannot be deleted" : tCommon("actions.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {(morningStops.length > 0 || eveningStops.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="rounded-[20px] bg-[var(--tile-bg)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--divider)]">
                <Sunrise className="w-4 h-4 text-[var(--tone-warning-ink)]" />
                <span className="text-sm font-medium text-[var(--tone-warning-ink)]">
                  {t("morningRoute")} ({morningStops.length})
                </span>
              </div>
              <ol className="divide-y divide-[var(--divider)]">
                {morningStops.map((s, i) => {
                  const isOffice = officeStopIds.has(s.id);
                  return (
                    <li key={s.id} className={cx("flex items-center gap-2 px-4 py-2.5 text-sm", isOffice && "bg-[var(--tone-danger-soft)]")}>
                      <span className={cx(
                        "w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium flex-shrink-0",
                        isOffice ? "bg-red-500 text-white" : "bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)]",
                      )}>
                        {isOffice ? <Building2 className="w-3 h-3" /> : i + 1}
                      </span>
                      <span className={cx("text-[var(--text-primary)]", isOffice && "font-medium")}>{s.name}</span>
                      {isOffice && <span className="text-xs font-medium text-[var(--tone-danger-ink)]">Office · last</span>}
                      {s.morning_eta && (
                        <span className="ms-auto text-xs text-[var(--text-muted)]">{formatTime(s.morning_eta)}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="rounded-[20px] bg-[var(--tile-bg)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--divider)]">
                <Sunset className="w-4 h-4 text-[var(--tone-info-ink)]" />
                <span className="text-sm font-medium text-[var(--tone-info-ink)]">
                  {t("eveningRoute")} ({eveningStops.length})
                </span>
              </div>
              <ol className="divide-y divide-[var(--divider)]">
                {eveningStops.map((s, i) => {
                  const isOffice = officeStopIds.has(s.id);
                  return (
                    <li key={s.id} className={cx("flex items-center gap-2 px-4 py-2.5 text-sm", isOffice && "bg-[var(--tone-danger-soft)]")}>
                      <span className={cx(
                        "w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium flex-shrink-0",
                        isOffice ? "bg-red-500 text-white" : "bg-[var(--tone-info-soft)] text-[var(--tone-info-ink)]",
                      )}>
                        {isOffice ? <Building2 className="w-3 h-3" /> : i + 1}
                      </span>
                      <span className={cx("text-[var(--text-primary)]", isOffice && "font-medium")}>{s.name}</span>
                      {isOffice && <span className="text-xs font-medium text-[var(--tone-danger-ink)]">Office · first</span>}
                      {s.evening_eta && (
                        <span className="ms-auto text-xs text-[var(--text-muted)]">{formatTime(s.evening_eta)}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
