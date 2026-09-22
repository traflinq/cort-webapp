export interface CreateCompanyRequest {
    name: string;
    email: string;
    password?: string;
    ntn_number?: string;
    contact_person?: string;
    address?: string;
    logo_url?: string;
    is_shuttle_enabled?: boolean;
    is_chauffeur_enabled?: boolean;
    is_travel_enabled?: boolean;
    prefix?: string;
    auth_email?: string;
    monthly_budget?: number;
}

export interface UpdateCompanyRequest extends Partial<CreateCompanyRequest> {
    allowed_vehicle_models?: string[];
}

export interface QueryCompanyParams {
    page?: number;
    limit?: number;
    search?: string;
    exclude_trials?: boolean;
}

export interface VehicleWhitelist {
    id: number;
    company_id: number;
    allowed_vehicle_model: string;
}

export interface Company {
    id: number;
    name: string;
    email: string;
    ntn_number: string | null;
    contact_person: string | null;
    address: string | null;
    logo_url: string | null;
    is_shuttle_enabled: boolean;
    is_chauffeur_enabled: boolean;
    is_travel_enabled?: boolean;
    is_cort_managed: boolean | null;
    is_external_vendor_managed: boolean | null;
    is_own_pooled_cars_managed: boolean | null;
    created_at: string;
    updated_at: string;
    vehicle_whitelists?: VehicleWhitelist[];
    monthly_budget?: number;
    _count?: {
        users: number;
    };
    prefix?: string;
}

export interface CompanyResponse {
    data: Company & { generatedPassword?: string };
    statusCode: number;
    message: string;
}

export interface ImpersonateCompanyResponse {
    data: { redirectUrl: string };
    statusCode: number;
    message: string;
}
