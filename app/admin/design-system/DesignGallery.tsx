"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import {
  Building2,
  Car,
  CreditCard,
  Download,
  Eye,
  KeyRound,
  Mail,
  Moon,
  Pencil,
  Plus,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { SuperAdminPage } from "../components/SuperAdminPage";
import { useAdminTheme } from "../lib/theme-context";
import { useConfirm } from "../../lib/hooks/useConfirm";
import { toast } from "sonner";
import {
  ActionMenu,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  ChartCard,
  ChartLegend,
  ChartTooltip,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DateRangePicker,
  Dialog,
  DialogContent,
  DialogTrigger,
  Drawer,
  DrawerContent,
  DrawerTrigger,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  FilterField,
  FormGrid,
  IconButton,
  InlineError,
  Input,
  KpiCard,
  KpiGrid,
  PageHeader,
  SectionHeader,
  Select,
  StatusBadge,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  axisProps,
  gridProps,
  sortRows,
  useChartTheme,
  type BadgeTone,
  type DateRange,
  type SortState,
} from "../ui";
import { formatCurrency, formatDate, formatNumber } from "../lib/format";
import { currentMonthRange } from "../lib/dates";

/* ── PLACEHOLDER DATA (gallery only; not from the API) ─────────────────── */
type Row = { id: number; company: string; contact: string; services: string[]; users: number; status: string; balance: number; updated: string };
const PLACEHOLDER_ROWS: Row[] = [
  { id: 1, company: "Acme Logistics (placeholder)", contact: "ops@acme.example", services: ["Shuttle", "Chauffeur"], users: 142, status: "ACTIVE", balance: 1250000, updated: "2026-10-18T09:12:00Z" },
  { id: 2, company: "Northwind Traders (placeholder)", contact: "fleet@northwind.example", services: ["Shuttle"], users: 58, status: "TRIAL", balance: 0, updated: "2026-10-17T14:30:00Z" },
  { id: 3, company: "Globex Corp (placeholder)", contact: "admin@globex.example", services: ["Chauffeur"], users: 23, status: "INACTIVE", balance: 42000, updated: "2026-09-30T08:00:00Z" },
  { id: 4, company: "Initech (placeholder)", contact: "mobility@initech.example", services: [], users: 0, status: "SUSPENDED", balance: 310500, updated: "2026-10-01T11:45:00Z" },
  { id: 5, company: "Umbrella Health (placeholder)", contact: "transport@umbrella.example", services: ["Shuttle", "Chauffeur"], users: 390, status: "ACTIVE", balance: 2890000, updated: "2026-10-19T16:05:00Z" },
];
const PLACEHOLDER_SERIES = Array.from({ length: 12 }, (_, i) => ({
  month: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"][i],
  revenue: 2_000_000 + Math.round(Math.sin(i / 2) * 400_000 + i * 120_000),
  cogs: 1_300_000 + Math.round(Math.cos(i / 2) * 250_000 + i * 70_000),
}));
const TONES: BadgeTone[] = ["neutral", "brand", "success", "warning", "danger", "info", "purple"];

export function DesignGallery() {
  return (
    <SuperAdminPage>
      <GalleryContent />
    </SuperAdminPage>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <SectionHeader title={title} description={description} />
      {children}
    </section>
  );
}

export function GalleryContent() {
  const { theme, toggle } = useAdminTheme();
  const confirm = useConfirm();
  const chart = useChartTheme();

  const [sort, setSort] = React.useState<SortState | null>({ key: "company", dir: "asc" });
  const [selected, setSelected] = React.useState<Array<string | number>>([]);
  const [tableState, setTableState] = React.useState<"data" | "loading" | "empty" | "error">("data");
  const [page, setPage] = React.useState(1);
  const [range, setRange] = React.useState<DateRange | null>(currentMonthRange());
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [switchOn, setSwitchOn] = React.useState(true);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());

  const rows = React.useMemo(() => {
    const filtered = PLACEHOLDER_ROWS.filter(
      (r) => (!search || r.company.toLowerCase().includes(search.toLowerCase())) && (!status || r.status === status),
    );
    return sortRows(filtered, sort, (r, k) => (r as unknown as Record<string, unknown>)[k]);
  }, [search, status, sort]);

  const activeFilters = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl space-y-12 pb-24">
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Design system" }]}
        title="Design system"
        description="Every admin primitive in one place. Data on this page is placeholder data for review only."
        meta={
          <>
            <Badge tone="brand" dot>
              Phase 2
            </Badge>
            <Badge tone="neutral">dev only</Badge>
          </>
        }
        actions={
          <>
            <Button variant="outline" leftIcon={theme === "dark" ? <Sun /> : <Moon />} onClick={(e) => toggle({ x: e.clientX, y: e.clientY })}>
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </Button>
            <Button leftIcon={<Plus />} onClick={() => toast.success("Saved", { description: "Example success toast" })}>
              Primary action
            </Button>
          </>
        }
      />

      <nav aria-label="Sections" className="flex flex-wrap gap-2 text-xs">
        {["tokens", "buttons", "forms", "badges", "tabs", "overlays", "states", "kpis", "charts", "table"].map((s) => (
          <a key={s} href={`#${s}`} className="rounded-md border border-line bg-card px-2 py-1 text-fg-secondary hover:text-fg">
            {s}
          </a>
        ))}
      </nav>

      <Section id="tokens" title="Tokens" description="Semantic tones (ink / soft / line), surfaces, chart palette. All values live in globals.css.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TONES.map((t) => (
            <Badge key={t} tone={t} className="h-10 justify-center text-sm">
              {t}
            </Badge>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {chart.colors.map((c, i) => (
            <div key={c} className="rounded-lg border border-line bg-card p-3">
              <div className="h-8 rounded-md" style={{ background: c }} />
              <p className="mt-2 font-mono text-[11px] text-fg-muted">
                chart-{i + 1} · {c}
              </p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["page", "bg-page"],
            ["card", "bg-card"],
            ["subtle", "bg-subtle"],
            ["elevated", "bg-elevated"],
            ["row-hover", "bg-row-hover"],
            ["brand-soft", "bg-brand-soft"],
          ].map(([name, cls]) => (
            <div key={name} className={`rounded-lg border border-line p-3 text-xs ${cls}`}>
              <span className="text-fg">{name}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-baseline gap-6 rounded-2xl border border-line bg-card p-5">
          <span className="text-2xl font-semibold tracking-tight">Display 24/600</span>
          <span className="text-xl font-semibold">H1 20/600</span>
          <span className="text-base font-semibold">H2 16/600</span>
          <span className="text-sm">Body 14/400</span>
          <span className="text-xs text-fg-muted">Small 12 muted</span>
          <span className="font-mono text-[13px] tabular-nums">MONO ABC-1234</span>
        </div>
      </Section>

      <Section id="buttons" title="Buttons" description="Variants × sizes, loading, icon-only with mandatory labels and tooltips.">
        <Card padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="danger-outline">Danger outline</Button>
            <Button variant="link">Link</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" leftIcon={<Plus />}>
              Small
            </Button>
            <Button size="md" leftIcon={<Plus />}>
              Medium
            </Button>
            <Button size="lg" leftIcon={<Plus />}>
              Large
            </Button>
            <IconButton label="Edit">
              <Pencil />
            </IconButton>
            <IconButton label="Download" variant="outline">
              <Download />
            </IconButton>
            <IconButton label="Delete" variant="danger-outline" size="icon-sm">
              <Trash2 />
            </IconButton>
            <Tooltip content="Tooltips are supplementary; the button still has a label.">
              <Button variant="outline">Hover or focus me</Button>
            </Tooltip>
          </div>
        </Card>
      </Section>

      <Section id="forms" title="Forms" description="Field wires label, hint and error to the control (htmlFor, aria-describedby, aria-invalid).">
        <Card padding="lg">
          <FormGrid cols={2}>
            <Field label="Company name" required hint="Shown on invoices.">
              <Input placeholder="Acme Logistics" />
            </Field>
            <Field label="Billing email" error="Enter a valid email address.">
              <Input type="email" defaultValue="not-an-email" leftIcon={<Mail />} />
            </Field>
            <Field label="Service">
              <Select placeholder="Select a service">
                <option value="shuttle">Shuttle</option>
                <option value="chauffeur">Chauffeur</option>
              </Select>
            </Field>
            <Field label="Contract start">
              <Input type="date" />
            </Field>
            <Field label="Vehicle plate" hint="Monospace for identifiers.">
              <Input mono placeholder="LEA-1234" />
            </Field>
            <Field label="Disabled">
              <Input disabled value="Read only" readOnly />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea placeholder="Internal notes…" />
            </Field>
            <div className="space-y-3 sm:col-span-2">
              <Checkbox label="Send welcome email" description="Credentials are included in the email." defaultChecked />
              <Checkbox label="Indeterminate" checked="indeterminate" />
              <Switch label="Shuttle service" description="Enables route planning for this company." checked={switchOn} onCheckedChange={setSwitchOn} />
              <Switch aria-label="Compact toggle" size="sm" defaultChecked />
            </div>
          </FormGrid>
        </Card>
      </Section>

      <Section id="badges" title="Badges & status" description="StatusBadge reads one registry; never colour alone.">
        <Card padding="lg" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <Badge key={t} tone={t}>
                {t}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <Badge key={t} tone={t} variant="outline" dot>
                {t}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <Badge key={t} tone={t} variant="solid" size="sm">
                {t}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "PAID", "OVERDUE", "TRIAL", "ONLINE", "OFFLINE", "SOMETHING_NEW"].map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
        </Card>
      </Section>

      <Section id="tabs" title="Tabs" description="Underline (page-level) and pills (in-card). Arrow keys move between tabs.">
        <Card padding="lg" className="space-y-6">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all" count={128}>
                All
              </TabsTrigger>
              <TabsTrigger value="shuttle" count={64} icon={<Users />}>
                Shuttle
              </TabsTrigger>
              <TabsTrigger value="chauffeur" count={52} icon={<Car />}>
                Chauffeur
              </TabsTrigger>
              <TabsTrigger value="pending" count={12}>
                Pending
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="text-sm text-fg-muted">
              All drivers (placeholder).
            </TabsContent>
            <TabsContent value="shuttle" className="text-sm text-fg-muted">
              Shuttle drivers (placeholder).
            </TabsContent>
            <TabsContent value="chauffeur" className="text-sm text-fg-muted">
              Chauffeur drivers (placeholder).
            </TabsContent>
            <TabsContent value="pending" className="text-sm text-fg-muted">
              Pending applications (placeholder).
            </TabsContent>
          </Tabs>
          <Tabs defaultValue="week">
            <TabsList variant="pills">
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </Card>
      </Section>

      <Section id="overlays" title="Overlays" description="Dialog, Drawer, ActionMenu, ConfirmDialog (consequences + type-to-confirm), toasts.">
        <Card padding="lg" className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent
              title="Edit company"
              description="Changes apply immediately."
              footer={
                <>
                  <Button variant="outline">Cancel</Button>
                  <Button>Save changes</Button>
                </>
              }
            >
              <FormGrid cols={2}>
                <Field label="Name">
                  <Input defaultValue="Acme Logistics (placeholder)" />
                </Field>
                <Field label="Contact">
                  <Input defaultValue="ops@acme.example" />
                </Field>
              </FormGrid>
            </DialogContent>
          </Dialog>

          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">Open drawer</Button>
            </DrawerTrigger>
            <DrawerContent
              title="Booking #4821 (placeholder)"
              description="Chauffeur · 18 Oct 2026"
              headerExtra={
                <>
                  <StatusBadge status="IN_PROGRESS" />
                  <Badge tone="info">Acme Logistics</Badge>
                </>
              }
              footer={
                <>
                  <Button variant="outline">Close</Button>
                  <Button>Assign driver</Button>
                </>
              }
            >
              <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
                <dt className="text-fg-muted">Pickup</dt>
                <dd>DHA Phase 5, Lahore</dd>
                <dt className="text-fg-muted">Drop-off</dt>
                <dd>Allama Iqbal Intl Airport</dd>
                <dt className="text-fg-muted">Fare</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(8500)}</dd>
              </dl>
            </DrawerContent>
          </Drawer>

          <ActionMenu
            trigger={<Button variant="outline">Row actions menu</Button>}
            items={[
              { label: "View", icon: <Eye />, onSelect: () => toast("View") },
              { label: "Edit", icon: <Pencil />, onSelect: () => toast("Edit") },
              { label: "Reset password", icon: <KeyRound />, onSelect: () => toast("Reset") },
              { label: "Delete", icon: <Trash2 />, destructive: true, separatorBefore: true, onSelect: () => setConfirmOpen(true) },
            ]}
          />

          <Button
            variant="danger-outline"
            onClick={async () => {
              const ok = await confirm({
                title: "Delete Acme Logistics?",
                message: "This permanently deletes the company and cannot be undone.",
                consequences: ["142 employee accounts lose access immediately", "Open bookings and invoices are detached from the company", "Audit history is kept"],
                destructive: true,
                confirmLabel: "Delete company",
              });
              toast(ok ? "Confirmed (placeholder)" : "Cancelled");
            }}
          >
            useConfirm() with consequences
          </Button>

          <Button variant="outline" onClick={() => toast.error("Could not save", { description: "Example error toast" })}>
            Error toast
          </Button>
          <Button variant="outline" onClick={() => toast.warning("Fuel price changed", { description: "Example warning toast" })}>
            Warning toast
          </Button>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            destructive
            title="Delete this company?"
            message="Type the company name to confirm."
            consequences={["All employees are deactivated", "This cannot be undone"]}
            typeToConfirm="Acme"
            onConfirm={() => {
              setConfirmOpen(false);
              toast.success("Deleted (placeholder)");
            }}
          />
        </Card>
      </Section>

      <Section id="states" title="States" description="Every data view has loading, empty and error.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <EmptyState title="No vehicles yet" description="Add your first vehicle to start tracking fuel and maintenance." action={<Button size="sm" leftIcon={<Plus />}>Add vehicle</Button>} />
          </Card>
          <Card>
            <ErrorState message="Request failed with status 502" onRetry={() => toast("Retrying…")} />
          </Card>
          <Card padding="lg" className="space-y-3">
            <InlineError>Could not load fuel price. Showing last known value.</InlineError>
            <KpiCard loading label="" value="" />
          </Card>
        </div>
      </Section>

      <Section id="kpis" title="KPI cards" description="Delta direction + colour + sr-only text; optional sparkline and drill-down.">
        <KpiGrid cols={4}>
          <KpiCard label="Total revenue" value={formatCurrency(24_500_000, { compact: true })} delta={{ value: 12.4, label: "vs last month" }} icon={<CreditCard />} tone="brand" sparkline={[3, 4, 3.5, 5, 6, 5.5, 7]} />
          <KpiCard label="Total COGS" value={formatCurrency(15_200_000, { compact: true })} delta={{ value: 8.1, label: "vs last month", invert: true }} icon={<Car />} tone="neutral" sparkline={[5, 5.2, 5.1, 5.6, 5.9, 6.2, 6.4]} />
          <KpiCard label="Unassigned bookings" value="7" hint="Need a driver today" icon={<Users />} tone="danger" emphasis="danger" href="/admin/bookings/pending" />
          <KpiCard label="Active companies" value="38" delta={{ value: 0 }} icon={<Building2 />} tone="info" onClick={() => toast("Drill-down")} />
        </KpiGrid>
      </Section>

      <Section id="charts" title="Charts" description="Recharts with the validated palette; legend + table fallback; time-range control in the header.">
        <ChartCard
          title="Revenue vs COGS"
          description="Monthly, PKR (placeholder data)"
          actions={<DateRangePicker value={range} onChange={setRange} allowClear />}
          legend={
            <ChartLegend
              items={[
                { label: "Revenue", color: chart.colors[0] },
                { label: "COGS", color: chart.colors[1], style: "dashed" },
              ]}
            />
          }
          height={260}
          table={
            <table className="w-full text-xs">
              <thead className="text-left text-fg-muted">
                <tr>
                  <th className="py-1">Month</th>
                  <th className="py-1 text-right">Revenue</th>
                  <th className="py-1 text-right">COGS</th>
                </tr>
              </thead>
              <tbody>
                {PLACEHOLDER_SERIES.map((r) => (
                  <tr key={r.month} className="border-t border-line">
                    <td className="py-1">{r.month}</td>
                    <td className="py-1 text-right font-mono tabular-nums">{formatCurrency(r.revenue)}</td>
                    <td className="py-1 text-right font-mono tabular-nums">{formatCurrency(r.cogs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={PLACEHOLDER_SERIES} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="g-rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chart.colors[0]} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={chart.colors[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps(chart)} />
              <XAxis dataKey="month" {...axisProps(chart)} />
              <YAxis {...axisProps(chart)} width={44} tickFormatter={(v: number) => formatNumber(v, { compact: true, digits: 1 })} />
              <RTooltip content={<ChartTooltip formatter={(v) => formatCurrency(Number(v))} />} cursor={{ stroke: chart.axis, strokeWidth: 1 }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={chart.colors[0]} strokeWidth={2} fill="url(#g-rev)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: chart.surface }} isAnimationActive={false} />
              <Area type="monotone" dataKey="cogs" name="COGS" stroke={chart.colors[1]} strokeWidth={2} strokeDasharray="4 3" fill="transparent" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: chart.surface }} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      <Section id="table" title="DataTable" description="Sort (aria-sort), select + bulk bar, row actions menu, expandable rows, keyboard row click, states, pagination.">
        <Card>
          <CardHeader title="Companies (placeholder)" description={`${rows.length} rows`} actions={
            <Select width="auto" aria-label="Table state" value={tableState} onChange={(e) => setTableState(e.target.value as typeof tableState)} className="h-8 text-xs">
              <option value="data">State: data</option>
              <option value="loading">State: loading</option>
              <option value="empty">State: empty</option>
              <option value="error">State: error</option>
            </Select>
          } />
          <CardContent className="border-b border-line py-3">
            <FilterBar
              search={{ value: search, onChange: setSearch, placeholder: "Search companies…" }}
              activeCount={activeFilters}
              onClear={() => {
                setSearch("");
                setStatus("");
              }}
              actions={
                <Button size="sm" leftIcon={<Plus />}>
                  Add company
                </Button>
              }
            >
              <FilterField label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Any" className="h-8 text-xs">
                  <option value="ACTIVE">Active</option>
                  <option value="TRIAL">Trial</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </Select>
              </FilterField>
              <FilterField label="Updated">
                <DateRangePicker value={range} onChange={setRange} size="sm" allowClear />
              </FilterField>
            </FilterBar>
          </CardContent>
          <DataTable<Row>
            caption="Companies"
            rows={tableState === "data" ? rows : []}
            rowKey={(r) => r.id}
            loading={tableState === "loading"}
            error={tableState === "error" ? "The server returned 500 (placeholder)" : null}
            onRetry={() => setTableState("data")}
            empty={{ title: "No companies match", description: "Try clearing the filters.", action: <Button size="sm" variant="outline" onClick={() => { setSearch(""); setStatus(""); }}>Clear filters</Button> }}
            sort={sort}
            onSortChange={setSort}
            selectable
            selectedKeys={selected}
            onSelectedKeysChange={setSelected}
            isRowSelectable={(r) => r.status !== "SUSPENDED"}
            bulkActions={(keys, clear) => (
              <>
                <Button size="sm" variant="outline" onClick={() => { toast.success(`Exported ${keys.length}`); clear(); }} leftIcon={<Download />}>
                  Export
                </Button>
                <Button size="sm" variant="danger-outline" onClick={() => toast(`Would suspend ${keys.length}`)}>
                  Suspend
                </Button>
              </>
            )}
            expandable={{
              isExpanded: (r) => expanded.has(r.id),
              onToggle: (r) =>
                setExpanded((s) => {
                  const n = new Set(s);
                  if (n.has(r.id)) n.delete(r.id);
                  else n.add(r.id);
                  return n;
                }),
              render: (r) => <div className="px-6 py-3 text-xs text-fg-muted">Expanded details for {r.company}. Contact {r.contact}.</div>,
            }}
            onRowClick={(r) => toast(`Open ${r.company}`)}
            rowActions={(r) => [
              { label: "View", icon: <Eye />, href: "#table" },
              { label: "Edit", icon: <Pencil />, onSelect: () => toast(`Edit ${r.company}`) },
              { label: "Reset password", icon: <KeyRound />, onSelect: () => toast("Reset") },
              { label: "Delete", icon: <Trash2 />, destructive: true, separatorBefore: true, disabled: r.status === "SUSPENDED", onSelect: () => setConfirmOpen(true) },
            ]}
            columns={[
              {
                key: "company",
                header: "Company",
                sortable: true,
                cell: (r) => (
                  <div className="min-w-0">
                    <div className="font-medium text-fg">{r.company}</div>
                    <div className="truncate text-xs text-fg-muted">{r.contact}</div>
                  </div>
                ),
              },
              {
                key: "services",
                header: "Services",
                hideBelow: "md",
                cell: (r) =>
                  r.services.length ? (
                    <div className="flex flex-wrap gap-1">
                      {r.services.map((s) => (
                        <StatusBadge key={s} status={s} dot={false} size="sm" />
                      ))}
                    </div>
                  ) : (
                    <span className="text-fg-muted">—</span>
                  ),
              },
              { key: "users", header: "Users", sortable: true, align: "right", mono: true, hideBelow: "sm", cell: (r) => r.users },
              { key: "balance", header: "Balance", sortable: true, align: "right", mono: true, cell: (r) => formatCurrency(r.balance) },
              { key: "status", header: "Status", sortable: true, cell: (r) => <StatusBadge status={r.status} /> },
              { key: "updated", header: "Updated", sortable: true, hideBelow: "lg", cell: (r) => <span className="text-fg-muted">{formatDate(r.updated)}</span> },
            ]}
            pagination={{ page, totalPages: 12, total: 118, pageSize: 10, onPageChange: setPage, onPageSizeChange: () => undefined }}
          />
        </Card>
      </Section>
    </div>
  );
}
