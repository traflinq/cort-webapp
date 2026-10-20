"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui/Button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Admin Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div role="alert" className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-line bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-fg">Something went wrong</h2>
          <p className="mt-1 text-sm text-fg-muted">
            This page hit an unexpected error. You can retry, or go back to the dashboard.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-[11px] text-fg-muted">Reference: {error.digest}</p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" asChild>
            <Link href="/admin">Go to dashboard</Link>
          </Button>
          <Button onClick={reset} leftIcon={<RefreshCw />}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
