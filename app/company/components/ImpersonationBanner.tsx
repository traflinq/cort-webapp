"use client";

import { useTranslations } from "next-intl";
import { Eye, LogOut } from "lucide-react";
import { Button } from "@/app/ui";
import { useAuth } from "@/app/lib/contexts/auth-context";

/** Shown while a super admin is viewing the portal as this company (user.impersonated_by is set). */
export function ImpersonationBanner({ companyName }: { companyName?: string | null }) {
  const t = useTranslations("company.shell.impersonation");
  const { user, logout } = useAuth();
  if (!user?.impersonated_by) return null;

  return (
    <div
      role="status"
      className="mb-5 flex flex-col gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-2.5 text-sm text-fg sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <Eye className="size-4 shrink-0 text-warning-ink" aria-hidden="true" />
        <p>
          {t.rich("viewingAs", {
            company: () => <span className="font-semibold">{companyName ?? user.email}</span>,
            admin: () => <span className="font-medium">{user.impersonated_by}</span>,
          })}
        </p>
      </div>
      <Button variant="outline" size="sm" leftIcon={<LogOut />} onClick={() => logout()}>
        {t("exit")}
      </Button>
    </div>
  );
}
