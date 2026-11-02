"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { AdminProtectedPage } from "../components/AdminProtectedPage";
import { FleetEfficiencyPanel } from "../components/FleetEfficiencyPanel";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { apiClient } from "../../lib/services/api-client";
import { Card, EmptyState, PageHeader, Select } from "../ui";
import { companyLabel } from "../lib/format";

export default function FleetEfficiencyPage() {
  return (
    <AdminProtectedPage permission="fleet_efficiency" subject={ADMIN_SUBJECTS.fleet_efficiency}>
      <FleetEfficiencyContent />
    </AdminProtectedPage>
  );
}

function FleetEfficiencyContent() {
  const [companies, setCompanies] = useState<{ id: number; name: string; prefix?: string | null }[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companyId, setCompanyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getCompanies({ limit: 200 });
        if (!cancelled) setCompanies([...res.data.data].sort((a, b) => companyLabel(a).localeCompare(companyLabel(b))));
      } catch {
        // The picker stays empty; the empty state explains what to do.
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet efficiency"
        description="Shuttle and chauffeur utilisation, fuel variance and AI fleet insights for a company."
        actions={
          <Select aria-label="Company" width="auto" value={companyId} onChange={(e) => setCompanyId(e.target.value)} disabled={companiesLoading} className="min-w-56">
            <option value="">{companiesLoading ? "Loading companies…" : "Select a company"}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {companyLabel(c)}
              </option>
            ))}
          </Select>
        }
      />
      {companyId ? (
        // key resets the panel's filters and data when switching company
        <FleetEfficiencyPanel key={companyId} companyId={Number(companyId)} />
      ) : (
        <Card>
          <EmptyState icon={<Gauge aria-hidden="true" />} title="Pick a company" description="Choose a company above to see its fleet efficiency." />
        </Card>
      )}
    </div>
  );
}
