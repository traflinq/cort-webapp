"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/app/admin/ui";

/**
 * Route-level fallback for every company page. It mirrors the shared page frame
 * (title, subtitle, primary action, content) so the hand-off to each page's own
 * skeleton doesn't jump.
 */
export default function CompanyLoading() {
    const t = useTranslations("common.status");
    return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12" role="status" aria-busy="true">
            <span className="sr-only">{t("loading")}</span>
            <div className="flex items-end justify-between gap-4" aria-hidden="true">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="h-4 w-64 max-w-[60vw]" />
                </div>
                <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
            <div className="h-72 rounded-xl border border-line bg-card" aria-hidden="true" />
        </div>
    );
}
