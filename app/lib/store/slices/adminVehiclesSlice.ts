import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import {
    apiClient,
    Vehicle,
    CreateVehicleRequest,
    UpdateVehicleRequest,
    QueryVehicleParams,
    FuelRecord,
    CreateFuelRecordRequest,
    UpdateFuelRecordRequest,
    QueryFuelRecordParams,
    MaintenanceRecord,
    CreateMaintenanceRecordRequest,
    UpdateMaintenanceRecordRequest,
    QueryMaintenanceRecordParams,
    MaintenanceType
} from '../../services/api-client';

const STALE_TIME_MS = 60_000; // 60 seconds

interface AdminVehiclesState {
    // Vehicles
    vehicles: Vehicle[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
    actionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
    actionError: string | null;
    vehicleFilters: {
        search: string;
        category: string;
        ownership: string;
    };

    // Fuel
    fuelRecords: FuelRecord[];
    fuelStats: { total_fuel_cost: number; average_fuel_rate: number; total_records: number } | null;
    fuelStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
    fuelError: string | null;
    fuelActionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
    fuelActionError: string | null;
    fuelFilters: {
        filterVehicleId: number | "ALL";
        filterBilled: boolean | "ALL";
        startDate: string;
        endDate: string;
    };
    fuelPagination: { page: number; limit: number; total: number; pages: number };

    // Maintenance
    maintenanceRecords: MaintenanceRecord[];
    upcomingMaintenance: any[];
    maintenanceStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
    maintenanceError: string | null;
    maintenanceActionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
    maintenanceActionError: string | null;
    maintenanceFilters: {
        filterVehicleId: number | "ALL";
        filterType: MaintenanceType | "ALL";
        startDate: string;
        endDate: string;
    };
    maintenancePagination: { page: number; limit: number; total: number; pages: number };
    lastFetched: number | null;
}

const initialState: AdminVehiclesState = {
    // Vehicles
    vehicles: [],
    pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
    },
    status: 'idle',
    error: null,
    actionStatus: 'idle',
    actionError: null,
    vehicleFilters: {
        search: "",
        category: "",
        ownership: ""
    },

    // Fuel
    fuelRecords: [],
    fuelStats: null,
    fuelStatus: 'idle',
    fuelError: null,
    fuelActionStatus: 'idle',
    fuelActionError: null,
    fuelFilters: {
        filterVehicleId: "ALL",
        filterBilled: "ALL",
        startDate: "",
        endDate: ""
    },
    fuelPagination: { page: 1, limit: 25, total: 0, pages: 0 },

    // Maintenance
    maintenanceRecords: [],
    upcomingMaintenance: [],
    maintenanceStatus: 'idle',
    maintenanceError: null,
    maintenanceActionStatus: 'idle',
    maintenanceActionError: null,
    maintenanceFilters: {
        filterVehicleId: "ALL",
        filterType: "ALL",
        startDate: "",
        endDate: ""
    },
    maintenancePagination: { page: 1, limit: 25, total: 0, pages: 0 },
    lastFetched: null,
};

// --- Vehicles Thunks ---

export const fetchAdminVehicles = createAsyncThunk(
    'adminVehicles/fetchVehicles',
    async (params: QueryVehicleParams = {}, { rejectWithValue }) => {
        try {
            const response = await apiClient.getVehicles(params);
            return {
                data: response.data,
                filters: {
                    search: params.search || "",
                    category: (params as any).category || "",
                    ownership: (params as any).ownership || ""
                }
            };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch vehicles');
        }
    },
    {
        condition: (params, { getState }) => {
            const state = getState() as RootState;
            const { lastFetched, status } = state.adminVehicles;
            if (status === 'loading') return false;
            if (params && Object.keys(params).length > 0) return true;
            if (lastFetched && Date.now() - lastFetched < STALE_TIME_MS) return false;
            return true;
        }
    }
);

// Vehicles available for assignment UIs (e.g. exclude active shuttle/chauffeur conflicts)
export const fetchAdminAvailableVehicles = createAsyncThunk(
    'adminVehicles/fetchAvailableVehicles',
    async (params: QueryVehicleParams = {}, { rejectWithValue }) => {
        try {
            const response = await apiClient.getAvailableVehicles(params);
            return {
                data: response.data,
                filters: {
                    search: params.search || "",
                    category: (params as any).category || "",
                    ownership: (params as any).ownership || ""
                }
            };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch available vehicles');
        }
    },
    {
        condition: (params, { getState }) => {
            const state = getState() as RootState;
            const { lastFetched, status } = state.adminVehicles;
            if (status === 'loading') return false;
            if (params && Object.keys(params).length > 0) return true;
            if (lastFetched && Date.now() - lastFetched < STALE_TIME_MS) return false;
            return true;
        }
    }
);

export const createAdminVehicle = createAsyncThunk(
    'adminVehicles/createVehicle',
    async (data: CreateVehicleRequest, { rejectWithValue }) => {
        try {
            const response = await apiClient.createVehicle(data);
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to create vehicle');
        }
    }
);

export const updateAdminVehicle = createAsyncThunk(
    'adminVehicles/updateVehicle',
    async ({ id, data }: { id: number; data: UpdateVehicleRequest }, { rejectWithValue }) => {
        try {
            const response = await apiClient.updateVehicle(id, data);
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to update vehicle');
        }
    }
);

export const deleteAdminVehicle = createAsyncThunk(
    'adminVehicles/deleteVehicle',
    async (id: number, { rejectWithValue }) => {
        try {
            await apiClient.deleteVehicle(id);
            return id;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to delete vehicle');
        }
    }
);

// --- Fuel Thunks ---

export const fetchFuelRecords = createAsyncThunk(
    'adminVehicles/fetchFuelRecords',
    async (params: QueryFuelRecordParams = {}, { rejectWithValue }) => {
        try {
            const response = await apiClient.getFuelRecords(params);
            return {
                data: response.data,
                filters: {
                    filterVehicleId: params.vehicle_id || "ALL" as number | "ALL",
                    filterBilled: params.billed !== undefined ? params.billed : "ALL" as boolean | "ALL",
                    startDate: params.start_date || "",
                    endDate: params.end_date || ""
                }
            };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch fuel records');
        }
    }
);

export const fetchFuelStats = createAsyncThunk(
    'adminVehicles/fetchFuelStats',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiClient.getFuelStats();
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch fuel stats');
        }
    }
);

export const createFuelRecord = createAsyncThunk(
    'adminVehicles/createFuelRecord',
    async (data: CreateFuelRecordRequest, { rejectWithValue }) => {
        try {
            const response = await apiClient.createFuelRecord(data);
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to create fuel record');
        }
    }
);

export const updateFuelRecord = createAsyncThunk(
    'adminVehicles/updateFuelRecord',
    async ({ id, data }: { id: number; data: UpdateFuelRecordRequest }, { rejectWithValue }) => {
        try {
            await apiClient.updateFuelRecord(id, data);
            return { id, changes: data }; // Optimistic update or re-fetch can be used
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to update fuel record');
        }
    }
);

export const deleteFuelRecord = createAsyncThunk(
    'adminVehicles/deleteFuelRecord',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await apiClient.deleteFuelRecord(id);
            return {
                id,
                requiresApproval: response.data?.requiresApproval ?? false,
                message: response.data?.message,
            };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to delete fuel record');
        }
    }
);

export const markFuelRecordsAsPaid = createAsyncThunk(
    'adminVehicles/markFuelRecordsAsPaid',
    async (ids: number[], { rejectWithValue }) => {
        try {
            const response = await apiClient.markFuelRecordsAsPaid({ ids });
            return { ids, message: response.message };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to mark records as paid');
        }
    }
);

// --- Maintenance Thunks ---

export const fetchMaintenanceRecords = createAsyncThunk(
    'adminVehicles/fetchMaintenanceRecords',
    async (params: QueryMaintenanceRecordParams = {}, { rejectWithValue }) => {
        try {
            const response = await apiClient.getMaintenanceRecords(params);
            return {
                data: response.data,
                filters: {
                    filterVehicleId: params.vehicle_id || "ALL" as number | "ALL",
                    filterType: params.maintenance_type || "ALL" as MaintenanceType | "ALL",
                    startDate: params.start_date || "",
                    endDate: params.end_date || ""
                }
            };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch maintenance records');
        }
    }
);

export const fetchUpcomingMaintenance = createAsyncThunk(
    'adminVehicles/fetchUpcomingMaintenance',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiClient.getUpcomingMaintenance();
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch upcoming maintenance');
        }
    }
);

export const createMaintenanceRecord = createAsyncThunk(
    'adminVehicles/createMaintenanceRecord',
    async (data: CreateMaintenanceRecordRequest, { rejectWithValue }) => {
        try {
            const response = await apiClient.createMaintenanceRecord(data);
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to create maintenance record');
        }
    }
);

export const updateMaintenanceRecord = createAsyncThunk(
    'adminVehicles/updateMaintenanceRecord',
    async ({ id, data }: { id: number; data: UpdateMaintenanceRecordRequest }, { rejectWithValue }) => {
        try {
            await apiClient.updateMaintenanceRecord(id, data);
            return { id, changes: data };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to update maintenance record');
        }
    }
);

export const deleteMaintenanceRecord = createAsyncThunk(
    'adminVehicles/deleteMaintenanceRecord',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await apiClient.deleteMaintenanceRecord(id);
            return {
                id,
                requiresApproval: response.data?.requiresApproval ?? false,
                message: response.data?.message,
            };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to delete maintenance record');
        }
    }
);


export const markMaintenanceRecordAsPaid = createAsyncThunk(
    'adminVehicles/markMaintenanceRecordAsPaid',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await apiClient.markMaintenanceRecordAsPaid(id);
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to mark maintenance record as paid');
        }
    }
);

export const adminVehiclesSlice = createSlice({
    name: 'adminVehicles',
    initialState,
    reducers: {
        resetVehicleActionStatus: (state) => {
            state.actionStatus = 'idle';
            state.actionError = null;
        },
        resetFuelActionStatus: (state) => {
            state.fuelActionStatus = 'idle';
            state.fuelActionError = null;
        },
        resetMaintenanceActionStatus: (state) => {
            state.maintenanceActionStatus = 'idle';
            state.maintenanceActionError = null;
        },
        clearAdminVehicles: (state) => {
            return initialState;
        },
        invalidateVehiclesCache: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // --- Vehicles ---
            .addCase(fetchAdminVehicles.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(fetchAdminVehicles.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.lastFetched = Date.now();
                state.vehicles = action.payload.data.data;
                state.vehicleFilters = action.payload.filters;
                if (action.payload.data.pagination) {
                    state.pagination = {
                        page: Number(action.payload.data.pagination.page),
                        limit: Number(action.payload.data.pagination.limit),
                        total: Number(action.payload.data.pagination.total),
                        totalPages: Number(action.payload.data.pagination.pages),
                    };
                }
            })
            .addCase(fetchAdminVehicles.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload as string;
            })
            .addCase(fetchAdminAvailableVehicles.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(fetchAdminAvailableVehicles.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.lastFetched = Date.now();
                state.vehicles = action.payload.data.data;
                state.vehicleFilters = action.payload.filters;
                if (action.payload.data.pagination) {
                    state.pagination = {
                        page: Number(action.payload.data.pagination.page),
                        limit: Number(action.payload.data.pagination.limit),
                        total: Number(action.payload.data.pagination.total),
                        totalPages: Number(action.payload.data.pagination.pages),
                    };
                }
            })
            .addCase(fetchAdminAvailableVehicles.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload as string;
            })
            .addCase(createAdminVehicle.pending, (state) => { state.actionStatus = 'loading'; state.actionError = null; })
            .addCase(createAdminVehicle.fulfilled, (state, action) => {
                state.actionStatus = 'succeeded';
                state.vehicles.unshift(action.payload as unknown as Vehicle);
            })
            .addCase(createAdminVehicle.rejected, (state, action) => { state.actionStatus = 'failed'; state.actionError = action.payload as string; })

            .addCase(updateAdminVehicle.pending, (state) => { state.actionStatus = 'loading'; state.actionError = null; })
            .addCase(updateAdminVehicle.fulfilled, (state, action) => {
                state.actionStatus = 'succeeded';
                const index = state.vehicles.findIndex(v => v.id === (action.payload as unknown as Vehicle).id);
                if (index !== -1) state.vehicles[index] = action.payload as unknown as Vehicle;
            })
            .addCase(updateAdminVehicle.rejected, (state, action) => { state.actionStatus = 'failed'; state.actionError = action.payload as string; })

            .addCase(deleteAdminVehicle.fulfilled, (state, action) => {
                state.vehicles = state.vehicles.filter(v => v.id !== action.payload);
            })

            // --- Fuel ---
            .addCase(fetchFuelRecords.pending, (state) => { state.fuelStatus = 'loading'; })
            .addCase(fetchFuelRecords.fulfilled, (state, action) => {
                state.fuelStatus = 'succeeded';
                state.fuelRecords = action.payload.data.data || action.payload.data;
                state.fuelFilters = action.payload.filters;
                const fuelPg = action.payload.data?.pagination;
                if (fuelPg) {
                    state.fuelPagination = {
                        page: Number(fuelPg.page) || 1,
                        limit: Number(fuelPg.limit) || state.fuelPagination.limit,
                        total: Number(fuelPg.total) || 0,
                        pages: Number(fuelPg.pages) || 0,
                    };
                }
            })
            .addCase(fetchFuelRecords.rejected, (state, action) => { state.fuelStatus = 'failed'; state.fuelError = action.payload as string; })

            .addCase(fetchFuelStats.fulfilled, (state, action) => {
                state.fuelStats = action.payload;
            })

            .addCase(createFuelRecord.pending, (state) => { state.fuelActionStatus = 'loading'; })
            .addCase(createFuelRecord.fulfilled, (state) => { state.fuelActionStatus = 'succeeded'; })
            .addCase(createFuelRecord.rejected, (state, action) => { state.fuelActionStatus = 'failed'; state.fuelActionError = action.payload as string; })

            .addCase(updateFuelRecord.pending, (state) => { state.fuelActionStatus = 'loading'; })
            .addCase(updateFuelRecord.fulfilled, (state, action) => {
                state.fuelActionStatus = 'succeeded';
                // Optional: update local state if needed, or rely on re-fetch
                const index = state.fuelRecords.findIndex(r => r.id === action.payload.id);
                if (index !== -1) {
                    state.fuelRecords[index] = { ...state.fuelRecords[index], ...action.payload.changes as any };
                }
            })
            .addCase(updateFuelRecord.rejected, (state, action) => { state.fuelActionStatus = 'failed'; state.fuelActionError = action.payload as string; })

            .addCase(deleteFuelRecord.fulfilled, (state, action) => {
                if (!action.payload.requiresApproval) {
                    state.fuelRecords = state.fuelRecords.filter(r => r.id !== action.payload.id);
                }
            })

            .addCase(markFuelRecordsAsPaid.pending, (state) => { state.fuelActionStatus = 'loading'; })
            .addCase(markFuelRecordsAsPaid.fulfilled, (state, action) => {
                state.fuelActionStatus = 'succeeded';
                // Update local state
                state.fuelRecords = state.fuelRecords.map(record =>
                    action.payload.ids.includes(record.id) ? { ...record, billed: true } : record
                );
            })
            .addCase(markFuelRecordsAsPaid.rejected, (state, action) => { state.fuelActionStatus = 'failed'; state.fuelActionError = action.payload as string; })

            // --- Maintenance ---
            .addCase(fetchMaintenanceRecords.pending, (state) => { state.maintenanceStatus = 'loading'; })
            .addCase(fetchMaintenanceRecords.fulfilled, (state, action) => {
                state.maintenanceStatus = 'succeeded';
                state.maintenanceRecords = action.payload.data.data || action.payload.data;
                state.maintenanceFilters = action.payload.filters;
                const maintPg = action.payload.data?.pagination;
                if (maintPg) {
                    state.maintenancePagination = {
                        page: Number(maintPg.page) || 1,
                        limit: Number(maintPg.limit) || state.maintenancePagination.limit,
                        total: Number(maintPg.total) || 0,
                        pages: Number(maintPg.pages) || 0,
                    };
                }
            })
            .addCase(fetchMaintenanceRecords.rejected, (state, action) => { state.maintenanceStatus = 'failed'; state.maintenanceError = action.payload as string; })

            .addCase(fetchUpcomingMaintenance.fulfilled, (state, action) => {
                state.upcomingMaintenance = action.payload;
            })

            .addCase(createMaintenanceRecord.pending, (state) => { state.maintenanceActionStatus = 'loading'; })
            .addCase(createMaintenanceRecord.fulfilled, (state) => { state.maintenanceActionStatus = 'succeeded'; })
            .addCase(createMaintenanceRecord.rejected, (state, action) => { state.maintenanceActionStatus = 'failed'; state.maintenanceActionError = action.payload as string; })

            .addCase(updateMaintenanceRecord.pending, (state) => { state.maintenanceActionStatus = 'loading'; })
            .addCase(updateMaintenanceRecord.fulfilled, (state, action) => {
                state.maintenanceActionStatus = 'succeeded';
                const index = state.maintenanceRecords.findIndex(r => r.id === action.payload.id);
                if (index !== -1) {
                    state.maintenanceRecords[index] = { ...state.maintenanceRecords[index], ...action.payload.changes as any };
                }
            })
            .addCase(updateMaintenanceRecord.rejected, (state, action) => { state.maintenanceActionStatus = 'failed'; state.maintenanceActionError = action.payload as string; })

            .addCase(deleteMaintenanceRecord.fulfilled, (state, action) => {
                if (!action.payload.requiresApproval) {
                    state.maintenanceRecords = state.maintenanceRecords.filter(r => r.id !== action.payload.id);
                }
            })

            .addCase(markMaintenanceRecordAsPaid.pending, (state) => { state.maintenanceActionStatus = 'loading'; })
            .addCase(markMaintenanceRecordAsPaid.fulfilled, (state, action) => {
                state.maintenanceActionStatus = 'succeeded';
                const index = state.maintenanceRecords.findIndex(r => r.id === action.payload.id);
                if (index !== -1) {
                    state.maintenanceRecords[index] = { ...state.maintenanceRecords[index], ...action.payload };
                }
            })
            .addCase(markMaintenanceRecordAsPaid.rejected, (state, action) => { state.maintenanceActionStatus = 'failed'; state.maintenanceActionError = action.payload as string; });
    },
});

export const { resetVehicleActionStatus, resetFuelActionStatus, resetMaintenanceActionStatus, clearAdminVehicles, invalidateVehiclesCache } = adminVehiclesSlice.actions;

export const selectAdminVehicles = (state: RootState) => state.adminVehicles.vehicles;
export const selectAdminVehiclesStatus = (state: RootState) => state.adminVehicles.status;
export const selectAdminVehiclesError = (state: RootState) => state.adminVehicles.error;
export const selectAdminVehiclesActionStatus = (state: RootState) => state.adminVehicles.actionStatus;
export const selectVehicleFilters = (state: RootState) => state.adminVehicles.vehicleFilters;

export const selectFuelRecords = (state: RootState) => state.adminVehicles.fuelRecords;
export const selectFuelStats = (state: RootState) => state.adminVehicles.fuelStats;
export const selectFuelStatus = (state: RootState) => state.adminVehicles.fuelStatus;
export const selectFuelActionStatus = (state: RootState) => state.adminVehicles.fuelActionStatus;
export const selectFuelActionError = (state: RootState) => state.adminVehicles.fuelActionError;
export const selectFuelFilters = (state: RootState) => state.adminVehicles.fuelFilters;
export const selectFuelPagination = (state: RootState) => state.adminVehicles.fuelPagination;

export const selectMaintenanceRecords = (state: RootState) => state.adminVehicles.maintenanceRecords;
export const selectUpcomingMaintenance = (state: RootState) => state.adminVehicles.upcomingMaintenance;
export const selectMaintenanceStatus = (state: RootState) => state.adminVehicles.maintenanceStatus;
export const selectMaintenanceActionStatus = (state: RootState) => state.adminVehicles.maintenanceActionStatus;
export const selectMaintenanceActionError = (state: RootState) => state.adminVehicles.maintenanceActionError;
export const selectMaintenanceFilters = (state: RootState) => state.adminVehicles.maintenanceFilters;
export const selectMaintenancePagination = (state: RootState) => state.adminVehicles.maintenancePagination;
export const selectAdminVehiclesPagination = (state: RootState) => state.adminVehicles.pagination;

export default adminVehiclesSlice.reducer;
