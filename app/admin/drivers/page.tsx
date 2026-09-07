"use client";

import { useEffect, useState } from "react";
import {
    Driver,
    CreateDriverRequest,
    DriverType,
    DriverStatus,
    DriverStatusAction,
    QueryDriverParams,
    RideReview,
    apiClient
} from "../../lib/services/api-client";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import {
    fetchAdminDrivers,
    fetchPendingChauffeurs,
    createAdminDriver,
    updateAdminDriver,
    updateAdminDriverStatus,
    deleteAdminDriver,
    resetAdminDriverPassword,
    selectAdminDrivers,
    selectAdminDriversStatus,
    selectAdminDriversError,
    selectAdminDriversActionStatus,
    selectDriverFilters,
    resetDriversActionStatus,
    selectAdminDriversPagination,
} from "../../lib/store/slices/adminDriversSlice";
import Pagination from "../../components/ui/Pagination";

import { cx } from "../components/ui/cx";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { CredentialsModal } from "../components/ui/CredentialsModal";
import { DriverForm } from "./components/DriverForm";
import { ChauffeurApplicationDetail } from "./components/ChauffeurApplicationDetail";
import { DriverAvgRating } from "./components/DriverAvgRating";
import { DriverPasswordResetModal } from "./components/DriverPasswordResetModal";
import { AdminProtectedPage } from "../components/AdminProtectedPage";
import { useAdminAbility } from "../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { displayDriverEmail } from "../../lib/utils/driverEmailDisplay";
import { useDebounce } from "../../lib/hooks/useDebounce";
import { useConfirm } from "../../lib/hooks/useConfirm";
import { toast } from "sonner";

type ApplicationModalMode = "view" | "approve" | "reject";

// -- Main Page Definition --

export default function DriversPage() {
    return (
        <AdminProtectedPage permission="drivers" subject={ADMIN_SUBJECTS.drivers}>
            <DriversPageContent />
        </AdminProtectedPage>
    );
}

function DriversPageContent() {
    const dispatch = useAppDispatch();
    const confirm = useConfirm();
    const ability = useAdminAbility();
    const canCreate = ability.can("create", ADMIN_SUBJECTS.drivers);
    const canUpdate = ability.can("update", ADMIN_SUBJECTS.drivers);
    const canDelete = ability.can("delete", ADMIN_SUBJECTS.drivers);
    const drivers = useAppSelector(selectAdminDrivers);
    const status = useAppSelector(selectAdminDriversStatus);
    const error = useAppSelector(selectAdminDriversError);
    const actionStatus = useAppSelector(selectAdminDriversActionStatus);
    const savedFilters = useAppSelector(selectDriverFilters);
    const pagination = useAppSelector(selectAdminDriversPagination);

    const [activeTab, setActiveTab] = useState<"ALL" | "SHUTTLE" | "CHAUFFEUR" | "PENDING_CHAUFFEUR">("ALL");

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState<{ email: string, password?: string } | null>(null);
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
    const [passwordResetDriver, setPasswordResetDriver] = useState<Driver | null>(null);
    const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] = useState(false);

    // Zoom Image Modal
    const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<{ url: string, name: string } | null>(null);

    const [rejectionReason, setRejectionReason] = useState("");

    const isPendingChauffeurTab = activeTab === "PENDING_CHAUFFEUR";

    const [applicationModal, setApplicationModal] = useState<{
        driver: Driver;
        mode: ApplicationModalMode;
    } | null>(null);

    // Review Modal States
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [selectedDriverForReviews, setSelectedDriverForReviews] = useState<Driver | null>(null);
    const [reviews, setReviews] = useState<RideReview[]>([]);
    const [isReviewsLoading, setIsReviewsLoading] = useState(false);
    const [reviewsPagination, setReviewsPagination] = useState({ page: 1, pages: 1 });

    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 500);

    // Load drivers when filters change
    useEffect(() => {
        loadDrivers();
    }, [activeTab, debouncedSearch]);

    useEffect(() => {
        if (!isPendingChauffeurTab) {
            setApplicationModal(null);
        }
    }, [isPendingChauffeurTab]);

    const openApplicationModal = (driver: Driver, mode: ApplicationModalMode) => {
        setRejectionReason("");
        setApplicationModal({ driver, mode });
    };

    const closeApplicationModal = () => {
        setApplicationModal(null);
        setRejectionReason("");
    };

    const loadDrivers = async (page = 1) => {
        const params: QueryDriverParams & { activeTab?: string } = { limit: 10, page, search: debouncedSearch, activeTab };

        if (activeTab === "PENDING_CHAUFFEUR") {
            dispatch(fetchPendingChauffeurs(params));
        } else {
            if (activeTab === "SHUTTLE") params.driver_type = DriverType.SHUTTLE;
            if (activeTab === "CHAUFFEUR") params.driver_type = DriverType.CHAUFFEUR;
            dispatch(fetchAdminDrivers(params));
        }
    };

    const handlePageChange = (page: number) => {
        loadDrivers(page);
    };

    const handleZoomImage = (url: string, name: string) => {
        setZoomedImage({ url, name });
        setIsZoomModalOpen(true);
    };

    const handleCreateNew = () => {
        setEditingDriver(null);
        setIsCreateModalOpen(true);
    };

    const handleEdit = (driver: Driver) => {
        setEditingDriver(driver);
        setIsCreateModalOpen(true);
    }

    const handleViewReviews = async (driver: Driver, page = 1) => {
        setSelectedDriverForReviews(driver);
        setIsReviewModalOpen(true);
        setIsReviewsLoading(true);
        try {
            const response = await apiClient.getDriverReviews(driver.id, page, 5);
            setReviews(response.data.data);
            setReviewsPagination({
                page: response.data.pagination.page,
                pages: response.data.pagination.pages
            });
        } catch (err) {
            console.error("Failed to fetch reviews:", err);
        } finally {
            setIsReviewsLoading(false);
        }
    };

    const handleSave = async (data: CreateDriverRequest) => {
        try {
            if (!data.full_name || !data.email) {
                toast.error("Please fill in all required fields (Name, Email)");
                return;
            }

            let finalData = { ...data };
            if (!editingDriver && !finalData.password) {
                const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
                let pass = "";
                for (let i = 0; i < 12; i++) {
                    pass += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                finalData.password = pass;
            }

            if (!editingDriver && finalData.password && finalData.password.length < 6) {
                toast.error("Password must be at least 6 characters long");
                return;
            }

            if (editingDriver) {
                const { email, password, ...updateData } = finalData;
                await dispatch(updateAdminDriver({ id: editingDriver.id, data: updateData })).unwrap();
            } else {
                const response = await dispatch(createAdminDriver(finalData)).unwrap();
                setCreatedCredentials({
                    email: finalData.email,
                    password: finalData.password
                });
                setIsCredentialsModalOpen(true);
            }

            loadDrivers();
            setIsCreateModalOpen(false);
            setEditingDriver(null);
        } catch (err: any) {
            console.error("Failed to save driver:", err);
            toast.error(typeof err === "string" ? err : err?.message || "Failed to save driver");
        }
    }

    const handleResetPassword = async (driverId: string, password: string) => {
        try {
            await dispatch(resetAdminDriverPassword({ id: driverId, password })).unwrap();
            toast.success("Password reset successfully!");
        } catch (err: any) {
            console.error("Failed to reset password:", err);
            toast.error(err.message || "Failed to reset password");
            throw err;
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            message: "Are you sure you want to delete this driver?",
            destructive: true,
            confirmLabel: "Delete",
        });
        if (!ok) return;
        await dispatch(deleteAdminDriver(id));
    }

    const submitApproval = async () => {
        if (!applicationModal) return;
        try {
            await dispatch(updateAdminDriverStatus({
                id: applicationModal.driver.id,
                payload: { action: DriverStatusAction.APPROVE },
            })).unwrap();
            closeApplicationModal();
            loadDrivers();
        } catch (err: any) {
            alert(err || "Failed to approve driver");
        }
    };

    const submitRejection = async () => {
        if (!applicationModal) return;
        if (!rejectionReason.trim()) {
            alert("Please provide a reason for rejection.");
            return;
        }

        try {
            await dispatch(updateAdminDriverStatus({
                id: applicationModal.driver.id,
                payload: {
                    action: DriverStatusAction.REJECT,
                    reason: rejectionReason,
                },
            })).unwrap();
            closeApplicationModal();
            loadDrivers();
        } catch (err: any) {
            alert(err || "Failed to reject driver");
        }
    };

    const isLoading = status === 'loading';
    const isSaving = actionStatus === 'loading';

    return (
        <div className="flex flex-col gap-6 p-6 mx-auto">
            {/* Page Header */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0c225e]">Drivers</h1>
                </div>
                <button
                    type="button"
                    onClick={handleCreateNew}
                    disabled={!canCreate}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#f47f00] px-5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-[#d97000] hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0"
                >
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Driver
                </button>
            </div>

            {/* Tabs & Search */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {[
                        { id: "ALL", name: "All Drivers" },
                        { id: "SHUTTLE", name: "Shuttle" },
                        { id: "CHAUFFEUR", name: "Chauffeur" },
                        { id: "PENDING_CHAUFFEUR", name: "Pending Chauffeurs" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cx(
                                activeTab === tab.id
                                    ? "border-[#f47f00] text-[#f47f00]"
                                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
                                "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-bold transition-colors"
                            )}
                        >
                            {tab.name}
                        </button>
                    ))}
                </nav>

                <div className="pb-2">
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search drivers..."
                            className="block w-full max-w-xs rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Drivers Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#f8fafc] text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Driver Name</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Information</th>
                                <th className="px-6 py-4">Avg. rating</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading && drivers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading drivers...</td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-red-500">{error}</td>
                                </tr>
                            ) : drivers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="font-medium">No drivers found</span>
                                            <button type="button" onClick={handleCreateNew} disabled={!canCreate} className="text-sm text-[#f47f00] hover:underline disabled:opacity-50 disabled:no-underline">
                                                Create your first driver
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : drivers.map((driver) => (
                                <tr key={driver.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {driver.profile_picture_url ? (
                                                <img 
                                                    src={driver.profile_picture_url} 
                                                    alt={driver.full_name} 
                                                    className={cx(
                                                        "h-10 w-10 rounded-full border border-slate-200 object-cover transition-opacity",
                                                        isPendingChauffeurTab
                                                            ? "cursor-default"
                                                            : "cursor-zoom-in hover:opacity-80",
                                                    )}
                                                    onClick={
                                                        isPendingChauffeurTab
                                                            ? undefined
                                                            : () => handleZoomImage(driver.profile_picture_url!, driver.full_name)
                                                    }
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                                    <svg className="h-6 w-6 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-semibold text-[#0c225e]">{driver.full_name}</div>
                                                <div className="text-xs text-slate-500">{displayDriverEmail(driver.email)}</div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        {driver.drivers_profile?.driver_type === DriverType.SHUTTLE ? (
                                            <Badge color="blue">Shuttle</Badge>
                                        ) : driver.drivers_profile?.driver_type === DriverType.BOTH ? (
                                            <Badge color="orange">Both</Badge>
                                        ) : (
                                            <Badge color="purple">Chauffeur</Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs">
                                            <div>Phone: {driver.phone || "N/A"}</div>
                                            <div>CNIC: {driver.drivers_profile?.cnic_number || "N/A"}</div>
                                            <div>License: {driver.drivers_profile?.license_number || "N/A"}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <DriverAvgRating
                                            avgRating={driver.avg_rating}
                                            reviewCount={driver.review_count}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cx(
                                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset",
                                            driver.status === DriverStatus.ACTIVE ? "bg-green-50 text-green-700 ring-green-600/20" :
                                                driver.status === DriverStatus.PENDING ? "bg-yellow-50 text-yellow-800 ring-yellow-600/20" :
                                                    driver.status === DriverStatus.REJECTED ? "bg-red-50 text-red-700 ring-red-600/20" :
                                                        "bg-gray-50 text-gray-600 ring-gray-500/10"
                                        )}>
                                            {driver.status}
                                        </span>
                                        {driver.status === DriverStatus.REJECTED && driver.drivers_profile?.rejection_reason && (
                                            <div className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={driver.drivers_profile.rejection_reason}>
                                                Reason: {driver.drivers_profile.rejection_reason}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {driver.status === DriverStatus.PENDING && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => openApplicationModal(driver, "approve")}
                                                        disabled={!canUpdate}
                                                        className="rounded-md p-1 text-green-600 hover:bg-green-50 disabled:opacity-40 disabled:pointer-events-none"
                                                        title="Approve"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openApplicationModal(driver, "reject")}
                                                        disabled={!canUpdate}
                                                        className="rounded-md p-1 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none"
                                                        title="Reject"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    </button>
                                                </>
                                            )}

                                            {isPendingChauffeurTab ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openApplicationModal(driver, "view")}
                                                    className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#0c225e]"
                                                    title="View application"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewReviews(driver)}
                                                        className="rounded-md p-2 text-slate-500 hover:bg-yellow-50 hover:text-yellow-600 transition-colors"
                                                        title="View Reviews"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setPasswordResetDriver(driver); setIsPasswordResetModalOpen(true); }}
                                                        disabled={!canUpdate}
                                                        className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                                        title="Reset Password"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(driver)}
                                                        disabled={!canUpdate}
                                                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0c225e] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                                        title="Edit Details"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(driver.id)}
                                                disabled={!canDelete}
                                                className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                                title="Delete Driver"
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

                {/* Pagination */}
                <div className="border-t border-slate-100">
                    <Pagination
                        currentPage={pagination.page}
                        totalPages={pagination.pages}
                        onPageChange={handlePageChange}
                    />
                </div>
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title={!editingDriver ? "Create New Driver" : "Edit Driver"}
            >
                <DriverForm
                    driver={editingDriver}
                    onSave={handleSave}
                    onCancel={() => setIsCreateModalOpen(false)}
                    onZoomImage={handleZoomImage}
                    isSaving={isSaving}
                />
            </Modal>

            {/* Zoom Image Modal — elevated so it stacks above the application modal */}
            <Modal
                isOpen={isZoomModalOpen}
                onClose={() => setIsZoomModalOpen(false)}
                title={zoomedImage?.name || "Profile Picture"}
                priority="elevated"
                size="lg"
            >
                <div className="flex flex-col items-center">
                    {zoomedImage && (
                        <div className="relative w-full aspect-square max-w-[400px] overflow-hidden rounded-lg border border-slate-200">
                            <img
                                src={zoomedImage.url}
                                alt={zoomedImage.name}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    )}
                    <div className="mt-6 flex justify-end w-full">
                        <button
                            onClick={() => setIsZoomModalOpen(false)}
                            className="rounded-lg bg-[#f47f00] px-6 py-2 text-sm font-bold text-white hover:bg-[#d97000] shadow-md shadow-orange-500/10"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Pending chauffeur application (view / approve / reject) */}
            <Modal
                isOpen={!!applicationModal}
                onClose={closeApplicationModal}
                title={
                    applicationModal
                        ? applicationModal.mode === "approve"
                            ? `Approve application — ${applicationModal.driver.full_name}`
                            : applicationModal.mode === "reject"
                              ? `Reject application — ${applicationModal.driver.full_name}`
                              : `Application — ${applicationModal.driver.full_name}`
                        : "Application"
                }
            >
                {applicationModal && (
                    <>
                        <ChauffeurApplicationDetail
                            driver={applicationModal.driver}
                            onZoomImage={handleZoomImage}
                        />

                        {applicationModal.mode === "reject" && (
                            <div className="mt-6 space-y-2 border-t border-slate-100 pt-6">
                                <label
                                    htmlFor="rejection-reason"
                                    className="text-xs font-bold uppercase tracking-wide text-slate-400"
                                >
                                    Rejection reason
                                </label>
                                <textarea
                                    id="rejection-reason"
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-[#f47f00] focus:ring-1 focus:ring-[#f47f00] min-h-[100px]"
                                    placeholder="Explain why this application is being rejected..."
                                />
                            </div>
                        )}

                        {applicationModal.mode === "approve" && (
                            <p className="mt-4 text-sm text-slate-600">
                                Review all details above before approving. The driver will be able to sign in once approved.
                            </p>
                        )}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeApplicationModal}
                                className="rounded-lg border border-slate-300 px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            {applicationModal.mode === "view" ? (
                                <button
                                    type="button"
                                    onClick={closeApplicationModal}
                                    className="rounded-lg bg-[#f47f00] px-6 py-2 text-sm font-bold text-white hover:bg-[#d97000]"
                                >
                                    Close
                                </button>
                            ) : applicationModal.mode === "approve" ? (
                                <button
                                    type="button"
                                    onClick={submitApproval}
                                    disabled={!canUpdate || isSaving}
                                    className="rounded-lg bg-green-600 px-6 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {isSaving ? "Approving…" : "Confirm approval"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={submitRejection}
                                    disabled={!canUpdate || isSaving}
                                    className="rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {isSaving ? "Rejecting…" : "Confirm rejection"}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </Modal>

            {/* Password Reset Modal */}
            <DriverPasswordResetModal
                isOpen={isPasswordResetModalOpen}
                onClose={() => { setIsPasswordResetModalOpen(false); setPasswordResetDriver(null); }}
                driver={passwordResetDriver}
                onReset={(password) => handleResetPassword(passwordResetDriver!.id, password)}
            />

            {/* Credentials Modal */}
            {createdCredentials && (
                <CredentialsModal
                    isOpen={isCredentialsModalOpen}
                    onClose={() => setIsCredentialsModalOpen(false)}
                    title="Driver Credentials"
                email={createdCredentials.email}
                password={createdCredentials.password}
            />
        )}

        {/* Review Listing Modal */}
        <Modal
            isOpen={isReviewModalOpen}
            onClose={() => setIsReviewModalOpen(false)}
            title={`Reviews for ${selectedDriverForReviews?.full_name}`}
        >
            {selectedDriverForReviews && (
                <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <DriverAvgRating
                        avgRating={selectedDriverForReviews.avg_rating}
                        reviewCount={selectedDriverForReviews.review_count}
                    />
                </div>
            )}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 px-1">
                {isReviewsLoading ? (
                    <div className="py-12 text-center text-slate-500">Loading reviews...</div>
                ) : reviews.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">No reviews yet for this driver.</div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <div key={review.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1">
                                        {[...Array(5)].map((_, i) => (
                                            <svg
                                                key={i}
                                                className={cx(
                                                    "h-4 w-4",
                                                    i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-300 fill-slate-300"
                                                )}
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                            >
                                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                            </svg>
                                        ))}
                                    </div>
                                    <span className="text-xs text-slate-500">
                                        {new Date(review.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-sm text-[#0c225e] italic mb-3">
                                    "{review.review_text || "No comment provided."}"
                                </p>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200 pt-2">
                                    <div>By: <span className="font-semibold">{review.users?.full_name}</span></div>
                                    <div>Booking: <span className="font-semibold">#{review.chauffeur_booking_id}</span></div>
                                </div>
                            </div>
                        ))}

                        {/* Pagination for Reviews */}
                        {reviewsPagination.pages > 1 && (
                            <div className="flex justify-center gap-2 pt-4">
                                <button
                                    disabled={reviewsPagination.page === 1}
                                    onClick={() => selectedDriverForReviews && handleViewReviews(selectedDriverForReviews, reviewsPagination.page - 1)}
                                    className="px-3 py-1 text-xs font-medium rounded border border-slate-200 disabled:opacity-50"
                                >
                                    Prev
                                </button>
                                <span className="text-xs self-center">Page {reviewsPagination.page} of {reviewsPagination.pages}</span>
                                <button
                                    disabled={reviewsPagination.page === reviewsPagination.pages}
                                    onClick={() => selectedDriverForReviews && handleViewReviews(selectedDriverForReviews, reviewsPagination.page + 1)}
                                    className="px-3 py-1 text-xs font-medium rounded border border-slate-200 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="mt-6 flex justify-end">
                <button
                    onClick={() => setIsReviewModalOpen(false)}
                    className="rounded-lg border border-slate-300 px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                    Close
                </button>
            </div>
        </Modal>

        </div>
    );
}
