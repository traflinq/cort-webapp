import type { TrialModules } from "@/app/lib/types/auth-types";
import type { CompanyFeature, CompanyFeatureKey } from "@/app/lib/services/types/multi-mode";

/**
 * What the logged-in company may see and do in the company portal.
 *
 * Every rule that depends on the company's services, feature flags, vendor links or trial is written
 * here once. Pages, the sidebar and the page guard read these values; they never look at feature
 * keys or `services_enabled` themselves, so a rule change is made in one place.
 */

/** Company IDs for which the Invoices page is temporarily hidden. */
const HIDE_INVOICING_COMPANY_IDS = new Set<number>([2]);

export interface AccessInput {
  companyId: number;
  services: { shuttle: boolean; chauffeur: boolean };
  features: readonly Pick<CompanyFeature, "feature_key" | "is_enabled">[];
  /** The company has at least one active link to an active external vendor. */
  hasVendors: boolean;
  /** Set for a trial account. Older trial accounts have no modules and are pool-only. */
  trial: { modules: TrialModules | undefined } | null;
}

export interface CompanyAccess {
  companyId: number;
  services: { shuttle: boolean; chauffeur: boolean };
  /** Modules of a trial account; null for a regular company. */
  trial: { pool: boolean; shuttle: boolean } | null;
  hasVendors: boolean;
  has: (key: CompanyFeatureKey) => boolean;
  can: {
    /** Run the company's own chauffeur cars and drivers. */
    selfManageChauffeur: boolean;
    /** Run the company's own shuttles: create and edit routes, stops and shuttle drivers. */
    selfManageShuttle: boolean;
    /** The Pool fleet page (own cars and drivers for either service). */
    poolFleet: boolean;
    analytics: boolean;
    aiInsights: boolean;
    invoicing: boolean;
  };
}

export function buildAccess(input: AccessInput): CompanyAccess {
  const enabled = new Set(input.features.filter((f) => f.is_enabled).map((f) => f.feature_key));
  const has = (key: CompanyFeatureKey) => enabled.has(key);
  const modules = input.trial?.modules;
  const trial = input.trial
    ? { pool: modules === "pool" || modules === "both" || !modules, shuttle: modules === "shuttle" || modules === "both" }
    : null;
  const { shuttle, chauffeur } = input.services;

  // A trial account gets the self-managed tools of its modules; a company needs the service and its feature.
  const selfManageChauffeur = trial ? trial.pool : chauffeur && has("chauffeur_self_managed");
  const selfManageShuttle = trial ? trial.shuttle : shuttle && has("shuttle_self_managed");

  return {
    companyId: input.companyId,
    services: { shuttle, chauffeur },
    trial,
    hasVendors: input.hasVendors,
    has,
    can: {
      selfManageChauffeur,
      selfManageShuttle,
      poolFleet: selfManageChauffeur || selfManageShuttle,
      analytics: !trial && (shuttle || chauffeur),
      aiInsights: has("ai_insights"),
      invoicing:
        !trial &&
        !HIDE_INVOICING_COMPANY_IDS.has(input.companyId) &&
        (has("chauffeur_cort_managed") || has("shuttle_cort_managed")),
    },
  };
}

export type ChauffeurFulfilment = "CORT_MANAGED" | "EXTERNAL_VENDOR" | "SELF_MANAGED";

/** Ways a chauffeur booking can be fulfilled for this company, in the order the form offers them. */
export function chauffeurFulfilments(access: CompanyAccess): ChauffeurFulfilment[] {
  const modes: ChauffeurFulfilment[] = [];
  if (access.has("chauffeur_cort_managed")) modes.push("CORT_MANAGED");
  if (access.has("chauffeur_external_vendor")) modes.push("EXTERNAL_VENDOR");
  if (access.has("chauffeur_self_managed")) modes.push("SELF_MANAGED");
  return modes;
}
