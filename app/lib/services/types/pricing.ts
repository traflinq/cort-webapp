export interface ChauffeurContractRate {
    id: number;
    contract_id: number;
    vehicle_model: string;
    cost_per_km: string;
    rate_spot_5hr: string;
    rate_spot_10hr: string;
    rate_spot_24hr: string;
    rate_monthly_10hr: string;
    rate_monthly_24hr: string;
    rate_overtime_per_hr: string;
    market_cost_per_km?: string;
    market_rate_spot_5hr?: string;
    market_rate_spot_10hr?: string;
    market_rate_spot_24hr?: string;
    market_rate_monthly_10hr?: string;
    market_rate_monthly_24hr?: string;
    market_rate_overtime_per_hr?: string;
    /** Per-vehicle override. null/undefined = use the company default allowance. */
    allowance_outstation?: string | null;
    allowance_accommodation?: string | null;
}

export interface ChauffeurContract {
    id: number;
    company_id: number;
    fuel_base_price: string;
    revision_percentage: string | null;
    contract_duration?: string | null;
    created_at?: string | null;
    allowance_outstation?: string | null;
    allowance_accommodation?: string | null;
    companies?: {
        name: string;
    };
    chauffeur_contract_rates?: ChauffeurContractRate[];
}

export interface CreateChauffeurContractRequest {
    companyId: number;
    //  Settings
    fuelBasePrice?: number;
    revisionPercentage?: number | null;
    contractDuration?: string;
    contractDate?: string;

    // Optional Rate Entry
    vehicleModel?: string;
    costPerKm?: number;
    rateSpot5hr?: number;
    rateSpot10hr?: number;
    rateSpot24hr?: number;
    rateMonthly10hr?: number;
    rateMonthly24hr?: number;
    rateOvertimePerHr?: number;
    marketCostPerKm?: number;
    marketRateSpot5hr?: number;
    marketRateSpot10hr?: number;
    marketRateSpot24hr?: number;
    marketRateMonthly10hr?: number;
    marketRateMonthly24hr?: number;
    marketRateOvertimePerHr?: number;
    allowanceOutstation?: number;
    allowanceAccommodation?: number;
    /** Per-vehicle overrides; null clears the override (falls back to company default). */
    vehicleAllowanceOutstation?: number | null;
    vehicleAllowanceAccommodation?: number | null;
}

export interface UpdateChauffeurContractRequest {
    // For GLOBAL updates
    fuelBasePrice?: number;
    revisionPercentage?: number | null;
    contractDuration?: string;
    contractDate?: string;

    // For RATE updates
    vehicleModel?: string;
    costPerKm?: number;
    rateSpot5hr?: number;
    rateSpot10hr?: number;
    rateSpot24hr?: number;
    rateMonthly10hr?: number;
    rateMonthly24hr?: number;
    rateOvertimePerHr?: number;
    marketCostPerKm?: number;
    marketRateSpot5hr?: number;
    marketRateSpot10hr?: number;
    marketRateSpot24hr?: number;
    marketRateMonthly10hr?: number;
    marketRateMonthly24hr?: number;
    marketRateOvertimePerHr?: number;
    allowanceOutstation?: number;
    allowanceAccommodation?: number;
    vehicleAllowanceOutstation?: number | null;
    vehicleAllowanceAccommodation?: number | null;
}

export interface ChauffeurContractResponse {
    data: ChauffeurContract[];
    statusCode: number;
    message: string;
}

export interface SingleChauffeurContractResponse {
    data: ChauffeurContract;
    statusCode: number;
    message: string;
}

export type FixedTermContractCategory = 'CHAUFFEUR' | 'SHUTTLE';

export interface FixedTermContract {
    id: number;
    car_description: string;
    owner_name: string;
    monthly_amount: string;
    category: FixedTermContractCategory;
    start_date: string;
    end_date: string | null;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
    total_due?: string;
    total_paid?: string;
    amount_remaining_total?: string;
    overdue_amount?: string;
    current_month_due?: FixedTermMonthlyDue | null;
    monthly_dues?: FixedTermMonthlyDue[];
    payment_status?: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID';
}

export interface FixedTermMonthlyDue {
    id: number;
    fixed_term_contract_id: number;
    billing_month: string;
    due_amount: string;
    amount_paid: string;
    amount_remaining: string;
    payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID' | null;
}

export interface FixedTermContractPayment {
    id: number;
    fixed_term_contract_id: number;
    amount: string;
    payment_type: 'PARTIAL' | 'FINAL' | null;
    payment_method: string | null;
    payment_date: string | null;
    notes: string | null;
    created_at: string | null;
    fixed_term_contract_monthly_dues?: FixedTermMonthlyDue | null;
}

export interface CreateFixedTermContractRequest {
    carDescription: string;
    ownerName: string;
    monthlyAmount: number;
    category?: FixedTermContractCategory;
    startDate: string;
    endDate?: string | null;
    notes?: string | null;
}

export interface UpdateFixedTermContractRequest {
    carDescription?: string;
    ownerName?: string;
    monthlyAmount?: number;
    category?: FixedTermContractCategory;
    startDate?: string;
    isActive?: boolean;
    endDate?: string | null;
    notes?: string | null;
}

export interface SettleFixedTermContractRequest {
    amount: number;
    paymentType?: 'PARTIAL' | 'FINAL';
    paymentMethod?: string;
    notes?: string;
    billingMonth?: string;
}

export interface SystemSetting {
    id: number;
    key: string;
    value: string;
    description: string | null;
    updated_at: string;
}

export interface SystemSettingResponse {
    data: SystemSetting;
    statusCode: number;
    message: string;
}

export interface FuelPriceHistoryEntry {
    id: number;
    fuel_type: 'PETROL' | 'DIESEL';
    price: string;
    effective_from: string;
}

export interface FuelPriceHistoryResponse {
    data: FuelPriceHistoryEntry[];
    statusCode: number;
    message: string;
}

export interface ShuttleContractRoute {
    id: number;
    contract_id: number;
    particulars: string;
    vehicle_type: string;
    fixed_cost_per_vehicle: string;
    fuel_cost_per_vehicle: string;
    quantity: number;
    billing_type?: string;
    scheduled_days?: string | null;
    fuel_type?: string;
}

export interface ShuttleContract {
    id: number;
    company_id: number;
    fuel_base_price: string;
    diesel_base_price?: string | null;
    revision_percentage: string | null;
    sst_percentage: string;
    contract_duration?: string | null;
    created_at?: string | null;
    companies?: {
        name: string;
    };
    shuttle_contract_routes?: ShuttleContractRoute[];
}

export interface CreateShuttleContractRequestRoute {
    particulars: string;
    vehicleType: string;
    fixedCostPerVehicle: number;
    fuelCostPerVehicle: number;
    quantity: number;
    billingType?: string;
    scheduledDays?: string;
    fuelType?: string;
}

export interface CreateShuttleContractRequest {
    companyId: number;
    fuelBasePrice: number;
    dieselBasePrice?: number | null;
    revisionPercentage?: number | null;
    sstPercentage?: number;
    contractDuration?: string;
    contractDate?: string;
    routes: CreateShuttleContractRequestRoute[];
}
