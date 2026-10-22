"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Provider } from "react-redux";
import { ConfirmProvider, PortalThemeProvider, TooltipProvider } from "@/app/ui";
import { CompanyShell } from "./ui/CompanyShell";
import { CompanyLocaleProvider } from "./lib/locale-context";
import { CompanyUiProviders } from "./components/CompanyUiProviders";
import { companyStore } from "../lib/store/company-store";
import { ProtectedRoute } from "../lib/components/protected-route";
import { UserRole } from "../lib/types/auth-types";
import { getCompanyLoginPath, isSaudiRoute, stripSaudiPrefix } from "../lib/i18n/saudi-route";

/** Public pages (login, trial redirect, impersonation exchange): light theme, no shell. */
function CompanyPublicWrapper({ children }: { children: ReactNode }) {
  return (
    <CompanyLocaleProvider>
      <CompanyUiProviders>
        <TooltipProvider delayDuration={300} skipDelayDuration={200}>
          <div data-theme="light" className="portal company-portal">
            {children}
          </div>
        </TooltipProvider>
      </CompanyUiProviders>
    </CompanyLocaleProvider>
  );
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
          <PortalThemeProvider>
            <CompanyUiProviders>
              <TooltipProvider delayDuration={300} skipDelayDuration={200}>
                <ConfirmProvider>
                  <div className="portal company-portal">
                    <CompanyShell>{children}</CompanyShell>
                  </div>
                </ConfirmProvider>
              </TooltipProvider>
            </CompanyUiProviders>
          </PortalThemeProvider>
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
  if (isPublicCompanyPath(pathname)) return <CompanyPublicWrapper>{children}</CompanyPublicWrapper>;
  return <CompanyAppWrapper>{children}</CompanyAppWrapper>;
}
