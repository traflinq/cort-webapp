"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { pillClasses } from "../ui/PillButton";
import { Bus, Car, Calendar, Map, Smartphone, UserPlus, Users, Sparkles, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import type { TrialModules } from "../../lib/types/auth-types";
import { useCompanyBasePath } from "../lib/use-company-base-path";
import { stripSaudiPrefix } from "../../lib/i18n/saudi-route";

type WalkthroughStep = {
  id: string;
  title: string;
  body: string;
  icon: LucideIcon;
  cta: string;
  href: string | null;
  showNext?: boolean;
};

type StepCopy = {
  title: string;
  body: string;
  cta: string;
};

function poolSteps(
  t: (key: string) => string,
  companyPath: (path: string) => string,
): WalkthroughStep[] {
  const step = (id: string, key: string, icon: LucideIcon, href: string | null, showNext?: boolean): WalkthroughStep => ({
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
  const step = (id: string, key: string, icon: LucideIcon, href: string | null, showNext?: boolean): WalkthroughStep => ({
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
    step("shuttle-route", "shuttleRoute", Map, "/company/routes/create", true),
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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type TrialOnboardingWalkthroughProps = {
  forceOpen?: boolean;
  onClose?: () => void;
};

export function TrialOnboardingWalkthrough({
  forceOpen = false,
  onClose,
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
      className={cx(
        "fixed top-0 end-0 bottom-0 z-[100] flex items-center justify-center bg-[var(--bg-overlay)] px-4 py-8 backdrop-blur-[2px]",
        "start-0",
      )}
    >
      <div className="w-full max-w-xl rounded-[var(--radius-card)] bg-[var(--bg-card)] p-8 shadow-[var(--shadow-modal)] text-[var(--text-primary)]">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="rounded-full bg-[var(--tone-brand-soft)] px-3 py-1 text-xs text-[var(--tone-brand-ink)]">
            {t("setupProgress", { current: stepIndex + 1, total: STEPS.length })}
          </div>
          {manuallyOpened ? (
            <button
              type="button"
              onClick={dismiss}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              {t("close")}
            </button>
          ) : (
            !forceOpen &&
            stepIndex > 0 && (
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {t("skipForNow")}
              </button>
            )
          )}
        </div>

        <div className="flex size-14 items-center justify-center rounded-full bg-[var(--tile-bg)] text-[var(--cort-orange)] mb-5">
          <StepIcon size={24} />
        </div>

        <h2 className="text-2xl font-medium">{step.title}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)]">{step.body}</p>

        {step.id === "app" && (appStoreUrl || playStoreUrl) && (
          <div className="mt-5 flex flex-wrap gap-3">
            {appStoreUrl && (
              <Link
                href={appStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={pillClasses("outline", "sm")}
              >
                {t("appStore")}
              </Link>
            )}
            {playStoreUrl && (
              <Link
                href={playStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={pillClasses("outline", "sm")}
              >
                {t("googlePlay")}
              </Link>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center gap-3">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              className={pillClasses("outline", "sm")}
            >
              {t("back")}
            </button>
          )}
          <div className="ms-auto flex items-center gap-3">
            {step.showNext && (
              <button
                type="button"
                onClick={handleNext}
                disabled={completing}
                className={pillClasses("outline", "sm")}
              >
                {t("next")}
              </button>
            )}
            <button
              type="button"
              onClick={handlePrimary}
              disabled={completing}
              className={pillClasses("primary", "sm")}
            >
              {completing ? t("saving") : step.cta}
            </button>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIndex ? "bg-[var(--cort-orange)]" : "bg-[var(--tile-bg)]"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
