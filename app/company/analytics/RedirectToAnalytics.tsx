"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSaudiBasePath, withSaudiBase } from "@/app/lib/i18n/saudi-route";

/** Old analytics pages (Fleet Analytics, Savings) now live as tabs of /company/analytics. */
export function RedirectToAnalytics({ tab }: { tab?: "shuttle" | "chauffeur" | "pool" }) {
  const router = useRouter();
  const basePath = getSaudiBasePath(usePathname());
  useEffect(() => {
    router.replace(withSaudiBase(`/company/analytics${tab ? `?tab=${tab}` : ""}`, basePath));
  }, [router, basePath, tab]);
  return null;
}
