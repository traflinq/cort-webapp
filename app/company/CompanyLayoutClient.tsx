"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Provider } from "react-redux";
import { CompanyShell } from "./ui/CompanyShell";
import { CompanyAccessProvider } from "./lib/access-context";
import { CompanyThemeProvider } from "./lib/theme-context";
import { CompanyLocaleProvider } from "./lib/locale-context";
import { companyStore } from "../lib/store/company-store";
import { ProtectedRoute } from "../lib/components/protected-route";
import { UserRole } from "../lib/types/auth-types";
import { getCompanyLoginPath, isSaudiRoute, stripSaudiPrefix } from "../lib/i18n/saudi-route";

function CompanyLoginWrapper({ children }: { children: ReactNode }) {
  return <CompanyLocaleProvider>{children}</CompanyLocaleProvider>;
}

function CompanyAppWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <ProtectedRoute
      allowedRoles={[UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE, UserRole.SUPER_ADMIN]}
      redirectTo={getCompanyLoginPath(pathname)}
    >
      <Provider store={companyStore}>
        <CompanyLocaleProvider>
          <CompanyThemeProvider>
            <CompanyAccessProvider>
              <CompanyShell>{children}</CompanyShell>
            </CompanyAccessProvider>
          </CompanyThemeProvider>
        </CompanyLocaleProvider>
      </Provider>
    </ProtectedRoute>
  );
}

function isPublicCompanyPath(pathname: string | null): boolean {
  if (!pathname) return false;

  const normalized = isSaudiRoute(pathname) ? stripSaudiPrefix(pathname) : pathname;

  return (
    pathname === "/sa" ||
    pathname === "/sa/" ||
    normalized === "/login" ||
    normalized === "/company/login" ||
    normalized === "/company/trial" ||
    normalized === "/company/impersonate" ||
    normalized === "/impersonate" ||
    pathname === "/"
  );
}

export default function CompanyLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isPublicCompanyPath(pathname)) {
    return <CompanyLoginWrapper>{children}</CompanyLoginWrapper>;
  }

  return <CompanyAppWrapper>{children}</CompanyAppWrapper>;
}
