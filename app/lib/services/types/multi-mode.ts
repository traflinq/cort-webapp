// Types for the multi-mode fleet platform features

export interface Pagination {
    total: number;
    pages?: number;
    page: number;
    limit: number;
    total_pages?: number;
}

// ─── Company Features ────────────────────────────────────────────────────────

export type CompanyFeatureKey =
    | 'chauffeur_external_vendor'
    | 'shuttle_external_vendor'
    | 'chauffeur_self_managed'
    | 'shuttle_self_managed'
    | 'chauffeur_cort_managed'
    | 'shuttle_cort_managed'
    | 'tracker_api_integration'
    | 'tracking_via_app'
    | 'ai_insights';

export interface CompanyFeature {
    id: number;
    company_id: number;
    feature_key: CompanyFeatureKey;
    is_enabled: boolean;
    config: Record<string, unknown>;
    created_at: string | null;
    updated_at: string | null;
}

// ─── External Vendors ────────────────────────────────────────────────────────

export interface ExternalVendor {
    id: number;
    user_id: string;
    name: string;
    contact_email: string | null;
    contact_phone: string | null;
    is_active: boolean;
    created_at: string | null;
    updated_at: string | null;
    public_users?: { id: string; email: string; status: string | null };
    company_vendor_links?: CompanyVendorLink[];
}

export interface CompanyVendorLink {
    id: number;
    company_id: number;
    vendor_id: number;
    serves_chauffeur: boolean;
    serves_shuttle: boolean;
    is_active: boolean;
    created_at: string | null;
    updated_at: string | null;
    companies?: { id: number; name: string };
    external_vendors?: { id: number; name: string; contact_email: string | null; contact_phone: string | null; is_active: boolean };
}

// ─── Vendor Dashboard ────────────────────────────────────────────────────────

export interface VendorDashboardStats {
    pending_requests: number;
    active_bookings: number;
    pending_travel_requests?: number;
    total_vehicles: number;
    total_drivers: number;
    company_links: Array<{
        link_id: number;
        company_id: number;
        company_name: string;
        serves_chauffeur: boolean;
        serves_shuttle: boolean;
        travel_enabled?: boolean;
    }>;
}

export interface BookingVendorRequest {
    id: number;
    booking_id: number;
    company_vendor_link_id: number;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
    assigned_vehicle_id: number | null;
    assigned_driver_id: string | null;
    responded_at: string | null;
    created_at: string | null;
    chauffeur_bookings?: {
        id: number;
        pickup_address: string | null;
        scheduled_for: string | null;
        package_selected: string;
        trip_type: string;
        city: string | null;
        no_of_days: number;
        users_chauffeur_bookings_passenger_idTousers?: { full_name: string; phone: string | null } | null;
    };
    company_vendor_links?: {
        companies?: { id: number; name: string };
    };
    vehicles?: { id: number; plate_number: string; make: string; model: string } | null;
    users?: { id: string; full_name: string; phone: string | null } | null;
}

// ─── Vendor Fleet ────────────────────────────────────────────────────────────

export interface VendorVehicle {
    id: number;
    plate_number: string;
    make: string;
    model: string;
    year: number;
    color: string | null;
    category: string;
    ownership: string;
    status: string | null;
    fuel_avg_city: number;
    fuel_avg_highway: number;
    company_vendor_link_id: number | null;
    is_company_pool: boolean;
}

export interface VendorDriver {
    user_id: string;
    driver_type: string;
    cnic_number: string | null;
    license_number: string | null;
    company_vendor_link_id: number | null;
    users: {
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
        status: string | null;
    };
}

// ─── Vendor Routes ────────────────────────────────────────────────────────────

export interface VendorRoute {
    id: number;
    name: string;
    company_id: number;
    company_vendor_link_id: number | null;
    assigned_vehicle_id: number | null;
    assigned_driver_id: string | null;
    status: string | null;
    companies?: { id: number; name: string };
    vehicles?: { id?: number; plate_number: string; model: string } | null;
    users?: { id: string; full_name: string } | null;
    route_stops?: Array<{
        id: number;
        name: string;
        sequence_order: number;
        morning_eta: string | null;
        evening_eta: string | null;
        lat: number | null;
        lng: number | null;
    }>;
}

// ─── Company Pool ────────────────────────────────────────────────────────────

export interface PoolVehicle {
    id: number;
    plate_number: string;
    make: string;
    model: string;
    year: number;
    color: string | null;
    category: string;
    status: string | null;
    is_company_pool: boolean;
    owner_company_id: number | null;
}

export interface PoolDriver {
    user_id: string;
    driver_type: string;
    cnic_number: string | null;
    license_number: string | null;
    is_company_pool_driver: boolean;
    users: {
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
        status: string | null;
    };
    vehicles: {
        id: number;
        plate_number: string;
        make: string;
        model: string;
    } | null;
}

// ─── Tracker Config ──────────────────────────────────────────────────────────

export interface TrackerConfig {
    id?: number;
    company_id: number;
    api_endpoint: string | null;
    api_key: string | null;
    config: Record<string, unknown>;
    updated_at?: string | null;
}
