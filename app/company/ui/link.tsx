"use client";

import * as React from "react";
import Link from "next/link";
import { useCompanyBasePath } from "../lib/use-company-base-path";

/**
 * Base-path-aware navigation. Always use these for in-portal links so the Saudi
 * (`/sa`) prefix is kept: `companyPath("/company/routes")`.
 */
export function useCompanyPath() {
  return useCompanyBasePath().companyPath;
}

export const CompanyLink = React.forwardRef<HTMLAnchorElement, Omit<React.ComponentPropsWithoutRef<typeof Link>, "href"> & { href: string }>(
  function CompanyLink({ href, ...props }, ref) {
    const companyPath = useCompanyPath();
    return <Link ref={ref} href={companyPath(href)} {...props} />;
  },
);
