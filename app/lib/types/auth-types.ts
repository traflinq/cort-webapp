// User roles enum - matches backend
export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    INTERNAL_STAFF = 'INTERNAL_STAFF',
    COMPANY_ADMIN = 'COMPANY_ADMIN',
    EMPLOYEE = 'EMPLOYEE',
    DRIVER = 'DRIVER',
    COMPANY_VENDOR = 'COMPANY_VENDOR',
}

// All granular permission keys — mirrors backend PERMISSION_KEYS constant
export const PERMISSION_KEYS = [
    'dashboard',
    'companies',
    'pricing',
    'vehicles',
    'fuel_records',
    'maintenance',
    'vendors',
    'vendor_logs',
    'drivers',
    'bookings',
    'routes',
    'ops_shuttle',
    'shuttle_audit',
    'ops_chauffeur',
    'reports',
    'expenses',
    'invoicing',
    'fixed_contracts',
    'external_vendors',
    'company_features',
    'vendor_fleet',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const CRUD_ACTIONS = ['create', 'read', 'update', 'delete'] as const;
export type CrudAction = (typeof CRUD_ACTIONS)[number];

export type SectionCrudPermissions = Record<CrudAction, boolean>;

export type StaffPermissions = Record<PermissionKey, SectionCrudPermissions>;

// User status enum - matches backend
export enum UserStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
    DELETED = 'DELETED',
    PENDING = 'PENDING',
    REJECTED = 'REJECTED',
}

// Vendor link — populated for COMPANY_VENDOR role
export interface VendorLink {
    id: number;
    company_id: number;
    serves_chauffeur: boolean;
    serves_shuttle: boolean;
    is_active: boolean;
    companies?: { id: number; name: string };
}

export type TrialModules = 'pool' | 'shuttle' | 'both';

// Authenticated user interface
export interface AuthUser {
    id: string;
    email: string;
    phone: string | null;
    full_name: string;
    role: UserRole;
    company_id: number | null;
    account_status: UserStatus | null;
    enabled_services: {
        shuttle: boolean;
        chauffeur: boolean;
        travel: boolean;
    } | null;
  is_trial?: boolean;
  trial_expires_at?: string;
  trial_onboarding_completed?: boolean;
  trial_modules?: TrialModules;
    permissions?: StaffPermissions | null; // only populated for INTERNAL_STAFF
    external_vendor_id?: number | null;    // only populated for COMPANY_VENDOR
    vendor_links?: VendorLink[];           // only populated for COMPANY_VENDOR
    impersonated_by?: string;              // present only when a super-admin is viewing as this company
}


// API session (JWT access + refresh tokens)
export interface AuthSession {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
    token_type: string;
    user: {
        id: string;
        email: string;
    };
}

// Login response from backend
export interface LoginResponse {
    success: boolean;
    statusCode: number;
    message: string;
    data: {
        user: AuthUser;
        session: AuthSession;
    };
}

// Profile response from backend
export interface ProfileResponse {
    success: boolean;
    statusCode: number;
    message: string;
    data: AuthUser;
}

// Login request
export interface LoginRequest {
    email: string;
    password: string;
}

// Signup request
export interface SignupRequest {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
}

// Auth context state
export interface AuthState {
    user: AuthUser | null;
    session: AuthSession | null;
    loading: boolean;
    error: string | null;
}

// Auth context methods
export interface AuthContextType extends AuthState {
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    markTrialOnboardingComplete: () => void;
    isAuthenticated: boolean;
    isSuperAdmin: boolean;
    isInternalStaff: boolean;
    isCompanyAdmin: boolean;
    isEmployee: boolean;
    isDriver: boolean;
    hasRole: (roles: UserRole[]) => boolean;
    hasCompanyAccess: (companyId: number) => boolean;
    /** True if staff has `read` on the section (nav + default page access). Super admin: always true. */
    hasPermission: (key: PermissionKey) => boolean;
    /** Check a specific CRUD action for INTERNAL_STAFF; super admin always true. */
    hasCrud: (key: PermissionKey, action: CrudAction) => boolean;
    isShuttleEnabled: boolean;
    isChauffeurEnabled: boolean;
    isCompanyVendor: boolean;
}

