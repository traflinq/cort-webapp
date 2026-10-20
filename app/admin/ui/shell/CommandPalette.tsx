"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Building2, Car, CornerDownLeft, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "../Dialog";
import { Spinner } from "../Spinner";
import { apiClient } from "../../../lib/services/api-client";
import type { NavItem, NavViewer } from "../../lib/nav";
import { navGroupFor } from "../../lib/nav";

type EntityHit = { id: string | number; title: string; subtitle?: string; href: string };

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
  viewer: NavViewer;
}

const itemCls =
  "flex cursor-pointer select-none items-center gap-3 rounded-md px-2 py-2 text-sm text-fg outline-none data-[selected=true]:bg-subtle [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted";

/**
 * ⌘K palette: jumps to pages (filtered client-side) and searches companies, drivers and
 * vehicles through the existing list endpoints (permission-gated, debounced, 5 each).
 */
export function CommandPalette({ open, onOpenChange, items, viewer }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [hits, setHits] = React.useState<{ companies: EntityHit[]; drivers: EntityHit[]; vehicles: EntityHit[] }>({ companies: [], drivers: [], vehicles: [] });
  const requestId = React.useRef(0);

  const canCompanies = viewer.isSuperAdmin || viewer.hasPermission("companies");
  const canDrivers = viewer.isSuperAdmin || viewer.hasPermission("drivers");
  const canVehicles = viewer.isSuperAdmin || viewer.hasPermission("vehicles");

  // Reset on close (render-time adjustment, not an effect).
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setQuery("");
      setHits({ companies: [], drivers: [], vehicles: [] });
    }
  }

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || (!canCompanies && !canDrivers && !canVehicles)) {
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const [c, d, v] = await Promise.allSettled([
        canCompanies ? apiClient.getCompanies({ search: q, limit: 5 }) : Promise.resolve(null),
        canDrivers ? apiClient.getDrivers({ search: q, limit: 5 }) : Promise.resolve(null),
        canVehicles ? apiClient.getVehicles({ search: q, limit: 5 }) : Promise.resolve(null),
      ]);
      if (id !== requestId.current) return;
      const rows = <T,>(r: PromiseSettledResult<{ data?: { data?: T[] } } | null>): T[] =>
        r.status === "fulfilled" && r.value ? (r.value.data?.data ?? []) : [];
      setHits({
        companies: rows<{ id: number; name: string; email?: string }>(c).map((x) => ({ id: x.id, title: x.name || `Company #${x.id}`, subtitle: x.email, href: `/admin/companies/${x.id}` })),
        drivers: rows<{ id: string; full_name: string; email?: string; phone?: string | null }>(d).map((x) => ({ id: x.id, title: x.full_name, subtitle: x.phone || x.email, href: `/admin/drivers?q=${encodeURIComponent(x.full_name)}` })),
        vehicles: rows<{ id: number; plate_number: string; make: string; model: string }>(v).map((x) => ({ id: x.id, title: x.plate_number, subtitle: `${x.make} ${x.model}`.trim(), href: `/admin/vehicles?q=${encodeURIComponent(x.plate_number)}` })),
      });
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, canCompanies, canDrivers, canVehicles]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const q = query.trim().toLowerCase();
  const pages = React.useMemo(() => {
    if (!q) return items;
    return items.filter((i) => {
      const group = navGroupFor(i)?.label ?? "";
      const hay = [i.label, i.description ?? "", group, ...(i.keywords ?? [])].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, q]);

  const hasEntityHits = hits.companies.length + hits.drivers.length + hits.vehicles.length > 0;
  const searching = q.length >= 2 && (canCompanies || canDrivers || canVehicles);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        hideHeader
        hideClose
        flush
        scrollable={false}
        title="Search"
        className="top-[10vh] max-h-[80vh] -translate-y-0 overflow-hidden p-0 data-[state=open]:animate-overlay-in sm:top-[14vh]"
      >
        <Command label="Search pages and records" shouldFilter={false} loop>
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, companies, drivers, plates…"
              className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-placeholder"
            />
            {loading && <Spinner size="sm" label="Searching" />}
          </div>
          <Command.List className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
            <Command.Empty className="py-10 text-center text-sm text-fg-muted">
              {searching && loading ? "Searching…" : "No results."}
            </Command.Empty>

            {pages.length > 0 && (
              <Command.Group heading="Pages" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-muted">
                {pages.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item key={item.href} value={`page:${item.href}`} onSelect={() => go(item.href)} className={itemCls}>
                      <Icon />
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="text-xs text-fg-muted">{navGroupFor(item)?.label}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {hasEntityHits && (
              <>
                {hits.companies.length > 0 && (
                  <EntityGroup heading="Companies" icon={<Building2 />} hits={hits.companies} onSelect={go} />
                )}
                {hits.drivers.length > 0 && <EntityGroup heading="Drivers" icon={<Users />} hits={hits.drivers} onSelect={go} />}
                {hits.vehicles.length > 0 && <EntityGroup heading="Vehicles" icon={<Car />} hits={hits.vehicles} onSelect={go} />}
              </>
            )}
          </Command.List>
          <div className="flex items-center gap-4 border-t border-line px-3 py-2 text-[11px] text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-subtle px-1 font-mono">↑↓</kbd> navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-subtle px-1 font-mono">
                <CornerDownLeft className="inline size-3" aria-hidden="true" />
              </kbd>{" "}
              open
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-subtle px-1 font-mono">esc</kbd> close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function EntityGroup({ heading, icon, hits, onSelect }: { heading: string; icon: React.ReactNode; hits: EntityHit[]; onSelect: (href: string) => void }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-muted"
    >
      {hits.map((h) => (
        <Command.Item key={`${heading}-${h.id}`} value={`${heading}:${h.id}`} onSelect={() => onSelect(h.href)} className={cn(itemCls)}>
          {icon}
          <span className="min-w-0 flex-1">
            <span className="block truncate">{h.title}</span>
            {h.subtitle && <span className="block truncate text-xs text-fg-muted">{h.subtitle}</span>}
          </span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}
