"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Dialog, DialogContent } from "@/app/ui";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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

type TrialOnboardingWalkthroughProps = {
  forceOpen?: boolean;
  onClose?: () => void;
  /** Kept for API compatibility; the dialog is centred over the page regardless of the rail state. */
  sidebarCollapsed?: boolean;
};

export function TrialOnboardingWalkthrough({ forceOpen = false, onClose }: TrialOnboardingWalkthroughProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, markTrialOnboardingComplete } = useAuth();
  const { companyPath } = useCompanyBasePath();
  const t = useTranslations("company.trial");
  const [stepIndex, setStepIndex] = useState(0);
  const [completing, setCompleting] = useState(false);

  const STEPS = useMemo(() => buildSteps(user?.trial_modules, t, companyPath), [user?.trial_modules, t, companyPath]);

  const manuallyOpened = forceOpen || searchParams.get("walkthrough") === "1";
  const normalizedPath = pathname ? stripSaudiPrefix(pathname) : "";
  const shouldShow = manuallyOpened || (!!user?.is_trial && !user.trial_onboarding_completed && normalizedPath === "/company");

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
    } catch {
      /* mark complete locally even if the API call fails, as before */
    } finally {
      markTrialOnboardingComplete();
      onClose?.();
      clearWalkthroughQuery();
      setCompleting(false);
    }
  }, [clearWalkthroughQuery, markTrialOnboardingComplete, onClose]);

  const handleNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));

  const handlePrimary = async () => {
    if (isLast) {
      await finish();
      return;
    }
    if (step.href) {
      router.push(step.href);
      return;
    }
    handleNext();
  };

  // Dismissable only when opened on purpose; a first-run walkthrough is completed or skipped through its own buttons.
  const handleOpenChange = (open: boolean) => {
    if (!open && manuallyOpened) dismiss();
  };

  return (
    <Dialog open={shouldShow} onOpenChange={handleOpenChange}>
      <DialogContent
        size="lg"
        hideClose={!manuallyOpened}
        title={step.title}
        description={t("setupProgress", { current: stepIndex + 1, total: STEPS.length })}
        onEscapeKeyDown={(e) => {
          if (!manuallyOpened) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (!manuallyOpened) e.preventDefault();
        }}
        footer={
          <>
            {stepIndex > 0 && (
              <Button variant="outline" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} className="me-auto">
                {t("back")}
              </Button>
            )}
            {!manuallyOpened && !forceOpen && stepIndex > 0 && (
              <Button variant="ghost" onClick={() => void finish()} disabled={completing}>
                {t("skipForNow")}
              </Button>
            )}
            {step.showNext && (
              <Button variant="outline" onClick={handleNext} disabled={completing}>
                {t("next")}
              </Button>
            )}
            <Button onClick={() => void handlePrimary()} loading={completing}>
              {completing ? t("saving") : step.cta}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <StepIcon size={24} aria-hidden="true" />
          </div>
          <p className="text-sm leading-relaxed text-fg-secondary">{step.body}</p>

          {step.id === "app" && (appStoreUrl || playStoreUrl) && (
            <div className="flex flex-wrap gap-2">
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

          <ol className="flex gap-1.5" aria-label={t("setupProgress", { current: stepIndex + 1, total: STEPS.length })}>
            {STEPS.map((s, i) => (
              <li key={s.id} aria-current={i === stepIndex ? "step" : undefined} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= stepIndex ? "bg-brand" : "bg-subtle")} />
            ))}
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}
