"use client";

import { useEffect, useState } from "react";
import { Company } from "../../lib/services/api-client";
import { AdminProtectedPage } from "../components/AdminProtectedPage";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { useAdminAbility } from "../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { useConfirm } from "../../lib/hooks/useConfirm";
import { toast } from "sonner";
import { useAuth } from "../../lib/contexts/auth-context";
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
import Pagination from "../../components/ui/Pagination";

import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { CredentialsModal } from "../components/ui/CredentialsModal";
import { CompanyForm, type CompanyFormData } from "./components/CompanyForm";
import { PasswordResetModal } from "./components/PasswordResetModal";

const IMPERSONATION_ALLOWED_EMAILS = ["hashir.ahmed@cort.com.pk", "aqeel@cort.com.pk"];

// -- Main Page Definition --

export default function CompaniesPage() {
  return (
    <AdminProtectedPage permission="companies" subject={ADMIN_SUBJECTS.companies}>
      <CompaniesPageContent />
    </AdminProtectedPage>
  );
}

function CompaniesPageContent() {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const ability = useAdminAbility();
  const { isSuperAdmin, user } = useAuth();
  const canImpersonate =
    isSuperAdmin && !!user?.email && IMPERSONATION_ALLOWED_EMAILS.includes(user.email.toLowerCase());
  const canCreate = ability.can("create", ADMIN_SUBJECTS.companies);
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.companies);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.companies);
  const companies = useAppSelector(selectAdminCompanies);
  const status = useAppSelector(selectAdminCompaniesStatus);
  const error = useAppSelector(selectAdminCompaniesError);
  const actionStatus = useAppSelector(selectAdminCompaniesActionStatus);
  const pagination = useAppSelector(selectAdminCompaniesPagination);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Credentials Modal State
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string, password?: string } | null>(null);

  // Password Reset Modal State
  const [passwordResetCompany, setPasswordResetCompany] = useState<Company | null>(null);

  useEffect(() => {
    dispatch(fetchAdminCompanies({ limit: 10, page: 1, exclude_trials: true }));
  }, [dispatch]);

  const handlePageChange = (page: number) => {
    dispatch(fetchAdminCompanies({ limit: 10, page, exclude_trials: true }));
  };

  const handleCreateNew = () => {
    setEditingCompany(null);
    setIsModalOpen(true);
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this company? This action cannot be undone.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;

    try {
      await dispatch(deleteAdminCompany(id)).unwrap();
      toast.success("Company deleted successfully");
      dispatch(fetchAdminCompanies({ limit: 10, page: pagination.page, exclude_trials: true }));
    } catch (err: unknown) {
      const message = typeof err === "string" ? err : "Failed to delete company";
      toast.error(message);
    }
  };

  const handleSave = async (data: CompanyFormData) => {
    try {
      if (editingCompany) {
        await dispatch(updateAdminCompany({ id: editingCompany.id, data })).unwrap();
      } else {
        const result = await dispatch(createAdminCompany(data)).unwrap();
        // Type assertion here because result might be loose typed from thunk
        const created = result as unknown as { generatedPassword?: string };
        setCreatedCredentials({
          email: data.auth_email || data.email, // Show the auth email in credentials
          password: created.generatedPassword || data.password
        });
      }
      setIsModalOpen(false);
      setEditingCompany(null);
      // Refresh list to ensure consistency
      dispatch(fetchAdminCompanies({ limit: 10, page: pagination.page, exclude_trials: true }));
    } catch (err: any) {
      console.error("Failed to save company:", err);
      toast.error(err.message || "Failed to save company");
    }
  };

  const handleImpersonate = async (company: Company) => {
    const ok = await confirm({
      message: `You are about to log in as ${company.name || "this company"}'s admin. This action is logged.`,
      confirmLabel: "Continue",
    });
    if (!ok) return;

    // Open the tab synchronously (right after the confirm click) so the
    // browser doesn't treat it as an unsolicited popup once the async
    // ticket request resolves.
    const newTab = window.open("about:blank", "_blank");

    try {
      const result = await dispatch(impersonateCompany(company.id)).unwrap();
      if (newTab) {
        newTab.location.href = result.redirectUrl;
      } else {
        toast.error("Your browser blocked the new tab — allow popups for this site and try again.");
      }
    } catch (err: any) {
      newTab?.close();
      toast.error(err.message || "Failed to generate login link");
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCompany(null);
  };

  const handleResetPassword = async (companyId: number, password: string) => {
    try {
      await dispatch(resetCompanyPassword({ id: companyId, password })).unwrap();
      toast.success("Password reset successfully!");
    } catch (err: any) {
      console.error("Failed to reset password:", err);
      toast.error(err.message || "Failed to reset password");
      throw err;
    }
  };

  const isLoading = status === 'loading';
  const isSaving = actionStatus === 'loading';

  return (
    <div className="flex flex-col gap-6 p-6 mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0c225e]">Companies</h1>
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
          Create Company
        </button>
      </div>


      {/* Companies Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-[#f8fafc] text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Company Name</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Services</th>
                <th className="px-6 py-4">Employees</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading companies...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-red-500">{error}</td>
                </tr>
              ) : companies.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#0c225e]">{company.name || "Untitled"}</div>
                    <div className="text-xs text-slate-500">{company.address || "No address provided"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-900">{company.contact_person || "—"}</div>
                    <div className="text-xs text-slate-500">{company.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {company.is_shuttle_enabled && <Badge color="blue">Shuttle</Badge>}
                      {company.is_chauffeur_enabled && <Badge color="purple">Chauffeur</Badge>}
                      {company.is_travel_enabled && <Badge color="green">Travel</Badge>}
                      {!company.is_shuttle_enabled && !company.is_chauffeur_enabled && !company.is_travel_enabled && (
                        <Badge color="red">None</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-slate-600">{company._count?.users ?? 0}</span>
                    <span className="text-xs text-slate-400 ml-1">users</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/admin/companies/${company.id}`}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0c225e] transition-colors"
                        title="Manage Employees & Settings"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleEdit(company)}
                        disabled={!canUpdate}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0c225e] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        title="Edit Details"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPasswordResetCompany(company)}
                        disabled={!canUpdate}
                        className="rounded-md p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        title="Reset Password"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImpersonate(company)}
                        disabled={!canImpersonate}
                        className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        title="Login as Company"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(company.id)}
                        disabled={!canDelete}
                        className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        title="Delete Company"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && companies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="font-medium">No companies found</span>
                      <button type="button" onClick={handleCreateNew} disabled={!canCreate} className="text-sm text-[#f47f00] hover:underline disabled:opacity-50 disabled:no-underline">
                        Create your first company
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-slate-100">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={!editingCompany ? "Create New Company" : "Edit Company"}
      >
        <CompanyForm
          company={editingCompany}
          onSave={handleSave}
          onCancel={handleCloseModal}
          isSaving={isSaving}
        />
      </Modal>

      {/* Credentials Display Modal */}
      {createdCredentials && (
        <CredentialsModal
          isOpen={!!createdCredentials}
          onClose={() => setCreatedCredentials(null)}
          title="Company Credentials"
          successMessage="Company created successfully! Please share these credentials with the company administrator."
          email={createdCredentials.email}
          password={createdCredentials.password}
        />
      )}

      {/* Password Reset Modal */}
      <PasswordResetModal
        isOpen={!!passwordResetCompany}
        onClose={() => setPasswordResetCompany(null)}
        company={passwordResetCompany}
        onReset={(password) => handleResetPassword(passwordResetCompany!.id, password)}
      />
    </div>
  );
}
