"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminProtectedPage } from "../../components/AdminProtectedPage";
import { ADMIN_SUBJECTS } from "../../../lib/abilities/admin-subjects";
import { Modal } from "../../components/ui/Modal";
import { cx } from "../../components/ui/cx";
import { useCompanyDetail } from "./hooks/useCompanyDetail";
import { CompanyEmployeesTab } from "./components/CompanyEmployeesTab";
import { CompanyServicesTab } from "./components/CompanyServicesTab";
import { PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, sanitizePhoneInput } from "../../../lib/utils/phone";

export default function CompanyDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminProtectedPage permission="companies" subject={ADMIN_SUBJECTS.companies}>
      <CompanyDetailsContent params={params} />
    </AdminProtectedPage>
  );
}

function CompanyDetailsContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const d = useCompanyDetail(id);

  if (d.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0c225e] border-t-transparent" />
      </div>
    );
  }

  if (d.error || !d.company) {
    return (
      <div className="p-6 text-center text-red-600">
        {d.error || "Company not found"}
      </div>
    );
  }

  const { company } = d;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      <div>
        <button
          onClick={() => router.push("/admin/companies")}
          className="mb-4 flex items-center text-sm text-slate-500 hover:text-[#0c225e] transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Companies
        </button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0c225e]">{company.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {company._count?.users || 0} Employees • {company.address || "No address"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {d.canViewPricing && (
              <Link
                href={`/admin/pricing?companyId=${id}`}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[#0c225e] bg-white px-4 text-sm font-semibold text-[#0c225e] shadow-sm hover:bg-slate-50 transition-colors"
              >
                Contracts &amp; pricing
              </Link>
            )}
            <Link
              href={`/admin/companies/${id}/fleet`}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-green-600 bg-white px-4 text-sm font-semibold text-green-700 shadow-sm hover:bg-green-50 transition-colors"
            >
              Fleet Efficiency
            </Link>
            <button
              type="button"
              onClick={d.handleExportCredentials}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              Export List
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {(["employees", "services"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => d.setActiveTab(tab)}
              className={cx(
                "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium",
                d.activeTab === tab
                  ? "border-[#f47f00] text-[#f47f00]"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              )}
            >
              {tab === "employees" && "Employees"}
              {tab === "services" && "Services & Configuration"}
            </button>
          ))}
        </nav>
      </div>

      {d.activeTab === "employees" && <CompanyEmployeesTab detail={d} />}
      {d.activeTab === "services" && <CompanyServicesTab detail={d} />}

      <Modal isOpen={d.isEmpModalOpen} onClose={() => d.setIsEmpModalOpen(false)} title="Add New Employee">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Full Name</label>
            <input
              type="text"
              value={d.newEmpName}
              onChange={(e) => d.setNewEmpName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Employee ID</label>
            <input
              type="text"
              value={d.newEmpId}
              onChange={(e) => d.setNewEmpId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Department</label>
            <input
              type="text"
              value={d.newEmpDepartment}
              onChange={(e) => d.setNewEmpDepartment(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Home Address</label>
            <input
              type="text"
              value={d.newEmpHomeAddress}
              onChange={(e) => d.setNewEmpHomeAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. DHA Phase 6, Lahore"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Email</label>
            <input
              type="email"
              value={d.newEmpEmail}
              onChange={(e) => d.setNewEmpEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Phone</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={PHONE_MAX_LENGTH}
              value={d.newEmpPhone}
              onChange={(e) => d.setNewEmpPhone(sanitizePhoneInput(e.target.value))}
              placeholder={PHONE_PLACEHOLDER}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Password (Optional)</label>
            <input
              type="text"
              value={d.newEmpPassword}
              onChange={(e) => d.setNewEmpPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => d.setIsEmpModalOpen(false)} className="px-4 py-2 text-sm text-slate-600">
              Cancel
            </button>
            <button
              type="button"
              onClick={d.handleCreateEmployee}
              disabled={d.isCreatingEmp || !d.canCreate}
              className="px-4 py-2 text-sm font-bold text-white bg-[#f47f00] rounded-lg disabled:opacity-50"
            >
              {d.isCreatingEmp ? "Adding..." : "Add Employee"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
