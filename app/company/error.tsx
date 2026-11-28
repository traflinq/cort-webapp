"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "@/app/components/icons";
import { Button } from "@/app/admin/ui";

export default function CompanyError({
    error,
    retry,
    reset,
}: {
    error: Error & { digest?: string };
    /** Re-fetches and re-renders the segment (preferred). */
    retry?: () => void;
    /** Re-renders without re-fetching; fallback for runtimes without `retry`. */
    reset?: () => void;
}) {
    const t = useTranslations("company.error");
    const tCommon = useTranslations("common.errors");

    useEffect(() => {
        console.error("[Company Error Boundary]", error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
            <div role="alert" className="flex max-w-md flex-col items-center gap-4 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
                    <AlertTriangle className="size-6" aria-hidden="true" />
                </span>
                <div>
                    <h1 className="text-lg font-semibold text-fg">{t("title")}</h1>
                    {/* Raw error messages are technical and can leak internals; show the friendly copy and a reference instead. */}
                    <p className="mt-1 text-sm text-fg-muted">{tCommon("generic")}</p>
                    {error.digest && <p className="mt-2 font-mono text-xs text-fg-muted" dir="ltr">{error.digest}</p>}
                </div>
                <Button leftIcon={<RotateCcw />} onClick={() => (retry ?? reset)?.()}>
                    {t("tryAgain")}
                </Button>
            </div>
        </div>
    );
}
