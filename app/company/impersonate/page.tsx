"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent, ErrorState, Spinner } from "@/app/ui";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { useCompanyBasePath } from "../lib/use-company-base-path";

/** Exchanges an admin impersonation ticket for a company session, then opens the dashboard. */
export default function CompanyImpersonatePage() {
  return (
    <Suspense fallback={null}>
      <ImpersonateExchange />
    </Suspense>
  );
}

function ImpersonateExchange() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("company.impersonate");
  const { refreshProfile } = useAuth();
  const { companyPath } = useCompanyBasePath();
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const ticket = searchParams.get("ticket");
    void (async () => {
      if (!ticket) {
        setError(t("missingTicket"));
        return;
      }
      try {
        await apiClient.exchangeImpersonationTicket(ticket);
        await refreshProfile();
        router.replace(companyPath("/company"));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("invalidLink"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4 text-fg">
      <Card className="w-full max-w-md">
        <CardContent>
          {error ? (
            <ErrorState compact title={t("expiredTitle")} message={error} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
              <Spinner size="lg" label={t("signingIn")} />
              <p className="text-sm font-medium text-fg">{t("signingIn")}</p>
              <p className="text-xs text-fg-muted">{t("redirecting")}</p>
            </div>
          )}
          {error && (
            <div className="mt-2 flex justify-center">
              <Button asChild variant="outline">
                <Link href={companyPath("/company/login")}>{t("backToLogin")}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
