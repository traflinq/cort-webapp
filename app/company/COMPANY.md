# Company portal conventions

Built on the shared design system in `app/ui` (see `app/ui/README.md` for tokens, RTL and labels rules).
Providers are mounted in `CompanyLayoutClient.tsx`: locale → theme → `CompanyUiProviders` (translated UiLabels +
locale-aware formatters) → Tooltip → Confirm → `.portal company-portal` → `CompanyShell`.

## Page skeleton

```tsx
<div className="space-y-6">
  <PageHeader title={t("title")} description={t("description")} actions={<Button leftIcon={<Plus />}>{t("add")}</Button>} />
  <Card>
    <CardContent className="border-b border-line py-3"><FilterBar search={{ value, onChange }} … /></CardContent>
    <DataTable rows columns rowKey loading error onRetry empty onRowClick rowActions pagination />
  </Card>
</div>
```

- **Every string is translated**: `useTranslations("company.<ns>")`; add new keys to **both** `messages/en/company.json` and
  `messages/ar/company.json`. Primitive defaults (Cancel, Showing x–y of z, …) come from `common.ui.*` via `lib/ui-labels.ts`.
- **Links** go through `useCompanyBasePath().companyPath("/company/…")` so the Saudi `/sa` tree keeps its prefix. Never hard-code `/company/…`.
- **Money / dates**: `const { formatCurrency, formatDate, formatTime } = useFormatters()` — Arabic digits and dates on `/sa`; currency stays PKR.
- **Navigation** is built by `lib/nav.ts` (`buildCompanyNav`) from `services_enabled`, feature flags, vendor links (`useCompanyVendors`),
  trial modules and the base path. Add pages there only; the sidebar, breadcrumbs and trial allow-list derive from it.
- **Status pills**: `<StatusBadge status={…} />`; translations map through `STATUS_KEY_MAP` in `lib/ui-labels.ts`.
- **Destructive actions**: `useConfirm()` with `consequences`; never `confirm()` / `alert()`. Feedback via `toast` from sonner.
- **Vendors**: one fetch per company through `useCompanyVendors()` (shell gating, Vendors page, booking form).
- Trial users: `TrialBanner` + `TrialOnboardingWalkthrough` in the shell; disallowed paths redirect home (`isTrialAllowedPath`).
- Impersonation: `ImpersonationBanner` appears when `user.impersonated_by` is set.
- Dev-only gallery at `/company/design-system` (and `/sa/company/design-system` for RTL + Arabic labels).

## Data fetching

Redux (`companyStore`: company, dashboard, bookings, contract, employees slices) for lists with persisted filters; `apiClient` + local
state for the rest. Keep the set of API calls per page unchanged when restyling.

## Flagged, not changed

- `HIDE_INVOICING_COMPANY_IDS` and the demo calendar URL are client constants (`lib/constants.ts`); they belong in config.
- Impersonation writes the company token into the same-origin `localStorage` the admin session uses.
- Route "generate trips" uses a UTC date (`toISOString`); creating an employee from the routes page then failing the assignment duplicates the employee on retry.
- `demo/` pages and `DemoComponents`/`PremiumUIComponents` are sales mocks and were left untouched.
