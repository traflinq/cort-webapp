"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCompanyBasePath } from "../lib/use-company-base-path";

/** Legacy magic-link route — redirects to login (credentials are emailed now). */
export default function CompanyTrialLegacyRedirect() {
  const router = useRouter();
  const { companyPath } = useCompanyBasePath();

  useEffect(() => {
    router.replace(companyPath("/company/login"));
  }, [router, companyPath]);

  return null;
}
