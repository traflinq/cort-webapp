'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/app/lib/services/api-client';
import { useAuth } from '@/app/lib/contexts/auth-context';
import { Card } from '../components/DashboardComponents';
import { PageHeader } from '../components/PageLayout';
import { EmptyState, IllustrationTile } from '../ui';
import { Phone, Mail, Car, Bus, CheckCircle, XCircle } from 'lucide-react';

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
  const tCommon = useTranslations('common');
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
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
      <PageHeader
        label={t('label')}
        title={t('title')}
        description={t('description')}
      />

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-[var(--radius-card)] bg-[var(--bg-card)] p-6 h-48 animate-pulse"
            />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <Card>
          <p className="text-[var(--accent-danger)] text-sm font-medium">{error}</p>
        </Card>
      )}

      {!isLoading && !error && links.length === 0 && (
        <Card>
          <EmptyState illustration="handshake" title={t('noVendorsLinked')} description={t('noVendorsDescription')} />
        </Card>
      )}

      {!isLoading && active.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-medium text-[var(--text-primary)]">
            {t('activeVendors')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((link) => (
              <VendorCard key={link.id} link={link} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && inactive.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-medium text-[var(--text-primary)]">
            {t('inactiveVendors')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {inactive.map((link) => (
              <VendorCard key={link.id} link={link} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function VendorCard({ link }: { link: VendorLink }) {
  const t = useTranslations('company.vendors');
  const tCommon = useTranslations('common.status');
  const v = link.external_vendors;
  const isActive = link.is_active && v?.is_active;

  return (
    <div className="bg-[var(--bg-card)] rounded-[var(--radius-card)] p-6 flex flex-col gap-4 shadow-[var(--shadow-card)] transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <IllustrationTile name="building" size="md" />
          <div>
            <div className="text-lg font-medium text-[var(--text-primary)] leading-snug">{v?.name ?? '—'}</div>
            <div className="text-sm text-[var(--text-muted)] mt-0.5">
              {t('externalVendor')}
            </div>
          </div>
        </div>
        <span
          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
 isActive
 ? 'bg-[var(--tone-success-soft)] text-[var(--tone-success-ink)]'
 : 'bg-[var(--tile-bg)] text-[var(--text-muted)]'
 }`}
        >
          {isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {isActive ? tCommon('active') : tCommon('inactive')}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        <a
          href={`mailto:${v?.contact_email}`}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--cort-orange)] transition-colors group ltr-content"
          dir="ltr"
        >
          <Mail className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--cort-orange)]" />
          <span className="truncate">{v?.contact_email ?? '—'}</span>
        </a>
        {v?.contact_phone && (
          <a
            href={`tel:${v.contact_phone}`}
            className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--cort-orange)] transition-colors group ltr-content"
            dir="ltr"
          >
            <Phone className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--cort-orange)]" />
            <span>{v.contact_phone}</span>
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-[var(--divider)]">
        <span className="text-sm text-[var(--text-muted)] me-1">
          {t('handles')}
        </span>
        {link.serves_chauffeur && (
          <span className="flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-[var(--tile-bg)] text-[var(--text-secondary)]">
            <Car className="w-3 h-3" /> {t('chauffeur')}
          </span>
        )}
        {link.serves_shuttle && (
          <span className="flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-[var(--tile-bg)] text-[var(--text-secondary)]">
            <Bus className="w-3 h-3" /> {t('shuttle')}
          </span>
        )}
        {!link.serves_chauffeur && !link.serves_shuttle && (
          <span className="text-xs text-[var(--text-muted)]">—</span>
        )}
      </div>
    </div>
  );
}
