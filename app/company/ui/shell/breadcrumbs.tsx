"use client";

import * as React from "react";

export type Crumb = { label: string; href?: string };

const Ctx = React.createContext<{ crumbs: Crumb[]; set: (crumbs: Crumb[]) => void }>({ crumbs: [], set: () => {} });

export function BreadcrumbsProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, set] = React.useState<Crumb[]>([]);
  const value = React.useMemo(() => ({ crumbs, set }), [crumbs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePageCrumbs = () => React.useContext(Ctx).crumbs;

/** Detail pages add crumbs after the nav section (the top bar renders them). Cleared on unmount. */
export function useSetBreadcrumbs(crumbs: Crumb[] | undefined) {
  const { set } = React.useContext(Ctx);
  // Serialised so the effect only re-runs when the visible trail changes, not on every new array.
  const serialised = JSON.stringify(crumbs ?? []);
  React.useEffect(() => {
    set(JSON.parse(serialised) as Crumb[]);
    return () => set([]);
  }, [serialised, set]);
}
