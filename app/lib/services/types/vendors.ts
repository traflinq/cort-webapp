import { Vehicle } from './vehicles';

export interface CreateVendorRequest {
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
}

export interface UpdateVendorRequest extends Partial<CreateVendorRequest> { }

export interface QueryVendorParams {
    page?: number;
    limit?: number;
    search?: string;
}

export interface Vendor {
    id: number;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    created_at: string;
    _count?: {
        vehicles: number;
    };
}

export interface VendorResponse {
    data: Vendor;
    statusCode: number;
    message: string;
}

// -- VENDOR CONTRACTS --

export enum ContractStatus {
    ACTIVE = 'ACTIVE',
    ENDED = 'ENDED',
    PAID = 'PAID',
    PENDING_PAYMENT = 'PENDING_PAYMENT',
}

export interface CreateVendorContractRequest {
    vendor_id: number;
    vehicle_id: number;
    month: string; // YYYY-MM format
    total_payable: number;
    status?: ContractStatus;
    payment_date?: string;
    notes?: string;
}

export interface UpdateVendorContractRequest extends Partial<CreateVendorContractRequest> { }

export interface QueryVendorContractParams {
    month?: string;
    vendor_id?: number;
    vehicle_id?: number;
    status?: ContractStatus;
    page?: number;
    limit?: number;
}

export interface VendorContract {
    id: number;
    vendor_id: number;
    vehicle_id: number;
    month: string;
    total_payable: number;
    status: ContractStatus;
    payment_date: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    vendors?: Vendor;
    vehicles?: Vehicle;
}

export interface VendorContractResponse {
    data: VendorContract;
    statusCode: number;
    message: string;
}

// -- VENDOR LOGS --

export interface QueryVendorLogsParams {
    page?: number;
    limit?: number;
    vendor_id?: number;
    company_id?: number;
    start_date?: string;
    end_date?: string;
    payment_status?: string;
}

export interface QueryVendorStatsParams {
    vendor_id?: number;
    company_id?: number;
}

export interface VendorStats {
    total_rides: number;
    total_cost: number;
    total_outstanding: number;
}

export interface VendorStatsResponse {
    data: VendorStats;
    statusCode: number;
    message: string;
}

export interface VendorLog {
    booking_id: number;
    start_time: string;
    end_time: string;
    total_distance_km: number;
    vendor_distance_km?: number;
    total_duration_minutes: number;
    vendor_cost: number;
    vendor_base_rent?: number;
    vendor_fuel_cost?: number;
    vendor_overtime_charge?: number;
    vendor_payment_status: string;
    vendor_amount_paid?: number;
    vendor_amount_remaining?: number;
    /** Date/time when vendor payment was last settled (latest transaction), null if never settled */
    settled_at?: string | null;
    // Cost breakdown
    base_package_cost?: number;
    fuel_cost_calculated?: number;
    fuel_price_snapshot?: number;
    overtime_hours?: number;
    overtime_charge?: number;
    outstation_fee?: number;
    expense_toll?: number;
    expense_parking?: number;
    expense_accommodation?: number;
    chauffeur_bookings?: {
        id: number;
        trip_type: string;
        package_selected?: string;
        vehicles?: {
            plate_number: string;
            make: string;
            model: string;
            rent_per_day_city?: number;
            rent_per_day_outstation?: number;
            vendor_rent_5hr?: number;
            vendor_rent_10hr?: number;
            vendor_overtime_rate?: number;
            overnight_rate?: number;
            vendors?: {
                name: string;
            }
        };
        users_chauffeur_bookings_passenger_idTousers?: {
            full_name: string;
            phone?: string;
        };
        vendor_payment_transactions?: {
            amount: number;
            notes: string;
            payment_date: string;
        }[];
    }
}

export interface VendorLogsResponse {
    data: {
        data: VendorLog[];
        pagination: {
            total: number;
            pages: number;
            page: number;
            limit: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    };
    statusCode: number;
    message: string;
}

// -- VENDOR PAYMENTS --

export interface BulkPayVendorLogsDto {
    ids: number[];
}

export interface CreateVendorPaymentRequest {
    booking_id?: number;
    invoice_id?: number;
    travel_mile_id?: number;
    amount: number;
    payment_method?: string;
    notes?: string;
}

export interface UpdateVendorPaymentRequest {
    amount?: number;
    payment_method?: string;
    notes?: string;
    payment_date?: string;
}

export interface VendorPaymentTransaction {
    id: number;
    booking_id: number;
    amount: number;
    payment_type: string;
    payment_method?: string;
    notes?: string;
    payment_date: string;
    created_at: string;
    created_by?: string;
    users?: {
        full_name: string;
        email: string;
    };
}
