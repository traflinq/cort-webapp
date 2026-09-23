"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "../../../lib/store/hooks";
import { selectCompany, fetchCompanyFeatures, selectCompanyFeatures } from "../../../lib/store/slices/companySlice";
import { fetchEmployees, selectEmployees, selectEmployeesStatus } from "../../../lib/store/slices/employeeSlice";
import { useAuth } from "../../../lib/contexts/auth-context";
import { apiClient } from "../../../lib/services/api-client";
import { toast } from "sonner";
import Modal from "../../bookings/components/Modal";
import { Card } from "../../components/DashboardComponents";
import { Button } from "@/app/admin/ui/Button";
import {
  Activity,
  ArrowLeft,
  Building2,
  Bus,
  User,
  MapPin,
  Sunrise,
  Sunset,
  Users,
  Phone,
  Mail,
  Car,
  RefreshCw,
  UserPlus,
  Sparkles,
  ListOrdered,
  UserMinus,
} from "lucide-react";
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
    return <p className="text-xs text-[var(--text-muted)] italic">{t("noStopsConfigured")}</p>;
  }

  return (
    <div className="relative">
      <div className="absolute start-3.5 top-4 bottom-4 w-px bg-[var(--border-light)]" />
      <div className="space-y-3">
        {sorted.map((stop, idx) => {
          const eta =
            direction === "MORNING" ? formatTime(stop.morning_eta) : formatTime(stop.evening_eta);
          const isOffice = officeStopIds.has(stop.id);

          return (
            <div key={stop.id} className="flex items-start gap-3">
              <div
                className={cx(
                  "relative z-10 mt-0.5 w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold",
                  isOffice
                    ? "border-red-500 bg-red-500 text-white"
                    : "border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-muted)]"
                )}
              >
                {isOffice
                  ? <Building2 className="w-3.5 h-3.5" />
                  : ((direction === "MORNING" ? stop.morning_sequence : stop.evening_sequence) ?? idx + 1)}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5 flex-wrap">
                  {stop.name}
                  {isOffice && (
                    <>
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                        Office
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        {direction === "MORNING" ? "AM last" : "PM first"}
                      </span>
                    </>
                  )}
                </div>
                {eta && (
                  <div className="text-xs text-[var(--text-muted)]">
                    {isOffice
                      ? (direction === "MORNING" ? "Arrival" : "Departure")
                      : (direction === "MORNING" ? t("pickup") : t("dropoff"))}
                    : {eta}
                  </div>
                )}
                {isOffice && (
                  <div className="text-[10px] text-red-600/80 mt-0.5">Employees cannot be assigned here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RouteDetailPage() {
  const params = useParams();
  const t = useTranslations("company.routes");
  const tCommon = useTranslations("common");
  const dispatch = useAppDispatch();
  const company = useAppSelector(selectCompany);
  const features = useAppSelector(selectCompanyFeatures);
  const allEmployees = useAppSelector(selectEmployees);
  const employeeStatus = useAppSelector(selectEmployeesStatus);
  const { user } = useAuth();
  const isTrialUser = !!user?.is_trial;
  const routeId = params.id ? +params.id : null;

  const canManageShuttle = isTrialUser
    || (features.find((f) => f.feature_key === "shuttle_self_managed")?.is_enabled ?? false);

  useEffect(() => {
    if (company?.id) dispatch(fetchCompanyFeatures(Number(company.id)));
  }, [company?.id, dispatch]);

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
      toast.error("Please select which office this employee is assigned to");
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

  if (!company) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-[var(--text-muted)]">{tCommon("errors.noCompanySelected")}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex items-center gap-3">
        <Link href="/company/routes">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("backToRoutes")}
          </Button>
        </Link>
      </div>

      {loading ? (
        <Card className="py-16 text-center">
          <RefreshCw className="w-5 h-5 mx-auto mb-3 animate-spin text-[var(--text-muted)]" />
          <div className="text-sm text-[var(--text-muted)]">{t("loadingRoute")}</div>
        </Card>
      ) : error ? (
        <Card className="py-12 text-center">
          <div className="text-sm text-red-500">{error}</div>
        </Card>
      ) : !route ? (
        <Card className="py-12 text-center">
          <div className="text-sm text-[var(--text-muted)]">{t("routeNotFound")}</div>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {t("routeDetailLabel")}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-3">
                <Bus className="w-7 h-7 text-[var(--cort-orange)]" />
                {route.name}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManageShuttle && (
                <>
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={generatingTrips}
                    onClick={handleGenerateTrips}
                  >
                    {generatingTrips ? t("generatingTrips") : t("generateTrips")}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={optimizing}
                    onClick={handleOptimizeRoute}
                  >
                    <Sparkles className="w-4 h-4" />
                    {optimizing ? t("optimizingRoute") : t("optimizeRoute")}
                  </Button>
                  <Button
                    variant="default"
                    className="gap-2 bg-[var(--cort-orange)] hover:bg-[var(--cort-orange-hover)] text-white"
                    onClick={() => setShowAssignModal(true)}
                  >
                    <UserPlus className="w-4 h-4" />
                    {t("assignEmployee")}
                  </Button>
                </>
              )}
              <Link href={`/company/routes/${routeId}/track`}>
                <Button variant="outline" className="gap-2">
                  <Activity className="w-4 h-4" />
                  {t("trackLive")}
                </Button>
              </Link>
            </div>
          </div>

          {canManageShuttle && (
            <div className="flex gap-2 border-b border-[var(--border-light)]">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={cx(
                  "px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
                  activeTab === "overview"
                    ? "border-[var(--cort-orange)] text-[var(--cort-orange)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                {t("overviewTab")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("stops")}
                className={cx(
                  "px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5",
                  activeTab === "stops"
                    ? "border-[var(--cort-orange)] text-[var(--cort-orange)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                <ListOrdered className="w-4 h-4" />
                {t("manageStops")}
              </button>
            </div>
          )}

          {activeTab === "stops" && canManageShuttle ? (
            <RouteStopsEditor routeId={route.id} stops={stops} onUpdated={load} />
          ) : (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: t("passengers"),
                value: employees.length,
                icon: <Users className="w-4 h-4" />,
                color: "text-[var(--cort-orange)]",
              },
              {
                label: t("stops"),
                value: stops.filter((s) => s.morning_sequence != null).length,
                icon: <MapPin className="w-4 h-4" />,
                color: "text-emerald-400",
              },
              {
                label: t("vehicle"),
                value: vehicle?.plate_number ?? "—",
                icon: <Car className="w-4 h-4" />,
                color: "text-blue-400",
              },
              {
                label: utilizationPct !== null ? t("utilization", { count: `${employees.length}/${capacity}` }) : t("driver"),
                value: utilizationPct !== null ? `${utilizationPct}%` : (driver?.full_name ?? t("unassigned")),
                icon: <User className="w-4 h-4" />,
                color: utilizationPct !== null && utilizationPct > 85 ? "text-red-400" : "text-purple-400",
              },
            ].map((stat) => (
              <Card key={stat.label} className="!p-4 flex items-center gap-3">
                <div className={cx("p-2 rounded-xl bg-[var(--bg-subtle)]", stat.color)}>{stat.icon}</div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {stat.label}
                  </div>
                  <div className="text-lg font-bold text-[var(--text-primary)] truncate">{stat.value}</div>
                </div>
              </Card>
            ))}
          </div>

          <RouteOverviewMap routeId={route.id} stops={stops} refreshKey={mapRefreshKey} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Employees */}
            <div className="lg:col-span-2">
              <Card className="!p-0 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)]">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[var(--cort-orange)]" />
                    <span className="font-semibold text-[var(--text-primary)]">
                      {t("passengersOnThisRoute")}
                    </span>
                    <span className="rounded-full bg-[var(--cort-orange)]/10 px-2 py-0.5 text-xs font-bold text-[var(--cort-orange)]">
                      {employees.length}
                    </span>
                  </div>
                  {capacity && (
                    <div className="text-xs text-[var(--text-muted)]">
                      {t("capacity", { current: employees.length, max: capacity })}
                      <div className="mt-1 h-1.5 w-20 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                        <div
                          className={cx(
                            "h-full rounded-full transition-all",
                            utilizationPct! > 85 ? "bg-red-500" : utilizationPct! > 60 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${utilizationPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {employees.length === 0 ? (
                  <div className="py-16 text-center">
                    <Users className="w-8 h-8 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
                    <div className="text-sm text-[var(--text-muted)]">{t("noEmployeesAssigned")}</div>
                    {canManageShuttle && (
                      <Button
                        variant="outline"
                        className="mt-4 gap-2"
                        onClick={() => setShowAssignModal(true)}
                      >
                        <UserPlus className="w-4 h-4" />
                        {t("assignAnEmployee")}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-light)]">
                    {employees.map((assignment) => {
                      const emp = assignment.users;
                      const pickupStop = assignment.route_stops;
                      return (
                        <div
                          key={assignment.user_id}
                          className="flex items-center gap-4 px-6 py-3.5 hover:bg-[var(--bg-subtle)] transition-colors"
                        >
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-[var(--cort-orange)]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-[var(--cort-orange)]">
                              {emp?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-[var(--text-primary)] truncate">
                              {emp?.full_name ?? tCommon("status.unknown")}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                              {emp?.department && (
                                <span className="text-xs text-[var(--text-muted)]">{emp.department}</span>
                              )}
                              {emp?.phone && (
                                <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                  <Phone className="w-2.5 h-2.5" />
                                  {emp.phone}
                                </span>
                              )}
                              {emp?.email && (
                                <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                                  <Mail className="w-2.5 h-2.5 flex-shrink-0" />
                                  {emp.email}
                                </span>
                              )}
                            </div>
                          </div>

                          {pickupStop && (
                            <div className="flex items-center gap-1.5 flex-shrink-0 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                              <MapPin className="w-3 h-3 text-[var(--cort-orange)]" />
                              <span className="font-medium">{pickupStop.name}</span>
                            </div>
                          )}

                          {hasMultipleOffices && assignment.office_route_stops && (
                            <div className="flex items-center gap-1.5 flex-shrink-0 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700">
                              <Building2 className="w-3 h-3" />
                              <span className="font-medium">{assignment.office_route_stops.name}</span>
                            </div>
                          )}

                          {canManageShuttle && emp?.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 h-8 text-red-500 border-red-200 hover:bg-red-50"
                              disabled={removingUserId === emp.id}
                              onClick={() => handleRemoveEmployee(emp.id)}
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              {removingUserId === emp.id ? t("removingEmployee") : t("removeEmployee")}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Right: Route info */}
            <div className="flex flex-col gap-4">
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
                <Card className="!p-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                    {t("vehicleAndDriver")}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-[var(--bg-subtle)] text-blue-400">
                        <Car className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">{t("vehicle")}</div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {vehicle ? `${vehicle.plate_number}${vehicle.model ? ` · ${vehicle.model}` : ""}` : t("notAssigned")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-[var(--bg-subtle)] text-purple-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">{t("driver")}</div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {driver?.full_name ?? t("notAssigned")}
                        </div>
                        {driver?.phone && (
                          <div className="text-xs text-[var(--text-muted)]">{driver.phone}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {canManageShuttle && (
                <Button
                  variant="outline"
                  className="gap-2 w-full"
                  onClick={() => setActiveTab("stops")}
                >
                  <ListOrdered className="w-4 h-4" />
                  {t("manageStops")}
                </Button>
              )}

              {/* Morning stops */}
              <Card className="!p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sunrise className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                    {t("morningRoute")}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {t("stopsCountParen", { count: stops.filter((s) => s.morning_sequence != null).length })}
                  </span>
                </div>
                <StopTimeline stops={stops} direction="MORNING" />
              </Card>

              {/* Evening stops */}
              <Card className="!p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sunset className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                    {t("eveningRoute")}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {t("stopsCountParen", { count: stops.filter((s) => s.evening_sequence != null).length })}
                  </span>
                </div>
                <StopTimeline stops={stops} direction="EVENING" />
              </Card>
            </div>
          </div>
          </>
          )}
        </>
      )}

      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={t("assignEmployeeTitle")}
        panelClassName="!max-w-md"
      >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                    {t("selectEmployee")}
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--cort-orange)] focus:ring-1 focus:ring-[var(--cort-orange)] outline-none transition-all"
                  >
                    <option value="">{t("chooseEmployee")}</option>
                    {allEmployees
                      .filter((emp) => !employees.some((assigned) => assigned.users?.id === emp.id))
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name}{emp.department ? ` (${emp.department})` : ""}
                        </option>
                      ))}
                  </select>
                  {allEmployees.length === 0 && employeeStatus !== "loading" && (
                    <p className="text-xs text-amber-500 mt-1">{t("noCompanyEmployees")}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                    {t("pickupStop")}{" "}
                    <span className="text-[var(--text-muted)] font-normal">{t("pickupStopOptional")}</span>
                  </label>
                  <select
                    value={selectedStopId}
                    onChange={(e) => setSelectedStopId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full h-10 rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--cort-orange)] focus:ring-1 focus:ring-[var(--cort-orange)] outline-none transition-all"
                  >
                    <option value="">{t("noneAutomatic")}</option>
                    {pickupStops.map((stop) => (
                      <option key={stop.id} value={stop.id}>
                        {stop.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Office stop is excluded — employees board at pickups only.
                  </p>
                </div>

                {hasMultipleOffices && (
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                      Office
                    </label>
                    <select
                      value={selectedOfficeStopId}
                      onChange={(e) => setSelectedOfficeStopId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full h-10 rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--cort-orange)] focus:ring-1 focus:ring-[var(--cort-orange)] outline-none transition-all"
                    >
                      <option value="">Select office</option>
                      {officeStopsList.map((stop) => (
                        <option key={stop.id} value={stop.id}>
                          {stop.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      This route has multiple offices — choose which one this employee is assigned to.
                    </p>
                  </div>
                )}
                <div className="pt-2 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowAssignModal(false)}>
                    {tCommon("actions.cancel")}
                  </Button>
                  <Button
                    disabled={!selectedUserId || assigning}
                    onClick={handleAssignEmployee}
                    className="bg-[var(--cort-orange)] hover:bg-[var(--cort-orange-hover)] text-white"
                  >
                    {assigning ? t("assigningEmployee") : t("confirmAssignment")}
                  </Button>
                </div>
              </div>
      </Modal>
    </div>
  );
}
