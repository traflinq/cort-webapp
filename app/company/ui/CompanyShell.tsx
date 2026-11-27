"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { centerOf } from "../../lib/theme-transition";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Desktop rail, as in Super Admin (app/admin/ui/AdminShell.tsx): 64px of icons that expands over
  // the content while hovered or keyboard-focused, and collapses again after navigating.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = hovered || focused;
  const closeTimer = useRef<number | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  // After navigating, the pointer is still over the rail; ignore it until it leaves and comes back.
  const suppressed = useRef(false);
  const pointerInside = useRef(false);
  const mounted = useRef(false);

  const openRail = () => {
    pointerInside.current = true;
    if (suppressed.current) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setHovered(true);
  };
  // Short grace period so brushing past the edge doesn't make the rail flicker shut.
  const closeRail = () => {
    pointerInside.current = false;
    suppressed.current = false;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setHovered(false), 120);
  };

  // Collapse on every route change and drop focus from the clicked link.
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setHovered(false);
    setFocused(false);
  }
  useEffect(() => {
    // Only swallow hover when the pointer is already over the rail (the user just clicked a link there).
    suppressed.current = mounted.current && pointerInside.current;
    mounted.current = true;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    const el = document.activeElement;
    if (el instanceof HTMLElement && asideRef.current?.contains(el)) el.blur();
  }, [pathname]);
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);
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
  // Layout is identical in rail and expanded states (icon in a fixed 40px slot, label beside it),
  // so expanding is just the container widening and the labels fading in. Nothing jumps.
  const renderSidebar = (isMobile = false) => {
    const show = isMobile || expanded;
    const fade = cn("transition-opacity duration-150", show ? "opacity-100 delay-75" : "opacity-0");
    return (
      <>
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 overflow-hidden ps-4 pe-3">
          <div className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/app_icon.png" alt="" className="size-8 shrink-0 rounded-lg object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wordmark} alt="TrafLinq" className={cn("h-8 w-auto max-w-none", fade)} />
          </div>
          {isMobile && (
            <IconButton
              label={tCommon("actions.close")}
              tooltip={false}
              size="icon-sm"
              onClick={() => setIsMobileMenuOpen(false)}
              className="shrink-0 text-fg-muted hover:text-fg"
            >
              <PanelLeft strokeWidth={1.75} className="rtl:-scale-x-100" />
            </IconButton>
          )}
        </div>

        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 [scrollbar-width:thin]"
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
            <div key={groupIndex} className={cn(groupIndex > 0 && "mt-3")}>
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
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => isMobile && setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex h-9 items-center overflow-hidden whitespace-nowrap rounded-lg text-sm font-medium transition-colors",
                          active ? "bg-nav-active text-nav-active-fg shadow-[var(--nav-active-shadow)]" : "text-fg-secondary hover:bg-subtle hover:text-fg",
                          focusRing,
                        )}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center">
                          <Icon size={18} strokeWidth={1.75} />
                        </span>
                        <span className={cn("truncate pe-3", fade)}>{t(item.labelKey)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 overflow-hidden border-t border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="flex size-10 shrink-0 items-center justify-center">
                {company?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.logo_url}
                    alt={company.name || "Company"}
                    className="size-8 rounded-full border border-line object-cover"
                  />
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
                <span className="ltr-content truncate text-xs font-medium text-fg">{user?.email}</span>
                <span className="truncate text-xs text-fg-muted">{t("shell.companyAccount")}</span>
              </div>
            </div>

            <div className={cn("flex shrink-0 items-center", fade)}>
              {onSaudiRoute && (
                <Tooltip content={localeTitle}>
                  <Button variant="ghost" size="sm" onClick={toggleLocale} leftIcon={<Languages />}>
                    {localeLabel}
                  </Button>
                </Tooltip>
              )}
              <IconButton label={themeLabel} size="icon-sm" onClick={(e) => toggle(centerOf(e.currentTarget))}>
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
        {/* Reserves the rail's width in the layout; the real sidebar overlays the content when expanded. */}
        <div className="relative hidden w-16 shrink-0 md:block">
          <aside
            ref={asideRef}
            onMouseEnter={openRail}
            onMouseLeave={closeRail}
            onFocus={(e) => {
              // Only keyboard focus expands the rail; a mouse click on a link must not pin it open.
              if (e.target instanceof HTMLElement && e.target.matches(":focus-visible")) setFocused(true);
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
            }}
            className={cn(
              "fixed inset-y-0 start-0 z-40 overflow-hidden border-e bg-[var(--bg-sidebar)] transition-[width,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)]",
              expanded ? "w-60 border-line shadow-[var(--shadow-modal)]" : "w-16 border-transparent",
            )}
          >
            <div className="flex h-full w-60 flex-col">{renderSidebar()}</div>
          </aside>
        </div>

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
              sidebarCollapsed
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
