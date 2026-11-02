"use client";

import { use } from "react";
import { FleetEfficiencyPanel } from "@/app/admin/components/FleetEfficiencyPanel";
import { AdminProtectedPage } from "@/app/admin/components/AdminProtectedPage";
import { ADMIN_SUBJECTS } from "@/app/lib/abilities/admin-subjects";
import { PageHeader } from "@/app/admin/ui";
import { usePageBreadcrumbs } from "@/app/admin/ui/shell/breadcrumbs-context";
import { useAuth } from "@/app/lib/contexts/auth-context";

export default function CompanyFleetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const companyId = parseInt(id, 10);
  // Company Features staff keep their access; Fleet Efficiency staff get this page without it
  const { hasCrud } = useAuth();
  const permission = hasCrud("company_features", "read") ? "company_features" : "fleet_efficiency";

  return (
    <AdminProtectedPage permission={permission} subject={ADMIN_SUBJECTS[permission]}>
      <FleetContent id={id} companyId={companyId} />
    </AdminProtectedPage>
  );
}

function FleetContent({ id, companyId }: { id: string; companyId: number }) {
  usePageBreadcrumbs([{ label: `Company #${id}`, href: `/admin/companies/${id}` }, { label: "Fleet efficiency" }]);
  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: `/admin/companies/${id}`, label: "Back to company" }}
        title="Fleet efficiency"
        description="Shuttle and chauffeur utilisation, fuel variance and AI fleet insights for this company."
      />
      <FleetEfficiencyPanel companyId={companyId} />
    </div>
  );
}
