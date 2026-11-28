"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bus, Car, Calendar, MapIcon, Smartphone, UserPlus, Users, Sparkles, Play } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/app/admin/ui";
import type { AppIcon } from "@/app/components/icons";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import type { TrialModules } from "../../lib/types/auth-types";
import { useCompanyBasePath } from "../lib/use-company-base-path";
import { stripSaudiPrefix } from "../../lib/i18n/saudi-route";

type WalkthroughStep = {
  id: string;
  title: string;
  body: string;
  icon: AppIcon;
  cta: string;
  href: string | null;
  showNext?: boolean;
};

function poolSteps(
  t: (key: string) => string,
  companyPath: (path: string) => string,
): WalkthroughStep[] {
  const step = (id: string, key: string, icon: AppIcon, href: string | null, showNext?: boolean): WalkthroughStep => ({
    id,
    title: t(`steps.${key}.title`),
    body: t(`steps.${key}.body`),
    cta: t(`steps.${key}.cta`),
    icon,
    href: href ? companyPath(href) : null,
    showNext,
  });

  return [
    step("pool-welcome", "poolWelcome", Car, null),
    step("pool-vehicle", "poolVehicle", Car, "/company/fleet?tab=vehicles", true),
    step("pool-driver", "poolDriver", UserPlus, "/company/fleet?tab=drivers", true),
    step("pool-booking", "poolBooking", Calendar, "/company/bookings?action=new", true),
  ];
}

function shuttleSteps(
  t: (key: string) => string,
  companyPath: (path: string) => string,
): WalkthroughStep[] {
  const step = (id: string, key: string, icon: AppIcon, href: string | null, showNext?: boolean): WalkthroughStep => ({
    id,
    title: t(`steps.${key}.title`),
    body: t(`steps.${key}.body`),
    cta: t(`steps.${key}.cta`),
    icon,
    href: href ? companyPath(href) : null,
    showNext,
  });

  return [
    step("shuttle-welcome", "shuttleWelcome", Bus, null),
    step("shuttle-vehicle", "shuttleVehicle", Bus, "/company/fleet?tab=vehicles", true),
    step("shuttle-driver", "shuttleDriver", UserPlus, "/company/fleet?tab=drivers", true),
    step("shuttle-route", "shuttleRoute", MapIcon, "/company/routes/create", true),
    step("shuttle-employees", "shuttleEmployees", Users, "/company/routes", true),
    step("shuttle-test", "shuttleTest", Play, "/company/routes", true),
  ];
}

function buildSteps(
  modules: TrialModules | undefined,
  t: (key: string) => string,
  companyPath: (path: string) => string,
): WalkthroughStep[] {
  const m = modules ?? "pool";
  const welcomeBody =
    m === "both"
      ? t("steps.welcome.bodyBoth")
      : m === "shuttle"
        ? t("steps.welcome.bodyShuttle")
        : t("steps.welcome.bodyPool");

  const steps: WalkthroughStep[] = [
    {
      id: "welcome",
      title: t("steps.welcome.title"),
      body: welcomeBody,
      icon: Sparkles,
      cta: t("steps.welcome.cta"),
      href: null,
    },
  ];

  if (m === "pool" || m === "both") {
    if (m === "both") {
      steps.push({
        id: "section-pool",
        title: t("steps.sectionPool.title"),
        body: t("steps.sectionPool.body"),
        icon: Car,
        cta: t("steps.sectionPool.cta"),
        href: null,
      });
    }
    steps.push(...poolSteps(t, companyPath));
  }

  if (m === "shuttle" || m === "both") {
    if (m === "both") {
      steps.push({
        id: "section-shuttle",
        title: t("steps.sectionShuttle.title"),
        body: t("steps.sectionShuttle.body"),
        icon: Bus,
        cta: t("steps.sectionShuttle.cta"),
        href: null,
      });
    }
    steps.push(...shuttleSteps(t, companyPath));
  }

  steps.push({
    id: "app",
    title: t("steps.app.title"),
    body: t("steps.app.body"),
    icon: Smartphone,
    cta: t("steps.app.cta"),
    href: null,
  });

  return steps;
}

function getAppStoreUrl(): string | null {
  return process.env.NEXT_PUBLIC_APP_STORE_URL || null;
}

function getPlayStoreUrl(): string | null {
  return process.env.NEXT_PUBLIC_PLAY_STORE_URL || null;
}

type TrialOnboardingWalkthroughProps = {
  forceOpen?: boolean;
  onClose?: () => void;
  sidebarCollapsed?: boolean;
};

export function TrialOnboardingWalkthrough({
  forceOpen = false,
  onClose,
  sidebarCollapsed = false,
}: TrialOnboardingWalkthroughProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, markTrialOnboardingComplete } = useAuth();
  const { companyPath } = useCompanyBasePath();
  const t = useTranslations("company.trial");
  const [stepIndex, setStepIndex] = useState(0);
  const [completing, setCompleting] = useState(false);

  const STEPS = useMemo(
    () => buildSteps(user?.trial_modules, t, companyPath),
    [user?.trial_modules, t, companyPath],
  );

  const manuallyOpened = forceOpen || searchParams.get("walkthrough") === "1";
  const normalizedPath = pathname ? stripSaudiPrefix(pathname) : "";

  const shouldShow =
    manuallyOpened ||
    (user?.is_trial && !user.trial_onboarding_completed && normalizedPath === "/company");

  const step = STEPS[stepIndex];
  const StepIcon = step.icon;
  const isLast = stepIndex === STEPS.length - 1;

  const appStoreUrl = useMemo(() => getAppStoreUrl(), []);
  const playStoreUrl = useMemo(() => getPlayStoreUrl(), []);

  const clearWalkthroughQuery = useCallback(() => {
    if (searchParams.get("walkthrough") !== "1") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("walkthrough");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, searchParams]);

  const dismiss = useCallback(() => {
    onClose?.();
    clearWalkthroughQuery();
  }, [clearWalkthroughQuery, onClose]);

  const finish = useCallback(async () => {
    setCompleting(true);
    try {
      await apiClient.completeTrialOnboarding();
      markTrialOnboardingComplete();
      onClose?.();
      clearWalkthroughQuery();
    } catch {
      markTrialOnboardingComplete();
      onClose?.();
      clearWalkthroughQuery();
    } finally {
      setCompleting(false);
    }
  }, [clearWalkthroughQuery, markTrialOnboardingComplete, onClose]);

  const handleNext = () => {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const handlePrimary = async () => {
    if (isLast) {
      await finish();
      return;
    }
    if (step.href) {
      router.push(step.href);
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const handleSkip = async () => {
    await finish();
  };

  useEffect(() => {
    if (!shouldShow) return;
    const main = document.querySelector("[data-company-main]");
    if (!(main instanceof HTMLElement)) return;
    const previousOverflow = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = previousOverflow;
    };
  }, [shouldShow]);

  if (!shouldShow) return null;

  return (
    <div
      className={cn(
        "fixed inset-y-0 start-0 end-0 z-[100] flex items-center justify-center bg-overlay px-4 py-8",
        sidebarCollapsed ? "md:start-16" : "md:start-60",
      )}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-walkthrough-title"
        className="w-full max-w-lg rounded-xl border border-line bg-card p-6 text-fg shadow-[var(--shadow-modal)]"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="text-xs font-medium tabular-nums text-fg-muted">
            {t("setupProgress", { current: stepIndex + 1, total: STEPS.length })}
          </div>
          {manuallyOpened ? (
            <Button variant="ghost" size="sm" onClick={dismiss}>
              {t("close")}
            </Button>
          ) : (
            !forceOpen &&
            stepIndex > 0 && (
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                {t("skipForNow")}
              </Button>
            )
          )}
        </div>

        <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-line bg-subtle text-fg-secondary">
          <StepIcon size={20} strokeWidth={1.75} />
        </div>

        <h2 id="trial-walkthrough-title" className="text-lg font-semibold tracking-tight text-fg">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.body}</p>

        {step.id === "app" && (appStoreUrl || playStoreUrl) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {appStoreUrl && (
              <Button asChild variant="outline" size="sm">
                <Link href={appStoreUrl} target="_blank" rel="noopener noreferrer">
                  {t("appStore")}
                </Link>
              </Button>
            )}
            {playStoreUrl && (
              <Button asChild variant="outline" size="sm">
                <Link href={playStoreUrl} target="_blank" rel="noopener noreferrer">
                  {t("googlePlay")}
                </Link>
              </Button>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center gap-2">
          {stepIndex > 0 && (
            <Button variant="outline" onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
              {t("back")}
            </Button>
          )}
          <div className="ms-auto flex items-center gap-2">
            {step.showNext && (
              <Button variant="outline" onClick={handleNext} disabled={completing}>
                {t("next")}
              </Button>
            )}
            <Button onClick={handlePrimary} disabled={completing}>
              {completing ? t("saving") : step.cta}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={cn("h-1 flex-1 rounded-full transition-colors", i <= stepIndex ? "bg-brand" : "bg-line")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
