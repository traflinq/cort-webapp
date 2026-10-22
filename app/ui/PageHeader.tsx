"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiLabels } from "./lib/labels";
import { focusRing } from "./styles";
import { buttonVariants } from "./Button";

export interface Crumb {
  label: React.ReactNode;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {last ? (
                <span aria-current="page" className="font-medium text-fg-secondary">
                  {c.label}
                </span>
              ) : c.href ? (
                <Link href={c.href} className={cn("rounded px-0.5 hover:text-fg", focusRing)}>
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
              {!last && <ChevronRight className="size-3 opacity-60 rtl:-scale-x-100" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  /** Back link (detail pages). */
  back?: { href: string; label?: string };
  /** Right-aligned actions. */
  actions?: React.ReactNode;
  /** Badges / meta line under the title. */
  meta?: React.ReactNode;
  /** Tabs rendered below the header. */
  tabs?: React.ReactNode;
  className?: string;
}

/** The one page header. Breadcrumbs · back · title · description · meta · actions · tabs. */
export function PageHeader({ title, description, breadcrumbs, back, actions, meta, tabs, className }: PageHeaderProps) {
  const L = useUiLabels();
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {back && (
            <Link href={back.href} aria-label={back.label ?? L.back} className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "mt-0.5 shrink-0")}>
              <ArrowLeft className="rtl:-scale-x-100" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
            {description && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p>}
            {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>
      {tabs}
    </header>
  );
}

/** In-page section heading. */
export function SectionHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
