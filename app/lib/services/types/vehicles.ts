import { DriverType } from './drivers';

export enum VehicleCategory {
    SEDAN = 'SEDAN',
    SUV = 'SUV',
    VAN = 'VAN',
    BUS = 'BUS',
    COASTER = 'COASTER',
    HIACE = 'HIACE',
    HATCHBACK = 'HATCHBACK',
    DOUBLE_CABIN = 'DOUBLE_CABIN',
}

export enum OwnershipType {
    OWNED = 'OWNED',
    PARTNER = 'PARTNER',
}

export interface CreateVehicleRequest {
    plate_number: string;
    make: string;
    model: string;
    year: number;
    color?: string;
    category: VehicleCategory;
    ownership: OwnershipType;
    fuel_avg_city: number;
    fuel_avg_highway: number;
    /** PETROL | DIESEL; null = infer from the category (coaster/bus = diesel) */
    fuel_type?: 'PETROL' | 'DIESEL' | null;
    seat_capacity: number;
    owner_company_id?: number;
    vendor_id?: number;
    rent_per_day_city?: number;
    rent_per_day_outstation?: number;
    overnight_rate?: number;
    vendor_overtime_rate?: number;
    vendor_rent_5hr?: number;
    vendor_rent_10hr?: number;
    // Driver fields (required when ownership=PARTNER)
    driver_full_name?: string;
    driver_email?: string;
    driver_phone?: string;
    driver_password?: string;
    driver_cnic_number?: string;
    driver_license_number?: string;
    driver_type?: DriverType;
}

export interface UpdateVehicleRequest extends Partial<CreateVehicleRequest> { }

export interface QueryVehicleParams {
    page?: number;
    limit?: number;
    search?: string;
    category?: VehicleCategory;
    ownership?: OwnershipType;
    show_all?: boolean;
    vendor_id?: number;
}

export interface Vehicle {
    id: number;
    plate_number: string;
    make: string;
    model: string;
    year: number;
    color: string | null;
    category: VehicleCategory;
    ownership: OwnershipType;
    fuel_avg_city: number;
    fuel_avg_highway: number;
    fuel_type?: 'PETROL' | 'DIESEL' | null;
    seat_capacity: number;
    owner_company_id: number | null;
    created_at?: string;
    updated_at?: string;
    vendor_id?: number | null;
    rent_per_day_city?: number;
    rent_per_day_outstation?: number;
    overnight_rate?: number;
    vendor_overtime_rate?: number;
    vendor_rent_5hr?: number;
    vendor_rent_10hr?: number;
    companies?: {
        id: number;
        name: string;
    };
    vendors?: {
        id: number;
        name: string;
    };
    drivers_profile?: Array<{
        driver_type: DriverType;
        cnic_number: string | null;
        license_number: string | null;
        users?: {
            id: string;
            email: string;
            full_name: string;
            phone: string | null;
        };
    }>;
}

export interface VehicleResponse {
    data: Vehicle;
    statusCode: number;
    message: string;
}
