"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/contexts/auth-context";
import { PageSkeleton } from "../ui/Skeleton";
import { CrudAction, PermissionKey } from "../../lib/types/auth-types";

interface PermissionGateProps {
  /** The permission key required to view this content */
  permission: PermissionKey;
  /** Which action is required (default: read — list/view pages). */
  action?: CrudAction;
  /** Where to redirect if access is denied (defaults to /admin) */
  redirectTo?: string;
  children: React.ReactNode;
}

/**
 * Wrap page content with this component to enforce permission checks.
 * - SUPER_ADMIN → always renders children.
 * - INTERNAL_STAFF → renders children only if they have the required CRUD action (default read).
 * - Other roles → redirects immediately.
 *
 * @example
 * // In /admin/invoicing/page.tsx
 * export default function InvoicingPage() {
 *   return (
 *     <PermissionGate permission="invoicing">
 *       <InvoicingContent />
 *     </PermissionGate>
 *   );
 * }
 */
export function PermissionGate({
  permission,
  action = "read",
  redirectTo = "/admin",
  children,
}: PermissionGateProps) {
  const { hasCrud, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  const allowed = hasCrud(permission, action);

  useEffect(() => {
    if (!loading && isAuthenticated && !allowed) {
      router.replace(redirectTo);
    }
  }, [loading, isAuthenticated, allowed, router, redirectTo]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (!allowed) {
    return null; // redirect is in progress
  }

  return <>{children}</>;
}
