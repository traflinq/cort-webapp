"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, KeyRound, LogIn, Pencil, Plus, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Company } from "../../lib/services/api-client";
import { AdminProtectedPage } from "../components/AdminProtectedPage";
import { useAdminAbility } from "../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { useConfirm } from "../../lib/hooks/useConfirm";
import { useAuth } from "../../lib/contexts/auth-context";
import { useDebounce } from "../../lib/hooks/useDebounce";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import {
  fetchAdminCompanies,
  createAdminCompany,
  updateAdminCompany,
  deleteAdminCompany,
  resetCompanyPassword,
  impersonateCompany,
  selectAdminCompanies,
  selectAdminCompaniesStatus,
  selectAdminCompaniesError,
  selectAdminCompaniesActionStatus,
  selectAdminCompaniesPagination,
} from "../../lib/store/slices/adminCompaniesSlice";
import { Badge, Button, Card, CardContent, DataTable, Dialog, DialogContent, FilterBar, PageHeader, type DataTableColumn } from "../ui";
import { CredentialsModal } from "../components/ui/CredentialsModal";
import { CompanyForm, type CompanyFormData } from "./components/CompanyForm";
import { PasswordResetModal } from "./components/PasswordResetModal";

/** FLAGGED (kept as-is per decision 2026-10-20): hard-coded impersonation allowlist. */
const IMPERSONATION_ALLOWED_EMAILS = ["hashir.ahmed@cort.com.pk", "aqeel@cort.com.pk"];
const PAGE_SIZE = 10;

export default function CompaniesPage() {
  return (
    <AdminProtectedPage permission="companies" subject={ADMIN_SUBJECTS.companies}>
      <CompaniesPageContent />
    </AdminProtectedPage>
  );
}

function CompaniesPageContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const confirm = useConfirm();
  const ability = useAdminAbility();
  const { isSuperAdmin, user } = useAuth();
  const canImpersonate = isSuperAdmin && !!user?.email && IMPERSONATION_ALLOWED_EMAILS.includes(user.email.toLowerCase());
  const canCreate = ability.can("create", ADMIN_SUBJECTS.companies);
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.companies);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.companies);

  const companies = useAppSelector(selectAdminCompanies);
  const status = useAppSelector(selectAdminCompaniesStatus);
  const error = useAppSelector(selectAdminCompaniesError);
  const actionStatus = useAppSelector(selectAdminCompaniesActionStatus);
  const pagination = useAppSelector(selectAdminCompaniesPagination);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 400);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password?: string } | null>(null);
  const [passwordResetCompany, setPasswordResetCompany] = useState<Company | null>(null);

  const load = useCallback(
    (page: number) =>
      dispatch(fetchAdminCompanies({ limit: PAGE_SIZE, page, exclude_trials: true, search: debouncedSearch || undefined })),
    [dispatch, debouncedSearch],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const handleCreateNew = () => {
    setEditingCompany(null);
    setIsModalOpen(true);
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleDelete = async (company: Company) => {
    const users = company._count?.users ?? 0;
    const ok = await confirm({
      title: `Delete ${company.name || "this company"}?`,
      message: "This permanently deletes the company and cannot be undone.",
      consequences: [
        `The company admin and its ${users} employee account${users === 1 ? "" : "s"} can no longer sign in`,
        "Turn off its services instead if you only want to pause the account",
      ],
      destructive: true,
      confirmLabel: "Delete company",
      typeToConfirm: company.name || undefined,
    });
    if (!ok) return;
    try {
      await dispatch(deleteAdminCompany(company.id)).unwrap();
      toast.success("Company deleted");
      load(pagination.page);
    } catch (err: unknown) {
      toast.error(typeof err === "string" ? err : "Failed to delete company");
    }
  };

  const handleSave = async (data: CompanyFormData) => {
    try {
      if (editingCompany) {
        await dispatch(updateAdminCompany({ id: editingCompany.id, data })).unwrap();
        toast.success("Company updated");
      } else {
        const result = await dispatch(createAdminCompany(data)).unwrap();
        const created = result as unknown as { generatedPassword?: string };
        setCreatedCredentials({
          email: data.auth_email || data.email,
          password: created.generatedPassword || data.password,
        });
      }
      setIsModalOpen(false);
      setEditingCompany(null);
      load(pagination.page);
    } catch (err: unknown) {
      console.error("Failed to save company:", err);
      toast.error(err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to save company");
    }
  };

  const handleImpersonate = async (company: Company) => {
    const ok = await confirm({
      title: `Log in as ${company.name || "this company"}?`,
      message: "You will open the company portal as its admin in a new tab.",
      consequences: ["This action is logged"],
      confirmLabel: "Continue",
    });
    if (!ok) return;
    // Open the tab synchronously (right after the confirm click) so the
    // browser doesn't treat it as an unsolicited popup once the async
    // ticket request resolves.
    const newTab = window.open("about:blank", "_blank");
    try {
      const result = await dispatch(impersonateCompany(company.id)).unwrap();
      if (newTab) newTab.location.href = result.redirectUrl;
      else toast.error("Your browser blocked the new tab — allow popups for this site and try again.");
    } catch (err: unknown) {
      newTab?.close();
      toast.error(err instanceof Error ? err.message : "Failed to generate login link");
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCompany(null);
  };

  const handleResetPassword = async (companyId: number, password: string) => {
    try {
      await dispatch(resetCompanyPassword({ id: companyId, password })).unwrap();
      toast.success("Password reset successfully");
    } catch (err: unknown) {
      console.error("Failed to reset password:", err);
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
      throw err;
    }
  };

  const isLoading = status === "loading";
  const isSaving = actionStatus === "loading";

  const columns: DataTableColumn<Company>[] = [
    {
      key: "name",
      header: "Company",
      cell: (c) => (
        <div className="min-w-0">
          <div className="font-medium text-fg">{c.name || "Untitled"}</div>
          <div className="truncate text-xs text-fg-muted">{c.address || "No address"}</div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      hideBelow: "md",
      cell: (c) => (
        <div className="min-w-0">
          <div className="text-fg">{c.contact_person || "—"}</div>
          <div className="truncate text-xs text-fg-muted">{c.email}</div>
        </div>
      ),
    },
    {
      key: "services",
      header: "Services",
      cell: (c) =>
        c.is_shuttle_enabled || c.is_chauffeur_enabled ? (
          <div className="flex flex-wrap gap-1">
            {c.is_shuttle_enabled && (
              <Badge tone="info" size="sm">
                Shuttle
              </Badge>
            )}
            {c.is_chauffeur_enabled && (
              <Badge tone="purple" size="sm">
                Chauffeur
              </Badge>
            )}
          </div>
        ) : (
          <Badge tone="neutral" size="sm">
            None
          </Badge>
        ),
    },
    {
      key: "users",
      header: "Employees",
      align: "right",
      mono: true,
      hideBelow: "sm",
      cell: (c) => c._count?.users ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Client accounts, their services and employees."
        actions={
          <Button onClick={handleCreateNew} disabled={!canCreate} leftIcon={<Plus />}>
            Create company
          </Button>
        }
      />

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar
            search={{ value: search, onChange: setSearch, placeholder: "Search companies…" }}
            activeCount={debouncedSearch ? 1 : 0}
            onClear={() => setSearch("")}
          />
        </CardContent>
        <DataTable<Company>
          caption="Companies"
          columns={columns}
          rows={companies}
          rowKey={(c) => c.id}
          loading={isLoading}
          error={error}
          onRetry={() => load(pagination.page)}
          empty={{
            icon: <Building2 aria-hidden="true" />,
            title: debouncedSearch ? "No companies match your search" : "No companies yet",
            description: debouncedSearch ? "Try a different name or clear the search." : "Create the first client account to get started.",
            action: debouncedSearch ? (
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : (
              <Button size="sm" onClick={handleCreateNew} disabled={!canCreate} leftIcon={<Plus />}>
                Create company
              </Button>
            ),
          }}
          onRowClick={(c) => router.push(`/admin/companies/${c.id}`)}
          rowActions={(c) => [
            { label: "View details", icon: <Eye />, href: `/admin/companies/${c.id}` },
            { label: "Edit", icon: <Pencil />, disabled: !canUpdate, onSelect: () => handleEdit(c) },
            { label: "Reset password", icon: <KeyRound />, disabled: !canUpdate, onSelect: () => setPasswordResetCompany(c) },
            { label: "Log in as company", icon: <LogIn />, hidden: !canImpersonate, onSelect: () => handleImpersonate(c) },
            { label: "Delete", icon: <Trash2 />, destructive: true, separatorBefore: true, disabled: !canDelete, onSelect: () => handleDelete(c) },
          ]}
          pagination={{
            page: pagination.page,
            totalPages: pagination.totalPages,
            total: pagination.total,
            pageSize: pagination.limit || PAGE_SIZE,
            onPageChange: (page) => load(page),
          }}
        />
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && !isSaving && handleCloseModal()}>
        <DialogContent size="lg" title={editingCompany ? "Edit company" : "Create company"}>
          {isModalOpen && <CompanyForm key={editingCompany?.id ?? "new"} company={editingCompany} onSave={handleSave} onCancel={handleCloseModal} isSaving={isSaving} />}
        </DialogContent>
      </Dialog>

      {createdCredentials && (
        <CredentialsModal
          isOpen={!!createdCredentials}
          onClose={() => setCreatedCredentials(null)}
          title="Company credentials"
          successMessage="Company created. Share these credentials with the company administrator."
          email={createdCredentials.email}
          password={createdCredentials.password}
        />
      )}

      <PasswordResetModal
        isOpen={!!passwordResetCompany}
        onClose={() => setPasswordResetCompany(null)}
        company={passwordResetCompany}
        onReset={(password) => handleResetPassword(passwordResetCompany!.id, password)}
      />
    </div>
  );
}
