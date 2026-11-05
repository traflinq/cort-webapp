export enum MaintenanceType {
    OIL_CHANGE = 'OIL_CHANGE',
    TIRE_ROTATION = 'TIRE_ROTATION',
    BRAKE_SERVICE = 'BRAKE_SERVICE',
    GENERAL_INSPECTION = 'GENERAL_INSPECTION',
    REPAIR = 'REPAIR',
    OTHER = 'OTHER',
}

// -- FUEL RECORDS --

export interface CreateFuelRecordRequest {
    vehicle_id: number;
    date: string; // ISO date format YYYY-MM-DD
    fuel_litres: number;
    current_fuel_rate: number;
    fuel_cost?: number; // Auto-calculated if not provided
    odometer_reading?: number;
    billed?: boolean;
    /** Optional booking to tag this fuel purchase to. Tagged actual cost replaces the formula estimate for that booking's invoice and Chauffeur COGS. */
    booking_id?: number;
    receipt_id?: string;
}

export interface BulkPayFuelRequest {
    ids: number[];
}

export interface UpdateFuelRecordRequest extends Partial<CreateFuelRecordRequest> { }

export interface QueryFuelRecordParams {
    page?: number;
    limit?: number;
    vehicle_id?: number;
    start_date?: string;
    end_date?: string;
    billed?: boolean;
}

export interface FuelRecord {
    id: number;
    vehicle_id: number;
    date: string;
    fuel_litres: number;
    current_fuel_rate: number;
    fuel_cost: number;
    odometer_reading?: number;
    billed: boolean;
    receipt_id?: string | null;
    created_at: string;
    updated_at: string;
    booking_id?: number | null;
    created_by?: string | null;
    added_by_name?: string | null;
    mileage_km_driven?: number | null;
    mileage_km_per_litre?: number | null;
    vehicles?: {
        id: number;
        plate_number: string;
        make: string;
        model: string;
    };
}

export interface FuelRecordResponse {
    data: FuelRecord;
    statusCode: number;
    message: string;
}

/** Totals across ALL records matching the list filters (not just the current page). */
export interface FuelListSummary {
    total_fuel_cost: number;
    total_fuel_litres: number;
    average_fuel_rate: number;
    average_mileage: number | null;
    mileage_intervals: number;
}

export interface FuelStatsResponse {
    data: {
        total_fuel_cost: number;
        average_fuel_rate: number;
        total_records: number;
    };
    statusCode: number;
    message: string;
}

// -- MAINTENANCE RECORDS --

export interface CreateMaintenanceRecordRequest {
    vehicle_id: number;
    maintenance_type: MaintenanceType;
    date: string; // ISO date format YYYY-MM-DD
    odometer_reading: number;
    next_service_odometer?: number; // Absolute due km = current odometer + interval entered in UI
    cost?: number;
    notes?: string;
}

export interface UpdateMaintenanceRecordRequest extends Partial<CreateMaintenanceRecordRequest> { }

export interface QueryMaintenanceRecordParams {
    page?: number;
    limit?: number;
    vehicle_id?: number;
    maintenance_type?: MaintenanceType;
    start_date?: string;
    end_date?: string;
}

export interface MaintenanceRecord {
    id: number;
    vehicle_id: number;
    maintenance_type: MaintenanceType;
    date: string;
    odometer_reading: number;
    next_service_odometer: number | null;
    cost: number | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    payment_status?: "PAID" | "UNPAID" | string;
    paid_at?: string | null;
    created_by?: string | null;
    added_by_name?: string | null;
    vehicles?: {
        id: number;
        plate_number: string;
        make: string;
        model: string;
    };
}

export interface MaintenanceRecordResponse {
    data: MaintenanceRecord;
    statusCode: number;
    message: string;
}

export interface UpcomingMaintenanceResponse {
    data: {
        vehicle_id: number;
        plate_number: string;
        make: string;
        model: string;
        last_oil_change_date: string;
        last_oil_change_odometer: number;
        next_service_odometer: number;
    }[];
    statusCode: number;
    message: string;
}
