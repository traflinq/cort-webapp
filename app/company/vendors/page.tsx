"use client";

import { useTranslations } from "next-intl";
import { Building2, Bus, Car, Mail, Phone } from "lucide-react";
import { Badge, Card, CardSkeleton, EmptyState, ErrorState, PageHeader, SectionHeader, StatusBadge } from "@/app/ui";
import { isActiveVendorLink, useCompanyVendors, type CompanyVendorLink } from "../lib/use-company-vendors";

export default function CompanyVendorsPage() {
  const t = useTranslations("company.vendors");
  const { links, loading, error, refresh } = useCompanyVendors();

  const active = links.filter(isActiveVendorLink);
  const inactive = links.filter((l) => !isActiveVendorLink(l));

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} lines={3} />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState title={t("failedToLoad")} message={error} onRetry={() => void refresh()} />
        </Card>
      ) : links.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 aria-hidden="true" />} title={t("noVendorsLinked")} description={t("noVendorsDescription")} />
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <SectionHeader title={t("activeVendors")} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((link) => (
                  <VendorCard key={link.id} link={link} />
                ))}
              </div>
            </section>
          )}
          {inactive.length > 0 && (
            <section className="space-y-3">
              <SectionHeader title={t("inactiveVendors")} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {inactive.map((link) => (
                  <VendorCard key={link.id} link={link} muted />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function VendorCard({ link, muted = false }: { link: CompanyVendorLink; muted?: boolean }) {
  const t = useTranslations("company.vendors");
  const v = link.external_vendors;
  const isActive = isActiveVendorLink(link);

  return (
    <Card padding="lg" className={muted ? "opacity-70" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-fg">{v?.name ?? "—"}</h3>
            <p className="text-xs text-fg-muted">{t("externalVendor")}</p>
          </div>
        </div>
        <StatusBadge status={isActive ? "ACTIVE" : "INACTIVE"} size="sm" />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Email</dt>
          <Mail className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
          <dd className="min-w-0 truncate">
            {v?.contact_email ? (
              <a href={`mailto:${v.contact_email}`} dir="ltr" className="text-fg-secondary hover:text-brand-ink hover:underline">
                {v.contact_email}
              </a>
            ) : (
              <span className="text-fg-muted">—</span>
            )}
          </dd>
        </div>
        {v?.contact_phone && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Phone</dt>
            <Phone className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <dd>
              <a href={`tel:${v.contact_phone}`} dir="ltr" className="text-fg-secondary hover:text-brand-ink hover:underline">
                {v.contact_phone}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{t("handles")}</span>
        {link.serves_chauffeur && (
          <Badge tone="neutral" size="sm">
            <Car className="size-3" aria-hidden="true" /> {t("chauffeur")}
          </Badge>
        )}
        {link.serves_shuttle && (
          <Badge tone="neutral" size="sm">
            <Bus className="size-3" aria-hidden="true" /> {t("shuttle")}
          </Badge>
        )}
        {!link.serves_chauffeur && !link.serves_shuttle && <span className="text-xs text-fg-muted">—</span>}
      </div>
    </Card>
  );
}
