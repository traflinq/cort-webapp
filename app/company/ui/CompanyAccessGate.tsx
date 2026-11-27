"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, Lock } from "lucide-react";
import { getSaudiBasePath, stripSaudiPrefix, withSaudiBase } from "@/app/lib/i18n/saudi-route";
import { useCompanyAccessState } from "../lib/access-context";
import { canOpenCompanyPath } from "../lib/pages";

/**
 * Renders a company page only once the company's access is known and allows it.
 * Loading → skeleton; failure → error with retry; page not allowed → "not available"
 * (a trial account is sent back to its dashboard instead, as before).
 */
export function CompanyAccessGate({ children }: { children: ReactNode }) {
  const t = useTranslations("company.access");
  const tCommon = useTranslations("common");
  const { state, retry } = useCompanyAccessState();
  const router = useRouter();
  const pathname = usePathname() ?? "/company";
  const basePath = getSaudiBasePath(pathname);
  const home = withSaudiBase("/company", basePath);

  const allowed = state.status === "ready" ? canOpenCompanyPath(stripSaudiPrefix(pathname), state.access) : null;
  const sendTrialHome = state.status === "ready" && allowed === false && !!state.access.trial;

  useEffect(() => {
    if (sendTrialHome) router.replace(home);
  }, [sendTrialHome, router, home]);

  if (state.status === "loading") return <PageSkeleton />;

  if (state.status === "no-company") {
    return <Notice icon={<AlertCircle />} title={tCommon("errors.noCompanySelected")} />;
  }

  if (state.status === "error") {
    return (
      <Notice icon={<AlertCircle />} title={t("failedTitle")} description={t("failedDescription")} detail={state.message}>
        <button
          type="button"
          onClick={retry}
          className="rounded-xl bg-[var(--cort-orange)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--cort-orange-hover)]"
        >
          {tCommon("actions.tryAgain")}
        </button>
      </Notice>
    );
  }

  if (!allowed) {
    if (sendTrialHome) return <PageSkeleton />;
    return (
      <Notice icon={<Lock />} title={t("unavailableTitle")} description={t("unavailableDescription")}>
        <Link href={home} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-fg hover:bg-subtle">
          {t("backToDashboard")}
        </Link>
      </Notice>
    );
  }

  return <>{children}</>;
}

function Notice({ icon, title, description, detail, children }: { icon: ReactNode; title: string; description?: string; detail?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div role="status" className="flex max-w-md flex-col items-center gap-3 rounded-3xl border border-line bg-card p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-subtle text-fg-muted [&_svg]:size-6">{icon}</span>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
        {detail && <p className="text-xs text-fg-muted" dir="auto">{detail}</p>}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 pb-12" aria-busy="true">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-subtle" />
      <div className="h-24 animate-pulse rounded-3xl border border-line bg-card" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-line bg-card" />
        ))}
      </div>
    </div>
  );
}
