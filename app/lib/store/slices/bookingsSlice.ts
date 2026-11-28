import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { apiClient, ChauffeurBooking } from '../../services/api-client';

const STALE_TIME_MS = 30_000; // 30 seconds — bookings change frequently

interface BookingsState {
    bookings: ChauffeurBooking[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
    filters: {
        search: string;
        status: string;
        fulfillmentType: string;
    };
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
    lastFetched: number | null;
    /** Only the newest request may write results: an older page or filter answering late is ignored. */
    latestRequestId: string | null;
}

const initialState: BookingsState = {
    bookings: [],
    pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 1,
    },
    filters: {
        search: '',
        status: '',
        fulfillmentType: '',
    },
    status: 'idle',
    error: null,
    lastFetched: null,
    latestRequestId: null,
};

export const fetchBookings = createAsyncThunk(
    'bookings/fetchBookings',
    async (params: { companyId: number } & any, { rejectWithValue }) => {
        try {
            const { companyId, ...queryParams } = params;
            const res = await apiClient.getCompanyChauffeurBookings(companyId, queryParams);
            return res.data; // { data: [], pagination: {} }
        } catch (err) {
            return rejectWithValue(err instanceof Error ? err.message : 'Failed to fetch bookings');
        }
    },
    {
        condition: (params, { getState }) => {
            const state = getState() as RootState;
            const { lastFetched, status } = state.bookings;
            // A request with explicit params (page, filters) always goes out, even while another is
            // loading: dropping it left the table on the old page while the controls showed the new one.
            if (params && Object.keys(params).length > 1) return true;
            if (status === 'loading') return false;
            if (lastFetched && Date.now() - lastFetched < STALE_TIME_MS) return false;
            return true;
        }
    }
);

export const bookingsSlice = createSlice({
    name: 'bookings',
    initialState,
    reducers: {
        setPage: (state, action: PayloadAction<number>) => {
            state.pagination.page = action.payload;
        },
        setFilters: (state, action: PayloadAction<{ search?: string; status?: string; fulfillmentType?: string }>) => {
            if (action.payload.search !== undefined) state.filters.search = action.payload.search;
            if (action.payload.status !== undefined) state.filters.status = action.payload.status;
            if (action.payload.fulfillmentType !== undefined) state.filters.fulfillmentType = action.payload.fulfillmentType;
            state.pagination.page = 1; // Reset to page 1 on filter change
        },
        invalidateBookingsCache: (state) => {
            state.lastFetched = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchBookings.pending, (state, action) => {
                state.status = 'loading';
                state.error = null;
                state.latestRequestId = action.meta.requestId;
            })
            .addCase(fetchBookings.fulfilled, (state, action) => {
                if (action.meta.requestId !== state.latestRequestId) return;
                state.status = 'succeeded';
                state.lastFetched = Date.now();
                state.bookings = action.payload.data;
                if (action.payload.pagination) {
                    state.pagination = {
                        ...state.pagination,
                        ...action.payload.pagination,
                        pages: action.payload.pagination.pages || state.pagination.pages
                    };
                }
            })
            .addCase(fetchBookings.rejected, (state, action) => {
                if (action.meta.requestId !== state.latestRequestId || action.meta.aborted) return;
                state.status = 'failed';
                state.error = action.payload as string;
            });
    },
});

export const { setPage, setFilters, invalidateBookingsCache } = bookingsSlice.actions;

export const selectBookings = (state: RootState) => state.bookings.bookings;
export const selectPagination = (state: RootState) => state.bookings.pagination;
export const selectBookingsStatus = (state: RootState) => state.bookings.status;
export const selectFilters = (state: RootState) => state.bookings.filters;

export default bookingsSlice.reducer;
