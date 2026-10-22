"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/app/lib/store/hooks";
import { selectCompany, fetchCompanyFeatures, selectCompanyFeatures } from "@/app/lib/store/slices/companySlice";
import { fetchEmployees, selectEmployees, selectEmployeesStatus } from "@/app/lib/store/slices/employeeSlice";
import { useAuth } from "@/app/lib/contexts/auth-context";
import { apiClient } from "@/app/lib/services/api-client";
import { useConfirm } from "@/app/lib/hooks/useConfirm";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  Field,
  KpiCard,
  KpiGrid,
  PageHeader,
  PageSkeleton,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useFormatters,
  usePageBreadcrumbs,
  type DataTableColumn,
} from "@/app/ui";
import { Activity, Building2, Car, ListOrdered, MapPin, Settings2, Sparkles, Sunrise, Sunset, User, UserMinus, UserPlus, Users } from "lucide-react";
import { RouteDetailsEditor } from "../components/RouteDetailsEditor";
import { RouteStopsEditor } from "../components/RouteStopsEditor";
import { RouteOverviewMap } from "../components/RouteOverviewMap";
import { getOfficeStops } from "@/app/lib/utils/routeStops";
import { useCompanyBasePath } from "../../lib/use-company-base-path";
import { stopsForDirection, type CompanyRouteStop, type RouteDirection } from "../lib/route-types";

// ─── Types ───────────────────────────────────────────────────────────────────

type EmployeeAssignment = {
  user_id: string;
  route_id?: number | null;
  pickup_stop_id?: number | null;
  office_stop_id?: number | null;
  users?: { id: string; full_name: string; email: string; phone: string; department?: string | null } | null;
  route_stops?: { id: number; name: string; sequence_order: number } | null;
  /** The assigned office stop — populated when the route has multiple OFFICE-type stops. */
  office_route_stops?: { id?: number; name: string } | null;
};

type RouteDetail = {
  id: number;
  name: string;
  company_id: number | null;
  assigned_vehicle_id?: number | null;
  assigned_driver_id?: string | null;
  vehicles?: { id?: number; plate_number: string; model: string | null; capacity?: number | null; seat_capacity?: number | null } | null;
  users?: { id: string; full_name: string; phone: string } | null;
  route_stops: CompanyRouteStop[];
  employee_route_assignments?: EmployeeAssignment[];
};

type TabKey = "overview" | "details" | "stops" | "employees";

// ─── Stop timeline ───────────────────────────────────────────────────────────

function StopTimeline({ stops, direction }: { stops: CompanyRouteStop[]; direction: RouteDirection }) {
  const t = useTranslations("company.routes");
  const { formatTime } = useFormatters();
  const officeStopIds = new Set(getOfficeStops(stops).map((s) => s.id));
  const sorted = stopsForDirection(stops, direction);

  if (sorted.length === 0) return <p className="text-xs italic text-fg-muted">{t("noStopsConfigured")}</p>;

  return (
    <ol className="relative space-y-3">
      <span aria-hidden="true" className="absolute bottom-4 start-3.5 top-4 w-px bg-line" />
      {sorted.map((stop, idx) => {
        const eta = direction === "MORNING" ? stop.morning_eta : stop.evening_eta;
        const isOffice = officeStopIds.has(stop.id);
        return (
          <li key={stop.id} className="flex items-start gap-3">
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                isOffice ? "border-brand bg-brand text-white" : "border-line bg-card text-fg-muted",
              )}
              aria-hidden="true"
            >
              {isOffice ? <Building2 className="size-3.5" /> : ((direction === "MORNING" ? stop.morning_sequence : stop.evening_sequence) ?? idx + 1)}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-fg">
                {stop.name}
                {isOffice && (
                  <>
                    <Badge tone="brand" size="sm">
                      {t("office")}
                    </Badge>
                    <Badge tone="neutral" size="sm">
                      {direction === "MORNING" ? t("officeAmLast") : t("officePmFirst")}
                    </Badge>
                  </>
                )}
              </p>
              {eta && (
                <p className="text-xs text-fg-muted">
                  {isOffice ? (direction === "MORNING" ? t("arrival") : t("departure")) : direction === "MORNING" ? t("pickup") : t("dropoff")}: {formatTime(eta)}
                </p>
              )}
              {isOffice && <p className="mt-0.5 text-[11px] text-fg-muted">{t("officeNoAssignment")}</p>}
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
  const { companyPath } = useCompanyBasePath();
  const confirm = useConfirm();
  const dispatch = useAppDispatch();
  const company = useAppSelector(selectCompany);
  const features = useAppSelector(selectCompanyFeatures);
  const allEmployees = useAppSelector(selectEmployees);
  const employeeStatus = useAppSelector(selectEmployeesStatus);
  const { user } = useAuth();
  const isTrialUser = !!user?.is_trial;
  const routeId = params.id ? +params.id : null;

  const canManageShuttle = isTrialUser || (features.find((f) => f.feature_key === "shuttle_self_managed")?.is_enabled ?? false);

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
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [selectedOfficeStopId, setSelectedOfficeStopId] = useState("");

  usePageBreadcrumbs(route ? [{ label: route.name }] : null);

  useEffect(() => {
    if (company?.id && employeeStatus === "idle") dispatch(fetchEmployees(company.id.toString()));
  }, [company?.id, employeeStatus, dispatch]);

  // `loading` means the initial load; reloads after mutations (`load()`) keep the page in place.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!routeId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.request<RouteDetail>(`/routes/${routeId}`);
        if (cancelled) return;
        setRoute(data);
        setError(null);
        setMapRefreshKey((k) => k + 1);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : tCommon("errors.failedToLoadRoute"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId, tCommon, reloadKey]);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  async function handleGenerateTrips() {
    if (!routeId) return;
    const ok = await confirm({
      title: t("confirmGenerate.title"),
      message: t("confirmGenerate.message"),
      consequences: [t("confirmGenerate.consequence1"), t("confirmGenerate.consequence2")],
      confirmLabel: t("generateTrips"),
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: t("confirmOptimize.title"),
      message: t("confirmOptimize.message"),
      consequences: [t("confirmOptimize.consequence1"), t("confirmOptimize.consequence2")],
      confirmLabel: t("optimizeRoute"),
    });
    if (!ok) return;
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

  async function handleRemoveEmployee(assignment: EmployeeAssignment) {
    const emp = assignment.users;
    if (!emp?.id) return;
    const ok = await confirm({
      title: t("confirmRemoveEmployee.title", { name: emp.full_name }),
      message: t("confirmRemoveEmployee.message"),
      consequences: [t("confirmRemoveEmployee.consequence1"), t("confirmRemoveEmployee.consequence2")],
      destructive: true,
      confirmLabel: t("removeEmployee"),
    });
    if (!ok) return;
    setRemovingUserId(emp.id);
    try {
      await apiClient.removeEmployeeFromRoute(emp.id);
      toast.success(t("employeeRemovedSuccess"));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedRemoveEmployee"));
    } finally {
      setRemovingUserId(null);
    }
  }

  const employees = useMemo(() => route?.employee_route_assignments ?? [], [route]);
  const stops = useMemo(() => route?.route_stops ?? [], [route]);
  // A route may have multiple OFFICE-type stops (multi-office shuttle support). Not assignable as pickup.
  const officeStopsList = useMemo(() => getOfficeStops(stops), [stops]);
  const officeStopIds = useMemo(() => new Set(officeStopsList.map((s) => s.id)), [officeStopsList]);
  const hasMultipleOffices = officeStopsList.length > 1;
  const pickupStops = useMemo(() => stops.filter((s) => !officeStopIds.has(s.id)), [stops, officeStopIds]);
  const vehicle = route?.vehicles ?? null;
  const driver = route?.users ?? null;
  const capacity = vehicle?.capacity ?? vehicle?.seat_capacity ?? null;
  const utilizationPct = capacity ? Math.min(100, Math.round((employees.length / capacity) * 100)) : null;

  async function handleAssignEmployee(e: React.FormEvent) {
    e.preventDefault();
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

  const employeeColumns = useMemo<DataTableColumn<EmployeeAssignment>[]>(
    () => [
      {
        key: "name",
        header: t("passengers"),
        cell: (a) => (
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink" aria-hidden="true">
              {a.users?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-fg">{a.users?.full_name ?? tCommon("status.unknown")}</p>
              {a.users?.department && <p className="truncate text-xs text-fg-muted">{a.users.department}</p>}
            </div>
          </div>
        ),
      },
      {
        key: "contact",
        header: t("contact"),
        hideBelow: "md",
        cell: (a) => (
          <div className="text-xs text-fg-secondary">
            {a.users?.email && (
              <p className="truncate" dir="ltr">
                {a.users.email}
              </p>
            )}
            {a.users?.phone && (
              <p className="text-fg-muted" dir="ltr">
                {a.users.phone}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "pickup",
        header: t("pickupStop"),
        cell: (a) =>
          a.route_stops ? (
            <Badge tone="neutral" size="sm" icon={<MapPin aria-hidden="true" />}>
              {a.route_stops.name}
            </Badge>
          ) : (
            <span className="text-fg-muted">—</span>
          ),
      },
      ...(hasMultipleOffices
        ? [
            {
              key: "office",
              header: t("office"),
              cell: (a: EmployeeAssignment) =>
                a.office_route_stops ? (
                  <Badge tone="brand" size="sm" icon={<Building2 aria-hidden="true" />}>
                    {a.office_route_stops.name}
                  </Badge>
                ) : (
                  <span className="text-fg-muted">—</span>
                ),
            } satisfies DataTableColumn<EmployeeAssignment>,
          ]
        : []),
    ],
    [t, tCommon, hasMultipleOffices],
  );

  if (!company) return <EmptyState title={tCommon("errors.noCompanySelected")} />;
  if (loading && !route) return <PageSkeleton />;
  if (error) {
    return (
      <Card>
        <ErrorState
          title={tCommon("errors.failedToLoadRoute")}
          message={error}
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      </Card>
    );
  }
  if (!route) {
    return (
      <Card>
        <EmptyState title={t("routeNotFound")} />
      </Card>
    );
  }

  const assignButton = (
    <Button onClick={() => setShowAssignModal(true)} leftIcon={<UserPlus />}>
      {t("assignEmployee")}
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: companyPath("/company/routes"), label: t("backToRoutes") }}
        title={route.name}
        description={t("routeNumber", { id: route.id })}
        actions={
          <>
            {canManageShuttle && (
              <>
                <Button variant="outline" onClick={() => void handleGenerateTrips()} loading={generatingTrips}>
                  {t("generateTrips")}
                </Button>
                <Button variant="outline" onClick={() => void handleOptimizeRoute()} loading={optimizing} leftIcon={<Sparkles />}>
                  {t("optimizeRoute")}
                </Button>
                {assignButton}
              </>
            )}
            <Button asChild variant={canManageShuttle ? "outline" : "primary"}>
              <Link href={companyPath(`/company/routes/${route.id}/track`)}>
                <Activity aria-hidden="true" />
                {t("trackLive")}
              </Link>
            </Button>
          </>
        }
        tabs={
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
            <TabsList aria-label={t("routeDetails")}>
              <TabsTrigger value="overview" icon={<MapPin />}>
                {t("overviewTab")}
              </TabsTrigger>
              <TabsTrigger value="details" icon={<Settings2 />}>
                {t("vehicleAndDriver")}
              </TabsTrigger>
              {canManageShuttle && (
                <TabsTrigger value="stops" icon={<ListOrdered />} count={stops.length}>
                  {t("manageStops")}
                </TabsTrigger>
              )}
              <TabsTrigger value="employees" icon={<Users />} count={employees.length}>
                {t("passengers")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsContent value="overview" className="mt-0 space-y-6">
          <KpiGrid cols={4}>
            <KpiCard label={t("passengers")} value={employees.length} icon={<Users />} tone="brand" />
            <KpiCard label={t("stops")} value={stops.filter((s) => s.morning_sequence != null).length} icon={<MapPin />} tone="success" />
            <KpiCard label={t("vehicle")} value={vehicle?.plate_number ?? "—"} icon={<Car />} tone="info" hint={vehicle?.model ?? undefined} />
            {utilizationPct !== null ? (
              <KpiCard label={t("utilization", { count: `${employees.length}/${capacity}` })} value={`${utilizationPct}%`} icon={<User />} tone={utilizationPct > 85 ? "danger" : "purple"} />
            ) : (
              <KpiCard label={t("driver")} value={driver?.full_name ?? t("unassigned")} icon={<User />} tone="purple" />
            )}
          </KpiGrid>

          <RouteOverviewMap routeId={route.id} stops={stops} refreshKey={mapRefreshKey} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(
              [
                { dir: "MORNING", label: t("morningRoute"), Icon: Sunrise, key: "morning_sequence" },
                { dir: "EVENING", label: t("eveningRoute"), Icon: Sunset, key: "evening_sequence" },
              ] as const
            ).map(({ dir, label, Icon, key }) => (
              <Card key={dir}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Icon className="size-4 text-fg-muted" aria-hidden="true" />
                      {label}
                    </span>
                  }
                  description={t("stopsCount", { count: stops.filter((s) => s[key] != null).length })}
                />
                <CardContent>
                  <StopTimeline stops={stops} direction={dir} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-0">
          <div className="max-w-xl">
            <RouteDetailsEditor
              routeId={route.id}
              companyId={Number(company.id)}
              name={route.name}
              vehicle={vehicle}
              driver={driver}
              assignedVehicleId={route.assigned_vehicle_id}
              assignedDriverId={route.assigned_driver_id}
              canEdit={canManageShuttle}
              onUpdated={load}
            />
          </div>
        </TabsContent>

        {canManageShuttle && (
          <TabsContent value="stops" className="mt-0">
            <RouteStopsEditor routeId={route.id} stops={stops} onUpdated={load} />
          </TabsContent>
        )}

        <TabsContent value="employees" className="mt-0">
          <Card>
            <CardHeader
              title={t("passengersOnThisRoute")}
              description={capacity ? t("capacity", { current: employees.length, max: capacity }) : undefined}
              actions={canManageShuttle ? assignButton : undefined}
            >
              {capacity && utilizationPct !== null && (
                <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={utilizationPct} aria-valuemin={0} aria-valuemax={100}>
                  <div className={cn("h-full rounded-full", utilizationPct > 85 ? "bg-danger" : utilizationPct > 60 ? "bg-warning" : "bg-success")} style={{ width: `${utilizationPct}%` }} />
                </div>
              )}
            </CardHeader>
            <DataTable<EmployeeAssignment>
              columns={employeeColumns}
              rows={employees}
              rowKey={(a) => a.user_id}
              loading={loading}
              empty={{
                icon: <Users aria-hidden="true" />,
                title: t("noEmployeesAssigned"),
                description: canManageShuttle ? undefined : t("contactOperations"),
                action: canManageShuttle ? (
                  <Button variant="outline" onClick={() => setShowAssignModal(true)} leftIcon={<UserPlus />}>
                    {t("assignAnEmployee")}
                  </Button>
                ) : undefined,
              }}
              rowActions={
                canManageShuttle
                  ? (a) => [
                      {
                        label: t("removeEmployee"),
                        icon: <UserMinus />,
                        destructive: true,
                        disabled: removingUserId === a.users?.id,
                        onSelect: () => void handleRemoveEmployee(a),
                      },
                    ]
                  : undefined
              }
            />
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAssignModal} onOpenChange={(open) => !assigning && setShowAssignModal(open)}>
        <DialogContent
          size="sm"
          title={t("assignEmployeeTitle")}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowAssignModal(false)} disabled={assigning}>
                {tCommon("actions.cancel")}
              </Button>
              <Button type="submit" form="assign-employee-form" disabled={!selectedUserId} loading={assigning}>
                {t("confirmAssignment")}
              </Button>
            </>
          }
        >
          <form id="assign-employee-form" onSubmit={handleAssignEmployee} className="space-y-4">
            <Field label={t("selectEmployee")} required hint={allEmployees.length === 0 && employeeStatus !== "loading" ? t("noCompanyEmployees") : undefined}>
              <Select placeholder={t("chooseEmployee")} value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                {allEmployees
                  .filter((emp) => !employees.some((assigned) => assigned.users?.id === emp.id))
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                      {emp.department ? ` (${emp.department})` : ""}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={`${t("pickupStop")} ${t("pickupStopOptional")}`} hint={t("officeExcludedHint")}>
              <Select placeholder={t("noneAutomatic")} value={selectedStopId} onChange={(e) => setSelectedStopId(e.target.value)}>
                {pickupStops.map((stop) => (
                  <option key={stop.id} value={stop.id}>
                    {stop.name}
                  </option>
                ))}
              </Select>
            </Field>
            {hasMultipleOffices && (
              <Field label={t("office")} required hint={t("multipleOfficesHint")}>
                <Select placeholder={t("selectOffice")} value={selectedOfficeStopId} onChange={(e) => setSelectedOfficeStopId(e.target.value)}>
                  {officeStopsList.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
