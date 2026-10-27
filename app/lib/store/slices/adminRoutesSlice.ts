import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { apiClient } from '../../services/api-client';

const STALE_TIME_MS = 60_000; // 60 seconds

// Define Route interface based on API response
export interface RouteStop {
    id: number;
    route_id: number;
    name: string;
    sequence_order: number;
    morning_sequence: number | null;
    evening_sequence: number | null;
    direction?: 'MORNING' | 'EVENING' | 'BOTH';
    /** 'PICKUP' | 'OFFICE' — defaults to 'PICKUP' server-side. A route may have multiple OFFICE stops. */
    stop_type?: 'PICKUP' | 'OFFICE';
    lat: number;
    lng: number;
    morning_eta?: string;
    evening_eta?: string;
    /** GeoJSON polygon string from PostGIS ST_AsGeoJSON(completion_geofence). */
    completion_geofence_geojson?: string | null;
}

/** The route table has no status column; active-ness comes from is_active (default true). */
export const routeStatus = (r: { is_active?: boolean }): 'ACTIVE' | 'INACTIVE' => (r.is_active === false ? 'INACTIVE' : 'ACTIVE');

export interface RoutePoint {
    lat: number;
    lng: number;
    address?: string;
}

export interface DirectionPoints {
    start?: RoutePoint | null;
    end?: RoutePoint | null;
}

/** Per-direction driver start/end points (null clears one). */
export type RouteDirectionPoints = Partial<Record<'MORNING' | 'EVENING', DirectionPoints>>;

export interface RouteDirectionConfig {
    direction: 'MORNING' | 'EVENING';
    /** Decimal columns arrive as strings in JSON. */
    start_lat: string | number | null;
    start_lng: string | number | null;
    start_address: string | null;
    start_leg_km: string | number | null;
    end_lat: string | number | null;
    end_lng: string | number | null;
    end_address: string | null;
    end_leg_km: string | number | null;
}

export interface Route {
    id: number;
    name: string;
    company_id: number | null;
    status: 'ACTIVE' | 'INACTIVE';
    /** Inactive routes get no daily shuttle trips. Missing = active. */
    is_active?: boolean;
    created_at: string;
    updated_at: string;
    /** PKT HH:MM — evening return trips cannot start before this time */
    evening_lock_time?: string | null;
    route_stops?: RouteStop[];
    route_direction_configs?: RouteDirectionConfig[];
    company?: {
        id: number;
        name: string;
    };
    // Some APIs return the related company under "companies"
    companies?: {
        id?: number;
        name: string;
    };
    assigned_vehicle_id?: number | null;
    assigned_driver_id?: string | null;
    evening_vehicle_id?: number | null;
    evening_driver_id?: string | null;
    company_vendor_link_id?: number | null;
    company_vendor_links?: {
        id: number;
        external_vendors?: {
            name: string;
        };
    } | null;
    vehicles?: {
        plate_number: string;
        model: string;
    };
    users?: {
        full_name: string;
        phone: string;
    };
    evening_vehicle?: {
        plate_number: string;
        model: string;
    } | null;
    evening_driver?: {
        full_name: string;
        phone: string;
    } | null;
}

export interface CreateRouteRequest {
    name: string;
    is_active?: boolean;
    company_id: number;
    assigned_vehicle_id?: number | null;
    assigned_driver_id?: string | null;
    evening_vehicle_id?: number | null;
    evening_driver_id?: string | null;
    direction_points?: RouteDirectionPoints;
    stops: {
        name: string;
        lat: number;
        lng: number;
        morning_eta?: string;
        evening_eta?: string;
        sequence_order: number;
        direction?: 'MORNING' | 'EVENING' | 'BOTH';
        /** 'PICKUP' | 'OFFICE' — defaults to 'PICKUP' server-side. */
        stop_type?: 'PICKUP' | 'OFFICE';
    }[];
}

export type UpdateRouteRequest = Partial<
    Pick<
        CreateRouteRequest,
        'name' | 'company_id' | 'assigned_vehicle_id' | 'assigned_driver_id' | 'evening_vehicle_id' | 'evening_driver_id'
    >
> & {
    evening_lock_time?: string | null;
    is_active?: boolean;
    direction_points?: RouteDirectionPoints;
};

// Employee Assignment Interface
export interface EmployeeAssignment {
    user_id: string;
    route_id: number;
    pickup_stop_id: number;
    /** FK to a route_stops row with stop_type 'OFFICE'. Defaulted server-side when the route has exactly one office stop. */
    office_stop_id?: number | null;
    users?: {
        full_name: string;
        email: string;
        phone: string;
    };
    route_stops?: {
        name: string;
    };
    /** The assigned office stop — same relation shape as route_stops, but for the OFFICE stop. */
    office_route_stops?: {
        id?: number;
        name: string;
    } | null;
}

export interface AssignEmployeeRequest {
    user_id: string;
    route_id: number;
    pickup_stop_id: number;
    /** Required when the route has more than one OFFICE stop; optional (server defaults) when it has exactly one. */
    office_stop_id?: number;
}

interface AdminRoutesState {
    routes: Route[];
    currentRoute: Route | null; // For detail view
    assignments: EmployeeAssignment[];
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
    assignmentStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
    lastFetched: number | null;
}

const initialState: AdminRoutesState = {
    routes: [],
    currentRoute: null,
    assignments: [],
    pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
    },
    status: 'idle',
    error: null,
    actionStatus: 'idle',
    actionError: null,
    assignmentStatus: 'idle',
    lastFetched: null,
};

// Async Thunks

export const fetchAdminRoute = createAsyncThunk(
    'adminRoutes/fetchRoute',
    async (id: number, { rejectWithValue }) => {
        try {
            // Assuming this endpoint exists, or we use request
            return await apiClient.request<Route>(`/routes/${id}`);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch route');
        }
    }
);

export const fetchAdminRoutes = createAsyncThunk(
    'adminRoutes/fetchRoutes',
    async (params: { company_id?: number } = {}, { rejectWithValue }) => {
        try {
            const query = new URLSearchParams();
            if (params.company_id) query.append('company_id', params.company_id.toString());

            return await apiClient.request<Route[]>(`/routes?${query.toString()}`);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch routes');
        }
    },
    {
        condition: (params, { getState }) => {
            const state = getState() as RootState;
            const { lastFetched, status } = state.adminRoutes;
            if (status === 'loading') return false;
            if (params && Object.keys(params).length > 0) return true;
            if (lastFetched && Date.now() - lastFetched < STALE_TIME_MS) return false;
            return true;
        }
    }
);

export const createAdminRoute = createAsyncThunk(
    'adminRoutes/createRoute',
    async (data: CreateRouteRequest, { rejectWithValue }) => {
        try {
            return await apiClient.request<Route>('/routes', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to create route');
        }
    }
);


export const updateAdminRoute = createAsyncThunk(
    'adminRoutes/updateRoute',
    async ({ id, data }: { id: number; data: UpdateRouteRequest }, { rejectWithValue }) => {
        try {
            return await apiClient.request<Route>(`/routes/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to update route');
        }
    }
);

export const optimizeAdminRoute = createAsyncThunk(
    'adminRoutes/optimizeRoute',
    async (id: number, { rejectWithValue }) => {
        try {
            return await apiClient.request<Route>(`/routes/${id}/optimize`, {
                method: 'POST',
            });
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to optimize route');
        }
    }
);

export const reorderAdminRouteStops = createAsyncThunk(
    'adminRoutes/reorderStops',
    async (
        { routeId, direction, stop_ids }: { routeId: number; direction: 'MORNING' | 'EVENING'; stop_ids: number[] },
        { rejectWithValue },
    ) => {
        try {
            return await apiClient.request<Route>(`/routes/${routeId}/stops/reorder`, {
                method: 'POST',
                body: JSON.stringify({ direction, stop_ids }),
            });
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to reorder stops');
        }
    }
);

export const deleteAdminRoute = createAsyncThunk(
    'adminRoutes/deleteRoute',
    async (id: number, { rejectWithValue }) => {
        try {
            await apiClient.request<void>(`/routes/${id}`, {
                method: 'DELETE',
            });
            return id;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to delete route');
        }
    }
);

// Assignment Thunks
export const fetchRouteAssignments = createAsyncThunk(
    'adminRoutes/fetchAssignments',
    async (routeId: number, { rejectWithValue }) => {
        try {
            return await apiClient.request<EmployeeAssignment[]>(`/employee-route-assignments/route/${routeId}`);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch assignments');
        }
    }
);

export const assignEmployeeToRoute = createAsyncThunk(
    'adminRoutes/assignEmployee',
    async (data: AssignEmployeeRequest, { rejectWithValue }) => {
        try {
            return await apiClient.request<EmployeeAssignment>('/employee-route-assignments/assign', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to assign employee');
        }
    }
);

export const removeEmployeeFromRoute = createAsyncThunk(
    'adminRoutes/removeEmployee',
    async (userId: string, { rejectWithValue }) => {
        try {
            await apiClient.request<void>(`/employee-route-assignments/remove/${userId}`, {
                method: 'DELETE',
            });
            return userId;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to remove employee assignment');
        }
    }
);


// Stop Management Thunks
// All three thunks return { routeId, stops[] } so the slice always replaces
// route_stops from server truth (fixes stale sequence display after mutations).
export const createRouteStop = createAsyncThunk(
    'adminRoutes/createRouteStop',
    async ({ routeId, data }: { routeId: number; data: any }, { rejectWithValue }) => {
        try {
            await apiClient.request<RouteStop>(`/routes/${routeId}/stops`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            const fresh = await apiClient.request<Route>(`/routes/${routeId}`);
            return { routeId, stops: fresh.route_stops ?? [] };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to create stop');
        }
    }
);

export const updateRouteStop = createAsyncThunk(
    'adminRoutes/updateRouteStop',
    async ({ stopId, routeId, data }: { stopId: number; routeId: number; data: any }, { rejectWithValue }) => {
        try {
            await apiClient.request<RouteStop>(`/routes/stops/${stopId}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            const fresh = await apiClient.request<Route>(`/routes/${routeId}`);
            return { routeId, stops: fresh.route_stops ?? [] };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to update stop');
        }
    }
);

export const deleteRouteStop = createAsyncThunk(
    'adminRoutes/deleteRouteStop',
    async ({ stopId, routeId }: { stopId: number; routeId: number }, { rejectWithValue }) => {
        try {
            await apiClient.request<void>(`/routes/stops/${stopId}`, {
                method: 'DELETE',
            });
            const fresh = await apiClient.request<Route>(`/routes/${routeId}`);
            return { routeId, stops: fresh.route_stops ?? [] };
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to delete stop');
        }
    }
);

export const adminRoutesSlice = createSlice({
    name: 'adminRoutes',
    initialState,
    reducers: {
        resetRouteActionStatus: (state) => {
            state.actionStatus = 'idle';
            state.actionError = null;
        },
        resetAssignmentStatus: (state) => {
            state.assignmentStatus = 'idle';
        },
        clearCurrentRoute: (state) => {
            state.currentRoute = null;
            state.assignments = [];
        },
        invalidateRoutesCache: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Routes
            .addCase(fetchAdminRoutes.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(fetchAdminRoutes.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.lastFetched = Date.now();
                state.routes = action.payload;
            })
            .addCase(fetchAdminRoutes.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload as string;
            })
            // Fetch Single Route
            .addCase(fetchAdminRoute.pending, (state, action) => {
                // Avoid blanking the detail page when we already have this route loaded
                if (!state.currentRoute || state.currentRoute.id !== action.meta.arg) {
                    state.status = 'loading';
                }
            })
            .addCase(fetchAdminRoute.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.currentRoute = action.payload;
            })
            .addCase(fetchAdminRoute.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload as string;
            })
            // Create Route
            .addCase(createAdminRoute.pending, (state) => {
                state.actionStatus = 'loading';
                state.actionError = null;
            })
            .addCase(createAdminRoute.fulfilled, (state, action) => {
                state.actionStatus = 'succeeded';
                state.routes.push(action.payload);
            })
            .addCase(createAdminRoute.rejected, (state, action) => {
                state.actionStatus = 'failed';
                state.actionError = action.payload as string;
            })
            // Update Route
            .addCase(updateAdminRoute.pending, (state) => {
                state.actionStatus = 'loading';
                state.actionError = null;
            })
            .addCase(updateAdminRoute.fulfilled, (state, action) => {
                state.actionStatus = 'succeeded';
                state.lastFetched = null; // force list refresh on next visit
                const updated = action.payload;
                const index = state.routes.findIndex(r => r.id === updated.id);
                if (index !== -1) {
                    state.routes[index] = {
                        ...state.routes[index],
                        ...updated,
                        vehicles: updated.assigned_vehicle_id
                            ? (updated.vehicles ?? state.routes[index].vehicles)
                            : undefined,
                        users: updated.assigned_driver_id
                            ? (updated.users ?? state.routes[index].users)
                            : undefined,
                        evening_vehicle: updated.evening_vehicle_id
                            ? (updated.evening_vehicle ?? state.routes[index].evening_vehicle)
                            : undefined,
                        evening_driver: updated.evening_driver_id
                            ? (updated.evening_driver ?? state.routes[index].evening_driver)
                            : undefined,
                    };
                }
                // Merge carefully: bare PATCH responses omit relations/stops;
                // full findOne responses include them. Always clear nested vehicle/driver
                // when the FK is null so UI doesn't keep stale assignment labels.
                if (state.currentRoute && state.currentRoute.id === updated.id) {
                    state.currentRoute = {
                        ...state.currentRoute,
                        ...updated,
                        route_stops: updated.route_stops ?? state.currentRoute.route_stops,
                        companies: updated.companies ?? state.currentRoute.companies,
                        company: updated.company ?? state.currentRoute.company,
                        vehicles: updated.assigned_vehicle_id
                            ? (updated.vehicles ?? state.currentRoute.vehicles)
                            : undefined,
                        users: updated.assigned_driver_id
                            ? (updated.users ?? state.currentRoute.users)
                            : undefined,
                        evening_vehicle: updated.evening_vehicle_id
                            ? (updated.evening_vehicle ?? state.currentRoute.evening_vehicle)
                            : undefined,
                        evening_driver: updated.evening_driver_id
                            ? (updated.evening_driver ?? state.currentRoute.evening_driver)
                            : undefined,
                    };
                }
            })
            .addCase(updateAdminRoute.rejected, (state, action) => {
                state.actionStatus = 'failed';
                state.actionError = action.payload as string;
            })
            .addCase(optimizeAdminRoute.pending, (state) => {
                state.actionStatus = 'loading';
                state.actionError = null;
            })
            .addCase(optimizeAdminRoute.fulfilled, (state, action) => {
                state.actionStatus = 'succeeded';
                const index = state.routes.findIndex(r => r.id === action.payload.id);
                if (index !== -1) {
                    state.routes[index] = action.payload;
                }
                if (state.currentRoute?.id === action.payload.id) {
                    state.currentRoute = action.payload;
                }
            })
            .addCase(optimizeAdminRoute.rejected, (state, action) => {
                state.actionStatus = 'failed';
                state.actionError = action.payload as string;
            })
            .addCase(reorderAdminRouteStops.fulfilled, (state, action) => {
                const index = state.routes.findIndex((r) => r.id === action.payload.id);
                if (index !== -1) {
                    state.routes[index] = action.payload;
                }
                if (state.currentRoute?.id === action.payload.id) {
                    state.currentRoute = action.payload;
                }
            })
            // Delete Route
            .addCase(deleteAdminRoute.pending, (state) => {
                state.actionStatus = 'loading';
                state.actionError = null;
            })
            .addCase(deleteAdminRoute.fulfilled, (state, action) => {
                state.actionStatus = 'succeeded';
                state.routes = state.routes.filter(r => r.id !== action.payload);
            })
            .addCase(deleteAdminRoute.rejected, (state, action) => {
                state.actionStatus = 'failed';
                state.actionError = action.payload as string;
            })
            // Assignments
            .addCase(fetchRouteAssignments.pending, (state) => {
                state.assignments = []; // clear so previous route's roster doesn't flash
            })
            .addCase(fetchRouteAssignments.fulfilled, (state, action) => {
                state.assignments = action.payload;
            })
            .addCase(assignEmployeeToRoute.pending, (state) => {
                state.assignmentStatus = 'loading';
            })
            .addCase(assignEmployeeToRoute.fulfilled, (state, action) => {
                state.assignmentStatus = 'succeeded';
                const idx = state.assignments.findIndex(a => a.user_id === action.payload.user_id);
                if (idx !== -1) {
                    state.assignments[idx] = action.payload;
                } else {
                    state.assignments.push(action.payload);
                }
            })
            .addCase(assignEmployeeToRoute.rejected, (state, action) => {
                state.assignmentStatus = 'failed';
            })
            .addCase(removeEmployeeFromRoute.fulfilled, (state, action) => {
                state.assignments = state.assignments.filter(a => a.user_id !== action.payload);
            })
            // Stop Management — always replace route_stops from fresh server data
            // so sibling sequences are always accurate after any mutation.
            .addCase(createRouteStop.fulfilled, (state, action) => {
                if (state.currentRoute && state.currentRoute.id === action.payload.routeId) {
                    state.currentRoute.route_stops = action.payload.stops;
                }
            })
            .addCase(updateRouteStop.fulfilled, (state, action) => {
                if (state.currentRoute && state.currentRoute.id === action.payload.routeId) {
                    state.currentRoute.route_stops = action.payload.stops;
                }
            })
            .addCase(deleteRouteStop.fulfilled, (state, action) => {
                if (state.currentRoute && state.currentRoute.id === action.payload.routeId) {
                    state.currentRoute.route_stops = action.payload.stops;
                }
            });
    },
});

export const { resetRouteActionStatus, resetAssignmentStatus, clearCurrentRoute, invalidateRoutesCache } = adminRoutesSlice.actions;

export const selectAdminRoutes = (state: RootState) => state.adminRoutes.routes;
export const selectCurrentRoute = (state: RootState) => state.adminRoutes.currentRoute;
export const selectRouteAssignments = (state: RootState) => state.adminRoutes.assignments;
export const selectAdminRoutesStatus = (state: RootState) => state.adminRoutes.status;
export const selectAdminRoutesError = (state: RootState) => state.adminRoutes.error;
export const selectAdminRoutesActionStatus = (state: RootState) => state.adminRoutes.actionStatus;
export const selectAssignmentStatus = (state: RootState) => state.adminRoutes.assignmentStatus;

export default adminRoutesSlice.reducer;
