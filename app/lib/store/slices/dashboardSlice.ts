import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { apiClient } from '../../services/api-client';

export type DashboardStats = {
    employees: {
        total: number;
        active: number;
        departmentUsage: { name: string; percentage: number }[];
    };
    chauffeur: {
        totalBookings: number;
        completedThisMonth: number;
        totalSpend: number;
        completedAllTime: number;
        totalSpendAllTime: number;
        spendTrend: string;
        totalSavings: number;
        completedTrend: string;
        unassignedBookings: number;
        activeRides: number;
        outstandingAmount: number;
        topPassengers: { name: string; trips: number }[];
        outstandingInvoices: {
            invoice_number: string;
            total_amount: number;
            status: string;
            due_date: string;
        }[];
    };
    shuttle: {
        totalRoutes: number;
        monthlyTrips: number;
        totalTripsAllTime: number;
    };
    alerts: {
        upcomingBookings: number;
    };
    seasonality: {
        highDemandDay: string;
        lowDemandDay: string;
    };
    mobility: {
        activeRides: number;
        employeesTraveling: number;
        shuttlesRunning: number;
        chauffeurRides: number;
        upcomingBookings: number;
    };
    servicesEnabled?: {
        chauffeur_enabled: boolean;
        shuttle_enabled: boolean;
        travel_enabled?: boolean;
    };
    travel?: {
        company_balance: number;
        assigned_total: number;
        spend_total: number;
        travelers: number;
        active_employees: number;
        adoption: number;
    };
    costLeakage?: {
        aiInsightsEnabled: boolean;
        totalPotentialSavingPkr: number;
        insights: {
            id: number;
            insight_type: string;
            severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
            estimated_saving_pkr: number;
            label: string;
            is_preview: boolean;
            data: { summary: string; recommendation: string; metric_value?: number };
            generated_at: string | null;
        }[];
    };
    monthlyBudget?: number;
};

interface DashboardState {
    stats: DashboardStats | null;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
    lastFetched: number | null;
}

const initialState: DashboardState = {
    stats: null,
    status: 'idle',
    error: null,
    lastFetched: null,
};

// Cache valid for 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

export const fetchDashboardStats = createAsyncThunk(
    'dashboard/fetchStats',
    async (companyId: string, { rejectWithValue }) => {
        try {
            const response = await apiClient.getCompanyDashboardStats(companyId);
            return response.data || response;
        } catch (err) {
            return rejectWithValue(err instanceof Error ? err.message : 'Failed to fetch stats');
        }
    },
    {
        condition: (_, { getState }) => {
            const state = getState() as RootState;
            const { lastFetched, status } = state.dashboard;
            if (status === 'loading') return false;
            if (lastFetched && Date.now() - lastFetched < CACHE_DURATION_MS) return false;
            return true;
        }
    }
);

export const dashboardSlice = createSlice({
    name: 'dashboard',
    initialState,
    reducers: {
        // ✅ FIX: Allow manual cache clearing for refreshes
        clearDashboardCache: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDashboardStats.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchDashboardStats.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.stats = action.payload;
                state.lastFetched = Date.now(); // ✅ FIX: Track when data was fetched
            })
            .addCase(fetchDashboardStats.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload as string;
            });
    },
});

export const { clearDashboardCache } = dashboardSlice.actions;

export const selectDashboardStats = (state: RootState) => state.dashboard.stats;
export const selectDashboardStatus = (state: RootState) => state.dashboard.status;

export default dashboardSlice.reducer;
