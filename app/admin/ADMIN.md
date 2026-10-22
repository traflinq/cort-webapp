# Admin portal conventions

## Design system (2026-10 redesign, shared with the company portal)

The design system lives in `app/ui` (import `from "@/app/ui"`); `@/app/admin/ui` and the old deep paths
are re-export stubs kept for existing imports. See `app/ui/README.md` for the portal-wide rules
(shared theme, UiLabels/i18n, locale-aware formatters, RTL). Tokens live in `app/globals.css`; use the
semantic utilities, never raw palette classes or hex:

| Use | Not |
|---|---|
| `text-fg`, `text-fg-secondary`, `text-fg-muted` | `text-gray-*`, `text-slate-*`, `text-[#0c225e]` |
| `bg-page`, `bg-card`, `bg-subtle`, `bg-elevated` | `bg-white`, `bg-gray-50` |
| `border-line`, `border-line-strong` | `border-gray-200` |
| tones: `bg-success-soft text-success-ink border-success-line` (also brand/warning/danger/info/purple/neutral) | `bg-green-100 text-green-700` |
| `bg-brand`, `text-brand`, `text-brand-ink` | `#f47f00`, `#fe8503` |

Gallery of every primitive (dev only): `/admin/design-system`.

### Page skeleton

```tsx
<div className="space-y-6">
  <PageHeader title="Vehicles" description="…" actions={<Button leftIcon={<Plus />}>Add vehicle</Button>} />
  <Card>
    <CardContent className="border-b border-line py-3">
      <FilterBar search={{ value, onChange }} activeCount={n} onClear={…}>
        <FilterField label="Status"><Select …/></FilterField>
      </FilterBar>
    </CardContent>
    <DataTable rows={…} columns={…} rowKey={…} loading error onRetry empty sort onSortChange
               selectable bulkActions rowActions pagination />
  </Card>
</div>
```

- Detail pages: `usePageBreadcrumbs([{ label: entity.name }])` adds the trailing crumb to the top bar.
- Forms: every control inside `<Field label hint error required>`; two-column layouts via `<FormGrid cols={2}>`.
- Overlays: `Dialog` for create/edit, `Drawer` for detail views, `ActionMenu` for row overflow actions.
- Feedback: `toast` from sonner. Never `alert()` / `confirm()`.
- Destructive actions: `const ok = await useConfirm()({ title, message, consequences: […], destructive: true })`.
  Always state consequences. Use `typeToConfirm` for irreversible, high-impact deletes.
- Status pills: `<StatusBadge status={row.status} />` (registry in `ui/StatusBadge.tsx`; add keys there, not inline maps).
- Money/dates: `formatCurrency`, `formatDate`, `formatDateTime`, `formatTime` from `app/admin/lib/format.ts`;
  date ranges via `DateRangePicker` and `app/admin/lib/dates.ts`.
- Every data view has loading (skeleton), empty and error (with retry) states; `DataTable` and `ChartCard` provide them.
- Keyboard: no `focus:outline-none` without a `focus-visible` ring (`focusRing` from `ui/styles`); no clickable `div`/`tr`
  without keyboard handling (use `DataTable onRowClick`, `Button`, or `Link`). Icon-only controls use `IconButton` (label required).
- Navigation: add pages to `app/admin/lib/nav.ts` only. The sidebar, breadcrumbs, command palette, login redirect and
  permission labels all derive from it.

## Route protection

Wrap authenticated admin pages with `AdminProtectedPage`:

```tsx
<AdminProtectedPage permission="vendors" subject={ADMIN_SUBJECTS.vendors}>
  <PageContent />
</AdminProtectedPage>
```

Super-admin-only routes use `SuperAdminPage` (e.g. Staff & Permissions).

## Data fetching

| Pattern | When to use |
|---------|-------------|
| Redux slice (`app/lib/store/slices/admin*`) | List CRUD with filters persisted in slice (companies, drivers, vendors, vehicles) |
| `apiClient` + local state / hook | Reports, invoicing, expenses, company detail, bookings |

## Shared utilities

- `useDebounce` — `app/lib/hooks/useDebounce.ts`
- `useConfirm` — `app/lib/hooks/useConfirm.ts` (provider mounted in `app/admin/layout.tsx`)
- `cn` — `@/lib/utils`

## Theme

- Light/dark toggle in the top bar and account menu. One key for every portal: `localStorage["cort-portal-theme"]`
  (default light; the old `cort-admin-theme` / `cort-theme` values are migrated once). `usePortalTheme()` (alias
  `useAdminTheme()`) exposes `theme`, `setTheme`, `toggle`; `PortalThemeScript` in `app/layout.tsx` paints before hydration.
- Dark mode uses a neutral graphite palette scoped to design-system portals (`html:not([data-theme="light"]):has(.portal, .admin-portal)`
  in `globals.css`); the vendor portal keeps the shared dark tokens. Chart colours mirror it in `app/ui/chart-theme.ts`.
- The frame (`PortalShell` in `app/ui/shell`) is shared with the company portal: hover/focus-to-expand icon rail that overlays
  the page (no persisted state), mobile drawer, top bar. `AdminShell` only builds the nav groups, account props, bell and ⌘K palette.
- The old `admin-theme.css` dark-mode bridge and `admin-styles.ts` helpers were removed; every page uses the tokens above.

## Known flagged items (not changed on purpose)

- Impersonation is gated on a hard-coded email allowlist (`companies/page.tsx`).
- `tracker-test` ships third-party tracker credentials to the browser.

## Leads

Landing leads use `dashboard` read permission (matches backend `@CrudPermission('dashboard', 'read')`).
