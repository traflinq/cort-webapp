import { createSlice, createAsyncThunk, type ActionReducerMapBuilder } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import { apiClient } from '../../services/api-client';
import type { CompanyFeature, CompanyVendorLink } from '../../services/types/multi-mode';

// Define types based on backend structure
export interface Company {
    id: number;
    name: string;
    email: string;
    logo_url: string | null;
    services_enabled: {
        shuttle_enabled: boolean;
        chauffeur_enabled: boolean;
    };
    monthly_budget: number;
    vehicle_whitelists?: Array<{
        id: number;
        company_id: number;
        allowed_vehicle_model: string;
    }>;
}

/**
 * The inputs of the company portal's access rules (see app/company/lib/access.ts), each loaded per
 * company. `companyId` says whose data `data` is, so data from a previous login or impersonation is
 * never read as the current company's; `requestId` drops answers to requests that were superseded.
 */
interface Resources {
    profile: Company;
    features: CompanyFeature[];
    hasVendors: boolean;
}

export interface Loadable<T> {
    data: T | null;
    companyId: number | null;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
    fetchedAt: number | null;
    requestId: string | null;
    requestedFor: number | null;
}

type CompanyState = { [K in keyof Resources]: Loadable<Resources[K]> };

const empty = <T,>(): Loadable<T> => ({ data: null, companyId: null, status: 'idle', error: null, fetchedAt: null, requestId: null, requestedFor: null });

const initialState: CompanyState = { profile: empty(), features: empty(), hasVendors: empty() };

/** Fetch unless this company's copy is fresh or already on its way. */
function shouldFetch(r: Loadable<unknown>, companyId: number, staleMs: number): boolean {
    if (r.status === 'loading' && r.requestedFor === companyId) return false;
    return !(r.companyId === companyId && r.fetchedAt !== null && Date.now() - r.fetchedAt < staleMs);
}

function companyThunk<K extends keyof Resources>(key: K, staleMs: number, load: (companyId: number) => Promise<Resources[K]>) {
    return createAsyncThunk<Resources[K], number, { rejectValue: string }>(
        `company/${key}`,
        async (companyId, { rejectWithValue }) => {
            try {
                return await load(companyId);
            } catch (err) {
                return rejectWithValue(err instanceof Error ? err.message : `Failed to load ${key}`);
            }
        },
        { condition: (companyId, { getState }) => shouldFetch((getState() as RootState).company[key], companyId, staleMs) },
    );
}

export const fetchCompanyProfile = companyThunk('profile', 120_000, async (companyId) => {
    const raw = await apiClient.getCompany(String(companyId));
    const c = raw.data || raw;
    return {
        id: c.id,
        name: c.name,
        email: c.email,
        logo_url: c.logo_url || null,
        services_enabled: {
            shuttle_enabled: c.is_shuttle_enabled || false,
            chauffeur_enabled: c.is_chauffeur_enabled || false,
        },
        monthly_budget: c.monthly_budget || 1500000,
        vehicle_whitelists: c.vehicle_whitelists || [],
    };
});

export const fetchCompanyFeatures = companyThunk('features', 300_000, async (companyId) => (await apiClient.getCompanyFeatures(companyId)).data);

export const fetchCompanyHasVendors = companyThunk('hasVendors', 300_000, async (companyId) => {
    const res: unknown = await apiClient.getCompanyExternalVendors(companyId);
    // Served wrapped ({ data: [...] }) or bare, depending on the response serializer.
    const raw = (res as { data?: unknown } | null)?.data ?? res;
    const links = Array.isArray(raw) ? (raw as CompanyVendorLink[]) : [];
    return links.some((l) => l.is_active && l.external_vendors?.is_active);
});

function track<K extends keyof Resources>(builder: ActionReducerMapBuilder<CompanyState>, key: K, thunk: ReturnType<typeof companyThunk<K>>) {
    builder
        .addCase(thunk.pending, (state, action) => {
            const r = state[key] as Loadable<Resources[K]>;
            r.status = 'loading';
            r.error = null;
            r.requestId = action.meta.requestId;
            r.requestedFor = action.meta.arg;
        })
        .addCase(thunk.fulfilled, (state, action) => {
            const r = state[key] as Loadable<Resources[K]>;
            if (r.requestId !== action.meta.requestId) return;
            r.status = 'succeeded';
            r.data = action.payload;
            r.companyId = action.meta.arg;
            r.fetchedAt = Date.now();
            r.requestId = null;
        })
        .addCase(thunk.rejected, (state, action) => {
            const r = state[key] as Loadable<Resources[K]>;
            if (r.requestId !== action.meta.requestId) return;
            r.status = 'failed';
            r.error = action.payload ?? action.error.message ?? `Failed to load ${key}`;
            r.requestId = null;
        });
}

export const companySlice = createSlice({
    name: 'company',
    initialState,
    reducers: {
        /** Mark everything stale so the next fetch reloads it (e.g. a retry after a failure). */
        invalidateCompanyCache: (state) => {
            state.profile.fetchedAt = null;
            state.features.fetchedAt = null;
            state.hasVendors.fetchedAt = null;
        },
    },
    extraReducers: (builder) => {
        track(builder, 'profile', fetchCompanyProfile);
        track(builder, 'features', fetchCompanyFeatures);
        track(builder, 'hasVendors', fetchCompanyHasVendors);
    },
});

export const { invalidateCompanyCache } = companySlice.actions;

export const selectCompanyResources = (state: RootState) => state.company;
/** The loaded company profile. Inside the company portal, prefer useCompanyAccess(), which also checks whose it is. */
export const selectCompany = (state: RootState) => state.company.profile.data;

export default companySlice.reducer;
