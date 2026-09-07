export enum DriverType {
    SHUTTLE = 'SHUTTLE',
    CHAUFFEUR = 'CHAUFFEUR',
    BOTH = 'BOTH',
}

export function canServeShuttle(type: DriverType | string | null | undefined): boolean {
    return type === DriverType.SHUTTLE || type === DriverType.BOTH;
}

export function canServeChauffeur(type: DriverType | string | null | undefined): boolean {
    return type === DriverType.CHAUFFEUR || type === DriverType.BOTH;
}

export enum DriverStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
    DELETED = 'DELETED',
    PENDING = 'PENDING',
    REJECTED = 'REJECTED',
}

export enum DriverStatusAction {
    APPROVE = 'APPROVE',
    REJECT = 'REJECT',
}

export interface CreateDriverRequest {
    email: string;
    password?: string;
    full_name: string;
    phone?: string;
    company_id?: number;
    driver_type: DriverType;
    cnic_number?: string;
    license_number?: string;
    status?: DriverStatus;
    profile_picture?: File;
}

export interface UpdateDriverRequest extends Partial<Omit<CreateDriverRequest, 'profile_picture'>> {
    profile_picture?: File;
}

export interface UpdateDriverStatusRequest {
    action: DriverStatusAction;
    reason?: string;
}

export interface QueryDriverParams {
    page?: number;
    limit?: number;
    search?: string;
    company_id?: number;
    driver_type?: DriverType;
    status?: string;
}

export interface Driver {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    status: DriverStatus;
    profile_picture_url: string | null;
    company_id: number | null;
    drivers_profile?: {
        driver_type: DriverType;
        cnic_number: string | null;
        license_number: string | null;
        current_vehicle_id: number | null;
        rejection_reason?: string | null;
        /** Self-serve chauffeur application uploads */
        license_front_image_url?: string | null;
        license_back_image_url?: string | null;
        cnic_front_image_url?: string | null;
        cnic_back_image_url?: string | null;
        vehicle_photo_url?: string | null;
        vehicle_make?: string | null;
        vehicle_model?: string | null;
        vehicle_year?: number | null;
        vehicle_registration_doc_url?: string | null;
    };
    created_at: string;
    /** Mean star rating from completed chauffeur trip reviews (1–5). */
    avg_rating?: number | null;
    review_count?: number;
    companies?: {
        id: number;
        name: string;
    };
}

export interface DriverResponse {
    data: Driver;
    statusCode: number;
    message: string;
}

export interface RideReview {
    id: number;
    employee_id: string;
    chauffeur_booking_id: number;
    rating: number;
    review_text: string | null;
    created_at: string;
    users?: {
        id: string;
        full_name: string;
    };
    chauffeur_bookings?: {
        id: number;
        scheduled_for: string;
        pickup_address: string;
    };
}
