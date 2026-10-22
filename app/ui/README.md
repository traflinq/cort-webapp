# Portal design system (`app/ui`)

Shared by the Super Admin portal (`app/admin`) and the Company portal (`app/company`). Import from `@/app/ui`.
Per-portal conventions: `app/admin/ADMIN.md`, `app/company/COMPANY.md`.

## What lives here

- Primitives: Button/IconButton, Input/Select/Textarea/Checkbox/Switch/Field/FormGrid, Badge/StatusBadge, Card, Tabs,
  Dialog/Drawer/DropdownMenu/ActionMenu/Popover/ConfirmDialog, EmptyState/ErrorState/Skeleton/Spinner, Pagination,
  DataTable, FilterBar, DateRangePicker, KpiCard/KpiGrid, ChartCard + `chart-theme`, PageHeader/Breadcrumbs, Map, StopAddressSearch, Toast.
- Shell: `shell/PortalShell` (rail, mobile drawer, top bar, skip link, breadcrumb context), `Sidebar`, `TopBar`, `ShellBreadcrumbs`, `nav-types`.
- Providers: `PortalThemeProvider` + `lib/theme-script`, `UiLabelsProvider`, `FormatProvider`, `ConfirmProvider`.
- Helpers: `lib/format` (currency/date/time, `createFormatters`, `useFormatters`), `lib/dates` (YYYY-MM-DD ranges), `lib/labels`.
- Gallery: `gallery/DesignGallery` — mounted at `/admin/design-system` and `/company/design-system` (dev only).

## Rules

1. **Tokens only.** `text-fg*`, `bg-page/card/subtle/elevated`, `border-line*`, tone utilities (`bg-success-soft text-success-ink border-success-line`,
   also brand/warning/danger/info/purple/neutral), `bg-brand`/`text-brand-ink`. Never `[var(--…)]`, hex, `gray/slate/zinc-*`, `bg-white`.
2. **Logical direction classes.** `ps-/pe-/ms-/me-/start-/end-/text-start/text-end/border-s/border-e/rounded-s/rounded-e`.
   The company portal renders Arabic RTL on `/sa`; flip directional icons with `rtl:-scale-x-100`. `Drawer side="end"` follows the reading direction.
3. **No literal UI strings in primitives.** Every default caption/aria name comes from `useUiLabels()` (English without a provider,
   translated under `<UiLabelsProvider>`). Explicit props always win.
4. **Formatting through `useFormatters()`** when a portal may serve other locales; the module-level `formatCurrency`/`formatDate`
   exports use the business defaults (Asia/Karachi, en-PK, PKR).
5. **Theme:** one key `cort-portal-theme`, default light. Wrap a portal in `.portal` to get the white-light / graphite-dark palette.
6. **Accessibility:** focus-visible ring on every control (`focusRing` from `styles`), labelled icon buttons (`IconButton label`), real dialogs
   (`Dialog`/`Drawer`/`ConfirmDialog`), `DataTable onRowClick` instead of clickable rows, consequences on destructive confirms.
7. Mount `TooltipProvider` and `ConfirmProvider` in each portal layout — the primitives assume both.
