// Types for the CORT_VENDOR portal (Cort's own supplier vendors, backend /cort-vendor/*).

export type ShuttleTripStatus = 'SCHEDULED' | 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ShuttleDirection = 'MORNING' | 'EVENING';

export interface CortVendorVehicle {
    id: number;
    plate_number: string;
    make: string;
    model: string;
    year: number;
    color: string | null;
    category: string;
    seat_capacity: number;
    status: string | null;
}

export interface CortVendorPerson {
    id: string;
    full_name: string;
    phone: string | null;
}

export interface CortVendorCompany {
    id: number;
    name: string;
}

export interface RouteRef {
    id: number;
    name: string;
    companies?: CortVendorCompany | null;
}

export interface CortVendorSummary {
    vendor: { id: number; name: string; contact_person: string | null; phone: string | null } | null;
    counts: { vehicles: number; drivers: number; active_routes: number; trips_today: number };
    trips_today_by_status: Partial<Record<ShuttleTripStatus, number>>;
}

export interface CortVendorVehicleRow extends CortVendorVehicle {
    routes: RouteRef[];
    evening_assigned_routes: RouteRef[];
}

export interface CortVendorDriverRow extends CortVendorPerson {
    email: string;
    status: string | null;
    profile_picture_url: string | null;
    routes: RouteRef[];
    evening_assigned_routes: RouteRef[];
    profile: {
        cnic_number: string | null;
        license_number: string | null;
        driver_type: string;
        is_online: boolean | null;
        last_updated: string | null;
        vehicles: CortVendorVehicle | null;
    };
}

export interface CortVendorRouteRow {
    id: number;
    name: string;
    is_active: boolean;
    expected_km: string | null;
    expected_duration_min: string | null;
    companies: CortVendorCompany | null;
    vehicles: CortVendorVehicle | null;
    evening_vehicle: CortVendorVehicle | null;
    users: CortVendorPerson | null;
    evening_driver: CortVendorPerson | null;
    _count: { route_stops: number; employee_route_assignments: number };
}

export interface CortVendorRouteStop {
    id: number;
    name: string;
    sequence_order: number;
    morning_sequence: number | null;
    evening_sequence: number | null;
    stop_type: 'PICKUP' | 'OFFICE' | string;
    morning_eta: string | null;
    evening_eta: string | null;
    lat: number | null;
    lng: number | null;
}

export interface CortVendorRouteAssignment {
    user_id: string;
    pickup_stop_id: number | null;
    office_stop_id: number | null;
    users: { id: string; full_name: string; email: string; phone: string | null; department: string | null } | null;
    route_stops: { id: number; name: string; sequence_order: number } | null;
}

export interface CortVendorRouteDetail extends Omit<CortVendorRouteRow, '_count'> {
    evening_lock_time: string | null;
    route_stops: CortVendorRouteStop[];
    employee_route_assignments: CortVendorRouteAssignment[];
}

export interface Polyline {
    points: { lat: number; lng: number }[];
    encodedPolyline: string;
}

export interface CortVendorTripRow {
    id: number;
    trip_date: string;
    direction: ShuttleDirection;
    status: ShuttleTripStatus;
    started_at: string | null;
    completed_at: string | null;
    total_distance_km: string | null;
    idle_minutes: string | null;
    routes: RouteRef | null;
    vehicles: CortVendorVehicle | null;
    users: CortVendorPerson | null;
    shuttle_trip_metrics: { boarded_count: number; seat_capacity: number } | null;
}

export interface CortVendorTripsQuery {
    from?: string;
    to?: string;
    status?: ShuttleTripStatus;
    direction?: ShuttleDirection;
    route_id?: number;
    company_id?: number;
    vehicle_id?: number;
    page?: number;
    limit?: number;
}

export interface Paginated<T> {
    data: T[];
    pagination: { page: number; limit: number; total: number; pages: number; hasNext: boolean; hasPrev: boolean };
}

export interface CortVendorTripEmployee {
    user_id: string;
    pickup_stop_id: number | null;
    users: { id: string; full_name: string; phone: string | null; department: string | null } | null;
    route_stops: { id: number; name: string | null; sequence_order: number | null } | null;
    boarding: { scanned_at: string | null; status: string | null; drop_off_at: string | null } | null;
}

export interface CortVendorTripDetail extends Omit<CortVendorTripRow, 'shuttle_trip_metrics'> {
    current_stop_id: number | null;
    current_stop_status: string | null;
    actual_path_polyline: string | null;
    shuttle_trip_stop_logs: {
        arrived_at: string;
        departed_at: string | null;
        route_stops: { id: number; name: string; stop_type: string };
    }[];
    shuttle_trip_metrics: {
        boarded_count: number;
        seat_capacity: number;
        occupancy_pct: string | null;
        actual_distance_km: string | null;
        planned_distance_km: string | null;
        actual_duration_min: string | null;
        expected_duration_min: string | null;
        idle_minutes: string | null;
    } | null;
    employees: CortVendorTripEmployee[];
    last_location: { lat: number; lng: number; ts: number } | null;
}

/** Trip for a single day as returned by /cort-vendor/trips/today (backend getTodayTrips). */
export interface CortVendorDayTrip {
    id: number;
    route_id: number | null;
    direction: ShuttleDirection;
    status: ShuttleTripStatus;
    started_at: string | null;
    completed_at: string | null;
    last_lat: number | null;
    last_lng: number | null;
    users?: CortVendorPerson | null;
    vehicles: { id: number; plate_number: string; make: string; model: string; color: string | null } | null;
    routes: {
        id: number;
        name: string;
        company_id: number | null;
        route_stops: CortVendorRouteStop[];
        _count?: { employee_route_assignments: number };
    } | null;
}
