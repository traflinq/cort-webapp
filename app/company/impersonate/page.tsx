"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/app/admin/ui/Button";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";

export default function CompanyImpersonatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const ticket = searchParams.get("ticket");
    if (!ticket) {
      setError("Missing login ticket.");
      return;
    }

    (async () => {
      try {
        await apiClient.exchangeImpersonationTicket(ticket);
        await refreshProfile();
        router.replace("/company");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "This login link is invalid or has expired."
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-page px-4 font-sans text-fg">
      <div className="w-full max-w-sm rounded-xl border border-line bg-card px-6 py-8 text-center">
        {error ? (
          <>
            <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
              <AlertCircle aria-hidden="true" className="size-5" />
            </div>
            <h2 className="text-base font-semibold text-fg">Login link expired</h2>
            <p className="mt-1.5 text-sm text-fg-muted">{error}</p>
            <Button asChild className="mt-6">
              <a href="/company/login">Back to login</a>
            </Button>
          </>
        ) : (
          <div role="status" aria-live="polite">
            <Loader2 aria-hidden="true" className="mx-auto mb-4 size-6 animate-spin text-fg-muted" />
            <h2 className="text-base font-semibold text-fg">Signing you in&hellip;</h2>
            <p className="mt-1.5 text-sm text-fg-muted">Redirecting to the company dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
}
