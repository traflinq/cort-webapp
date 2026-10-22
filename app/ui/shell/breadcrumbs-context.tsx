"use client";

import * as React from "react";
import type { Crumb } from "../PageHeader";

type Ctx = {
  extra: Crumb[] | null;
  setExtra: (crumbs: Crumb[] | null) => void;
};

const BreadcrumbContext = React.createContext<Ctx>({ extra: null, setExtra: () => {} });

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [extra, setExtra] = React.useState<Crumb[] | null>(null);
  const value = React.useMemo(() => ({ extra, setExtra }), [extra]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export const useBreadcrumbContext = () => React.useContext(BreadcrumbContext);

/**
 * Detail pages call this to append entity-specific crumbs to the top bar,
 * e.g. usePageBreadcrumbs([{ label: company.name }]). Cleared on unmount.
 */
export function usePageBreadcrumbs(crumbs: Crumb[] | null) {
  const { setExtra } = useBreadcrumbContext();
  const key = JSON.stringify(crumbs?.map((c) => [typeof c.label === "string" ? c.label : "", c.href ?? ""]) ?? null);
  React.useEffect(() => {
    setExtra(crumbs);
    return () => setExtra(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setExtra]);
}
