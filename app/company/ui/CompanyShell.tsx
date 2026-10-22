"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { Button, PortalShell, PortalToaster, ShellBreadcrumbs, usePortalTheme, type Crumb } from "@/app/ui";
import { useAppDispatch, useAppSelector } from "@/app/lib/store/hooks";
import { fetchCompanyFeatures, fetchCompanyProfile, selectCompany, selectCompanyFeatures } from "@/app/lib/store/slices/companySlice";
import { useAuth } from "@/app/lib/contexts/auth-context";
import { getSaudiBasePath, stripSaudiPrefix, withSaudiBase } from "@/app/lib/i18n/saudi-route";
import { useCompanyLocale } from "../lib/locale-context";
import { useCompanyVendors } from "../lib/use-company-vendors";
import { activeCompanyHref, buildCompanyNav, isTrialAllowedPath } from "../lib/nav";
import { TrialOnboardingWalkthrough } from "../components/TrialOnboardingWalkthrough";
import { TrialBanner } from "../components/TrialBanner";
import { ImpersonationBanner } from "../components/ImpersonationBanner";

export function CompanyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/company";
  const normalizedPath = stripSaudiPrefix(pathname);
  if (normalizedPath === "/company/login" || normalizedPath === "/login") return <>{children}</>;
  return <ShellFrame pathname={pathname}>{children}</ShellFrame>;
}

function ShellFrame({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const company = useAppSelector(selectCompany);
  const features = useAppSelector(selectCompanyFeatures);
  const { logout, user } = useAuth();
  const { theme, toggle } = usePortalTheme();
  const { locale, setLocale, isRtl, isSaudiRoute: onSaudiRoute } = useCompanyLocale();
  const t = useTranslations("company");
  const { hasActiveVendors } = useCompanyVendors();
  const [guideOpen, setGuideOpen] = React.useState(false);

  const companyId = user?.company_id ?? null;
  const basePath = getSaudiBasePath(pathname);
  const isTrialUser = !!user?.is_trial;
  const trialModules = user?.trial_modules;

  React.useEffect(() => {
    if (companyId && !company) dispatch(fetchCompanyProfile(String(companyId)));
    if (companyId) dispatch(fetchCompanyFeatures(companyId));
  }, [companyId, company, dispatch]);

  // Trial accounts may only open the pages their modules unlock.
  React.useEffect(() => {
    if (!isTrialUser) return;
    if (!isTrialAllowedPath(pathname, trialModules)) router.replace(withSaudiBase("/company", basePath));
  }, [isTrialUser, pathname, router, trialModules, basePath]);

  const servicesEnabled = React.useMemo(
    () =>
      company?.services_enabled ?? {
        shuttle_enabled: user?.enabled_services?.shuttle ?? false,
        chauffeur_enabled: user?.enabled_services?.chauffeur ?? false,
      },
    [company, user],
  );

  const groups = React.useMemo(
    () => buildCompanyNav({ servicesEnabled, features, hasVendors: hasActiveVendors, isTrial: isTrialUser, trialModules, companyId, basePath, t }),
    [servicesEnabled, features, hasActiveVendors, isTrialUser, trialModules, companyId, basePath, t],
  );
  const activeHref = React.useMemo(() => activeCompanyHref(pathname, groups, basePath), [pathname, groups, basePath]);
  const activeItem = React.useMemo(() => groups.flatMap((g) => g.items).find((i) => i.href === activeHref), [groups, activeHref]);
  const homeHref = withSaudiBase("/company", basePath);

  const crumbs = React.useMemo<Crumb[]>(() => {
    const base: Crumb[] = [{ label: t("nav.dashboard"), href: homeHref }];
    if (activeItem && activeItem.href !== homeHref) base.push({ label: activeItem.label, href: activeItem.href });
    return base;
  }, [t, homeHref, activeItem]);

  const account = user ? { email: user.email, name: user.full_name } : null;

  return (
    <PortalShell
      pathname={pathname}
      groups={groups}
      activeHref={activeHref}
      theme={theme}
      onToggleTheme={toggle}
      user={account}
      roleLabel={company?.name ? `${company.name} · ${t("shell.companyAccount")}` : t("shell.companyAccount")}
      avatarUrl={company?.logo_url}
      footerLabel={company?.name ?? t("shell.companyAccount")}
      homeHref={homeHref}
      homeLabel={t("nav.dashboard")}
      onLogout={() => logout()}
      topBarContent={<ShellBreadcrumbs base={crumbs} />}
      actions={
        onSaudiRoute ? (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Languages />}
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            aria-label={locale === "en" ? t("locale.switchToArabic") : t("locale.switchToEnglish")}
          >
            {locale === "en" ? t("locale.arabic") : t("locale.english")}
          </Button>
        ) : null
      }
      banner={
        <>
          <ImpersonationBanner companyName={company?.name} />
          {isTrialUser && <TrialBanner onOpenGuide={() => setGuideOpen(true)} />}
        </>
      }
      aside={
        <>
          <PortalToaster dir={isRtl ? "rtl" : "ltr"} />
          <React.Suspense fallback={null}>
            <TrialOnboardingWalkthrough forceOpen={guideOpen} onClose={() => setGuideOpen(false)} sidebarCollapsed />
          </React.Suspense>
        </>
      }
      mainProps={{ "data-company-main": "" } as React.HTMLAttributes<HTMLElement>}
    >
      {children}
    </PortalShell>
  );
}
