"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, Building2, MapPin, Pencil, Plus, Save, Sunrise, Sunset, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiClient } from "@/app/lib/services/api-client";
import { useConfirm } from "@/app/lib/hooks/useConfirm";
import StopAddressSearch from "@/app/ui/StopAddressSearch";
import type { MapMarker } from "@/app/ui/Map";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Field,
  FormGrid,
  IconButton,
  Input,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  useFormatters,
} from "@/app/ui";
import { isOfficeStop, getOfficeStops } from "@/app/lib/utils/routeStops";
import { deriveDirection, stopsForDirection, toClockHHmm, type CompanyRouteStop, type StopDirection } from "../lib/route-types";
import { MAP_COLORS } from "../lib/map-colors";

const Map = dynamic(() => import("@/app/ui/Map"), { ssr: false });

export type { CompanyRouteStop } from "../lib/route-types";

type StopType = "PICKUP" | "OFFICE";

type RouteStopsEditorProps = {
  routeId: number;
  stops: CompanyRouteStop[];
  onUpdated: () => void;
};

const EMPTY_FORM = {
  name: "",
  lat: "",
  lng: "",
  morning_eta: "",
  evening_eta: "",
  direction: "BOTH" as StopDirection,
  morning_sequence: "",
  evening_sequence: "",
  stopType: "PICKUP" as StopType,
};

function DirectionBadge({ direction }: { direction: StopDirection }) {
  const t = useTranslations("company.routes");
  if (direction === "MORNING") {
    return (
      <Badge tone="warning" size="sm" icon={<Sunrise aria-hidden="true" />}>
        {t("morningOnly")}
      </Badge>
    );
  }
  if (direction === "EVENING") {
    return (
      <Badge tone="purple" size="sm" icon={<Sunset aria-hidden="true" />}>
        {t("eveningOnly")}
      </Badge>
    );
  }
  return (
    <Badge tone="success" size="sm" icon={<ArrowLeftRight aria-hidden="true" />}>
      {t("bothDirections")}
    </Badge>
  );
}

export function RouteStopsEditor({ routeId, stops, onUpdated }: RouteStopsEditorProps) {
  const t = useTranslations("company.routes");
  const tCommon = useTranslations("common");
  const confirm = useConfirm();
  const { formatTime } = useFormatters();

  const [isSaving, setIsSaving] = useState(false);
  const [editingStopId, setEditingStopId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [originalDirection, setOriginalDirection] = useState<StopDirection | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const officeStops = getOfficeStops(stops);
  const officeStopIds = new Set(officeStops.map((s) => s.id));
  // Reference office used only to pre-fill sensible default positions when adding a new stop.
  const primaryOfficeStop = officeStops[0] ?? null;
  const editingStop = editingStopId != null ? (stops.find((s) => s.id === editingStopId) ?? null) : null;
  const isEditingOffice = editingStop != null && isOfficeStop(editingStop);
  // True while the form (add or edit) represents an OFFICE-type stop.
  const isOfficeForm = isAdding ? formData.stopType === "OFFICE" : isEditingOffice;

  const resetForm = () => {
    setFormData(EMPTY_FORM);
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
      morning_eta: stop.morning_eta ? toClockHHmm(stop.morning_eta) : "",
      evening_eta: stop.evening_eta ? toClockHHmm(stop.evening_eta) : "",
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
    const insertMorning = officeMorning != null ? officeMorning : Math.max(0, ...stops.map((s) => s.morning_sequence ?? 0)) + 1;
    const insertEvening = primaryOfficeStop?.evening_sequence != null ? primaryOfficeStop.evening_sequence + 1 : Math.max(0, ...stops.map((s) => s.evening_sequence ?? 0)) + 1;
    setFormData({ ...EMPTY_FORM, morning_sequence: insertMorning.toString(), evening_sequence: insertEvening.toString() });
    setEditingStopId(null);
    setOriginalDirection(null);
    setIsAdding(true);
  };

  // Office stops are always BOTH-direction.
  const handleStopTypeChange = (stopType: StopType) => {
    setFormData((f) => ({ ...f, stopType, direction: stopType === "OFFICE" ? "BOTH" : f.direction }));
  };

  const handleDirectionChange = (dir: StopDirection) => {
    if (isOfficeForm) return;
    const nextMorning = Math.max(0, ...stops.map((s) => s.morning_sequence ?? 0)) + 1;
    const nextEvening = Math.max(0, ...stops.map((s) => s.evening_sequence ?? 0)) + 1;
    setFormData((f) => ({
      ...f,
      direction: dir,
      morning_sequence: dir === "EVENING" ? "" : dir === "BOTH" ? f.morning_sequence || nextMorning.toString() : f.morning_sequence,
      evening_sequence: dir === "MORNING" ? "" : dir === "BOTH" ? f.evening_sequence || nextEvening.toString() : f.evening_sequence,
    }));
  };

  const handleAddressSelect = useCallback(({ name, lat, lng }: { name: string; lat: number; lng: number }) => {
    setFormData((f) => ({ ...f, name, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
  }, []);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      setFormData((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
      toast.message(t("coordinatesUpdatedFromMap"));
    },
    [t],
  );

  const buildPayload = () => {
    if (!isEditingOffice && formData.direction === "BOTH" && (!formData.morning_sequence || !formData.evening_sequence)) {
      toast.error(editingStopId && originalDirection && originalDirection !== "BOTH" ? t("bothSequencesRequiredWhenChangingDirection") : t("bothSequencesRequired"));
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
      if (formData.morning_sequence !== "" && formData.direction !== "EVENING") data.morning_sequence = parseInt(formData.morning_sequence, 10);
      if (formData.evening_sequence !== "" && formData.direction !== "MORNING") data.evening_sequence = parseInt(formData.evening_sequence, 10);
    }
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleDelete = async (stop: CompanyRouteStop) => {
    if (officeStopIds.has(stop.id)) {
      toast.error(t("officeCannotBeDeleted"));
      return;
    }
    const ok = await confirm({
      title: t("confirmDeleteStop.title", { name: stop.name }),
      message: t("confirmDeleteStop.message"),
      consequences: [t("confirmDeleteStop.consequence1"), t("confirmDeleteStop.consequence2")],
      destructive: true,
      confirmLabel: t("confirmDeleteStop.confirm"),
    });
    if (!ok) return;
    setDeletingId(stop.id);
    try {
      await apiClient.deleteCompanyRouteStop(stop.id);
      toast.success(t("stopDeletedSuccess"));
      if (editingStopId === stop.id) resetForm();
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedDeleteStop"));
    } finally {
      setDeletingId(null);
    }
  };

  const morningStops = stopsForDirection(stops, "MORNING");
  const eveningStops = stopsForDirection(stops, "EVENING");
  const showMorning = formData.direction === "MORNING" || formData.direction === "BOTH" || isOfficeForm;
  const showEvening = formData.direction === "EVENING" || formData.direction === "BOTH" || isOfficeForm;

  const renderForm = (submitLabel: string) => {
    const mapMarkers: MapMarker[] =
      formData.lat && formData.lng
        ? [{ id: "form-pin", position: [parseFloat(formData.lat), parseFloat(formData.lng)], label: formData.name || t("newStop"), color: isOfficeForm ? MAP_COLORS.office : MAP_COLORS.pickup }]
        : [];

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {isAdding && (
          <Tabs value={formData.stopType} onValueChange={(v) => handleStopTypeChange(v as StopType)}>
            <TabsList variant="pills" aria-label={t("stopType")}>
              <TabsTrigger value="PICKUP" icon={<MapPin />}>
                {t("pickup")}
              </TabsTrigger>
              <TabsTrigger value="OFFICE" icon={<Building2 />}>
                {t("office")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {isOfficeForm && (
          <div className="flex items-start gap-3 rounded-lg border border-brand-line bg-brand-soft/40 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden="true">
              <Building2 className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-fg">{t("companyOffice")}</p>
              <p className="mt-0.5 text-xs text-fg-secondary">
                {t("officeNoAssignment")}
                {isEditingOffice && ` ${t("officePinnedNote")}`}
              </p>
            </div>
          </div>
        )}

        <Field label={t("searchLocation")} required>
          <StopAddressSearch onSelect={handleAddressSelect} defaultValue={formData.name} placeholder={t("searchLocationPlaceholder")} />
        </Field>

        <div className="h-[200px] overflow-hidden rounded-lg border border-line">
          <Map
            height="100%"
            markers={mapMarkers}
            onMapClick={handleMapClick}
            center={formData.lat && formData.lng ? [parseFloat(formData.lat), parseFloat(formData.lng)] : undefined}
          />
        </div>
        {formData.lat && formData.lng && (
          <p className="flex items-center gap-1 text-xs text-fg-muted">
            <MapPin className="size-3" aria-hidden="true" />
            <span dir="ltr">
              {parseFloat(formData.lat).toFixed(5)}, {parseFloat(formData.lng).toFixed(5)}
            </span>
            · {t("clickMapToAdjust")}
          </p>
        )}

        <Field label={t("stopName")} required>
          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t("stopNamePlaceholder")} />
        </Field>

        <FormGrid cols={3}>
          <Field label={t("direction")}>
            <Select value={isOfficeForm ? "BOTH" : formData.direction} onChange={(e) => handleDirectionChange(e.target.value as StopDirection)} disabled={isOfficeForm}>
              <option value="BOTH">{t("bothDirections")}</option>
              <option value="MORNING">{t("morningOnly")}</option>
              <option value="EVENING">{t("eveningOnly")}</option>
            </Select>
          </Field>
          {showMorning && (
            <Field label={isOfficeForm ? t("create.morningArrival") : t("morningEta")}>
              <Input type="time" value={formData.morning_eta} onChange={(e) => setFormData({ ...formData, morning_eta: e.target.value })} />
            </Field>
          )}
          {showEvening && (
            <Field label={isOfficeForm ? t("create.eveningDeparture") : t("eveningEta")}>
              <Input type="time" value={formData.evening_eta} onChange={(e) => setFormData({ ...formData, evening_eta: e.target.value })} />
            </Field>
          )}
        </FormGrid>

        <fieldset className={cn("rounded-lg border p-3", isOfficeForm ? "border-brand-line bg-brand-soft/30" : "border-line bg-subtle")}>
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            {isEditingOffice ? t("officePositionLocked") : isOfficeForm ? t("officePosition") : t("stopPositionInRoute")}
          </legend>
          <div className="flex flex-wrap items-end gap-4">
            {showMorning && (
              <Field label={t("morningPosition")} className="w-28">
                <Input type="number" min={1} value={formData.morning_sequence} disabled={isEditingOffice} onChange={(e) => setFormData({ ...formData, morning_sequence: e.target.value })} placeholder="#" />
              </Field>
            )}
            {showEvening && (
              <Field label={t("eveningPosition")} className="w-28">
                <Input type="number" min={1} value={formData.evening_sequence} disabled={isEditingOffice} onChange={(e) => setFormData({ ...formData, evening_sequence: e.target.value })} placeholder="#" />
              </Field>
            )}
            <p className="pb-2 text-xs text-fg-muted">{isEditingOffice ? t("officePositionLockedHint") : isOfficeForm ? t("officePositionHint") : t("stopSequenceHint")}</p>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" leftIcon={<X />} onClick={resetForm} disabled={isSaving}>
            {tCommon("actions.cancel")}
          </Button>
          <Button type="submit" size="sm" leftIcon={<Save />} loading={isSaving}>
            {submitLabel}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <Card>
      <CardHeader
        title={`${t("manageStops")} (${stops.length})`}
        description={t("manageStopsDescription")}
        actions={
          !isAdding && !editingStopId ? (
            <Button size="sm" leftIcon={<Plus />} onClick={handleAddClick}>
              {t("addStop")}
            </Button>
          ) : undefined
        }
      />
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="rounded-lg border border-line bg-subtle p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
              <Plus className="size-4 text-brand-ink" aria-hidden="true" /> {t("newStop")}
            </h4>
            {renderForm(t("saveStop"))}
          </div>
        )}

        {stops.length === 0 && !isAdding ? (
          <EmptyState compact icon={<MapPin aria-hidden="true" />} title={t("noStopsConfigured")} />
        ) : (
          <ul className="space-y-2">
            {stops.map((stop) => {
              const dir = deriveDirection(stop);
              const isOffice = officeStopIds.has(stop.id);
              if (editingStopId === stop.id) {
                return (
                  <li key={stop.id} className={cn("rounded-lg border p-4", isOffice ? "border-brand-line bg-brand-soft/30" : "border-brand-line bg-subtle")}>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
                      {isOffice ? <Building2 className="size-4 text-brand-ink" aria-hidden="true" /> : <Pencil className="size-4" aria-hidden="true" />}
                      {t("editingStop", { name: stop.name })}
                    </h4>
                    {renderForm(t("updateStop"))}
                  </li>
                );
              }
              return (
                <li key={stop.id} className={cn("flex items-center justify-between gap-3 rounded-lg border p-3", isOffice ? "border-brand-line bg-brand-soft/30" : "border-line bg-card hover:bg-subtle")}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex shrink-0 items-center gap-1">
                      {isOffice ? (
                        <span className="flex size-8 items-center justify-center rounded-full bg-brand text-white" aria-hidden="true">
                          <Building2 className="size-3.5" />
                        </span>
                      ) : (
                        <>
                          {stop.morning_sequence != null && (
                            <span className="flex size-8 items-center justify-center rounded-full bg-warning-soft text-sm font-bold text-warning-ink" title={t("morningPosition")}>
                              {stop.morning_sequence}
                            </span>
                          )}
                          {stop.evening_sequence != null && (
                            <span className="flex size-8 items-center justify-center rounded-full bg-purple-soft text-sm font-bold text-purple-ink" title={t("eveningPosition")}>
                              {stop.evening_sequence}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-fg">{stop.name}</span>
                        {isOffice ? (
                          <>
                            <Badge tone="brand" size="sm" icon={<Building2 aria-hidden="true" />}>
                              {t("office")}
                            </Badge>
                            <Badge tone="neutral" size="sm">
                              {t("officeAmLast")}
                            </Badge>
                            <Badge tone="neutral" size="sm">
                              {t("officePmFirst")}
                            </Badge>
                          </>
                        ) : (
                          <DirectionBadge direction={dir} />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-fg-muted">
                        {stop.lat != null && stop.lng != null && (
                          <span dir="ltr">
                            {Number(stop.lat).toFixed(5)}, {Number(stop.lng).toFixed(5)}
                          </span>
                        )}
                        {stop.morning_eta && dir !== "EVENING" && ` · ${t("morning")}: ${formatTime(stop.morning_eta)}`}
                        {stop.evening_eta && dir !== "MORNING" && ` · ${t("evening")}: ${formatTime(stop.evening_eta)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton label={`${tCommon("actions.edit")} · ${stop.name}`} size="icon-sm" onClick={() => handleEditClick(stop)}>
                      <Pencil />
                    </IconButton>
                    <IconButton
                      label={isOffice ? t("officeCannotBeDeleted") : `${tCommon("actions.delete")} · ${stop.name}`}
                      size="icon-sm"
                      disabled={isOffice || deletingId === stop.id}
                      loading={deletingId === stop.id}
                      onClick={() => void handleDelete(stop)}
                      className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink"
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
          <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
            {(
              [
                { key: "MORNING", list: morningStops, label: t("morningRoute"), Icon: Sunrise, etaKey: "morning_eta" as const, tone: "warning" as const },
                { key: "EVENING", list: eveningStops, label: t("eveningRoute"), Icon: Sunset, etaKey: "evening_eta" as const, tone: "purple" as const },
              ] as const
            ).map(({ key, list, label, Icon, etaKey, tone }) => (
              <div key={key} className="overflow-hidden rounded-lg border border-line">
                <div className={cn("flex items-center gap-2 border-b border-line px-3 py-2", tone === "warning" ? "bg-warning-soft text-warning-ink" : "bg-purple-soft text-purple-ink")}>
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="text-sm font-semibold">
                    {label} ({list.length})
                  </span>
                </div>
                <ol className="divide-y divide-line">
                  {list.map((s, i) => {
                    const isOffice = officeStopIds.has(s.id);
                    return (
                      <li key={s.id} className={cn("flex items-center gap-2 px-3 py-2 text-sm", isOffice && "bg-brand-soft/30")}>
                        <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold", isOffice ? "bg-brand text-white" : "bg-subtle text-fg-secondary")} aria-hidden="true">
                          {isOffice ? <Building2 className="size-3" /> : i + 1}
                        </span>
                        <span className={cn("text-fg", isOffice && "font-semibold")}>{s.name}</span>
                        {isOffice && (
                          <Badge tone="brand" size="sm">
                            {key === "MORNING" ? t("officeAmLast") : t("officePmFirst")}
                          </Badge>
                        )}
                        {s[etaKey] && <span className="ms-auto text-xs text-fg-muted">{formatTime(s[etaKey])}</span>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
