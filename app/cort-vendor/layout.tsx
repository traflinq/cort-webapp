"use client";

import type { ReactNode } from "react";
import { ProtectedRoute } from "../lib/components/protected-route";
import { UserRole } from "../lib/types/auth-types";
import { AdminThemeProvider } from "../admin/lib/theme-context";
import { TooltipProvider } from "../admin/ui/Tooltip";
import { AdminToaster } from "../admin/ui";
import { CortVendorShell } from "./components/CortVendorShell";

/** Portal for Cort's own supplier vendors (CORT_VENDOR): read-only view of their fleet, routes and trips. */
export default function CortVendorLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[UserRole.CORT_VENDOR]} redirectTo="/vendor/login">
      <AdminThemeProvider>
        <TooltipProvider delayDuration={300} skipDelayDuration={200}>
          {/* .admin-portal opts into the shared admin design tokens (light/dark). */}
          <div className="admin-portal">
            <CortVendorShell>{children}</CortVendorShell>
            <AdminToaster />
          </div>
        </TooltipProvider>
      </AdminThemeProvider>
    </ProtectedRoute>
  );
}
