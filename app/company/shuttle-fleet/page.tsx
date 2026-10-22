"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useCompanyBasePath } from "../lib/use-company-base-path";

/** Legacy path — fleet is unified at /company/fleet */
export default function ShuttleFleetRedirectPage() {
  return (
    <Suspense fallback={null}>
      <Redirect />
    </Suspense>
  );
}

function Redirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { companyPath } = useCompanyBasePath();

  useEffect(() => {
    const tab = searchParams.get("tab");
    router.replace(companyPath(tab ? `/company/fleet?tab=${tab}` : "/company/fleet"));
  }, [router, searchParams, companyPath]);

  return null;
}
