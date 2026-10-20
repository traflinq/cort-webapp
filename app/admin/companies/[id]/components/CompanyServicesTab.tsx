"use client";

import * as React from "react";
import { CheckCircle2, Link2, Plus, TriangleAlert } from "lucide-react";
import type { CompanyVendorLink } from "../../../../lib/services/types/multi-mode";
import type { useCompanyDetail } from "../hooks/useCompanyDetail";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardSkeleton,
  Checkbox,
  Dialog,
  DialogContent,
  Field,
  FormGrid,
  Input,
  Select,
  StatusBadge,
  Switch,
  type BadgeTone,
} from "../../../ui";

type Detail = ReturnType<typeof useCompanyDetail>;
type Props = { detail: Detail };

/* ── Small building blocks ───────────────────────────────────────────── */

function ModeRow({
  title,
  description,
  checked,
  onChange,
  pending,
  disabled,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  pending: boolean;
  disabled: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <Switch label={title} description={description} checked={checked} onCheckedChange={onChange} loading={pending} disabled={disabled} />
      {children}
    </div>
  );
}

function VendorLinksPanel({
  service,
  links,
  modeEnabled,
  canUpdate,
  onAdd,
  onToggleActive,
  onRemove,
}: {
  service: "chauffeur" | "shuttle";
  links: CompanyVendorLink[];
  modeEnabled: boolean;
  canUpdate: boolean;
  onAdd: () => void;
  onToggleActive: (link: CompanyVendorLink) => void;
  onRemove: (link: CompanyVendorLink) => void;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-line">
      {links.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-subtle text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">
                Vendor
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Status
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {links.map((link) => (
              <tr key={link.id} className="hover:bg-row-hover">
                <td className="px-3 py-2 font-medium text-fg">{link.external_vendors?.name ?? `Vendor #${link.vendor_id}`}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={link.is_active ? "ACTIVE" : "INACTIVE"} size="sm" />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onToggleActive(link)} disabled={!canUpdate}>
                      {link.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger-ink hover:bg-danger-soft" onClick={() => onRemove(link)} disabled={!canUpdate}>
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="bg-subtle px-4 py-3 text-xs text-fg-muted">No vendors linked for {service} yet.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle px-4 py-2">
        <span className="text-[11px] text-fg-muted">{modeEnabled ? `Link a vendor for ${service} fulfilment.` : "Link a vendor first, then enable External Vendor."}</span>
        <Button variant="ghost" size="sm" onClick={onAdd} disabled={!canUpdate} leftIcon={<Plus />}>
          Add vendor
        </Button>
      </div>
    </div>
  );
}

/** One card per service (chauffeur / shuttle): master switch + fulfilment modes. */
function ServiceCard({
  d,
  service,
}: {
  d: Detail;
  service: "chauffeur" | "shuttle";
}) {
  const company = d.company!;
  const isShuttle = service === "shuttle";
  const enabled = isShuttle ? company.is_shuttle_enabled : company.is_chauffeur_enabled;
  const serviceKey = isShuttle ? "service:is_shuttle_enabled" : "service:is_chauffeur_enabled";
  const feat = (key: string) => d.features.find((f) => f.feature_key === key)?.is_enabled ?? false;
  const cortKey = isShuttle ? "shuttle_cort_managed" : "chauffeur_cort_managed";
  const vendorKey = isShuttle ? "shuttle_external_vendor" : "chauffeur_external_vendor";
  const selfKey = isShuttle ? "shuttle_self_managed" : "chauffeur_self_managed";
  const links = d.companyVendorLinks.filter((l) => (isShuttle ? l.serves_shuttle : l.serves_chauffeur));

  return (
    <Card>
      <CardHeader
        title={isShuttle ? "Shuttle service" : "Chauffeur service"}
        description={isShuttle ? "Fixed routes with scheduled stops" : "On-demand point-to-point bookings"}
        actions={
          <Switch
            aria-label={`${isShuttle ? "Shuttle" : "Chauffeur"} service`}
            checked={enabled}
            onCheckedChange={() => d.toggleService(service)}
            disabled={!d.canUpdate}
            loading={d.isTogglePending(serviceKey)}
          />
        }
      />
      {enabled ? (
        <div className="divide-y divide-line">
          <ModeRow
            title="CORT managed"
            description={isShuttle ? "CORT manages shuttle routes and drivers" : "CORT assigns drivers and vehicles for bookings"}
            checked={feat(cortKey)}
            onChange={() => (isShuttle ? d.handleShuttleCortManagedToggle(!feat(cortKey)) : d.handleChauffeurCortManagedToggle(!feat(cortKey)))}
            pending={d.isTogglePending(`feature:${cortKey}`)}
            disabled={!d.canUpdate}
          />
          <ModeRow
            title="External vendor"
            description={isShuttle ? "Third-party vendors manage shuttle routes" : "Third-party vendors fulfil bookings via their dashboard"}
            checked={feat(vendorKey)}
            onChange={() => d.toggleFeature(vendorKey, !feat(vendorKey))}
            pending={d.isTogglePending(`feature:${vendorKey}`)}
            disabled={!d.canUpdate}
          >
            <VendorLinksPanel
              service={service}
              links={links}
              modeEnabled={feat(vendorKey)}
              canUpdate={d.canUpdate}
              onAdd={() => d.openLinkModal(service)}
              onToggleActive={(link) => d.updateLink(link, { is_active: !link.is_active })}
              onRemove={(link) => d.removeLink(link)}
            />
          </ModeRow>
          <ModeRow
            title={isShuttle ? "Own fleet (self-managed)" : "Own pool (self-managed)"}
            description={isShuttle ? "Company runs its own shuttle vehicles, drivers, routes, stops and employee assignments" : "Company runs its own drivers and vehicle pool"}
            checked={feat(selfKey)}
            onChange={() => d.toggleFeature(selfKey, !feat(selfKey))}
            pending={d.isTogglePending(`feature:${selfKey}`)}
            disabled={!d.canUpdate}
          />
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-fg-muted">Enable {isShuttle ? "Shuttle" : "Chauffeur"} service to configure fulfilment modes.</p>
      )}
    </Card>
  );
}

/* ── Tab ─────────────────────────────────────────────────────────────── */

export function CompanyServicesTab({ detail: d }: Props) {
  if (!d.company) return null;
  const company = d.company;
  const feat = (key: string) => d.features.find((f) => f.feature_key === key)?.is_enabled ?? false;

  if (d.featuresLoading || d.vendorsLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
        <CardSkeleton lines={2} />
      </div>
    );
  }

  const trackerEnabled = feat("tracker_api_integration");
  const appEnabled = feat("tracking_via_app");
  const aiEnabled = feat("ai_insights");

  const summary: { label: string; tone: BadgeTone }[] = [];
  const cvCount = d.companyVendorLinks.filter((l) => l.serves_chauffeur && l.is_active).length;
  const svCount = d.companyVendorLinks.filter((l) => l.serves_shuttle && l.is_active).length;
  if (company.is_chauffeur_enabled) {
    if (feat("chauffeur_cort_managed")) summary.push({ label: "Chauffeur — CORT managed", tone: "info" });
    if (feat("chauffeur_external_vendor")) summary.push({ label: `Chauffeur — External vendor (${cvCount} active)`, tone: "purple" });
    if (feat("chauffeur_self_managed")) summary.push({ label: "Chauffeur — Own pool", tone: "success" });
  }
  if (company.is_shuttle_enabled) {
    if (feat("shuttle_cort_managed")) summary.push({ label: "Shuttle — CORT managed", tone: "info" });
    if (feat("shuttle_external_vendor")) summary.push({ label: `Shuttle — External vendor (${svCount} active)`, tone: "purple" });
    if (feat("shuttle_self_managed")) summary.push({ label: "Shuttle — Own fleet", tone: "success" });
  }
  if (trackerEnabled) summary.push({ label: "Tracking — Third-party API", tone: "brand" });
  if (appEnabled) summary.push({ label: "Tracking — CORT app GPS", tone: "brand" });
  if (aiEnabled) summary.push({ label: "Add-on: AI insights", tone: "success" });

  const linkLocked = d.linkContext;

  return (
    <div className="space-y-6">
      <ServiceCard d={d} service="chauffeur" />
      <ServiceCard d={d} service="shuttle" />

      <Card>
        <CardHeader title="Tracking" description="How vehicles and drivers are tracked. Both methods can be active at the same time." />
        <div className="divide-y divide-line">
          <ModeRow
            title="Third-party tracker API"
            description="Integrate with the company's own external tracking system"
            checked={trackerEnabled}
            onChange={() => d.toggleFeature("tracker_api_integration", !trackerEnabled)}
            pending={d.isTogglePending("feature:tracker_api_integration")}
            disabled={!d.canUpdate}
          >
            {trackerEnabled && (
              <form onSubmit={d.saveTrackerConfig} className="mt-4 space-y-4 rounded-lg border border-info-line bg-info-soft p-4">
                <div>
                  <p className="text-sm font-medium text-fg">TPL Trakker credentials</p>
                  <p className="mt-1 text-xs text-fg-secondary">
                    Enter the account credentials from TPL Trakker. The system calls <code className="font-mono">GetToken</code> then{" "}
                    <code className="font-mono">GetVLL</code> every 30 seconds to update vehicle positions.
                  </p>
                </div>
                <FormGrid cols={2}>
                  <Field label="User ID">
                    <Input mono value={d.trackerForm.user_id} onChange={(e) => d.setTrackerForm((f) => ({ ...f, user_id: e.target.value }))} placeholder="e.g. Z1X5CVA" autoComplete="off" />
                  </Field>
                  <Field label="Password">
                    <Input type="password" value={d.trackerForm.password} onChange={(e) => d.setTrackerForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" autoComplete="new-password" />
                  </Field>
                  <Field label="Phone">
                    <Input mono value={d.trackerForm.phone} onChange={(e) => d.setTrackerForm((f) => ({ ...f, phone: e.target.value }))} placeholder="e.g. 03156618471" />
                  </Field>
                  <Field label="Year">
                    <Input mono value={d.trackerForm.year} onChange={(e) => d.setTrackerForm((f) => ({ ...f, year: e.target.value }))} placeholder="e.g. 1992" />
                  </Field>
                </FormGrid>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" loading={d.trackerSaving} disabled={!d.canUpdate}>
                    Save credentials
                  </Button>
                  <Button type="button" variant="outline" onClick={d.testTrackerConnection} loading={d.trackerTesting} disabled={!d.trackerForm.user_id || !d.trackerForm.phone}>
                    Test connection
                  </Button>
                </div>
                {d.trackerTestResult && (
                  <div
                    role="status"
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                      d.trackerTestResult.count > 0 ? "border-success-line bg-success-soft text-success-ink" : "border-warning-line bg-warning-soft text-warning-ink"
                    }`}
                  >
                    {d.trackerTestResult.count > 0 ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                    <div>
                      {d.trackerTestResult.count > 0 ? (
                        <>
                          <span className="font-semibold">{d.trackerTestResult.count} vehicle(s) found.</span>
                          {d.trackerTestResult.vehicles.length > 0 && (
                            <span className="ml-2 font-mono">
                              {d.trackerTestResult.vehicles.join(", ")}
                              {d.trackerTestResult.count > 5 ? ` +${d.trackerTestResult.count - 5} more` : ""}
                            </span>
                          )}
                          <p className="mt-1">Vehicles matching active trip plate numbers appear live on the mobility map.</p>
                        </>
                      ) : (
                        <span className="font-semibold">Connected, but no vehicles found. Check the Phone and Year fields.</span>
                      )}
                    </div>
                  </div>
                )}
              </form>
            )}
          </ModeRow>
          <ModeRow
            title="App tracking (CORT)"
            description="Track drivers and vehicles via GPS in the CORT mobile app"
            checked={appEnabled}
            onChange={() => d.toggleFeature("tracking_via_app", !appEnabled)}
            pending={d.isTogglePending("feature:tracking_via_app")}
            disabled={!d.canUpdate}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Add-ons" description="Optional features available to any configuration." />
        <ModeRow
          title="AI insights"
          description="AI-powered cost savings analysis and recommendations"
          checked={aiEnabled}
          onChange={() => d.toggleFeature("ai_insights", !aiEnabled)}
          pending={d.isTogglePending("feature:ai_insights")}
          disabled={!d.canUpdate}
        />
      </Card>

      <Card padding="lg">
        <h3 className="text-sm font-semibold text-fg">Active services summary</h3>
        {summary.length === 0 ? (
          <p className="mt-2 text-xs text-fg-muted">No services enabled yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.map((item) => (
              <Badge key={item.label} tone={item.tone} dot>
                {item.label}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={d.showLinkModal} onOpenChange={(open) => !open && !d.linkSaving && d.setShowLinkModal(false)}>
        <DialogContent
          size="sm"
          title="Link external vendor"
          description={`Choose a vendor to fulfil ${linkLocked === "general" ? "work" : linkLocked} for ${company.name}.`}
          footer={
            <>
              <Button variant="outline" onClick={() => d.setShowLinkModal(false)} disabled={d.linkSaving}>
                Cancel
              </Button>
              <Button type="submit" form="link-vendor-form" loading={d.linkSaving} disabled={!d.linkForm.vendor_id} leftIcon={<Link2 />}>
                Link vendor
              </Button>
            </>
          }
        >
          <form id="link-vendor-form" onSubmit={d.handleLinkVendor} className="space-y-4">
            <Field label="Vendor" required>
              <Select required value={d.linkForm.vendor_id} onChange={(e) => d.setLinkForm((f) => ({ ...f, vendor_id: Number(e.target.value) }))}>
                <option value={0}>— Choose a vendor —</option>
                {d.allVendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </Field>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-[13px] font-medium text-fg-secondary">Serves</legend>
              <div className="flex flex-wrap gap-4">
                <Checkbox
                  label="Chauffeur"
                  checked={d.linkForm.serves_chauffeur}
                  disabled={linkLocked === "chauffeur"}
                  onCheckedChange={(c) => linkLocked !== "chauffeur" && d.setLinkForm((f) => ({ ...f, serves_chauffeur: c === true }))}
                />
                <Checkbox
                  label="Shuttle"
                  checked={d.linkForm.serves_shuttle}
                  disabled={linkLocked === "shuttle"}
                  onCheckedChange={(c) => linkLocked !== "shuttle" && d.setLinkForm((f) => ({ ...f, serves_shuttle: c === true }))}
                />
              </div>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
