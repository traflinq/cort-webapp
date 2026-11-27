"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Sun,
  Moon,
  Languages,
} from "lucide-react";
import { useAuth } from "../../lib/contexts/auth-context";
import { useCompanyTheme } from "../lib/theme-context";
import { useCompanyLocale } from "../lib/locale-context";
import { useCompanyAccessState } from "../lib/access-context";
import { companyNav } from "../lib/pages";
import { getSaudiBasePath, stripSaudiPrefix, withSaudiBase } from "../../lib/i18n/saudi-route";
import { Toaster } from "sonner";
import { TrialOnboardingWalkthrough } from "../components/TrialOnboardingWalkthrough";
import { CompanyAccessGate } from "./CompanyAccessGate";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

  const SidebarContent = ({ isMobile = false }) => (
    <>
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className={cx("flex flex-col gap-6 transition-all duration-300", (collapsed && !isMobile) ? "items-center py-8 px-2" : "items-center px-6 py-10")}>
          <div className="relative h-14 w-full flex items-center justify-center transition-all duration-300">
            <img
              src={
                collapsed && !isMobile
                  ? "/app_icon.png"
                  : theme === "light"
                    ? "/traflinq_light_no_tagline-Photoroom.png"
                    : "/traflinq_dark_no_tagline-Photoroom.png"
              }
              alt="TrafLinq"
              className={cx(
                "object-contain transition-all duration-300",
                collapsed && !isMobile ? "h-9 w-9 rounded-lg" : "h-14 w-auto",
              )}
            />
          </div>
        </div>

        <nav className="px-3 mt-2 space-y-6" aria-busy={accessState.status === "loading"}>
          {accessState.status === "loading" && (
            <div className="space-y-2 px-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--nav-hover-bg)]" />
              ))}
            </div>
          )}
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {group.titleKey && (
                <div className={cx(
                  "px-3 mb-2 text-[11px] font-bold text-[var(--nav-group-label)] uppercase tracking-wider transition-all duration-300 overflow-hidden whitespace-nowrap text-start",
                  (collapsed && !isMobile) ? "opacity-0 max-h-0 mb-0" : "opacity-100 max-h-5"
                )}>
                  {t(group.titleKey)}
                </div>
              )}
              <div className="space-y-1.5">
                {group.items.map((item, itemIndex) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  const label = t(item.labelKey);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={(collapsed && !isMobile) ? label : undefined}
                      onClick={() => isMobile && setIsMobileMenuOpen(false)}
                      style={isMobile ? { animationDelay: `${(itemIndex + 1 + groupIndex * 3) * 50}ms` } : undefined}
                      className={cx(
                        "group flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200 relative overflow-hidden",
                        isMobile && "animate-fade-slide-up opacity-0",
                        active
                          ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
                          : "text-[var(--nav-inactive-text)] hover:text-[var(--text-primary)] hover:bg-[var(--nav-hover-bg)]"
                      )}
                    >
                      {active && <div className="absolute start-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-e-full bg-[var(--cort-orange)]" />}

                      <Icon size={20} strokeWidth={active ? 2 : 1.5} className={cx("shrink-0 transition-transform duration-200", active ? "text-[var(--nav-active-text)]" : "group-hover:text-[var(--text-primary)]")} />

                      <span className={cx(
                        "whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden",
                        (collapsed && !isMobile) ? "opacity-0 max-w-0" : "opacity-100 max-w-[200px]"
                      )}>
                        {label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-[var(--nav-border)] p-3 mt-auto bg-[var(--nav-footer-bg)]">
        <div className={cx("flex items-center gap-3 rounded-lg p-2 transition-all duration-300", (collapsed && !isMobile) ? "justify-center" : "justify-between hover:bg-[var(--nav-hover-bg)]")}>
          <div className="flex items-center gap-3 overflow-hidden">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name || "Company"}
                className="h-8 w-8 rounded-full object-cover shrink-0 ring-1 ring-white/10"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[#fe8503]/20 border border-[#fe8503]/30 flex items-center justify-center text-xs text-[#fe8503] ring-1 ring-[var(--border-default)] shrink-0">
                {company?.name?.[0]?.toUpperCase() || <Users size={14} />}
              </div>
            )}

            <div className={cx(
              "flex flex-col overflow-hidden transition-all duration-300 ease-in-out whitespace-nowrap text-start",
              (collapsed && !isMobile) ? "max-w-0 opacity-0" : "max-w-[150px] opacity-100"
            )}>
              <span className="truncate text-xs font-semibold text-[var(--text-secondary)] ltr-content">
                {user?.email}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">{t("shell.companyAccount")}</span>
            </div>
          </div>

          <div className={cx("flex items-center gap-1", (collapsed && !isMobile) ? "hidden" : "flex")}>
            {onSaudiRoute && (
              <button
                type="button"
                onClick={() => setLocale(locale === "en" ? "ar" : "en")}
                className="shrink-0 rounded-md px-2 py-1.5 text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors flex items-center gap-1"
                title={locale === "en" ? t("locale.switchToArabic") : t("locale.switchToEnglish")}
              >
                <Languages size={14} />
                <span>{locale === "en" ? t("locale.arabic") : t("locale.english")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={toggle}
              className="shrink-0 rounded-md p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
              title={theme === "dark" ? t("shell.switchToLight") : t("shell.switchToDark")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="shrink-0 rounded-md p-1.5 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title={tCommon("actions.signOut")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] font-sans">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--nav-border)] bg-[var(--bg-header)] px-6 md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="rounded-xl p-2.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] active:scale-95 transition-all"
        >
          <Menu size={24} />
        </button>
        <div className="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <img src="/traflinq_dark_no_tagline-Photoroom.png" alt="TrafLinq" className="h-10 w-auto" />
        </div>
        {onSaudiRoute ? (
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            className="rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-muted)]"
          >
            {locale === "en" ? t("locale.arabic") : t("locale.english")}
          </button>
        ) : (
          <div className="w-10" />
        )}
      </header>

      <div className="flex min-h-screen">
        <aside
          className={cx(
            "sticky top-4 h-[calc(100vh-2rem)] hidden shrink-0 border border-[var(--border-default)] bg-[var(--bg-sidebar)] text-[var(--text-primary)] md:flex md:flex-col transition-all duration-300 ease-in-out relative z-20 ms-4 my-4 rounded-[2rem] shadow-xl",
            collapsed ? "w-20" : "w-72"
          )}
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -end-3 top-9 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-input)] text-[var(--text-muted)] shadow-sm hover:text-[var(--text-primary)] hover:scale-105 transition-all focus:outline-none"
          >
            {collapsed ? (
              <ChevronRight size={14} className={isRtl ? "rtl-flip" : ""} />
            ) : (
              <ChevronLeft size={14} className={isRtl ? "rtl-flip" : ""} />
            )}
          </button>
          <SidebarContent />
        </aside>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative flex w-full max-w-xs flex-1 flex-col bg-[var(--bg-sidebar)] animate-slide-in-left">
              <div className="absolute end-2 top-2">
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] active:scale-95 transition-all"
                >
                  <ChevronLeft size={24} className={isRtl ? "" : "rtl-flip"} />
                </button>
              </div>
              <SidebarContent isMobile />
            </div>
          </div>
        )}

        <div className="relative flex min-w-0 flex-1 flex-col">
          <Suspense fallback={null}>
            <TrialOnboardingWalkthrough
              forceOpen={guideOpen}
              onClose={() => setGuideOpen(false)}
              sidebarCollapsed={collapsed}
            />
          </Suspense>
          <main
            data-company-main
            className="mx-auto w-full max-w-full flex-1 px-4 py-4 md:px-8 bg-[var(--bg-page)] min-h-screen"
          >
            {trialInfo && (
              <div className="mb-4 alert-banner-brand flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col">
                  <div className="font-semibold">{t("trial.banner.title")}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {t.rich("trial.banner.expires", {
                      hours: () => <span className="text-[var(--cort-orange)] font-semibold">{trialInfo.remainingHours}h</span>,
                    })}
                  </div>
                  {!user?.trial_onboarding_completed && (
                    <button
                      type="button"
                      onClick={() => setGuideOpen(true)}
                      className="mt-1 text-start text-xs font-semibold text-[#f47f00] hover:underline w-fit"
                    >
                      {t("trial.banner.viewGuide")}
                    </button>
                  )}
                </div>
                <a
                  href="https://calendar.app.google/qeHQgMANfWNr77yz6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-[#f47f00] px-4 py-2 text-xs font-bold text-white hover:bg-[#f47f00]/90 transition-colors"
                >
                  {t("trial.banner.bookDemo")}
                </a>
              </div>
            )}
            <div key={pathname} className="page-transition-enter min-h-full">
              <CompanyAccessGate>{children}</CompanyAccessGate>
            </div>
          </main>
        </div>
      </div>
      <Toaster position={isRtl ? "top-left" : "top-right"} richColors dir={isRtl ? "rtl" : "ltr"} />
    </div>
  );
}
