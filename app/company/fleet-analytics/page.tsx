"use client";

import { RedirectToAnalytics } from "../analytics/RedirectToAnalytics";

/** Legacy path — Fleet Analytics is part of /company/analytics. */
export default function FleetAnalyticsRedirectPage() {
  return <RedirectToAnalytics />;
}
