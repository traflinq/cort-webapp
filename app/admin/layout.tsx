"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminShell } from "./ui/AdminShell";
import { AdminAbilityProvider } from "../lib/abilities/AdminAbilityProvider";
import { ConfirmProvider } from "./components/ConfirmProvider";
import { ProtectedRoute } from "../lib/components/protected-route";
import { UserRole } from "../lib/types/auth-types";
import { Provider } from "react-redux";
import { adminStore } from "../lib/store/admin-store";
import { AdminThemeProvider } from "./lib/theme-context";
import { TooltipProvider } from "./ui/Tooltip";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage =
    pathname === "/login" ||
    pathname === "/admin/login" ||
    pathname === "/admin/forgot-password" ||
    pathname === "/admin/reset-password" ||
    pathname === "/";

  if (isLoginPage) {
    return <div data-theme="light">{children}</div>;
  }

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.INTERNAL_STAFF]} redirectTo="/admin/login">
      <Provider store={adminStore}>
        <AdminThemeProvider>
          <AdminAbilityProvider>
            <TooltipProvider delayDuration={300} skipDelayDuration={200}>
              <ConfirmProvider>
                <div className="admin-portal">
                  <AdminShell>{children}</AdminShell>
                </div>
              </ConfirmProvider>
            </TooltipProvider>
          </AdminAbilityProvider>
        </AdminThemeProvider>
      </Provider>
    </ProtectedRoute>
  );
}
