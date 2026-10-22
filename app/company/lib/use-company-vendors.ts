"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { apiClient } from "@/app/lib/services/api-client";
import { useAuth } from "@/app/lib/contexts/auth-context";

export interface CompanyVendorLink {
  id: number;
  vendor_id: number;
  company_id: number;
  serves_chauffeur: boolean;
  serves_shuttle: boolean;
  is_active: boolean;
  external_vendors: {
    id: number;
    name: string;
    contact_email: string;
    contact_phone: string | null;
    is_active: boolean;
  };
}

type State = { companyId: number | null; links: CompanyVendorLink[]; loading: boolean; error: string | null; loaded: boolean };

let state: State = { companyId: null, links: [], loading: false, error: null, loaded: false };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function load(companyId: number, force = false): Promise<void> {
  if (!force && state.companyId === companyId && (state.loaded || inflight)) return inflight ?? Promise.resolve();
  emit({ companyId, loading: true, error: null, loaded: false });
  inflight = apiClient
    .getCompanyExternalVendors(companyId)
    .then((res: unknown) => {
      const data = (res as { data?: CompanyVendorLink[] })?.data ?? res;
      emit({ links: Array.isArray(data) ? (data as CompanyVendorLink[]) : [], loading: false, loaded: true });
    })
    .catch((e: { message?: string }) => emit({ links: [], loading: false, loaded: true, error: e?.message ?? "Failed to load vendors" }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function isActiveVendorLink(l: CompanyVendorLink): boolean {
  return !!l.is_active && !!l.external_vendors?.is_active;
}

/**
 * The company's external vendor links, fetched once per company and shared by the shell
 * (nav gating), the Vendors page and the booking form.
 */
export function useCompanyVendors() {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;
  const snap = useSyncExternalStore(subscribe, () => state, () => state);

  useEffect(() => {
    if (companyId) void load(companyId);
  }, [companyId]);

  const refresh = useCallback(() => (companyId ? load(companyId, true) : Promise.resolve()), [companyId]);
  const links = snap.companyId === companyId ? snap.links : [];

  return {
    links,
    hasActiveVendors: links.some(isActiveVendorLink),
    loading: snap.companyId === companyId ? snap.loading || !snap.loaded : true,
    error: snap.companyId === companyId ? snap.error : null,
    refresh,
  };
}
