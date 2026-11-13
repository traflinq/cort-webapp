import { ChauffeurTripDailyLog } from './bookings';

/** One line of the system-computed amount for a vendor trip. */
export interface VendorAuditBreakdownLine {
    category: 'SERVICE' | 'EXPENSE' | 'TAX' | 'DISCOUNT' | string;
    description: string;
    quantity: number | null;
    unit_price: number | null;
    amount: number;
}

/**
 * Financial audit of an external vendor's trip: what the vendor billed vs. what the system computed
 * from the vendor contract. The system amount is only present once an audit has been run (DONE).
 */
export type VendorTripAudit =
    | { booking_id: number; vendor: { id: number; name: string } | null; status: 'NOT_AVAILABLE'; reason: 'TRIP_NOT_COMPLETED' | 'EXPECTED_NOT_READY' }
    | { booking_id: number; vendor: { id: number; name: string } | null; status: 'NOT_RUN' }
    | {
        booking_id: number;
        vendor: { id: number; name: string } | null;
        status: 'DONE';
        vendor_charged_amount: number;
        expected_amount: number;
        difference_amount: number;
        difference_percentage: number | null;
        verdict: 'OVERCHARGED' | 'UNDERCHARGED' | 'MATCHED';
        expected_breakdown: VendorAuditBreakdownLine[];
        expected_changed_since_audit: boolean;
        expected_amount_at_audit: number;
        vendor_invoice_reference: string | null;
        notes: string | null;
        audited_at: string;
    };

export interface RunVendorAuditRequest {
    vendor_charged_amount: number;
    vendor_invoice_reference?: string;
    notes?: string;
}

export interface ChauffeurReport {
    id: number;
    fulfillment_type?: 'CORT_MANAGED' | 'EXTERNAL_VENDOR' | 'SELF_MANAGED';
    city?: string;
    completed_at: string;
    total_duration_minutes: number;
    total_distance_km: number;
    /** For EXTERNAL_VENDOR trips seen by company users: what the vendor charged (once audited), else null. */
    total_cost: number | null;
    company?: {
        id: number;
        name: string;
    } | null;
    passenger: {
        full_name: string;
        email: string;
        employee_id: string;
    } | null;
    driver: {
        full_name: string;
    } | null;
    vehicle: {
        make: string;
        model: string;
        plate_number: string;
    } | null;
    route: {
        pickup: string;
        dropoff: string;
    };
    breakdown: {
        service_charge: number;
        fuel_cost: number;
        toll: number;
        parking: number;
        accommodation: number;
        outstation_allowance: number;
        overtime: number;
        expense_toll_image_url?: string | null;
        expense_parking_image_url?: string | null;
    } | null;
    daily_logs?: ChauffeurTripDailyLog[];
    /** EXTERNAL_VENDOR trips only. */
    vendor_audit?: VendorTripAudit | null;
}

export interface ShuttlePassengerLog {
    status: string;
    scanned_at: string | null;
    drop_off_at: string | null;
    employee: {
        full_name: string;
        email: string;
        employee_id: string | null;
        department: string | null;
    } | null;
}

export interface ShuttleReport {
    id: number;
    trip_date: string;
    direction: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    route: {
        id: number;
        name: string;
        stops?: {
            id: number;
            name: string;
            sequence: number | null;
        }[];
    } | null;
    company: {
        id: number;
        name: string;
    } | null;
    vehicle: {
        make: string;
        model: string;
        plate_number: string;
    } | null;
    driver: {
        full_name: string;
    } | null;
    passengers: {
        total: number;
        boarded: number;
        absent: number;
        details: ShuttlePassengerLog[];
    };
    stop_logs?: {
        stop_id: number;
        stop_name: string | null;
        arrived_at: string | null;
        departed_at: string | null;
        boarded_at: string | null;
        drop_off_at: string | null;
        absent_at: string | null;
        morning_sequence: number | null;
        evening_sequence: number | null;
    }[];
}

export interface ReportQueryParams {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    routeId?: number;
    companyId?: number;
}
