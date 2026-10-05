import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
    apiClient,
    Company,
    ChauffeurContract,
    ChauffeurContractRate,
    CreateChauffeurContractRequest,
    ShuttleContract,
    ShuttleContractRoute,
    CreateShuttleContractRequest,
    FixedTermContract,
    CreateFixedTermContractRequest,
    UpdateFixedTermContractRequest,
    FuelPriceHistoryEntry,
} from '../../services/api-client';
import { RootState } from '../store';

const STALE_TIME_MS = 60_000; // 60 seconds

/** "" / null / undefined / NaN -> null (no override); otherwise the numeric value. */
const toNullableNumber = (v: string | number | null | undefined): number | null => {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export type RateRow = Partial<ChauffeurContractRate> & { tempId?: string; isNew?: boolean; isDeleted?: boolean };
export type ShuttleRouteRow = Partial<ShuttleContractRoute> & { tempId?: string; isNew?: boolean; isDeleted?: boolean };

interface AdminPricingState {
    companies: Company[];
    selectedCompanyId: string;
    currentCompany: Company | null;
    contract: ChauffeurContract | null;
    shuttleContract: ShuttleContract | null;
    fixedTermContracts: FixedTermContract[];
    globalSettings: {
        fuelBasePrice: string;
        revisionPercentage: string;
        contractDuration: string;
        contractDate: string;
        allowanceOutstation: string;
        allowanceAccommodation: string;
    };
    rateRows: RateRow[];
    shuttleSettings: {
        fuelBasePrice: string;
        dieselBasePrice: string;
        revisionPercentage: string;
        sstPercentage: string;
        contractDuration: string;
        contractDate: string;
    };
    shuttleRouteRows: ShuttleRouteRow[];
    systemFuelPrice: string;
    systemDieselPrice: string;
    fuelPriceHistory: FuelPriceHistoryEntry[];
    dieselPriceHistory: FuelPriceHistoryEntry[];

    // Preview
    showPreview: boolean;
    previewData: any;
    isLoadingPreview: boolean;

    // Statuses
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    actionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
    lastFetched: number | null;
}

const initialState: AdminPricingState = {
    companies: [],
    selectedCompanyId: "",
    currentCompany: null,
    contract: null,
    shuttleContract: null,
    fixedTermContracts: [],
    globalSettings: {
        fuelBasePrice: "0",
        revisionPercentage: "",
        contractDuration: "",
        contractDate: "",
        allowanceOutstation: "",
        allowanceAccommodation: ""
    },
    rateRows: [],
    shuttleSettings: {
        fuelBasePrice: "0",
        dieselBasePrice: "",
        revisionPercentage: "",
        sstPercentage: "10",
        contractDuration: "",
        contractDate: "",
    },
    shuttleRouteRows: [],
    systemFuelPrice: "0",
    systemDieselPrice: "0",
    fuelPriceHistory: [],
    dieselPriceHistory: [],

    showPreview: false,
    previewData: null,
    isLoadingPreview: false,

    status: 'idle',
    actionStatus: 'idle',
    error: null,
    lastFetched: null,
};

// Async Thunks

export const fetchPricingCompanies = createAsyncThunk(
    'adminPricing/fetchPricingCompanies',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiClient.getCompanies({ limit: 100 });
            return response.data.data;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch companies');
        }
    },
    {
        condition: (_, { getState }) => {
            const state = getState() as RootState;
            const { lastFetched, status } = state.adminPricing;
            if (status === 'loading') return false;
            if (lastFetched && Date.now() - lastFetched < STALE_TIME_MS) return false;
            return true;
        }
    }
);

export const fetchSystemFuelPrice = createAsyncThunk(
    'adminPricing/fetchSystemFuelPrice',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiClient.getSystemSetting('current_fuel_price');
            return response.data.value;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch fuel price');
        }
    }
);

export const updateSystemFuelPrice = createAsyncThunk(
    'adminPricing/updateSystemFuelPrice',
    async (value: string, { rejectWithValue }) => {
        try {
            await apiClient.updateSystemSetting('current_fuel_price', value);
            return value;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to update fuel price');
        }
    }
);

export const fetchSystemDieselPrice = createAsyncThunk(
    'adminPricing/fetchSystemDieselPrice',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiClient.getSystemSetting('current_diesel_price');
            return response.data.value;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch diesel price');
        }
    }
);

export const updateSystemDieselPrice = createAsyncThunk(
    'adminPricing/updateSystemDieselPrice',
    async (value: string, { rejectWithValue }) => {
        try {
            await apiClient.updateSystemSetting('current_diesel_price', value);
            return value;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to update diesel price');
        }
    }
);

export const fetchFuelPriceHistory = createAsyncThunk(
    'adminPricing/fetchFuelPriceHistory',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiClient.getFuelPriceHistory('PETROL');
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch fuel price history');
        }
    }
);

export const fetchDieselPriceHistory = createAsyncThunk(
    'adminPricing/fetchDieselPriceHistory',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiClient.getFuelPriceHistory('DIESEL');
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch diesel price history');
        }
    }
);

export const fetchCompanyContractDetails = createAsyncThunk(
    'adminPricing/fetchCompanyContractDetails',
    async (companyId: string, { rejectWithValue }) => {
        try {
            const [compRes, contractsRes] = await Promise.all([
                apiClient.getCompany(companyId),
                apiClient.getChauffeurContracts(Number(companyId))
            ]);
            return {
                company: compRes.data,
                contracts: contractsRes.data
            };
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch contract details');
        }
    }
);

export const previewRateAdjustments = createAsyncThunk(
    'adminPricing/previewRateAdjustments',
    async ({ fuelPrice, companyId }: { fuelPrice: number, companyId: number }, { getState, rejectWithValue }) => {
        try {
            const state = getState() as RootState;
            const dieselPrice = state.adminPricing.systemDieselPrice
                ? Number(state.adminPricing.systemDieselPrice)
                : undefined;
            const response = await apiClient.previewRateAdjustments(fuelPrice, companyId, dieselPrice);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to preview adjustments');
        }
    }
);

export const savePricingChanges = createAsyncThunk(
    'adminPricing/savePricingChanges',
    async (_, { getState, rejectWithValue, dispatch }) => {
        const state = getState() as RootState;
        const { contract, globalSettings, selectedCompanyId, rateRows } = state.adminPricing;

        try {
            let currentContractId = contract?.id;
            // UI stores revision threshold as a percent (e.g. "10" for 10%); backend expects decimal fraction (0.10)
            const revisionPct =
                globalSettings.revisionPercentage === ""
                    ? null
                    : Number(globalSettings.revisionPercentage) / 100;

            // 1. Update or Create Contract
            if (currentContractId) {
                await apiClient.updateChauffeurContract(currentContractId, {
                    fuelBasePrice: Number(globalSettings.fuelBasePrice),
                    revisionPercentage: revisionPct,
                    contractDuration: globalSettings.contractDuration,
                    contractDate: globalSettings.contractDate,
                    allowanceOutstation: Number(globalSettings.allowanceOutstation),
                    allowanceAccommodation: Number(globalSettings.allowanceAccommodation)
                });
            } else {
                const res = await apiClient.createChauffeurContract({
                    companyId: Number(selectedCompanyId),
                    fuelBasePrice: Number(globalSettings.fuelBasePrice),
                    revisionPercentage: revisionPct,
                    contractDuration: globalSettings.contractDuration,
                    contractDate: globalSettings.contractDate,
                    allowanceOutstation: Number(globalSettings.allowanceOutstation),
                    allowanceAccommodation: Number(globalSettings.allowanceAccommodation),
                    vehicleModel: ""
                });
                currentContractId = res.data.id;
            }

            // 2. Save Rates
            const promises = rateRows.map(async (row) => {
                if (!row.vehicle_model) return;

                const commonData = {
                    vehicleModel: row.vehicle_model,
                    costPerKm: Number(row.cost_per_km || 0),
                    rateSpot5hr: Number(row.rate_spot_5hr),
                    rateSpot10hr: Number(row.rate_spot_10hr),
                    rateSpot24hr: Number(row.rate_spot_24hr),
                    rateMonthly10hr: Number(row.rate_monthly_10hr),
                    rateMonthly24hr: Number(row.rate_monthly_24hr),
                    rateOvertimePerHr: Number(row.rate_overtime_per_hr || 0),
                    marketCostPerKm: Number(row.market_cost_per_km || 0),
                    marketRateSpot5hr: Number(row.market_rate_spot_5hr || 0),
                    marketRateSpot10hr: Number(row.market_rate_spot_10hr || 0),
                    marketRateSpot24hr: Number(row.market_rate_spot_24hr || 0),
                    marketRateMonthly10hr: Number(row.market_rate_monthly_10hr || 0),
                    marketRateMonthly24hr: Number(row.market_rate_monthly_24hr || 0),
                    marketRateOvertimePerHr: Number(row.market_rate_overtime_per_hr || 0),
                    // Empty = no override (null) -> company default applies. "0" is a real override.
                    vehicleAllowanceOutstation: toNullableNumber(row.allowance_outstation),
                    vehicleAllowanceAccommodation: toNullableNumber(row.allowance_accommodation),
                };

                if (row.isNew) {
                    await apiClient.createChauffeurContract({
                        companyId: Number(selectedCompanyId),
                        fuelBasePrice: Number(globalSettings.fuelBasePrice),
                        revisionPercentage: revisionPct,
                        contractDuration: globalSettings.contractDuration,
                        contractDate: globalSettings.contractDate,
                        allowanceOutstation: Number(globalSettings.allowanceOutstation),
                        allowanceAccommodation: Number(globalSettings.allowanceAccommodation),
                        ...commonData
                    });
                } else if (row.id) {
                    await apiClient.updateChauffeurRate(row.id, commonData);
                }
            });

            await Promise.all(promises);

            // 3. Refresh details
            dispatch(fetchCompanyContractDetails(selectedCompanyId));
            return;

        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to save changes');
        }
    }
);

export const fetchShuttleContract = createAsyncThunk(
    'adminPricing/fetchShuttleContract',
    async (companyId: string, { rejectWithValue }) => {
        try {
            const response = await apiClient.getShuttleContract(Number(companyId));
            return {
                companyId,
                contract: response.data,
            };
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch shuttle contract');
        }
    },
);

export const fetchFixedTermContracts = createAsyncThunk(
    'adminPricing/fetchFixedTermContracts',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiClient.getFixedTermContracts();
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const createFixedTermContractAsync = createAsyncThunk(
    'adminPricing/createFixedTermContract',
    async (data: CreateFixedTermContractRequest, { rejectWithValue }) => {
        try {
            const response = await apiClient.createFixedTermContract(data);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateFixedTermContractAsync = createAsyncThunk(
    'adminPricing/updateFixedTermContract',
    async ({ id, data }: { id: number, data: UpdateFixedTermContractRequest }, { rejectWithValue }) => {
        try {
            const response = await apiClient.updateFixedTermContract(id, data);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteFixedTermContractAsync = createAsyncThunk(
    'adminPricing/deleteFixedTermContract',
    async (id: number, { rejectWithValue }) => {
        try {
            await apiClient.deleteFixedTermContract(id);
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const saveShuttleChanges = createAsyncThunk(
    'adminPricing/saveShuttleChanges',
    async (_, { getState, rejectWithValue, dispatch }) => {
        const state = getState() as RootState;
        const { selectedCompanyId, shuttleSettings, shuttleRouteRows } = state.adminPricing;

        try {
            const revisionPct =
                shuttleSettings.revisionPercentage === ''
                    ? null
                    : Number(shuttleSettings.revisionPercentage) / 100;

            const sstPct =
                shuttleSettings.sstPercentage === ''
                    ? undefined
                    : Number(shuttleSettings.sstPercentage);

            const routes = shuttleRouteRows
                .filter((row) => !row.isDeleted)
                .map((row) => ({
                    particulars: row.particulars || '',
                    vehicleType: row.vehicle_type || '',
                    fixedCostPerVehicle: Number(row.fixed_cost_per_vehicle || 0),
                    fuelCostPerVehicle: Number(row.fuel_cost_per_vehicle || 0),
                    quantity: Number(row.quantity || 0),
                    billingType: row.billing_type || 'MONTHLY',
                    scheduledDays: row.scheduled_days || undefined,
                    fuelType: row.fuel_type || 'PETROL',
                }))
                .filter((r) => r.particulars && r.vehicleType && r.quantity > 0);

            const payload: CreateShuttleContractRequest = {
                companyId: Number(selectedCompanyId),
                fuelBasePrice: Number(shuttleSettings.fuelBasePrice || 0),
                dieselBasePrice: shuttleSettings.dieselBasePrice !== '' ? Number(shuttleSettings.dieselBasePrice) : null,
                revisionPercentage: revisionPct,
                sstPercentage: sstPct,
                contractDuration: shuttleSettings.contractDuration || undefined,
                contractDate: shuttleSettings.contractDate || undefined,
                routes,
            };

            await apiClient.createOrUpdateShuttleContract(payload);

            dispatch(fetchShuttleContract(selectedCompanyId));
            return;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to save shuttle contract');
        }
    },
);

export const deleteRateRow = createAsyncThunk(
    'adminPricing/deleteRateRow',
    async (index: number, { getState, rejectWithValue, dispatch }) => {
        const state = getState() as RootState;
        const row = state.adminPricing.rateRows[index];

        try {
            if (row.id) {
                await apiClient.deleteChauffeurRate(row.id);
            }
            // If it's new (no ID), we just need to return the index to remove it from state
            return index;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to delete rate');
        }
    }
);


const adminPricingSlice = createSlice({
    name: 'adminPricing',
    initialState,
    reducers: {
        setSelectedCompanyId(state, action: PayloadAction<string>) {
            state.selectedCompanyId = action.payload;
        },
        setGlobalSettings(state, action: PayloadAction<Partial<AdminPricingState['globalSettings']>>) {
            state.globalSettings = { ...state.globalSettings, ...action.payload };
        },
        setSystemFuelPriceLocal(state, action: PayloadAction<string>) {
            state.systemFuelPrice = action.payload;
        },
        setSystemDieselPriceLocal(state, action: PayloadAction<string>) {
            state.systemDieselPrice = action.payload;
        },
        setShowPreview(state, action: PayloadAction<boolean>) {
            state.showPreview = action.payload;
        },
        setShuttleSettings(state, action: PayloadAction<Partial<AdminPricingState['shuttleSettings']>>) {
            state.shuttleSettings = { ...state.shuttleSettings, ...action.payload };
        },
        addRateRow(state) {
            state.rateRows.push({
                tempId: Date.now().toString(),
                isNew: true,
                vehicle_model: "",
                cost_per_km: "0",
                rate_spot_5hr: "0",
                rate_spot_10hr: "0",
                rate_spot_24hr: "0",
                rate_monthly_10hr: "0",
                rate_monthly_24hr: "0",
                rate_overtime_per_hr: "0",
                market_cost_per_km: "0",
                market_rate_spot_5hr: "0",
                market_rate_spot_10hr: "0",
                market_rate_spot_24hr: "0",
                market_rate_monthly_10hr: "0",
                market_rate_monthly_24hr: "0",
                market_rate_overtime_per_hr: "0"
            });
        },
        addShuttleRouteRow(state) {
            state.shuttleRouteRows.push({
                tempId: Date.now().toString(),
                isNew: true,
                particulars: "",
                vehicle_type: "",
                fixed_cost_per_vehicle: "0",
                fuel_cost_per_vehicle: "0",
                quantity: 1,
                billing_type: "MONTHLY",
                scheduled_days: "",
                fuel_type: "PETROL",
            });
        },
        updateRateRow(state, action: PayloadAction<{ index: number, field: keyof ChauffeurContractRate, value: string }>) {
            const { index, field, value } = action.payload;
            if (state.rateRows[index]) {
                state.rateRows[index] = { ...state.rateRows[index], [field]: value };
            }
        },
        updateShuttleRouteRow(
            state,
            action: PayloadAction<{ index: number; field: keyof ShuttleContractRoute | 'quantity'; value: string }>,
        ) {
            const { index, field, value } = action.payload;
            if (state.shuttleRouteRows[index]) {
                const row = state.shuttleRouteRows[index];
                if (field === 'quantity') {
                    state.shuttleRouteRows[index] = {
                        ...row,
                        quantity: Number(value || 0),
                    };
                } else {
                    // @ts-ignore - allow updating string fields by key
                    state.shuttleRouteRows[index] = { ...row, [field]: value };
                }
            }
        },
        removeShuttleRouteRow(state, action: PayloadAction<number>) {
            state.shuttleRouteRows = state.shuttleRouteRows.filter((_, index) => index !== action.payload);
        },
        resetActionStatus(state) {
            state.actionStatus = 'idle';
        },
        invalidatePricingCache(state) {
            state.lastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Companies
            .addCase(fetchPricingCompanies.fulfilled, (state, action) => {
                state.companies = action.payload;
                state.lastFetched = Date.now();
                if (action.payload.length > 0 && !state.selectedCompanyId) {
                    state.selectedCompanyId = String(action.payload[0].id);
                }
            })
            // Fetch Fuel Price
            .addCase(fetchSystemFuelPrice.fulfilled, (state, action) => {
                state.systemFuelPrice = action.payload;
            })
            // Fetch Diesel Price
            .addCase(fetchSystemDieselPrice.fulfilled, (state, action) => {
                state.systemDieselPrice = action.payload;
            })
            // Fetch Fuel Price History
            .addCase(fetchFuelPriceHistory.fulfilled, (state, action) => {
                state.fuelPriceHistory = action.payload;
            })
            // Fetch Diesel Price History
            .addCase(fetchDieselPriceHistory.fulfilled, (state, action) => {
                state.dieselPriceHistory = action.payload;
            })
            // Update Fuel Price
            .addCase(updateSystemFuelPrice.pending, (state) => { state.actionStatus = 'loading'; })
            .addCase(updateSystemFuelPrice.fulfilled, (state) => { state.actionStatus = 'succeeded'; })
            .addCase(updateSystemFuelPrice.rejected, (state, action) => {
                state.actionStatus = 'failed';
                state.error = action.payload as string;
            })
            // Update Diesel Price
            .addCase(updateSystemDieselPrice.pending, (state) => { state.actionStatus = 'loading'; })
            .addCase(updateSystemDieselPrice.fulfilled, (state) => { state.actionStatus = 'succeeded'; })
            .addCase(updateSystemDieselPrice.rejected, (state, action) => {
                state.actionStatus = 'failed';
                state.error = action.payload as string;
            })
            // Fetch Details
            .addCase(fetchCompanyContractDetails.pending, (state) => { state.status = 'loading'; })
            .addCase(fetchCompanyContractDetails.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.currentCompany = action.payload.company;
                const contracts = action.payload.contracts;

                if (contracts && contracts.length > 0) {
                    const mainContract = contracts[0];
                    state.contract = mainContract;
                    state.globalSettings = {
                        fuelBasePrice: mainContract.fuel_base_price,
                        revisionPercentage:
                            mainContract.revision_percentage != null && mainContract.revision_percentage !== ""
                                ? String(Number(mainContract.revision_percentage) * 100)
                                : "",
                        contractDuration: mainContract.contract_duration || "",
                        contractDate: mainContract.created_at ? new Date(mainContract.created_at).toISOString().split('T')[0] : "",
                        allowanceOutstation: mainContract.allowance_outstation || "",
                        allowanceAccommodation: mainContract.allowance_accommodation || ""
                    };
                    state.rateRows = mainContract.chauffeur_contract_rates || [];
                } else {
                    state.contract = null;
                    state.globalSettings = {
                        fuelBasePrice: "300",
                        revisionPercentage: "",
                        contractDuration: "",
                        contractDate: "",
                        allowanceOutstation: "",
                        allowanceAccommodation: ""
                    };
                    state.rateRows = [];
                }
            })
            .addCase(fetchCompanyContractDetails.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload as string;
            })
            // Preview
            .addCase(previewRateAdjustments.pending, (state) => { state.isLoadingPreview = true; })
            .addCase(previewRateAdjustments.fulfilled, (state, action) => {
                state.isLoadingPreview = false;
                state.previewData = action.payload;
            })
            .addCase(previewRateAdjustments.rejected, (state) => { state.isLoadingPreview = false; })
            // Save
            .addCase(savePricingChanges.pending, (state) => { state.actionStatus = 'loading'; })
            .addCase(savePricingChanges.fulfilled, (state) => { state.actionStatus = 'succeeded'; })
            .addCase(savePricingChanges.rejected, (state, action) => {
                state.actionStatus = 'failed';
                state.error = action.payload as string;
            })
            // Shuttle contract fetch
            .addCase(fetchShuttleContract.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchShuttleContract.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.shuttleContract = action.payload.contract;

                const contract = action.payload.contract;
                if (contract) {
                    state.shuttleSettings = {
                        fuelBasePrice: contract.fuel_base_price,
                        dieselBasePrice: contract.diesel_base_price || '',
                        revisionPercentage:
                            contract.revision_percentage != null && contract.revision_percentage !== ""
                                ? String(Number(contract.revision_percentage) * 100)
                                : '',
                        sstPercentage: contract.sst_percentage || '10',
                        contractDuration: contract.contract_duration || '',
                        contractDate: contract.created_at
                            ? new Date(contract.created_at).toISOString().split('T')[0]
                            : '',
                    };
                    state.shuttleRouteRows = contract.shuttle_contract_routes || [];
                } else {
                    state.shuttleSettings = {
                        fuelBasePrice: '0',
                        dieselBasePrice: '',
                        revisionPercentage: '',
                        sstPercentage: '10',
                        contractDuration: '',
                        contractDate: '',
                    };
                    state.shuttleRouteRows = [];
                }
            })
            .addCase(fetchShuttleContract.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload as string;
            })
            // Shuttle save
            .addCase(saveShuttleChanges.pending, (state) => {
                state.actionStatus = 'loading';
            })
            .addCase(saveShuttleChanges.fulfilled, (state) => {
                state.actionStatus = 'succeeded';
            })
            .addCase(saveShuttleChanges.rejected, (state, action) => {
                state.actionStatus = 'failed';
                state.error = action.payload as string;
            })
            // Fixed Term
            .addCase(fetchFixedTermContracts.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchFixedTermContracts.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.fixedTermContracts = action.payload;
            })
            .addCase(fetchFixedTermContracts.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload as string;
            })
            .addCase(createFixedTermContractAsync.pending, (state) => {
                state.actionStatus = 'loading';
            })
            .addCase(createFixedTermContractAsync.fulfilled, (state, action) => {
                state.fixedTermContracts.unshift(action.payload);
                state.actionStatus = 'succeeded';
            })
            .addCase(createFixedTermContractAsync.rejected, (state, action) => {
                state.actionStatus = 'failed';
                state.error = action.payload as string;
            })
            .addCase(updateFixedTermContractAsync.pending, (state) => {
                state.actionStatus = 'loading';
            })
            .addCase(updateFixedTermContractAsync.fulfilled, (state, action) => {
                const idx = state.fixedTermContracts.findIndex(c => c.id === action.payload.id);
                if (idx !== -1) state.fixedTermContracts[idx] = action.payload;
                state.actionStatus = 'succeeded';
            })
            .addCase(updateFixedTermContractAsync.rejected, (state, action) => {
                state.actionStatus = 'failed';
                state.error = action.payload as string;
            })
            .addCase(deleteFixedTermContractAsync.pending, (state) => {
                state.actionStatus = 'loading';
            })
            .addCase(deleteFixedTermContractAsync.fulfilled, (state, action) => {
                state.fixedTermContracts = state.fixedTermContracts.filter(c => c.id !== action.payload);
                state.actionStatus = 'succeeded';
            })
            .addCase(deleteFixedTermContractAsync.rejected, (state, action) => {
                state.actionStatus = 'failed';
                state.error = action.payload as string;
            })
            // Delete Rate
            .addCase(deleteRateRow.fulfilled, (state, action) => {
                state.rateRows = state.rateRows.filter((_, i) => i !== action.payload);
            });
    },
});

export const {
    setSelectedCompanyId,
    setGlobalSettings,
    setSystemFuelPriceLocal,
    setSystemDieselPriceLocal,
    setShowPreview,
    setShuttleSettings,
    addRateRow,
    addShuttleRouteRow,
    updateRateRow,
    updateShuttleRouteRow,
    removeShuttleRouteRow,
    resetActionStatus,
    invalidatePricingCache
} = adminPricingSlice.actions;

export const selectAdminPricingState = (state: RootState) => state.adminPricing;
export const selectPricingCompanies = (state: RootState) => state.adminPricing.companies;
export const selectPricingCurrentCompany = (state: RootState) => state.adminPricing.currentCompany;
export const selectPricingGlobalSettings = (state: RootState) => state.adminPricing.globalSettings;
export const selectPricingRateRows = (state: RootState) => state.adminPricing.rateRows;
export const selectShuttleSettings = (state: RootState) => state.adminPricing.shuttleSettings;
export const selectShuttleRouteRows = (state: RootState) => state.adminPricing.shuttleRouteRows;
export const selectPricingStatus = (state: RootState) => state.adminPricing.status;
export const selectPricingActionStatus = (state: RootState) => state.adminPricing.actionStatus;

export default adminPricingSlice.reducer;
