"use client";

import { use } from "react";
import Link from "next/link";
import { Download, FileText, Gauge, UserPlus } from "lucide-react";
import { AdminProtectedPage } from "../../components/AdminProtectedPage";
import { ADMIN_SUBJECTS } from "../../../lib/abilities/admin-subjects";
import { useCompanyDetail } from "./hooks/useCompanyDetail";
import { CompanyEmployeesTab } from "./components/CompanyEmployeesTab";
import { CompanyServicesTab } from "./components/CompanyServicesTab";
import { PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, sanitizePhoneInput } from "../../../lib/utils/phone";
import { usePageBreadcrumbs } from "../../ui/shell/breadcrumbs-context";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  ErrorState,
  Field,
  FormGrid,
  Input,
  PageHeader,
  PageSkeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../ui";

export default function CompanyDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminProtectedPage permission="companies" subject={ADMIN_SUBJECTS.companies}>
      <CompanyDetailsContent params={params} />
    </AdminProtectedPage>
  );
}

function CompanyDetailsContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const d = useCompanyDetail(id);
  usePageBreadcrumbs(d.company ? [{ label: d.company.name }] : null);

  if (d.isLoading) return <PageSkeleton />;

  if (d.error || !d.company) {
    return (
      <div className="space-y-6">
        <PageHeader title="Company" back={{ href: "/admin/companies", label: "Back to companies" }} />
        <ErrorState message={d.error || "Company not found"} onRetry={d.refetchCompany} />
      </div>
    );
  }

  const { company } = d;
  const employeeCount = d.empPagination.total || company._count?.users || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/companies", label: "Back to companies" }}
        title={company.name}
        description={company.address || "No address on file"}
        meta={
          <>
            {company.is_shuttle_enabled && (
              <Badge tone="info" dot>
                Shuttle
              </Badge>
            )}
            {company.is_chauffeur_enabled && (
              <Badge tone="purple" dot>
                Chauffeur
              </Badge>
            )}
            {!company.is_shuttle_enabled && !company.is_chauffeur_enabled && <Badge tone="neutral">No services enabled</Badge>}
            <span className="text-xs text-fg-muted">
              {employeeCount} employee{employeeCount === 1 ? "" : "s"}
              {company.contact_person ? ` · ${company.contact_person}` : ""}
              {company.email ? ` · ${company.email}` : ""}
            </span>
          </>
        }
        actions={
          <>
            {d.canViewPricing && (
              <Button variant="outline" asChild leftIcon={<FileText />}>
                <Link href={`/admin/pricing?companyId=${id}`}>
                  <FileText />
                  Contracts &amp; pricing
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={`/admin/companies/${id}/fleet`}>
                <Gauge />
                Fleet efficiency
              </Link>
            </Button>
            <Button variant="outline" onClick={d.handleExportCredentials} loading={d.isExporting} leftIcon={<Download />}>
              Export roster
            </Button>
          </>
        }
      />

      <Tabs value={d.activeTab} onValueChange={(v) => d.setActiveTab(v as "employees" | "services")}>
        <TabsList>
          <TabsTrigger value="employees" count={employeeCount}>
            Employees
          </TabsTrigger>
          <TabsTrigger value="services">Services &amp; configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="employees">
          <CompanyEmployeesTab detail={d} />
        </TabsContent>
        <TabsContent value="services">
          <CompanyServicesTab detail={d} />
        </TabsContent>
      </Tabs>

      <Dialog open={d.isEmpModalOpen} onOpenChange={(open) => !open && !d.isCreatingEmp && d.setIsEmpModalOpen(false)}>
        <DialogContent
          size="lg"
          title="Add employee"
          description={`New employee account for ${company.name}.`}
          footer={
            <>
              <Button variant="outline" onClick={() => d.setIsEmpModalOpen(false)} disabled={d.isCreatingEmp}>
                Cancel
              </Button>
              <Button onClick={d.handleCreateEmployee} loading={d.isCreatingEmp} disabled={!d.canCreate || !d.newEmpName.trim()} leftIcon={<UserPlus />}>
                Add employee
              </Button>
            </>
          }
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!d.isCreatingEmp && d.canCreate && d.newEmpName.trim()) void d.handleCreateEmployee();
            }}
          >
            <FormGrid cols={2}>
              <Field label="Full name" required>
                <Input value={d.newEmpName} onChange={(e) => d.setNewEmpName(e.target.value)} autoFocus disabled={d.isCreatingEmp} />
              </Field>
              <Field label="Employee ID">
                <Input mono value={d.newEmpId} onChange={(e) => d.setNewEmpId(e.target.value)} disabled={d.isCreatingEmp} />
              </Field>
              <Field label="Email">
                <Input type="email" value={d.newEmpEmail} onChange={(e) => d.setNewEmpEmail(e.target.value)} disabled={d.isCreatingEmp} />
              </Field>
              <Field label="Phone">
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={PHONE_MAX_LENGTH}
                  value={d.newEmpPhone}
                  onChange={(e) => d.setNewEmpPhone(sanitizePhoneInput(e.target.value))}
                  placeholder={PHONE_PLACEHOLDER}
                  disabled={d.isCreatingEmp}
                />
              </Field>
              <Field label="Department">
                <Input value={d.newEmpDepartment} onChange={(e) => d.setNewEmpDepartment(e.target.value)} disabled={d.isCreatingEmp} />
              </Field>
              <Field label="Password" hint="Optional. Generated if left empty.">
                <Input mono value={d.newEmpPassword} onChange={(e) => d.setNewEmpPassword(e.target.value)} autoComplete="off" disabled={d.isCreatingEmp} />
              </Field>
            </FormGrid>
            <Field label="Home address">
              <Input value={d.newEmpHomeAddress} onChange={(e) => d.setNewEmpHomeAddress(e.target.value)} placeholder="e.g. DHA Phase 6, Lahore" disabled={d.isCreatingEmp} />
            </Field>
            <button type="submit" className="sr-only">
              Add employee
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
