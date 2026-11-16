'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Settings2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { getSaudiBasePath, withSaudiBase } from '@/app/lib/i18n/saudi-route';
import { CompanyBenchmarksModal } from '../components/CompanyBenchmarksModal';
import { PageHeader } from '../components/PageLayout';
import { SavingsDashboard, SavingsLockedView, SavingsMonthPicker } from '@/app/components/savings/SavingsDashboard';
import { monthKey, type SavingsDashboardResponse } from '@/app/components/savings/types';
import { useSavingsFetch } from '@/app/components/savings/useSavingsFetch';

export default function SavingsPage() {
  const t = useTranslations('company.savings');
  const tNav = useTranslations('company.nav');
  const tCommon = useTranslations('common');
  const basePath = getSaudiBasePath(usePathname());

  const [month, setMonth] = useState(() => monthKey());
  const { data: fetched, error, loading, reload } = useSavingsFetch<SavingsDashboardResponse>(
    `/company/savings-dashboard?month=${month}`,
  );
  // Don't show the previous month's figures under the new month's heading.
  const data = loading || error ? null : fetched;
  const failed = !loading && !!error;
  const [benchmarksOpen, setBenchmarksOpen] = useState(false);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 pb-12">
      <PageHeader
        label={tNav('savings')}
        title={t('title')}
        description={t('description')}
        action={
          <>
            {data?.locked === true && (
              <button
                type="button"
                onClick={() => setBenchmarksOpen(true)}
                className="flex items-center gap-2 whitespace-nowrap rounded-2xl border border-line bg-card px-3 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-subtle"
              >
                <Settings2 className="size-4" />
                <span className="hidden sm:inline">{t('manageVendorCost')}</span>
              </button>
            )}
            <SavingsMonthPicker month={month} onChange={setMonth} />
          </>
        }
      />

      {loading && (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-44 animate-pulse rounded-3xl border border-line bg-card" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-line bg-card" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl border border-line bg-card" />
        </div>
      )}

      {!loading && failed && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-danger-line bg-danger-soft">
            <AlertCircle className="size-8 text-danger-ink" />
          </div>
          <div>
            <p className="text-lg font-bold text-fg">{tCommon('errors.couldNotLoadSavings')}</p>
            <p className="mt-1 text-sm text-fg-muted">{tCommon('errors.tryAgainOrContact')}</p>
          </div>
        </div>
      )}

      {!loading && data?.locked === true && <SavingsLockedView data={data} />}

      {!loading && data?.locked === false && (
        <SavingsDashboard
          data={data}
          auditHref={withSaudiBase('/company/reports/chauffeur', basePath)}
          onManageBenchmarks={() => setBenchmarksOpen(true)}
        />
      )}

      <CompanyBenchmarksModal
        isOpen={benchmarksOpen}
        onClose={() => setBenchmarksOpen(false)}
        onChanged={reload}
      />
    </div>
  );
}
