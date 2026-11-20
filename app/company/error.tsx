"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorState } from "./ui";

export default function CompanyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("company.error");
  const tCommon = useTranslations("common.errors");

  useEffect(() => {
    console.error("[Company Error Boundary]", error);
  }, [error]);

  // The technical message goes to the console; users get a plain explanation and a retry.
  return <ErrorState className="min-h-[60vh]" title={t("title")} message={tCommon("generic")} onRetry={reset} />;
}
