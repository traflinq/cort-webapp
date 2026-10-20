"use client";

import { use } from "react";
import { FleetEfficiencyPanel } from "@/app/admin/components/FleetEfficiencyPanel";
import { AdminProtectedPage } from "@/app/admin/components/AdminProtectedPage";
import { ADMIN_SUBJECTS } from "@/app/lib/abilities/admin-subjects";
import { PageHeader } from "@/app/admin/ui";
import { usePageBreadcrumbs } from "@/app/admin/ui/shell/breadcrumbs-context";

export default function CompanyFleetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const companyId = parseInt(id, 10);

  return (
    <AdminProtectedPage permission="company_features" subject={ADMIN_SUBJECTS.company_features}>
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
