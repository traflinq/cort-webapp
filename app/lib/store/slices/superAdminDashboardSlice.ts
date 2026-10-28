import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../services/api-client';
import { SuperAdminDashboardStats } from '../../types/admin-dashboard';
import { RootState } from '../store';

const STALE_TIME_MS = 30_000; // 30 seconds — dashboard data changes frequently

interface DashboardState {
    stats: SuperAdminDashboardStats | null;
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
    dateRange: { startDate: string; endDate: string } | null;
}

const initialState: DashboardState = {
    stats: null,
    loading: false,
    error: null,
    lastFetched: null,
    dateRange: null,
};

export const fetchDashboardStats = createAsyncThunk(
    'superAdminDashboard/fetchStats',
    async (params: { startDate?: string; endDate?: string } | undefined, { rejectWithValue }) => {
        try {
            const data = await apiClient.getSuperAdminDashboardStats(params?.startDate, params?.endDate);
            return data as unknown as SuperAdminDashboardStats;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch dashboard stats');
        }
    },
    {
        condition: (params, { getState }) => {
            const state = getState() as RootState;
            const { lastFetched, loading } = state.superAdminDashboard;
            if (loading) return false;
            if (params && (params.startDate || params.endDate)) return true;
            if (lastFetched && Date.now() - lastFetched < STALE_TIME_MS) return false;
            return true;
        }
    }
);

const superAdminDashboardSlice = createSlice({
    name: 'superAdminDashboard',
    initialState,
    reducers: {
        setDateRange: (state, action: PayloadAction<{ startDate: string; endDate: string }>) => {
            state.dateRange = action.payload;
        },
        clearDashboardState: (state) => {
            state.stats = null;
            state.loading = false;
            state.error = null;
            state.lastFetched = null;
            state.dateRange = null;
        },
        invalidateDashboardCache: (state) => {
            state.lastFetched = null;
        },
        removeProblemReport: (state, action: PayloadAction<number>) => {
            if (state.stats) {
                state.stats.problemReports = state.stats.problemReports.filter((r) => r.id !== action.payload);
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDashboardStats.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchDashboardStats.fulfilled, (state, action) => {
                state.loading = false;
                state.lastFetched = Date.now();
                state.stats = action.payload;
            })
            .addCase(fetchDashboardStats.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { setDateRange, clearDashboardState, invalidateDashboardCache, removeProblemReport } = superAdminDashboardSlice.actions;
export default superAdminDashboardSlice.reducer;
