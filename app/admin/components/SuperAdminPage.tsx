"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/contexts/auth-context";
import { PageSkeleton } from "../ui/Skeleton";

type SuperAdminPageProps = {
  redirectTo?: string;
  children: ReactNode;
};

export function SuperAdminPage({ redirectTo = "/admin", children }: SuperAdminPageProps) {
  const { isSuperAdmin, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated && !isSuperAdmin) {
      router.replace(redirectTo);
    }
  }, [loading, isAuthenticated, isSuperAdmin, router, redirectTo]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return <>{children}</>;
}
