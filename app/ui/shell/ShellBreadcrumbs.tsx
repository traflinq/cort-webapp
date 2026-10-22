"use client";

import * as React from "react";
import { Breadcrumbs, type Crumb } from "../PageHeader";
import { useBreadcrumbContext } from "./breadcrumbs-context";

/** Top-bar breadcrumbs: the portal's base crumbs plus whatever the page registered via usePageBreadcrumbs. */
export function ShellBreadcrumbs({ base }: { base: Crumb[] }) {
  const { extra } = useBreadcrumbContext();
  const items = React.useMemo(() => [...base, ...(extra ?? [])], [base, extra]);
  if (items.length < 2) return null;
  return <Breadcrumbs items={items} />;
}
