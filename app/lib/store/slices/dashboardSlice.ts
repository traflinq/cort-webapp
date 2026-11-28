import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { apiClient } from '../../services/api-client';

/** Completed chauffeur rides (and billed spend) and shuttle trips that ran, in one period. */
export type TrendPoint = {
    chauffeurRides: number;
    /** Billed spend; external-vendor trips excluded, as in the headline spend. */
    chauffeurSpend: number;
    shuttleTrips: number;
};

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
        /** vs the same period last month, e.g. "+5%"; null when last month had none. */
        spendTrend: string | null;
        /**
         * Market-rate cost minus Traflinq's rate for this month's rides. Not a saving the company made:
         * never show it as savings (PRODUCT.md). Kept only because the API still returns it.
         */
        totalSavings: number;
        completedTrend: string | null;
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
        /** 0 = Sunday; null until there is booking history. Absent on older API versions. */
        highDemandDayOfWeek?: number | null;
        lowDemandDayOfWeek?: number | null;
        /** Chauffeur bookings per weekday, 7 entries, 0 = Sunday. Absent on older API versions. */
        byDayOfWeek?: number[];
    };
    /** Activity for the dashboard charts (Pakistan-time days). Absent on older API versions. */
    trends?: {
        /** Last 30 days, oldest first, ending today. `date` is YYYY-MM-DD. */
        daily: (TrendPoint & { date: string })[];
        /** Last 6 months, oldest first, ending with the current (partial) month. `month` is YYYY-MM. */
        monthly: (TrendPoint & { month: string })[];
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
