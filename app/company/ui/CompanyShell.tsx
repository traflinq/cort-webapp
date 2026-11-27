"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Languages, LogOut, Menu, Moon, PanelLeft, Sun } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Button, IconButton, Tooltip, focusRing } from "@/app/admin/ui";
import { useAuth } from "../../lib/contexts/auth-context";
import { useCompanyTheme } from "../lib/theme-context";
import { useCompanyLocale } from "../lib/locale-context";
import { useCompanyAccessState } from "../lib/access-context";
import { companyNav } from "../lib/pages";
import { getSaudiBasePath, stripSaudiPrefix, withSaudiBase } from "../../lib/i18n/saudi-route";
import { TrialOnboardingWalkthrough } from "../components/TrialOnboardingWalkthrough";
import { CompanyAccessGate } from "./CompanyAccessGate";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

export function CompanyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { theme, toggle } = useCompanyTheme();
  const { locale, setLocale, isRtl, isSaudiRoute: onSaudiRoute } = useCompanyLocale();
  const t = useTranslations("company");
  const tCommon = useTranslations("common");
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const { state: accessState } = useCompanyAccessState();
  const company = accessState.status === "ready" ? accessState.company : null;
  const basePath = getSaudiBasePath(pathname);
  const normalizedPath = pathname ? stripSaudiPrefix(pathname) : "/company";

  // Sidebar entries come from the page table, so they match what the page guard lets through.
  const navGroups = useMemo<{ titleKey: string; items: NavItem[] }[]>(
    () =>
      accessState.status === "ready"
        ? companyNav(accessState.access).map((g) => ({
            titleKey: g.titleKey,
            items: g.pages.map((p) => ({ href: withSaudiBase(p.path, basePath), labelKey: p.nav!.labelKey, icon: p.nav!.icon })),
          }))
        : [],
    [accessState, basePath],
  );

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

  const isLogin =
    normalizedPath === "/company/login" ||
    normalizedPath === "/login";
  if (isLogin) return <>{children}</>;

  const toggleLocale = () => setLocale(locale === "en" ? "ar" : "en");
  const localeTitle = locale === "en" ? t("locale.switchToArabic") : t("locale.switchToEnglish");
  const localeLabel = locale === "en" ? t("locale.arabic") : t("locale.english");
  const themeLabel = theme === "dark" ? t("shell.switchToLight") : t("shell.switchToDark");
  const wordmark = theme === "light" ? "/traflinq_light_no_tagline-Photoroom.png" : "/traflinq_dark_no_tagline-Photoroom.png";

  // Plain render function (not a component) so the sidebar isn't remounted on every render.
  const renderSidebar = (isMobile = false) => {
    const compact = collapsed && !isMobile;
    return (
      <>
        <div className={cn("flex h-16 shrink-0 items-center", compact ? "justify-center px-2" : "justify-between gap-2 ps-5 pe-3")}>
          {compact ? (
            // Collapsed: the app icon doubles as the expand control (panel icon shows on hover/focus).
            <Tooltip content={t("shell.expandSidebar")} side={isRtl ? "left" : "right"}>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label={t("shell.expandSidebar")}
                aria-expanded={false}
                className={cn("group relative flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-subtle hover:text-fg", focusRing)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/app_icon.png" alt="" className="size-8 rounded-lg object-contain transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0" />
                <PanelLeft size={18} strokeWidth={1.75} className="absolute opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 rtl:-scale-x-100" aria-hidden="true" />
              </button>
            </Tooltip>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wordmark} alt="TrafLinq" className="h-9 w-auto min-w-0 object-contain" />
              <IconButton
                label={isMobile ? tCommon("actions.close") : t("shell.collapseSidebar")}
                tooltip={false}
                size="icon-sm"
                aria-expanded={true}
                onClick={() => (isMobile ? setIsMobileMenuOpen(false) : setCollapsed(true))}
                className="shrink-0 text-fg-muted hover:text-fg"
              >
                <PanelLeft strokeWidth={1.75} className="rtl:-scale-x-100" />
              </IconButton>
            </>
          )}
        </div>

        <nav
          className={cn("flex-1 overflow-y-auto overflow-x-hidden pb-4", compact ? "px-2" : "px-3")}
          aria-busy={accessState.status === "loading"}
        >
          {accessState.status === "loading" && (
            <div className="space-y-1.5 pt-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-subtle" />
              ))}
            </div>
          )}
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className={cn(groupIndex > 0 && (compact ? "mt-3 border-t border-line pt-3" : "mt-5"))}>
              {group.titleKey && !compact && (
                <div className="mb-1 truncate px-2.5 text-start text-xs font-medium text-fg-muted">
                  {t(group.titleKey)}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  const label = t(item.labelKey);
                  const link = (
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={compact ? label : undefined}
                      onClick={() => isMobile && setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-lg text-sm font-medium transition-colors",
                        compact ? "justify-center px-0" : "px-2.5",
                        active ? "bg-nav-active text-nav-active-fg shadow-[var(--nav-active-shadow)]" : "text-fg-secondary hover:bg-subtle hover:text-fg",
                        focusRing,
                      )}
                    >
                      <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                      {!compact && <span className="truncate">{label}</span>}
                    </Link>
                  );
                  return (
                    <li key={item.href}>
                      {compact ? (
                        <Tooltip content={label} side={isRtl ? "left" : "right"}>
                          {link}
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <div className={cn("flex items-center gap-2", compact ? "flex-col" : "justify-between")}>
            <div className="flex min-w-0 items-center gap-2.5">
              {company?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logo_url}
                  alt={company.name || "Company"}
                  className="size-8 shrink-0 rounded-full border border-line object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-subtle text-xs font-semibold text-fg-secondary"
                >
                  {company?.name?.[0]?.toUpperCase() || "·"}
                </div>
              )}
              {!compact && (
                <div className="flex min-w-0 flex-col text-start">
                  <span className="ltr-content truncate text-xs font-medium text-fg">{user?.email}</span>
                  <span className="truncate text-xs text-fg-muted">{t("shell.companyAccount")}</span>
                </div>
              )}
            </div>

            {!compact && (
              <div className="flex shrink-0 items-center">
                {onSaudiRoute && (
                  <Tooltip content={localeTitle}>
                    <Button variant="ghost" size="sm" onClick={toggleLocale} leftIcon={<Languages />}>
                      {localeLabel}
                    </Button>
                  </Tooltip>
                )}
                <IconButton label={themeLabel} size="icon-sm" onClick={toggle}>
                  {theme === "dark" ? <Sun /> : <Moon />}
                </IconButton>
                <IconButton
                  label={tCommon("actions.signOut")}
                  size="icon-sm"
                  onClick={() => logout()}
                  className="hover:bg-danger-soft hover:text-danger-ink"
                >
                  <LogOut className="rtl:rotate-180" />
                </IconButton>
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="company-portal min-h-screen bg-[var(--bg-sidebar)] font-sans text-fg">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-[var(--bg-header)] px-4 md:hidden">
        <IconButton label={t("shell.openMenu")} tooltip={false} onClick={() => setIsMobileMenuOpen(true)}>
          <Menu />
        </IconButton>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wordmark}
          alt="TrafLinq"
          className="pointer-events-none absolute inset-x-0 mx-auto h-8 w-auto"
        />
        {onSaudiRoute ? (
          <Button variant="ghost" size="sm" onClick={toggleLocale} title={localeTitle}>
            {localeLabel}
          </Button>
        ) : (
          <div className="size-9" />
        )}
      </header>

      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 z-20 hidden h-screen shrink-0 flex-col bg-[var(--bg-sidebar)] transition-[width] duration-200 ease-out md:flex",
            collapsed ? "w-16" : "w-60",
          )}
        >
          {renderSidebar()}
        </aside>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-overlay animate-fade-in"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative flex w-full max-w-xs flex-1 flex-col border-e border-line bg-[var(--bg-sidebar)] shadow-[var(--shadow-modal)] animate-slide-in-left">
              {renderSidebar(true)}
            </div>
          </div>
        )}

        {/* Inset layout: the content is a rounded panel on the sidebar-coloured frame (desktop only). */}
        <div className="relative flex min-w-0 flex-1 flex-col md:py-2 md:pe-2">
          <Suspense fallback={null}>
            <TrialOnboardingWalkthrough
              forceOpen={guideOpen}
              onClose={() => setGuideOpen(false)}
              sidebarCollapsed={collapsed}
            />
          </Suspense>
          <main
            data-company-main
            className="mx-auto min-h-screen w-full max-w-full flex-1 bg-page px-4 py-5 md:min-h-[calc(100vh-1rem)] md:rounded-2xl md:border md:border-line md:px-8 md:py-6"
          >
            {trialInfo && (
              <div className="mb-5 flex flex-col gap-3 rounded-xl border border-line bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="text-sm font-semibold text-fg">{t("trial.banner.title")}</div>
                  <div className="text-xs text-fg-muted">
                    {t.rich("trial.banner.expires", {
                      hours: () => <span className="font-semibold tabular-nums text-fg">{trialInfo.remainingHours}h</span>,
                    })}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!user?.trial_onboarding_completed && (
                    <Button variant="ghost" size="sm" onClick={() => setGuideOpen(true)}>
                      {t("trial.banner.viewGuide")}
                    </Button>
                  )}
                  <Button asChild size="sm">
                    <a href="https://calendar.app.google/qeHQgMANfWNr77yz6" target="_blank" rel="noopener noreferrer">
                      {t("trial.banner.bookDemo")}
                    </a>
                  </Button>
                </div>
              </div>
            )}
            <div key={pathname} className="min-h-full">
              <CompanyAccessGate>{children}</CompanyAccessGate>
            </div>
          </main>
        </div>
      </div>
      <Toaster position={isRtl ? "top-left" : "top-right"} richColors dir={isRtl ? "rtl" : "ltr"} />
    </div>
  );
}
