"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "../../../lib/store/hooks";
import { fetchEmployees, selectEmployees, selectEmployeesStatus } from "../../../lib/store/slices/employeeSlice";
import { useCompanyAccess } from "../../lib/access-context";
import { apiClient } from "../../../lib/services/api-client";
import { toast } from "sonner";
import { Card } from "../../components/Card";
import { KpiTile } from "../../components/overview/KpiTile";
import { useOverviewFormat } from "../../components/overview/format";
import {
  Badge,
  Button,
  CardDescription,
  CardTitle,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/app/admin/ui";
import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarPlus,
  MapPin,
  RouteIcon,
  Sunrise,
  Sunset,
  Users,
  Phone,
  Mail,
  UserPlus,
  ListOrdered,
  UserMinus,
} from "@/app/components/icons";
import { RouteDetailsEditor } from "../components/RouteDetailsEditor";
import { RouteStopsEditor } from "../components/RouteStopsEditor";
import { RouteOverviewMap } from "../components/RouteOverviewMap";
import { getOfficeStops } from "../../../lib/utils/routeStops";

// ─── Types ───────────────────────────────────────────────────────────────────

type RouteStop = {
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

type EmployeeAssignment = {
  user_id: string;
  route_id?: number | null;
  pickup_stop_id?: number | null;
  office_stop_id?: number | null;
  users?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    department?: string | null;
  } | null;
  route_stops?: {
    id: number;
    name: string;
    sequence_order: number;
  } | null;
  /** The assigned office stop — populated when the route has multiple OFFICE-type stops. */
  office_route_stops?: {
    id?: number;
    name: string;
  } | null;
};

type RouteDetail = {
  id: number;
  name: string;
  company_id: number | null;
  assigned_vehicle_id?: number | null;
  assigned_driver_id?: string | null;
  vehicles?: { id?: number; plate_number: string; model: string | null; capacity?: number | null; seat_capacity?: number | null } | null;
  users?: { id: string; full_name: string; phone: string } | null;
  route_stops: RouteStop[];
  employee_route_assignments?: EmployeeAssignment[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(value?: string | null) {
  if (!value) return null;
  if (value.includes("T")) {
    const timePart = value.split("T")[1]?.slice(0, 5);
    if (timePart) return timePart;
  }
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value.slice(0, 5);
  return value;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StopTimeline({ stops, direction }: { stops: RouteStop[]; direction: "MORNING" | "EVENING" }) {
  const t = useTranslations("company.routes");
  const officeStopIds = new Set(getOfficeStops(stops).map((s) => s.id));
  const sorted = [...stops]
    .filter((s) =>
      direction === "MORNING" ? s.morning_sequence != null : s.evening_sequence != null
    )
    .sort((a, b) =>
      direction === "MORNING"
        ? (a.morning_sequence ?? 0) - (b.morning_sequence ?? 0)
        : (a.evening_sequence ?? 0) - (b.evening_sequence ?? 0)
    );

  if (sorted.length === 0) {
    return <p className="text-sm text-fg-muted">{t("noStopsConfigured")}</p>;
  }

  return (
    <ol className="relative">
      <span aria-hidden="true" className="absolute start-3 top-3 bottom-3 w-px bg-line" />
      {sorted.map((stop, idx) => {
        const eta =
          direction === "MORNING" ? formatTime(stop.morning_eta) : formatTime(stop.evening_eta);
        const isOffice = officeStopIds.has(stop.id);

        return (
          <li key={stop.id} className="relative flex items-start gap-3 py-1.5">
            <span
              className={cx(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
                isOffice
                  ? "border-line-strong bg-subtle text-fg"
                  : "border-line bg-card text-fg-muted"
              )}
            >
              {isOffice
                ? <Building2 className="size-3.5" aria-hidden="true" />
                : ((direction === "MORNING" ? stop.morning_sequence : stop.evening_sequence) ?? idx + 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-fg">
                <span className="min-w-0 break-words">{stop.name}</span>
                {isOffice && (
                  <>
                    <Badge tone="neutral">{t("officeStop")}</Badge>
                    <Badge tone="neutral" variant="outline">
                      {direction === "MORNING" ? t("amLast") : t("pmFirst")}
                    </Badge>
                  </>
                )}
              </div>
              {eta && (
                <p className="mt-0.5 text-xs text-fg-muted tabular-nums">
                  {isOffice
                    ? (direction === "MORNING" ? t("arrival") : t("departure"))
                    : (direction === "MORNING" ? t("pickup") : t("dropoff"))}
                  : {eta}
                </p>
              )}
              {isOffice && (
                <p className="mt-0.5 text-xs text-fg-muted">{t("officeNotAssignable")}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RouteDetailPage() {
  const params = useParams();
  const t = useTranslations("company.routes");
  const tCommon = useTranslations("common");
  const dispatch = useAppDispatch();
  const { company, access } = useCompanyAccess();
  const allEmployees = useAppSelector(selectEmployees);
  const employeeStatus = useAppSelector(selectEmployeesStatus);
  const routeId = params.id ? +params.id : null;

  const canManageShuttle = access.can.selfManageShuttle;

  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingTrips, setGeneratingTrips] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "stops">("overview");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedStopId, setSelectedStopId] = useState<number | "">("");
  const [selectedOfficeStopId, setSelectedOfficeStopId] = useState<number | "">("");

  useEffect(() => {
    if (company?.id && employeeStatus === "idle") {
      dispatch(fetchEmployees(company.id.toString()));
    }
  }, [company?.id, employeeStatus, dispatch]);

  const load = useCallback(async () => {
    if (!routeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.request<RouteDetail>(`/routes/${routeId}`);
      setRoute(data);
      setMapRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("errors.failedToLoadRoute"));
    } finally {
      setLoading(false);
    }
  }, [routeId, tCommon]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerateTrips() {
    if (!routeId) return;
    setGeneratingTrips(true);
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      await apiClient.generateShuttleTripsForRoute(routeId, [fmt(today), fmt(tomorrow)]);
      toast.success(t("tripsGeneratedSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedGenerateTrips"));
    } finally {
      setGeneratingTrips(false);
    }
  }

  async function handleOptimizeRoute() {
    if (!routeId) return;
    setOptimizing(true);
    try {
      await apiClient.optimizeCompanyRoute(routeId);
      toast.success(t("routeOptimizedSuccess"));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedOptimizeRoute"));
    } finally {
      setOptimizing(false);
    }
  }

  async function handleRemoveEmployee(userId: string) {
    if (!confirm(t("confirmRemoveEmployee"))) return;
    setRemovingUserId(userId);
    try {
      await apiClient.removeEmployeeFromRoute(userId);
      toast.success(t("employeeRemovedSuccess"));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedRemoveEmployee"));
    } finally {
      setRemovingUserId(null);
    }
  }

  async function handleAssignEmployee() {
    if (!routeId || !selectedUserId) return;
    if (hasMultipleOffices && !selectedOfficeStopId) {
      toast.error(t("selectOfficeRequired"));
      return;
    }
    setAssigning(true);
    try {
      await apiClient.assignEmployeeToRoute({
        user_id: selectedUserId,
        route_id: routeId,
        pickup_stop_id: selectedStopId ? Number(selectedStopId) : undefined,
        ...(hasMultipleOffices ? { office_stop_id: Number(selectedOfficeStopId) } : {}),
      });
      toast.success(t("employeeAssignedSuccess"));
      setShowAssignModal(false);
      setSelectedUserId("");
      setSelectedStopId("");
      setSelectedOfficeStopId("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedAssignEmployee"));
    } finally {
      setAssigning(false);
    }
  }

  const employees = route?.employee_route_assignments ?? [];
  const stops = route?.route_stops ?? [];
  // A route may have multiple OFFICE-type stops (multi-office shuttle support). Not assignable as pickup.
  const officeStopsList = getOfficeStops(stops);
  const officeStopIds = new Set(officeStopsList.map((s) => s.id));
  const hasMultipleOffices = officeStopsList.length > 1;
  const pickupStops = stops.filter((s) => !officeStopIds.has(s.id));
  const vehicle = route?.vehicles ?? null;
  const driver = route?.users ?? null;

  // utilization
  const capacity = vehicle?.capacity ?? vehicle?.seat_capacity ?? null;
  const utilizationPct = capacity ? Math.min(100, Math.round((employees.length / capacity) * 100)) : null;

  const f = useOverviewFormat();
  const morningStopCount = stops.filter((s) => s.morning_sequence != null).length;
  const eveningStopCount = stops.filter((s) => s.evening_sequence != null).length;

  if (!company) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-fg-muted">{tCommon("errors.noCompanySelected")}</p>
      </div>
    );
  }

  const backLink = (
    <Button asChild variant="ghost" size="sm" className="-ms-2 self-start">
      <Link href="/company/routes">
        <ArrowLeft className="rtl:rotate-180" aria-hidden="true" />
        {t("backToRoutes")}
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-6 pb-12">
      {loading ? (
        <>
          {backLink}
          <Card>
            <LoadingBlock label={t("loadingRoute")} />
          </Card>
        </>
      ) : error ? (
        <>
          {backLink}
          <Card>
            <ErrorState
              title={tCommon("errors.failedToLoadRoute")}
              message={error}
              onRetry={load}
              retryLabel={tCommon("actions.tryAgain")}
            />
          </Card>
        </>
      ) : !route ? (
        <>
          {backLink}
          <Card>
            <EmptyState icon={<RouteIcon aria-hidden="true" />} title={t("routeNotFound")} />
          </Card>
        </>
      ) : (
        <>
          <PageHeader
            back={{ href: "/company/routes", label: t("backToRoutes") }}
            title={route.name}
            actions={
              <>
                <Button asChild variant="outline">
                  <Link href={`/company/routes/${routeId}/track`}>
                    <Activity aria-hidden="true" />
                    {t("trackLive")}
                  </Link>
                </Button>
                {canManageShuttle && (
                  <>
                    <Button
                      variant="outline"
                      leftIcon={<CalendarPlus aria-hidden="true" />}
                      disabled={generatingTrips}
                      onClick={handleGenerateTrips}
                    >
                      {generatingTrips ? t("generatingTrips") : t("generateTrips")}
                    </Button>
                    <Button
                      variant="outline"
                      leftIcon={<RouteIcon aria-hidden="true" />}
                      disabled={optimizing}
                      onClick={handleOptimizeRoute}
                    >
                      {optimizing ? t("optimizingRoute") : t("optimizeRoute")}
                    </Button>
                    <Button leftIcon={<UserPlus aria-hidden="true" />} onClick={() => setShowAssignModal(true)}>
                      {t("assignEmployee")}
                    </Button>
                  </>
                )}
              </>
            }
            tabs={
              canManageShuttle ? (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "stops")}>
                  <TabsList>
                    <TabsTrigger value="overview">{t("overviewTab")}</TabsTrigger>
                    <TabsTrigger value="stops" icon={<ListOrdered aria-hidden="true" />}>
                      {t("manageStops")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : undefined
            }
          />

          {activeTab === "stops" && canManageShuttle ? (
            <RouteStopsEditor routeId={route.id} stops={stops} onUpdated={load} />
          ) : (
            <>
              <section aria-label={t("routeDetails")} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile label={t("passengers")} value={f.num(employees.length)} />
                <KpiTile label={t("stops")} value={f.num(morningStopCount)} />
                <KpiTile
                  label={t("vehicle")}
                  value={vehicle?.plate_number ?? "—"}
                  valueTone={vehicle?.plate_number ? "default" : "muted"}
                  sub={vehicle?.model ?? undefined}
                />
                {utilizationPct !== null ? (
                  <KpiTile
                    label={t("utilization", { count: `${f.num(employees.length)}/${f.num(capacity ?? 0)}` })}
                    value={f.pct(utilizationPct)}
                  />
                ) : (
                  <KpiTile
                    label={t("driver")}
                    value={driver?.full_name ?? t("unassigned")}
                    valueTone={driver?.full_name ? "default" : "muted"}
                  />
                )}
              </section>

              <RouteOverviewMap routeId={route.id} stops={stops} refreshKey={mapRefreshKey} />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Passengers */}
                <div className="min-w-0 lg:col-span-2">
                  <Card className="overflow-hidden !p-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                      <div className="flex min-w-0 items-center gap-2">
                        <CardTitle>{t("passengersOnThisRoute")}</CardTitle>
                        <Badge tone="neutral" className="tabular-nums">{f.num(employees.length)}</Badge>
                      </div>
                      {capacity && (
                        <div className="flex items-center gap-3 text-xs text-fg-muted">
                          <span className="tabular-nums">
                            {t("capacity", { current: f.num(employees.length), max: f.num(capacity) })}
                          </span>
                          <div
                            className="h-1.5 w-24 overflow-hidden rounded-full bg-subtle"
                            role="meter"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={utilizationPct ?? 0}
                            aria-label={t("utilization", { count: `${f.num(employees.length)}/${f.num(capacity)}` })}
                          >
                            <div
                              className={cx(
                                "h-full rounded-full",
                                utilizationPct! > 85 ? "bg-danger" : utilizationPct! > 60 ? "bg-warning" : "bg-success"
                              )}
                              style={{ width: `${utilizationPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {employees.length === 0 ? (
                      <EmptyState
                        icon={<Users aria-hidden="true" />}
                        title={t("noEmployeesAssigned")}
                        action={
                          canManageShuttle ? (
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<UserPlus aria-hidden="true" />}
                              onClick={() => setShowAssignModal(true)}
                            >
                              {t("assignAnEmployee")}
                            </Button>
                          ) : undefined
                        }
                      />
                    ) : (
                      <ul className="divide-y divide-line">
                        {employees.map((assignment) => {
                          const emp = assignment.users;
                          const pickupStop = assignment.route_stops;
                          return (
                            <li
                              key={assignment.user_id}
                              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-row-hover sm:flex-nowrap sm:px-5"
                            >
                              <span
                                aria-hidden="true"
                                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-medium text-fg-secondary"
                              >
                                {emp?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                              </span>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-fg">
                                  {emp?.full_name ?? tCommon("status.unknown")}
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                                  {emp?.department && <span>{emp.department}</span>}
                                  {emp?.phone && (
                                    <span className="flex items-center gap-1 tabular-nums" dir="ltr">
                                      <Phone className="size-3" aria-hidden="true" />
                                      {emp.phone}
                                    </span>
                                  )}
                                  {emp?.email && (
                                    <span className="flex min-w-0 max-w-[220px] items-center gap-1">
                                      <Mail className="size-3 shrink-0" aria-hidden="true" />
                                      <span className="truncate">{emp.email}</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                {pickupStop && (
                                  <Badge tone="neutral" variant="outline" icon={<MapPin aria-hidden="true" />}>
                                    {pickupStop.name}
                                  </Badge>
                                )}
                                {hasMultipleOffices && assignment.office_route_stops && (
                                  <Badge tone="neutral" icon={<Building2 aria-hidden="true" />}>
                                    {assignment.office_route_stops.name}
                                  </Badge>
                                )}
                                {canManageShuttle && emp?.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    leftIcon={<UserMinus aria-hidden="true" />}
                                    disabled={removingUserId === emp.id}
                                    onClick={() => handleRemoveEmployee(emp.id)}
                                  >
                                    {removingUserId === emp.id ? t("removingEmployee") : t("removeEmployee")}
                                  </Button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Card>
                </div>

                {/* Route info */}
                <div className="flex min-w-0 flex-col gap-4">
                  {canManageShuttle && company?.id ? (
                    <RouteDetailsEditor
                      routeId={route.id}
                      companyId={Number(company.id)}
                      name={route.name}
                      vehicle={vehicle}
                      driver={driver}
                      assignedVehicleId={route.assigned_vehicle_id}
                      assignedDriverId={route.assigned_driver_id}
                      onUpdated={load}
                    />
                  ) : (
                    <Card className="h-auto">
                      <CardTitle>{t("vehicleAndDriver")}</CardTitle>
                      <dl className="mt-3 divide-y divide-line border-t border-line">
                        <div className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                          <dt className="text-fg-muted">{t("vehicle")}</dt>
                          <dd className="min-w-0 truncate text-end font-medium text-fg tabular-nums">
                            {vehicle ? `${vehicle.plate_number}${vehicle.model ? ` · ${vehicle.model}` : ""}` : t("notAssigned")}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                          <dt className="text-fg-muted">{t("driver")}</dt>
                          <dd className="min-w-0 text-end">
                            <span className="block truncate font-medium text-fg">{driver?.full_name ?? t("notAssigned")}</span>
                            {driver?.phone && (
                              <span className="block text-xs text-fg-muted tabular-nums" dir="ltr">{driver.phone}</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </Card>
                  )}

                  {canManageShuttle && (
                    <Button
                      variant="outline"
                      className="w-full"
                      leftIcon={<ListOrdered aria-hidden="true" />}
                      onClick={() => setActiveTab("stops")}
                    >
                      {t("manageStops")}
                    </Button>
                  )}

                  <Card className="h-auto">
                    <div className="mb-3 flex items-center gap-2">
                      <Sunrise className="size-4 text-fg-muted" aria-hidden="true" />
                      <CardTitle>{t("morningRoute")}</CardTitle>
                      <CardDescription className="mt-0 tabular-nums">
                        {t("stopsCountParen", { count: morningStopCount })}
                      </CardDescription>
                    </div>
                    <StopTimeline stops={stops} direction="MORNING" />
                  </Card>

                  <Card className="h-auto">
                    <div className="mb-3 flex items-center gap-2">
                      <Sunset className="size-4 text-fg-muted" aria-hidden="true" />
                      <CardTitle>{t("eveningRoute")}</CardTitle>
                      <CardDescription className="mt-0 tabular-nums">
                        {t("stopsCountParen", { count: eveningStopCount })}
                      </CardDescription>
                    </div>
                    <StopTimeline stops={stops} direction="EVENING" />
                  </Card>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent
          size="sm"
          title={t("assignEmployeeTitle")}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowAssignModal(false)}>
                {tCommon("actions.cancel")}
              </Button>
              <Button disabled={!selectedUserId || assigning} onClick={handleAssignEmployee}>
                {assigning ? t("assigningEmployee") : t("confirmAssignment")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field
              label={t("selectEmployee")}
              hint={allEmployees.length === 0 && employeeStatus !== "loading" ? t("noCompanyEmployees") : undefined}
            >
              <Select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                placeholder={t("chooseEmployee")}
              >
                {allEmployees
                  .filter((emp) => !employees.some((assigned) => assigned.users?.id === emp.id))
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}{emp.department ? ` (${emp.department})` : ""}
                    </option>
                  ))}
              </Select>
            </Field>

            <Field
              label={
                <>
                  {t("pickupStop")}{" "}
                  <span className="font-normal text-fg-muted">{t("pickupStopOptional")}</span>
                </>
              }
              hint={t("officeStopExcluded")}
            >
              <Select
                value={selectedStopId}
                onChange={(e) => setSelectedStopId(e.target.value ? Number(e.target.value) : "")}
                placeholder={t("noneAutomatic")}
              >
                {pickupStops.map((stop) => (
                  <option key={stop.id} value={stop.id}>
                    {stop.name}
                  </option>
                ))}
              </Select>
            </Field>

            {hasMultipleOffices && (
              <Field label={t("officeStop")} hint={t("multipleOfficesHint")}>
                <Select
                  value={selectedOfficeStopId}
                  onChange={(e) => setSelectedOfficeStopId(e.target.value ? Number(e.target.value) : "")}
                  placeholder={t("selectOffice")}
                >
                  {officeStopsList.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
