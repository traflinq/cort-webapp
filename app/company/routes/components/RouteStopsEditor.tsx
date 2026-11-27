"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  ArrowLeftRight,
  Building2,
  Edit,
  Plus,
  Sunrise,
  Sunset,
  Trash2,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Field, IconButton, Input, Label, Select, focusRing } from "@/app/admin/ui";
import { Card } from "../../components/Card";
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

/** Map pin colours (Google Maps markers), kept identical to the route detail map. */
const OFFICE_PIN_COLOR = "#ef4444";
const PICKUP_PIN_COLOR = "#6e7ff0";

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
    return <Badge tone="warning" icon={<Sunrise />}>{t("morningOnly")}</Badge>;
  }
  if (direction === "EVENING") {
    return <Badge tone="purple" icon={<Sunset />}>{t("eveningOnly")}</Badge>;
  }
  return <Badge tone="neutral" icon={<ArrowLeftRight />}>{t("bothDirections")}</Badge>;
}

/** Small neutral chip: direction icon + position number. */
function SequenceChip({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span
      title={label}
      aria-label={`${label}: ${value}`}
      className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-subtle px-1.5 text-xs font-medium text-fg-secondary tabular-nums [&_svg]:size-3 [&_svg]:text-fg-muted"
    >
      {icon}
      {value}
    </span>
  );
}

function SequenceInput({
  label,
  value,
  onChange,
  icon,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Field
      label={
        <span className="inline-flex items-center gap-1 [&_svg]:size-3.5 [&_svg]:text-fg-muted">
          {icon} {label}
        </span>
      }
    >
      <Input
        type="number"
        min={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 text-center tabular-nums"
        placeholder="#"
      />
    </Field>
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

  const segmentCls = (active: boolean) =>
    cx(
      "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors [&_svg]:size-3.5",
      focusRing,
      active ? "bg-card text-fg shadow-xs" : "text-fg-muted hover:text-fg",
    );

  const renderFormFields = () => {
    const mapMarkers: MapMarker[] =
      formData.lat && formData.lng
        ? [{
          id: "form-pin",
          position: [parseFloat(formData.lat), parseFloat(formData.lng)],
          label: formData.name || t("newStop"),
          color: isOfficeForm ? OFFICE_PIN_COLOR : PICKUP_PIN_COLOR,
        }]
        : [];

    return (
      <div className="flex flex-col gap-4">
        {isAdding && (
          <div className="flex flex-col gap-1.5">
            <Label>Stop Type</Label>
            <div className="flex w-fit gap-1 rounded-lg bg-subtle p-0.5">
              <button
                type="button"
                aria-pressed={formData.stopType === "PICKUP"}
                onClick={() => handleStopTypeChange("PICKUP")}
                className={segmentCls(formData.stopType === "PICKUP")}
              >
                <MapPin aria-hidden="true" /> Pickup
              </button>
              <button
                type="button"
                aria-pressed={formData.stopType === "OFFICE"}
                onClick={() => handleStopTypeChange("OFFICE")}
                className={segmentCls(formData.stopType === "OFFICE")}
              >
                <Building2 aria-hidden="true" /> Office
              </button>
            </div>
          </div>
        )}

        {isOfficeForm && (
          <div className="flex items-start gap-3 rounded-lg border border-line bg-subtle p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-card text-fg-secondary">
              <Building2 className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">Company Office</p>
              <p className="mt-0.5 text-xs text-fg-muted">
                Employees cannot be assigned to this stop as a pickup.
                {isEditingOffice && " Morning last stop · Evening first stop."}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {isEditingOffice && (
                  <>
                    <Badge tone="neutral" icon={<Sunrise />}>AM last</Badge>
                    <Badge tone="neutral" icon={<Sunset />}>PM first</Badge>
                  </>
                )}
                <Badge tone="neutral">No employee assignment</Badge>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label required>{t("searchLocation")}</Label>
          <StopAddressSearch
            onSelect={handleAddressSelect}
            defaultValue={formData.name}
            placeholder={t("searchLocationPlaceholder")}
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-line" style={{ height: 200 }}>
          <Map
            height="100%"
            markers={mapMarkers}
            onMapClick={handleMapClick}
            className="!rounded-none !border-0 !shadow-none"
            center={
              formData.lat && formData.lng
                ? [parseFloat(formData.lat), parseFloat(formData.lng)]
                : undefined
            }
          />
        </div>

        {formData.lat && formData.lng && (
          <p className="-mt-2 flex items-center gap-1 text-xs text-fg-muted tabular-nums">
            <MapPin className="size-3" aria-hidden="true" />
            {parseFloat(formData.lat).toFixed(5)}, {parseFloat(formData.lng).toFixed(5)} · {t("clickMapToAdjust")}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("stopName")} required className="md:col-span-2">
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t("stopNamePlaceholder")}
            />
          </Field>

          <Field label={t("direction")}>
            <Select
              value={isOfficeForm ? "BOTH" : formData.direction}
              onChange={(e) => handleDirectionChange(e.target.value as StopDirection)}
              disabled={isOfficeForm}
            >
              <option value="BOTH">{t("bothDirections")}</option>
              <option value="MORNING">{t("morningOnly")}</option>
              <option value="EVENING">{t("eveningOnly")}</option>
            </Select>
          </Field>

          {(formData.direction === "MORNING" || formData.direction === "BOTH" || isOfficeForm) && (
            <Field label={isOfficeForm ? "Morning arrival" : t("morningEta")}>
              <Input
                type="time"
                value={formData.morning_eta}
                onChange={(e) => setFormData({ ...formData, morning_eta: e.target.value })}
                className="tabular-nums"
              />
            </Field>
          )}

          {(formData.direction === "EVENING" || formData.direction === "BOTH" || isOfficeForm) && (
            <Field label={isOfficeForm ? "Evening departure" : t("eveningEta")}>
              <Input
                type="time"
                value={formData.evening_eta}
                onChange={(e) => setFormData({ ...formData, evening_eta: e.target.value })}
                className="tabular-nums"
              />
            </Field>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-line bg-subtle p-3">
          <p className="text-xs font-medium text-fg-muted">
            {isEditingOffice ? "Office position (locked)" : isOfficeForm ? "Office position" : t("stopPositionInRoute")}
          </p>
          <div className="flex flex-wrap items-end gap-6">
            {(formData.direction === "MORNING" || formData.direction === "BOTH" || isOfficeForm) && (
              <SequenceInput
                label={t("morningPosition")}
                value={formData.morning_sequence}
                onChange={(v) => setFormData({ ...formData, morning_sequence: v })}
                icon={<Sunrise aria-hidden="true" />}
                disabled={isEditingOffice}
              />
            )}
            {(formData.direction === "EVENING" || formData.direction === "BOTH" || isOfficeForm) && (
              <SequenceInput
                label={t("eveningPosition")}
                value={formData.evening_sequence}
                onChange={(v) => setFormData({ ...formData, evening_sequence: v })}
                icon={<Sunset aria-hidden="true" />}
                disabled={isEditingOffice}
              />
            )}
            <p className="pb-2 text-xs text-fg-muted">
              {isEditingOffice
                ? "Position is fixed so this office stays last in morning and first in evening."
                : isOfficeForm
                  ? "Set where this office stop falls in the morning/evening order."
                  : t("stopSequenceHint")}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const directionList = (
    dir: "MORNING" | "EVENING",
    list: CompanyRouteStop[],
  ) => (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex items-center gap-2 border-b border-line bg-subtle px-3 py-2">
        {dir === "MORNING"
          ? <Sunrise className="size-4 text-fg-muted" aria-hidden="true" />
          : <Sunset className="size-4 text-fg-muted" aria-hidden="true" />}
        <span className="text-sm font-semibold text-fg">
          {dir === "MORNING" ? t("morningRoute") : t("eveningRoute")}
        </span>
        <span className="text-sm text-fg-muted tabular-nums">{list.length}</span>
      </div>
      <ol className="divide-y divide-line">
        {list.map((s, i) => {
          const isOffice = officeStopIds.has(s.id);
          const eta = dir === "MORNING" ? s.morning_eta : s.evening_eta;
          return (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-medium text-fg-secondary tabular-nums">
                {isOffice ? <Building2 className="size-3" aria-hidden="true" /> : i + 1}
              </span>
              <span className={cx("min-w-0 truncate text-fg", isOffice && "font-medium")}>{s.name}</span>
              {isOffice && (
                <span className="shrink-0 text-xs text-fg-muted">
                  {dir === "MORNING" ? "Office · last" : "Office · first"}
                </span>
              )}
              {eta && (
                <span className="ms-auto shrink-0 text-xs text-fg-muted tabular-nums">{formatTime(eta)}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );

  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">
            {t("manageStops")} <span className="font-normal text-fg-muted tabular-nums">({stops.length})</span>
          </h3>
          <p className="mt-0.5 text-xs text-fg-muted">{t("manageStopsDescription")}</p>
        </div>
        {!isAdding && !editingStopId && (
          <Button size="sm" onClick={handleAddClick} leftIcon={<Plus />}>
            {t("addStop")}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {isAdding && (
          <div className="rounded-lg border border-line-strong p-4">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg">
              <Plus className="size-4 text-fg-muted" aria-hidden="true" /> {t("newStop")}
            </h4>
            {renderFormFields()}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={resetForm}>
                {tCommon("actions.cancel")}
              </Button>
              <Button onClick={handleSubmit} loading={isSaving}>
                {isSaving ? t("savingStop") : t("saveStop")}
              </Button>
            </div>
          </div>
        )}

        {stops.length === 0 && !isAdding ? (
          <EmptyState compact icon={<MapPin aria-hidden="true" />} title={t("noStopsConfigured")} />
        ) : stops.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {stops.map((stop) => {
              const dir = deriveDirection(stop);
              const isEditingThisStop = editingStopId === stop.id;
              const isOffice = officeStopIds.has(stop.id);

              if (isEditingThisStop) {
                return (
                  <li key={stop.id} className="bg-subtle p-4">
                    <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg">
                      {isOffice
                        ? <Building2 className="size-4 text-fg-muted" aria-hidden="true" />
                        : <Edit className="size-4 text-fg-muted" aria-hidden="true" />}
                      {isOffice ? `Editing office: ${stop.name}` : t("editingStop", { name: stop.name })}
                    </h4>
                    {renderFormFields()}
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={resetForm}>
                        {tCommon("actions.cancel")}
                      </Button>
                      <Button size="sm" onClick={handleSubmit} loading={isSaving}>
                        {isSaving ? t("updatingStop") : t("updateStop")}
                      </Button>
                    </div>
                  </li>
                );
              }

              return (
                <li
                  key={stop.id}
                  className="flex items-center justify-between gap-3 px-3 py-3 transition-colors hover:bg-row-hover"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex shrink-0 items-center gap-1">
                      {isOffice ? (
                        <span className="flex size-7 items-center justify-center rounded-full border border-line bg-subtle text-fg-secondary">
                          <Building2 className="size-3.5" aria-hidden="true" />
                        </span>
                      ) : (
                        <>
                          {stop.morning_sequence != null && (
                            <SequenceChip icon={<Sunrise aria-hidden="true" />} value={stop.morning_sequence} label={t("morningPosition")} />
                          )}
                          {stop.evening_sequence != null && (
                            <SequenceChip icon={<Sunset aria-hidden="true" />} value={stop.evening_sequence} label={t("eveningPosition")} />
                          )}
                        </>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-fg">{stop.name}</span>
                        {isOffice ? (
                          <>
                            <Badge tone="info" icon={<Building2 />}>Office</Badge>
                            <Badge tone="neutral">AM last</Badge>
                            <Badge tone="neutral">PM first</Badge>
                            <Badge tone="neutral">No assignment</Badge>
                          </>
                        ) : (
                          <DirectionBadge direction={dir} t={t} />
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-fg-muted tabular-nums">
                        {stop.lat != null && stop.lng != null && `${Number(stop.lat).toFixed(5)}, ${Number(stop.lng).toFixed(5)}`}
                        {stop.morning_eta && dir !== "EVENING" && ` · AM: ${formatTime(stop.morning_eta)}`}
                        {stop.evening_eta && dir !== "MORNING" && ` · PM: ${formatTime(stop.evening_eta)}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      size="icon-sm"
                      label={tCommon("actions.edit")}
                      onClick={() => handleEditClick(stop)}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="icon-sm"
                      label={isOffice ? "Office cannot be deleted" : tCommon("actions.delete")}
                      onClick={() => handleDelete(stop.id)}
                      disabled={isOffice}
                      className="hover:text-danger-ink"
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {(morningStops.length > 0 || eveningStops.length > 0) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {directionList("MORNING", morningStops)}
            {directionList("EVENING", eveningStops)}
          </div>
        )}
      </div>
    </Card>
  );
}
