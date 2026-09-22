'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/app/lib/services/api-client';
import { useAuth } from '@/app/lib/contexts/auth-context';
import { Card } from '../components/DashboardComponents';
import { PageHeader } from '../components/PageLayout';
import { Phone, Mail, Car, Bus, CheckCircle, XCircle, Building2 } from 'lucide-react';

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
    <div className="flex flex-col gap-6 pb-12 max-w-[1200px] mx-auto">
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
              className="rounded-[2rem] bg-[var(--bg-card)] border border-[var(--border-default)] p-6 h-48 animate-pulse"
            />
          ))}
        </div>
      )}

      {user?.enabled_services?.travel && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {t('travelProviders')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {['CORT', 'Bykea (ride-hailing)', 'Company vendors'].map((name) => (
              <Card key={name}>
                <p className="font-bold text-[var(--text-primary)]">{name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {name === 'Bykea (ride-hailing)'
                    ? 'Third-party ride-hailing. Service quality is not guaranteed.'
                    : name === 'CORT'
                      ? 'CORT-managed rental for first and last mile.'
                      : 'Linked vendors can accept travel rental requests.'}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {!isLoading && error && (
        <Card>
          <p className="text-[var(--accent-danger)] text-sm font-medium">{error}</p>
        </Card>
      )}

      {!isLoading && !error && links.length === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="p-4 rounded-full bg-[var(--surface-muted)]">
              <Building2 className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-[var(--text-primary)] font-semibold">{t('noVendorsLinked')}</p>
            <p className="text-[var(--text-muted)] text-sm max-w-xs">
              {t('noVendorsDescription')}
            </p>
          </div>
        </Card>
      )}

      {!isLoading && active.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
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
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-6 flex flex-col gap-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.14)] transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#fe8503]/10 text-[#fe8503] shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black text-[var(--text-primary)] leading-snug">{v?.name ?? '—'}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mt-0.5">
              {t('externalVendor')}
            </div>
          </div>
        </div>
        <span
          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
            isActive
              ? 'bg-emerald-500/15 text-emerald-500'
              : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
          }`}
        >
          {isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {isActive ? tCommon('active') : tCommon('inactive')}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <a
          href={`mailto:${v?.contact_email}`}
          className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[#fe8503] transition-colors group ltr-content"
          dir="ltr"
        >
          <Mail className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[#fe8503]" />
          <span className="truncate">{v?.contact_email ?? '—'}</span>
        </a>
        {v?.contact_phone && (
          <a
            href={`tel:${v.contact_phone}`}
            className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[#fe8503] transition-colors group ltr-content"
            dir="ltr"
          >
            <Phone className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[#fe8503]" />
            <span>{v.contact_phone}</span>
          </a>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-light)]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] me-1">
          {t('handles')}
        </span>
        {link.serves_chauffeur && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-secondary)]">
            <Car className="w-3 h-3" /> {t('chauffeur')}
          </span>
        )}
        {link.serves_shuttle && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-secondary)]">
            <Bus className="w-3 h-3" /> {t('shuttle')}
          </span>
        )}
        {!link.serves_chauffeur && !link.serves_shuttle && (
          <span className="text-[10px] text-[var(--text-muted)]">—</span>
        )}
      </div>
    </div>
  );
}
