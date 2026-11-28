'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Phone, Mail, Car, Bus, Building2 } from "@/app/components/icons";
import { Badge, EmptyState, ErrorState, Skeleton, focusRing } from '@/app/admin/ui';
import { apiClient } from '@/app/lib/services/api-client';
import { useAuth } from '@/app/lib/contexts/auth-context';
import { cn } from '@/lib/utils';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageLayout';

interface VendorLink {
  id: number;
  vendor_id: number;
  company_id: number;
  serves_chauffeur: boolean;
  serves_shuttle: boolean;
  is_active: boolean;
  external_vendors: {
    id: number;
    name: string;
    contact_email: string;
    contact_phone: string | null;
    is_active: boolean;
  };
}

export default function CompanyVendorsPage() {
  const t = useTranslations('company.vendors');
  const { user } = useAuth();
  const [links, setLinks] = useState<VendorLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.company_id) return;
    setIsLoading(true);
    apiClient
      .getCompanyExternalVendors(user.company_id)
      .then((res: unknown) => {
        const data = (res as { data?: VendorLink[] })?.data ?? res;
        setLinks(Array.isArray(data) ? data : []);
      })
      .catch((e: { message?: string }) => setError(e?.message ?? t('failedToLoad')))
      .finally(() => setIsLoading(false));
  }, [user?.company_id, t]);

  const active = links.filter((l) => l.is_active && l.external_vendors?.is_active);
  const inactive = links.filter((l) => !l.is_active || !l.external_vendors?.is_active);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12">
      <PageHeader
        label={t('label')}
        title={t('title')}
        description={t('description')}
      />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <Card>
          <ErrorState title={t('failedToLoad')} message={error !== t('failedToLoad') ? error : undefined} compact />
        </Card>
      )}

      {!isLoading && !error && links.length === 0 && (
        <Card>
          <EmptyState
            icon={<Building2 aria-hidden="true" />}
            title={t('noVendorsLinked')}
            description={t('noVendorsDescription')}
          />
        </Card>
      )}

      {!isLoading && active.length > 0 && (
        <VendorSection title={t('activeVendors')} links={active} />
      )}

      {!isLoading && inactive.length > 0 && (
        <VendorSection title={t('inactiveVendors')} links={inactive} />
      )}
    </div>
  );
}

function VendorSection({ title, links }: { title: string; links: VendorLink[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
        {title}
        <span className="text-xs font-medium text-fg-muted tabular-nums">{links.length}</span>
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <VendorCard key={link.id} link={link} />
        ))}
      </div>
    </section>
  );
}

function VendorCard({ link }: { link: VendorLink }) {
  const t = useTranslations('company.vendors');
  const tCommon = useTranslations('common.status');
  const v = link.external_vendors;
  const isActive = link.is_active && v?.is_active;

  const contactLink = cn(
    'flex min-w-0 items-center gap-2 rounded-md text-sm text-fg-secondary transition-colors hover:text-fg ltr-content',
    focusRing,
  );

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-fg-muted">
            <Building2 className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{v?.name ?? '—'}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{t('externalVendor')}</p>
          </div>
        </div>
        <Badge tone={isActive ? 'success' : 'neutral'} dot className="shrink-0">
          {isActive ? tCommon('active') : tCommon('inactive')}
        </Badge>
      </div>

      <div className="flex flex-col gap-2">
        <a href={`mailto:${v?.contact_email}`} className={contactLink} dir="ltr">
          <Mail className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
          <span className="truncate">{v?.contact_email ?? '—'}</span>
        </a>
        {v?.contact_phone && (
          <a href={`tel:${v.contact_phone}`} className={cn(contactLink, 'tabular-nums')} dir="ltr">
            <Phone className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <span>{v.contact_phone}</span>
          </a>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="me-1 text-xs font-medium text-fg-muted">{t('handles')}</span>
        {link.serves_chauffeur && (
          <Badge tone="neutral" icon={<Car aria-hidden="true" />}>
            {t('chauffeur')}
          </Badge>
        )}
        {link.serves_shuttle && (
          <Badge tone="neutral" icon={<Bus aria-hidden="true" />}>
            {t('shuttle')}
          </Badge>
        )}
        {!link.serves_chauffeur && !link.serves_shuttle && (
          <span className="text-xs text-fg-muted">—</span>
        )}
      </div>
    </Card>
  );
}
