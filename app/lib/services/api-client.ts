import { LoginRequest, LoginResponse, ProfileResponse, SignupRequest, StaffPermissions } from '../types/auth-types';
import {
    PaginatedResponse,
    DeleteRecordResult,
    // Multi-mode platform
    Pagination,
    CompanyFeature,
    ExternalVendor,
    CompanyVendorLink,
    VendorDashboardStats,
    BookingVendorRequest,
    VendorVehicle,
    VendorDriver,
    VendorRoute,
    PoolVehicle,
    PoolDriver,
    TrackerConfig,
    // Companies
    CreateCompanyRequest, QueryCompanyParams, Company, CompanyResponse, UpdateCompanyRequest,
    ImpersonateCompanyResponse,
    // Employees
    CreateEmployeeRequest, QueryEmployeeParams, Employee, EmployeeResponse, UpdateEmployeeRequest,
    // Vehicles
    CreateVehicleRequest, QueryVehicleParams, Vehicle, VehicleResponse, UpdateVehicleRequest,
    // Vendors
    CreateVendorRequest, QueryVendorParams, Vendor, VendorResponse, UpdateVendorRequest,
    CreateVendorContractRequest, QueryVendorContractParams, VendorContract, VendorContractResponse, UpdateVendorContractRequest,
    QueryVendorLogsParams, QueryVendorStatsParams, VendorLogsResponse, VendorStatsResponse, CreateVendorPaymentRequest, VendorPaymentTransaction,
    UpdateVendorPaymentRequest,
    // Drivers
    CreateDriverRequest, QueryDriverParams, Driver, DriverResponse, UpdateDriverRequest, UpdateDriverStatusRequest, RideReview,
    // Pricing / Contracts
    ChauffeurContractResponse, CreateChauffeurContractRequest, SingleChauffeurContractResponse, UpdateChauffeurContractRequest,
    SystemSettingResponse,
    FuelPriceHistoryResponse,
    ShuttleContract,
    ShuttleContractRoute,
    CreateShuttleContractRequest,
    FixedTermContract,
    FixedTermContractPayment,
    CreateFixedTermContractRequest,
    UpdateFixedTermContractRequest,
    SettleFixedTermContractRequest,
    // App config
    MobileAppConfig,
    UpdateMobileAppConfigRequest,
    // Bookings
    CreateChauffeurBookingRequest, ChauffeurBooking, ChauffeurBookingResponse, QueryChauffeurBookingParams, QueryBookingStatsParams,
    DailyTripLog, AddPaymentRequest,
    // Fleet
    CreateFuelRecordRequest, QueryFuelRecordParams, FuelRecord, FuelRecordResponse, UpdateFuelRecordRequest,
    BulkPayFuelRequest, FuelStatsResponse,
    CreateMaintenanceRecordRequest, QueryMaintenanceRecordParams, MaintenanceRecord, MaintenanceRecordResponse,
    UpdateMaintenanceRecordRequest, UpcomingMaintenanceResponse,
    // Reports
    ChauffeurReport, ShuttleReport, ReportQueryParams,
    // Invoices
    QueryInvoiceParams, Invoice,
    // Expenses
    Expense, CreateExpenseRequest, UpdateExpenseRequest, ExpenseFilterParams, ExpensesListResult,
} from './types';

// Re-export all types for backward compatibility
export * from './types';
export type { LoginRequest, LoginResponse, ProfileResponse, SignupRequest } from '../types/auth-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class ApiClient {
    private baseUrl: string;
    private isRefreshing = false;
    private refreshSubscribers: { resolve: (token: string) => void; reject: (error: any) => void }[] = [];

    constructor() {
        this.baseUrl = API_URL;
    }

    /**
     * Get stored auth token from localStorage
     */
    private getToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('auth_token');
    }

    /**
     * Get stored refresh token from localStorage
     */
    private getRefreshToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('refresh_token');
    }

    /**
     * Store auth token in localStorage
     */
    private setToken(token: string): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem('auth_token', token);
    }

    /**
     * Store refresh token in localStorage
     */
    private setRefreshToken(token: string): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem('refresh_token', token);
    }

    /**
     * Remove auth tokens from localStorage
     */
    private removeToken(): void {
        if (typeof window === 'undefined') return;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
    }

    /**
     * Request a new access token using the refresh token
     */
    private async refreshToken(): Promise<string | null> {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            return null;
        }

        try {
            const response = await fetch(`${this.baseUrl}/auth/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken }),
            });

            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }

            const data = await response.json();
            const { session } = data.data;

            if (session?.access_token) {
                this.setToken(session.access_token);
                if (session.refresh_token) {
                    this.setRefreshToken(session.refresh_token);
                }
                return session.access_token;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.removeToken();
        }
        return null;
    }

    /**
     * Add callback to be executed after token refresh
     */
    private onRefreshed(token: string) {
        this.refreshSubscribers.forEach(({ resolve }) => resolve(token));
        this.refreshSubscribers = [];
    }

    /**
     * Add callback to be executed after token refresh failure
     */
    private onRefreshFailed(error: any) {
        this.refreshSubscribers.forEach(({ reject }) => reject(error));
        this.refreshSubscribers = [];
    }

    /**
     * Add subscriber to wait for token refresh
     */
    private subscribeTokenRefresh(resolve: (token: string) => void, reject: (error: any) => void) {
        this.refreshSubscribers.push({ resolve, reject });
    }

    /**
     * Helper to parse and handle API responses
     */
    private async parseResponse<T>(response: Response): Promise<T> {
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return {} as T;
        }

        const data = await response.json();

        if (!response.ok) {
            const raw = data.message;
            const errorMessage = Array.isArray(raw)
                ? raw.join('; ')
                : (raw || data.error || `HTTP error! status: ${response.status}`);
            throw new Error(errorMessage);
        }

        return data;
    }

    /**
     * Make HTTP request with automatic token attachment and refreshing
     */
    public async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const token = this.getToken();
        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string>),
        };

        // Only set Content-Type to application/json if it's NOT already set (e.g. for FormData)
        if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
        });

        // Handle 401 Unauthorized - Try to refresh token
        // Skip for login which specifically handles 401 for invalid credentials
        // And skip for refresh-token itself to avoid infinite loops
        if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh-token')) {
            if (this.isRefreshing) {
                return new Promise((resolve, reject) => {
                    this.subscribeTokenRefresh(
                        async (newToken) => {
                            try {
                                resolve(await this.request(endpoint, options));
                            } catch (e) {
                                reject(e);
                            }
                        },
                        (err) => reject(err)
                    );
                });
            }

            this.isRefreshing = true;
            try {
                const newToken = await this.refreshToken();
                this.isRefreshing = false;

                if (newToken) {
                    this.onRefreshed(newToken);
                    return this.request(endpoint, options);
                } else {
                    const error = new Error('Session expired');
                    this.onRefreshFailed(error);
                    throw error;
                }
            } catch (err) {
                this.isRefreshing = false;
                this.onRefreshFailed(err);
                throw err;
            }
        }

        return this.parseResponse<T>(response);
    }

    /**
     * Download blob from endpoint (with auth)
     */
    async downloadPdf(endpoint: string, filename: string): Promise<void> {
        const token = this.getToken();
        const headers: Record<string, string> = {};

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Try to get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        console.log(contentDisposition)
        let finalFilename = filename;

        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
                finalFilename = filenameMatch[1];
            }
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFilename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    /**
     * View PDF in a new tab (with auth)
     */
    async viewPdf(endpoint: string): Promise<void> {
        const token = this.getToken();
        const headers: Record<string, string> = {};

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    // ===== AUTH =====

    async login(credentials: LoginRequest): Promise<LoginResponse> {
        const response = await this.request<LoginResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });

        if (response.data?.session?.access_token) {
            this.setToken(response.data.session.access_token);
            if (response.data.session.refresh_token) {
                this.setRefreshToken(response.data.session.refresh_token);
            }
        }

        return response;
    }

    async signup(data: SignupRequest): Promise<LoginResponse> {
        const response = await this.request<LoginResponse>('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(data),
        });

        if (response.data?.session?.access_token) {
            this.setToken(response.data.session.access_token);
            if (response.data.session.refresh_token) {
                this.setRefreshToken(response.data.session.refresh_token);
            }
        }

        return response;
    }

    async getProfile(): Promise<ProfileResponse> {
        return this.request<ProfileResponse>('/auth/profile', {
            method: 'GET',
        });
    }

    async completeTrialOnboarding(): Promise<void> {
        await this.request<void>('/trial/onboarding/complete', { method: 'POST' });
    }

    async logout(): Promise<void> {
        try {
            await this.request<void>('/auth/logout', { method: 'POST' });
        } catch (err) {
            console.error('Logout API failed', err);
        } finally {
            this.removeToken();
        }
    }

    async forgotPassword(email: string): Promise<void> {
        const redirectTo =
            typeof window !== 'undefined'
                ? `${window.location.origin}/admin/reset-password`
                : `${process.env.NEXT_PUBLIC_APP_URL || ''}/admin/reset-password`;

        await this.request<void>('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email, redirectTo }),
        });
    }

    async resetPassword(token: string, newPassword: string): Promise<void> {
        await this.request<void>('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, newPassword }),
        });
    }

    async uploadStorageFile(file: File, path: string): Promise<string> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);

        const result = await this.request<{ url?: string; data?: { url?: string } }>(
            '/storage/upload',
            {
                method: 'POST',
                body: formData,
            },
        );

        const url = result.url ?? result.data?.url;
        if (!url) {
            throw new Error('Upload failed: no URL returned');
        }
        return url;
    }

    storeSession(session: { access_token: string; refresh_token?: string }): void {
        this.setToken(session.access_token);
        if (session.refresh_token) {
            this.setRefreshToken(session.refresh_token);
        }
    }

    clearSession(): void {
        this.removeToken();
    }

    isAuthenticated(): boolean {
        return !!this.getToken();
    }

    getAuthToken(): string | null {
        return this.getToken();
    }

    // ===== COMPANIES =====

    async getCompanies(params: QueryCompanyParams = {}): Promise<PaginatedResponse<Company>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);
        if (params.exclude_trials) query.append('exclude_trials', 'true');

        const queryString = query.toString();
        const endpoint = `/companies/list${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<Company>>(endpoint);
    }

    async getCompany(id: number | string): Promise<CompanyResponse> {
        return this.request<CompanyResponse>(`/companies/${id}`);
    }

    async createCompany(data: CreateCompanyRequest): Promise<CompanyResponse> {
        return this.request<CompanyResponse>('/companies/create', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateCompany(id: number | string, data: UpdateCompanyRequest): Promise<CompanyResponse> {
        return this.request<CompanyResponse>(`/companies/update/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async resetCompanyPassword(id: number, password: string): Promise<{ message: string }> {
        return this.request<{ message: string }>(`/companies/${id}/password`, {
            method: 'PATCH',
            body: JSON.stringify({ password }),
        });
    }

    async impersonateCompany(id: number | string): Promise<ImpersonateCompanyResponse> {
        return this.request<ImpersonateCompanyResponse>(`/companies/${id}/impersonate`, {
            method: 'POST',
        });
    }

    /**
     * Exchanges a one-time impersonation ticket for a real session, storing
     * the returned tokens exactly like `login()` does.
     */
    async exchangeImpersonationTicket(ticket: string): Promise<LoginResponse> {
        const response = await this.request<LoginResponse>('/auth/impersonate/exchange', {
            method: 'POST',
            body: JSON.stringify({ ticket }),
        });

        if (response.data?.session?.access_token) {
            this.setToken(response.data.session.access_token);
            if (response.data.session.refresh_token) {
                this.setRefreshToken(response.data.session.refresh_token);
            }
        }

        return response;
    }

    async deleteCompany(id: number): Promise<void> {
        await this.request<void>(`/companies/delete/${id}`, {
            method: 'DELETE',
        });
    }

    // ===== EMPLOYEES =====

    async getEmployees(params: QueryEmployeeParams = {}): Promise<PaginatedResponse<Employee>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);
        if (params.company_id) query.append('company_id', params.company_id.toString());

        const queryString = query.toString();
        const endpoint = `/employees${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<Employee>>(endpoint);
    }

    async createEmployee(data: CreateEmployeeRequest): Promise<EmployeeResponse> {
        return this.request<EmployeeResponse>('/employees/create', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateEmployee(id: string, data: UpdateEmployeeRequest): Promise<EmployeeResponse> {
        return this.request<EmployeeResponse>(`/employees/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async bulkCreateEmployees(employees: CreateEmployeeRequest[]): Promise<{
        data: {
            successful: Array<Employee & { password?: string }>;
            failed: { email: string; reason: string }[];
        };
    }> {
        return this.request<{
            data: {
                successful: Array<Employee & { password?: string }>;
                failed: { email: string; reason: string }[];
            };
        }>('/employees/bulk-create', {
            method: 'POST',
            body: JSON.stringify({ employees }),
        });
    }

    // ===== VEHICLES =====

    async getVehicles(params: QueryVehicleParams = {}): Promise<PaginatedResponse<Vehicle>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);
        if (params.category) query.append('category', params.category);
        if (params.ownership) query.append('ownership', params.ownership);
        if (params.show_all !== undefined) query.append('show_all', params.show_all.toString());
        if (params.vendor_id) query.append('vendor_id', params.vendor_id.toString());

        const queryString = query.toString();
        const endpoint = `/vehicles/list${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<Vehicle>>(endpoint);
    }

    async getAvailableVehicles(params: QueryVehicleParams = {}): Promise<PaginatedResponse<Vehicle>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);
        if (params.category) query.append('category', params.category);
        if (params.ownership) query.append('ownership', params.ownership);

        const queryString = query.toString();
        const endpoint = `/vehicles/available${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<Vehicle>>(endpoint);
    }

    async getVehicle(id: number): Promise<VehicleResponse> {
        return this.request<VehicleResponse>(`/vehicles/${id}`);
    }

    async createVehicle(data: CreateVehicleRequest): Promise<VehicleResponse> {
        return this.request<VehicleResponse>('/vehicles/create', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateVehicle(id: number, data: UpdateVehicleRequest): Promise<VehicleResponse> {
        return this.request<VehicleResponse>(`/vehicles/update/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteVehicle(id: number): Promise<{ message: string }> {
        return this.request<{ message: string }>(`/vehicles/delete/${id}`, {
            method: 'DELETE',
        });
    }

    // ===== VENDORS =====

    async getVendors(params: QueryVendorParams = {}): Promise<PaginatedResponse<Vendor>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);

        const queryString = query.toString();
        const endpoint = `/vendors${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<Vendor>>(endpoint);
    }

    async getVendor(id: number): Promise<VendorResponse> {
        return this.request<VendorResponse>(`/vendors/${id}`);
    }

    async createVendor(data: CreateVendorRequest): Promise<VendorResponse> {
        return this.request<VendorResponse>('/vendors', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateVendor(id: number, data: UpdateVendorRequest): Promise<VendorResponse> {
        return this.request<VendorResponse>(`/vendors/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteVendor(id: number): Promise<{ message: string }> {
        return this.request<{ message: string }>(`/vendors/${id}`, {
            method: 'DELETE',
        });
    }

    // ===== VENDOR CONTRACTS =====

    async getAllVendorContracts(params: QueryVendorContractParams = {}): Promise<PaginatedResponse<VendorContract>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.month) query.append('month', params.month);
        if (params.vendor_id) query.append('vendor_id', params.vendor_id.toString());
        if (params.vehicle_id) query.append('vehicle_id', params.vehicle_id.toString());
        if (params.status) query.append('status', params.status);

        const queryString = query.toString();
        const endpoint = `/vendors/contracts/list${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<VendorContract>>(endpoint);
    }

    async getVendorContractById(id: number): Promise<VendorContractResponse> {
        return this.request<VendorContractResponse>(`/vendors/contracts/${id}`);
    }

    async createVendorContract(data: CreateVendorContractRequest): Promise<VendorContractResponse> {
        return this.request<VendorContractResponse>('/vendors/contracts', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateVendorContract(id: number, data: UpdateVendorContractRequest): Promise<VendorContractResponse> {
        return this.request<VendorContractResponse>(`/vendors/contracts/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteVendorContract(id: number): Promise<{ message: string }> {
        return this.request<{ message: string }>(`/vendors/contracts/${id}`, {
            method: 'DELETE',
        });
    }

    // ===== VENDOR LOGS =====

    async getVendorLogs(params: QueryVendorLogsParams): Promise<VendorLogsResponse> {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());
        if (params.vendor_id) queryParams.append('vendor_id', params.vendor_id.toString());
        if (params.company_id) queryParams.append('company_id', params.company_id.toString());
        if (params.start_date) queryParams.append('start_date', params.start_date);
        if (params.end_date) queryParams.append('end_date', params.end_date);
        if (params.payment_status) queryParams.append('payment_status', params.payment_status);

        return this.request<VendorLogsResponse>(`/vendors/logs/list?${queryParams.toString()}`);
    }

    async getVendorStats(params?: QueryVendorStatsParams): Promise<VendorStatsResponse> {
        const queryParams = new URLSearchParams();
        if (params?.vendor_id) queryParams.append('vendor_id', params.vendor_id.toString());
        if (params?.company_id) queryParams.append('company_id', params.company_id.toString());
        const query = queryParams.toString();
        return this.request<VendorStatsResponse>(`/vendors/stats/summary${query ? `?${query}` : ''}`);
    }

    async markVendorLogsAsPaid(ids: number[]) {
        return this.request<{ message: string; updatedCount: number }>('/vendors/logs/bulk-pay', {
            method: 'POST',
            body: JSON.stringify({ ids })

        });
    }

    async updateVendorTripLog(bookingId: number, vendorDistanceKm: number) {
        return this.request<{ success: boolean; vendor_cost: number }>(`/vendors/logs/${bookingId}`, {
            method: 'PATCH',
            body: JSON.stringify({ vendor_distance_km: vendorDistanceKm }),
        });
    }

    async createVendorPayment(data: CreateVendorPaymentRequest): Promise<VendorPaymentTransaction> {
        return this.request<VendorPaymentTransaction>('/vendors/payments', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getVendorPaymentHistory(bookingId: number): Promise<VendorPaymentTransaction[]> {
        return this.request<VendorPaymentTransaction[]>(`/vendors/payments/${bookingId}`);
    }

    async updateVendorPayment(id: number, data: UpdateVendorPaymentRequest): Promise<VendorPaymentTransaction> {
        return this.request<VendorPaymentTransaction>(`/vendors/payments/txn/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    // ===== DRIVERS =====

    async getDrivers(params: QueryDriverParams = {}): Promise<PaginatedResponse<Driver>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);
        if (params.company_id) query.append('company_id', params.company_id.toString());
        if (params.driver_type) query.append('driver_type', params.driver_type);
        if (params.status) query.append('status', params.status);

        const queryString = query.toString();
        const endpoint = `/drivers${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<Driver>>(endpoint);
    }

    async getPendingChauffeurs(params: QueryDriverParams = {}): Promise<PaginatedResponse<Driver>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);

        const queryString = query.toString();
        const endpoint = `/drivers/pending-chauffeurs${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<Driver>>(endpoint);
    }

    async getAvailableDrivers(params: QueryDriverParams = {}): Promise<PaginatedResponse<Driver>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);
        if (params.company_id) query.append('company_id', params.company_id.toString());
        if (params.driver_type) query.append('driver_type', params.driver_type.toString());
        const queryString = query.toString();
        const endpoint = `/drivers/available${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<Driver>>(endpoint);
    }

    async getDriver(id: string): Promise<DriverResponse> {
        return this.request<DriverResponse>(`/drivers/${id}`);
    }

    async getDriverReviews(id: string, page: number = 1, limit: number = 10): Promise<PaginatedResponse<RideReview>> {
        const query = new URLSearchParams();
        query.append('page', page.toString());
        query.append('limit', limit.toString());
        return this.request<PaginatedResponse<RideReview>>(`/drivers/${id}/reviews?${query.toString()}`);
    }

    async createDriver(data: CreateDriverRequest): Promise<DriverResponse> {
        if (data.profile_picture) {
            const formData = new FormData();
            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    formData.append(key, value instanceof File ? value : String(value));
                }
            });

            return this.request<DriverResponse>('/drivers', {
                method: 'POST',
                body: formData,
            });
        }

        return this.request<DriverResponse>('/drivers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateDriver(id: string, data: UpdateDriverRequest): Promise<DriverResponse> {
        if (data.profile_picture) {
            const formData = new FormData();
            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    formData.append(key, value instanceof File ? value : String(value));
                }
            });

            return this.request<DriverResponse>(`/drivers/${id}`, {
                method: 'PATCH',
                body: formData,
            });
        }

        return this.request<DriverResponse>(`/drivers/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async updateDriverStatus(id: string, data: UpdateDriverStatusRequest): Promise<DriverResponse> {
        return this.request<DriverResponse>(`/drivers/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async resetDriverPassword(id: string, password: string): Promise<{ message: string }> {
        return this.request<{ message: string }>(`/drivers/${id}/password`, {
            method: 'PATCH',
            body: JSON.stringify({ password }),
        });
    }

    async deleteDriver(id: string): Promise<void> {
        await this.request<void>(`/drivers/${id}`, {
            method: 'DELETE',
        });
    }

    // ===== CHAUFFEUR CONTRACTS =====

    async getChauffeurContracts(companyId: number): Promise<ChauffeurContractResponse> {
        return this.request<ChauffeurContractResponse>(`/contracts/chauffeur?companyId=${companyId}`);
    }

    async createChauffeurContract(data: CreateChauffeurContractRequest): Promise<SingleChauffeurContractResponse> {
        return this.request<SingleChauffeurContractResponse>('/contracts/chauffeur', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateChauffeurContract(id: number, data: UpdateChauffeurContractRequest): Promise<SingleChauffeurContractResponse> {
        return this.request<SingleChauffeurContractResponse>(`/contracts/chauffeur/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteChauffeurContract(id: number): Promise<void> {
        await this.request<void>(`/contracts/chauffeur/${id}`, {
            method: 'DELETE',
        });
    }

    async updateChauffeurRate(id: number, data: UpdateChauffeurContractRequest): Promise<void> {
        await this.request<void>(`/contracts/chauffeur/rate/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteChauffeurRate(id: number): Promise<void> {
        await this.request<void>(`/contracts/chauffeur/rate/${id}`, {
            method: 'DELETE',
        });
    }

    async previewRateAdjustments(newFuelPrice: number, companyId?: number, newDieselPrice?: number): Promise<any> {
        const query = new URLSearchParams();
        query.append('newFuelPrice', newFuelPrice.toString());
        if (companyId) query.append('companyId', companyId.toString());
        if (newDieselPrice != null) query.append('newDieselPrice', newDieselPrice.toString());

        return this.request<any>(`/contracts/chauffeur/preview-adjustments?${query.toString()}`);
    }

    async getAdjustedBillingRate(bookingId: number): Promise<any> {
        return this.request<any>(`/contracts/chauffeur/billing-rate/${bookingId}`);
    }

    // ===== SHUTTLE CONTRACTS =====

    async getShuttleContract(companyId: number): Promise<{ data: ShuttleContract | null }> {
        return this.request<{ data: ShuttleContract | null }>(`/contracts/shuttle/${companyId}`);
    }

    async createOrUpdateShuttleContract(data: CreateShuttleContractRequest): Promise<{ data: ShuttleContract }> {
        return this.request<{ data: ShuttleContract }>('/contracts/shuttle', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // ===== FIXED-TERM CONTRACTS =====

    async getFixedTermContracts(): Promise<{ data: FixedTermContract[] }> {
        return this.request<{ data: FixedTermContract[] }>('/contracts/fixed-term');
    }

    async createFixedTermContract(data: CreateFixedTermContractRequest): Promise<{ data: FixedTermContract }> {
        return this.request<{ data: FixedTermContract }>('/contracts/fixed-term', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateFixedTermContract(id: number, data: UpdateFixedTermContractRequest): Promise<{ data: FixedTermContract }> {
        return this.request<{ data: FixedTermContract }>(`/contracts/fixed-term/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteFixedTermContract(id: number): Promise<void> {
        await this.request<void>(`/contracts/fixed-term/${id}`, {
            method: 'DELETE',
        });
    }

    async settleFixedTermContract(
        id: number,
        data: SettleFixedTermContractRequest,
    ): Promise<{ data: { payment: FixedTermContractPayment } }> {
        return this.request<{ data: { payment: FixedTermContractPayment } }>(`/contracts/fixed-term/${id}/settle`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getFixedTermPayments(id: number): Promise<{ data: { payments: FixedTermContractPayment[] } }> {
        return this.request<{ data: { payments: FixedTermContractPayment[] } }>(`/contracts/fixed-term/${id}/payments`);
    }

    // ===== SYSTEM SETTINGS =====

    async getSystemSetting(key: string): Promise<SystemSettingResponse> {
        return this.request<SystemSettingResponse>(`/system-settings/${key}`);
    }

    async updateSystemSetting(key: string, value: string): Promise<SystemSettingResponse> {
        return this.request<SystemSettingResponse>(`/system-settings/${key}`, {
            method: 'PUT',
            body: JSON.stringify({ value }),
        });
    }

    async getAppConfig(): Promise<MobileAppConfig> {
        const res = await this.request<{ data: MobileAppConfig }>('/app-config');
        return res.data;
    }

    async updateAppConfig(data: UpdateMobileAppConfigRequest): Promise<MobileAppConfig> {
        const res = await this.request<{ data: MobileAppConfig }>('/app-config', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        return res.data;
    }

    async getFuelPriceHistory(fuelType: 'PETROL' | 'DIESEL'): Promise<FuelPriceHistoryResponse> {
        return this.request<FuelPriceHistoryResponse>(`/system-settings/fuel-price-history/${fuelType}`);
    }

    async getExternalFuelPricesLatest(): Promise<{ petrolPrice: string; dieselPrice: string; asOf?: string }> {
        const res = await this.request<{ data: { petrolPrice: string; dieselPrice: string; asOf?: string } }>(
            `/system-settings/external-fuel-prices/latest`,
        );
        return res.data;
    }

    // ===== CHAUFFEUR BOOKINGS =====

    async getBookingStats(params?: QueryBookingStatsParams): Promise<{ data: { total: number; pending: number; assigned: number; arrived: number; in_progress: number; ended: number; completed: number; cancelled: number } }> {
        const query = new URLSearchParams();
        if (params?.company_id) query.append('company_id', params.company_id.toString());
        if (params?.start_date) query.append('start_date', params.start_date);
        if (params?.end_date) query.append('end_date', params.end_date);
        const queryString = query.toString();
        return this.request<any>(`/admin/bookings/stats${queryString ? `?${queryString}` : ''}`);
    }

    async getAllBookings(params: QueryChauffeurBookingParams = {}): Promise<PaginatedResponse<ChauffeurBooking>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.status) query.append('status', params.status);
        if (params.search) query.append('search', params.search);
        if (params.company_id) query.append('company_id', params.company_id.toString());
        if (params.start_date) query.append('start_date', params.start_date);
        if (params.end_date) query.append('end_date', params.end_date);
        if (params.fulfillment_type) query.append('fulfillment_type', params.fulfillment_type);
        if (params.vehicle_id) query.append('vehicle_id', params.vehicle_id.toString());

        const queryString = query.toString();
        const endpoint = `/admin/bookings${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<ChauffeurBooking>>(endpoint);
    }

    async deleteBooking(id: number): Promise<void> {
        return this.request<void>(`/admin/bookings/${id}`, {
            method: 'DELETE',
        });
    }

    async createChauffeurBooking(companyId: number, data: CreateChauffeurBookingRequest): Promise<ChauffeurBookingResponse> {
        return this.request<ChauffeurBookingResponse>(`/companies/${companyId}/chauffeur-bookings`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async assignBooking(id: number, vehicleId: number, driverId: string): Promise<void> {
        return this.request<void>(`/admin/bookings/${id}/assign`, {
            method: 'PATCH',
            body: JSON.stringify({ vehicle_id: vehicleId, driver_id: driverId }),
        });
    }

    async updateBookingStatus(id: number, status: string): Promise<void> {
        return this.request<void>(`/admin/bookings/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    }

    /** Marketplace: approve a driver's pending accepted request — assigns the booking to them. */
    async confirmDriverRequest(id: number): Promise<void> {
        return this.request<void>(`/admin/bookings/${id}/confirm-driver-request`, {
            method: 'PATCH',
        });
    }

    /** Marketplace: reject a driver's pending accepted request — reopens the booking to broadcast. */
    async rejectDriverRequest(id: number): Promise<void> {
        return this.request<void>(`/admin/bookings/${id}/reject-driver-request`, {
            method: 'PATCH',
        });
    }

    async startTrip(id: number): Promise<ChauffeurBookingResponse> {
        return this.request<ChauffeurBookingResponse>(`/admin/bookings/${id}/start`, {
            method: 'PATCH',
        });
    }

    async endTrip(id: number, data: {
        total_distance_km: number,
        expense_toll?: number,
        expense_parking?: number,
        expense_toll_image_url?: string,
        expense_parking_image_url?: string,
        start_time?: string,
        end_time?: string,
        daily_logs?: DailyTripLog[],
        vendor_cost?: number,
        discount_type?: 'NONE' | 'PERCENTAGE' | 'FLAT',
        discount_value?: number,
        fuelMode?: 'CONTRACT' | 'SELECTED' | 'SYSTEM',
        selectedFuelPrice?: number,
    }): Promise<ChauffeurBookingResponse> {
        return this.request<ChauffeurBookingResponse>(`/admin/bookings/${id}/end`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async updateDailyLogs(id: number, data: { daily_logs: DailyTripLog[] }): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>(`/admin/bookings/${id}/daily-logs`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async completeTrip(id: number): Promise<ChauffeurBookingResponse> {
        return this.request<ChauffeurBookingResponse>(`/admin/bookings/${id}/complete`, {
            method: 'PATCH',
        });
    }

    async recalculateBooking(id: number, data: {
        package_selected?: string;
        booking_type?: string;
        no_of_days?: number;
        total_duration_minutes?: number;
        total_distance_km?: number;
        expense_toll?: number;
        expense_parking?: number;
        vendor_cost?: number;
        daily_logs?: DailyTripLog[];
        discount_type?: 'NONE' | 'PERCENTAGE' | 'FLAT';
        discount_value?: number;
        fuelMode?: 'CONTRACT' | 'SELECTED' | 'SYSTEM';
        selectedFuelPrice?: number;
    }): Promise<{ success: boolean; invoice_amount: number; invoice_number: string; savings: number }> {
        return this.request(`/admin/bookings/${id}/recalculate`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async updateBookingInfo(id: number, data: {
        package_selected?: string;
        booking_type?: string;
        no_of_days?: number;
        total_duration_minutes?: number;
        total_distance_km?: number;
        expense_toll?: number;
        expense_parking?: number;
        daily_logs?: DailyTripLog[];
    }): Promise<{ success: boolean }> {
        return this.request(`/admin/bookings/${id}/info`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async addPayment(bookingId: number, data: AddPaymentRequest) {
        return this.request(`/admin/bookings/${bookingId}/payments`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getPaymentHistory(bookingId: number) {
        return this.request(`/admin/bookings/${bookingId}/payments`, {
            method: 'GET',
        });
    }

    async getPaymentSummary(bookingId: number) {
        return this.request(`/admin/bookings/${bookingId}/payment-summary`, {
            method: 'GET',
        });
    }

    async getCompanyChauffeurBookings(companyId: number, params: QueryChauffeurBookingParams = {}): Promise<PaginatedResponse<ChauffeurBooking>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.status) query.append('status', params.status);
        if (params.search) query.append('search', params.search);
        if (params.fulfillment_type) query.append('fulfillment_type', params.fulfillment_type);

        const queryString = query.toString();
        const endpoint = `/companies/${companyId}/chauffeur-bookings${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<ChauffeurBooking>>(endpoint);
    }

    async getCompanyChauffeurBooking(companyId: number, bookingId: number): Promise<ChauffeurBookingResponse> {
        return this.request<ChauffeurBookingResponse>(`/companies/${companyId}/chauffeur-bookings/${bookingId}`);
    }

    async getCompanyDashboardStats(companyId: string | number): Promise<any> {
        return this.request<any>(`/companies/${companyId}/dashboard-stats`);
    }

    async getTodayShuttleTrips(companyId: string | number): Promise<any> {
        return this.request<any>(`/shuttle-trips/today?company_id=${companyId}`);
    }

    /** Admin/driver: mark a shuttle trip COMPLETED (force-end when driver forgot). */
    async completeShuttleTrip(
        tripId: number,
        data: { total_distance?: number; end_time?: string } = {},
    ): Promise<any> {
        return this.request<any>(`/shuttle-trips/${tripId}/complete`, {
            method: 'POST',
            body: JSON.stringify({
                total_distance: data.total_distance ?? 0,
                ...(data.end_time ? { end_time: data.end_time } : {}),
            }),
        });
    }

    /** Admin: cancel a scheduled/in-progress trip, or restore a cancelled trip to SCHEDULED. */
    async updateShuttleTripStatus(
        tripId: number,
        status: 'SCHEDULED' | 'CANCELLED',
    ): Promise<any> {
        return this.request<any>(`/shuttle-trips/${tripId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    }

    /** Admin: change driver and/or vehicle on a scheduled or in-progress shuttle trip. */
    async updateShuttleTripAssignment(
        tripId: number,
        data: { driver_id?: string; vehicle_id?: number },
    ): Promise<any> {
        return this.request<any>(`/shuttle-trips/${tripId}/assignment`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async setShuttleTripResourceOverride(
        tripId: number,
        data: { driver_id?: string; vehicle_id?: number },
    ): Promise<any> {
        return this.request<any>(`/shuttle-trips/${tripId}/resource-override`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async clearShuttleTripResourceOverride(tripId: number): Promise<any> {
        return this.request<any>(`/shuttle-trips/${tripId}/resource-override`, {
            method: 'DELETE',
        });
    }

    async getActiveBookingLocations(): Promise<any> {
        return this.request<any>(`/admin/bookings/active-locations`);
    }

    async getActiveCompanyChauffeurBookings(companyId: string | number): Promise<any> {
        // Fetch bookings that are currently in-progress for this company
        return this.request<any>(
            `/companies/${companyId}/chauffeur-bookings?status=IN_PROGRESS&limit=50`,
        );
    }

    async getEmployeesByCompany(companyId: string | number): Promise<any> {
        return this.request<any>(`/employees/company/${companyId}`);
    }

    async toggleEmployeeStatus(id: string, activate: boolean): Promise<any> {
        return this.request<any>(`/employees/${id}/${activate ? 'activate' : 'deactivate'}`, {
            method: 'POST',
        });
    }

    async assignEmployeeToRoute(data: { user_id: string; route_id: number; pickup_stop_id?: number; office_stop_id?: number }): Promise<any> {
        return this.request<any>('/employee-route-assignments/assign', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // ===== REPORTS =====

    async getChauffeurReports(companyId: number, params: ReportQueryParams = {}): Promise<PaginatedResponse<ChauffeurReport>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);

        const queryString = query.toString();
        const endpoint = `/companies/${companyId}/reports/chauffeur${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<ChauffeurReport>>(endpoint);
    }

    async getAllChauffeurReports(params: ReportQueryParams = {}): Promise<PaginatedResponse<ChauffeurReport>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);

        const queryString = query.toString();
        const endpoint = `/companies/reports/all-chauffeur${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<ChauffeurReport>>(endpoint);
    }

    async getShuttleReports(companyId: number, params: ReportQueryParams = {}): Promise<PaginatedResponse<ShuttleReport>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.routeId) query.append('routeId', params.routeId.toString());

        const queryString = query.toString();
        const endpoint = `/companies/${companyId}/reports/shuttle${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<ShuttleReport>>(endpoint);
    }

    async getAllShuttleReports(params: ReportQueryParams = {}): Promise<PaginatedResponse<ShuttleReport>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.routeId) query.append('routeId', params.routeId.toString());

        const queryString = query.toString();
        const endpoint = `/companies/reports/all-shuttle${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<ShuttleReport>>(endpoint);
    }

    // ===== INVOICES =====

    async generateTripInvoice(bookingId: number) {
        return this.request('/invoices/generate', {
            method: 'POST',
            body: JSON.stringify({ bookingId })
        });
    }

    async generateShuttleInvoice(
        contractId: number,
        options?: {
            billingMonth?: string;
            continuedVehicles?: number;
            amountMode?: 'EXACT' | 'LESS' | 'MORE';
            amountDelta?: number;
            billingPeriod?: 'MONTHLY' | 'WEEKLY';
            weeklyStartDate?: string;
            weeklyEndDate?: string;
            routeTrips?: { routeId: number; tripsCount: number; tripDate?: string; quantity?: number }[];
            discountType?: 'NONE' | 'PERCENTAGE' | 'FLAT';
            discountValue?: number;
            vendorId?: number;
            vendorCost?: number;
            fuelMode?: 'CONTRACT' | 'SELECTED' | 'SYSTEM';
            selectedFuelPrice?: number;
            selectedDieselPrice?: number;
        }
    ) {
        return this.request('/invoices/generate/shuttle', {
            method: 'POST',
            body: JSON.stringify({ contractId, ...options }),
        });
    }

    async settleShuttleInvoice(
        invoiceId: number,
        data: { amount: number; paymentType?: 'PARTIAL' | 'FINAL'; paymentMethod?: string; notes?: string; paymentDate?: string }
    ) {
        return this.request(`/invoices/${invoiceId}/settle`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getShuttleInvoicePayments(invoiceId: number): Promise<any> {
        return this.request(`/invoices/${invoiceId}/payments`);
    }

    async getPendingTrips(): Promise<any> {
        return this.request('/invoices/pending-trips');
    }

    async getAllInvoices(params: QueryInvoiceParams = {}): Promise<PaginatedResponse<Invoice>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', String(params.page));
        if (params.limit) query.append('limit', String(params.limit));
        if (params.status) query.append('status', params.status);
        if (params.company_id) query.append('company_id', String(params.company_id));

        const queryString = query.toString();
        const endpoint = `/invoices${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<Invoice>>(endpoint);
    }

    async getInvoiceStats(companyId?: number): Promise<any> {
        const query = companyId ? `?company_id=${companyId}` : '';
        return this.request<any>(`/invoices/stats${query}`);
    }

    async getCompanyInvoices(companyId: number, params: QueryInvoiceParams = {}): Promise<PaginatedResponse<Invoice>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);

        const queryString = query.toString();
        const endpoint = `/companies/${companyId}/invoices${queryString ? `?${queryString}` : ''}`;

        return this.request<PaginatedResponse<Invoice>>(endpoint);
    }

    async getMyContract(): Promise<any> {
        return this.request<any>('/contracts/my-contract');
    }

    async downloadInvoicePdf(id: number, invoiceNumber: string): Promise<void> {
        return this.downloadPdf(`/invoices/${id}/pdf`, `invoice-${invoiceNumber}.pdf`);
    }

    async viewInvoicePdf(id: number): Promise<void> {
        return this.viewPdf(`/invoices/${id}/pdf`);
    }

    async sendInvoiceEmail(id: number): Promise<any> {
        return this.request<any>(`/invoices/${id}/send-email`, {
            method: 'POST',
        });
    }

    async updateInvoiceStatus(id: number, status: string): Promise<any> {
        return this.request<any>(`/invoices/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    }

    async deleteInvoice(id: number): Promise<any> {
        return this.request<any>(`/invoices/${id}`, {
            method: 'DELETE',
        });
    }

    // ===== FUEL RECORDS =====

    async getFuelRecords(params: QueryFuelRecordParams = {}): Promise<PaginatedResponse<FuelRecord>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', String(params.page));
        if (params.limit) query.append('limit', String(params.limit));
        if (params.vehicle_id) query.append('vehicle_id', String(params.vehicle_id));
        if (params.start_date) query.append('start_date', params.start_date);
        if (params.end_date) query.append('end_date', params.end_date);
        if (params.billed !== undefined) query.append('billed', String(params.billed));

        const queryString = query.toString();
        return this.request<PaginatedResponse<FuelRecord>>(`/vehicle-fuel${queryString ? `?${queryString}` : ''}`);
    }

    async getPreviousFuelOdometer(params: {
        vehicle_id: number;
        before_record_id?: number;
        exclude_id?: number;
    }): Promise<{ data: { id: number; odometer_reading: number; date: string } | null }> {
        const query = new URLSearchParams();
        query.append('vehicle_id', String(params.vehicle_id));
        if (params.before_record_id) query.append('before_record_id', String(params.before_record_id));
        if (params.exclude_id) query.append('exclude_id', String(params.exclude_id));

        return this.request(`/vehicle-fuel/previous-odometer?${query.toString()}`);
    }

    async createFuelRecord(data: CreateFuelRecordRequest): Promise<FuelRecordResponse> {
        return this.request<FuelRecordResponse>('/vehicle-fuel', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getFuelRecord(id: number): Promise<FuelRecordResponse> {
        return this.request<FuelRecordResponse>(`/vehicle-fuel/${id}`);
    }

    async updateFuelRecord(id: number, data: UpdateFuelRecordRequest): Promise<FuelRecordResponse> {
        return this.request<FuelRecordResponse>(`/vehicle-fuel/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteFuelRecord(id: number): Promise<{ data: DeleteRecordResult; statusCode: number; message: string }> {
        return this.request(`/vehicle-fuel/${id}`, {
            method: 'DELETE',
        });
    }

    async markFuelRecordsAsPaid(data: BulkPayFuelRequest): Promise<{ message: string }> {
        return this.request<{ message: string }>('/vehicle-fuel/bulk-pay', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getFuelStats(): Promise<FuelStatsResponse> {
        return this.request<FuelStatsResponse>('/vehicle-fuel/stats');
    }

    // ===== MAINTENANCE RECORDS =====

    async getMaintenanceRecords(params: QueryMaintenanceRecordParams = {}): Promise<PaginatedResponse<MaintenanceRecord>> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', String(params.page));
        if (params.limit) query.append('limit', String(params.limit));
        if (params.vehicle_id) query.append('vehicle_id', String(params.vehicle_id));
        if (params.maintenance_type) query.append('maintenance_type', params.maintenance_type);
        if (params.start_date) query.append('start_date', params.start_date);
        if (params.end_date) query.append('end_date', params.end_date);

        const queryString = query.toString();
        return this.request<PaginatedResponse<MaintenanceRecord>>(`/vehicle-maintenance${queryString ? `?${queryString}` : ''}`);
    }

    async createMaintenanceRecord(data: CreateMaintenanceRecordRequest): Promise<MaintenanceRecordResponse> {
        return this.request<MaintenanceRecordResponse>('/vehicle-maintenance', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getMaintenanceRecord(id: number): Promise<MaintenanceRecordResponse> {
        return this.request<MaintenanceRecordResponse>(`/vehicle-maintenance/${id}`);
    }

    async updateMaintenanceRecord(id: number, data: UpdateMaintenanceRecordRequest): Promise<MaintenanceRecordResponse> {
        return this.request<MaintenanceRecordResponse>(`/vehicle-maintenance/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteMaintenanceRecord(id: number): Promise<{ data: DeleteRecordResult; statusCode: number; message: string }> {
        return this.request(`/vehicle-maintenance/${id}`, {
            method: 'DELETE',
        });
    }

    async getUpcomingMaintenance(): Promise<UpcomingMaintenanceResponse> {
        return this.request<UpcomingMaintenanceResponse>('/vehicle-maintenance/upcoming');
    }

    async markMaintenanceRecordAsPaid(id: number): Promise<MaintenanceRecordResponse> {
        return this.request<MaintenanceRecordResponse>(`/vehicle-maintenance/${id}/pay`, {
            method: 'POST',
        });
    }

    // ===== COMPANY FEATURES =====

    async getCompanyFeatures(companyId: number) {
        return this.request<{ success: boolean; data: CompanyFeature[] }>(`/companies/${companyId}/features`);
    }

    async upsertCompanyFeature(companyId: number, dto: { feature_key: string; is_enabled: boolean; config?: Record<string, unknown> }) {
        return this.request<{ success: boolean; data: CompanyFeature }>(`/admin/companies/${companyId}/features`, {
            method: 'PUT',
            body: JSON.stringify(dto),
        });
    }

    async bulkUpsertCompanyFeatures(companyId: number, features: { feature_key: string; is_enabled: boolean; config?: Record<string, unknown> }[]) {
        return this.request<{ success: boolean; data: CompanyFeature[] }>(`/admin/companies/${companyId}/features/bulk`, {
            method: 'PUT',
            body: JSON.stringify({ features }),
        });
    }

    // ===== EXTERNAL VENDORS (admin) =====

    async getExternalVendors(params?: { page?: number; limit?: number; search?: string; company_id?: number }) {
        const query = new URLSearchParams();
        if (params?.page) query.append('page', String(params.page));
        if (params?.limit) query.append('limit', String(params.limit));
        if (params?.search) query.append('search', params.search);
        if (params?.company_id) query.append('company_id', String(params.company_id));
        return this.request<{ success: boolean; data: { data: ExternalVendor[]; pagination: Pagination } }>(`/admin/external-vendors?${query}`);
    }

    async getExternalVendor(id: number) {
        return this.request<{ success: boolean; data: ExternalVendor }>(`/admin/external-vendors/${id}`);
    }

    async createExternalVendor(dto: { name: string; contact_email: string; password: string; contact_phone?: string }) {
        return this.request<{ success: boolean; data: ExternalVendor }>('/admin/external-vendors', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async updateExternalVendor(id: number, dto: { name?: string; contact_phone?: string; is_active?: boolean }) {
        return this.request<{ success: boolean; data: ExternalVendor }>(`/admin/external-vendors/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async deactivateExternalVendor(id: number) {
        return this.request<{ success: boolean }>(`/admin/external-vendors/${id}`, {
            method: 'DELETE',
        });
    }

    async createVendorLink(vendorId: number, dto: { company_id: number; serves_chauffeur?: boolean; serves_shuttle?: boolean }) {
        return this.request<{ success: boolean; data: CompanyVendorLink }>(`/admin/external-vendors/${vendorId}/links`, {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async getVendorLinks(vendorId: number) {
        return this.request<{ success: boolean; data: CompanyVendorLink[] }>(`/admin/external-vendors/${vendorId}/links`);
    }

    async updateVendorLink(linkId: number, dto: { serves_chauffeur?: boolean; serves_shuttle?: boolean; is_active?: boolean }) {
        return this.request<{ success: boolean; data: CompanyVendorLink }>(`/admin/external-vendors/links/${linkId}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async removeVendorLink(linkId: number) {
        return this.request<{ success: boolean }>(`/admin/external-vendors/links/${linkId}`, {
            method: 'DELETE',
        });
    }

    async getCompanyExternalVendors(companyId: number) {
        return this.request<{ success: boolean; data: CompanyVendorLink[] }>(`/admin/companies/${companyId}/external-vendors`);
    }

    // ===== VENDOR DASHBOARD =====

    async getVendorDashboard() {
        return this.request<{ success: boolean; data: VendorDashboardStats }>('/vendor/dashboard');
    }

    async getVendorRequests(params?: { link_id?: number; status?: string; page?: number; limit?: number }) {
        const query = new URLSearchParams();
        if (params?.link_id) query.append('link_id', String(params.link_id));
        if (params?.status) query.append('status', params.status);
        if (params?.page) query.append('page', String(params.page));
        if (params?.limit) query.append('limit', String(params.limit));
        return this.request<{ success: boolean; data: { data: BookingVendorRequest[]; pagination: Pagination } }>(`/vendor/requests?${query}`);
    }

    async assignVendorRequest(requestId: number, dto: { vehicle_id: number; driver_user_id: string }) {
        return this.request<{ success: boolean; data: BookingVendorRequest }>(`/vendor/requests/${requestId}/assign`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async rejectVendorRequest(requestId: number) {
        return this.request<{ success: boolean; data: BookingVendorRequest }>(`/vendor/requests/${requestId}/reject`, {
            method: 'PATCH',
        });
    }

    async getVendorBookings(params?: { link_id?: number; status?: string; page?: number; limit?: number }) {
        const query = new URLSearchParams();
        if (params?.link_id) query.append('link_id', String(params.link_id));
        if (params?.status) query.append('status', params.status);
        if (params?.page) query.append('page', String(params.page));
        if (params?.limit) query.append('limit', String(params.limit));
        return this.request<{ success: boolean; data: { data: ChauffeurBooking[]; pagination: Pagination } }>(`/vendor/bookings?${query}`);
    }

    async vendorUpdateStatus(bookingId: number, status: 'OTW' | 'ARRIVED') {
        return this.request<{ success: boolean }>(`/vendor/bookings/${bookingId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    }

    async vendorStartTrip(bookingId: number) {
        return this.request<{ success: boolean; data: { success: boolean } }>(`/vendor/bookings/${bookingId}/start`, {
            method: 'PATCH',
        });
    }

    async vendorEndTrip(bookingId: number, dto: {
        total_distance_km: number;
        expense_toll?: number;
        expense_parking?: number;
        end_time?: string;
        start_time?: string;
    }) {
        return this.request<{ success: boolean; data: { success: boolean } }>(`/vendor/bookings/${bookingId}/end`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    // ===== VENDOR FLEET =====

    async getVendorVehicles(linkId: number) {
        return this.request<{ success: boolean; data: VendorVehicle[] }>(`/vendor/fleet/vehicles?link_id=${linkId}`);
    }

    async createVendorVehicle(dto: {
        company_vendor_link_id: number;
        plate_number: string;
        make: string;
        model: string;
        year: number;
        color?: string;
        category: string;
        fuel_avg_city: number;
        fuel_avg_highway: number;
    }) {
        return this.request<{ success: boolean; data: VendorVehicle }>('/vendor/fleet/vehicles', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async updateVendorVehicle(id: number, dto: Partial<{ plate_number: string; make: string; model: string; year: number; color: string; category: string; fuel_avg_city: number; fuel_avg_highway: number }>) {
        return this.request<{ success: boolean; data: VendorVehicle }>(`/vendor/fleet/vehicles/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async removeVendorVehicle(id: number) {
        return this.request<{ success: boolean }>(`/vendor/fleet/vehicles/${id}`, {
            method: 'DELETE',
        });
    }

    async getVendorDrivers(linkId: number) {
        return this.request<{ success: boolean; data: VendorDriver[] }>(`/vendor/fleet/drivers?link_id=${linkId}`);
    }

    async createVendorDriver(dto: {
        company_vendor_link_id: number;
        email: string;
        password: string;
        full_name: string;
        phone?: string;
        driver_type: string;
        cnic_number?: string;
        license_number?: string;
    }) {
        return this.request<{ success: boolean; data: VendorDriver }>('/vendor/fleet/drivers', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async removeVendorDriver(userId: string) {
        return this.request<{ success: boolean }>(`/vendor/fleet/drivers/${userId}`, {
            method: 'DELETE',
        });
    }

    // ===== VENDOR ROUTES =====

    async getVendorRoutes(linkId?: number) {
        const query = linkId ? `?link_id=${linkId}` : '';
        return this.request<{ success: boolean; data: VendorRoute[] }>(`/vendor/routes${query}`);
    }

    async getVendorRoute(routeId: number) {
        return this.request<{ success: boolean; data: VendorRoute }>(`/vendor/routes/${routeId}`);
    }

    async createVendorRoute(dto: {
        name: string;
        company_vendor_link_id: number;
        assigned_vehicle_id?: number;
        assigned_driver_id?: string;
        stops?: Array<{ name: string; lat?: number; lng?: number; morning_eta?: string; evening_eta?: string; sequence_order: number }>;
    }) {
        return this.request<{ success: boolean; data: VendorRoute }>('/vendor/routes', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async updateVendorRoute(routeId: number, dto: {
        name?: string;
        assigned_vehicle_id?: number | null;
        assigned_driver_id?: string | null;
    }) {
        return this.request<{ success: boolean; data: VendorRoute }>(`/vendor/routes/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async getVendorRoutePolyline(routeId: number) {
        return this.request<{ points: { lat: number; lng: number }[] }>(`/vendor/routes/${routeId}/polyline`);
    }

    async previewVendorRoutePolyline(stops: { lat: number; lng: number }[]) {
        return this.request<{ points: { lat: number; lng: number }[] }>('/vendor/routes/preview-polyline', {
            method: 'POST',
            body: JSON.stringify({ stops }),
        });
    }

    async addVendorRouteStop(routeId: number, dto: {
        name: string;
        sequence_order: number;
        lat?: number;
        lng?: number;
        morning_eta?: string;
        evening_eta?: string;
    }) {
        return this.request<{ success: boolean; data: unknown }>(`/vendor/routes/${routeId}/stops`, {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async updateVendorRouteStop(stopId: number, dto: {
        name?: string;
        sequence_order?: number;
        lat?: number;
        lng?: number;
        morning_eta?: string | null;
        evening_eta?: string | null;
    }) {
        return this.request<{ success: boolean; data: unknown }>(`/vendor/routes/stops/${stopId}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async deleteVendorRouteStop(stopId: number) {
        return this.request<{ success: boolean }>(`/vendor/routes/stops/${stopId}`, {
            method: 'DELETE',
        });
    }

    // ===== COMPANY POOL =====

    async getPoolVehicles(companyId: number) {
        return this.request<{ success: boolean; data: PoolVehicle[] }>(`/companies/${companyId}/pool/vehicles`);
    }

    async createPoolVehicle(companyId: number, dto: {
        plate_number: string;
        make: string;
        model: string;
        year: number;
        color?: string;
        category: string;
        fuel_avg_city: number;
        fuel_avg_highway: number;
        seat_capacity?: number;
    }) {
        return this.request<{ success: boolean; data: PoolVehicle }>(`/companies/${companyId}/pool/vehicles`, {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async updatePoolVehicle(companyId: number, vehicleId: number, dto: Record<string, unknown>) {
        return this.request<{ success: boolean; data: PoolVehicle }>(`/companies/${companyId}/pool/vehicles/${vehicleId}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async deactivatePoolVehicle(companyId: number, vehicleId: number) {
        return this.request<{ success: boolean }>(`/companies/${companyId}/pool/vehicles/${vehicleId}`, {
            method: 'DELETE',
        });
    }

    async getPoolDrivers(companyId: number) {
        return this.request<{ success: boolean; data: PoolDriver[] }>(`/companies/${companyId}/pool/drivers`);
    }

    async invitePoolDriver(companyId: number, dto: {
        email: string;
        password: string;
        full_name: string;
        phone?: string;
        driver_type: string;
        cnic_number?: string;
        license_number?: string;
    }) {
        return this.request<{ success: boolean; data: PoolDriver }>(`/companies/${companyId}/pool/drivers`, {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async deactivatePoolDriver(companyId: number, userId: string) {
        return this.request<{ success: boolean }>(`/companies/${companyId}/pool/drivers/${userId}`, {
            method: 'DELETE',
        });
    }

    // ===== COMPANY SHUTTLE FLEET =====

    async getShuttleVehicles(companyId: number) {
        return this.request<{ success: boolean; data: PoolVehicle[] }>(`/companies/${companyId}/shuttle/vehicles`);
    }

    async createShuttleVehicle(companyId: number, dto: {
        plate_number: string;
        make: string;
        model: string;
        year: number;
        color?: string;
        category: string;
        fuel_avg_city: number;
        fuel_avg_highway: number;
        seat_capacity: number;
    }) {
        return this.request<{ success: boolean; data: PoolVehicle }>(`/companies/${companyId}/shuttle/vehicles`, {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async getShuttleDrivers(companyId: number) {
        return this.request<{ success: boolean; data: PoolDriver[] }>(`/companies/${companyId}/shuttle/drivers`);
    }

    async inviteShuttleDriver(companyId: number, dto: {
        email: string;
        password: string;
        full_name: string;
        phone?: string;
        cnic_number?: string;
        license_number?: string;
    }) {
        return this.request<{ success: boolean; data: PoolDriver }>(`/companies/${companyId}/shuttle/drivers`, {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async previewCompanyRoutePolyline(stops: { lat: number; lng: number }[]) {
        return this.request<{ points: { lat: number; lng: number }[] }>('/routes/preview-polyline', {
            method: 'POST',
            body: JSON.stringify({ stops }),
        });
    }

    async createCompanyRoute(dto: {
        name: string;
        company_id: number;
        assigned_vehicle_id?: number;
        assigned_driver_id?: string;
        stops?: Array<{
            name: string;
            lat: number;
            lng: number;
            morning_eta?: string;
            evening_eta?: string;
            sequence_order: number;
            stop_type?: 'PICKUP' | 'OFFICE';
        }>;
    }) {
        return this.request<unknown>('/routes', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async updateCompanyRoute(routeId: number, dto: {
        name?: string;
        assigned_vehicle_id?: number | null;
        assigned_driver_id?: string | null;
    }) {
        return this.request<unknown>(`/routes/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async addCompanyRouteStop(routeId: number, dto: {
        name: string;
        lat: number;
        lng: number;
        sequence_order: number;
        direction?: 'MORNING' | 'EVENING' | 'BOTH';
        morning_eta?: string | null;
        evening_eta?: string | null;
        morning_sequence?: number;
        evening_sequence?: number;
        stop_type?: 'PICKUP' | 'OFFICE';
    }) {
        return this.request<unknown>(`/routes/${routeId}/stops`, {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async updateCompanyRouteStop(stopId: number, dto: {
        name?: string;
        lat?: number;
        lng?: number;
        sequence_order?: number;
        direction?: 'MORNING' | 'EVENING' | 'BOTH';
        morning_eta?: string | null;
        evening_eta?: string | null;
        morning_sequence?: number;
        evening_sequence?: number;
        stop_type?: 'PICKUP' | 'OFFICE';
    }) {
        return this.request<unknown>(`/routes/stops/${stopId}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async deleteCompanyRouteStop(stopId: number) {
        return this.request<unknown>(`/routes/stops/${stopId}`, {
            method: 'DELETE',
        });
    }

    async optimizeCompanyRoute(routeId: number) {
        return this.request<unknown>(`/routes/${routeId}/optimize`, {
            method: 'POST',
        });
    }

    async removeEmployeeFromRoute(userId: string) {
        return this.request<unknown>(`/employee-route-assignments/remove/${userId}`, {
            method: 'DELETE',
        });
    }

    async generateShuttleTripsForRoute(routeId: number, dates: string[]) {
        return this.request<unknown>('/shuttle-trips/generate-for-route', {
            method: 'POST',
            body: JSON.stringify({ route_id: routeId, dates }),
        });
    }

    // ===== BOOKING VENDOR REQUESTS =====

    async getBookingVendorRequests(companyId: number, bookingId: number) {
        return this.request<{ success: boolean; data: BookingVendorRequest[] }>(`/companies/${companyId}/chauffeur-bookings/${bookingId}/vendor-requests`);
    }

    async confirmVendorForBooking(companyId: number, bookingId: number, requestId: number) {
        return this.request<{ success: boolean; data: ChauffeurBooking }>(`/companies/${companyId}/chauffeur-bookings/${bookingId}/confirm-vendor`, {
            method: 'PATCH',
            body: JSON.stringify({ request_id: requestId }),
        });
    }

    // ===== TRACKER CONFIG =====

    async getTrackerConfig(companyId: number) {
        return this.request<{ success: boolean; data: TrackerConfig }>(`/companies/${companyId}/tracker/config`);
    }

    async upsertTrackerConfig(companyId: number, dto: {
        api_endpoint?: string;
        api_key?: string;
        config?: {
            user_id?: string;
            password?: string;
            phone?: string;
            year?: string;
            [key: string]: unknown;
        };
    }) {
        return this.request<{ success: boolean; data: TrackerConfig }>(`/companies/${companyId}/tracker/config`, {
            method: 'PUT',
            body: JSON.stringify(dto),
        });
    }

    /** Test TPL Trakker connection — returns all vehicles the account is tracking */
    async getActiveTrackerVehicles(companyId: number): Promise<{
        success: boolean;
        data: Array<{ RegNo: string; Lat: string; Long: string; Speed: string; GpsDateTime: string }>;
        message: string;
    }> {
        return this.request(`/companies/${companyId}/tracker/active-vehicles`);
    }

    // ===== DASHBOARD =====

    async getSuperAdminDashboardStats(startDate?: string, endDate?: string) {
        let query = '';
        if (startDate && endDate) {
            query = `?startDate=${startDate}&endDate=${endDate}`;
        }
        return this.request<{
            totalRevenue: { current: number; previous: number; percentageChange: number; trend: string };
            totalCOGS: { current: number; previous: number; percentageChange: number; trend: string };
            grossProfit: { current: number; previous: number; percentageChange: number; trend: string };
            netMargin: { current: number; previous: number; percentageChange: number; trend: string };
            ridesBreakdown: { name: string; value: number }[];
            expensesBreakdown: { name: string; value: number }[];
            fuelExpenses: { name: string; value: number }[];
            repairExpenses: { name: string; value: number }[];
            oilMaintenanceExpenses: { name: string; value: number }[];
            revenueByClient: { name: string; value: number }[];
            profitPerRide: number;
            costPerRide: number;
            totalReceivables: number;
            totalPayables: number;
            currentPeriodReceivables: number | null;
            currentPeriodPayables: number | null;
            totalUnassignedBookings: number;
            receivablesByClient: { name: string; value: number }[];
            overdueInvoices: {
                id: number;
                invoice_number: string;
                company_name: string;
                total_amount: number;
                generated_at: string;
                status: string;
            }[];
            revenueBreakdown: { name: string; value: number }[];
            problemReports: {
                id: number;
                message: string;
                issue_type?: 'app_issue' | 'ride_issue' | 'other' | null;
                created_at: string;
                reported_by_user_id: string;
                company_id: number | null;
                reporter_name: string;
                reporter_email: string;
                reporter_role: string;
                company_name: string | null;
            }[];
            alerts: any[];
        }>(`/admin/reports/dashboard${query}`);
    }

    async generateSuperAdminAiInsights(
        startDate?: string,
        endDate?: string,
        mode: 'finance' | 'general' = 'finance',
    ) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (mode) params.append('mode', mode);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request<{
            financialBrief: {
                health: 'healthy' | 'watch' | 'critical';
                plNarrative: string;
                cashRisks: string;
                unitEconomics: string;
                actions: {
                    priority: number;
                    title: string;
                    detail: string;
                    category: string;
                }[];
            };
            briefing: {
                id: string;
                severity: 'high' | 'medium' | 'low';
                category: string;
                title: string;
                summary: string;
                recommendation: string;
                relatedMetric?: string;
            }[];
            companies: {
                companyId: number;
                companyName: string;
                severity: 'high' | 'medium' | 'low';
                reason: string;
                suggestedAction: string;
                href: string;
            }[];
        }>(`/admin/reports/ai-insights${query}`, { method: 'POST' });
    }

    /** Traflinq landing page leads (superadmin UI; requires same auth as dashboard). */
    async getLandingLeads() {
        return this.request<{
            data: {
                id: number;
                name: string;
                role: string;
                email: string;
                phone: string;
                organization: string;
                country: string;
                city: string;
                fleet_size: string;
                primary_goal: string;
                created_at: string;
            }[];
        }>('/admin/leads');
    }

    /** Traflinq Explore page trial leads (superadmin UI; requires same auth as dashboard). */
    async getTrialLeads() {
        return this.request<{
            data: {
                id: number;
                name: string;
                role: string | null;
                email: string;
                phone: string | null;
                organization: string | null;
                country: string | null;
                locale: string | null;
                modules: string;
                created_at: string;
            }[];
        }>('/admin/leads/trial');
    }

    // ---------------------------------------------------------------------------
    // Web Push
    // ---------------------------------------------------------------------------

    async getVapidPublicKey(): Promise<string> {
        const res = await this.request<{ publicKey: string }>('/notifications/web-push/vapid-key');
        return res.publicKey;
    }

    async saveWebPushSubscription(sub: { endpoint: string; p256dh: string; auth: string; userAgent?: string }): Promise<void> {
        await this.request<void>('/notifications/web-push/subscription', {
            method: 'POST',
            body: JSON.stringify(sub),
        });
    }

    async deleteWebPushSubscription(): Promise<void> {
        await this.request<void>('/notifications/web-push/subscription', { method: 'DELETE' });
    }
}

export const apiClient = new ApiClient();

export const ExpensesApi = {
    getAll: async (params?: ExpenseFilterParams) => {
        const query = new URLSearchParams();
        if (params?.startDate) query.append('startDate', params.startDate);
        if (params?.endDate) query.append('endDate', params.endDate);
        if (params?.category) query.append('category', params.category);
        if (params?.page) query.append('page', String(params.page));
        if (params?.limit) query.append('limit', String(params.limit));

        return apiClient.request<ExpensesListResult>(`/expenses?${query.toString()}`);
    },

    create: async (data: CreateExpenseRequest) => {
        return apiClient.request<Expense>('/expenses', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: async (id: number, data: UpdateExpenseRequest) => {
        return apiClient.request<Expense>(`/expenses/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    delete: async (id: number) => {
        return apiClient.request<{ data: DeleteRecordResult; statusCode: number; message: string }>(`/expenses/${id}`, {
            method: 'DELETE',
        });
    },

    markAsPaid: async (id: number) => {
        return apiClient.request<Expense>(`/expenses/${id}/pay`, {
            method: 'POST',
        });
    },
};

// ===== PERMISSIONS / INTERNAL STAFF =====

export interface InternalStaffMember {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    status: string | null;
    created_at: string | null;
    permissions: StaffPermissions;
    permissions_updated_at: string | null;
}

export interface CreateInternalStaffRequest {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    permissions?: Partial<StaffPermissions>;
}

export const PermissionsApi = {
    listStaff: () =>
        apiClient.request<{ success: boolean; data: InternalStaffMember[] }>('/permissions/staff'),

    getStaff: (id: string) =>
        apiClient.request<{ success: boolean; data: InternalStaffMember }>(`/permissions/staff/${id}`),

    createStaff: (data: CreateInternalStaffRequest) =>
        apiClient.request<{ success: boolean; data: InternalStaffMember }>('/permissions/staff', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updatePermissions: (id: string, permissions: Partial<StaffPermissions>) =>
        apiClient.request<{ success: boolean; data: { user_id: string; permissions: StaffPermissions } }>(
            `/permissions/staff/${id}/permissions`,
            {
                method: 'PUT',
                body: JSON.stringify({ permissions }),
            },
        ),

    deactivate: (id: string) =>
        apiClient.request<{ success: boolean; message: string }>(`/permissions/staff/${id}/deactivate`, {
            method: 'PATCH',
        }),

    reactivate: (id: string) =>
        apiClient.request<{ success: boolean; message: string }>(`/permissions/staff/${id}/reactivate`, {
            method: 'PATCH',
        }),
};

