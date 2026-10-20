"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Eye, KeyRound, Pencil, Plus, Star, Trash2, User, Users, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Driver,
  CreateDriverRequest,
  DriverType,
  DriverStatus,
  DriverStatusAction,
  QueryDriverParams,
  RideReview,
  apiClient,
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
  selectAdminDriversPagination,
} from "../../lib/store/slices/adminDriversSlice";
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
import { formatDate, generatePassword, initials } from "../lib/format";
import { focusRing } from "../ui/styles";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  PageHeader,
  Pagination,
  Skeleton,
  StatusBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  type DataTableColumn,
} from "../ui";

type ApplicationModalMode = "view" | "approve" | "reject";
type DriverTab = "ALL" | "SHUTTLE" | "CHAUFFEUR" | "PENDING_CHAUFFEUR";

const PAGE_SIZE = 10;
const REVIEWS_PAGE_SIZE = 5;

const TABS: { id: DriverTab; label: string }[] = [
  { id: "ALL", label: "All drivers" },
  { id: "SHUTTLE", label: "Shuttle" },
  { id: "CHAUFFEUR", label: "Chauffeur" },
  { id: "PENDING_CHAUFFEUR", label: "Pending applications" },
];

export default function DriversPage() {
  return (
    <AdminProtectedPage permission="drivers" subject={ADMIN_SUBJECTS.drivers}>
      <Suspense fallback={null}>
        <DriversPageContent />
      </Suspense>
    </AdminProtectedPage>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

function driverTypeBadge(type: DriverType | undefined) {
  if (type === DriverType.SHUTTLE) return <Badge tone="info">Shuttle</Badge>;
  if (type === DriverType.BOTH) return <Badge tone="brand">Both</Badge>;
  return <Badge tone="purple">Chauffeur</Badge>;
}

function DriversPageContent() {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const ability = useAdminAbility();
  const searchParams = useSearchParams();
  const canCreate = ability.can("create", ADMIN_SUBJECTS.drivers);
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.drivers);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.drivers);
  const drivers = useAppSelector(selectAdminDrivers);
  const status = useAppSelector(selectAdminDriversStatus);
  const error = useAppSelector(selectAdminDriversError);
  const actionStatus = useAppSelector(selectAdminDriversActionStatus);
  const pagination = useAppSelector(selectAdminDriversPagination);

  const [activeTab, setActiveTab] = useState<DriverTab>("ALL");
  // `?q=` comes from the command palette.
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "");
  const debouncedSearch = useDebounce(searchQuery, 500);
  const isPendingTab = activeTab === "PENDING_CHAUFFEUR";

  // Create / edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password?: string } | null>(null);

  // Password reset
  const [passwordResetDriver, setPasswordResetDriver] = useState<Driver | null>(null);

  // Photo zoom (elevated so it stacks above the application dialog)
  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);

  // Application review
  const [applicationModal, setApplicationModal] = useState<{ driver: Driver; mode: ApplicationModalMode } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  // Reviews
  const [reviewsDriver, setReviewsDriver] = useState<Driver | null>(null);
  const [reviews, setReviews] = useState<RideReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewsPagination, setReviewsPagination] = useState({ page: 1, pages: 1, total: 0 });

  const loadDrivers = (page = 1) => {
    const params: QueryDriverParams & { activeTab?: string } = { limit: PAGE_SIZE, page, search: debouncedSearch, activeTab };
    if (activeTab === "PENDING_CHAUFFEUR") {
      dispatch(fetchPendingChauffeurs(params));
      return;
    }
    if (activeTab === "SHUTTLE") params.driver_type = DriverType.SHUTTLE;
    if (activeTab === "CHAUFFEUR") params.driver_type = DriverType.CHAUFFEUR;
    dispatch(fetchAdminDrivers(params));
  };

  const lastQuery = useRef<string | null>(null);
  const queryKey = `${activeTab}|${debouncedSearch}`;
  useEffect(() => {
    if (lastQuery.current === queryKey) return;
    lastQuery.current = queryKey;
    loadDrivers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const changeTab = (tab: DriverTab) => {
    setActiveTab(tab);
    if (tab !== "PENDING_CHAUFFEUR") {
      setApplicationModal(null);
      setRejectionReason("");
    }
  };

  const openApplicationModal = (driver: Driver, mode: ApplicationModalMode) => {
    setRejectionReason("");
    setRejectionError(null);
    setApplicationModal({ driver, mode });
  };

  const closeApplicationModal = () => {
    setApplicationModal(null);
    setRejectionReason("");
    setRejectionError(null);
  };

  const openZoom = (url: string, name: string) => setZoomedImage({ url, name });

  const handleCreateNew = () => {
    setEditingDriver(null);
    setIsFormOpen(true);
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setIsFormOpen(true);
  };

  const loadReviews = async (driver: Driver, page = 1) => {
    setReviewsDriver(driver);
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const response = await apiClient.getDriverReviews(driver.id, page, REVIEWS_PAGE_SIZE);
      setReviews(response.data.data);
      setReviewsPagination({
        page: response.data.pagination.page,
        pages: response.data.pagination.pages,
        total: response.data.pagination.total,
      });
    } catch (err) {
      setReviewsError(errorMessage(err, "Failed to load reviews"));
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleSave = async (data: CreateDriverRequest) => {
    try {
      const finalData = { ...data };
      if (!editingDriver && !finalData.password) finalData.password = generatePassword(12);
      if (!editingDriver && finalData.password && finalData.password.length < 6) {
        toast.error("Password must be at least 6 characters long");
        return;
      }
      if (editingDriver) {
        const { email: _email, password: _password, ...updateData } = finalData;
        void [_email, _password];
        await dispatch(updateAdminDriver({ id: editingDriver.id, data: updateData })).unwrap();
        toast.success("Driver updated");
      } else {
        await dispatch(createAdminDriver(finalData)).unwrap();
        setCreatedCredentials({ email: finalData.email, password: finalData.password });
      }
      loadDrivers(pagination.page);
      setIsFormOpen(false);
      setEditingDriver(null);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save driver"));
    }
  };

  const handleResetPassword = async (driverId: string, password: string) => {
    try {
      await dispatch(resetAdminDriverPassword({ id: driverId, password })).unwrap();
      toast.success("Password reset successfully");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to reset password"));
      throw err;
    }
  };

  const handleDelete = async (driver: Driver) => {
    const ok = await confirm({
      title: `Delete ${driver.full_name}?`,
      message: displayDriverEmail(driver.email),
      consequences: [
        "The driver can no longer sign in to the driver app",
        "They are removed from future shuttle and chauffeur assignments",
        "This cannot be undone from the portal",
      ],
      destructive: true,
      confirmLabel: "Delete driver",
    });
    if (!ok) return;
    try {
      await dispatch(deleteAdminDriver(driver.id)).unwrap();
      toast.success(`${driver.full_name} deleted`);
      loadDrivers(pagination.page);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete driver"));
    }
  };

  const submitApproval = async () => {
    if (!applicationModal) return;
    try {
      await dispatch(updateAdminDriverStatus({ id: applicationModal.driver.id, payload: { action: DriverStatusAction.APPROVE } })).unwrap();
      toast.success(`${applicationModal.driver.full_name} approved`);
      closeApplicationModal();
      loadDrivers(pagination.page);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to approve driver"));
    }
  };

  const submitRejection = async () => {
    if (!applicationModal) return;
    if (!rejectionReason.trim()) {
      setRejectionError("A rejection reason is required. The applicant will see it.");
      return;
    }
    try {
      await dispatch(
        updateAdminDriverStatus({ id: applicationModal.driver.id, payload: { action: DriverStatusAction.REJECT, reason: rejectionReason } }),
      ).unwrap();
      toast.success(`${applicationModal.driver.full_name} rejected`);
      closeApplicationModal();
      loadDrivers(pagination.page);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to reject driver"));
    }
  };

  const isLoading = status === "loading";
  const isSaving = actionStatus === "loading";

  const columns = useMemo<DataTableColumn<Driver>[]>(
    () => [
      {
        key: "driver",
        header: "Driver",
        cell: (d) => (
          <div className="flex items-center gap-3">
            {d.profile_picture_url ? (
              <button
                type="button"
                onClick={() => openZoom(d.profile_picture_url!, d.full_name)}
                aria-label={`View photo of ${d.full_name}`}
                className={cn("size-9 shrink-0 cursor-zoom-in overflow-hidden rounded-full border border-line", focusRing)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.profile_picture_url} alt="" className="size-full object-cover" />
              </button>
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-fg-muted" aria-hidden="true">
                {initials(d.full_name)}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate font-medium text-fg">{d.full_name}</div>
              <div className="truncate text-xs text-fg-muted">{displayDriverEmail(d.email)}</div>
            </div>
          </div>
        ),
      },
      { key: "type", header: "Type", hideBelow: "sm", cell: (d) => driverTypeBadge(d.drivers_profile?.driver_type) },
      {
        key: "contact",
        header: "Contact & IDs",
        hideBelow: "md",
        cell: (d) => (
          <dl className="grid grid-cols-[3.5rem_1fr] gap-x-2 text-xs">
            <dt className="text-fg-muted">Phone</dt>
            <dd className="font-mono text-fg">{d.phone || "—"}</dd>
            <dt className="text-fg-muted">CNIC</dt>
            <dd className="font-mono text-fg">{d.drivers_profile?.cnic_number || "—"}</dd>
            <dt className="text-fg-muted">License</dt>
            <dd className="font-mono text-fg">{d.drivers_profile?.license_number || "—"}</dd>
          </dl>
        ),
      },
      { key: "rating", header: "Rating", hideBelow: "lg", cell: (d) => <DriverAvgRating avgRating={d.avg_rating} reviewCount={d.review_count} /> },
      {
        key: "status",
        header: "Status",
        cell: (d) => (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={d.status} />
            {d.status === DriverStatus.REJECTED && d.drivers_profile?.rejection_reason && (
              <Tooltip content={d.drivers_profile.rejection_reason}>
                <span className="max-w-[12rem] truncate text-xs text-danger-ink">Reason: {d.drivers_profile.rejection_reason}</span>
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        description="Shuttle and chauffeur drivers, plus pending chauffeur applications."
        actions={
          <Button leftIcon={<Plus />} onClick={handleCreateNew} disabled={!canCreate}>
            Create driver
          </Button>
        }
        tabs={
          <Tabs value={activeTab} onValueChange={(v) => changeTab(v as DriverTab)}>
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar
            search={{ value: searchQuery, onChange: setSearchQuery, placeholder: "Search by name, email or phone…" }}
            activeCount={searchQuery ? 1 : 0}
            onClear={() => setSearchQuery("")}
          />
        </CardContent>

        <DataTable<Driver>
          caption={isPendingTab ? "Pending chauffeur applications" : "Drivers"}
          columns={columns}
          rows={drivers}
          rowKey={(d) => d.id}
          loading={isLoading}
          error={error}
          onRetry={() => loadDrivers(pagination.page)}
          empty={{
            icon: <Users aria-hidden="true" />,
            title: isPendingTab ? "No pending applications" : searchQuery ? "No drivers match your search" : "No drivers yet",
            description: isPendingTab ? "New chauffeur applications will appear here." : searchQuery ? "Try a different name, email or phone." : "Create the first driver to start assigning rides.",
            action:
              !isPendingTab && !searchQuery ? (
                <Button size="sm" leftIcon={<Plus />} onClick={handleCreateNew} disabled={!canCreate}>
                  Create driver
                </Button>
              ) : undefined,
          }}
          rowActions={(d) =>
            isPendingTab
              ? [
                  { label: "View application", icon: <Eye />, onSelect: () => openApplicationModal(d, "view") },
                  { label: "Approve", icon: <Check />, onSelect: () => openApplicationModal(d, "approve"), hidden: d.status !== DriverStatus.PENDING, disabled: !canUpdate },
                  { label: "Reject", icon: <X />, onSelect: () => openApplicationModal(d, "reject"), hidden: d.status !== DriverStatus.PENDING, disabled: !canUpdate, destructive: true },
                  { label: "Delete", icon: <Trash2 />, destructive: true, separatorBefore: true, onSelect: () => void handleDelete(d), disabled: !canDelete },
                ]
              : [
                  { label: "Approve", icon: <Check />, onSelect: () => openApplicationModal(d, "approve"), hidden: d.status !== DriverStatus.PENDING, disabled: !canUpdate },
                  { label: "Reject", icon: <X />, onSelect: () => openApplicationModal(d, "reject"), hidden: d.status !== DriverStatus.PENDING, disabled: !canUpdate },
                  { label: "Reviews", icon: <Star />, onSelect: () => void loadReviews(d) },
                  { label: "Reset password", icon: <KeyRound />, onSelect: () => setPasswordResetDriver(d), disabled: !canUpdate },
                  { label: "Edit", icon: <Pencil />, onSelect: () => handleEdit(d), disabled: !canUpdate },
                  { label: "Delete", icon: <Trash2 />, destructive: true, separatorBefore: true, onSelect: () => void handleDelete(d), disabled: !canDelete },
                ]
          }
          pagination={{
            page: pagination.page,
            totalPages: pagination.pages,
            total: pagination.total,
            pageSize: pagination.limit || PAGE_SIZE,
            onPageChange: (page) => loadDrivers(page),
          }}
        />
      </Card>

      {/* Create / edit */}
      <Dialog open={isFormOpen} onOpenChange={(open) => !open && !isSaving && setIsFormOpen(false)}>
        <DialogContent size="lg" title={editingDriver ? "Edit driver" : "Create driver"} description={editingDriver ? displayDriverEmail(editingDriver.email) : "Fields marked * are required."}>
          <DriverForm key={editingDriver?.id ?? "new"} driver={editingDriver} onSave={handleSave} onCancel={() => setIsFormOpen(false)} onZoomImage={openZoom} isSaving={isSaving} />
        </DialogContent>
      </Dialog>

      {/* Photo zoom — elevated so it stacks above the application dialog */}
      <Dialog open={!!zoomedImage} onOpenChange={(open) => !open && setZoomedImage(null)}>
        <DialogContent size="lg" priority="elevated" title={zoomedImage?.name || "Photo"}>
          {zoomedImage && (
            <div className="mx-auto aspect-square w-full max-w-[28rem] overflow-hidden rounded-lg border border-line bg-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zoomedImage.url} alt={zoomedImage.name} className="size-full object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Application: view / approve / reject */}
      <Dialog open={!!applicationModal} onOpenChange={(open) => !open && !isSaving && closeApplicationModal()}>
        <DialogContent
          size="lg"
          title={
            applicationModal
              ? applicationModal.mode === "approve"
                ? `Approve ${applicationModal.driver.full_name}?`
                : applicationModal.mode === "reject"
                  ? `Reject ${applicationModal.driver.full_name}?`
                  : `Application — ${applicationModal.driver.full_name}`
              : "Application"
          }
          description={applicationModal?.mode === "approve" ? "Review every detail below first. Once approved, the driver can sign in and take rides." : undefined}
          footer={
            applicationModal && (
              <>
                <Button variant="outline" onClick={closeApplicationModal} disabled={isSaving}>
                  {applicationModal.mode === "view" ? "Close" : "Cancel"}
                </Button>
                {applicationModal.mode === "approve" && (
                  <Button onClick={() => void submitApproval()} loading={isSaving} disabled={!canUpdate} leftIcon={<Check />}>
                    Confirm approval
                  </Button>
                )}
                {applicationModal.mode === "reject" && (
                  <Button variant="danger" onClick={() => void submitRejection()} loading={isSaving} disabled={!canUpdate} leftIcon={<X />}>
                    Confirm rejection
                  </Button>
                )}
              </>
            )
          }
        >
          {applicationModal && (
            <div className="space-y-6">
              <ChauffeurApplicationDetail driver={applicationModal.driver} onZoomImage={openZoom} />
              {applicationModal.mode === "reject" && (
                <div className="border-t border-line pt-5">
                  <Field label="Rejection reason" required error={rejectionError} hint="Shown to the applicant.">
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => {
                        setRejectionReason(e.target.value);
                        setRejectionError(null);
                      }}
                      placeholder="Explain why this application is being rejected…"
                      disabled={isSaving}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DriverPasswordResetModal
        isOpen={!!passwordResetDriver}
        onClose={() => setPasswordResetDriver(null)}
        driver={passwordResetDriver}
        onReset={(password) => handleResetPassword(passwordResetDriver!.id, password)}
      />

      {createdCredentials && (
        <CredentialsModal
          isOpen={!!createdCredentials}
          onClose={() => setCreatedCredentials(null)}
          title="Driver credentials"
          successMessage="Driver created. Share these credentials with the driver securely."
          email={createdCredentials.email}
          password={createdCredentials.password}
        />
      )}

      {/* Reviews */}
      <Dialog open={!!reviewsDriver} onOpenChange={(open) => !open && setReviewsDriver(null)}>
        <DialogContent
          size="md"
          title={reviewsDriver ? `Reviews — ${reviewsDriver.full_name}` : "Reviews"}
          description={reviewsDriver ? <DriverAvgRating avgRating={reviewsDriver.avg_rating} reviewCount={reviewsDriver.review_count} className="mt-1" /> : undefined}
          footer={
            <Button variant="outline" onClick={() => setReviewsDriver(null)}>
              Close
            </Button>
          }
        >
          {reviewsLoading ? (
            <div className="space-y-3" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-line p-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : reviewsError ? (
            <ErrorState compact message={reviewsError} onRetry={() => reviewsDriver && void loadReviews(reviewsDriver, reviewsPagination.page)} />
          ) : reviews.length === 0 ? (
            <EmptyState compact icon={<Star aria-hidden="true" />} title="No reviews yet" description="Passengers haven't rated this driver." />
          ) : (
            <div className="space-y-3">
              <ul className="space-y-3">
                {reviews.map((review) => (
                  <li key={review.id} className="rounded-lg border border-line bg-subtle/40 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("size-4", i < review.rating ? "text-warning" : "text-line-strong")} fill="currentColor" aria-hidden="true" />
                        ))}
                      </div>
                      <span className="text-xs text-fg-muted">{formatDate(review.created_at)}</span>
                    </div>
                    <p className="text-sm text-fg">{review.review_text ? `“${review.review_text}”` : <span className="italic text-fg-muted">No comment provided.</span>}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-[11px] text-fg-muted">
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3" aria-hidden="true" />
                        {review.users?.full_name ?? "Passenger"}
                      </span>
                      <span className="font-mono">Booking #{review.chauffeur_booking_id}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination
                page={reviewsPagination.page}
                totalPages={reviewsPagination.pages}
                total={reviewsPagination.total}
                pageSize={REVIEWS_PAGE_SIZE}
                onPageChange={(p) => reviewsDriver && void loadReviews(reviewsDriver, p)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
