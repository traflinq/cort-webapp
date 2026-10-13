"use client";

import type { ReactNode } from "react";
import { adminEyebrow } from "./ui/admin-styles";

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional row rendered under the title (tabs, filters, chips). */
  children?: ReactNode;
};

/** Standard page title block — use on every admin page instead of hand-styled <h1>s. */
export function AdminPageHeader({ eyebrow, title, description, action, children }: AdminPageHeaderProps) {
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <div className={adminEyebrow}>{eyebrow}</div>}
          <h1 className={eyebrow ? "mt-1" : undefined}>{title}</h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{description}</p>
          )}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </div>
  );
}
