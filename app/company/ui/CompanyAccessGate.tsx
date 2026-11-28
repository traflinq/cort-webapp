"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, Lock } from "@/app/components/icons";
import { getSaudiBasePath, stripSaudiPrefix, withSaudiBase } from "@/app/lib/i18n/saudi-route";
import { useCompanyAccessState } from "../lib/access-context";
import { canOpenCompanyPath } from "../lib/pages";
import { Button, Skeleton } from "@/app/admin/ui";

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
        <Button onClick={retry}>{tCommon("actions.tryAgain")}</Button>
      </Notice>
    );
  }

  if (!allowed) {
    if (sendTrialHome) return <PageSkeleton />;
    return (
      <Notice icon={<Lock />} title={t("unavailableTitle")} description={t("unavailableDescription")}>
        <Button asChild variant="outline">
          <Link href={home}>{t("backToDashboard")}</Link>
        </Button>
      </Notice>
    );
  }

  return <>{children}</>;
}

function Notice({ icon, title, description, detail, children }: { icon: ReactNode; title: string; description?: string; detail?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div role="status" className="flex max-w-md flex-col items-center gap-2 rounded-xl border border-line bg-card p-8 text-center">
        <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-subtle text-fg-muted [&_svg]:size-5">{icon}</span>
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
        {detail && <p className="text-xs text-fg-muted" dir="auto">{detail}</p>}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-line bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-32" />
            <Skeleton className="mt-3 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-xl border border-line bg-card p-4">
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}
