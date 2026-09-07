import { Invoice } from './invoices';

export enum BookingType {
    SPOT = 'SPOT',
    MONTHLY = 'MONTHLY',
}

export enum PackageType {
    HOURS_5 = 'HOURS_5',
    HOURS_10 = 'HOURS_10',
    HOURS_24 = 'HOURS_24',
}

export enum TripType {
    IN_CITY = 'IN_CITY',
    OUT_STATION = 'OUT_STATION',
}

export enum TripStatus {
    PENDING = 'PENDING',
    ASSIGNED = 'ASSIGNED',
    OTW = 'OTW',
    ARRIVED = 'ARRIVED',
    IN_PROGRESS = 'IN_PROGRESS',
    DROPPED_OFF = 'DROPPED_OFF',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    ENDED = 'ENDED',
}

export interface PickupLocation {
    latitude: number;
    longitude: number;
}

export interface CreateChauffeurBookingRequest {
    booking_type: BookingType;
    vehicle_model: string;
    package_selected: PackageType;
    trip_type: TripType;
    pickup_location: PickupLocation;
    scheduled_for: string; // ISO 8601 datetime
    internal_cost_center_code?: string;
    service_category?: string;
    city?: string;
    no_of_days?: number;
    /** CORT_MANAGED only: also notify vendors; Cort ops and vendors race to assign. */
    broadcast_to_all_vendors?: boolean;
    vendor_link_ids?: number[];
}

export interface ChauffeurTripLog {
    id: number;
    start_time: string;
    end_time: string | null;
    start_odometer: number;
    end_odometer: number | null;
    total_distance_km: number | null;
    total_duration_minutes: number | null;
    expense_toll: number | null;
    expense_parking: number | null;
    expense_toll_image_url?: string | null;
    expense_parking_image_url?: string | null;
    meter_reading_start_image_url?: string | null;
    meter_reading_end_image_url?: string | null;
    base_package_cost?: number | null;
    outstation_fee?: number | null;
    overtime_hours?: number | null;
    overtime_charge?: number | null;
    service_subtotal?: number | null;
    fuel_cost_calculated?: number | null;
    expense_accommodation?: number | null;
    expense_subtotal?: number | null;
    sst_amount?: number | null;
    total_invoice_amount?: number | null;
    savings_amount?: number | null;
    vendor_cost?: number | null;
    vendor_base_rent?: number | null;
    vendor_fuel_cost?: number | null;
    vendor_overtime_charge?: number | null;
    vendor_distance_km?: number | null;
    vendor_payment_status?: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID' | null;
    vendor_amount_paid?: number | null;
    vendor_amount_remaining?: number | null;
    fuel_price_snapshot?: number | null;
}

export interface DailyTripLog {
    date: string;
    trip_type: TripType;
    is_full_day: boolean;
    hours_used?: number;
    apply_accommodation?: boolean;
}

export interface ChauffeurTripDailyLog {
    id: number;
    booking_id: number;
    log_date: string;
    trip_type: TripType;
    hours_used: number | null;
    is_full_day: boolean;
    apply_accommodation: boolean;
}

export interface ChauffeurBooking {
    id: number;
    company_id: number;
    passenger_id: string;
    driver_id: string | null;
    vehicle_id: number | null;
    vehicle_model?: string; // Stored model preference
    booking_type: BookingType;
    package_selected: PackageType;
    trip_type: TripType;
    scheduled_for: string;
    status: TripStatus;
    fulfillment_type: 'CORT_MANAGED' | 'EXTERNAL_VENDOR' | 'SELF_MANAGED';
    internal_cost_center_code: string | null;
    city?: string; // City of the booking
    service_category?: string;
    pickup_address?: string; // Human readable address
    no_of_days?: number;
    created_at: string;
    companies?: {
        id: number;
        name: string;
        logo_url?: string;
    };
    users_chauffeur_bookings_passenger_idTousers?: {
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
    };
    users_chauffeur_bookings_driver_idTousers?: {
        id: string;
        full_name: string;
        phone: string | null;
    };
    vehicles?: {
        id: number;
        model: string;
        plate_number: string;
        ownership?: 'OWNED' | 'PARTNER';
    };
    invoices?: Invoice | null;
    chauffeur_trip_logs?: ChauffeurTripLog | null;
    chauffeur_trip_daily_logs?: ChauffeurTripDailyLog[] | null;
    /** Marketplace: nearby chauffeur drivers this CORT_MANAGED booking was broadcast to, and their response. */
    chauffeur_booking_driver_responses?: ChauffeurBookingDriverResponse[];
}

export interface ChauffeurBookingDriverResponse {
    id: number;
    driver_id: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
    distance_km: number | null;
    responded_at: string | null;
    created_at: string;
    users: {
        id: string;
        full_name: string;
        phone: string | null;
    };
}

export interface QueryChauffeurBookingParams {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    company_id?: number;
    start_date?: string;
    end_date?: string;
    fulfillment_type?: 'CORT_MANAGED' | 'EXTERNAL_VENDOR' | 'SELF_MANAGED';
    vehicle_id?: number;
}

export interface QueryBookingStatsParams {
    company_id?: number;
    start_date?: string;
    end_date?: string;
}

export interface ChauffeurBookingResponse {
    data: ChauffeurBooking;
    statusCode: number;
    message: string;
}

// -- PAYMENT TRACKING --

export interface PaymentTransaction {
    id: number;
    booking_id: number;
    amount: string;
    payment_type: 'PARTIAL' | 'FINAL';
    payment_method?: string;
    payment_date: string;
    notes?: string;
    users_received_by?: {
        full_name: string;
        email: string;
    };
}

export interface PaymentSummary {
    booking_id: number;
    invoice_amount: string;
    total_paid: string;
    amount_remaining: string;
    payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID';
}

export interface AddPaymentRequest {
    amount: number;
    payment_type?: 'PARTIAL' | 'FINAL';
    payment_method?: string;
    notes?: string;
    payment_date?: string;
}
