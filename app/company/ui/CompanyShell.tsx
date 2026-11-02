"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useMemo, useState, useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { fetchCompanyProfile, fetchCompanyFeatures, selectCompany, selectCompanyFeatures } from "../../lib/store/slices/companySlice";
import { apiClient } from "../../lib/services/api-client";
import {
  LayoutDashboard,
  Users,
  Map,
  Calendar,
  FileBarChart,
  FileSpreadsheet,
  Receipt,
  ChevronDown,
  LogOut,
  Menu,
  Car,
  BarChart2,
  Building2,
  Sun,
  Moon,
  Languages,
  MoreHorizontal,
  BookOpen,
} from "lucide-react";
import { useAuth } from "../../lib/contexts/auth-context";
import type { TrialModules } from "../../lib/types/auth-types";
import { useCompanyTheme } from "../lib/theme-context";
import { useCompanyLocale } from "../lib/locale-context";
import { getSaudiBasePath, stripSaudiPrefix, withSaudiBase } from "../../lib/i18n/saudi-route";
import { Toaster } from "sonner";
import { TrialOnboardingWalkthrough } from "../components/TrialOnboardingWalkthrough";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../../admin/ui/DropdownMenu";
import { Drawer, DrawerContent } from "../../admin/ui/Drawer";
import { IconCircleButton } from "./IconCircleButton";
import { pillClasses } from "./PillButton";

type ServicesEnabled = { shuttle_enabled: boolean; chauffeur_enabled: boolean };
type FeatureLike = { feature_key: string; is_enabled: boolean };

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

const TRIAL_FLEET_PREFIXES = ["/company/fleet"];
const TRIAL_POOL_PREFIXES = ["/company/bookings"];
const TRIAL_SHUTTLE_PREFIXES = ["/company/routes", "/company/employees"];

/** Company IDs for which the Invoices nav tab is temporarily hidden. */
export const HIDE_INVOICING_COMPANY_IDS = new Set<number>([
  2,
]);

function trialHasPool(modules?: TrialModules): boolean {
  return modules === "pool" || modules === "both" || !modules;
}

function trialHasShuttle(modules?: TrialModules): boolean {
  return modules === "shuttle" || modules === "both";
}

function isTrialAllowedPath(pathname: string, modules?: TrialModules): boolean {
  const normalized = stripSaudiPrefix(pathname);
  if (normalized === "/company") return true;
  const prefixes: string[] = [...TRIAL_FLEET_PREFIXES];
  if (trialHasPool(modules)) prefixes.push(...TRIAL_POOL_PREFIXES);
  if (trialHasShuttle(modules)) prefixes.push(...TRIAL_SHUTTLE_PREFIXES);
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** How many nav items fit as pills before the rest move into "More". */
const NAV_QUERIES: Array<[string, number]> = [
  ["(min-width: 1680px)", 7],
  ["(min-width: 1536px)", 5],
  ["(min-width: 1280px)", 4],
];

function subscribeToNavQueries(onChange: () => void) {
  const lists = NAV_QUERIES.map(([q]) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", onChange));
  return () => lists.forEach((l) => l.removeEventListener("change", onChange));
}

function readVisibleNavCount() {
  return NAV_QUERIES.find(([q]) => window.matchMedia(q).matches)?.[1] ?? 3;
}

function useVisibleNavCount() {
  return useSyncExternalStore(subscribeToNavQueries, readVisibleNavCount, () => 4);
}

export function CompanyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const company = useAppSelector(selectCompany);
  const { logout, user } = useAuth();
  const { theme, toggle } = useCompanyTheme();
  const { locale, setLocale, isRtl, isSaudiRoute: onSaudiRoute } = useCompanyLocale();
  const t = useTranslations("company");
  const tCommon = useTranslations("common");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasVendors, setHasVendors] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const features = useAppSelector(selectCompanyFeatures);
  const companyId = user?.company_id?.toString();
  const basePath = getSaudiBasePath(pathname);
  const normalizedPath = pathname ? stripSaudiPrefix(pathname) : "/company";

  const buildNavGroups = useMemo(() => {
    return (
      servicesEnabled: ServicesEnabled,
      featureList: FeatureLike[],
      vendors = false,
      isTrial = false,
      trialModules?: TrialModules,
      currentCompanyId?: number | null,
    ) => {
      if (isTrial) {
        const items: NavItem[] = [
          { href: withSaudiBase("/company", basePath), labelKey: "nav.dashboard", icon: LayoutDashboard },
        ];
        if (trialHasPool(trialModules) || trialHasShuttle(trialModules)) {
          items.push({ href: withSaudiBase("/company/fleet", basePath), labelKey: "nav.poolFleet", icon: Car });
        }
        if (trialHasPool(trialModules)) {
          items.push({ href: withSaudiBase("/company/bookings", basePath), labelKey: "nav.bookings", icon: Calendar });
        }
        if (trialHasShuttle(trialModules)) {
          items.push({ href: withSaudiBase("/company/routes", basePath), labelKey: "nav.routeRoster", icon: Map });
          items.push({ href: withSaudiBase("/company/employees", basePath), labelKey: "nav.employees", icon: Users });
        }
        return [{ titleKey: "", items }];
      }

      const hasFeature = (key: string) => featureList.find((f) => f.feature_key === key)?.is_enabled ?? false;
      const hideInvoicing = currentCompanyId != null && HIDE_INVOICING_COMPANY_IDS.has(currentCompanyId);

      const adminItems: NavItem[] = [
        { href: withSaudiBase("/company/employees", basePath), labelKey: "nav.employees", icon: Users },
      ];
      if (vendors) {
        adminItems.push({ href: withSaudiBase("/company/vendors", basePath), labelKey: "nav.vendors", icon: Building2 });
      }

      const groups: { titleKey: string; items: NavItem[] }[] = [
        {
          titleKey: "",
          items: [{ href: withSaudiBase("/company", basePath), labelKey: "nav.dashboard", icon: LayoutDashboard }],
        },
        { titleKey: "nav.operations", items: [] },
        { titleKey: "nav.administration", items: adminItems },
      ];

      if (servicesEnabled.shuttle_enabled) {
        groups[1].items.push({ href: withSaudiBase("/company/routes", basePath), labelKey: "nav.routeRoster", icon: Map });
      }
      if (servicesEnabled.chauffeur_enabled) {
        groups[1].items.push({ href: withSaudiBase("/company/bookings", basePath), labelKey: "nav.bookings", icon: Calendar });
      }
      if (servicesEnabled.shuttle_enabled) {
        groups[1].items.push({ href: withSaudiBase("/company/reports/shuttle", basePath), labelKey: "nav.shuttleReports", icon: FileBarChart });
      }
      if (servicesEnabled.chauffeur_enabled) {
        groups[1].items.push({ href: withSaudiBase("/company/reports/chauffeur", basePath), labelKey: "nav.chauffeurReports", icon: FileSpreadsheet });
      }
      if ((servicesEnabled.chauffeur_enabled && hasFeature("chauffeur_self_managed"))
        || (servicesEnabled.shuttle_enabled && hasFeature("shuttle_self_managed"))) {
        groups[1].items.push({ href: withSaudiBase("/company/fleet", basePath), labelKey: "nav.poolFleet", icon: Car });
      }
      if (servicesEnabled.shuttle_enabled || servicesEnabled.chauffeur_enabled) {
        groups[1].items.push({ href: withSaudiBase("/company/fleet-analytics", basePath), labelKey: "nav.fleetAnalytics", icon: BarChart2 });
      }
      if (
        !hideInvoicing
        && (hasFeature("chauffeur_cort_managed") || hasFeature("shuttle_cort_managed"))
      ) {
        groups[2].items.push({ href: withSaudiBase("/company/invoicing", basePath), labelKey: "nav.invoices", icon: Receipt });
      }

      return groups.filter((g) => g.items.length > 0);
    };
  }, [basePath]);

  useEffect(() => {
    if (companyId && !company) {
      dispatch(fetchCompanyProfile(companyId));
    }
    if (companyId) {
      dispatch(fetchCompanyFeatures(Number(companyId)));
    }
  }, [companyId, company, dispatch]);

  useEffect(() => {
    if (!user?.company_id) return;
    apiClient.getCompanyExternalVendors(user.company_id)
      .then((res: { data?: unknown }) => {
        const data = (res as { data?: unknown })?.data ?? res;
        setHasVendors(Array.isArray(data) && data.some((l: { is_active?: boolean; external_vendors?: { is_active?: boolean } }) => l.is_active && l.external_vendors?.is_active));
      })
      .catch(() => setHasVendors(false));
  }, [user?.company_id]);

  const isTrialUser = !!user?.is_trial;
  const trialModules = user?.trial_modules;

  useEffect(() => {
    if (!isTrialUser || !pathname) return;
    if (!isTrialAllowedPath(pathname, trialModules)) {
      router.replace(withSaudiBase("/company", basePath));
    }
  }, [isTrialUser, pathname, router, trialModules, basePath]);

  const servicesEnabled = useMemo(() => {
    if (company?.services_enabled) {
      return company.services_enabled;
    }
    return {
      shuttle_enabled: user?.enabled_services?.shuttle ?? false,
      chauffeur_enabled: user?.enabled_services?.chauffeur ?? false,
    };
  }, [company, user]);

  const isLogin =
    normalizedPath === "/company/login" ||
    normalizedPath === "/login";
  const navGroups = buildNavGroups(servicesEnabled, features, hasVendors, isTrialUser, trialModules, user?.company_id);
  const navItems = navGroups.flatMap((g) => g.items);
  const visibleNavCount = useVisibleNavCount();

  const activeHref = useMemo(() => {
    const allItems = navGroups.flatMap((g) => g.items);
    const found = allItems.find((n) => normalizedPath === stripSaudiPrefix(n.href));
    if (found) return found.href;
    const prefix = allItems.find(
      (n) => stripSaudiPrefix(n.href) !== "/company" && normalizedPath.startsWith(stripSaudiPrefix(n.href)),
    );
    return prefix?.href ?? withSaudiBase("/company", basePath);
  }, [normalizedPath, navGroups, basePath]);

  const trialInfo = useMemo(() => {
    if (!user?.is_trial || !user.trial_expires_at) return null;
    const expiresAtMs = new Date(user.trial_expires_at).getTime();
    const remainingMs = expiresAtMs - Date.now();
    const remainingHours = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));
    return { expiresAtMs, remainingHours };
  }, [user?.is_trial, user?.trial_expires_at]);

  if (isLogin) return <>{children}</>;

  // Keep "More" from holding a single item: show it as a pill instead.
  const pillCount = navItems.length - visibleNavCount === 1 ? navItems.length : visibleNavCount;
  const pillItems = navItems.slice(0, pillCount);
  const overflowItems = navItems.slice(pillCount);
  const activeOverflow = overflowItems.find((item) => item.href === activeHref);

  const accountName = user?.full_name || user?.email || "";
  const accountInitial = (company?.name || accountName || "?").trim()[0]?.toUpperCase();
  const showGuide = isTrialUser && !user?.trial_onboarding_completed;

  const navPill = (active: boolean) =>
    cx(
      "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-5 text-[15px] transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]",
      active
        ? "border-transparent bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] ps-4"
        : "border-[var(--nav-border)] text-[var(--nav-inactive-text)] hover:bg-[var(--nav-hover-bg)]",
    );

  const localeButton = onSaudiRoute ? (
    <button
      type="button"
      onClick={() => setLocale(locale === "en" ? "ar" : "en")}
      title={locale === "en" ? t("locale.switchToArabic") : t("locale.switchToEnglish")}
      className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-[var(--bg-card)] px-4 text-sm text-[var(--text-primary)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--bg-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      <Languages size={18} strokeWidth={1.6} />
      <span>{locale === "en" ? t("locale.arabic") : t("locale.english")}</span>
    </button>
  ) : null;

  const themeButton = (
    <IconCircleButton
      label={theme === "dark" ? t("shell.switchToLight") : t("shell.switchToDark")}
      onClick={toggle}
    >
      {theme === "dark" ? <Sun strokeWidth={1.6} /> : <Moon strokeWidth={1.6} />}
    </IconCircleButton>
  );

  const avatar = company?.logo_url ? (
    <img src={company.logo_url} alt={company.name || "Company"} className="size-11 shrink-0 rounded-full bg-[var(--tile-bg)] object-cover" />
  ) : (
    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--cort-orange)] text-base font-medium text-white">
      {accountInitial || <Users size={16} />}
    </span>
  );

  const accountMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-14 min-w-0 items-center gap-3 rounded-full bg-[var(--bg-card)] p-1.5 text-start shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--bg-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:pe-4"
        >
          {avatar}
          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="max-w-[160px] truncate text-[15px] text-[var(--text-primary)]">{accountName}</span>
            <span className="max-w-[160px] truncate text-xs text-[var(--text-muted)]">{company?.name || t("shell.companyAccount")}</span>
          </span>
          <ChevronDown size={18} strokeWidth={1.6} className="ms-1 hidden text-[var(--text-primary)] sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[15rem] rounded-2xl p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5">
          <div className="truncate text-sm font-medium text-[var(--text-primary)]">{accountName}</div>
          <div className="truncate text-xs font-normal text-[var(--text-muted)] ltr-content">{user?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showGuide && (
          <DropdownMenuItem onSelect={() => setGuideOpen(true)}>
            <BookOpen />
            {t("trial.banner.viewGuide")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={toggle}>
          {theme === "dark" ? <Sun /> : <Moon />}
          {theme === "dark" ? t("shell.switchToLight") : t("shell.switchToDark")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => logout()}>
          <LogOut />
          {tCommon("actions.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const logo = (
    <Link href={withSaudiBase("/company", basePath)} className="flex h-14 shrink-0 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
      <img
        src={theme === "light" ? "/traflinq_light_no_tagline-Photoroom.png" : "/traflinq_dark_no_tagline-Photoroom.png"}
        alt="TrafLinq"
        className="h-10 w-auto object-contain sm:h-11"
      />
    </Link>
  );

  return (
    <div className="company-portal min-h-screen bg-[var(--header-strip)] text-[var(--text-primary)] font-sans">
      <div className="flex min-h-screen flex-col bg-[var(--header-strip)]">
        <header className="relative z-30 flex items-center gap-3 px-3 pt-3 sm:px-5 lg:items-stretch lg:gap-5 lg:px-6 lg:pt-4">
          <IconCircleButton
            label={t("shell.openMenu")}
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden"
          >
            <Menu strokeWidth={1.6} />
          </IconCircleButton>

          <div className="flex min-w-0 items-center lg:pb-4">{logo}</div>

          {/* Nav "tab": the canvas rises into the header behind the pills. */}
          <nav
            aria-label={t("shell.mainNavigation")}
            className="relative hidden min-w-0 items-center gap-2.5 rounded-t-[28px] bg-[var(--canvas)] px-3 pb-4 pt-3 lg:flex"
          >
            <span aria-hidden className="company-notch company-notch-start" />
            <span aria-hidden className="company-notch company-notch-end" />
            {pillItems.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={navPill(active)}>
                  {active && <Icon size={18} strokeWidth={1.8} />}
                  {t(item.labelKey)}
                </Link>
              );
            })}
            {overflowItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={navPill(!!activeOverflow)}>
                    {activeOverflow ? (
                      <>
                        <activeOverflow.icon size={18} strokeWidth={1.8} />
                        {t(activeOverflow.labelKey)}
                      </>
                    ) : (
                      <>
                        <MoreHorizontal size={18} strokeWidth={1.8} />
                        {t("shell.more")}
                      </>
                    )}
                    <ChevronDown size={16} strokeWidth={1.8} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[14rem] rounded-2xl p-1.5">
                  {overflowItems.map((item) => {
                    const Icon = item.icon;
                    const active = item.href === activeHref;
                    return (
                      <DropdownMenuItem key={item.href} asChild className={cx("rounded-xl px-3 py-2.5", active && "bg-[var(--bg-subtle)] font-medium")}>
                        <Link href={item.href} aria-current={active ? "page" : undefined}>
                          <Icon />
                          {t(item.labelKey)}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-2 sm:gap-3 lg:pb-4">
            <div className="hidden sm:block">{localeButton}</div>
            <div className="hidden sm:block">{themeButton}</div>
            {accountMenu}
          </div>
        </header>

        <Drawer open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <DrawerContent side={isRtl ? "right" : "left"} size="sm" hideHeader title={t("shell.mainNavigation")} className="company-drawer bg-[var(--header-strip)]" flush>
            <div className="flex h-full flex-col gap-6 p-5">
              <div className="flex items-center justify-between">{logo}</div>
              <nav aria-label={t("shell.mainNavigation")} className="flex flex-col gap-2">
                {navItems.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cx(navPill(active), "w-full justify-start ps-4")}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto flex items-center gap-3 sm:hidden">
                {localeButton}
                {themeButton}
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <Suspense fallback={null}>
            <TrialOnboardingWalkthrough
              forceOpen={guideOpen}
              onClose={() => setGuideOpen(false)}
            />
          </Suspense>
          <main
            data-company-main
            className="w-full min-w-0 flex-1 rounded-t-[28px] bg-[var(--canvas)] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          >
            {trialInfo && (
              <div className="mb-6 flex flex-col gap-3 rounded-[var(--radius-card)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="text-base font-medium">{t("trial.banner.title")}</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {t.rich("trial.banner.expires", {
                      hours: () => <span className="font-medium text-[var(--cort-orange)]">{trialInfo.remainingHours}h</span>,
                    })}
                  </div>
                  {!user?.trial_onboarding_completed && (
                    <button
                      type="button"
                      onClick={() => setGuideOpen(true)}
                      className="w-fit text-start text-sm font-medium text-[var(--cort-orange)] hover:underline"
                    >
                      {t("trial.banner.viewGuide")}
                    </button>
                  )}
                </div>
                <a
                  href="https://calendar.app.google/qeHQgMANfWNr77yz6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={pillClasses("primary", "sm")}
                >
                  {t("trial.banner.bookDemo")}
                </a>
              </div>
            )}
            <div key={pathname} className="page-transition-enter min-h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Toaster position={isRtl ? "top-left" : "top-right"} richColors dir={isRtl ? "rtl" : "ltr"} />
    </div>
  );
}
