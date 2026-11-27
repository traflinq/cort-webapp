"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/lib/contexts/auth-context";
import { UserRole } from "@/app/lib/types/auth-types";
import { useAppDispatch, useAppSelector } from "@/app/lib/store/hooks";
import {
  fetchCompanyFeatures,
  fetchCompanyHasVendors,
  fetchCompanyProfile,
  invalidateCompanyCache,
  selectCompanyResources,
  type Company,
  type Loadable,
} from "@/app/lib/store/slices/companySlice";
import { buildAccess, type CompanyAccess } from "./access";

export type CompanyAccessState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "no-company" }
  | { status: "ready"; access: CompanyAccess; company: Company };

const AccessContext = createContext<{ state: CompanyAccessState; retry: () => void } | null>(null);

/** Feature flags and vendor links can be read by these roles; for anyone else both count as "none". */
const READS_COMPANY_CONFIG = new Set<UserRole>([UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]);

/**
 * Loads what the access rules need for the logged-in company and exposes the result. It is "ready"
 * only once every input belongs to this company, so nothing is drawn from a guess or from a
 * previous login. Data is revalidated on navigation (the store skips fresh copies) and a refresh
 * keeps the current answer on screen.
 */
export function CompanyAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const resources = useAppSelector(selectCompanyResources);
  const companyId = user?.company_id ?? null;
  const readsConfig = !!user && READS_COMPANY_CONFIG.has(user.role);

  const load = useCallback(() => {
    if (!companyId) return;
    dispatch(fetchCompanyProfile(companyId));
    if (readsConfig) {
      dispatch(fetchCompanyFeatures(companyId));
      dispatch(fetchCompanyHasVendors(companyId));
    }
  }, [companyId, readsConfig, dispatch]);

  useEffect(() => {
    load();
  }, [load, pathname]);

  const retry = useCallback(() => {
    dispatch(invalidateCompanyCache());
    load();
  }, [dispatch, load]);

  const state = useMemo<CompanyAccessState>(() => {
    if (!user || !companyId) return { status: "no-company" };
    const own = <T,>(r: Loadable<T>): T | null => (r.companyId === companyId ? r.data : null);
    const profile = own(resources.profile);
    const features = readsConfig ? own(resources.features) : [];
    const hasVendors = readsConfig ? own(resources.hasVendors) : false;

    if (profile && features && hasVendors !== null) {
      const access = buildAccess({
        companyId,
        services: { shuttle: profile.services_enabled.shuttle_enabled, chauffeur: profile.services_enabled.chauffeur_enabled },
        features,
        hasVendors,
        trial: user.is_trial ? { modules: user.trial_modules } : null,
      });
      return { status: "ready", access, company: profile };
    }

    const needed: Loadable<unknown>[] = readsConfig ? [resources.profile, resources.features, resources.hasVendors] : [resources.profile];
    const failed = needed.find((r) => r.status === "failed" && r.requestedFor === companyId && r.companyId !== companyId);
    return failed ? { status: "error", message: failed.error ?? "" } : { status: "loading" };
  }, [user, companyId, readsConfig, resources]);

  const value = useMemo(() => ({ state, retry }), [state, retry]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

/** Access state for the shell and the page gate, which draw loading and error states themselves. */
export function useCompanyAccessState() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useCompanyAccessState must be used inside CompanyAccessProvider");
  return ctx;
}

/**
 * The company's access and profile. Pages are rendered only after the gate has them, so inside a
 * company page this always returns data; pages never need their own loading branch for it.
 */
export function useCompanyAccess(): { access: CompanyAccess; company: Company } {
  const { state } = useCompanyAccessState();
  if (state.status !== "ready") throw new Error("useCompanyAccess is only available inside CompanyAccessGate");
  return { access: state.access, company: state.company };
}
