"use client";

import { useEffect, useState } from "react";
import { Vehicle, QueryVehicleParams, VehicleCategory, OwnershipType } from "../../lib/services/api-client";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import {
    fetchAdminVehicles,
    createAdminVehicle,
    updateAdminVehicle,
    deleteAdminVehicle,
    selectAdminVehicles,
    selectAdminVehiclesStatus,
    selectAdminVehiclesError,
    selectAdminVehiclesActionStatus,
    selectVehicleFilters,
    selectAdminVehiclesPagination,
} from "../../lib/store/slices/adminVehiclesSlice";
import Pagination from "../../components/ui/Pagination";

import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { VehicleFormInline, type VehicleFormData } from "./components/VehicleFormInline";
import { PermissionGate } from "../components/PermissionGate";
import { AdminCan, useAdminAbility } from "../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { useDebounce } from "../../lib/hooks/useDebounce";
import { AdminPageHeader } from "../components/AdminPageHeader";

export default function VehiclesPage() {
    return (
        <PermissionGate permission="vehicles">
            <AdminCan I="read" a="Vehicles">
                <VehiclesPageContent />
            </AdminCan>
        </PermissionGate>
    );
}

function VehiclesPageContent() {
    const dispatch = useAppDispatch();
    const ability = useAdminAbility();
    const canCreate = ability.can("create", ADMIN_SUBJECTS.vehicles);
    const canUpdate = ability.can("update", ADMIN_SUBJECTS.vehicles);
    const canDelete = ability.can("delete", ADMIN_SUBJECTS.vehicles);
    const vehicles = useAppSelector(selectAdminVehicles);
    const status = useAppSelector(selectAdminVehiclesStatus);
    const error = useAppSelector(selectAdminVehiclesError);
    const actionStatus = useAppSelector(selectAdminVehiclesActionStatus);
    const savedFilters = useAppSelector(selectVehicleFilters);
    const pagination = useAppSelector(selectAdminVehiclesPagination);

    const [search, setSearch] = useState(savedFilters.search);
    const debouncedSearch = useDebounce(search, 500);

    // Filters - Initialize from Redux
    const [category, setCategory] = useState<string>(savedFilters.category);
    const [ownership, setOwnership] = useState<string>(savedFilters.ownership);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

    // Primary Data Fetching Effect
    useEffect(() => {
        const filtersChanged =
            debouncedSearch !== savedFilters.search ||
            category !== savedFilters.category ||
            ownership !== savedFilters.ownership;

        const shouldFetch = status === 'idle' || filtersChanged;

        if (shouldFetch) {
            if (filtersChanged && pagination.page !== 1) {
                handlePageChange(1);
            } else {
                const params: QueryVehicleParams = {
                    limit: 10,
                    page: pagination.page,
                    search: debouncedSearch || undefined,
                };
                if (category) (params as any).category = category;
                if (ownership) (params as any).ownership = ownership;

                dispatch(fetchAdminVehicles(params));
            }
        }
    }, [dispatch, debouncedSearch, category, ownership, status, pagination.page, savedFilters.search, savedFilters.category, savedFilters.ownership]);

    const handlePageChange = (page: number) => {
        const params: QueryVehicleParams = {
            limit: 10,
            page,
            search: debouncedSearch || undefined,
        };
        if (category) (params as any).category = category;
        if (ownership) (params as any).ownership = ownership;

        dispatch(fetchAdminVehicles(params));
    };

    const handleCreateNew = () => {
        setEditingVehicle(null);
        setIsModalOpen(true);
    };

    const handleEdit = (vehicle: Vehicle) => {
        setEditingVehicle(vehicle);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("Are you sure you want to delete this vehicle?")) {
            await dispatch(deleteAdminVehicle(id)).unwrap();
            handlePageChange(pagination.page);
        }
    };

    const handleSave = async (data: VehicleFormData) => {
        try {
            if (editingVehicle) {
                const {
                    driver_full_name,
                    driver_email,
                    driver_phone,
                    driver_password,
                    driver_cnic_number,
                    driver_license_number,
                    driver_type,
                    ...vehicleData
                } = data;

                await dispatch(updateAdminVehicle({ id: editingVehicle.id, data: vehicleData })).unwrap();
            } else {
                await dispatch(createAdminVehicle(data)).unwrap();
            }
            setIsModalOpen(false);
            setEditingVehicle(null);
            handlePageChange(pagination.page);
        } catch (err: any) {
            console.error("Failed to save vehicle:", err);
            alert(typeof err === 'string' ? err : (err?.message || "Failed to save vehicle"));
        }
    };

    const isLoading = status === 'loading';
    const isSaving = actionStatus === 'loading';

    return (
        <div className="flex flex-col gap-6 p-6 mx-auto">
            {/* Header */}
            <AdminPageHeader
              title="Vehicles"
              description="Fleet inventory across owned, vendor and client vehicles."
              action={
                <button
                    type="button"
                    onClick={handleCreateNew}
                    disabled={!canCreate}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#f47f00] px-5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-[#d97000] hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0"
                >
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Vehicle
                </button>
              }
            />

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search vehicles..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                        />
                    </div>
                </div>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-[#f47f00] outline-none bg-white"
                >
                    <option value="">All Categories</option>
                    {Object.values(VehicleCategory).map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                <select
                    value={ownership}
                    onChange={(e) => setOwnership(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-[#f47f00] outline-none bg-white"
                >
                    <option value="">All Ownership</option>
                    {Object.values(OwnershipType).map((type) => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#f8fafc] text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Vehicle</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4"> Seat Capacity</th>
                                <th className="px-6 py-4">Year</th>
                                <th className="px-6 py-4">Ownership</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading && vehicles.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading vehicles...</td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-red-500">{error}</td>
                                </tr>
                            ) : vehicles.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="font-medium">No vehicles found</span>
                                            <button type="button" onClick={handleCreateNew} disabled={!canCreate} className="text-sm text-[#f47f00] hover:underline disabled:opacity-50 disabled:no-underline">
                                                Add your first vehicle
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : vehicles.map((vehicle) => (
                                <tr key={vehicle.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-[#0c225e]">{vehicle.make} {vehicle.model}</div>
                                        <div className="text-xs text-slate-500">{vehicle.plate_number} • {vehicle.color}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge color="gray">
                                            {vehicle.category}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {vehicle.seat_capacity || 0}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {vehicle.year}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-start gap-1">
                                            <Badge color={vehicle.ownership === "OWNED" ? "blue" : "purple"}>
                                                {vehicle.ownership}
                                            </Badge>
                                            {vehicle.ownership === "PARTNER" && (
                                                <div className="mt-1 flex flex-col gap-0.5 text-xs text-slate-500">
                                                    {vehicle.vendors && (
                                                        <div className="font-semibold text-slate-700">
                                                            {vehicle.vendors.name}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-2">
                                                        <span title="City Rent" className="whitespace-nowrap">
                                                            City: <span className="font-medium text-slate-700">{vehicle.rent_per_day_city?.toLocaleString() ?? 0}</span>
                                                        </span>
                                                        <span title="Outstation Rent" className="whitespace-nowrap">
                                                            Out: <span className="font-medium text-slate-700">{vehicle.rent_per_day_outstation?.toLocaleString() ?? 0}</span>
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {vehicle.vendor_overtime_rate ? (
                                                            <span title="Overtime Rate" className="whitespace-nowrap">
                                                                OT: <span className="font-medium text-slate-700">{vehicle.vendor_overtime_rate?.toLocaleString()}</span>
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {vehicle.vendor_rent_5hr ? (
                                                            <span title="5h Fixed Rent" className="whitespace-nowrap">
                                                                5h: <span className="font-medium text-slate-700">{vehicle.vendor_rent_5hr?.toLocaleString()}</span>
                                                            </span>
                                                        ) : null}
                                                        {vehicle.vendor_rent_10hr ? (
                                                            <span title="10h Fixed Rent" className="whitespace-nowrap">
                                                                10h: <span className="font-medium text-slate-700">{vehicle.vendor_rent_10hr?.toLocaleString()}</span>
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(vehicle)}
                                                disabled={!canUpdate}
                                                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0c225e] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                                title="Edit Details"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(vehicle.id)}
                                                disabled={!canDelete}
                                                className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                                title="Delete Vehicle"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={handlePageChange}
                />
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={!editingVehicle ? "Add New Vehicle" : "Edit Vehicle"}
            >
                <VehicleFormInline
                    vehicle={editingVehicle}
                    onSave={handleSave}
                    onCancel={() => setIsModalOpen(false)}
                    isSaving={isSaving}
                    saveDisabled={editingVehicle ? !canUpdate : !canCreate}
                />
            </Modal>

        </div>
    );
}
