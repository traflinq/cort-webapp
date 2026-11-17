"use client";

import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { fetchCompanyFeatures, fetchCompanyProfile, selectCompany, selectCompanyFeatures } from "../../lib/store/slices/companySlice";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { getSaudiBasePath, withSaudiBase } from "../../lib/i18n/saudi-route";
import { useCompanyTheme } from "../lib/theme-context";
import { useCompanyLocale } from "../lib/locale-context";
import { activeNavItem, buildCompanyNav, isTrialAllowedPath } from "../lib/nav";
import { TrialOnboardingWalkthrough } from "../components/TrialOnboardingWalkthrough";
import { Button } from "./Button";
import { Alert, Toaster } from "./Feedback";
import { ConfirmProvider } from "./Overlay";
import { TooltipProvider } from "./Tooltip";
import { BreadcrumbsProvider } from "./shell/breadcrumbs";
import { SidebarBrand, SidebarNav } from "./shell/Sidebar";
import { TopBar } from "./shell/TopBar";

const DEMO_BOOKING_URL = "https://calendar.app.google/qeHQgMANfWNr77yz6";
const SIDEBAR_KEY = "cort-company-sidebar";

/* Sidebar collapsed state, persisted across visits. */
const sidebarListeners = new Set<() => void>();
const subscribeSidebar = (l: () => void) => {
  sidebarListeners.add(l);
  return () => {
    sidebarListeners.delete(l);
  };
};
const readSidebar = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
  } catch {
    return false;
  }
};
function writeSidebar(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    /* ignore */
  }
  sidebarListeners.forEach((l) => l());
}

/**
 * Company portal frame: navy rail + top bar (breadcrumbs, theme, language, account) + content.
 * Also owns the portal-wide providers (tooltips, confirm dialog, toasts) and the
 * `.company-portal` class that switches on the Navy rail tokens.
 */
export function CompanyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/company";
  const router = useRouter();
  const dispatch = useAppDispatch();
  const company = useAppSelector(selectCompany);
  const features = useAppSelector(selectCompanyFeatures);
  const { logout, user } = useAuth();
  const { theme, toggle } = useCompanyTheme();
  const { locale, setLocale, isSaudiRoute: onSaudiRoute } = useCompanyLocale();
  const t = useTranslations("company");
  const tUi = useTranslations("common.ui");

  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebar, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasVendors, setHasVendors] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  // Captured once so the trial countdown is stable across renders.
  const [now] = useState(() => Date.now());

  const companyId = user?.company_id;
  const basePath = getSaudiBasePath(pathname);
  const hrefFor = (href: string) => withSaudiBase(href, basePath);

  useEffect(() => {
    if (!companyId) return;
    if (!company) dispatch(fetchCompanyProfile(companyId.toString()));
    dispatch(fetchCompanyFeatures(Number(companyId)));
  }, [companyId, company, dispatch]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    apiClient
      .getCompanyExternalVendors(companyId)
      .then((res) => {
        const data = (res as { data?: unknown })?.data ?? res;
        const active =
          Array.isArray(data) &&
          data.some((l: { is_active?: boolean; external_vendors?: { is_active?: boolean } }) => l.is_active && l.external_vendors?.is_active);
        if (!cancelled) setHasVendors(active);
      })
      .catch(() => {
        if (!cancelled) setHasVendors(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const isTrial = !!user?.is_trial;
  const trialModules = user?.trial_modules;

  useEffect(() => {
    if (isTrial && !isTrialAllowedPath(pathname, trialModules)) {
      router.replace(withSaudiBase("/company", basePath));
    }
  }, [isTrial, pathname, router, trialModules, basePath]);

  const servicesEnabled = useMemo(
    () =>
      company?.services_enabled ?? {
        shuttle_enabled: user?.enabled_services?.shuttle ?? false,
        chauffeur_enabled: user?.enabled_services?.chauffeur ?? false,
      },
    [company, user],
  );

  const groups = useMemo(
    () => buildCompanyNav({ servicesEnabled, features, hasVendors, isTrial, trialModules, companyId }),
    [servicesEnabled, features, hasVendors, isTrial, trialModules, companyId],
  );
  const active = useMemo(() => activeNavItem(groups, pathname), [groups, pathname]);

  const trialHoursLeft =
    user?.is_trial && user.trial_expires_at ? Math.max(0, Math.ceil((new Date(user.trial_expires_at).getTime() - now) / 3_600_000)) : null;

  return (
    <TooltipProvider>
      <ConfirmProvider>
        <BreadcrumbsProvider>
          <div className="company-portal flex min-h-dvh bg-page text-fg">
            <a
              href="#company-main"
              className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[90] focus:rounded-md focus:bg-action focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-action"
            >
              {tUi("skipToContent")}
            </a>

            {/* Desktop rail */}
            <aside
              className={cn(
                "sticky top-0 z-40 hidden h-dvh shrink-0 flex-col bg-rail transition-[width] duration-200 md:flex",
                collapsed ? "w-16" : "w-60",
              )}
            >
              <SidebarBrand collapsed={collapsed} href={hrefFor("/company")} />
              <SidebarNav groups={groups} activeHref={active?.item.href ?? null} collapsed={collapsed} hrefFor={hrefFor} />
            </aside>

            {/* Mobile navigation drawer */}
            <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-overlay data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out md:hidden" />
                <DialogPrimitive.Content
                  aria-describedby={undefined}
                  className="co-sheet-start fixed inset-y-0 start-0 z-[61] flex w-72 max-w-[85vw] flex-col bg-rail outline-none data-[state=open]:animate-sheet-in-left data-[state=closed]:animate-sheet-out-left md:hidden"
                >
                  <DialogPrimitive.Title className="sr-only">{tUi("navigation")}</DialogPrimitive.Title>
                  <div className="relative">
                    <SidebarBrand href={hrefFor("/company")} />
                    <DialogPrimitive.Close
                      aria-label={tUi("closeMenu")}
                      className="absolute end-3 top-3 flex size-8 cursor-pointer items-center justify-center rounded-md text-rail-fg outline-none hover:bg-rail-hover hover:text-rail-strong focus-visible:ring-2 focus-visible:ring-rail-strong/70"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </DialogPrimitive.Close>
                  </div>
                  <SidebarNav groups={groups} activeHref={active?.item.href ?? null} hrefFor={hrefFor} onNavigate={() => setMobileOpen(false)} />
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>

            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar
                section={active ? { label: t(active.item.labelKey), href: active.item.href } : null}
                collapsed={collapsed}
                onToggleCollapsed={() => writeSidebar(!collapsed)}
                onOpenMobileNav={() => setMobileOpen(true)}
                theme={theme}
                onToggleTheme={toggle}
                locale={
                  onSaudiRoute
                    ? {
                        current: locale,
                        nextLabel: locale === "en" ? t("locale.arabic") : t("locale.english"),
                        onToggle: () => setLocale(locale === "en" ? "ar" : "en"),
                      }
                    : null
                }
                user={{ email: user?.email, companyName: company?.name, logoUrl: company?.logo_url }}
                onSignOut={() => logout()}
              />

              <Suspense fallback={null}>
                <TrialOnboardingWalkthrough forceOpen={guideOpen} onClose={() => setGuideOpen(false)} sidebarCollapsed={collapsed} />
              </Suspense>

              <main id="company-main" data-company-main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
                {trialHoursLeft !== null && (
                  <Alert
                    tone="brand"
                    title={t("trial.banner.title")}
                    className="mx-auto mb-5 max-w-[1440px]"
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        {!user?.trial_onboarding_completed && (
                          <Button variant="ghost" size="sm" onClick={() => setGuideOpen(true)}>
                            {t("trial.banner.viewGuide")}
                          </Button>
                        )}
                        <Button asChild variant="accent" size="sm">
                          <a href={DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer">
                            {t("trial.banner.bookDemo")}
                          </a>
                        </Button>
                      </div>
                    }
                  >
                    {t.rich("trial.banner.expires", {
                      hours: () => <strong className="font-semibold text-fg">{trialHoursLeft}h</strong>,
                    })}
                  </Alert>
                )}
                {children}
              </main>
            </div>

            <Toaster />
          </div>
        </BreadcrumbsProvider>
      </ConfirmProvider>
    </TooltipProvider>
  );
}
