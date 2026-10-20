"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../../lib/services/api-client";
import { AdminProtectedPage } from "../components/AdminProtectedPage";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { Badge, Card, CardContent, DataTable, FilterBar, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger, sortRows, type DataTableColumn, type SortState, RefreshButton } from "../ui";
import { formatDateTime, humanize } from "../lib/format";

type LandingLead = {
  id: number;
  name: string;
  role: string;
  email: string;
  phone: string;
  organization: string;
  country: string;
  city: string;
  fleet_size: string;
  primary_goal: string;
  created_at: string;
};

type TrialLead = {
  id: number;
  name: string;
  role: string | null;
  email: string;
  phone: string | null;
  organization: string | null;
  country: string | null;
  locale: string | null;
  modules: string;
  created_at: string;
};

export default function AdminLeadsPage() {
  return (
    <AdminProtectedPage permission="dashboard" subject={ADMIN_SUBJECTS.dashboard}>
      <LeadsContent />
    </AdminProtectedPage>
  );
}

const dash = (v: string | null | undefined) => (v ? v : <span className="text-fg-muted">—</span>);

function matches(q: string, ...fields: Array<string | null | undefined>) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

function ContactCell({ email, phone }: { email: string; phone?: string | null }) {
  return (
    <div className="min-w-0 text-xs">
      <a href={`mailto:${email}`} className="block truncate text-fg hover:underline" title={email}>
        {email}
      </a>
      {phone ? (
        <a href={`tel:${phone}`} className="block text-fg-muted hover:underline">
          {phone}
        </a>
      ) : (
        <span className="text-fg-muted">—</span>
      )}
    </div>
  );
}

function LeadsContent() {
  const [leads, setLeads] = useState<LandingLead[]>([]);
  const [trialLeads, setTrialLeads] = useState<TrialLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [leadsSort, setLeadsSort] = useState<SortState | null>({ key: "created_at", dir: "desc" });
  const [trialSort, setTrialSort] = useState<SortState | null>({ key: "created_at", dir: "desc" });

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [briefingRes, trialRes] = await Promise.all([apiClient.getLandingLeads(), apiClient.getTrialLeads()]);
        if (cancelled) return;
        setLeads(briefingRes.data ?? []);
        setTrialLeads(trialRes.data ?? []);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load leads");
        setLeads([]);
        setTrialLeads([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const fetchLeads = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  const filteredLeads = useMemo(
    () => sortRows(leads.filter((l) => matches(search, l.name, l.email, l.organization, l.city, l.country)), leadsSort, (r, k) => (r as unknown as Record<string, unknown>)[k]),
    [leads, search, leadsSort],
  );
  const filteredTrial = useMemo(
    () => sortRows(trialLeads.filter((l) => matches(search, l.name, l.email, l.organization, l.country)), trialSort, (r, k) => (r as unknown as Record<string, unknown>)[k]),
    [trialLeads, search, trialSort],
  );

  const leadColumns: DataTableColumn<LandingLead>[] = [
    { key: "created_at", header: "Submitted", sortable: true, width: "11rem", cell: (r) => <span className="whitespace-nowrap text-fg-secondary">{formatDateTime(r.created_at)}</span> },
    {
      key: "name",
      header: "Lead",
      sortable: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-fg">{r.name}</div>
          <div className="text-xs text-fg-muted">{r.role}</div>
        </div>
      ),
    },
    { key: "email", header: "Contact", sortable: true, cell: (r) => <ContactCell email={r.email} phone={r.phone} /> },
    { key: "organization", header: "Organization", sortable: true, cell: (r) => dash(r.organization) },
    { key: "country", header: "Location", sortable: true, hideBelow: "md", cell: (r) => [r.city, r.country].filter(Boolean).join(", ") || dash(null) },
    { key: "fleet_size", header: "Fleet size", sortable: true, hideBelow: "lg", cell: (r) => dash(r.fleet_size) },
    { key: "primary_goal", header: "Primary goal", sortable: true, hideBelow: "xl", cell: (r) => <span className="line-clamp-2 max-w-xs">{dash(r.primary_goal)}</span> },
  ];

  const trialColumns: DataTableColumn<TrialLead>[] = [
    { key: "created_at", header: "Submitted", sortable: true, width: "11rem", cell: (r) => <span className="whitespace-nowrap text-fg-secondary">{formatDateTime(r.created_at)}</span> },
    {
      key: "name",
      header: "Lead",
      sortable: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-fg">{r.name}</div>
          <div className="text-xs text-fg-muted">{r.role ?? "—"}</div>
        </div>
      ),
    },
    { key: "email", header: "Contact", sortable: true, cell: (r) => <ContactCell email={r.email} phone={r.phone} /> },
    { key: "organization", header: "Organization", sortable: true, cell: (r) => dash(r.organization) },
    { key: "country", header: "Country", sortable: true, hideBelow: "md", cell: (r) => dash(r.country) },
    { key: "locale", header: "Locale", sortable: true, hideBelow: "lg", cell: (r) => <span className="font-mono text-xs">{dash(r.locale)}</span> },
    {
      key: "modules",
      header: "Modules",
      sortable: true,
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {String(r.modules ?? "")
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean)
            .map((m) => (
              <Badge key={m} tone="info" size="sm">
                {humanize(m)}
              </Badge>
            ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Inquiries from the Traflinq marketing landing page and the Explore trial sign-up."
        actions={
          <RefreshButton label="Refresh leads" onClick={fetchLeads} loading={loading} />
        }
      />

      <Tabs defaultValue="briefing">
        <TabsList>
          <TabsTrigger value="briefing" count={leads.length}>
            Briefing leads
          </TabsTrigger>
          <TabsTrigger value="trial" count={trialLeads.length}>
            Trial leads
          </TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardContent className="border-b border-line py-3">
            <FilterBar search={{ value: search, onChange: setSearch, placeholder: "Search name, email, organisation…" }} activeCount={search ? 1 : 0} onClear={() => setSearch("")} />
          </CardContent>
          <TabsContent value="briefing" className="mt-0">
            <DataTable<LandingLead>
              caption="Briefing leads"
              rows={filteredLeads}
              rowKey={(r) => r.id}
              columns={leadColumns}
              loading={loading}
              error={error}
              onRetry={fetchLeads}
              sort={leadsSort}
              onSortChange={setLeadsSort}
              empty={{ title: search ? "No leads match your search" : "No leads yet", description: search ? "Try a different name, email or organisation." : "Landing-page inquiries will appear here." }}
            />
          </TabsContent>
          <TabsContent value="trial" className="mt-0">
            <DataTable<TrialLead>
              caption="Trial leads"
              rows={filteredTrial}
              rowKey={(r) => r.id}
              columns={trialColumns}
              loading={loading}
              error={error}
              onRetry={fetchLeads}
              sort={trialSort}
              onSortChange={setTrialSort}
              empty={{ title: search ? "No trial leads match your search" : "No trial leads yet", description: search ? "Try a different name, email or organisation." : "Trial sign-ups will appear here." }}
            />
          </TabsContent>
        </Card>
      </Tabs>
    </div>
  );
}
