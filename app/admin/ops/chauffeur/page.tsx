"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Car, Clock, MapPin, Navigation, PanelRightOpen, Phone, RefreshCw, User, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/app/admin/components/PermissionGate";
import { AdminCan } from "@/app/lib/abilities/AdminAbilityProvider";
import { apiClient } from "@/app/lib/services/api-client";
import type { MapMarker } from "@/app/admin/ui/Map";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Drawer,
  DrawerContent,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Skeleton,
  StatusBadge,
  focusRing,
  statusTone,
  useChartTheme,
  type StatusEntry,
} from "@/app/admin/ui";
import { formatRelative, formatTime } from "@/app/admin/lib/format";

const Map = dynamic(() => import("@/app/admin/ui/Map"), { ssr: false });

// ---- Types ------------------------------------------------------------------

type ActiveBooking = {
  id: number;
  status: string;
  scheduled_for: string;
  trip_type: string;
  package_selected: string;
  vehicle_model: string | null;
  pickup_address: string | null;
  driver_id: string | null;
  company_name: string | null;
  passenger_name: string | null;
  passenger_phone: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  plate_number: string | null;
  vehicle_make: string | null;
  vehicle_model_name: string | null;
  vehicle_color: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_online: boolean | null;
  driver_location_updated_at: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
};

// ---- Helpers ----------------------------------------------------------------

const ACTIVE_STATUSES = ["ASSIGNED", "OTW", "ARRIVED", "IN_PROGRESS", "DROPPED_OFF"] as const;

/** Chauffeur booking keys the shared registry doesn't know. */
const CHAUFFEUR_STATUS_OVERRIDES: Record<string, StatusEntry> = {
  OTW: { tone: "info", label: "On the way" },
  ARRIVED: { tone: "warning", label: "Driver arrived" },
  DROPPED_OFF: { tone: "purple", label: "Dropped off" },
};

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Assigned",
  OTW: "On the way",
  ARRIVED: "Driver arrived",
  IN_PROGRESS: "In progress",
  DROPPED_OFF: "Dropped off",
};

const POLL_MS = 15_000;

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const inner = (data as { data?: unknown } | null)?.data;
  return Array.isArray(inner) ? (inner as T[]) : [];
}

// ---- Component --------------------------------------------------------------

export default function OpsChauffeurPage() {
  return (
    <PermissionGate permission="ops_chauffeur">
      <AdminCan I="read" a="OpsChauffeur">
        <OpsChauffeurContent />
      </AdminCan>
    </PermissionGate>
  );
}

function OpsChauffeurContent() {
  const chart = useChartTheme();
  const [bookings, setBookings] = useState<ActiveBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedBooking = useMemo(() => bookings.find((b) => b.id === selectedId) ?? null, [bookings, selectedId]);

  // ---- Data fetching -------------------------------------------------------

  const applyBookings = useCallback((list: ActiveBooking[]) => {
    setBookings(list);
    setLastRefresh(Date.now());
    setError(null);
    // Keep the current selection if it still exists after refresh.
    // If not, fall back to the first booking (or clear selection if empty).
    setSelectedId((prev) => {
      if (list.length === 0) return null;
      if (prev == null) return list[0].id;
      return list.some((b) => b.id === prev) ? prev : list[0].id;
    });
  }, []);

  /** Poll / manual refresh fetch. */
  const fetchBookings = useCallback(async () => {
    try {
      const data = await apiClient.request<ActiveBooking[]>("/admin/bookings/active-locations");
      applyBookings(unwrapList<ActiveBooking>(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [applyBookings]);

  const refresh = useCallback(() => {
    setLoading(true);
    void fetchBookings();
  }, [fetchBookings]);

  // Initial load + 15 s poll, paused while the tab is hidden.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.request<ActiveBooking[]>("/admin/bookings/active-locations");
        if (!cancelled) applyBookings(unwrapList<ActiveBooking>(data));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load bookings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const start = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => void fetchBookings(), POLL_MS);
    };
    const stop = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        void fetchBookings();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchBookings, applyBookings]);

  // ---- Map data -----------------------------------------------------------

  const markerColors = useMemo(() => ({ selectedDriver: chart.colors[0], otherDriver: chart.colors[1], pickup: chart.colors[2] }), [chart]);

  const mapMarkers = useMemo((): MapMarker[] => {
    const markers: MapMarker[] = [];

    bookings.forEach((b) => {
      const isSelected = b.id === selectedId;

      // Driver marker
      if (b.driver_lat != null && b.driver_lng != null) {
        markers.push({
          id: `driver-${b.id}`,
          type: "chauffeur",
          position: [b.driver_lat, b.driver_lng],
          label: `${b.driver_name ?? "Driver"} · ${b.plate_number ?? "—"}\n${STATUS_LABELS[b.status] ?? b.status}`,
          color: isSelected ? markerColors.selectedDriver : markerColors.otherDriver,
        });
      }

      // Pickup marker (only for selected booking)
      if (isSelected && b.pickup_lat != null && b.pickup_lng != null) {
        markers.push({
          id: "pickup",
          position: [b.pickup_lat, b.pickup_lng],
          label: b.pickup_address ?? "Pickup",
          color: markerColors.pickup,
        });
      }
    });

    return markers;
  }, [bookings, selectedId, markerColors]);

  const mapCenter = useMemo((): [number, number] => {
    if (selectedBooking?.driver_lat && selectedBooking?.driver_lng) {
      return [selectedBooking.driver_lat, selectedBooking.driver_lng];
    }
    if (selectedBooking?.pickup_lat && selectedBooking?.pickup_lng) {
      return [selectedBooking.pickup_lat, selectedBooking.pickup_lng];
    }
    return [24.8607, 67.0011]; // Karachi default
  }, [selectedBooking]);

  // ---- Render -------------------------------------------------------------

  const detail = selectedBooking && (
    <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
      <div>
        <dt className="mb-0.5 text-xs text-fg-muted">Passenger</dt>
        <dd className="truncate font-medium text-fg">{selectedBooking.passenger_name ?? "—"}</dd>
        {selectedBooking.passenger_phone && (
          <a href={`tel:${selectedBooking.passenger_phone}`} className={cn("mt-0.5 flex items-center gap-1 rounded text-xs text-brand-ink hover:underline", focusRing)}>
            <Phone className="size-3" aria-hidden="true" />
            {selectedBooking.passenger_phone}
          </a>
        )}
      </div>
      <div>
        <dt className="mb-0.5 text-xs text-fg-muted">Driver</dt>
        <dd className="truncate font-medium text-fg">{selectedBooking.driver_name ?? "Unassigned"}</dd>
        {selectedBooking.driver_phone && (
          <a href={`tel:${selectedBooking.driver_phone}`} className={cn("mt-0.5 flex items-center gap-1 rounded text-xs text-brand-ink hover:underline", focusRing)}>
            <Phone className="size-3" aria-hidden="true" />
            {selectedBooking.driver_phone}
          </a>
        )}
      </div>
      <div>
        <dt className="mb-0.5 text-xs text-fg-muted">Vehicle</dt>
        <dd className="font-medium text-fg">
          {[selectedBooking.vehicle_make, selectedBooking.vehicle_model_name].filter(Boolean).join(" ") || selectedBooking.vehicle_model || "—"}
        </dd>
        <p className="font-mono text-xs text-fg-muted">
          {selectedBooking.plate_number ?? "—"}
          {selectedBooking.vehicle_color ? ` · ${selectedBooking.vehicle_color}` : ""}
        </p>
      </div>
      <div>
        <dt className="mb-0.5 text-xs text-fg-muted">Driver location</dt>
        {selectedBooking.driver_lat != null ? (
          <>
            <dd className="flex items-center gap-1 font-medium text-fg">
              <Navigation className="size-3.5 text-brand-ink" aria-hidden="true" />
              Live
            </dd>
            <p className="flex items-center gap-1 text-xs text-fg-muted">
              <Clock className="size-3" aria-hidden="true" />
              {formatRelative(selectedBooking.driver_location_updated_at)}
            </p>
          </>
        ) : (
          <dd className="text-xs text-fg-muted">Not available</dd>
        )}
      </div>
      {selectedBooking.pickup_address && (
        <div className="col-span-2 flex items-start gap-2 border-t border-line pt-3 text-xs text-fg-secondary sm:col-span-4">
          <MapPin className="mt-0.5 size-3.5 shrink-0" style={{ color: markerColors.pickup }} aria-hidden="true" />
          <span>{selectedBooking.pickup_address}</span>
        </div>
      )}
    </dl>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live: Chauffeur"
        description="Active chauffeur bookings with the latest driver positions."
        meta={
          <>
            <Badge tone="success" dot>
              Live · refreshes every 15 s
            </Badge>
            {lastRefresh && <span className="text-xs text-fg-muted">Updated {formatRelative(lastRefresh)}</span>}
          </>
        }
        actions={
          <IconButton label="Refresh bookings" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : undefined} />
          </IconButton>
        }
      />

      {error && bookings.length === 0 && !loading ? (
        <ErrorState title="Couldn't load active bookings" message={error} onRetry={refresh} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Booking list */}
          <div className="flex flex-col gap-3 lg:col-span-1 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
            <div className="flex shrink-0 flex-wrap gap-1.5" aria-label="Bookings by status">
              {ACTIVE_STATUSES.map((s) => {
                const count = bookings.filter((b) => b.status === s).length;
                return (
                  <Badge key={s} tone={statusTone(s, CHAUFFEUR_STATUS_OVERRIDES)} size="sm">
                    <span className="tabular-nums">{count}</span> {STATUS_LABELS[s]}
                  </Badge>
                );
              })}
            </div>

            {error && <ErrorState compact message={error} onRetry={refresh} />}

            {loading &&
              bookings.length === 0 &&
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} padding="md" className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </Card>
              ))}

            {!loading && bookings.length === 0 && !error && (
              <Card>
                <EmptyState compact icon={<Car aria-hidden="true" />} title="No active chauffeur bookings" description="Bookings appear here as soon as a driver is assigned." />
              </Card>
            )}

            {bookings.map((b) => {
              const isSelected = selectedId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedId(b.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "w-full cursor-pointer rounded-xl border p-4 text-left transition-colors",
                    isSelected ? "border-brand-line bg-brand-soft/60" : "border-line bg-card hover:border-line-strong",
                    focusRing,
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">{b.company_name ?? "—"}</p>
                      <p className="mt-0.5 text-xs text-fg-muted">
                        <span className="font-mono">#{b.id}</span> · {formatTime(b.scheduled_for)}
                      </p>
                    </div>
                    <StatusBadge status={b.status} size="sm" overrides={CHAUFFEUR_STATUS_OVERRIDES} />
                  </div>

                  <div className="mb-1.5 flex items-center gap-2 text-xs text-fg-secondary">
                    <User className="size-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                    <span className="truncate">{b.passenger_name ?? "—"}</span>
                  </div>

                  <div className="mb-1.5 flex items-center gap-2 text-xs text-fg-secondary">
                    <Car className="size-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                    <span className="truncate">
                      {b.driver_name ?? "Unassigned"}
                      {b.plate_number ? <span className="font-mono"> · {b.plate_number}</span> : ""}
                    </span>
                  </div>

                  {b.pickup_address && (
                    <div className="flex items-start gap-2 text-xs text-fg-muted">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{b.pickup_address}</span>
                    </div>
                  )}

                  {b.driver_lat != null ? (
                    <div className={cn("mt-2 flex items-center gap-1.5 text-[11px] font-medium", b.driver_online ? "text-success-ink" : "text-fg-muted")}>
                      {b.driver_online ? <Wifi className="size-3" aria-hidden="true" /> : <WifiOff className="size-3" aria-hidden="true" />}
                      {b.driver_online ? "Online" : "Offline"} · {formatRelative(b.driver_location_updated_at)}
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-fg-muted">No driver location yet</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: detail + map */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            {selectedBooking && (
              <Card className="hidden lg:block">
                <CardContent className="p-4">{detail}</CardContent>
              </Card>
            )}

            <Card className="overflow-hidden">
              <CardHeader
                title={selectedBooking ? `Booking #${selectedBooking.id}` : "Map"}
                description={selectedBooking ? `${selectedBooking.company_name ?? "—"} · ${STATUS_LABELS[selectedBooking.status] ?? selectedBooking.status}` : "Select a booking to focus the map."}
                actions={
                  selectedBooking && (
                    <Button variant="outline" size="sm" className="lg:hidden" leftIcon={<PanelRightOpen />} onClick={() => setDetailOpen(true)}>
                      Details
                    </Button>
                  )
                }
              />
              <div style={{ height: "clamp(300px, 50vh, 600px)" }}>
                <Map center={mapCenter} zoom={13} markers={mapMarkers} polylines={[]} height="100%" />
              </div>
              {bookings.length > 0 && (
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[11px] text-fg-muted" aria-label="Map legend">
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: markerColors.selectedDriver }} /> Selected driver
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: markerColors.otherDriver }} /> Other drivers
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: markerColors.pickup }} /> Pickup
                  </li>
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      <Drawer open={detailOpen} onOpenChange={setDetailOpen}>
        <DrawerContent title={selectedBooking ? `Booking #${selectedBooking.id}` : "Booking"} description={selectedBooking?.company_name ?? undefined} size="md">
          {detail}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
