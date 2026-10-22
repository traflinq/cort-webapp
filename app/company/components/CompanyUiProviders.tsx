"use client";

import { useMemo, type ReactNode } from "react";
import { FormatProvider, UiLabelsProvider, type FormatConfig } from "@/app/ui";
import { BUSINESS_TZ } from "@/app/ui/lib/format";
import { useCompanyLocale } from "../lib/locale-context";
import { useCompanyUiLabels } from "../lib/ui-labels";

/** Wires next-intl into the shared primitives: translated labels and locale-aware formatters. */
export function CompanyUiProviders({ children }: { children: ReactNode }) {
  const { locale } = useCompanyLocale();
  const labels = useCompanyUiLabels();
  const config = useMemo<FormatConfig>(
    () => ({
      locale: locale === "ar" ? "ar-SA" : "en-PK",
      numberLocale: locale === "ar" ? "ar-SA" : "en-US",
      currency: "PKR",
      timeZone: BUSINESS_TZ,
      relative: labels.relative as FormatConfig["relative"],
    }),
    [locale, labels.relative],
  );
  return (
    <UiLabelsProvider labels={labels}>
      <FormatProvider config={config}>{children}</FormatProvider>
    </UiLabelsProvider>
  );
}
