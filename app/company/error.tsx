"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/app/ui";

export default function CompanyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("company.error");
  const tCommon = useTranslations("common.errors");

  useEffect(() => {
    console.error("[Company Error Boundary]", error);
  }, [error]);

  // Never surface the raw error message to end users; the digest is in the console.
  return <ErrorState title={t("title")} message={tCommon("generic")} onRetry={reset} retryLabel={t("tryAgain")} className="min-h-[60vh]" />;
}
