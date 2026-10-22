"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/app/lib/store/hooks";
import { selectCompany, fetchCompanyFeatures, selectCompanyFeatures, selectCompanyFeaturesStatus } from "@/app/lib/store/slices/companySlice";
import { useAuth } from "@/app/lib/contexts/auth-context";
import { apiClient, canServeShuttle } from "@/app/lib/services/api-client";
import type { PoolDriver, PoolVehicle } from "@/app/lib/services/types/multi-mode";
import StopAddressSearch from "@/app/ui/StopAddressSearch";
import type { MapMarker, MapPolyline } from "@/app/ui/Map";
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
  Label,
  PageHeader,
  PageSkeleton,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  usePageBreadcrumbs,
} from "@/app/ui";
import { useCompanyBasePath } from "../../lib/use-company-base-path";
import { MAP_COLORS } from "../lib/map-colors";

const Map = dynamic(() => import("@/app/ui/Map"), { ssr: false });

type PinMode = "pickup" | "office";

interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  morningEta: string;
  eveningEta: string;
}

function makeStop(name: string, lat: number, lng: number, morningEta: string, eveningEta: string): Stop {
  return { id: crypto.randomUUID(), name, lat, lng, morningEta, eveningEta };
}

function SectionTitle({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{children}</h2>
      {extra}
    </div>
  );
}

export default function CompanyCreateRoutePage() {
  const t = useTranslations("company.routes.create");
  const tRoutes = useTranslations("company.routes");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { companyPath } = useCompanyBasePath();
  const dispatch = useAppDispatch();
  const company = useAppSelector(selectCompany);
  const features = useAppSelector(selectCompanyFeatures);
  const featuresStatus = useAppSelector(selectCompanyFeaturesStatus);
  const { user } = useAuth();
  const isTrialUser = !!user?.is_trial;
  const companyId = Number(company?.id);

  usePageBreadcrumbs([{ label: t("title") }]);

  const canManageShuttle = isTrialUser || (features.find((f) => f.feature_key === "shuttle_self_managed")?.is_enabled ?? false);

  useEffect(() => {
    if (companyId) dispatch(fetchCompanyFeatures(companyId));
  }, [companyId, dispatch]);

  useEffect(() => {
    if (!companyId || isTrialUser || featuresStatus !== "succeeded" || canManageShuttle) return;
    router.replace(companyPath("/company/routes"));
  }, [companyId, isTrialUser, featuresStatus, canManageShuttle, router, companyPath]);

  const [name, setName] = useState("");
  const [assignedVehicleId, setAssignedVehicleId] = useState("");
  const [assignedDriverId, setAssignedDriverId] = useState("");
  /** A route may have multiple company office stops (multi-office shuttle support). */
  const [officeStops, setOfficeStops] = useState<Stop[]>([]);
  const [pickupStops, setPickupStops] = useState<Stop[]>([]);
  const [pinMode, setPinMode] = useState<PinMode>("office");
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<PoolVehicle[]>([]);
  const [drivers, setDrivers] = useState<PoolDriver[]>([]);
  const polylineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ordered for API: pickups first, offices last. */
  const orderedStops = useMemo(() => [...pickupStops, ...officeStops], [pickupStops, officeStops]);

  useEffect(() => {
    if (!companyId) return;
    apiClient
      .getPoolVehicles(companyId)
      .then((r) => setVehicles(r.data))
      .catch(() => toast.error(tRoutes("failedLoadFleetOptions")));
    apiClient
      .getPoolDrivers(companyId)
      .then((r) => setDrivers(r.data.filter((d) => canServeShuttle(d.driver_type))))
      .catch(() => toast.error(tRoutes("failedLoadFleetOptions")));
  }, [companyId, tRoutes]);

  const fetchPreviewPolyline = useCallback(async (currentStops: Stop[]) => {
    if (currentStops.length < 2) {
      setRoutePolyline([]);
      return;
    }
    try {
      const data = await apiClient.previewCompanyRoutePolyline(currentStops.map((s) => ({ lat: s.lat, lng: s.lng })));
      setRoutePolyline(data.points.map((p) => [p.lat, p.lng] as [number, number]));
    } catch {
      setRoutePolyline(currentStops.map((s) => [s.lat, s.lng] as [number, number]));
    }
  }, []);

  const schedulePolylineUpdate = useCallback(
    (updatedStops: Stop[]) => {
      if (polylineDebounceRef.current) clearTimeout(polylineDebounceRef.current);
      polylineDebounceRef.current = setTimeout(() => fetchPreviewPolyline(updatedStops), 600);
    },
    [fetchPreviewPolyline],
  );

  const applyOffice = useCallback(
    (stop: Stop) => {
      setOfficeStops((prev) => {
        const next = [...prev, stop];
        schedulePolylineUpdate([...pickupStops, ...next]);
        return next;
      });
      toast.success(t("officeAdded"));
    },
    [pickupStops, schedulePolylineUpdate, t],
  );

  const applyPickup = useCallback(
    (stop: Stop) => {
      setPickupStops((prev) => {
        const updated = [...prev, stop];
        schedulePolylineUpdate([...updated, ...officeStops]);
        return updated;
      });
      toast.success(t("pickupAdded", { name: stop.name }));
    },
    [officeStops, schedulePolylineUpdate, t],
  );

  const handleAddressSelect = useCallback(
    ({ name: stopName, lat, lng }: { name: string; lat: number; lng: number }) => {
      if (pinMode === "office") applyOffice(makeStop(stopName, lat, lng, "09:00", "18:00"));
      else applyPickup(makeStop(stopName, lat, lng, "08:00", "18:30"));
    },
    [pinMode, applyOffice, applyPickup],
  );

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (pinMode === "office") applyOffice(makeStop(t("defaultOfficeName", { n: officeStops.length + 1 }), lat, lng, "09:00", "18:00"));
      else applyPickup(makeStop(t("defaultPickupName", { n: pickupStops.length + 1 }), lat, lng, "08:00", "18:30"));
    },
    [pinMode, pickupStops.length, officeStops.length, applyOffice, applyPickup, t],
  );

  const handleRemovePickup = useCallback(
    (id: string) => {
      setPickupStops((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        schedulePolylineUpdate([...updated, ...officeStops]);
        return updated;
      });
    },
    [officeStops, schedulePolylineUpdate],
  );

  const handleRemoveOffice = useCallback(
    (id: string) => {
      setOfficeStops((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        schedulePolylineUpdate([...pickupStops, ...updated]);
        return updated;
      });
    },
    [pickupStops, schedulePolylineUpdate],
  );

  const handlePickupChange = useCallback((id: string, field: keyof Stop, value: string) => {
    setPickupStops((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }, []);

  const handleOfficeChange = useCallback((id: string, field: keyof Stop, value: string) => {
    setOfficeStops((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!companyId) {
      toast.error(tCommon("errors.noCompanyData"));
      return;
    }
    if (!name.trim()) {
      toast.error(tRoutes("routeNameRequired"));
      return;
    }
    if (officeStops.length < 1) {
      toast.error(t("officeRequired"));
      return;
    }
    if (pickupStops.length < 1) {
      toast.error(t("pickupRequired"));
      return;
    }
    setSaving(true);
    try {
      await apiClient.createCompanyRoute({
        name: name.trim(),
        company_id: companyId,
        assigned_vehicle_id: assignedVehicleId ? Number(assignedVehicleId) : undefined,
        assigned_driver_id: assignedDriverId || undefined,
        stops: [
          ...pickupStops.map((stop, index) => ({
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            morning_eta: stop.morningEta,
            evening_eta: stop.eveningEta,
            sequence_order: index + 1,
            stop_type: "PICKUP" as const,
          })),
          ...officeStops.map((stop, index) => ({
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            morning_eta: stop.morningEta,
            evening_eta: stop.eveningEta,
            sequence_order: pickupStops.length + index + 1,
            stop_type: "OFFICE" as const,
          })),
        ],
      });
      toast.success(t("created"));
      router.push(companyPath("/company/routes"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const mapMarkers: MapMarker[] = [
    ...pickupStops.map((s, index) => ({ id: s.id, position: [s.lat, s.lng] as [number, number], label: `${index + 1}. ${s.name}`, color: MAP_COLORS.pickup })),
    ...officeStops.map((s) => ({ id: s.id, position: [s.lat, s.lng] as [number, number], label: `${tRoutes("office")} · ${s.name}`, color: MAP_COLORS.office })),
  ];

  const mapPolylines: MapPolyline[] =
    routePolyline.length >= 2
      ? [{ positions: routePolyline, color: MAP_COLORS.route }]
      : orderedStops.length > 1
        ? [{ positions: orderedStops.map((s) => [s.lat, s.lng] as [number, number]), color: MAP_COLORS.fallback, dashArray: "6 6" }]
        : [];

  const mapCenter: [number, number] | undefined = officeStops[0]
    ? [officeStops[0].lat, officeStops[0].lng]
    : pickupStops[0]
      ? [pickupStops[0].lat, pickupStops[0].lng]
      : undefined;

  if (!company?.services_enabled?.shuttle_enabled) {
    return (
      <Card>
        <EmptyState title={tRoutes("shuttleDisabled")} description={tRoutes("shuttleDisabledDescription")} />
      </Card>
    );
  }

  if (!canManageShuttle) {
    if (featuresStatus === "loading" || featuresStatus === "idle") return <PageSkeleton />;
    return (
      <Card>
        <EmptyState title={t("notAvailable")} description={t("notAvailableDescription")} />
      </Card>
    );
  }

  const missing: string[] = [];
  if (!name.trim()) missing.push(t("missing.name"));
  if (officeStops.length === 0) missing.push(t("missing.office"));
  if (pickupStops.length < 1) missing.push(t("missing.pickup"));
  const canSave = missing.length === 0;

  const driverOptions = drivers.map((d) => (
    <option key={d.user_id} value={d.user_id}>
      {d.users?.full_name}
      {d.users?.phone ? ` · ${d.users.phone}` : ""}
    </option>
  ));
  const vehicleOptions = vehicles.map((v) => (
    <option key={v.id} value={v.id}>
      {v.plate_number}
      {v.model ? ` · ${v.model}` : ""}
    </option>
  ));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        back={{ href: companyPath("/company/routes"), label: tRoutes("backToRoutes") }}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => router.push(companyPath("/company/routes"))} disabled={saving}>
              {tCommon("actions.cancel")}
            </Button>
            <Button type="submit" disabled={!canSave} loading={saving}>
              {t("save")}
            </Button>
          </>
        }
        meta={
          !canSave ? (
            <>
              <span className="text-xs text-fg-muted">{t("stillNeed")}</span>
              {missing.map((item) => (
                <Badge key={item} tone="warning" size="sm">
                  {item}
                </Badge>
              ))}
            </>
          ) : (
            <Badge tone="success" size="sm" dot>
              {t("readyToSave")}
            </Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <Card className="lg:order-1">
          <CardContent className="space-y-6">
            <section className="space-y-3">
              <SectionTitle>{t("sections.name")}</SectionTitle>
              <Field label={tRoutes("routeName")} required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
              </Field>
            </section>

            <section className="space-y-3">
              <SectionTitle>{t("sections.addStops")}</SectionTitle>
              <Tabs value={pinMode} onValueChange={(v) => setPinMode(v as PinMode)}>
                <TabsList variant="pills" className="w-full" aria-label={t("pinModeLabel")}>
                  <TabsTrigger value="office" icon={<Building2 />} className="flex-1 justify-center">
                    {t("setOffice")}
                  </TabsTrigger>
                  <TabsTrigger value="pickup" icon={<MapPin />} className="flex-1 justify-center">
                    {t("addPickup")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex flex-col gap-1.5">
                <Label>{pinMode === "office" ? t("searchOffice") : t("searchPickup")}</Label>
                <StopAddressSearch
                  onSelect={handleAddressSelect}
                  placeholder={pinMode === "office" ? t("searchOfficePlaceholder") : t("searchPickupPlaceholder")}
                  clearOnSelect
                />
                <p className="text-xs text-fg-muted">{pinMode === "office" ? t("clickMapOffice") : t("clickMapPickup")}</p>
              </div>
            </section>

            <section className="space-y-2">
              <SectionTitle
                extra={
                  <Badge tone="warning" size="sm">
                    {t("atLeastOneRequired")}
                  </Badge>
                }
              >
                {t("sections.offices", { count: officeStops.length })}
              </SectionTitle>
              {officeStops.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line bg-subtle p-4 text-center">
                  <p className="text-sm font-medium text-fg">{t("noOfficeYet")}</p>
                  <p className="mt-1 text-xs text-fg-muted">{t("noOfficeHint")}</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {officeStops.map((stop) => (
                    <li key={stop.id} className="rounded-lg border border-brand-line bg-brand-soft/40 p-3">
                      <div className="mb-2 flex items-start gap-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden="true">
                          <Building2 className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <Field label={t("officeName")}>
                            <Input value={stop.name} onChange={(e) => handleOfficeChange(stop.id, "name", e.target.value)} className="h-8 font-medium" />
                          </Field>
                          <p className="mt-1 text-[11px] text-fg-muted">{t("officeBoardingNote")}</p>
                        </div>
                        <IconButton label={t("removeOffice", { name: stop.name })} size="icon-sm" variant="ghost" onClick={() => handleRemoveOffice(stop.id)}>
                          <Trash2 />
                        </IconButton>
                      </div>
                      <FormGrid cols={2} className="gap-2 ps-10">
                        <Field label={t("morningArrival")}>
                          <Input type="time" value={stop.morningEta} onChange={(e) => handleOfficeChange(stop.id, "morningEta", e.target.value)} className="h-8" />
                        </Field>
                        <Field label={t("eveningDeparture")}>
                          <Input type="time" value={stop.eveningEta} onChange={(e) => handleOfficeChange(stop.id, "eveningEta", e.target.value)} className="h-8" />
                        </Field>
                      </FormGrid>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <SectionTitle>{t("sections.pickups", { count: pickupStops.length })}</SectionTitle>
              {pickupStops.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-fg-muted">{t("noPickupsYet")}</p>
              ) : (
                <ul className="space-y-2">
                  {pickupStops.map((stop, index) => (
                    <li key={stop.id} className="rounded-lg border border-line bg-subtle p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-info text-xs font-semibold text-white" aria-hidden="true">
                          {index + 1}
                        </span>
                        <Input
                          aria-label={t("pickupNameLabel", { n: index + 1 })}
                          value={stop.name}
                          onChange={(e) => handlePickupChange(stop.id, "name", e.target.value)}
                          className="h-8 flex-1"
                        />
                        <IconButton label={t("removePickup", { name: stop.name })} size="icon-sm" variant="ghost" onClick={() => handleRemovePickup(stop.id)}>
                          <Trash2 />
                        </IconButton>
                      </div>
                      <FormGrid cols={2} className="gap-2 ps-8">
                        <Field label={t("morningTime")}>
                          <Input type="time" value={stop.morningEta} onChange={(e) => handlePickupChange(stop.id, "morningEta", e.target.value)} className="h-8" />
                        </Field>
                        <Field label={t("eveningTime")}>
                          <Input type="time" value={stop.eveningEta} onChange={(e) => handlePickupChange(stop.id, "eveningEta", e.target.value)} className="h-8" />
                        </Field>
                      </FormGrid>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <SectionTitle>{t("sections.fleet")}</SectionTitle>
                <p className="mt-0.5 text-xs text-fg-muted">{t("fleetHint")}</p>
              </div>
              <FormGrid cols={2} className="gap-3">
                <Field label={tRoutes("driver")}>
                  <Select placeholder={tRoutes("noneUnassigned")} value={assignedDriverId} onChange={(e) => setAssignedDriverId(e.target.value)}>
                    {driverOptions}
                  </Select>
                </Field>
                <Field label={tRoutes("vehicle")}>
                  <Select placeholder={tRoutes("noneUnassigned")} value={assignedVehicleId} onChange={(e) => setAssignedVehicleId(e.target.value)}>
                    {vehicleOptions}
                  </Select>
                </Field>
              </FormGrid>
            </section>

            {officeStops.length > 0 && pickupStops.length > 0 && (
              <section className="rounded-lg border border-line bg-subtle p-3 text-xs text-fg-secondary">
                <p className="mb-2 font-semibold text-fg">{t("orderOnSave")}</p>
                <p>
                  <span className="font-medium">{tRoutes("morning")} → </span>
                  {pickupStops.map((s) => s.name).join(" → ")} → {officeStops.map((s) => s.name).join(", ")}
                </p>
                <p className="mt-1">
                  <span className="font-medium">{tRoutes("evening")} → </span>
                  {officeStops.map((s) => s.name).join(", ")} → {[...pickupStops].reverse().map((s) => s.name).join(" → ")}
                </p>
                <p className="mt-2 text-fg-muted">
                  {t("orderHint")}
                  {officeStops.length > 1 && ` ${t("multiOfficeHint")}`}
                </p>
              </section>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden lg:sticky lg:top-20 lg:order-2 lg:col-span-2">
          <CardHeader
            title={t("map")}
            description={orderedStops.length >= 2 ? t("mapRoadFollowing") : t("mapClickToPin")}
            actions={
              <ul className="flex items-center gap-3 text-[11px] font-medium text-fg-secondary" aria-label={t("mapLegend")}>
                <li className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: MAP_COLORS.office }} aria-hidden="true" /> {tRoutes("office")}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: MAP_COLORS.pickup }} aria-hidden="true" /> {t("pickups")}
                </li>
              </ul>
            }
          />
          <div className="h-[320px] sm:h-[420px] lg:h-[calc(100vh-16rem)] lg:min-h-[420px]">
            <Map height="100%" onMapClick={handleMapClick} markers={mapMarkers} polylines={mapPolylines} center={mapCenter} />
          </div>
        </Card>
      </div>
    </form>
  );
}
