"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Button } from "@/app/ui";
import { useAuth } from "@/app/lib/contexts/auth-context";
import { TRIAL_DEMO_CALENDAR_URL } from "../lib/constants";

const MINUTE = 60_000;
const subscribeMinute = (cb: () => void) => {
  const id = window.setInterval(cb, MINUTE);
  return () => window.clearInterval(id);
};
/** Current time at minute resolution, as an external store so the banner re-renders as the trial counts down. */
const useMinuteNow = () => useSyncExternalStore(subscribeMinute, () => Math.floor(Date.now() / MINUTE) * MINUTE, () => 0);

export function TrialBanner({ onOpenGuide }: { onOpenGuide: () => void }) {
  const t = useTranslations("company");
  const { user } = useAuth();
  const now = useMinuteNow();
  const remainingHours =
    user?.is_trial && user.trial_expires_at && now > 0
      ? Math.max(0, Math.ceil((new Date(user.trial_expires_at).getTime() - now) / (60 * MINUTE)))
      : null;

  if (remainingHours === null) return null;

  return (
    <div
      role="status"
      className="mb-5 flex flex-col gap-3 rounded-xl border border-brand-line bg-brand-soft px-4 py-3 text-sm text-fg sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden="true" />
        <div>
          <p className="font-semibold">{t("trial.banner.title")}</p>
          <p className="text-xs text-fg-secondary">
            {t.rich("trial.banner.expires", {
              hours: () => <span className="font-semibold text-brand-ink">{remainingHours}h</span>,
            })}
          </p>
          {!user?.trial_onboarding_completed && (
            <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" onClick={onOpenGuide}>
              {t("trial.banner.viewGuide")}
            </Button>
          )}
        </div>
      </div>
      <Button asChild size="sm">
        <a href={TRIAL_DEMO_CALENDAR_URL} target="_blank" rel="noopener noreferrer">
          {t("trial.banner.bookDemo")}
        </a>
      </Button>
    </div>
  );
}
