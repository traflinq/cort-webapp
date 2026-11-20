# Company portal design system — "Navy rail"

One visual language for every page under `app/company`. Import from `@/app/company/ui` only.
The admin portal has its own system (`app/admin/ui`); do not mix them (the `Map` and
`StopAddressSearch` widgets from `app/admin/ui` are the only shared pieces).

## Principles
- **Navy is the action colour, orange is the signal.** `Button` (primary) is navy. `variant="accent"`
  (orange) is used at most **once per page** for its key action (New booking, Create route…).
  Orange otherwise only means "needs attention".
- **Flat and quiet.** White cards, hairline borders, 8px corners (`rounded-lg`), 6px controls
  (`rounded-md`). Shadows only on overlays. No gradients, no hover-lift, no decorative icons.
- **Readable type.** Page title 20px/600, section 15px/600, body 14px, nothing below 12px.
  No uppercase/black micro-labels (the rail group labels are the one exception). `tabular-nums`
  on figures.
- **Each number once.** A metric appears in one place on a page.

## Rules (enforced in review)
1. **Tokens only.** Use the semantic utilities: `bg-page`, `bg-card`, `bg-subtle`, `bg-elevated`,
   `text-fg`, `text-fg-secondary`, `text-fg-muted`, `border-line`, `border-line-strong`,
   `bg-action` / `text-on-action`, `bg-highlight` / `text-on-highlight`, and the tones
   `{neutral|brand|success|warning|danger|info|purple}-{ink|soft|line}`.
   Never `[var(--…)]`, hex/rgba, or raw palette classes (`red-500`, `bg-white`, `text-gray-700`).
   Both themes then work without thinking about it.
2. **Logical direction.** `ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/border-e`.
   Never `ml/mr/pl/pr/left/right/text-left/text-right`. Directional icons get `rtl:-scale-x-100`.
3. **No literal UI text.** Every string through `useTranslations`, added to **both**
   `messages/en` and `messages/ar`. Backend enums are shown with `StatusBadge` / `useStatusLabel()`
   (`company.status.*`) — never raw.
4. **Formatting** through `useFormatters()` (`currency`, `number`, `percent`, `date`, `dateTime`,
   `time`, `month`). Amounts are always PKR; the locale changes digits and month names.
5. **Links** through `CompanyLink` / `useCompanyPath()` so the Saudi `/sa` prefix is kept.
   `router.push(companyPath("/company/…"))`.
6. **Feedback.** `toast` from `sonner` for results; `useConfirm()` before destructive or
   irreversible actions (never `window.confirm` / `alert`). Loading, empty and error states on
   every data view (`DataTable` has them built in; otherwise `LoadingBlock`, `EmptyState`,
   `ErrorState` with `onRetry`).
7. **Accessibility.** Icon-only buttons are `IconButton` (label required). Clickable rows use
   `DataTable onRowClick` (keyboard-operable). Dialogs are `Dialog` / `Drawer` (focus-trapped).
   Form controls sit in `Field` (label, hint, error wired up).

## Page skeleton
```tsx
<Page>
  <PageHeader title={t("title")} description={t("description")}
    actions={<Button variant="accent" leftIcon={<Plus />}>{t("new")}</Button>} />
  <StatGrid>…<StatCard label value /></StatGrid>          {/* optional */}
  <DataTable toolbar={<FilterBar><SearchInput …/><Select …/></FilterBar>}
    columns={…} rows={…} rowKey={…} loading={…} error={…} onRetry={…}
    empty={{ title: t("empty") }} onRowClick={open}
    pagination={{ page, totalPages, total, pageSize, onPageChange }} />
</Page>
```
- Create / edit → `Dialog` with `footer` (Cancel = `secondary`, Save = `primary`).
- Record details → `Drawer`. Row overflow actions → `rowActions` (`ActionMenu`).
- Detail pages: `PageHeader backHref="/company/…" breadcrumbs={[{ label: name }]}`.
- Page sections that are not cards → `Section`; label/value details → `DescriptionList`.
- View switches → `Tabs` (`underline` for page sections, `segmented` for compact toggles);
  sync page-level tabs to `?tab=`.

## Components
`Button`, `IconButton`, `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`, `Field`, `FormGrid`,
`Badge`, `StatusBadge`, `Card`, `CardHeader`, `CardBody`, `Section`, `DescriptionList`, `Tabs`,
`Dialog`, `Drawer`, `useConfirm`, `DropdownMenu*`, `ActionMenu`, `Tooltip`, `EmptyState`,
`ErrorState`, `Alert`, `Spinner`, `LoadingBlock`, `Skeleton`, `StatSkeleton`, `CardSkeleton`,
`Pagination`, `DataTable` (+ `sortRows`), `FilterBar`, `SearchInput`, `DateRangeField`,
`StatCard`, `StatGrid`, `Delta`, `Meter`, `Page`, `PageHeader`, `ToneDot`.

## Where things live
- Tokens: `app/globals.css`, blocks scoped with `html:has(.company-portal)` (light default, dark).
- Shell: `CompanyShell.tsx` (providers + frame), `shell/Sidebar.tsx`, `shell/TopBar.tsx`.
- Navigation entries: `app/company/lib/nav.ts` (the only place).
- Theme: `app/company/lib/theme-context.tsx` (key `cort-company-theme`).
- Shared labels: `messages/*/common.json` → `common.ui.*`; statuses → `company.status.*`.
