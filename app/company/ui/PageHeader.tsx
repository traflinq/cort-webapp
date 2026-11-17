"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { CompanyLink } from "./link";
import { useSetBreadcrumbs, type Crumb } from "./shell/breadcrumbs";

/** Page container: one max width and vertical rhythm for every company page. */
export function Page({ className, children, wide }: { className?: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={cn("mx-auto flex w-full min-w-0 flex-col gap-5 pb-10 [&>*]:min-w-0", wide ? "max-w-none" : "max-w-[1440px]", className)}>{children}</div>;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** End-aligned page actions. Put the single accent (orange) button last. */
  actions?: React.ReactNode;
  /** Extra crumbs after the nav section, e.g. [{ label: route.name }] on a detail page. */
  breadcrumbs?: Crumb[];
  /** Back link (portal path, e.g. "/company/routes"). */
  backHref?: string;
  /** Badges / meta shown beside the title. */
  meta?: React.ReactNode;
  /** Tabs rendered flush under the header. */
  tabs?: React.ReactNode;
  className?: string;
}

/** Title + description on the start side, actions on the end side; stacks on mobile. */
export function PageHeader({ title, description, actions, breadcrumbs, backHref, meta, tabs, className }: PageHeaderProps) {
  const t = useTranslations("common.ui");
  useSetBreadcrumbs(breadcrumbs);
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-2">
          {backHref && (
            <Button asChild variant="ghost" size="icon-sm" className="-ms-1.5 mt-0.5" aria-label={t("back")}>
              <CompanyLink href={backHref}>
                <ArrowLeft className="rtl:-scale-x-100" aria-hidden="true" />
              </CompanyLink>
            </Button>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
              {meta}
            </div>
            {description && <p className="mt-1 max-w-3xl text-sm text-fg-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs}
    </header>
  );
}
