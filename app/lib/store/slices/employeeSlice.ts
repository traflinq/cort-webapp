import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { apiClient } from '../../services/api-client';

const STALE_TIME_MS = 60_000; // 60 seconds

export type Employee = {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    status: string;
    company_id: number | null;
    employee_id?: string | null;
    department?: string | null;
    home_address?: string | null;
    travel_grade_id?: number | null;
    travel_grade?: { id: number; name: string; approval_required: boolean } | null;
};

interface EmployeeState {
    employees: Employee[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
    lastFetched: number | null;
}

const initialState: EmployeeState = {
    employees: [],
    status: 'idle',
    error: null,
    lastFetched: null,
};

export const fetchEmployees = createAsyncThunk(
    'employee/fetchEmployees',
    async (companyId: string, { rejectWithValue }) => {
        try {
            const response = await apiClient.getEmployees({ company_id: Number(companyId), limit: 1000 } as any);
            return response.data?.data || response.data || response || [];
        } catch (err) {
            return rejectWithValue(err instanceof Error ? err.message : 'Failed to fetch employees');
        }
    },
    {
        condition: (_, { getState }) => {
            const state = getState() as RootState;
            const { lastFetched, status } = state.employees;
            if (status === 'loading') return false;
            if (lastFetched && Date.now() - lastFetched < STALE_TIME_MS) return false;
            return true;
        }
    }
);

export const updateEmployee = createAsyncThunk(
    'employee/updateEmployee',
    async ({ employeeId, data }: { employeeId: string; data: Partial<Employee> }, { rejectWithValue }) => {
        try {
            const response = await apiClient.updateEmployee(employeeId, data as any);
            return response.data || response;
        } catch (err) {
            return rejectWithValue(err instanceof Error ? err.message : 'Failed to update employee');
        }
    }
);

export const deactivateEmployee = createAsyncThunk(
    'employee/deactivateEmployee',
    async ({ employeeId, isActive }: { employeeId: string; isActive: boolean }, { rejectWithValue }) => {
        try {
            await apiClient.updateEmployee(employeeId, { status: isActive ? 'ACTIVE' : 'INACTIVE' } as any);
            return { employeeId, status: isActive ? 'ACTIVE' : 'INACTIVE' };
        } catch (err) {
            return rejectWithValue(err instanceof Error ? err.message : 'Failed to update employee status');
        }
    }
);

export const employeeSlice = createSlice({
    name: 'employees',
    initialState,
    reducers: {
        invalidateEmployeesCache: (state) => {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchEmployees.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchEmployees.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.lastFetched = Date.now();
                state.employees = action.payload;
            })
            .addCase(fetchEmployees.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload as string;
            })
            // Update
            .addCase(updateEmployee.fulfilled, (state, action) => {
                const updated = (action.payload as any)?.data ?? action.payload;
                if (updated?.id) {
                    const index = state.employees.findIndex(e => e.id === updated.id);
                    if (index !== -1) {
                        state.employees[index] = { ...state.employees[index], ...updated };
                    }
                }
                // Force refetch on next load
                state.lastFetched = null;
            })
            // Deactivate
            .addCase(deactivateEmployee.fulfilled, (state, action) => {
                const { employeeId, status } = action.payload as { employeeId: string; status: string };
                const index = state.employees.findIndex(e => e.id === employeeId);
                if (index !== -1) {
                    state.employees[index].status = status;
                }
            });
    },
});

export const { invalidateEmployeesCache } = employeeSlice.actions;

export const selectEmployees = (state: RootState) => state.employees.employees;
export const selectEmployeesStatus = (state: RootState) => state.employees.status;

export default employeeSlice.reducer;
