"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PanelLeft } from "@/app/components/icons";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Button, IconButton, focusRing } from "@/app/admin/ui";
import { useSidebarCollapsed } from "@/app/admin/ui/shell/useSidebarCollapsed";
import { useAuth } from "../../lib/contexts/auth-context";
import { useCompanyTheme } from "../lib/theme-context";
import { useCompanyLocale } from "../lib/locale-context";
import { useCompanyAccessState } from "../lib/access-context";
import { companyNav } from "../lib/pages";
import { getSaudiBasePath, stripSaudiPrefix, withSaudiBase } from "../../lib/i18n/saudi-route";
import { TrialOnboardingWalkthrough } from "../components/TrialOnboardingWalkthrough";
import { CompanyAccessGate } from "./CompanyAccessGate";
import { CompanyTopBar } from "./CompanyTopBar";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Desktop sidebar: open by default; the collapse button shrinks it to the icon rail (remembered),
  // as in Super Admin (app/admin/ui/AdminShell.tsx).
  const [collapsed, setCollapsed] = useSidebarCollapsed("company-sidebar-collapsed");

  // On desktop the content panel is the scroll container, so start each page at its top.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

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
  const wordmark = theme === "light" ? "/traflinq_light_no_tagline-Photoroom.png" : "/traflinq_dark_no_tagline-Photoroom.png";

  // Plain render function (not a component) so the sidebar isn't remounted on every render.
  // Each item keeps its icon in a fixed 40px slot, so collapsing is the container narrowing and the
  // labels fading out. Nothing jumps.
  const renderSidebar = (isMobile = false) => {
    const show = isMobile || !collapsed;
    const fade = cn("transition-opacity duration-150", show ? "opacity-100 delay-75" : "pointer-events-none opacity-0");
    return (
      <>
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 overflow-hidden ps-3 pe-2">
          {show ? (
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/app_icon.png" alt="" className="size-8 shrink-0 rounded-lg object-contain" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wordmark} alt="TrafLinq" className={cn("h-8 w-auto max-w-none", fade)} />
            </div>
          ) : (
            // Collapsed: the mark doubles as the expand button (shows the panel icon on hover/focus).
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label={t("shell.expandSidebar")}
              title={t("shell.expandSidebar")}
              className={cn("group relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-subtle", focusRing)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/app_icon.png" alt="" className="size-8 rounded-lg object-contain transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0" />
              <PanelLeft className="absolute size-[18px] text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 rtl:-scale-x-100" aria-hidden="true" />
            </button>
          )}
          {isMobile ? (
            <IconButton
              label={tCommon("actions.close")}
              tooltip={false}
              size="icon-sm"
              onClick={() => setIsMobileMenuOpen(false)}
              className="shrink-0 text-fg-muted hover:text-fg"
            >
              <PanelLeft strokeWidth={1.75} className="rtl:-scale-x-100" />
            </IconButton>
          ) : (
            show && (
              <IconButton
                label={t("shell.collapseSidebar")}
                size="icon-sm"
                tooltipSide={isRtl ? "left" : "right"}
                onClick={() => setCollapsed(true)}
                className="shrink-0 text-fg-muted hover:text-fg"
              >
                <PanelLeft strokeWidth={1.75} className="rtl:-scale-x-100" />
              </IconButton>
            )
          )}
        </div>

        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 [scrollbar-width:thin]"
          aria-busy={accessState.status === "loading"}
        >
          {accessState.status === "loading" && (
            <div className="space-y-1.5 pt-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-[10px] bg-subtle" />
              ))}
            </div>
          )}
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className={cn(groupIndex > 0 && "mt-4")}>
              {(group.titleKey || groupIndex > 0) && (
                <div className="relative mb-1 h-5">
                  {group.titleKey && (
                    <div className={cn("absolute inset-x-0 top-0 truncate whitespace-nowrap px-2.5 text-start text-xs font-medium leading-5 text-fg-muted", fade)}>
                      {t(group.titleKey)}
                    </div>
                  )}
                  {groupIndex > 0 && (
                    <span
                      aria-hidden="true"
                      className={cn("absolute inset-x-1 top-1/2 h-px bg-line transition-opacity duration-150", show ? "opacity-0" : "opacity-100")}
                    />
                  )}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  const label = t(item.labelKey);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        aria-label={show ? undefined : label}
                        title={show ? undefined : label}
                        onClick={() => isMobile && setIsMobileMenuOpen(false)}
                        className={cn(
                          "group flex h-9 items-center overflow-hidden whitespace-nowrap rounded-[10px] text-sm font-medium transition-colors",
                          active ? "bg-nav-active text-nav-active-fg shadow-[var(--nav-active-shadow)]" : "text-fg-secondary hover:bg-subtle hover:text-fg",
                          focusRing,
                        )}
                      >
                        <span className={cn("flex size-10 shrink-0 items-center justify-center", active ? "text-brand" : "text-fg-muted group-hover:text-fg-secondary")}>
                          <Icon size={18} strokeWidth={1.75} />
                        </span>
                        <span className={cn("truncate pe-3", fade)}>{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Company identity. Sign-out, theme and language live in the top bar. */}
        <div className="mx-3 flex h-14 shrink-0 items-center gap-1.5 overflow-hidden border-t border-line">
          <span className="flex size-10 shrink-0 items-center justify-center">
            {company?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt="" className="size-8 rounded-full border border-line object-cover" />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-full border border-line bg-subtle text-xs font-semibold text-fg-secondary"
              >
                {company?.name?.[0]?.toUpperCase() || "·"}
              </span>
            )}
          </span>
          <div className={cn("flex min-w-0 flex-col text-start", fade)}>
            <span className="truncate text-xs font-medium text-fg">{company?.name || t("shell.companyAccount")}</span>
            <span className="truncate text-xs text-fg-muted">{t("shell.companyAccount")}</span>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="company-portal min-h-screen bg-[var(--bg-sidebar)] font-sans text-fg">
      {/* Desktop: sidebar on the frame colour, content in a rounded panel that scrolls on its own. */}
      <div className="flex min-h-screen md:h-dvh md:min-h-0 md:overflow-hidden">
        <aside
          className={cn(
            "hidden shrink-0 overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)] md:block",
            collapsed ? "w-16" : "w-60",
          )}
        >
          <div className="flex h-full w-60 flex-col">{renderSidebar()}</div>
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

        <div className="relative flex min-w-0 flex-1 flex-col md:py-2 md:pe-2">
          <Suspense fallback={null}>
            <TrialOnboardingWalkthrough
              forceOpen={guideOpen}
              onClose={() => setGuideOpen(false)}
              sidebarCollapsed={collapsed}
            />
          </Suspense>
          <div
            ref={panelRef}
            data-company-main
            className="flex min-h-screen w-full flex-1 flex-col bg-page md:min-h-0 md:overflow-y-auto md:rounded-2xl md:border md:border-line"
          >
            <CompanyTopBar
              onOpenMenu={() => setIsMobileMenuOpen(true)}
              theme={theme}
              onToggleTheme={toggle}
              company={company}
              email={user?.email}
              onLogout={() => logout()}
              locale={onSaudiRoute ? { title: localeTitle, onToggle: toggleLocale } : null}
              wordmark={wordmark}
            />
            <main className="flex-1 px-4 py-5 md:px-8 md:py-6">
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
      </div>
      <Toaster position={isRtl ? "top-left" : "top-right"} richColors dir={isRtl ? "rtl" : "ltr"} />
    </div>
  );
}
